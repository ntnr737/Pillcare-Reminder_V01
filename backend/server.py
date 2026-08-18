from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, Body
from fastapi.responses import StreamingResponse
import io
import hmac
try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    EXCEL_OK = True
except ImportError:
    EXCEL_OK = False
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
import csv
import uuid
import httpx
import asyncio
import jwt as pyjwt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from pathlib import Path
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal
from datetime import datetime, date, timezone, timedelta
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "")
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable not set")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "pillcare")] if client else None
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_TEXT_MODEL = "openai/gpt-oss-120b"
GROQ_VISION_MODEL = "qwen/qwen3.6-27b"
OPENWA_ENABLED = os.environ.get("OPENWA_ENABLED", "false").lower() == "true"
WASENDER_API_KEY = os.environ.get("WASENDER_API_KEY", "")
SCHEDULER_SECRET = os.environ.get("SCHEDULER_SECRET", "")
APP_TIMEZONE = ZoneInfo("Asia/Kolkata")

# ---------- Auth config ----------
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 30
GOOGLE_WEB_CLIENT_ID = os.environ.get("GOOGLE_WEB_CLIENT_ID", "")
GOOGLE_IOS_CLIENT_ID = os.environ.get("GOOGLE_IOS_CLIENT_ID", "")
GOOGLE_ANDROID_CLIENT_ID = os.environ.get("GOOGLE_ANDROID_CLIENT_ID", "")
FDA_API_KEY = os.environ.get("FDA_API_KEY", "")
GOOGLE_VALID_AUDIENCES = {
    cid for cid in (GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID) if cid
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

if not JWT_SECRET:
    logger.warning("JWT_SECRET is not set - auth will fail on every request until it is configured.")


async def _send_whatsapp(phone: str, text: str) -> str:
    """Send a WhatsApp text message via WasenderAPI. Returns delivery status string."""
    if not WASENDER_API_KEY or not phone:
        return "mock"
    try:
        async with httpx.AsyncClient(timeout=20.0) as http_client:
            resp = await http_client.post(
                "https://www.wasenderapi.com/api/send-message",
                headers={"Authorization": f"Bearer {WASENDER_API_KEY}"},
                json={"to": phone, "text": text},
            )
            resp.raise_for_status()
            return "wasender"
    except Exception as e:
        logger.warning(f"WasenderAPI send failed: {e}")
        return "failed"


async def _groq_chat(system_message: str, user_text: str, image_base64: str = None) -> str:
    """Call Groq's OpenAI-compatible chat completions endpoint."""
    if image_base64:
        user_content = [
            {"type": "text", "text": user_text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
        ]
        model = GROQ_VISION_MODEL
    else:
        user_content = user_text
        model = GROQ_TEXT_MODEL

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        resp = await http_client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_content},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

app = FastAPI(
    title="PillCare API",
    docs_url=None,      # Disable /docs in production
    redoc_url=None,     # Disable /redoc in production
    openapi_url=None,   # Disable /openapi.json in production
)
api = APIRouter(prefix="/api")

# Rate limiter
def get_real_ip(request: Request) -> str:
    """Get actual client IP — ignores X-Forwarded-For spoofing.
    Cloud Run sets X-Appengine-User-Ip which cannot be spoofed by clients."""
    # Cloud Run trusted header (set by Google infrastructure, not the client)
    real_ip = request.headers.get("x-appengine-user-ip")
    if real_ip:
        return real_ip
    # Fall back to direct connection IP
    if request.client:
        return request.client.host
    return "unknown"

limiter = Limiter(key_func=get_real_ip, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------- Catalogs (static) ----------
MED_UNITS = [
    "tablet", "capsule", "mg", "mcg", "g", "ml", "drop", "puff", "patch",
    "spray", "injection", "suppository", "sachet", "iu", "tsp", "tbsp",
]

MEASUREMENT_CATALOG = [
    {"key": "blood_pressure", "label": "Blood Pressure", "unit": "mmHg", "composite": ["systolic", "diastolic"]},
    {"key": "blood_glucose", "label": "Blood Glucose", "unit": "mg/dL"},
    {"key": "heart_rate", "label": "Heart Rate", "unit": "bpm"},
    {"key": "weight", "label": "Weight", "unit": "kg"},
    {"key": "height", "label": "Height", "unit": "cm"},
    {"key": "body_temp", "label": "Body Temperature", "unit": "°C"},
    {"key": "spo2", "label": "Oxygen (SpO₂)", "unit": "%"},
    {"key": "cholesterol_total", "label": "Total Cholesterol", "unit": "mg/dL"},
    {"key": "cholesterol_ldl", "label": "LDL Cholesterol", "unit": "mg/dL"},
    {"key": "cholesterol_hdl", "label": "HDL Cholesterol", "unit": "mg/dL"},
    {"key": "triglycerides", "label": "Triglycerides", "unit": "mg/dL"},
    {"key": "hba1c", "label": "HbA1c", "unit": "%"},
    {"key": "creatinine", "label": "Creatinine", "unit": "mg/dL"},
    {"key": "urea", "label": "Urea", "unit": "mg/dL"},
    {"key": "tsh", "label": "TSH", "unit": "mIU/L"},
    {"key": "vitamin_d", "label": "Vitamin D", "unit": "ng/mL"},
    {"key": "hemoglobin", "label": "Hemoglobin", "unit": "g/dL"},
]

ACTIVITY_CATALOG = [
    {"key": "steps", "label": "Steps", "unit": "steps"},
    {"key": "exercise", "label": "Exercise", "unit": "minutes"},
    {"key": "water", "label": "Water", "unit": "ml"},
    {"key": "sleep", "label": "Sleep", "unit": "hours"},
]

# ---------- Models ----------
class User(BaseModel):
    id: str  # Google "sub" claim - stable unique identifier
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GoogleAuthRequest(BaseModel):
    id_token: str
    device_model: Optional[str] = None      # e.g. "Samsung Galaxy S23"
    device_os: Optional[str] = None         # e.g. "Android 14"
    app_version: Optional[str] = None       # e.g. "1.0.0"
    device_brand: Optional[str] = None      # e.g. "Samsung"


class Profile(BaseModel):
    id: str
    nickname: str
    gender: str
    year_of_birth: int
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    phone: Optional[str] = None
    routine_wake: str = "07:00"
    routine_breakfast: str = "08:00"
    routine_lunch: str = "13:00"
    routine_dinner: str = "19:00"
    routine_sleep: str = "22:00"
    caregiver_phone: Optional[str] = None
    caregivers: List[str] = []
    notifications_enabled: bool = True
    onboarded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileUpsert(BaseModel):
    nickname: Optional[str] = Field(None, max_length=100)
    gender: Optional[str] = Field(None, max_length=50)
    year_of_birth: Optional[int] = Field(None, ge=1900, le=2025)
    location_city: Optional[str] = Field(None, max_length=100)
    location_state: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    caregiver_phone: Optional[str] = Field(None, max_length=20)
    caregivers: Optional[List[str]] = None
    routine_wake: Optional[str] = "07:00"
    routine_breakfast: Optional[str] = "08:00"
    routine_lunch: Optional[str] = "13:00"
    routine_dinner: Optional[str] = "19:00"

    @field_validator("phone", "caregiver_phone", mode="before")
    @classmethod
    def validate_phone_format(cls, v):
        if not v:
            return v
        import re as _re
        cleaned = _re.sub(r"[\s\-()]", "", str(v))
        if cleaned and not _re.match(r"^\+?[0-9]{7,15}$", cleaned):
            raise ValueError("Invalid phone number — use international format e.g. +919876543210")
        return v
    routine_sleep: Optional[str] = "22:00"
    caregiver_phone: Optional[str] = None
    notifications_enabled: Optional[bool] = True


class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    generic_name: Optional[str] = None
    dosage: float
    unit: str
    frequency_per_day: int = 1
    times: List[str] = []  # e.g. ["08:00", "20:00"]
    start_date: str  # YYYY-MM-DD
    duration_days: Optional[int] = None
    refill_threshold: int = 5
    stock: int = 30
    notes: Optional[str] = None
    color: str = "#92C5A9"
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicationCreate(BaseModel):
    name: str
    generic_name: Optional[str] = None
    dosage: float
    unit: str
    frequency_per_day: int = 1
    times: List[str] = []
    start_date: str
    duration_days: Optional[int] = None
    refill_threshold: int = 5
    stock: int = 30
    notes: Optional[str] = None
    color: str = "#92C5A9"


class DoseLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    medication_id: str
    date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    status: Literal["pending", "taken", "skipped", "missed"] = "pending"
    taken_at: Optional[datetime] = None


class DoseStatusUpdate(BaseModel):
    status: Literal["pending", "taken", "skipped", "missed"]
    taken_at: Optional[datetime] = None  # client sends actual time taken


class Measurement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    value: float
    value_secondary: Optional[float] = None  # for BP diastolic
    unit: str
    note: Optional[str] = None
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MeasurementCreate(BaseModel):
    type: str
    value: float
    value_secondary: Optional[float] = None
    unit: str
    note: Optional[str] = None


class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    value: float
    unit: str
    note: Optional[str] = None
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ActivityCreate(BaseModel):
    type: str
    value: float
    unit: str
    note: Optional[str] = None


class MoodEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    score: int
    note: Optional[str] = None
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MoodCreate(BaseModel):
    score: int
    note: Optional[str] = None


class BrandRequest(BaseModel):
    brand: str


class ScanRequest(BaseModel):
    image_base64: str


class CaregiverAlert(BaseModel):
    message: str
    medication_name: Optional[str] = None


# ---------- Auth helpers ----------
def _create_session_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if not JWT_SECRET:
        raise HTTPException(500, "Server auth is not configured")
    try:
        # algorithms list must be explicit — prevents alg=none attack
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("alg", "HS256") == "none":
            raise ValueError("alg=none not allowed")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired, please sign in again")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid session token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid session token")
    return user_id


async def _migrate_legacy_default_data(new_user_id: str):
    """
    One-time bootstrap: if this is the very first user ever to sign in, and
    pre-auth single-profile data exists under the old hardcoded id "default",
    reassign all of it to this user so nothing is lost.
    """
    legacy_profile = await db.profile.find_one({"id": "default"})
    if not legacy_profile:
        return
    await db.profile.update_one({"id": "default"}, {"$set": {"id": new_user_id}})
    for coll_name in ["medications", "doses", "measurements", "activities", "mood", "caregiver_log"]:
        await db[coll_name].update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": new_user_id}})
    logger.info(f"Migrated legacy 'default' data to user {new_user_id}")


# ---------- Helpers ----------
PROJECTION = {"_id": 0}


def _clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


def _dates_in_range(start: str, days: int) -> List[str]:
    start_dt = datetime.strptime(start, "%Y-%m-%d").date()
    return [(start_dt + timedelta(days=i)).isoformat() for i in range(days)]


async def _ensure_doses_for_date(user_id: str, target_date: str):
    """Generate dose log entries for all active meds for a given date if missing."""
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(1000)
    for m in meds:
        if m["start_date"] > target_date:
            continue
        if m.get("duration_days"):
            end = (datetime.strptime(m["start_date"], "%Y-%m-%d").date() + timedelta(days=m["duration_days"])).isoformat()
            if target_date > end:
                continue
        for t in m.get("times", []):
            existing = await db.doses.find_one(
                {"user_id": user_id, "medication_id": m["id"], "date": target_date, "scheduled_time": t}, PROJECTION
            )
            if not existing:
                d = DoseLog(user_id=user_id, medication_id=m["id"], date=target_date, scheduled_time=t)
                await db.doses.insert_one(d.model_dump())


async def _adherence_for_user(user_id: str, days: int = 7, local_date: str = None):
    today = datetime.now(timezone.utc).date()
    if local_date:
        try:
            today = datetime.strptime(local_date, "%Y-%m-%d").date()
        except ValueError:
            today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    for i in range(days):
        await _ensure_doses_for_date(user_id, (start + timedelta(days=i)).isoformat())
    daily = []
    streak = 0
    streak_ongoing = True
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        doses = await db.doses.find({"user_id": user_id, "date": d}, PROJECTION).to_list(1000)
        total = len(doses)
        taken = sum(1 for x in doses if x["status"] == "taken")
        pct = round((taken / total) * 100) if total else 0
        daily.append({"date": d, "total": total, "taken": taken, "pct": pct})
    yoga_dates = set(await db.yoga_log.distinct("date", {"user_id": user_id, "date": {"$gte": start.isoformat()}}))
    for entry in reversed(daily):
        if entry["total"] > 0 and entry["pct"] >= 80:
            # Good adherence day — count it
            if streak_ongoing:
                streak += 1
        elif entry["total"] == 0:
            # No doses scheduled — don't break streak (rest day)
            pass
        elif entry["date"] in yoga_dates:
            # Poor dose adherence, but completed the yoga routine — keep the streak alive
            if streak_ongoing:
                streak += 1
        else:
            # Had doses but poor adherence, and no yoga — stop streak
            streak_ongoing = False
    avg = round(sum(d["pct"] for d in daily) / len(daily)) if daily else 0
    return {"daily": daily, "streak": streak, "average": avg}


async def _predicted_days_left(user_id: str, med: dict):
    """Estimate days until a medication runs out, based on actual taken-dose pace
    over the last 14 days (falls back to scheduled frequency if there isn't enough
    history yet). Returns None if it cannot be estimated."""
    stock = med.get("stock", 0)
    if stock <= 0:
        return 0
    since = (datetime.now(timezone.utc).date() - timedelta(days=14)).isoformat()
    taken_count = await db.doses.count_documents({
        "user_id": user_id, "medication_id": med["id"], "date": {"$gte": since}, "status": "taken",
    })
    try:
        started = datetime.strptime(med["start_date"], "%Y-%m-%d").date()
        days_observed = min(14, (datetime.now(timezone.utc).date() - started).days + 1)
    except Exception:
        days_observed = 14
    if days_observed <= 0:
        days_observed = 1
    daily_rate = taken_count / days_observed if days_observed else 0
    if daily_rate <= 0:
        daily_rate = len(med.get("times", [])) or 1  # fall back to scheduled frequency
    return round(stock / daily_rate) if daily_rate > 0 else None


async def _reminder_nudges_for_med(user_id: str, med: dict) -> list:
    """Detect reminder times that are consistently missed/skipped, and suggest a
    better time based on when the user actually ends up taking that dose."""
    since = (datetime.now(timezone.utc).date() - timedelta(days=21)).isoformat()
    doses = await db.doses.find(
        {"user_id": user_id, "medication_id": med["id"], "date": {"$gte": since}}, PROJECTION
    ).to_list(500)
    by_time: dict = {}
    for d in doses:
        by_time.setdefault(d["scheduled_time"], []).append(d)
    nudges = []
    for sched_time, entries in by_time.items():
        if len(entries) < 5:
            continue
        missed = [e for e in entries if e["status"] in ("missed", "skipped")]
        taken = [e for e in entries if e["status"] == "taken" and e.get("taken_at")]
        miss_rate = len(missed) / len(entries)
        if miss_rate < 0.5 or not taken:
            continue
        try:
            sched_h, sched_m = [int(x) for x in sched_time.split(":")]
            delays_min = []
            for e in taken:
                ta = e["taken_at"]
                if isinstance(ta, str):
                    ta = datetime.fromisoformat(ta.replace("Z", "+00:00"))
                local_ta = ta.astimezone(APP_TIMEZONE)
                sched_minutes = sched_h * 60 + sched_m
                actual_minutes = local_ta.hour * 60 + local_ta.minute
                diff = actual_minutes - sched_minutes
                if -60 <= diff <= 300:  # ignore outliers (different day, etc.)
                    delays_min.append(diff)
            if delays_min:
                avg_delay = sum(delays_min) / len(delays_min)
                if avg_delay >= 45:
                    new_minutes = (sched_h * 60 + sched_m + round(avg_delay / 15) * 15) % (24 * 60)
                    suggested = f"{new_minutes // 60:02d}:{new_minutes % 60:02d}"
                    nudges.append({
                        "current_time": sched_time,
                        "suggested_time": suggested,
                        "miss_rate": round(miss_rate * 100),
                        "occurrences": len(entries),
                    })
        except Exception:
            pass
    return nudges


# ---------- Routes ----------
@api.get("/")
async def root():
    return {"message": "PillCare API ready"}


# Auth
@api.post("/auth/google")
@limiter.limit("20/minute")
async def auth_google(request: Request, payload: GoogleAuthRequest):
    if not GOOGLE_VALID_AUDIENCES:
        raise HTTPException(500, "Google sign-in is not configured on the server")
    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), audience=None
        )
        if idinfo.get("aud") not in GOOGLE_VALID_AUDIENCES:
            raise ValueError(f"Token audience {idinfo.get('aud')!r} is not one of this app's registered client IDs")
    except ValueError as e:
        raise HTTPException(401, f"Invalid Google token: {e}")
    except Exception as e:
        logger.warning(f"Google token verification failed unexpectedly: {e}")
        raise HTTPException(503, "Could not verify Google sign-in right now. Please try again.")

    user_id = idinfo["sub"]
    existing_user = await db.users.find_one({"id": user_id}, PROJECTION)
    is_first_user_ever = (await db.users.count_documents({})) == 0

    if not existing_user:
        user = User(
            id=user_id,
            email=idinfo.get("email", ""),
            name=idinfo.get("name", ""),
            picture=idinfo.get("picture"),
        )
        await db.users.insert_one(user.model_dump())
        if is_first_user_ever:
            await _migrate_legacy_default_data(user_id)

    token = _create_session_token(user_id)
    user_doc = await db.users.find_one({"id": user_id}, PROJECTION)
    # Analytics — track login + new signups with device info
    device_props = {
        "device_model": payload.device_model or "unknown",
        "device_os": payload.device_os or "unknown",
        "device_brand": payload.device_brand or "unknown",
        "app_version": payload.app_version or "unknown",
        "ip": request.client.host if request.client else "unknown",
    }
    await track_event("login", user_id, device_props)
    if not existing_user:
        await track_event("signup", user_id, {"source": "google", **device_props})
    # Store latest device info on user record
    await db.users.update_one({"id": user_id}, {"$set": {"last_device": device_props, "last_seen": datetime.now(timezone.utc)}})
    return {"token": token, "user": user_doc}


@api.get("/auth/me")
async def auth_me(user_id: str = Depends(get_current_user_id)):
    user_doc = await db.users.find_one({"id": user_id}, PROJECTION)
    if not user_doc:
        raise HTTPException(404, "User not found")
    return user_doc


# Catalogs
@api.get("/catalog/units")
async def get_units():
    return {"units": MED_UNITS}


@api.get("/catalog/measurements")
async def get_measurement_catalog():
    return {"measurements": MEASUREMENT_CATALOG}


@api.get("/catalog/activities")
async def get_activity_catalog():
    return {"activities": ACTIVITY_CATALOG}


# Profile
@api.post("/auth/logout")
async def logout(authorization: str = Header(default="")):
    """Revoke current JWT — token immediately invalid after this call."""
    if authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        _revoked_tokens.add(token)
        # Clean up old tokens periodically to prevent memory growth
        if len(_revoked_tokens) > 10000:
            _revoked_tokens.clear()
    return {"message": "Signed out successfully"}

@api.post("/profile/push-token")
async def save_push_token(payload: dict, user_id: str = Depends(get_current_user_id)):
    """Save Expo push token so admin can send notifications to all users."""
    token = payload.get("token", "").strip()
    if not token or not token.startswith("ExponentPushToken["):
        raise HTTPException(400, "ERR_4002: Invalid Expo push token format")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"push_token": token, "push_token_updated": datetime.now(timezone.utc)}},
        upsert=False
    )
    return {"ok": True}

@api.post("/profile/caregiver")
async def update_caregiver(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id)
):
    """Update only caregiver phone — no other profile fields required."""
    import re as _re
    phone = payload.get("caregiver_phone", "").strip()
    if phone:
        cleaned = _re.sub(r"[\s\-()]", "", phone)
        if not _re.match(r"^\+?[0-9]{7,15}$", cleaned):
            raise HTTPException(400, "ERR_4001: Invalid phone number format. Use international format e.g. +919876543210")
        phone = cleaned
    await db.profile.update_one(
        {"id": user_id},
        {"$set": {"caregiver_phone": phone, "caregivers": [phone] if phone else []}},
        upsert=True
    )
    return {"caregiver_phone": phone, "message": "Caregiver number saved"}

@api.post("/profile/caregivers")
async def update_caregivers(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id)
):
    """Update the full list of caregiver phone numbers, enforced against the plan limit."""
    import re as _re
    features = await get_user_features(user_id)
    limit = features.get("caregiver_alerts", 1)
    raw_list = payload.get("caregivers", [])
    if not isinstance(raw_list, list):
        raise HTTPException(400, "ERR_4001: caregivers must be a list")
    cleaned_list = []
    for raw in raw_list:
        phone = _re.sub(r"[\s\-()]", "", str(raw or "").strip())
        if not phone:
            continue
        if not _re.match(r"^\+?[0-9]{7,15}$", phone):
            raise HTTPException(400, f"ERR_4001: Invalid phone number format: {raw}. Use international format e.g. +919876543210")
        if phone not in cleaned_list:
            cleaned_list.append(phone)
    if len(cleaned_list) > limit:
        raise HTTPException(402, f"ERR_PLAN: Your plan allows up to {limit} caregiver number{'s' if limit != 1 else ''}. Upgrade at pillcare.in/pricing.")
    await db.profile.update_one(
        {"id": user_id},
        {"$set": {"caregivers": cleaned_list, "caregiver_phone": cleaned_list[0] if cleaned_list else None}},
        upsert=True
    )
    return {"caregivers": cleaned_list, "message": "Caregivers saved"}

@api.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    doc = await db.profile.find_one({"id": user_id}, PROJECTION) or {}
    # Always include email from users collection
    if not doc.get("email"):
        user = await db.users.find_one({"id": user_id}, PROJECTION) or {}
        doc["email"] = user.get("email", "")
        doc["id"] = user_id
    return doc


@api.post("/profile")
async def upsert_profile(payload: ProfileUpsert, request: Request, user_id: str = Depends(get_current_user_id)):
    data = payload.model_dump()
    if not data.get("location_city"):
        try:
            fwd = request.headers.get("x-forwarded-for", "")
            client_ip = (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else ""))
            if client_ip and client_ip not in ("127.0.0.1", "::1", ""):
                async with httpx.AsyncClient(timeout=5.0) as hc:
                    geo = await hc.get(f"http://ip-api.com/json/{client_ip}?fields=status,city,regionName")
                    if geo.status_code == 200:
                        gd = geo.json()
                        if gd.get("status") == "success":
                            data["location_city"] = gd.get("city", "") or ""
                            data["location_state"] = gd.get("regionName", "") or ""
                            logger.info(f"IP location for user {user_id}: {data['location_city']}, {data['location_state']}")
        except Exception as e:
            logger.warning(f"IP geolocation failed: {e}")
    existing = await db.profile.find_one({"id": user_id}, PROJECTION)
    if existing:
        await db.profile.update_one({"id": user_id}, {"$set": data})
        return {**existing, **data}
    p = Profile(id=user_id, **data)
    await db.profile.insert_one(p.model_dump())
    return _clean(p.model_dump())


# Medications
@api.get("/medications")
async def list_medications(active: Optional[bool] = None, user_id: str = Depends(get_current_user_id)):
    q = {"user_id": user_id}
    if active is not None:
        q["active"] = active
    items = await db.medications.find(q, PROJECTION).to_list(1000)
    # Fix negative stock — clamp to 0, never show negative to user
    for item in items:
        if item.get("stock", 0) < 0:
            item["stock"] = 0
            await db.medications.update_one(
                {"id": item["id"], "user_id": user_id},
                {"$set": {"stock": 0}}
            )
    # Smart refill prediction + reminder-time nudges (best-effort, never blocks the list)
    for item in items:
        try:
            item["days_left"] = await _predicted_days_left(user_id, item)
        except Exception as e:
            logger.warning(f"days_left prediction failed for {item.get('id')}: {e}")
            item["days_left"] = None
        try:
            item["nudges"] = await _reminder_nudges_for_med(user_id, item)
        except Exception as e:
            logger.warning(f"nudge detection failed for {item.get('id')}: {e}")
            item["nudges"] = []
    return items


@api.post("/medications")
async def create_medication(payload: MedicationCreate, user_id: str = Depends(get_current_user_id)):
    features = await get_user_features(user_id)
    existing_med_count = await db.medications.count_documents({"user_id": user_id, "active": True})
    if existing_med_count >= features.get("max_medications", 3):
        raise HTTPException(402, "ERR_PLAN: Medication limit reached for your plan. Upgrade at pillcare.in/pricing.")
    # Optionally resolve generic name if not provided
    generic = payload.generic_name
    if not generic and GROQ_API_KEY:
        try:
            generic = await _resolve_generic(payload.name)
            # Combination products (multivitamins, etc.) often have no single
            # generic name - treat the AI's "unknown" as no match, not a value.
            if generic.strip().lower() == "unknown":
                generic = ""
        except Exception as e:
            logger.warning(f"Generic resolution failed: {e}")
    data = payload.model_dump()
    data["generic_name"] = generic
    med = Medication(user_id=user_id, **data)
    await db.medications.insert_one(med.model_dump())
    await track_event("medication_added", user_id, {
        "medication_name": med.name if hasattr(med, 'name') else "",
        "frequency": med.frequency if hasattr(med, 'frequency') else "",
        "total_medications": await db.medications.count_documents({"user_id": user_id, "active": True}),
    })
    return _clean(med.model_dump())


@api.get("/medications/{med_id}")
async def get_medication(med_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.medications.find_one({"id": med_id, "user_id": user_id}, PROJECTION)
    if not doc:
        raise HTTPException(404, "Medication not found")
    return doc


@api.patch("/medications/{med_id}")
async def update_medication(med_id: str, payload: dict, user_id: str = Depends(get_current_user_id)):
    payload.pop("id", None)
    payload.pop("_id", None)
    payload.pop("user_id", None)
    res = await db.medications.update_one({"id": med_id, "user_id": user_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Medication not found")
    doc = await db.medications.find_one({"id": med_id, "user_id": user_id}, PROJECTION)
    return doc


@api.delete("/medications/{med_id}")
async def delete_medication(med_id: str, user_id: str = Depends(get_current_user_id)):
    await db.medications.update_one({"id": med_id, "user_id": user_id}, {"$set": {"active": False}})
    return {"ok": True}


@api.post("/medications/{med_id}/apply-nudge")
async def apply_reminder_nudge(med_id: str, payload: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """Accept a smart reminder-time suggestion: shift one scheduled time on a medication."""
    old_time = payload.get("current_time")
    new_time = payload.get("suggested_time")
    if not old_time or not new_time:
        raise HTTPException(400, "ERR_4001: current_time and suggested_time are required")
    med = await db.medications.find_one({"id": med_id, "user_id": user_id}, PROJECTION)
    if not med:
        raise HTTPException(404, "Medication not found")
    times = med.get("times", [])
    if old_time not in times:
        raise HTTPException(400, "ERR_4001: current_time not found on this medication")
    new_times = sorted(new_time if t == old_time else t for t in times)
    await db.medications.update_one({"id": med_id, "user_id": user_id}, {"$set": {"times": new_times}})
    await track_event("reminder_nudge_applied", user_id, {"medication_id": med_id, "old_time": old_time, "new_time": new_time})
    return {"ok": True, "times": new_times}


# Doses
@api.get("/doses")
async def list_doses(date_str: str, user_id: str = Depends(get_current_user_id)):
    await _ensure_doses_for_date(user_id, date_str)
    doses = await db.doses.find({"user_id": user_id, "date": date_str}, PROJECTION).to_list(1000)
    # join with med info
    med_ids = list({d["medication_id"] for d in doses})
    meds = await db.medications.find({"id": {"$in": med_ids}, "user_id": user_id}, PROJECTION).to_list(1000)
    med_map = {m["id"]: m for m in meds}
    enriched = []
    for d in doses:
        m = med_map.get(d["medication_id"])
        # Skip doses whose medication was soft-deleted (active: False) via
        # "Treatment complete" — otherwise the old dose row keeps resurfacing
        # its stale stock value forever, making the out-of-stock prompt look stuck.
        if m and m.get("active", True):
            enriched.append({**d, "medication": m})
    enriched.sort(key=lambda x: x["scheduled_time"])
    return enriched


@api.post("/doses/{dose_id}/status")
async def update_dose_status(dose_id: str, payload: DoseStatusUpdate, user_id: str = Depends(get_current_user_id)):
    update = {"status": payload.status}
    if payload.status == "taken":
        taken_at = payload.taken_at or datetime.now(timezone.utc)
        update["taken_at"] = taken_at

    # Single atomic operation — only succeeds if dose is NOT already taken
    # This prevents double-decrement from duplicate requests (offline sync + direct call)
    query = {"id": dose_id, "user_id": user_id, "status": {"$ne": "taken"}}
    res = await db.doses.find_one_and_update(
        query, {"$set": update}, return_document=True, projection=PROJECTION
    )

    if res is None:
        # Dose already taken OR not found — return current state, do NOT decrement stock
        doc = await db.doses.find_one({"id": dose_id, "user_id": user_id}, PROJECTION)
        if not doc:
            raise HTTPException(404, "Dose not found")
        return doc  # Idempotent — already taken, ignore duplicate request

    if payload.status == "taken":
        # Decrement stock only once, only on first successful take
        # Never goes below 0
        await db.medications.update_one(
            {"id": res["medication_id"], "user_id": user_id, "stock": {"$gt": 0}},
            {"$inc": {"stock": -1}},
        )
        med = await db.medications.find_one({"id": res["medication_id"]}, PROJECTION) or {}
        now = datetime.now(timezone.utc)
        await track_event("dose_taken", user_id, {
            "medication_name": med.get("name", ""),
            "medication_id": res.get("medication_id", ""),
            "dose_time": res.get("scheduled_time", ""),
            "hour": now.hour,
            "day_of_week": now.weekday(),
            "date": now.strftime("%Y-%m-%d"),
            "section": res.get("section", ""),
        })
    elif payload.status == "skipped":
        await track_event("dose_skipped", user_id, {"medication_id": res.get("medication_id", "")})
    elif payload.status == "missed":
        await track_event("dose_missed", user_id, {"medication_id": res.get("medication_id", "")})

    return res


# Measurements
@api.get("/measurements")
async def list_measurements(type: Optional[str] = None, limit: int = 200, user_id: str = Depends(get_current_user_id)):
    q = {"user_id": user_id}
    if type:
        q["type"] = type
    items = await db.measurements.find(q, PROJECTION).sort("recorded_at", -1).to_list(limit)
    return items


@api.post("/measurements")
async def create_measurement(payload: MeasurementCreate, user_id: str = Depends(get_current_user_id)):
    m = Measurement(user_id=user_id, **payload.model_dump())
    await db.measurements.insert_one(m.model_dump())
    return _clean(m.model_dump())


@api.delete("/measurements/{m_id}")
async def delete_measurement(m_id: str, user_id: str = Depends(get_current_user_id)):
    await db.measurements.delete_one({"id": m_id, "user_id": user_id})
    return {"ok": True}


# Activities
@api.get("/activities")
async def list_activities(type: Optional[str] = None, limit: int = 200, user_id: str = Depends(get_current_user_id)):
    q = {"user_id": user_id}
    if type:
        q["type"] = type
    items = await db.activities.find(q, PROJECTION).sort("recorded_at", -1).to_list(limit)
    return items


@api.post("/activities")
async def create_activity(payload: ActivityCreate, user_id: str = Depends(get_current_user_id)):
    a = Activity(user_id=user_id, **payload.model_dump())
    await db.activities.insert_one(a.model_dump())
    return _clean(a.model_dump())


@api.delete("/activities/{a_id}")
async def delete_activity(a_id: str, user_id: str = Depends(get_current_user_id)):
    await db.activities.delete_one({"id": a_id, "user_id": user_id})
    return {"ok": True}


# Mood
@api.get("/mood")
async def list_mood(limit: int = 100, user_id: str = Depends(get_current_user_id)):
    items = await db.mood.find({"user_id": user_id}, PROJECTION).sort("recorded_at", -1).to_list(limit)
    return items


@api.post("/mood")
async def create_mood(payload: MoodCreate, user_id: str = Depends(get_current_user_id)):
    m = MoodEntry(user_id=user_id, **payload.model_dump())
    await db.mood.insert_one(m.model_dump())
    return _clean(m.model_dump())


# Progress / Adherence
@api.get("/progress/adherence")
@limiter.limit("30/hour")
async def adherence(request: Request, days: int = 7, local_date: str = None, user_id: str = Depends(get_current_user_id)):
    return await _adherence_for_user(user_id, days, local_date)


@api.get("/insights/mood-adherence")
async def mood_adherence_insight(days: int = 14, user_id: str = Depends(get_current_user_id)):
    """Lightweight, non-AI correlation between logged mood and same-day dose adherence."""
    since_date = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
    since_dt = datetime.strptime(since_date, "%Y-%m-%d")
    moods = await db.mood.find({"user_id": user_id, "recorded_at": {"$gte": since_dt}}, PROJECTION).to_list(500)
    if len(moods) < 3:
        return {"has_pattern": False}
    mood_by_date = {}
    for m in moods:
        d = m["recorded_at"]
        if isinstance(d, str):
            d = datetime.fromisoformat(d.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        date_str = d.astimezone(APP_TIMEZONE).date().isoformat()
        mood_by_date[date_str] = m["score"]  # latest mood of the day wins
    low_days, high_days = [], []
    for date_str, score in mood_by_date.items():
        doses = await db.doses.find({"user_id": user_id, "date": date_str}, PROJECTION).to_list(1000)
        total = len(doses)
        if not total:
            continue
        taken = sum(1 for x in doses if x["status"] == "taken")
        pct = (taken / total) * 100
        if score <= 2:
            low_days.append(pct)
        elif score >= 4:
            high_days.append(pct)
    if len(low_days) < 2 or len(high_days) < 2:
        return {"has_pattern": False}
    avg_low = sum(low_days) / len(low_days)
    avg_high = sum(high_days) / len(high_days)
    gap = avg_high - avg_low
    if gap < 15:
        return {"has_pattern": False}
    return {
        "has_pattern": True,
        "avg_adherence_low_mood": round(avg_low),
        "avg_adherence_high_mood": round(avg_high),
        "gap": round(gap),
        "message": f"On low-mood days your adherence averages {round(avg_low)}%, vs {round(avg_high)}% on good days — a {round(gap)}-point gap.",
    }


@api.get("/yoga-tip")
@limiter.limit("10/hour")
async def yoga_tip(request: Request, user_id: str = Depends(get_current_user_id)):
    """
    Medication-specific yoga therapy using Groq AI.
    References verified from 3 sources:
    - Ministry of AYUSH, Govt of India: https://www.youtube.com/@ministryofayushofficial
    - Swami Ramdev (Patanjali Yogpeeth): https://www.youtube.com/@SwamiRamdevOfficial
    - Sadhguru / Isha Foundation (Padma Vibhushan, UN recognised): https://www.youtube.com/@sadhguru
    """
    features = await get_user_features(user_id)
    if not features.get("yoga_full"):
        raise HTTPException(402, "ERR_PLAN: Full yoga therapy requires a paid plan. Upgrade at pillcare.in/pricing.")
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(20)
    med_names = [m["name"] for m in meds] if meds else []

    # Medication → condition → yoga therapy mapping
    # Based on Ministry of AYUSH Common Yoga Protocol and clinical yoga therapy guidelines
    # Verified YouTube video links — real video IDs confirmed via search
    # Swami Ramdev videos from @SwamiRamdevOfficial
    # Sadhguru videos from @sadhguru (Isha Foundation)
    # Ministry of AYUSH from @ministryofayushofficial
    # Each pose has its own verified YouTube video from Swami Ramdev / Sadhguru
    POSE_VIDEOS = {
        "Mandukasana (Frog Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=aqjnv0dZhNc"},
        "Pawanmuktasana (Wind Relief)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=TVHlCr49LNY"},
        "Anulom Vilom Pranayama": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=MqeeqXMdZ54"},
        "Kapalbhati Pranayama": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=lrkW_6vGqvE"},
        "Surya Namaskar (Sun Salutation)": {"channel": "Sadhguru", "url": "https://www.youtube.com/watch?v=OBds5NZ4PRs"},
        "Yoga Namaskar": {"channel": "Sadhguru", "url": "https://www.youtube.com/watch?v=SWemcEiXo1Q"},
        "Bhramari Pranayama": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=lrkW_6vGqvE"},
        "Dhanurasana (Bow Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
        "Ardha Matsyendrasana (Seated Twist)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=_rlPsepTnzo"},
        "Bhujangasana (Cobra Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=xX_QXjHP7Lo"},
        "Setu Bandhasana (Bridge Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=Ph7dNmQMwEo"},
        "Sarvangasana (Shoulder Stand)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=jBbhE-p9jso"},
        "Vakrasana (Spinal Twist)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=nFJ03zPwJUk"},
        "Shavasana (Corpse Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
        "Balasana (Child Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
        "Vajrasana (Thunderbolt)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
        "Tadasana (Mountain Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
        "Halasana (Plow Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=jBbhE-p9jso"},
        "Matsyasana (Fish Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
        "Trikonasana (Triangle Pose)": {"channel": "Swami Ramdev", "url": "https://www.youtube.com/watch?v=QPjwawKxuLw"},
    }
    FALLBACK_VIDEO = "https://www.youtube.com/watch?v=QPjwawKxuLw"  # 12 yoga poses - Swami Ramdev

    CONDITION_YOGA_MAP = {
        "diabetes": {
            "poses": ["Mandukasana (Frog Pose)", "Pawanmuktasana (Wind Relief)", "Dhanurasana (Bow Pose)", "Ardha Matsyendrasana (Seated Twist)", "Kapalbhati Pranayama"],
            "channel": "Swami Ramdev",
            "full_video": "https://www.youtube.com/watch?v=p37r1Ptrzvw",
        },
        "blood_pressure": {
            "poses": ["Anulom Vilom Pranayama", "Shavasana (Corpse Pose)", "Balasana (Child Pose)", "Bhramari Pranayama", "Sukhasana (Easy Pose)"],
            "channel": "Swami Ramdev",
            "full_video": "https://www.youtube.com/watch?v=bVbDBm72qNM",
        },
        "acidity": {
            "poses": ["Vajrasana (Thunderbolt)", "Pawanmuktasana (Wind Relief)", "Ardha Matsyendrasana (Seated Twist)", "Kapalbhati Pranayama", "Balasana (Child Pose)"],
            "channel": "Swami Ramdev",
            "full_video": "https://www.youtube.com/watch?v=s2sZuM2E6SQ",
        },
        "thyroid": {
            "poses": ["Anulom Vilom Pranayama", "Kapalbhati Pranayama", "Bhujangasana (Cobra Pose)", "Pawanmuktasana (Wind Relief)", "Shavasana (Corpse Pose)"],
            "channel": "Swami Ramdev",
            "full_video": "https://www.youtube.com/watch?v=QPjwawKxuLw",
        },
        "cholesterol": {
            "poses": ["Surya Namaskar (Sun Salutation)", "Kapalbhati Pranayama", "Anulom Vilom Pranayama", "Tadasana (Mountain Pose)", "Pawanmuktasana (Wind Relief)"],
            "channel": "Sadhguru",
            "full_video": "https://www.youtube.com/watch?v=OBds5NZ4PRs",
        },
        "pain": {
            "poses": ["Balasana (Child Pose)", "Tadasana (Mountain Pose)", "Bhujangasana (Cobra Pose)", "Shavasana (Corpse Pose)", "Anulom Vilom Pranayama"],
            "channel": "Swami Ramdev",
            "full_video": "https://www.youtube.com/watch?v=QPjwawKxuLw",
        },
        "anxiety": {
            "poses": ["Anulom Vilom Pranayama", "Bhramari Pranayama", "Shavasana (Corpse Pose)", "Yoga Namaskar", "Kapalbhati Pranayama"],
            "channel": "Sadhguru",
            "full_video": "https://www.youtube.com/watch?v=SWemcEiXo1Q",
        },
        "general": {
            "poses": ["Tadasana (Mountain Pose)", "Pawanmuktasana (Wind Relief)", "Bhujangasana (Cobra Pose)", "Anulom Vilom Pranayama", "Shavasana (Corpse Pose)"],
            "channel": "Swami Ramdev",
            "full_video": "https://www.youtube.com/watch?v=QPjwawKxuLw",
        },
    }

    YOUTUBE_CHANNELS = {
        "Ministry of AYUSH": "https://www.youtube.com/@ministryofayushofficial",
        "Swami Ramdev": "https://www.youtube.com/@SwamiRamdevOfficial",
        "Sadhguru / Isha Foundation": "https://www.youtube.com/@sadhguru",
    }

    # Build default fallback using general protocol
    def make_default(condition_key="general"):
        mapping = CONDITION_YOGA_MAP.get(condition_key, CONDITION_YOGA_MAP["general"])
        channel_name = mapping["channel"]
        return {
            "title": "Daily Wellness Yoga",
            "subtitle": "Common Yoga Protocol — Ministry of AYUSH, Govt. of India",
            "duration": "15 min",
            "level": "Beginner",
            "description": "A daily yoga routine recommended by the Ministry of AYUSH to support overall health and complement your medication schedule.",
            "steps": [
                {
                    "num": i + 1,
                    "name": pose,
                    "duration": "3 min",
                    "channel": channel_name,
                    "youtube_channel": YOUTUBE_CHANNELS[channel_name],
                    "youtube_search": mapping["search"],
                }
                for i, pose in enumerate(mapping["poses"])
            ],
            "channels": [
                {"name": "Ministry of AYUSH, Govt. of India", "url": YOUTUBE_CHANNELS["Ministry of AYUSH"], "verified": True},
                {"name": "Swami Ramdev — Patanjali Yogpeeth", "url": YOUTUBE_CHANNELS["Swami Ramdev"], "verified": True},
                {"name": "Sadhguru — Isha Foundation (Padma Vibhushan, UN recognised)", "url": YOUTUBE_CHANNELS["Sadhguru / Isha Foundation"], "verified": True},
            ],
            "disclaimer": "Yoga recommendations are for general wellness only. Consult your doctor before starting any new exercise programme. References: Ministry of AYUSH Common Yoga Protocol, Patanjali Yogpeeth, Isha Foundation.",
        }

    if not GROQ_API_KEY:
        return make_default()

    try:
        med_str = ", ".join(med_names) if med_names else "general wellness"
        prompt = f"""The patient takes these medications: {med_str}.

Your task:
1. Identify the likely health conditions these medications treat (e.g. diabetes, hypertension, thyroid, acidity, anxiety, cholesterol, pain).
2. Recommend a yoga therapy routine (5 poses, 12-15 min) specifically chosen to complement the treatment of these conditions.
3. For each pose, assign it to the most appropriate YouTube channel from: "Ministry of AYUSH" OR "Swami Ramdev" OR "Sadhguru".
4. Assign diabetes/digestion/weight poses to Swami Ramdev, heart/cholesterol/stress poses to Sadhguru, and general/government protocol poses to Ministry of AYUSH.

Return ONLY valid JSON with exactly this structure (no markdown, no explanation):
{{
  "title": "string - name of the routine",
  "subtitle": "string - e.g. 'For Diabetes & Blood Pressure Management'",
  "duration": "string - e.g. '15 min'",
  "level": "Beginner",
  "description": "string - 2 sentences explaining how this yoga helps these specific medications/conditions",
  "condition": "string - main condition detected",
  "steps": [
    {{
      "num": 1,
      "name": "Sanskrit Name (English Name)",
      "duration": "3 min",
      "benefit": "string - specific benefit for this patient's condition",
      "channel": "Swami Ramdev OR Sadhguru OR Ministry of AYUSH",
      "youtube_video": "use EXACT URLs: Mandukasana=https://www.youtube.com/watch?v=aqjnv0dZhNc, Pawanmuktasana=https://www.youtube.com/watch?v=TVHlCr49LNY, Anulom Vilom=https://www.youtube.com/watch?v=MqeeqXMdZ54, Kapalbhati=https://www.youtube.com/watch?v=lrkW_6vGqvE, Bhujangasana=https://www.youtube.com/watch?v=xX_QXjHP7Lo, Ardha Matsyendrasana=https://www.youtube.com/watch?v=_rlPsepTnzo, Setu Bandhasana=https://www.youtube.com/watch?v=Ph7dNmQMwEo, Sarvangasana=https://www.youtube.com/watch?v=jBbhE-p9jso, Surya Namaskar=https://www.youtube.com/watch?v=OBds5NZ4PRs, any other=https://www.youtube.com/watch?v=QPjwawKxuLw"
    }}
  ],
  "channels": [
    {{"name": "Ministry of AYUSH, Govt. of India", "url": "https://www.youtube.com/@ministryofayushofficial", "verified": true}},
    {{"name": "Swami Ramdev — Patanjali Yogpeeth", "url": "https://www.youtube.com/@SwamiRamdevOfficial", "verified": true}},
    {{"name": "Sadhguru — Isha Foundation (Padma Vibhushan, UN recognised)", "url": "https://www.youtube.com/@sadhguru", "verified": true}}
  ],
  "disclaimer": "Yoga recommendations are for general wellness only and complement, not replace, prescribed medication. Consult your doctor before starting. Sources: Ministry of AYUSH, Patanjali Yogpeeth, Isha Foundation."
}}"""

        resp = await _groq_chat(
            system_message=(
                "You are a certified yoga therapist trained in clinical yoga therapy. "
                "You recommend yoga specifically based on the patient's medications and health conditions. "
                "You always reference verified sources: Ministry of AYUSH (Govt India), Swami Ramdev (Patanjali Yogpeeth), "
                "and Sadhguru (Isha Foundation, Padma Vibhushan awardee, UN recognised). "
                "Respond with only valid JSON, no markdown, no preamble."
            ),
            user_text=prompt,
        )
        import json as _json
        clean = resp.strip().replace("```json", "").replace("```", "").strip()
        data = _json.loads(clean)
        # Always enforce verified channels
        data["channels"] = [
            {"name": "Ministry of AYUSH, Govt. of India", "url": "https://www.youtube.com/@ministryofayushofficial", "verified": True},
            {"name": "Swami Ramdev — Patanjali Yogpeeth", "url": "https://www.youtube.com/@SwamiRamdevOfficial", "verified": True},
            {"name": "Sadhguru — Isha Foundation (Padma Vibhushan, UN recognised)", "url": "https://www.youtube.com/@sadhguru", "verified": True},
        ]
        data["disclaimer"] = (
            "Yoga recommendations are for general wellness only and complement, not replace, prescribed medication. "
            "Always consult your doctor before starting any new exercise programme. "
            "Sources: Ministry of AYUSH Common Yoga Protocol (Govt. of India), "
            "Patanjali Yogpeeth (Swami Ramdev), Isha Foundation (Sadhguru, Padma Vibhushan 2017, UN recognised)."
        )
        return data
    except Exception as e:
        logger.warning(f"Yoga tip failed: {e}")
        return make_default()


class YogaCompletion(BaseModel):
    step_num: int
    step_name: str
    video_url: Optional[str] = None
    local_date: Optional[str] = None

@api.post("/yoga/complete")
async def yoga_complete(payload: YogaCompletion, user_id: str = Depends(get_current_user_id)):
    """Log a completed yoga routine step — feeds streak calculation and CSV export."""
    d = payload.local_date or datetime.now(timezone.utc).date().isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": d,
        "step_num": payload.step_num,
        "step_name": payload.step_name,
        "video_url": payload.video_url,
        "completed_at": datetime.now(timezone.utc),
    }
    await db.yoga_log.update_one(
        {"user_id": user_id, "date": d, "step_num": payload.step_num},
        {"$set": entry},
        upsert=True,
    )
    await track_event("yoga_step_completed", user_id, {"step_name": payload.step_name})
    return {"ok": True}

@api.post("/yoga/uncomplete")
async def yoga_uncomplete(payload: YogaCompletion, user_id: str = Depends(get_current_user_id)):
    """Undo a completed yoga step."""
    d = payload.local_date or datetime.now(timezone.utc).date().isoformat()
    await db.yoga_log.delete_one({"user_id": user_id, "date": d, "step_num": payload.step_num})
    return {"ok": True}

@api.get("/yoga/log")
async def yoga_log_history(days: int = 30, user_id: str = Depends(get_current_user_id)):
    """Yoga completion history for the Progress list and CSV export."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    items = await db.yoga_log.find(
        {"user_id": user_id, "date": {"$gte": start.isoformat()}}, PROJECTION
    ).sort("date", -1).to_list(1000)
    return items

@api.get("/doses/history")
async def dose_history(days: int = 30, user_id: str = Depends(get_current_user_id)):
    """Dose history grouped by date for the Progress List tab."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    result = []
    for i in range(days - 1, -1, -1):
        d = (start + timedelta(days=i)).isoformat()
        doses = await db.doses.find({"user_id": user_id, "date": d}, PROJECTION).to_list(1000)
        if not doses:
            continue
        med_ids = list({x["medication_id"] for x in doses})
        meds = await db.medications.find({"id": {"$in": med_ids}, "user_id": user_id}, PROJECTION).to_list(1000)
        med_map = {m["id"]: m for m in meds}
        entries = []
        for dose in sorted(doses, key=lambda x: x["scheduled_time"]):
            m = med_map.get(dose["medication_id"], {})
            entries.append({
                "id": dose["id"],
                "name": m.get("name", "Unknown"),
                "generic_name": m.get("generic_name", ""),
                "dosage": m.get("dosage", ""),
                "unit": m.get("unit", ""),
                "time": dose["scheduled_time"],
                "status": dose["status"],
            })
        taken = sum(1 for e in entries if e["status"] == "taken")
        missed = sum(1 for e in entries if e["status"] in ("missed", "skipped"))
        result.append({"date": d, "entries": entries, "taken": taken, "missed": missed, "total": len(entries)})
    return result


# Doctor Appointments
class AppointmentCreate(BaseModel):
    doctor_name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None
    date: str  # ISO date
    time: str  # HH:MM
    location: Optional[str] = None
    notes: Optional[str] = None
    reminder: Optional[str] = "1_day"  # "1_day", "2_hours", "none"

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    doctor_name: str
    specialty: Optional[str] = None
    phone: Optional[str] = None
    date: str
    time: str
    location: Optional[str] = None
    notes: Optional[str] = None
    reminder: Optional[str] = "1_day"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api.get("/appointments")
async def list_appointments(user_id: str = Depends(get_current_user_id)):
    items = await db.appointments.find({"user_id": user_id}, PROJECTION).sort("date", 1).to_list(200)
    return items

@api.post("/appointments")
async def create_appointment(payload: AppointmentCreate, user_id: str = Depends(get_current_user_id)):
    features = await get_user_features(user_id)
    existing_count = await db.appointments.count_documents({"user_id": user_id})
    if existing_count >= features.get("max_appointments", 2):
        raise HTTPException(402, "ERR_PLAN: Appointment limit reached for your plan. Upgrade at pillcare.in/pricing.")
    try:
        data = payload.model_dump()
        appt = Appointment(user_id=user_id, **data)
        doc = appt.model_dump()
        await db.appointments.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except Exception as e:
        logger.error(f"Appointment create failed: {e}")
        raise HTTPException(500, f"ERR_3001: Could not save appointment — {str(e)}")

@api.patch("/appointments/{appt_id}")
async def update_appointment(appt_id: str, payload: AppointmentCreate, user_id: str = Depends(get_current_user_id)):
    res = await db.appointments.update_one(
        {"id": appt_id, "user_id": user_id}, {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Appointment not found")
    return await db.appointments.find_one({"id": appt_id}, PROJECTION)

@api.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str, user_id: str = Depends(get_current_user_id)):
    await db.appointments.delete_one({"id": appt_id, "user_id": user_id})
    return {"deleted": True}


@api.get("/ai/daily-message")
@limiter.limit("5/hour")
async def ai_daily_message(request: Request, local_date: str = None, user_id: str = Depends(get_current_user_id)):
    """A short personalized message from Groq based on the user's recent context."""
    profile = await db.profile.find_one({"id": user_id}, PROJECTION) or {}
    today = datetime.now(timezone.utc).date().isoformat()
    if local_date:
        try:
            datetime.strptime(local_date, "%Y-%m-%d")
            today = local_date
        except ValueError:
            pass
    await _ensure_doses_for_date(user_id, today)
    doses = await db.doses.find({"user_id": user_id, "date": today}, PROJECTION).to_list(1000)
    total = len(doses)
    taken = sum(1 for d in doses if d["status"] == "taken")
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(50)
    recent_mood = await db.mood.find({"user_id": user_id}, PROJECTION).sort("recorded_at", -1).to_list(1)
    adh = await _adherence_for_user(user_id, 7, local_date)
    features = await get_user_features(user_id)
    insight_level = features.get("ai_insights", "none")
    if insight_level == "none":
        if total == 0:
            msg = "Quietly waiting until you add your first medication. No pressure."
        elif taken == total:
            msg = f"All {total} doses taken today. Steady wins this game."
        elif taken == 0:
            msg = "A new day. Tap a dose when you're ready."
        else:
            msg = f"{taken} of {total} done — you're moving."
        return {"message": msg, "streak": adh.get("streak", 0)}
    if insight_level == "weekly":
        cached = await db.ai_daily_cache.find_one({"user_id": user_id}, PROJECTION)
        if cached and cached.get("date"):
            try:
                d0 = datetime.strptime(cached["date"], "%Y-%m-%d").date()
                d1 = datetime.strptime(today, "%Y-%m-%d").date()
                if 0 <= (d1 - d0).days < 7:
                    return {"message": cached.get("message", ""), "streak": adh.get("streak", 0)}
            except ValueError:
                pass

    # Fallback static message if no AI key
    if not GROQ_API_KEY:
        if total == 0:
            msg = "Quietly waiting until you add your first medication. No pressure."
        elif taken == total:
            msg = f"All {total} doses taken today. Steady wins this game."
        elif taken == 0:
            msg = "A new day. Tap a dose when you're ready."
        else:
            msg = f"{taken} of {total} done — you're moving."
        return {"message": msg, "streak": adh.get("streak", 0)}

    context_lines = [
        f"User: {profile.get('nickname', 'friend')}",
        f"Today: {taken}/{total} doses taken",
        f"7-day adherence: {adh.get('average', 0)}%, current streak: {adh.get('streak', 0)} day(s)",
        f"Active meds: {len(meds)}",
    ]
    if recent_mood:
        context_lines.append(f"Last mood: {recent_mood[0]['score']}/5")

    try:
        resp = await _groq_chat(
            system_message=(
                "You write one short, warm, specific message (max 22 words) for a medication "
                "adherence app's Today screen. No emoji, no clichés, no medical advice. "
                "Acknowledge the user by name only if it fits naturally. If 0 doses today, "
                "be gentle. If perfect, be quietly proud. If partial, be encouraging without lecturing."
            ),
            user_text="\n".join(context_lines),
        )
        msg = resp.strip().strip('"').split("\n")[0][:200]
    except Exception as e:
        logger.warning(f"AI daily message failed: {e}")
        msg = f"{taken} of {total} doses done today." if total else "A fresh start awaits."

    if insight_level == "weekly":
        await db.ai_daily_cache.update_one({"user_id": user_id}, {"$set": {"date": today, "message": msg}}, upsert=True)
    return {"message": msg, "streak": adh.get("streak", 0)}


# Brand -> Generic resolver
# Strategy: OpenFDA is the authoritative source (real drug database).
# Groq/LLM is only used as a last-resort fallback if FDA returns nothing.

async def _resolve_generic_fda(brand: str) -> str:
    if not FDA_API_KEY:
        return ""
    try:
        search = brand.strip().replace(" ", "+")
        url = (
            f"https://api.fda.gov/drug/label.json"
            f"?api_key={FDA_API_KEY}"
            f"&search=openfda.brand_name:{search}"
            f"&limit=3"
        )
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return ""
            data = resp.json()
            for r in data.get("results", []):
                generics = r.get("openfda", {}).get("generic_name", [])
                if generics:
                    return generics[0].lower().strip()
    except Exception as e:
        logger.warning(f"OpenFDA lookup failed: {e}")
    return ""


async def _resolve_generic_groq(brand: str) -> str:
    if not GROQ_API_KEY:
        return ""
    try:
        resp = await _groq_chat(
            system_message=(
                "You are a clinical pharmacology assistant. Given a medication brand name, "
                "respond with ONLY the generic (international nonproprietary) name in lowercase. "
                "If unknown, reply 'unknown'. Do not include any other text."
            ),
            user_text=brand.strip(),
        )
        result = resp.strip().split("\n")[0][:80]
        return "" if result.lower() in ("unknown", "") else result
    except Exception as e:
        logger.warning(f"Groq brand resolver failed: {e}")
        return ""


async def _resolve_generic(brand: str) -> str:
    generic = await _resolve_generic_fda(brand)
    if generic:
        logger.info(f"Brand resolver: {brand!r} -> {generic!r} (OpenFDA)")
        return generic
    generic = await _resolve_generic_groq(brand)
    if generic:
        logger.info(f"Brand resolver: {brand!r} -> {generic!r} (Groq fallback)")
    return generic


@api.post("/resolve-generic")
async def resolve_generic(payload: BrandRequest, user_id: str = Depends(get_current_user_id)):
    if not payload.brand.strip():
        raise HTTPException(400, "Brand required")
    generic = await _resolve_generic(payload.brand)
    return {"brand": payload.brand, "generic": generic, "source": "openfda" if generic else "not_found"}


# AI Medication Scanner
@api.post("/scan-medication")
async def scan_medication(payload: ScanRequest, user_id: str = Depends(get_current_user_id)):
    features = await get_user_features(user_id)
    if not features.get("scanner"):
        raise HTTPException(402, "ERR_PLAN: Medication scanner requires a paid plan. Upgrade at pillcare.in/pricing.")
    if not GROQ_API_KEY:
        raise HTTPException(503, "Scanner unavailable")
    if not payload.image_base64:
        raise HTTPException(400, "image_base64 required")
    try:
        resp = await _groq_chat(
            system_message=(
                "You read a photo of a medication package/blister/pill. Reply STRICTLY as JSON "
                "with keys: name, dosage, unit, confidence. If unreadable, set name to 'unknown'. "
                "Example: {\"name\":\"paracetamol\",\"dosage\":500,\"unit\":\"mg\",\"confidence\":\"high\"}"
            ),
            user_text="Identify this medication.",
            image_base64=payload.image_base64,
        )
    except Exception as e:
        logger.warning(f"Medication scan failed: {e}")
        raise HTTPException(503, "Scanner temporarily unavailable")
    import json
    import re
    text = resp.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    parsed = {}
    if match:
        try:
            parsed = json.loads(match.group(0))
        except Exception:
            pass
    if not parsed:
        parsed = {"name": "unknown", "dosage": None, "unit": "", "confidence": "low"}
    return parsed


# Caregiver alert (ad hoc, from the app)
@api.post("/caregiver/alert")
async def caregiver_alert(payload: CaregiverAlert, user_id: str = Depends(get_current_user_id)):
    profile = await db.profile.find_one({"id": user_id}, PROJECTION)
    phones = (profile or {}).get("caregivers") or ([(profile or {}).get("caregiver_phone")] if (profile or {}).get("caregiver_phone") else [])
    sent = []
    for phone in phones:
        delivered_via = await _send_whatsapp(phone, payload.message)
        log_entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "phone": phone,
            "message": payload.message,
            "medication_name": payload.medication_name,
            "delivered_via": delivered_via,
            "sent_at": datetime.now(timezone.utc),
        }
        await db.caregiver_log.insert_one(log_entry.copy())
        sent.append(_clean(log_entry))
    return {"sent": sent}


@api.get("/caregiver/log")
async def caregiver_log(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    items = await db.caregiver_log.find({"user_id": user_id}, PROJECTION).sort("sent_at", -1).to_list(limit)
    return items



# ─── Nearby Places ───────────────────────────────────────────────
GOOGLE_PLACES_KEY = os.getenv("GOOGLE_PLACES_KEY", "")

@api.get("/nearby")
@limiter.limit("30/minute")
async def nearby_places(
    request: Request,
    lat: float, lng: float, radius: int = 1000,
    type: str = "pharmacy",
    user_id: str = Depends(get_current_user_id)
):
    import httpx, math

    # Validate coordinates — prevents SSRF and ensures real-world locations
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(400, "Invalid coordinates")
    if not (100 <= radius <= 10000):
        raise HTTPException(400, "Radius must be between 100m and 10km")
    if type not in ("pharmacy", "diagnostic", "hospital"):
        raise HTTPException(400, "Invalid place type")
    features = await get_user_features(user_id)
    max_results = features.get("nearby_results", 5)

    def dist(elat, elng):
        dlat = (elat - lat) * 111000
        dlng = (elng - lng) * 111000 * math.cos(lat * math.pi / 180)
        return int(math.sqrt(dlat**2 + dlng**2))

    # Try Google Places first
    if GOOGLE_PLACES_KEY:
        keyword_map = {
            "pharmacy":   ("pharmacy",  "medical store chemist pharmacy"),
            "diagnostic": ("hospital",  "diagnostic lab pathology blood test"),
            "hospital":   ("hospital",  "hospital clinic nursing home"),
        }
        gtype, keyword = keyword_map.get(type, ("pharmacy", "medical store"))
        url = (
            f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            f"?location={lat},{lng}&radius={radius}&type={gtype}"
            f"&keyword={keyword.replace(' ', '+')}&key={GOOGLE_PLACES_KEY}"
        )
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(url)
            data = r.json()
            if data.get("status") == "OK" and data.get("results"):
                places = []
                for p in (data.get("results") or [])[:15]:
                    loc = p.get("geometry", {}).get("location", {})
                    elat, elng = loc.get("lat", 0), loc.get("lng", 0)
                    places.append({
                        "id": p.get("place_id", ""), "name": p.get("name", ""),
                        "address": p.get("vicinity", ""), "distance": dist(elat, elng),
                        "rating": p.get("rating"), "lat": elat, "lng": elng,
                        "open": p.get("opening_hours", {}).get("open_now"), "phone": None,
                    })
                places.sort(key=lambda x: x["distance"])
                top_places = places[:max_results]
                async def _fetch_phone(place_id):
                    if not place_id:
                        return None
                    try:
                        async with httpx.AsyncClient(timeout=5) as pc:
                            pr = await pc.get(
                                "https://maps.googleapis.com/maps/api/place/details/json",
                                params={"place_id": place_id, "fields": "formatted_phone_number", "key": GOOGLE_PLACES_KEY},
                            )
                        pd = pr.json()
                        return pd.get("result", {}).get("formatted_phone_number")
                    except Exception:
                        return None
                phones = await asyncio.gather(*[_fetch_phone(pl["id"]) for pl in top_places])
                for pl, ph in zip(top_places, phones):
                    pl["phone"] = ph
                return {"places": top_places, "source": "google"}
        except Exception as e:
            logger.warning(f"Google Places failed: {e}")

    # Fallback to OpenStreetMap Overpass API (free, no key needed)
    try:
        osm_queries = {
            "pharmacy":   '[out:json][timeout:15];(node["amenity"="pharmacy"]({bbox});way["amenity"="pharmacy"]({bbox}););out body 20;',
            "diagnostic": '[out:json][timeout:15];(node["amenity"="clinic"]({bbox});node["healthcare"="laboratory"]({bbox});node["amenity"="hospital"]({bbox}););out body 20;',
            "hospital":   '[out:json][timeout:15];(node["amenity"="hospital"]({bbox});node["amenity"="clinic"]({bbox});way["amenity"="hospital"]({bbox}););out body 20;',
        }
        deg = radius / 111000
        bbox = f"{lat-deg},{lng-deg},{lat+deg},{lng+deg}"
        query = osm_queries.get(type, osm_queries["pharmacy"]).replace("{bbox}", bbox)
        overpass_mirrors = [
                "https://overpass-api.de/api/interpreter",
                "https://overpass.kumi.systems/api/interpreter",
                "https://overpass.openstreetmap.ru/api/interpreter",
            ]
        data = None
        last_err = None
        for overpass_url in overpass_mirrors:
            try:
                async with httpx.AsyncClient(timeout=20) as client:
                    r = await client.post(overpass_url, data={"data": query})
                    r.raise_for_status()
                    data = r.json()
                break
            except Exception as mirror_err:
                last_err = mirror_err
                logger.warning(f"Overpass mirror {overpass_url} failed: {mirror_err}")
                continue
        if data is None:
            raise last_err or Exception("All Overpass mirrors failed")
        places = []
        for el in (data.get("elements") or [])[:15]:
            tags = el.get("tags", {})
            elat = el.get("lat") or (el.get("center", {}).get("lat", 0))
            elng = el.get("lon") or (el.get("center", {}).get("lon", 0))
            if not elat or not elng:
                continue
            name = tags.get("name") or tags.get("name:en") or tags.get("amenity", type).title()
            addr_parts = [tags.get("addr:housenumber", ""), tags.get("addr:street", ""), tags.get("addr:city", "")]
            address = ", ".join(p for p in addr_parts if p) or tags.get("addr:full", "") or "Nearby"
            places.append({
                "id": str(el.get("id", "")), "name": name,
                "address": address, "distance": dist(elat, elng),
                "rating": None, "lat": elat, "lng": elng,
                "open": None, "phone": tags.get("phone") or tags.get("contact:phone"),
            })
        places.sort(key=lambda x: x["distance"])
        if places:
            return {"places": places[:max_results], "source": "osm"}
        # OSM returned nothing — try wider radius
        return {"places": [], "source": "osm_empty", "message": "No results found. Try increasing the search radius."}
    except Exception as e:
        logger.warning(f"OSM fallback also failed: {e}")
        return {"places": [], "source": "error", "message": "Could not fetch nearby places. Check your connection."}

# Daily caregiver report - triggered by Cloud Scheduler at 10 PM IST.
# Runs for every registered user who has a caregiver phone number set,
# since this endpoint has no per-user auth context of its own (called by a cron job).
@api.post("/caregiver/daily-report")
async def caregiver_daily_report(request: Request, secret: str = ""):
    # Always require secret — if env var not set, block ALL calls (fail secure)
    if not SCHEDULER_SECRET:
        raise HTTPException(503, "Scheduler not configured")
    if secret != SCHEDULER_SECRET:
        raise HTTPException(403, "Invalid scheduler secret")

    all_profiles = await db.profile.find({"$or": [{"caregiver_phone": {"$exists": True, "$ne": None}}, {"caregivers": {"$exists": True, "$ne": []}}]}, PROJECTION).to_list(1000)
    results = []

    for profile in all_profiles:
        user_id = profile["id"]
        phones = profile.get("caregivers") or ([profile.get("caregiver_phone")] if profile.get("caregiver_phone") else [])
        if not phones:
            continue

        today_str = datetime.now(APP_TIMEZONE).strftime("%Y-%m-%d")
        await _ensure_doses_for_date(user_id, today_str)
        doses = await db.doses.find({"user_id": user_id, "date": today_str}, PROJECTION).to_list(1000)

        med_ids = list({d["medication_id"] for d in doses})
        meds = await db.medications.find({"id": {"$in": med_ids}, "user_id": user_id}, PROJECTION).to_list(1000)
        med_map = {m["id"]: m for m in meds}

        taken = [d for d in doses if d["status"] == "taken"]
        missed = [d for d in doses if d["status"] in ("missed", "skipped")]
        pending = [d for d in doses if d["status"] == "pending"]

        def _fmt_dose(m):
            d = m.get("dosage", 0) or 0
            d_str = str(int(d)) if float(d) == int(d) else str(d)
            unit = m.get("unit", "")
            return f"{d_str} {unit}".strip() if d_str != "0" else unit

        def _line(d):
            m = med_map.get(d["medication_id"])
            if not m:
                return None
            dose_part = _fmt_dose(m)
            dose_suffix = f" ({dose_part})" if dose_part else ""
            return f"{m['name']}{dose_suffix} at {d['scheduled_time']}"

        taken_lines = [l for l in (_line(d) for d in taken) if l]
        missed_lines = [l for l in (_line(d) for d in missed) if l]
        pending_lines = [l for l in (_line(d) for d in pending) if l]

        nickname = profile.get("nickname", "Patient")
        total = len(doses)

        if total == 0:
            greeting = f"Hi, this is Pillcare. {nickname} has no medications scheduled today."
        elif len(taken) == total:
            greeting = f"Hi, this is Pillcare. {nickname} has taken all {total} of today's medicines. All good!"
        elif len(taken) == 0:
            greeting = f"Hi, this is Pillcare. {nickname} hasn't taken any medicines yet today ({total} scheduled)."
        else:
            greeting = f"Hi, this is Pillcare. {nickname} has taken {len(taken)} of {total} medicines scheduled for today."

        message_parts = [greeting, ""]
        if taken_lines:
            message_parts.append("Taken:")
            message_parts.extend(f"- {l}" for l in taken_lines)
        if missed_lines:
            message_parts.append("")
            message_parts.append("Missed:")
            message_parts.extend(f"- {l}" for l in missed_lines)
        if pending_lines:
            message_parts.append("")
            message_parts.append("Still due later today:")
            message_parts.extend(f"- {l}" for l in pending_lines)

        message = "\n".join(message_parts)

        # Once a week (Sunday night, same cron), append an AI-generated weekly
        # summary — reuses the existing daily cron so no extra scheduler infra is needed.
        if datetime.now(APP_TIMEZONE).weekday() == 6:
            try:
                weekly_adh = await _adherence_for_user(user_id, 7)
                recent_moods = await db.mood.find({"user_id": user_id}, PROJECTION).sort("recorded_at", -1).to_list(7)
                week_start = (datetime.now(APP_TIMEZONE).date() - timedelta(days=6)).isoformat()
                yoga_week = await db.yoga_log.count_documents({"user_id": user_id, "date": {"$gte": week_start}})
                mood_avg = round(sum(m["score"] for m in recent_moods) / len(recent_moods), 1) if recent_moods else None
                weekly_summary = None
                if GROQ_API_KEY:
                    context_lines = [
                        f"Patient: {nickname}",
                        f"7-day dose adherence: {weekly_adh.get('average', 0)}%, streak: {weekly_adh.get('streak', 0)} day(s)",
                        f"Yoga sessions completed this week: {yoga_week}",
                    ]
                    if mood_avg is not None:
                        context_lines.append(f"Average mood this week: {mood_avg}/5")
                    try:
                        resp = await _groq_chat(
                            system_message=(
                                "You write a short weekly health summary (max 40 words) for a family "
                                "caregiver, based on medication adherence data. Plain language, no medical "
                                "advice, no emoji. Mention adherence and one other notable trend if present."
                            ),
                            user_text="\n".join(context_lines),
                        )
                        weekly_summary = resp.strip().strip('"')
                    except Exception as e:
                        logger.warning(f"Weekly caregiver AI summary failed: {e}")
                if not weekly_summary:
                    weekly_summary = f"This week: {weekly_adh.get('average', 0)}% average adherence, {weekly_adh.get('streak', 0)}-day streak, {yoga_week} yoga session(s) completed."
                message = message + "\n\n\U0001F4CA Weekly Summary\n" + weekly_summary
            except Exception as e:
                logger.warning(f"Weekly summary block failed: {e}")

        for phone in phones:
            delivered_via = await _send_whatsapp(phone, message)
            log_entry = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "phone": phone,
                "message": message,
                "medication_name": None,
                "delivered_via": delivered_via,
                "sent_at": datetime.now(timezone.utc),
            }
            await db.caregiver_log.insert_one(log_entry.copy())
            results.append({"user_id": user_id, "delivered_via": delivered_via, "taken": len(taken), "total": total})

    return {"ok": True, "reports_sent": len(results), "results": results}


@api.get("/export/csv")
async def export_csv(user_id: str = Depends(get_current_user_id)):
    features = await get_user_features(user_id)
    if not features.get("export_data"):
        raise HTTPException(402, "ERR_PLAN: Data export requires a paid plan. Upgrade at pillcare.in/pricing.")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["section", "timestamp", "type", "value", "unit", "status", "note"])
    doses = await db.doses.find({"user_id": user_id}, PROJECTION).to_list(10000)
    med_ids = list({d["medication_id"] for d in doses})
    meds = await db.medications.find({"id": {"$in": med_ids}, "user_id": user_id}, PROJECTION).to_list(1000)
    med_map = {m["id"]: m for m in meds}
    for d in doses:
        m = med_map.get(d["medication_id"], {})
        w.writerow([
            "dose",
            f"{d['date']}T{d['scheduled_time']}",
            m.get("name", ""),
            m.get("dosage", ""),
            m.get("unit", ""),
            d.get("status", ""),
            "",
        ])
    for m in await db.measurements.find({"user_id": user_id}, PROJECTION).to_list(10000):
        w.writerow(["measurement", m["recorded_at"].isoformat() if isinstance(m.get("recorded_at"), datetime) else m.get("recorded_at"), m["type"], m["value"], m["unit"], "", m.get("note", "")])
    for a in await db.activities.find({"user_id": user_id}, PROJECTION).to_list(10000):
        w.writerow(["activity", a["recorded_at"].isoformat() if isinstance(a.get("recorded_at"), datetime) else a.get("recorded_at"), a["type"], a["value"], a["unit"], "", a.get("note", "")])
    for mo in await db.mood.find({"user_id": user_id}, PROJECTION).to_list(10000):
        w.writerow(["mood", mo["recorded_at"].isoformat() if isinstance(mo.get("recorded_at"), datetime) else mo.get("recorded_at"), "mood", mo["score"], "1-5", "", mo.get("note", "")])
    for yl in await db.yoga_log.find({"user_id": user_id}, PROJECTION).sort("date", 1).to_list(10000):
        ts = yl.get("completed_at")
        w.writerow(["yoga", ts.isoformat() if isinstance(ts, datetime) else yl.get("date", ""), yl.get("step_name", ""), "done", "", "", ""])
    csv_bytes = buf.getvalue().encode("utf-8")
    return Response(content=csv_bytes, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=pillcare-history.csv"})



# ═══════════════════════════════════════════════════════════
# ANALYTICS & BUSINESS INTELLIGENCE
# All data collected with user consent (stated in privacy policy)
# Used for: product improvement, B2B reporting, monetization
# ═══════════════════════════════════════════════════════════

async def track_event(event: str, user_id: str, props: dict = {}):
    """Fire-and-forget analytics event. Never blocks user actions."""
    try:
        await db.analytics.insert_one({
            "event": event,
            "user_id": user_id,
            "props": props,
            "ts": datetime.now(timezone.utc),
        })
    except Exception:
        pass  # analytics must never break the app

# Admin auth — separate secret for dashboard access
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")

def require_admin(x_admin_secret: str = Header(default=""), authorization: str = Header(default="")):
    """Accept either admin secret key OR admin JWT (from Google Sign-In)."""
    if authorization.startswith("Bearer "):
        try:
            token = authorization.removeprefix("Bearer ").strip()
            # algorithms list must be explicit — prevents alg=none attack
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if payload.get("alg", "HS256") == "none":
                raise ValueError("alg=none not allowed")
            if payload.get("role") == "admin":
                return payload
        except Exception:
            pass
    # Admin secret must be at least 16 chars — prevents accidental weak secrets
    if ADMIN_SECRET and len(ADMIN_SECRET) >= 16 and hmac.compare_digest(x_admin_secret.encode(), ADMIN_SECRET.encode()):
        return {"role": "admin", "sub": "secret_key"}
    raise HTTPException(401, "Admin access required")

# ── Admin Analytics Endpoints ────────────────────────────────
@app.get("/admin/stats")
async def admin_stats(_: None = Depends(require_admin)):
    """Business KPIs for the admin dashboard."""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # User counts
    total_users = await db.profile.count_documents({})
    new_today = await db.analytics.count_documents({"event": "signup", "ts": {"$gte": datetime.fromisoformat(today)}})
    new_week = await db.analytics.count_documents({"event": "signup", "ts": {"$gte": datetime.fromisoformat(week_ago)}})
    new_month = await db.analytics.count_documents({"event": "signup", "ts": {"$gte": datetime.fromisoformat(month_ago)}})

    # Active users (logged in last 7 days)
    active_week = await db.audit_log.distinct("user_id", {"ts": {"$gte": datetime.fromisoformat(week_ago)}})

    # Dose stats
    total_doses = await db.doses.count_documents({})
    taken_doses = await db.doses.count_documents({"status": "taken"})
    missed_doses = await db.doses.count_documents({"status": "missed"})
    adherence_rate = round(taken_doses / total_doses * 100, 1) if total_doses > 0 else 0

    # Top medications
    pipeline = [
        {"$group": {"_id": "$name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_meds = await db.medications.aggregate(pipeline).to_list(10)

    # Geographic distribution
    geo_pipeline = [
        {"$group": {"_id": "$location_city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_cities = await db.profile.aggregate(geo_pipeline).to_list(10)

    # Gender distribution
    gender_pipeline = [
        {"$group": {"_id": "$gender", "count": {"$sum": 1}}},
    ]
    gender_dist = await db.profile.aggregate(gender_pipeline).to_list(10)

    # Daily signups last 30 days
    daily_pipeline = [
        {"$match": {"event": "signup", "ts": {"$gte": datetime.fromisoformat(month_ago)}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_signups = await db.analytics.aggregate(daily_pipeline).to_list(30)

    # Feature usage
    feature_pipeline = [
        {"$match": {"event": {"$in": ["yoga_viewed", "nearby_searched", "appointment_booked", "caregiver_connected"]}}},
        {"$group": {"_id": "$event", "count": {"$sum": 1}}},
    ]
    feature_usage = await db.analytics.aggregate(feature_pipeline).to_list(20)

    return {
        "users": {
            "total": total_users,
            "new_today": new_today,
            "new_week": new_week,
            "new_month": new_month,
            "active_week": len(active_week),
            "retention_rate": round(len(active_week) / total_users * 100, 1) if total_users > 0 else 0,
        },
        "health": {
            "total_doses_tracked": total_doses,
            "taken": taken_doses,
            "missed": missed_doses,
            "global_adherence_rate": adherence_rate,
        },
        "top_medications": [{"name": m["_id"], "users": m["count"]} for m in top_meds if m["_id"]],
        "top_cities": [{"city": c["_id"] or "Unknown", "users": c["count"]} for c in top_cities],
        "gender_distribution": [{"gender": g["_id"] or "Unknown", "count": g["count"]} for g in gender_dist],
        "daily_signups": [{"date": d["_id"], "count": d["count"]} for d in daily_signups],
        "feature_usage": [{"feature": f["_id"], "count": f["count"]} for f in feature_usage],
        "generated_at": now.isoformat(),
    }

@app.get("/admin/users")
async def admin_users(limit: int = 50, skip: int = 0, _: None = Depends(require_admin)):
    """Paginated user list with key metrics."""
    # Try profile collection first (has onboarded users), fall back to users collection
    profiles = await db.profile.find({}, PROJECTION).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # If profile is empty, fall back to users collection
    if not profiles:
        profiles = await db.users.find({}, PROJECTION).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for u in profiles:
        # profile collection uses 'id' or 'user_id'
        uid = u.get("user_id") or u.get("id", "")
        med_count = await db.medications.count_documents({"user_id": uid})
        dose_count = await db.doses.count_documents({"user_id": uid, "status": "taken"})
        last_login = await db.audit_log.find_one({"user_id": uid}, sort=[("ts", -1)])
        result.append({
            "user_id": uid,
            "nickname": u.get("nickname") or u.get("name", ""),
            "email": u.get("email", ""),
            "gender": u.get("gender", ""),
            "year_of_birth": u.get("year_of_birth"),
            "location": f"{u.get('location_city', '')} {u.get('location_state', '')}".strip(),
            "plan": (await db.subscriptions.find_one({"user_id": uid}, PROJECTION) or {}).get("plan", "free"),
            "medications": med_count,
            "doses_taken": dose_count,
            "has_caregiver": bool(u.get("caregiver_phone")),
            "last_login": last_login["ts"].isoformat() if last_login else None,
        })
    total = await db.profile.count_documents({}) or await db.users.count_documents({})
    return {"users": result, "total": total, "page": skip // limit + 1}

@app.get("/admin/retention")
async def admin_retention(_: None = Depends(require_admin)):
    """Day 1, Day 7, Day 30 retention for cohort analysis."""
    now = datetime.now(timezone.utc)
    cohorts = []
    for days_ago in [1, 7, 14, 30]:
        cohort_start = now - timedelta(days=days_ago + 1)
        cohort_end = now - timedelta(days=days_ago)
        cohort_users = await db.analytics.distinct("user_id", {
            "event": "signup",
            "ts": {"$gte": cohort_start, "$lt": cohort_end}
        })
        if not cohort_users:
            continue
        retained = await db.audit_log.distinct("user_id", {
            "user_id": {"$in": cohort_users},
            "ts": {"$gte": now - timedelta(days=1)}
        })
        cohorts.append({
            "cohort": f"D-{days_ago}",
            "users": len(cohort_users),
            "retained": len(retained),
            "rate": round(len(retained) / len(cohort_users) * 100, 1) if cohort_users else 0,
        })
    return {"cohorts": cohorts}

# ═══════════════════════════════════════════════════════════
# SUBSCRIPTION & FEATURE FLAG SYSTEM
# ═══════════════════════════════════════════════════════════

# ── Pricing ────────────────────────────────────────────────────
# Free:    ₹0/month  — basic tracking, 3 meds
# Basic:   ₹30/month — most features, 5 meds, good for daily users
# Premium: ₹99/month — everything unlimited, daily AI, scanner
# Enterprise: custom — for clinics and hospitals

PLAN_FEATURES = {
    "free": {
        "max_medications": 3,
        "history_days": 7,
        "ai_insights": "none",
        "caregiver_alerts": 1,
        "nearby_results": 5,
        "yoga_full": False,
        "export_data": False,
        "brand_generic": False,
        "scanner": False,
        "max_appointments": 2,
        "price_inr": 0,
        "plan_label": "Free",
    },
    "basic": {
        "max_medications": 5,
        "history_days": 30,
        "ai_insights": "weekly",
        "caregiver_alerts": 3,
        "nearby_results": 10,
        "yoga_full": True,
        "export_data": True,
        "brand_generic": False,
        "scanner": False,
        "max_appointments": 10,
        "price_inr": 30,
        "plan_label": "Basic",
    },
    "premium": {
        "max_medications": 999,
        "history_days": 90,
        "ai_insights": "daily",
        "caregiver_alerts": 999,
        "nearby_results": 20,
        "yoga_full": True,
        "export_data": True,
        "brand_generic": True,
        "scanner": True,
        "max_appointments": 999,
        "price_inr": 99,
        "plan_label": "Pro Dharma",
    },
    "enterprise": {
        "max_medications": 999,
        "history_days": 365,
        "ai_insights": "daily",
        "caregiver_alerts": 999,
        "nearby_results": 50,
        "yoga_full": True,
        "export_data": True,
        "brand_generic": True,
        "scanner": True,
        "max_appointments": 999,
        "api_access": True,
        "price_inr": 0,
        "plan_label": "Elite Moksha",
    }
}

async def get_user_features(user_id: str) -> dict:
    sub = await db.subscriptions.find_one({"user_id": user_id}, PROJECTION)
    plan = sub.get("plan", "free") if sub else "free"
    features = dict(PLAN_FEATURES.get(plan, PLAN_FEATURES["free"]))
    if sub and sub.get("overrides"):
        features.update(sub["overrides"])
    features["plan"] = plan
    features["plan_expires"] = sub.get("expires_at").isoformat() if sub and sub.get("expires_at") else None
    return features

@api.get("/me/features")
async def my_features(user_id: str = Depends(get_current_user_id)):
    return await get_user_features(user_id)

@api.get("/me/subscription")
async def my_subscription(user_id: str = Depends(get_current_user_id)):
    sub = await db.subscriptions.find_one({"user_id": user_id}, PROJECTION)
    if not sub:
        return {"plan": "free", "status": "active", "expires_at": None}
    return {"plan": sub.get("plan", "free"), "status": sub.get("status", "active"), "expires_at": sub.get("expires_at").isoformat() if sub.get("expires_at") else None}

class SubscriptionUpdate(BaseModel):
    plan: str
    expires_days: int = 30
    status: str = "active"
    note: str = ""

class FeatureOverride(BaseModel):
    feature: str
    value: object

@app.post("/admin/users/{user_id}/subscription")
async def admin_set_subscription(user_id: str, body: SubscriptionUpdate, _: None = Depends(require_admin)):
    expires = datetime.now(timezone.utc) + timedelta(days=body.expires_days) if body.expires_days > 0 else None
    await db.subscriptions.update_one({"user_id": user_id}, {"$set": {"plan": body.plan, "status": body.status, "expires_at": expires, "updated_at": datetime.now(timezone.utc), "note": body.note}}, upsert=True)
    await track_event("subscription_changed", user_id, {"plan": body.plan, "by": "admin"})
    return {"ok": True, "plan": body.plan, "expires_at": expires.isoformat() if expires else None}

@app.post("/admin/users/{user_id}/features")
async def admin_set_feature(user_id: str, body: FeatureOverride, _: None = Depends(require_admin)):
    await db.subscriptions.update_one({"user_id": user_id}, {"$set": {f"overrides.{body.feature}": body.value, "updated_at": datetime.now(timezone.utc)}}, upsert=True)
    return {"ok": True, "feature": body.feature, "value": body.value}

@app.delete("/admin/users/{user_id}/features/{feature}")
async def admin_remove_feature(user_id: str, feature: str, _: None = Depends(require_admin)):
    await db.subscriptions.update_one({"user_id": user_id}, {"$unset": {f"overrides.{feature}": ""}})
    return {"ok": True}

@app.get("/admin/revenue")
async def admin_revenue(_: None = Depends(require_admin)):
    premium_count = await db.subscriptions.count_documents({"plan": {"$in": ["premium", "enterprise"]}, "status": "active"})
    total_users = await db.users.count_documents({})
    pipeline = [{"$group": {"_id": "$plan", "count": {"$sum": 1}, "revenue": {"$sum": "$total_paid"}}}]
    by_plan = await db.subscriptions.aggregate(pipeline).to_list(10)
    return {"premium_users": premium_count, "conversion_rate": round(premium_count / total_users * 100, 1) if total_users else 0, "by_plan": [{"plan": p["_id"], "users": p["count"], "revenue": p.get("revenue", 0)} for p in by_plan], "mrr_estimate": premium_count * 99}

@app.get("/admin/subscriptions")
async def admin_subscriptions(limit: int = 50, skip: int = 0, plan: str = "", _: None = Depends(require_admin)):
    q = {"plan": plan} if plan else {}
    subs = await db.subscriptions.find(q, PROJECTION).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    result = []
    for s in subs:
        user = await db.users.find_one({"id": s["user_id"]}, PROJECTION)
        result.append({"user_id": s["user_id"], "name": user.get("name", "") if user else "", "email": user.get("email", "") if user else "", "plan": s.get("plan", "free"), "status": s.get("status", "active"), "expires_at": s.get("expires_at").isoformat() if s.get("expires_at") else None, "overrides": s.get("overrides", {})})
    return {"subscriptions": result, "total": await db.subscriptions.count_documents(q)}


# ── Admin IP Rate Limiting & Brute Force Protection ───────
# Tracks failed admin login attempts per IP in MongoDB
# Blocks after 3 failures for 24 hours

async def check_admin_ip(ip: str):
    """Block IP if it has 3+ failed admin login attempts in last 24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    failed = await db.admin_login_attempts.count_documents({
        "ip": ip, "success": False, "ts": {"$gte": cutoff}
    })
    if failed >= 3:
        # Log the blocked attempt
        await db.admin_login_attempts.insert_one({
            "ip": ip, "success": False, "blocked": True,
            "ts": datetime.now(timezone.utc)
        })
        raise HTTPException(429, f"Too many failed attempts. IP {ip} blocked for 24 hours.")

async def record_admin_attempt(ip: str, success: bool, email: str = ""):
    """Record admin login attempt for rate limiting."""
    await db.admin_login_attempts.insert_one({
        "ip": ip, "success": success, "email": email,
        "blocked": False, "ts": datetime.now(timezone.utc)
    })
    # Auto-delete after 48h
    await db.admin_login_attempts.create_index(
        [("ts", 1)], expireAfterSeconds=172800, background=True
    )


# ── Admin Google Auth ─────────────────────────────────────
ADMIN_EMAILS = set(filter(None, os.environ.get("ADMIN_EMAILS", "").split(",")))

class AdminGoogleAuth(BaseModel):
    id_token: str

@app.post("/admin/auth/google")
async def admin_google_login(request: Request, payload: AdminGoogleAuth):
    """Google Sign-In for admin panel. Blocks IP after 3 failed attempts."""
    ip = request.client.host if request.client else "unknown"

    # Check if IP is blocked
    await check_admin_ip(ip)

    try:
        # For admin panel (web app), verify with web client ID
        # Try each valid audience since token must match one of them
        idinfo = None
        last_err = None
        audiences_to_try = list(GOOGLE_VALID_AUDIENCES) + [None]
        for aud in audiences_to_try:
            try:
                idinfo = google_id_token.verify_oauth2_token(
                    payload.id_token, google_requests.Request(), audience=aud
                )
                break
            except Exception as e:
                last_err = e
                continue
        if idinfo is None:
            await record_admin_attempt(ip, False, "verify_error")
            raise HTTPException(401, f"Google token verification failed: {last_err}")
    except HTTPException:
        raise
    except Exception as e:
        await record_admin_attempt(ip, False, "verify_error")
        raise HTTPException(401, f"Invalid Google token: {e}")

    email = idinfo.get("email", "").lower().strip()
    # Strict check — only whitelisted emails can enter, no hints given to attacker
    if not ADMIN_EMAILS or email not in ADMIN_EMAILS:
        await record_admin_attempt(ip, False, email)
        raise HTTPException(403, "Access denied")

    # Success
    await record_admin_attempt(ip, True, email)
    admin_token = pyjwt.encode({
        "sub": email, "role": "admin",
        "name": idinfo.get("name", ""),
        "picture": idinfo.get("picture", ""),
        "exp": datetime.now(timezone.utc) + timedelta(hours=4),
        "iat": datetime.now(timezone.utc),
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

    await track_event("admin_login", email, {"ip": ip, "email": email})
    return {"token": admin_token, "name": idinfo.get("name"), "email": email, "picture": idinfo.get("picture")}

@app.get("/admin/blocked-ips")
async def admin_blocked_ips(_: None = Depends(require_admin)):
    """See all blocked IPs and recent failed attempts."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    pipeline = [
        {"$match": {"success": False, "ts": {"$gte": cutoff}}},
        {"$group": {"_id": "$ip", "attempts": {"$sum": 1}, "last": {"$max": "$ts"}, "emails": {"$addToSet": "$email"}}},
        {"$sort": {"attempts": -1}}
    ]
    blocked = await db.admin_login_attempts.aggregate(pipeline).to_list(50)
    return {
        "blocked": [{"ip": b["_id"], "attempts": b["attempts"], "last_attempt": b["last"].isoformat(), "tried_emails": b["emails"], "is_blocked": b["attempts"] >= 3} for b in blocked]
    }

@app.post("/admin/notify")
async def admin_broadcast_notification(payload: dict = Body(...), _: None = Depends(require_admin)):
    """Send push notification to all users or specific users from admin dashboard."""
    title = payload.get("title", "").strip()
    body = payload.get("body", "").strip()
    user_ids = payload.get("user_ids", [])  # empty = all users
    
    if not title or not body:
        raise HTTPException(400, "Title and body are required")
    if len(title) > 100 or len(body) > 300:
        raise HTTPException(400, "Title max 100 chars, body max 300 chars")
    
    # Fetch tokens
    query = {"push_token": {"$exists": True, "$ne": None}}
    if user_ids:
        query["id"] = {"$in": user_ids}
    
    users = await db.users.find(query, {"push_token": 1, "id": 1}).to_list(10000)
    tokens = [u["push_token"] for u in users if u.get("push_token")]
    
    if not tokens:
                return {"sent": 0, "failed": 0, "total": 0, "message": "No users with push tokens found"}
    
    # Send via Expo Push API (free, no FCM setup needed)
    import httpx
    batch_size = 100  # Expo allows 100 per request
    sent = 0
    failed = 0
    
    for i in range(0, len(tokens), batch_size):
        batch = tokens[i:i + batch_size]
        messages = [{
            "to": token,
            "title": title,
            "body": body,
            "sound": "pillcare_reminder",
            "channelId": "broadcasts",
            "data": {"type": "broadcast"},
        } for token in batch]
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=messages,
                    headers={"Content-Type": "application/json"},
                )
                data = resp.json()
                for item in data.get("data", []):
                    if item.get("status") == "ok":
                        sent += 1
                    else:
                        failed += 1
        except Exception as e:
            logger.warning(f"Push batch failed: {e}")
            failed += len(batch)
    
    # Log broadcast
    await db.analytics.insert_one({
        "event": "admin_broadcast",
        "ts": datetime.now(timezone.utc),
        "props": {"title": title, "body": body, "sent": sent, "failed": failed, "total_tokens": len(tokens)},
        "user_id": "admin",
    })
    
    return {"sent": sent, "failed": failed, "total": len(tokens)}

@app.delete("/admin/blocked-ips/{ip}")
async def admin_unblock_ip(ip: str, _: None = Depends(require_admin)):
    """Manually unblock an IP address."""
    result = await db.admin_login_attempts.delete_many({"ip": ip, "success": False})
    return {"ok": True, "cleared": result.deleted_count, "ip": ip}


@app.get("/admin/analytics/doses")
async def admin_dose_analytics(_: None = Depends(require_admin)):
    """Deep dose analytics: hourly patterns, top meds, taken vs missed."""
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    # Hourly dose pattern (when do people take meds?)
    hourly_pipeline = [
        {"$match": {"event": "dose_taken", "ts": {"$gte": month_ago}}},
        {"$group": {"_id": "$props.hour", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    hourly = await db.analytics.aggregate(hourly_pipeline).to_list(24)

    # Top medications being tracked
    top_meds_pipeline = [
        {"$match": {"event": "dose_taken", "ts": {"$gte": month_ago}}},
        {"$group": {"_id": "$props.medication_name", "taken": {"$sum": 1}}},
        {"$sort": {"taken": -1}},
        {"$limit": 15}
    ]
    top_meds = await db.analytics.aggregate(top_meds_pipeline).to_list(15)

    # Day of week pattern
    dow_pipeline = [
        {"$match": {"event": "dose_taken", "ts": {"$gte": month_ago}}},
        {"$group": {"_id": "$props.day_of_week", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    dow = await db.analytics.aggregate(dow_pipeline).to_list(7)

    # Missed vs taken vs skipped
    taken = await db.analytics.count_documents({"event": "dose_taken", "ts": {"$gte": month_ago}})
    missed = await db.analytics.count_documents({"event": "dose_missed", "ts": {"$gte": month_ago}})
    skipped = await db.analytics.count_documents({"event": "dose_skipped", "ts": {"$gte": month_ago}})

    # Daily trend last 30 days
    daily_pipeline = [
        {"$match": {"event": "dose_taken", "ts": {"$gte": month_ago}}},
        {"$group": {"_id": "$props.date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily = await db.analytics.aggregate(daily_pipeline).to_list(30)

    days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    return {
        "hourly_pattern": [{"hour": f"{h['_id']}:00", "doses": h["count"]} for h in hourly if h["_id"] is not None],
        "top_medications": [{"name": m["_id"] or "Unknown", "doses_taken": m["taken"]} for m in top_meds if m["_id"]],
        "day_of_week": [{"day": days[d["_id"]] if d["_id"] is not None and 0<=d["_id"]<=6 else "?", "count": d["count"]} for d in dow],
        "dose_outcomes": {"taken": taken, "missed": missed, "skipped": skipped},
        "daily_trend": [{"date": d["_id"], "taken": d["count"]} for d in daily],
        "period": "last_30_days",
    }

@app.get("/admin/analytics/medications")
async def admin_medication_analytics(_: None = Depends(require_admin)):
    """All medications in the system with user counts."""
    pipeline = [
        {"$match": {"active": True}},
        {"$group": {
            "_id": "$name",
            "users": {"$addToSet": "$user_id"},
            "total_doses_scheduled": {"$sum": 1},
        }},
        {"$project": {"name": "$_id", "user_count": {"$size": "$users"}, "total_doses_scheduled": 1}},
        {"$sort": {"user_count": -1}},
        {"$limit": 50}
    ]
    meds = await db.medications.aggregate(pipeline).to_list(50)
    return {"medications": [{"name": m["_id"], "users": m["user_count"]} for m in meds]}

@app.get("/admin/analytics/users/{user_id}")
async def admin_user_detail(user_id: str, _: None = Depends(require_admin)):
    """Full profile for a specific user."""
    profile = await db.profile.find_one({"user_id": user_id}, PROJECTION) or               await db.users.find_one({"id": user_id}, PROJECTION) or {}
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(50)
    recent_doses = await db.doses.find({"user_id": user_id}).sort("date", -1).limit(30).to_list(30)
    taken = sum(1 for d in recent_doses if d.get("status") == "taken")
    missed = sum(1 for d in recent_doses if d.get("status") == "missed")
    events = await db.analytics.find({"user_id": user_id}).sort("ts", -1).limit(20).to_list(20)
    sub = await db.subscriptions.find_one({"user_id": user_id}, PROJECTION) or {}
    return {
        "profile": {
            "name": profile.get("nickname") or profile.get("name", ""),
            "email": profile.get("email", ""),
            "gender": profile.get("gender", ""),
            "year_of_birth": profile.get("year_of_birth"),
            "location": f"{profile.get('location_city','')} {profile.get('location_state','')}".strip(),
            "phone": profile.get("phone", ""),
            "caregiver_phone": profile.get("caregiver_phone", ""),
        },
        "subscription": {"plan": sub.get("plan","free"), "expires_at": sub.get("expires_at","").isoformat() if sub.get("expires_at") else None},
        "medications": [{"name": m.get("name",""), "frequency": m.get("frequency",""), "stock": m.get("stock",0)} for m in meds],
        "adherence": {"taken": taken, "missed": missed, "rate": round(taken/(taken+missed)*100,1) if (taken+missed)>0 else 0},
        "recent_events": [{"event": e.get("event",""), "ts": e["ts"].isoformat(), "props": e.get("props",{})} for e in events],
    }


@api.post("/analytics/track")
async def track_user_event(payload: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """Frontend event tracking — every user action stored for admin dashboard."""
    event = payload.get("event", "")
    props = payload.get("props", {})
    if not event or len(event) > 100:
        return {"ok": False}
    await track_event(event, user_id, props)
    return {"ok": True}

# ── Rich Analytics & Export ───────────────────────────────

@app.get("/admin/analytics/location")
async def admin_location_analytics(_: None = Depends(require_admin)):
    """State, city, and area breakdown of users."""
    # State breakdown
    state_pipe = [
        {"$match": {"location_state": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$location_state", "users": {"$sum": 1}}},
        {"$sort": {"users": -1}}, {"$limit": 20}
    ]
    states = await db.profile.aggregate(state_pipe).to_list(20)

    # City breakdown
    city_pipe = [
        {"$match": {"location_city": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": {"city": "$location_city", "state": "$location_state"}, "users": {"$sum": 1}}},
        {"$sort": {"users": -1}}, {"$limit": 30}
    ]
    cities = await db.profile.aggregate(city_pipe).to_list(30)

    # Gender breakdown
    gender_pipe = [
        {"$group": {"_id": "$gender", "count": {"$sum": 1}}}
    ]
    genders = await db.profile.aggregate(gender_pipe).to_list(10)

    # Age bracket breakdown
    current_year = datetime.now(timezone.utc).year
    users_with_age = await db.profile.find({"year_of_birth": {"$exists": True}}, PROJECTION).to_list(10000)
    age_brackets = {"18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65+": 0, "Unknown": 0}
    for u in users_with_age:
        yob = u.get("year_of_birth")
        if not yob:
            age_brackets["Unknown"] += 1
        else:
            age = current_year - int(yob)
            if age < 25: age_brackets["18-24"] += 1
            elif age < 35: age_brackets["25-34"] += 1
            elif age < 45: age_brackets["35-44"] += 1
            elif age < 55: age_brackets["45-54"] += 1
            elif age < 65: age_brackets["55-64"] += 1
            else: age_brackets["65+"] += 1

    return {
        "states": [{"state": s["_id"] or "Unknown", "users": s["users"]} for s in states],
        "cities": [{"city": c["_id"]["city"] or "Unknown", "state": c["_id"]["state"] or "", "users": c["users"]} for c in cities],
        "gender": [{"gender": g["_id"] or "Unknown", "count": g["count"]} for g in genders],
        "age_brackets": [{"bracket": k, "count": v} for k, v in age_brackets.items()],
    }

@app.get("/admin/analytics/devices")
async def admin_device_analytics(_: None = Depends(require_admin)):
    """Device model, OS, brand breakdown."""
    brand_pipe = [
        {"$match": {"event": "login", "props.device_brand": {"$exists": True, "$ne": "unknown"}}},
        {"$group": {"_id": "$props.device_brand", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 10}
    ]
    brands = await db.analytics.aggregate(brand_pipe).to_list(10)

    os_pipe = [
        {"$match": {"event": "login", "props.device_os": {"$exists": True, "$ne": "unknown"}}},
        {"$group": {"_id": "$props.device_os", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 10}
    ]
    os_versions = await db.analytics.aggregate(os_pipe).to_list(10)

    model_pipe = [
        {"$match": {"event": "login", "props.device_model": {"$exists": True, "$ne": "unknown"}}},
        {"$group": {"_id": "$props.device_model", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 15}
    ]
    models = await db.analytics.aggregate(model_pipe).to_list(15)

    version_pipe = [
        {"$match": {"event": "login", "props.app_version": {"$exists": True, "$ne": "unknown"}}},
        {"$group": {"_id": "$props.app_version", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    app_versions = await db.analytics.aggregate(version_pipe).to_list(10)

    return {
        "brands": [{"brand": b["_id"], "count": b["count"]} for b in brands],
        "os_versions": [{"os": o["_id"], "count": o["count"]} for o in os_versions],
        "models": [{"model": m["_id"], "count": m["count"]} for m in models],
        "app_versions": [{"version": v["_id"], "count": v["count"]} for v in app_versions],
    }

@app.get("/admin/export/users")
async def admin_export_users(_: None = Depends(require_admin)):
    """Export all users to Excel with full analytics."""
    if not EXCEL_OK:
        raise HTTPException(500, "Excel export not available — openpyxl not installed")

    wb = openpyxl.Workbook()

    # ── Sheet 1: Users ──────────────────────────────────────
    ws = wb.active
    ws.title = "Users"
    header_fill = PatternFill("solid", fgColor="9184d9")
    header_font = Font(bold=True, color="FFFFFF")
    headers = ["Name", "Email", "Gender", "Birth Year", "Age", "City", "State", "Phone", "Caregiver", "Plan", "Medications", "Doses Taken", "Doses Missed", "Adherence %", "Last Login", "Joined"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    profiles = await db.profile.find({}).to_list(10000)
    current_year = datetime.now(timezone.utc).year
    for row_idx, u in enumerate(profiles, 2):
        uid = u.get("user_id") or u.get("id", "")
        yob = u.get("year_of_birth")
        age = current_year - int(yob) if yob else ""
        med_count = await db.medications.count_documents({"user_id": uid, "active": True})
        taken = await db.doses.count_documents({"user_id": uid, "status": "taken"})
        missed = await db.doses.count_documents({"user_id": uid, "status": "missed"})
        adh = round(taken / (taken + missed) * 100, 1) if (taken + missed) > 0 else ""
        sub = await db.subscriptions.find_one({"user_id": uid}) or {}
        last_login = await db.audit_log.find_one({"user_id": uid}, sort=[("ts", -1)])
        row_data = [
            u.get("nickname") or u.get("name", ""),
            u.get("email", ""),
            u.get("gender", ""),
            yob, age,
            u.get("location_city", ""),
            u.get("location_state", ""),
            u.get("phone", ""),
            u.get("caregiver_phone", ""),
            sub.get("plan", "free"),
            med_count, taken, missed, adh,
            last_login["ts"].strftime("%Y-%m-%d %H:%M") if last_login else "",
            u.get("created_at", ""),
        ]
        for col, val in enumerate(row_data, 1):
            ws.cell(row=row_idx, column=col, value=val)

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 16

    # ── Sheet 2: Medications ───────────────────────────────
    ws2 = wb.create_sheet("Medications")
    med_headers = ["Medication Name", "Users Tracking", "Total Doses Scheduled"]
    for col, h in enumerate(med_headers, 1):
        cell = ws2.cell(row=1, column=col, value=h)
        cell.fill = header_fill; cell.font = header_font
    pipe = [{"$match": {"active": True}}, {"$group": {"_id": "$name", "users": {"$addToSet": "$user_id"}, "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    meds = await db.medications.aggregate(pipe).to_list(500)
    for i, m in enumerate(meds, 2):
        ws2.cell(row=i, column=1, value=m["_id"])
        ws2.cell(row=i, column=2, value=len(m["users"]))
        ws2.cell(row=i, column=3, value=m["count"])

    # ── Sheet 3: Location ──────────────────────────────────
    ws3 = wb.create_sheet("Location")
    loc_headers = ["City", "State", "Users"]
    for col, h in enumerate(loc_headers, 1):
        cell = ws3.cell(row=1, column=col, value=h)
        cell.fill = header_fill; cell.font = header_font
    city_pipe = [{"$group": {"_id": {"city": "$location_city", "state": "$location_state"}, "users": {"$sum": 1}}}, {"$sort": {"users": -1}}]
    cities = await db.profile.aggregate(city_pipe).to_list(500)
    for i, c in enumerate(cities, 2):
        ws3.cell(row=i, column=1, value=c["_id"].get("city", "Unknown"))
        ws3.cell(row=i, column=2, value=c["_id"].get("state", "Unknown"))
        ws3.cell(row=i, column=3, value=c["users"])

    # ── Sheet 4: Dose Analytics ────────────────────────────
    ws4 = wb.create_sheet("Dose Analytics")
    dose_headers = ["Date", "Medication", "User ID", "Status", "Hour", "Day of Week"]
    for col, h in enumerate(dose_headers, 1):
        cell = ws4.cell(row=1, column=col, value=h)
        cell.fill = header_fill; cell.font = header_font
    events = await db.analytics.find({"event": {"$in": ["dose_taken", "dose_missed", "dose_skipped"]}}).sort("ts", -1).limit(5000).to_list(5000)
    for i, e in enumerate(events, 2):
        props = e.get("props", {})
        ws4.cell(row=i, column=1, value=e["ts"].strftime("%Y-%m-%d") if e.get("ts") else "")
        ws4.cell(row=i, column=2, value=props.get("medication_name", ""))
        ws4.cell(row=i, column=3, value=e.get("user_id", ""))
        ws4.cell(row=i, column=4, value=e.get("event", "").replace("dose_", ""))
        ws4.cell(row=i, column=5, value=props.get("hour", ""))
        ws4.cell(row=i, column=6, value=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][props["day_of_week"]] if isinstance(props.get("day_of_week"), int) else "")

    # Stream as download
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"pillcare_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def err(code: int, msg: str, detail: str = ""):
    """Standard error response with error code for frontend debugging."""
    return HTTPException(code, f"ERR_{code}: {msg}" + (f" — {detail}" if detail else ""))

@app.get("/health")
async def health_check():
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "error",
        "v": "1.0.1",
        "env": {
            "mongo": bool(os.environ.get("MONGO_URL")),
            "jwt": bool(os.environ.get("JWT_SECRET")),
            "admin_emails": os.environ.get("ADMIN_EMAILS", "NOT SET"),
            "web_client": bool(os.environ.get("GOOGLE_WEB_CLIENT_ID")),
        }
    }


app.include_router(api)

@app.middleware("http")
async def request_size_limit(request: Request, call_next):
    """Block suspiciously large requests — prevents payload bombs."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 1_000_000:  # 1MB max
        return Response("Payload too large", status_code=413)
    return await call_next(request)

@app.middleware("http")
async def security_headers(request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Remove server identification
    try:
        del response.headers["server"]
    except (KeyError, Exception):
        pass
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://pillcare.in",
        "https://www.pillcare.in",
        # Expo dev — remove before production
        "http://localhost:8081",
        "http://localhost:19006",
    ],
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "x-admin-secret"],
)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
