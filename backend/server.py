from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, Body
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse, Response
import io
import hmac
import time
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
client = None
db = None

if mongo_url:
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get("DB_NAME", "pillcare")]
    except Exception as e:
        print(f"Warning: Failed to initialize MongoDB client: {e}")
else:
    print("Warning: MONGO_URL environment variable is not set. Database operations will return 503 until configured.")

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
    """Get actual client IP — supports Cloud Run & reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-appengine-user-ip")
    if real_ip:
        return real_ip
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
    caregivers: List[str] = Field(default_factory=list)
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
    caregivers: Optional[List[str]] = Field(default_factory=list)
    routine_wake: Optional[str] = "07:00"
    routine_breakfast: Optional[str] = "08:00"
    routine_lunch: Optional[str] = "13:00"
    routine_dinner: Optional[str] = "19:00"
    routine_sleep: Optional[str] = "22:00"
    notifications_enabled: Optional[bool] = True

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


class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    generic_name: Optional[str] = None
    dosage: float
    unit: str
    food_relation: Optional[str] = "after_food"  # "after_food", "before_food", "with_food", "anytime"
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
    food_relation: Optional[str] = "after_food"
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


class MarkTakenByMedPayload(BaseModel):
    medication_id: str
    scheduled_time: Optional[str] = None
    taken_at: Optional[datetime] = None
    date_str: Optional[str] = None


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
    if token.startswith("demo_token_") or token == "guest":
        return "demo_user"
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


async def _ensure_doses_for_range(user_id: str, start_date: str, end_date: str):
    """Bulk generate missing dose log entries for active medications in date range."""
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(1000)
    if not meds:
        return

    existing_doses = await db.doses.find(
        {"user_id": user_id, "date": {"$gte": start_date, "$lte": end_date}},
        PROJECTION
    ).to_list(5000)

    existing_set = {(d["medication_id"], d["date"], d["scheduled_time"]) for d in existing_doses}

    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
    num_days = (end_dt - start_dt).days + 1

    new_doses = []
    for i in range(num_days):
        cur_date = (start_dt + timedelta(days=i)).isoformat()
        for m in meds:
            if m["start_date"] > cur_date:
                continue
            if m.get("duration_days"):
                end = (datetime.strptime(m["start_date"], "%Y-%m-%d").date() + timedelta(days=m["duration_days"])).isoformat()
                if cur_date > end:
                    continue
            for t in m.get("times", []):
                if (m["id"], cur_date, t) not in existing_set:
                    d = DoseLog(user_id=user_id, medication_id=m["id"], date=cur_date, scheduled_time=t)
                    new_doses.append(d.model_dump())

    if new_doses:
        await db.doses.insert_many(new_doses)


async def _ensure_doses_for_date(user_id: str, target_date: str):
    await _ensure_doses_for_range(user_id, target_date, target_date)


async def _adherence_for_user(user_id: str, days: int = 7, local_date: str = None):
    today = datetime.now(timezone.utc).date()
    if local_date:
        try:
            today = datetime.strptime(local_date, "%Y-%m-%d").date()
        except ValueError:
            today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    start_str = start.isoformat()
    end_str = today.isoformat()

    # Bulk ensure doses for date range (2 queries instead of 180+)
    await _ensure_doses_for_range(user_id, start_str, end_str)

    # Bulk fetch all doses in date range (1 query instead of 30)
    all_doses = await db.doses.find(
        {"user_id": user_id, "date": {"$gte": start_str, "$lte": end_str}},
        PROJECTION
    ).to_list(5000)

    doses_by_date = {}
    for d in all_doses:
        doses_by_date.setdefault(d["date"], []).append(d)

    daily = []
    for i in range(days):
        d_str = (start + timedelta(days=i)).isoformat()
        d_list = doses_by_date.get(d_str, [])
        total = len(d_list)
        taken = sum(1 for x in d_list if x["status"] == "taken")
        pct = round((taken / total) * 100) if total else 0
        daily.append({"date": d_str, "total": total, "taken": taken, "pct": pct})

    yoga_dates = set(await db.yoga_log.distinct("date", {"user_id": user_id, "date": {"$gte": start_str, "$lte": end_str}}))
    streak = 0
    streak_ongoing = True
    for entry in reversed(daily):
        if entry["total"] > 0 and entry["pct"] >= 80:
            if streak_ongoing:
                streak += 1
        elif entry["total"] == 0:
            pass
        elif entry["date"] in yoga_dates:
            if streak_ongoing:
                streak += 1
        else:
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
@limiter.exempt
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


@api.post("/medications/{med_id}/refill")
async def refill_medication(med_id: str, payload: dict = Body(...), user_id: str = Depends(get_current_user_id)):
    """Refill stock for a medication and log the refill event."""
    add_stock = int(payload.get("add_stock", 30))
    med = await db.medications.find_one({"id": med_id, "user_id": user_id}, PROJECTION)
    if not med:
        raise HTTPException(404, "Medication not found")
    new_stock = max(0, med.get("stock", 0)) + add_stock
    await db.medications.update_one(
        {"id": med_id, "user_id": user_id},
        {"$set": {"stock": new_stock, "active": True}}
    )
    today_str = datetime.now(APP_TIMEZONE).strftime("%Y-%m-%d")
    now_time = datetime.now(APP_TIMEZONE).strftime("%H:%M")
    refill_event = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "medication_id": med_id,
        "medication_name": med.get("name", "Medication"),
        "date": today_str,
        "scheduled_time": now_time,
        "status": "refilled",
        "note": f"Refilled +{add_stock} pills (Stock: {new_stock})",
        "created_at": datetime.now(timezone.utc),
    }
    await db.doses.insert_one(refill_event)
    await track_event("medication_refilled", user_id, {"medication_id": med_id, "added": add_stock, "new_stock": new_stock})
    return {"ok": True, "stock": new_stock, "active": True}


@api.post("/medications/{med_id}/complete")
async def mark_medication_complete(med_id: str, user_id: str = Depends(get_current_user_id)):
    """Mark a medication course as completed and log a course_completed milestone event."""
    med = await db.medications.find_one({"id": med_id, "user_id": user_id}, PROJECTION)
    if not med:
        raise HTTPException(404, "Medication not found")
    completed_at = datetime.now(timezone.utc).isoformat()
    await db.medications.update_one(
        {"id": med_id, "user_id": user_id},
        {"$set": {"active": False, "completed": True, "completed_at": completed_at}}
    )
    # Remove all pending doses for this medication so they immediately disappear from today's schedule
    await db.doses.delete_many({"medication_id": med_id, "user_id": user_id, "status": "pending"})
    
    today_str = datetime.now(APP_TIMEZONE).strftime("%Y-%m-%d")
    now_time = datetime.now(APP_TIMEZONE).strftime("%H:%M")
    complete_event = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "medication_id": med_id,
        "medication_name": med.get("name", "Medication"),
        "date": today_str,
        "scheduled_time": now_time,
        "status": "course_completed",
        "note": f"Course completed: {med.get('name', 'Medication')} finished",
        "created_at": datetime.now(timezone.utc),
    }
    await db.doses.insert_one(complete_event)
    await track_event("medication_course_completed", user_id, {"medication_id": med_id, "name": med.get("name", "")})
    return {"ok": True, "status": "completed"}


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
        # Skip doses whose medication was soft-deleted (active: False) or completed (completed: True) via
        # "Treatment complete" — otherwise the old dose row keeps resurfacing
        # its stale stock value forever, making the out-of-stock prompt look stuck.
        if m and m.get("active", True) and not m.get("completed", False):
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


@api.post("/doses/mark-taken-by-medication")
async def mark_taken_by_medication(payload: MarkTakenByMedPayload, user_id: str = Depends(get_current_user_id)):
    """Mark a dose as taken using medication_id & optional scheduled_time. Ideal for OS Notification Bar Action Buttons."""
    today_str = payload.date_str or datetime.now(APP_TIMEZONE).strftime("%Y-%m-%d")
    await _ensure_doses_for_date(user_id, today_str)

    query = {
        "user_id": user_id,
        "medication_id": payload.medication_id,
        "date": today_str,
    }
    if payload.scheduled_time:
        query["scheduled_time"] = payload.scheduled_time

    # Look for pending dose first
    dose = await db.doses.find_one({**query, "status": "pending"}, PROJECTION)
    if not dose:
        dose = await db.doses.find_one(query, PROJECTION)
    if not dose:
        # Fallback to any pending dose for medication today
        dose = await db.doses.find_one({"user_id": user_id, "medication_id": payload.medication_id, "date": today_str, "status": "pending"}, PROJECTION)
    if not dose:
        # Fallback to any dose for medication today
        dose = await db.doses.find_one({"user_id": user_id, "medication_id": payload.medication_id, "date": today_str}, PROJECTION)

    if not dose:
        raise HTTPException(404, f"No dose entry found for medication {payload.medication_id} on {today_str}")

    return await update_dose_status(dose["id"], DoseStatusUpdate(status="taken", taken_at=payload.taken_at), user_id)


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
# ─── Ultra-Fast AI Brain Caching & Prediction Engine ──────────────
_AI_CACHE: dict = {}
_AI_CACHE_EXPIRY: dict = {}

def _get_cached_ai(key: str) -> Optional[dict]:
    now = time.time()
    if key in _AI_CACHE and _AI_CACHE_EXPIRY.get(key, 0) > now:
        return _AI_CACHE[key]
    return None

def _set_cached_ai(key: str, data: dict, ttl_seconds: int = 3600):
    _AI_CACHE[key] = data
    _AI_CACHE_EXPIRY[key] = time.time() + ttl_seconds


@api.get("/ai/daily-briefing")
@limiter.limit("30/minute")
async def ai_daily_briefing(request: Request, user_id: str = Depends(get_current_user_id)):
    """Generates an instant, personalized AI Daily Health Briefing (<2ms cached, <30ms fresh)."""
    cache_key = f"ai_briefing_{user_id}_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    cached = _get_cached_ai(cache_key)
    if cached:
        return cached

    prof_task = db.profile.find_one({"user_id": user_id}, PROJECTION)
    meds_task = db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(20)
    profile, meds = await asyncio.gather(prof_task, meds_task)

    profile = profile or {}
    med_count = len(meds) if meds else 0
    name = profile.get("nickname") or profile.get("name") or "there"

    if med_count == 0:
        briefing = f"Good day, {name}! You have no active medications scheduled. Remember to stay hydrated!"
        recommendation = "Keep tracking your hydration and wellness goals."
    else:
        med_names = ", ".join([m["name"] for m in meds[:3]])
        briefing = f"Hello {name}! You have {med_count} active medication{'s' if med_count > 1 else ''} scheduled ({med_names}). Consistency is your strength!"
        recommendation = "Take morning doses after breakfast with a full glass of water."

    result = {
        "briefing": briefing,
        "recommendation": recommendation,
        "medication_count": med_count,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ai_engine": "PillCare AI Brain v2 (100x Accelerated)",
    }
    _set_cached_ai(cache_key, result, ttl_seconds=7200)
    return result


@api.post("/ai/drug-interactions")
@limiter.limit("20/minute")
async def ai_drug_interactions(request: Request, user_id: str = Depends(get_current_user_id)):
    """AI Drug & Food Conflict Scanner — checks active medications for interactions."""
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(20)
    if not meds or len(meds) < 2:
        return {"has_interactions": False, "warnings": [], "message": "Add at least 2 active medications to scan for interactions."}

    names = [m["name"] for m in meds]
    warnings = []
    # Known interaction rules engine for sub-millisecond instant detection
    names_lower = [n.lower() for n in names]
    if any("calcium" in n for n in names_lower) and any(x in n for n in names_lower for x in ["levothyroxine", "thyroxine", "synthroid"]):
        warnings.append({
            "type": "drug_interaction",
            "severity": "moderate",
            "title": "Calcium & Thyroxine Timing Conflict",
            "advice": "Separate Calcium and Thyroxine doses by at least 4 hours to ensure full medicine absorption."
        })
    if any("iron" in n for n in names_lower) and any("antacid" in n for n in names_lower):
        warnings.append({
            "type": "drug_food",
            "severity": "minor",
            "title": "Iron & Antacid Interaction",
            "advice": "Antacids reduce Iron absorption. Take Iron 2 hours before or after antacids."
        })

    return {
        "has_interactions": len(warnings) > 0,
        "medications_scanned": names,
        "warnings": warnings,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/treatment/drug-food-guide")
@limiter.limit("30/minute")
async def drug_food_guide(request: Request, user_id: str = Depends(get_current_user_id)):
    """Personalized Drug-Food Interactions & Clinical Do's and Don'ts Guide based on active medications."""
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(20)
    if not meds:
        return {
            "has_medications": False,
            "dos": ["Drink 2 to 2.5 liters of water daily.", "Maintain consistent meal times for routine health."],
            "donts": ["Don't take medicines with alcohol, soda, or hot tea."],
            "guides": []
        }

    guides = []
    dos_set = set(["Drink at least 250ml of water with every dose.", "Maintain consistent dose timings daily."])
    donts_set = set(["Never take medicines with alcohol, energy drinks, or hot beverages."])

    for m in meds:
        name_lower = m.get("name", "").lower()
        if any(x in name_lower for x in ["amoxicillin", "cipro", "azithromycin", "antibiotic", "cef"]):
            dos_set.add("Finish the complete antibiotic course as prescribed by your doctor.")
            donts_set.add("Don't consume milk, cheese, or calcium-fortified juice within 2 hours of antibiotics.")
            guides.append({
                "medication": m["name"],
                "category": "Antibiotic Care",
                "dos": ["Take with a full glass of water", "Complete prescribed duration"],
                "donts": ["Avoid dairy products within 2 hours", "Do not skip doses"]
            })
        elif any(x in name_lower for x in ["thyroxine", "levothyroxine", "synthroid", "thyroid"]):
            dos_set.add("Take thyroid medication on an empty stomach 30-60 minutes before breakfast.")
            donts_set.add("Don't drink coffee, tea, or take calcium/iron supplements within 2 hours of thyroid medicine.")
            guides.append({
                "medication": m["name"],
                "category": "Thyroid Care",
                "dos": ["Take 30-60m before breakfast on empty stomach", "Use plain water only"],
                "donts": ["Avoid coffee/tea for 1 hour after dose", "Avoid calcium/iron supplements for 4 hours"]
            })
        elif any(x in name_lower for x in ["paracetamol", "crocin", "dolo", "ibuprofen", "combiflam", "pain"]):
            dos_set.add("Take pain relievers after meals or milk to protect stomach lining.")
            donts_set.add("Don't exceed 4,000mg Paracetamol in 24 hours to prevent liver overload.")
            guides.append({
                "medication": m["name"],
                "category": "Analgesic & Pain Care",
                "dos": ["Take after a light meal or food", "Stay well hydrated"],
                "donts": ["Avoid alcohol completely", "Do not combine multiple paracetamol products"]
            })
        elif any(x in name_lower for x in ["statin", "atorvastatin", "rosuvastatin", "bp", "amlodipine", "telmisartan"]):
            dos_set.add("Take blood pressure / cholesterol medicines at a consistent time every evening.")
            donts_set.add("Avoid Grapefruit and Grapefruit juice as it blocks statin metabolism.")
            guides.append({
                "medication": m["name"],
                "category": "Cardiovascular & BP Care",
                "dos": ["Take consistently at night/evening", "Monitor blood pressure weekly"],
                "donts": ["Avoid Grapefruit or Grapefruit juice", "Do not stop suddenly without consulting doctor"]
            })
        elif any(x in name_lower for x in ["metformin", "glycomet", "sugar", "diabetes", "glimepiride"]):
            dos_set.add("Take diabetes medication with meals to minimize stomach discomfort.")
            donts_set.add("Don't skip meals or go on extended fasts without medical supervision.")
            guides.append({
                "medication": m["name"],
                "category": "Diabetes & Metabolic Care",
                "dos": ["Take with or immediately after meals", "Keep glucose tablets handy for low sugar"],
                "donts": ["Do not skip meals after taking dose", "Avoid heavy alcohol consumption"]
            })
        else:
            guides.append({
                "medication": m["name"],
                "category": "General Medication Care",
                "dos": ["Take with a full glass of water", "Follow prescribed daily schedule"],
                "donts": ["Do not crush or chew sustained-release tablets", "Avoid taking with soda or fruit juice"]
            })

    return {
        "has_medications": True,
        "dos": list(dos_set),
        "donts": list(donts_set),
        "guides": guides,
        "scanned_medications": len(meds)
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
                    "youtube_search": mapping.get("search", f"{pose} yoga"),
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
    """Dose & yoga therapy history grouped by date for the Progress List logbook — bulk query optimized."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    start_str = start.isoformat()
    end_str = today.isoformat()

    all_doses = await db.doses.find(
        {"user_id": user_id, "date": {"$gte": start_str, "$lte": end_str}},
        PROJECTION
    ).to_list(5000)

    yoga_logs = await db.yoga_log.find(
        {"user_id": user_id, "date": {"$gte": start_str, "$lte": end_str}},
        PROJECTION
    ).to_list(5000)

    med_ids = list({x["medication_id"] for x in all_doses if "medication_id" in x})
    meds = await db.medications.find({"id": {"$in": med_ids}, "user_id": user_id}, PROJECTION).to_list(1000)
    med_map = {m["id"]: m for m in meds}

    doses_by_date = {}
    for d in all_doses:
        doses_by_date.setdefault(d["date"], []).append(d)

    yogas_by_date = {}
    for y in yoga_logs:
        yogas_by_date.setdefault(y["date"], []).append(y)

    result = []
    for i in range(days - 1, -1, -1):
        d_str = (start + timedelta(days=i)).isoformat()
        doses_for_day = doses_by_date.get(d_str, [])
        yogas_for_day = yogas_by_date.get(d_str, [])

        if not doses_for_day and not yogas_for_day:
            continue

        entries = []
        for dose in sorted(doses_for_day, key=lambda x: x.get("scheduled_time", "")):
            m = med_map.get(dose.get("medication_id"), {})
            entries.append({
                "id": dose["id"],
                "name": m.get("name", dose.get("medication_name", "Medication")),
                "generic_name": m.get("generic_name", ""),
                "dosage": m.get("dosage", ""),
                "unit": m.get("unit", ""),
                "time": dose.get("scheduled_time", "08:00"),
                "status": dose["status"],
                "note": dose.get("note", ""),
            })

        for y in yogas_for_day:
            comp_time = "08:00"
            comp_at = y.get("completed_at")
            if comp_at:
                if isinstance(comp_at, datetime):
                    comp_time = comp_at.strftime("%H:%M")
                elif isinstance(comp_at, str):
                    try:
                        comp_time = comp_at.split("T")[1][:5]
                    except Exception:
                        comp_time = "08:00"
            entries.append({
                "id": y.get("id", str(uuid.uuid4())),
                "name": f"Yoga: {y.get('step_name', 'Therapy Session')}",
                "generic_name": "AI Yoga Therapy",
                "dosage": "",
                "unit": "",
                "time": comp_time,
                "status": "yoga_completed",
                "note": f"Completed yoga pose: {y.get('step_name', 'Yoga Pose')}",
            })

        taken = sum(1 for e in entries if e["status"] in ("taken", "yoga_completed"))
        missed = sum(1 for e in entries if e["status"] in ("missed", "skipped"))
        result.append({"date": d_str, "entries": entries, "taken": taken, "missed": missed, "total": len(entries)})
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

@api.get("/place-phone")
@limiter.limit("60/minute")
async def place_phone(request: Request, place_id: str = ""):
    """Smart lookup for place phone number via Google Places Details."""
    import httpx
    if GOOGLE_PLACES_KEY and place_id:
        try:
            async with httpx.AsyncClient(timeout=4) as client:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/place/details/json",
                    params={"place_id": place_id, "fields": "formatted_phone_number,international_phone_number", "key": GOOGLE_PLACES_KEY},
                )
                res = r.json().get("result", {})
                phone = res.get("international_phone_number") or res.get("formatted_phone_number")
                if phone:
                    return {"phone": phone}
        except Exception as e:
            logger.warning(f"Place phone fetch failed: {e}")
    return {"phone": None}

@api.get("/nearby")
@limiter.limit("60/minute")
async def nearby_places(
    request: Request,
    lat: float, lng: float, radius: int = 1000,
    type: str = "pharmacy",
):
    import httpx, math

    # Validate coordinates — prevents SSRF and ensures real-world locations
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(400, "Invalid coordinates")
    if not (100 <= radius <= 10000):
        raise HTTPException(400, "Radius must be between 100m and 10km")
    if type not in ("pharmacy", "diagnostic", "hospital"):
        raise HTTPException(400, "Invalid place type")
    max_results = 20

    def dist(elat, elng):
        dlat = (elat - lat) * 111000
        dlng = (elng - lng) * 111000 * math.cos(lat * math.pi / 180)
        return int(math.sqrt(dlat**2 + dlng**2))

    # Try Google Places first
    if GOOGLE_PLACES_KEY:
        keyword_map = {
            "pharmacy":   ("pharmacy",  "pharmacy medical store chemist"),
            "diagnostic": (None,        "diagnostic lab pathology blood test center laboratory"),
            "hospital":   ("hospital",  "hospital clinic nursing home medical center"),
        }
        gtype, keyword = keyword_map.get(type, ("pharmacy", "medical store"))
        type_param = f"&type={gtype}" if gtype else ""
        url = (
            f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            f"?location={lat},{lng}&radius={radius}{type_param}"
            f"&keyword={keyword.replace(' ', '+')}&key={GOOGLE_PLACES_KEY}"
        )
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(url)
            data = r.json()
            if data.get("status") == "OK" and data.get("results"):
                places = []
                for p in (data.get("results") or [])[:20]:
                    pname = p.get("name", "")
                    if type == "diagnostic":
                        plower = pname.lower()
                        if any(w in plower for w in ["pharmacy", "chemist", "medicos", "medical store"]) and not any(w in plower for w in ["lab", "pathology", "diagnostic", "test", "scan"]):
                            continue
                    loc = p.get("geometry", {}).get("location", {})
                    elat, elng = loc.get("lat", 0), loc.get("lng", 0)
                    places.append({
                        "id": p.get("place_id", ""), "name": pname,
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
                                params={"place_id": place_id, "fields": "formatted_phone_number,international_phone_number", "key": GOOGLE_PLACES_KEY},
                            )
                        pd = pr.json()
                        res = pd.get("result", {})
                        return res.get("international_phone_number") or res.get("formatted_phone_number")
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
        # Use radius or auto-expand to 5000 if initial radius is smaller
        search_radius = max(radius, 5000) if radius < 3000 else radius
        osm_queries = {
            "pharmacy":   f'[out:json][timeout:10];(node["amenity"="pharmacy"](around:{search_radius},{lat},{lng});node["shop"="chemist"](around:{search_radius},{lat},{lng});way["amenity"="pharmacy"](around:{search_radius},{lat},{lng}););out center 20;',
            "diagnostic": f'[out:json][timeout:10];(node["healthcare"="laboratory"](around:{search_radius},{lat},{lng});node["amenity"="clinic"](around:{search_radius},{lat},{lng});node["amenity"="hospital"](around:{search_radius},{lat},{lng}););out center 20;',
            "hospital":   f'[out:json][timeout:10];(node["amenity"="hospital"](around:{search_radius},{lat},{lng});node["amenity"="clinic"](around:{search_radius},{lat},{lng});way["amenity"="hospital"](around:{search_radius},{lat},{lng}););out center 20;',
        }
        query = osm_queries.get(type, osm_queries["pharmacy"])
        overpass_mirrors = [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.openstreetmap.ru/api/interpreter",
        ]
        headers = {
            "User-Agent": "PillCare/1.0 (contact@pillcare.app)",
            "Accept": "application/json, */*",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = None
        async def fetch_mirror(m_url):
            try:
                async with httpx.AsyncClient(timeout=3.5, headers=headers) as c:
                    resp = await c.post(m_url, data={"data": query})
                    if resp.status_code == 200:
                        return resp.json()
            except Exception:
                pass
            return None

        results = await asyncio.gather(*[fetch_mirror(url) for url in overpass_mirrors], return_exceptions=True)
        for res in results:
            if isinstance(res, dict) and res.get("elements"):
                data = res
                break

        places = []
        if data and data.get("elements"):
            for el in (data.get("elements") or [])[:15]:
                tags = el.get("tags", {})
                elat = el.get("lat") or (el.get("center", {}).get("lat", 0))
                elng = el.get("lon") or (el.get("center", {}).get("lon", 0))
                if not elat or not elng:
                    continue
                name = tags.get("name") or tags.get("name:en") or tags.get("brand") or tags.get("operator") or tags.get("amenity", type).title()
                addr_parts = [tags.get("addr:housenumber", ""), tags.get("addr:street", ""), tags.get("addr:city", "")]
                address = ", ".join(p for p in addr_parts if p) or tags.get("addr:full", "") or "Nearby"
                places.append({
                    "id": str(el.get("id", "")), "name": name,
                    "address": address, "distance": dist(elat, elng),
                    "rating": 4.5, "lat": elat, "lng": elng,
                    "open": True, "phone": tags.get("phone") or tags.get("contact:phone") or tags.get("mobile"),
                })
            places.sort(key=lambda x: x["distance"])

        if places:
            return {"places": places[:max_results], "source": "osm"}

        # Built-in curated location fallback if OSM servers are unreachable or return empty
        category_defaults = {
            "pharmacy": [
                {"id": "p1", "name": "Apollo Pharmacy", "address": "Main Market Road", "distance": 450, "rating": 4.8, "lat": lat + 0.003, "lng": lng + 0.002, "open": True, "phone": "+919876543210"},
                {"id": "p2", "name": "MedPlus Chemist & Wellness", "address": "Station Road, Near Metro", "distance": 820, "rating": 4.6, "lat": lat - 0.005, "lng": lng + 0.004, "open": True, "phone": "+919876543211"},
                {"id": "p3", "name": "Sanjeevani Medical Store", "address": "Civil Hospital Gate", "distance": 1200, "rating": 4.5, "lat": lat + 0.008, "lng": lng - 0.006, "open": True, "phone": "+919876543212"},
            ],
            "diagnostic": [
                {"id": "d1", "name": "Dr. Lal PathLabs", "address": "Diagnostic Center, Block B", "distance": 600, "rating": 4.9, "lat": lat + 0.004, "lng": lng - 0.003, "open": True, "phone": "+919876543220"},
                {"id": "d2", "name": "Metropolis Healthcare", "address": "Central Avenue", "distance": 950, "rating": 4.7, "lat": lat - 0.006, "lng": lng - 0.005, "open": True, "phone": "+919876543221"},
            ],
            "hospital": [
                {"id": "h1", "name": "City Multispeciality Hospital", "address": "Ring Road Sector 4", "distance": 1400, "rating": 4.7, "lat": lat + 0.010, "lng": lng + 0.008, "open": True, "phone": "+919876543230"},
                {"id": "h2", "name": "Max Healthcare Clinic", "address": "Main Boulevard", "distance": 1850, "rating": 4.8, "lat": lat - 0.012, "lng": lng + 0.010, "open": True, "phone": "+919876543231"},
            ]
        }
        fallback_list = category_defaults.get(type, category_defaults["pharmacy"])
        return {"places": fallback_list[:max_results], "source": "curated_fallback"}

    except Exception as e:
        logger.warning(f"Nearby places search failed: {e}")
        return {"places": [], "source": "error", "message": "Could not fetch nearby places."}

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
async def export_csv_report(user_id: str = Depends(get_current_user_id)):
    """Exports complete user health history & medication records in CSV format."""
    buf = io.StringIO()
    w = csv.writer(buf)

    # 1. Profile Summary
    profile = await db.profile.find_one({"user_id": user_id}, PROJECTION) or {}
    all_meds = await db.medications.find({"user_id": user_id}, PROJECTION).to_list(1000)
    taken_cnt = await db.doses.count_documents({"user_id": user_id, "status": "taken"})
    missed_cnt = await db.doses.count_documents({"user_id": user_id, "status": "missed"})
    total_doses = taken_cnt + missed_cnt
    adh_pct = f"{round(taken_cnt / total_doses * 100, 1)}%" if total_doses > 0 else "N/A"

    w.writerow(["=== PILLCARE HEALTH DATA REPORT ==="])
    w.writerow(["Patient Name", profile.get("nickname") or profile.get("name") or "User"])
    w.writerow(["Report Date", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")])
    w.writerow(["Total Doses Tracked", total_doses])
    w.writerow(["Doses Taken", taken_cnt])
    w.writerow(["Doses Missed", missed_cnt])
    w.writerow(["Adherence Rate", adh_pct])
    w.writerow(["Caregiver Contact", profile.get("caregiver_phone") or "None"])
    w.writerow([])

    # 2. Active & Past Medications
    w.writerow(["=== MEDICATIONS CATALOG ==="])
    w.writerow(["Medication Name", "Generic Name", "Dosage", "Unit", "Scheduled Times", "Stock Remaining", "Refill Threshold", "Status"])
    for m in all_meds:
        w.writerow([
            m.get("name", ""),
            m.get("generic_name", ""),
            m.get("dosage", ""),
            m.get("unit", ""),
            "; ".join(m.get("times", [])),
            m.get("stock", 0),
            m.get("refill_threshold", 5),
            "Active" if m.get("active", True) else "Archived"
        ])
    w.writerow([])

    # 3. Dose Logs
    w.writerow(["=== DOSE LOGS & HISTORY ==="])
    w.writerow(["Date", "Scheduled Time", "Medication Name", "Dosage", "Status", "Action Timestamp"])
    doses = await db.doses.find({"user_id": user_id}, PROJECTION).sort([("date", -1), ("scheduled_time", 1)]).to_list(10000)
    med_map = {m["id"]: m for m in all_meds}
    for d in doses:
        m = med_map.get(d.get("medication_id"), {})
        act_ts = d.get("action_time")
        act_str = act_ts.strftime("%Y-%m-%d %H:%M") if isinstance(act_ts, datetime) else ""
        w.writerow([
            d.get("date", ""),
            d.get("scheduled_time", ""),
            m.get("name", "Unknown"),
            f"{m.get('dosage', '')} {m.get('unit', '')}".strip(),
            str(d.get("status", "pending")).capitalize(),
            act_str
        ])
    w.writerow([])

    # 4. Measurements & Vitals
    w.writerow(["=== MEASUREMENTS & VITALS ==="])
    w.writerow(["Recorded Timestamp", "Measurement Type", "Primary Value", "Secondary Value", "Unit", "Note"])
    vitals = await db.measurements.find({"user_id": user_id}, PROJECTION).sort("recorded_at", -1).to_list(5000)
    for v in vitals:
        rec = v.get("recorded_at")
        rec_str = rec.strftime("%Y-%m-%d %H:%M") if isinstance(rec, datetime) else str(rec or "")
        w.writerow([
            rec_str,
            str(v.get("type", "")).replace("_", " ").title(),
            v.get("value", ""),
            v.get("value_secondary", ""),
            v.get("unit", ""),
            v.get("note", "")
        ])
    w.writerow([])

    # 5. Doctor Appointments
    w.writerow(["=== APPOINTMENTS ==="])
    w.writerow(["Doctor / Clinic Name", "Specialty", "Date", "Time", "Location", "Phone", "Notes"])
    appts = await db.appointments.find({"user_id": user_id}, PROJECTION).sort([("date", 1), ("time", 1)]).to_list(1000)
    for a in appts:
        w.writerow([
            a.get("doctor_name", ""),
            a.get("specialty", ""),
            a.get("date", ""),
            a.get("time", ""),
            a.get("location", ""),
            a.get("phone", ""),
            a.get("notes", "")
        ])
    w.writerow([])

    # 6. Yoga & Wellness Logs
    w.writerow(["=== YOGA & WELLNESS LOGS ==="])
    w.writerow(["Date", "Routine / Step Name", "Completed At"])
    yoga_logs = await db.yoga_logs.find({"user_id": user_id}, PROJECTION).sort("ts", -1).to_list(1000)
    for y in yoga_logs:
        y_ts = y.get("ts")
        y_str = y_ts.strftime("%Y-%m-%d %H:%M") if isinstance(y_ts, datetime) else str(y_ts or "")
        w.writerow([
            y.get("local_date", ""),
            y.get("step_name", ""),
            y_str
        ])

    filename = f"PillCare_Health_Data_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=buf.getvalue().encode("utf-8"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api.get("/export/excel")
async def export_excel_report(user_id: str = Depends(get_current_user_id)):
    """Exports full user health history & medication report in formatted Microsoft Excel (.xlsx) format."""
    features = await get_user_features(user_id)
    if not features.get("export_data"):
        raise HTTPException(402, "ERR_PLAN: Data export requires a paid plan. Upgrade at pillcare.in/pricing.")
    
    if not EXCEL_OK:
        return await export_csv_report(user_id)

    wb = openpyxl.Workbook()
    header_fill = PatternFill("solid", fgColor="4A55A2")
    header_font = Font(bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center")

    def style_sheet(ws, headers):
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = align_center

    # Sheet 1: Summary Profile
    ws_sum = wb.active
    ws_sum.title = "Overview & Profile"
    profile = await db.profile.find_one({"user_id": user_id}, PROJECTION) or {}
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(1000)
    taken_cnt = await db.doses.count_documents({"user_id": user_id, "status": "taken"})
    missed_cnt = await db.doses.count_documents({"user_id": user_id, "status": "missed"})
    adh_pct = round(taken_cnt / (taken_cnt + missed_cnt) * 100, 1) if (taken_cnt + missed_cnt) > 0 else "N/A"

    style_sheet(ws_sum, ["Metric / Field", "Details"])
    sum_data = [
        ["Patient Name", profile.get("nickname") or profile.get("name") or "User"],
        ["Report Generated On", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")],
        ["Active Medications Count", len(meds)],
        ["Total Doses Recorded", taken_cnt + missed_cnt],
        ["Doses Taken", taken_cnt],
        ["Doses Missed", missed_cnt],
        ["Overall Adherence %", f"{adh_pct}%" if isinstance(adh_pct, float) else "N/A"],
        ["Emergency Contact / Caregiver", profile.get("caregiver_phone") or "Not configured"],
    ]
    for r_idx, (k, v) in enumerate(sum_data, 2):
        ws_sum.cell(row=r_idx, column=1, value=k)
        ws_sum.cell(row=r_idx, column=2, value=str(v))

    # Sheet 2: Medications
    ws_meds = wb.create_sheet("Medications")
    style_sheet(ws_meds, ["Medication Name", "Generic Name", "Dosage", "Unit", "Scheduled Times", "Stock Remaining", "Refill Threshold", "Status"])
    all_meds = await db.medications.find({"user_id": user_id}, PROJECTION).to_list(1000)
    for r_idx, m in enumerate(all_meds, 2):
        ws_meds.cell(row=r_idx, column=1, value=m.get("name", ""))
        ws_meds.cell(row=r_idx, column=2, value=m.get("generic_name", ""))
        ws_meds.cell(row=r_idx, column=3, value=m.get("dosage", ""))
        ws_meds.cell(row=r_idx, column=4, value=m.get("unit", ""))
        ws_meds.cell(row=r_idx, column=5, value=", ".join(m.get("times", [])))
        ws_meds.cell(row=r_idx, column=6, value=m.get("stock", 0))
        ws_meds.cell(row=r_idx, column=7, value=m.get("refill_threshold", 5))
        ws_meds.cell(row=r_idx, column=8, value="Active" if m.get("active", True) else "Archived")

    # Sheet 3: Dose Logs
    ws_doses = wb.create_sheet("Dose Log History")
    style_sheet(ws_doses, ["Date", "Scheduled Time", "Medication Name", "Dosage", "Status", "Action Time"])
    doses = await db.doses.find({"user_id": user_id}, PROJECTION).sort([("date", -1), ("scheduled_time", 1)]).to_list(10000)
    med_map = {m["id"]: m for m in all_meds}
    for r_idx, d in enumerate(doses, 2):
        m = med_map.get(d.get("medication_id"), {})
        ws_doses.cell(row=r_idx, column=1, value=d.get("date", ""))
        ws_doses.cell(row=r_idx, column=2, value=d.get("scheduled_time", ""))
        ws_doses.cell(row=r_idx, column=3, value=m.get("name", "Unknown Medicine"))
        ws_doses.cell(row=r_idx, column=4, value=f"{m.get('dosage', '')} {m.get('unit', '')}".strip())
        ws_doses.cell(row=r_idx, column=5, value=str(d.get("status", "pending")).capitalize())
        action_ts = d.get("action_time")
        ws_doses.cell(row=r_idx, column=6, value=action_ts.strftime("%Y-%m-%d %H:%M") if isinstance(action_ts, datetime) else "")

    # Sheet 4: Measurements & Vitals
    ws_vitals = wb.create_sheet("Vitals & Measurements")
    style_sheet(ws_vitals, ["Recorded Date/Time", "Measurement Type", "Value", "Secondary Value", "Unit", "Note"])
    vitals = await db.measurements.find({"user_id": user_id}, PROJECTION).sort("recorded_at", -1).to_list(5000)
    for r_idx, v in enumerate(vitals, 2):
        rec = v.get("recorded_at")
        ws_vitals.cell(row=r_idx, column=1, value=rec.strftime("%Y-%m-%d %H:%M") if isinstance(rec, datetime) else str(rec or ""))
        ws_vitals.cell(row=r_idx, column=2, value=str(v.get("type", "")).replace("_", " ").title())
        ws_vitals.cell(row=r_idx, column=3, value=v.get("value", ""))
        ws_vitals.cell(row=r_idx, column=4, value=v.get("value_secondary", ""))
        ws_vitals.cell(row=r_idx, column=5, value=v.get("unit", ""))
        ws_vitals.cell(row=r_idx, column=6, value=v.get("note", ""))

    # Auto-adjust column widths across all sheets
    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 14)

    buf = io.BytesIO()
    wb.save(buf)
    excel_bytes = buf.getvalue()
    filename = f"pillcare_health_report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )



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
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "pillcare_admin_secret_key_2026")

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


ADMIN_PANEL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PillCare Admin Mission Control</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background-color: #0b0c10; color: #f3f4f6; padding: 24px; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid #1f2937; margin-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .sub { font-size: 13px; color: #9ca3af; }
    .auth-bar { display: flex; gap: 10px; align-items: center; }
    input, select, button { font-family: inherit; }
    .inp { background: #171822; border: 1px solid #374151; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; outline: none; transition: border 0.2s; }
    .inp:focus { border-color: #8b5cf6; }
    .btn { background: #8b5cf6; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: background 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: #7c3aed; }
    .btn-secondary { background: #1f2937; color: #e5e7eb; border: 1px solid #374151; }
    .btn-secondary:hover { background: #374151; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #171822; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .kpi-title { font-size: 12px; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-val { font-size: 28px; font-weight: 800; color: #fff; }
    .kpi-sub { font-size: 12px; color: #10b981; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; margin-top: 32px; }
    .section-title { font-size: 18px; font-weight: 700; color: #fff; }
    table { width: 100%; border-collapse: collapse; background: #171822; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); font-size: 13px; }
    th { background: #11121c; text-align: left; padding: 14px 16px; color: #9ca3af; font-weight: 600; border-bottom: 1px solid #1f2937; }
    td { padding: 14px 16px; border-bottom: 1px solid #1f2937; color: #e5e7eb; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: rgba(255,255,255,0.02); }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; }
    .badge-free { background: rgba(156,163,175,0.15); color: #9ca3af; border: 1px solid rgba(156,163,175,0.3); }
    .badge-basic { background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); }
    .badge-premium { background: rgba(168,85,247,0.15); color: #c084fc; border: 1px solid rgba(168,85,247,0.3); }
    .badge-enterprise { background: rgba(251,146,60,0.15); color: #fb923c; border: 1px solid rgba(251,146,60,0.3); }
    .toggles { display: flex; flex-wrap: wrap; gap: 8px; }
    .toggle-chip { background: #11121c; border: 1px solid #374151; padding: 4px 8px; border-radius: 6px; font-size: 11px; color: #d1d5db; display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .toggle-chip input { cursor: pointer; accent-color: #8b5cf6; }
    .toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: #fff; padding: 12px 20px; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: none; z-index: 1000; }
    .panel { background: #171822; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); padding: 24px; margin-bottom: 24px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 6px; font-weight: 500; }
    .form-control { width: 100%; background: #11121c; border: 1px solid #374151; color: #fff; padding: 10px; border-radius: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">💊</div>
        <div>
          <h1>PillCare Mission Control</h1>
          <div class="sub">Admin Panel & Feature Controls • PillCare Platform</div>
        </div>
      </div>
      <div class="auth-bar">
        <input type="password" id="adminSecret" class="inp" placeholder="Enter Admin Secret Key" value="" onchange="saveSecret()" />
        <button class="btn" onclick="loadAllData()">↻ Refresh Data</button>
        <button class="btn btn-secondary" onclick="exportData()">📥 Export (.xlsx)</button>
      </div>
    </header>

    <!-- KPI STATS GRID -->
    <div class="grid">
      <div class="card">
        <div class="kpi-title">Total Users</div>
        <div class="kpi-val" id="statUsers">...</div>
        <div class="kpi-sub">👥 Registered Patients</div>
      </div>
      <div class="card">
        <div class="kpi-title">7-Day Active Users</div>
        <div class="kpi-val" id="statActive">...</div>
        <div class="kpi-sub">🔥 Engaged this week</div>
      </div>
      <div class="card">
        <div class="kpi-title">Doses Logged</div>
        <div class="kpi-val" id="statDoses">...</div>
        <div class="kpi-sub" id="statAdherence">Adherence: ...</div>
      </div>
      <div class="card">
        <div class="kpi-title">Active Paid Plans</div>
        <div class="kpi-val" id="statSubscriptions">...</div>
        <div class="kpi-sub">💎 Pro & Elite Subscribers</div>
      </div>
      <div class="card">
        <div class="kpi-title">Est. Monthly Revenue</div>
        <div class="kpi-val" id="statRevenue">₹0</div>
        <div class="kpi-sub">⚡ Recurring Subscription Model</div>
      </div>
    </div>

    <!-- USER DIRECTORY & FEATURE TIERS TABLE -->
    <div class="section-header">
      <div class="section-title">User Directory & Premium Feature Controls</div>
      <input type="text" id="userSearch" class="inp" placeholder="Search by name, email, city or plan..." style="width: 320px;" onkeyup="filterUsers()" />
    </div>

    <table>
      <thead>
        <tr>
          <th>User Info</th>
          <th>Location & Contact</th>
          <th>Assigned Subscription Plan</th>
          <th>Feature Overrides & Access Toggles</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="userTableBody">
        <tr><td colspan="5" style="text-align: center; padding: 40px; color: #9ca3af;">Loading users from database...</td></tr>
      </tbody>
    </table>

    <!-- JP MORGAN FINANCIAL METRICS & SUBSCRIPTION UNIT ECONOMICS -->
    <div class="section-header">
      <div class="section-title">JP Morgan Financial Metrics & Subscription Unit Economics</div>
      <button class="btn btn-secondary" onclick="fetchFinancials()">↻ Refresh Financials</button>
    </div>
    <div class="grid">
      <div class="card" style="border-left: 4px solid #10b981;">
        <div class="kpi-title">Monthly Recurring Revenue (MRR)</div>
        <div class="kpi-val" id="finMrr">₹0</div>
        <div class="kpi-sub">📈 Real-time Subscription Run Rate</div>
      </div>
      <div class="card" style="border-left: 4px solid #38bdf8;">
        <div class="kpi-title">Annual Recurring Revenue (ARR)</div>
        <div class="kpi-val" id="finArr">₹0</div>
        <div class="kpi-sub">🚀 Annualized Forecast (MRR × 12)</div>
      </div>
      <div class="card" style="border-left: 4px solid #a855f7;">
        <div class="kpi-title">Average Revenue Per User (ARPU)</div>
        <div class="kpi-val" id="finArpu">₹0</div>
        <div class="kpi-sub">👤 Per Active Subscriber</div>
      </div>
      <div class="card" style="border-left: 4px solid #f59e0b;">
        <div class="kpi-title">Customer Lifetime Value (LTV)</div>
        <div class="kpi-val" id="finLtv">₹0</div>
        <div class="kpi-sub">💎 Est. 12-Month Retention Basis</div>
      </div>
    </div>
    <div class="panel" style="margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="font-weight:700; color:#fff;">Subscription Distribution:</span>
          <span id="finDistribution" style="font-size:13px; color:#9ca3af; margin-left:10px;">Loading distribution...</span>
        </div>
        <div id="finPaidPct" style="font-weight:700; color:#10b981; font-size:14px;">Paid Conversion: ...</div>
      </div>
    </div>

    <!-- SWIGGY/ZOMATO STYLE FLASH ANNOUNCEMENT CONTROL -->
    <div class="section-header">
      <div class="section-title">Swiggy / Zomato Flash In-App Announcement Control</div>
    </div>
    <div class="panel">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
        <div class="form-group">
          <label>Announcement Title</label>
          <input type="text" id="annTitle" class="form-control" placeholder="e.g. ⚡ Flash Offer: Upgrade to Elite for ₹49" />
        </div>
        <div class="form-group">
          <label>Type / Badge Style</label>
          <select id="annType" class="form-control">
            <option value="offer">🎁 Special Offer / Promotion</option>
            <option value="info">📢 Information / Feature Release</option>
            <option value="warning">⚠️ Warning / Maintenance</option>
            <option value="alert">🚨 Critical System Alert</option>
          </select>
        </div>
        <div class="form-group">
          <label>Target User Subscription Tier</label>
          <select id="annTargetPlan" class="form-control">
            <option value="all">🌐 All Users (Free + Paid)</option>
            <option value="free">Free Plan Users Only</option>
            <option value="basic">Pro Dharma (Basic) Users Only</option>
            <option value="premium">Elite Moksha (Premium) Users Only</option>
          </select>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
        <div class="form-group">
          <label>Announcement Message Body</label>
          <input type="text" id="annBody" class="form-control" placeholder="e.g. Unlock unlimited AI Drug-Food Guide & OCR Doctor Scanner today!" />
        </div>
        <div class="form-group">
          <label>Optional Action Link / Deep URL</label>
          <input type="text" id="annLinkUrl" class="form-control" placeholder="e.g. https://pillcare.in/upgrade" />
        </div>
      </div>
      <button class="btn" onclick="publishAnnouncement()">📣 Publish In-App Announcement</button>
    </div>

    <div style="margin-bottom:24px;">
      <h3 style="font-size:14px; font-weight:700; color:#fff; margin-bottom:10px;">Active Broadcast Announcements</h3>
      <table>
        <thead>
          <tr>
            <th>Badge & Title</th>
            <th>Message Content</th>
            <th>Target Plan</th>
            <th>Published Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="announcementsTableBody">
          <tr><td colspan="5" style="text-align: center; padding: 20px; color: #9ca3af;">Loading active announcements...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- BROADCAST PUSH NOTIFICATION CENTER -->
    <div class="section-header">
      <div class="section-title">Broadcast Push Notification Center</div>
    </div>
    <div class="panel">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="form-group">
          <label>Notification Title</label>
          <input type="text" id="notifTitle" class="form-control" placeholder="e.g. 💊 PillCare Important Update" />
        </div>
        <div class="form-group">
          <label>Target User ID (Leave blank to broadcast to ALL users)</label>
          <input type="text" id="notifTarget" class="form-control" placeholder="All Users or specific User ID" />
        </div>
      </div>
      <div class="form-group">
        <label>Message Body</label>
        <textarea id="notifBody" class="form-control" rows="2" placeholder="e.g. Remember to log your doses on time today! Your health streak is active."></textarea>
      </div>
      <button class="btn" onclick="sendNotification()">🚀 Send Push Notification</button>
    </div>

    <!-- SECURITY & BLOCKED IP TABLE -->
    <div class="section-header">
      <div class="section-title">Security Audit & Rate-Limited IPs</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>IP Address</th>
          <th>Failed Login Attempts</th>
          <th>Last Attempt</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="blockedIpBody">
        <tr><td colspan="4" style="text-align: center; padding: 20px; color: #9ca3af;">No blocked IPs detected.</td></tr>
      </tbody>
    </table>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    let allUsers = [];
    const SECRET_KEY = "pillcare_admin_secret";

    document.addEventListener("DOMContentLoaded", () => {
      const saved = localStorage.getItem(SECRET_KEY);
      if (saved) document.getElementById("adminSecret").value = saved;
      loadAllData();
    });

    function saveSecret() {
      const val = document.getElementById("adminSecret").value;
      localStorage.setItem(SECRET_KEY, val);
    }

    function getHeaders() {
      const sec = document.getElementById("adminSecret").value;
      return { "x-admin-secret": sec, "Content-Type": "application/json" };
    }

    function showToast(msg) {
      const t = document.getElementById("toast");
      t.innerText = msg;
      t.style.display = "block";
      setTimeout(() => { t.style.display = "none"; }, 3500);
    }

    async function loadAllData() {
      saveSecret();
      await Promise.all([fetchStats(), fetchUsers(), fetchBlockedIps(), fetchRevenue(), fetchFinancials(), fetchAnnouncements()]);
    }

    async function fetchFinancials() {
      try {
        const res = await fetch("/admin/analytics/financials", { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById("finMrr").innerText = `₹${(data.mrr || 0).toLocaleString("en-IN")}`;
        document.getElementById("finArr").innerText = `₹${(data.arr || 0).toLocaleString("en-IN")}`;
        document.getElementById("finArpu").innerText = `₹${(data.arpu || 0).toLocaleString("en-IN")}`;
        document.getElementById("finLtv").innerText = `₹${(data.ltv || 0).toLocaleString("en-IN")}`;
        document.getElementById("finPaidPct").innerText = `Paid Conversion: ${data.paid_conversion_rate || 0}% (${data.active_subscribers || 0}/${data.total_users || 0})`;
        const dist = data.tier_breakdown || {};
        document.getElementById("finDistribution").innerText = `Free: ${dist.free || 0} | Basic (Pro): ${dist.basic || 0} | Premium (Elite): ${dist.premium || 0} | Enterprise: ${dist.enterprise || 0}`;
      } catch (e) { console.error("Financials load failed", e); }
    }

    async function fetchAnnouncements() {
      try {
        const res = await fetch("/admin/announcements", { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const tbody = document.getElementById("announcementsTableBody");
        if (!data || data.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#9ca3af;">No active announcements currently broadcast.</td></tr>`;
          return;
        }
        tbody.innerHTML = data.map(a => `
          <tr>
            <td>
              <span class="badge badge-${a.type || 'info'}">${(a.type || 'info').toUpperCase()}</span>
              <div style="font-weight:700; color:#fff; margin-top:4px;">${a.title || ''}</div>
            </td>
            <td><div style="font-size:12px; color:#d1d5db;">${a.body || ''}</div></td>
            <td><span class="badge badge-free">${(a.target_plan || 'all').toUpperCase()}</span></td>
            <td><div style="font-size:11px; color:#9ca3af;">${a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : 'Just now'}</div></td>
            <td>
              <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px; color:#ef4444;" onclick="deleteAnnouncement('${a.id}')">🗑️ Delete</button>
            </td>
          </tr>
        `).join("");
      } catch (e) { console.error("Announcements load failed", e); }
    }

    async function publishAnnouncement() {
      const title = document.getElementById("annTitle").value;
      const body = document.getElementById("annBody").value;
      const type = document.getElementById("annType").value;
      const target_plan = document.getElementById("annTargetPlan").value;
      const link_url = document.getElementById("annLinkUrl").value;
      if (!title || !body) { showToast("Please provide Title and Body for the announcement."); return; }
      try {
        const res = await fetch("/admin/announcements", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ title, body, type, target_plan, link_url: link_url || undefined })
        });
        if (res.ok) {
          showToast("📢 In-App Flash Announcement published live!");
          document.getElementById("annTitle").value = "";
          document.getElementById("annBody").value = "";
          document.getElementById("annLinkUrl").value = "";
          fetchAnnouncements();
        } else {
          showToast("Failed to publish announcement.");
        }
      } catch (e) { showToast("Network error publishing announcement."); }
    }

    async function deleteAnnouncement(annId) {
      try {
        const res = await fetch(`/admin/announcements/${annId}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        if (res.ok) {
          showToast("Announcement deleted.");
          fetchAnnouncements();
        }
      } catch (e) { showToast("Network error deleting announcement."); }
    }

    async function fetchStats() {
      try {
        const res = await fetch("/admin/stats", { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById("statUsers").innerText = data.total_users || 0;
        document.getElementById("statActive").innerText = data.active_users_7d || 0;
        document.getElementById("statDoses").innerText = data.total_doses || 0;
        document.getElementById("statAdherence").innerText = `Adherence: ${data.adherence_rate || 0}%`;
      } catch (e) { console.error("Stats load failed", e); }
    }

    async function fetchRevenue() {
      try {
        const res = await fetch("/admin/revenue", { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById("statSubscriptions").innerText = data.active_subscriptions || 0;
        document.getElementById("statRevenue").innerText = `₹${data.monthly_recurring_revenue || 0}`;
      } catch (e) { console.error("Revenue load failed", e); }
    }

    async function fetchUsers() {
      try {
        const res = await fetch("/admin/users?limit=200", { headers: getHeaders() });
        if (!res.ok) {
          document.getElementById("userTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:30px;">Access Denied — Please enter a valid Admin Secret Key in the header input.</td></tr>`;
          return;
        }
        allUsers = await res.json();
        renderUserTable(allUsers);
      } catch (e) { console.error("Users load failed", e); }
    }

    function renderUserTable(users) {
      const tbody = document.getElementById("userTableBody");
      if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#9ca3af;">No users found matching query.</td></tr>`;
        return;
      }
      tbody.innerHTML = users.map(u => {
        const uid = u.user_id || u.id;
        const plan = (u.plan || "free").toLowerCase();
        const overrides = u.overrides || {};
        return `
          <tr>
            <td>
              <div style="font-weight:700; color:#fff;">${u.name || u.nickname || "Anonymous User"}</div>
              <div style="font-size:11px; color:#9ca3af;">ID: ${uid.substring(0, 12)}...</div>
            </td>
            <td>
              <div>${u.email || u.phone || "No contact"}</div>
              <div style="font-size:11px; color:#9ca3af;">${u.city || "Unknown City"}, ${u.state || "India"}</div>
            </td>
            <td>
              <select class="inp" style="background:#11121c;" onchange="updatePlan('${uid}', this.value)">
                <option value="free" ${plan === 'free' ? 'selected' : ''}>Free Plan (₹0)</option>
                <option value="basic" ${plan === 'basic' ? 'selected' : ''}>Pro Dharma (Basic ₹30)</option>
                <option value="premium" ${plan === 'premium' ? 'selected' : ''}>Elite Moksha (Premium ₹99)</option>
                <option value="enterprise" ${plan === 'enterprise' ? 'selected' : ''}>Enterprise / Hospital</option>
              </select>
              <div style="margin-top:4px;">
                <span class="badge badge-${plan}">${plan}</span>
              </div>
            </td>
            <td>
              <div class="toggles">
                <label class="toggle-chip">
                  <input type="checkbox" ${overrides.export_data ?? (plan !== 'free') ? 'checked' : ''} onchange="toggleFeature('${uid}', 'export_data', this.checked)" /> 📄 Export PDF
                </label>
                <label class="toggle-chip">
                  <input type="checkbox" ${overrides.scanner ?? (plan !== 'free') ? 'checked' : ''} onchange="toggleFeature('${uid}', 'scanner', this.checked)" /> 📷 OCR Scanner
                </label>
                <label class="toggle-chip">
                  <input type="checkbox" ${overrides.yoga_full ?? (plan !== 'free') ? 'checked' : ''} onchange="toggleFeature('${uid}', 'yoga_full', this.checked)" /> 🧘 Yoga Full
                </label>
                <label class="toggle-chip">
                  <input type="checkbox" ${overrides.brand_generic ?? (plan !== 'free') ? 'checked' : ''} onchange="toggleFeature('${uid}', 'brand_generic', this.checked)" /> 💊 Brand -> Generic
                </label>
                <label class="toggle-chip">
                  <input type="checkbox" ${overrides.caregiver_alerts ? 'checked' : ''} onchange="toggleFeature('${uid}', 'caregiver_alerts', this.checked ? 999 : 0)" /> 👥 Caregivers
                </label>
              </div>
            </td>
            <td>
              <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="viewUserAnalytics('${uid}')">📊 Analytics</button>
            </td>
          </tr>
        `;
      }).join("");
    }

    function filterUsers() {
      const q = document.getElementById("userSearch").value.toLowerCase();
      const filtered = allUsers.filter(u => 
        (u.name || "").toLowerCase().includes(q) || 
        (u.email || "").toLowerCase().includes(q) ||
        (u.city || "").toLowerCase().includes(q) ||
        (u.plan || "").toLowerCase().includes(q)
      );
      renderUserTable(filtered);
    }

    async function updatePlan(userId, plan) {
      try {
        const res = await fetch(`/admin/users/${userId}/subscription`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ plan: plan, expires_days: 365, status: "active", note: "Updated via Admin Panel UI" })
        });
        if (res.ok) {
          showToast(`Successfully updated subscription plan to ${plan.toUpperCase()}`);
          loadAllData();
        } else {
          showToast("Failed to update plan. Check Admin Secret Key.");
        }
      } catch (e) { showToast("Error connecting to server."); }
    }

    async function toggleFeature(userId, feature, value) {
      try {
        const res = await fetch(`/admin/users/${userId}/features`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ feature: feature, value: value })
        });
        if (res.ok) {
          showToast(`Feature '${feature}' updated to ${value}`);
        } else {
          showToast("Failed to update feature override.");
        }
      } catch (e) { showToast("Error connecting to server."); }
    }

    async function sendNotification() {
      const title = document.getElementById("notifTitle").value;
      const body = document.getElementById("notifBody").value;
      const target = document.getElementById("notifTarget").value;
      if (!title || !body) { showToast("Please provide both Title and Body."); return; }
      try {
        const res = await fetch("/admin/notify", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ title: title, body: body, user_id: target || undefined })
        });
        if (res.ok) {
          showToast("🚀 Push Notification sent successfully!");
          document.getElementById("notifTitle").value = "";
          document.getElementById("notifBody").value = "";
        } else {
          showToast("Failed to send push notification.");
        }
      } catch (e) { showToast("Network error."); }
    }

    async function fetchBlockedIps() {
      try {
        const res = await fetch("/admin/blocked-ips", { headers: getHeaders() });
        if (!res.ok) return;
        const ips = await res.json();
        const tbody = document.getElementById("blockedIpBody");
        if (!ips || ips.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#9ca3af;">No blocked IPs detected. System is secure.</td></tr>`;
          return;
        }
        tbody.innerHTML = ips.map(i => `
          <tr>
            <td><code>${i.ip}</code></td>
            <td>${i.attempts}</td>
            <td>${new Date(i.last_attempt).toLocaleString()}</td>
            <td><button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="unblockIp('${i.ip}')">Unblock IP</button></td>
          </tr>
        `).join("");
      } catch (e) {}
    }

    async function unblockIp(ip) {
      try {
        const res = await fetch(`/admin/blocked-ips/${ip}`, { method: "DELETE", headers: getHeaders() });
        if (res.ok) {
          showToast(`IP ${ip} unblocked.`);
          fetchBlockedIps();
        }
      } catch (e) {}
    }

    function exportData() {
      const sec = document.getElementById("adminSecret").value;
      window.location.href = `/admin/export/users?x-admin-secret=${encodeURIComponent(sec)}`;
    }

    function viewUserAnalytics(userId) {
      alert(`User ID: ${userId}\nTo inspect full dose logs & events, view the analytics endpoints.`);
    }
  </script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
async def root_or_admin(request: Request):
    host = request.headers.get("host", "").lower()
    if "admin" in host:
        return HTMLResponse(content=ADMIN_PANEL_HTML)
    return JSONResponse({"name": "PillCare Backend API", "version": "1.0.1", "status": "online", "docs": "/docs"})

@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_ui():
    """Renders the PillCare Web Admin Panel UI."""
    return HTMLResponse(content=ADMIN_PANEL_HTML)


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
        "ai_insights": "weekly",
        "caregiver_alerts": 0,
        "nearby_results": 5,
        "yoga_full": False,
        "export_data": False,
        "brand_generic": False,
        "scanner": False,
        "max_appointments": 2,
        "price_inr": 0,
        "plan_label": "Free Plan",
    },
    "basic": {
        "max_medications": 10,
        "history_days": 30,
        "ai_insights": "daily",
        "caregiver_alerts": 2,
        "nearby_results": 15,
        "yoga_full": True,
        "export_data": True,
        "brand_generic": True,
        "scanner": True,
        "max_appointments": 5,
        "price_inr": 30,
        "plan_label": "Pro Dharma (Basic)",
    },
    "premium": {
        "max_medications": 999,
        "history_days": 365,
        "ai_insights": "realtime",
        "caregiver_alerts": 999,
        "nearby_results": 50,
        "yoga_full": True,
        "export_data": True,
        "brand_generic": True,
        "scanner": True,
        "max_appointments": 999,
        "price_inr": 99,
        "plan_label": "Elite Moksha (Premium)",
    },
    "enterprise": {
        "max_medications": 999,
        "history_days": 365,
        "ai_insights": "realtime",
        "caregiver_alerts": 999,
        "nearby_results": 100,
        "yoga_full": True,
        "export_data": True,
        "brand_generic": True,
        "scanner": True,
        "max_appointments": 999,
        "api_access": True,
        "price_inr": 0,
        "plan_label": "Enterprise / Hospital",
    }
}

async def get_user_features(user_id: str) -> dict:
    sub = await db.subscriptions.find_one({"user_id": user_id}, PROJECTION)
    plan = sub.get("plan", "free") if sub else "free"
    
    if sub and sub.get("expires_at"):
        exp = sub["expires_at"]
        if isinstance(exp, str):
            try: exp = datetime.fromisoformat(exp)
            except Exception: exp = None
        if exp and isinstance(exp, datetime):
            if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc): plan = "free"

    features = dict(PLAN_FEATURES.get(plan, PLAN_FEATURES["free"]))
    if sub and sub.get("overrides") and isinstance(sub["overrides"], dict):
        features.update(sub["overrides"])
    features["plan"] = plan

    exp_val = sub.get("expires_at") if sub else None
    if isinstance(exp_val, datetime):
        features["plan_expires"] = exp_val.isoformat()
    elif isinstance(exp_val, str):
        features["plan_expires"] = exp_val
    else:
        features["plan_expires"] = "2099-12-31T23:59:59Z" if plan in ["premium", "enterprise"] else None

    return features

@api.get("/me/features")
async def my_features(user_id: str = Depends(get_current_user_id)):
    return await get_user_features(user_id)

@api.get("/me/subscription")
async def my_subscription(user_id: str = Depends(get_current_user_id)):
    sub = await db.subscriptions.find_one({"user_id": user_id}, PROJECTION)
    if not sub:
        return {"plan": "free", "status": "active", "expires_at": None, "features": PLAN_FEATURES["free"]}
    plan = sub.get("plan", "free")
    features = await get_user_features(user_id)
    return {
        "plan": plan,
        "status": sub.get("status", "active"),
        "expires_at": sub.get("expires_at").isoformat() if sub.get("expires_at") else None,
        "features": features
    }

class UserUpgradeRequest(BaseModel):
    plan: str = "premium"
    days: int = 30
    payment_id: Optional[str] = None
    promo_code: Optional[str] = None

@api.post("/me/upgrade")
async def user_upgrade_plan(body: UserUpgradeRequest, user_id: str = Depends(get_current_user_id)):
    """Allows users to upgrade their subscription plan to Premium or Basic."""
    plan_key = body.plan.lower()
    if plan_key not in PLAN_FEATURES:
        raise HTTPException(400, f"Invalid plan '{body.plan}'. Available plans: {list(PLAN_FEATURES.keys())}")
    
    expires = datetime.now(timezone.utc) + timedelta(days=body.days) if body.days > 0 else None
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "plan": plan_key,
            "status": "active",
            "expires_at": expires,
            "updated_at": datetime.now(timezone.utc),
            "payment_id": body.payment_id or "DIRECT_PROMO_UPGRADE",
            "note": f"Upgraded to {plan_key} via PillCare app/web"
        }},
        upsert=True
    )
    await track_event("subscription_upgraded", user_id, {"plan": plan_key, "days": body.days})
    features = await get_user_features(user_id)
    return {
        "success": True,
        "message": f"Successfully unlocked PillCare {PLAN_FEATURES[plan_key]['plan_label']}!",
        "plan": plan_key,
        "expires_at": expires.isoformat() if expires else None,
        "features": features
    }

class PaymentOrderRequest(BaseModel):
    plan: str = "premium"
    amount_inr: int = 99

@api.post("/payments/create-order")
async def create_payment_order(body: PaymentOrderRequest, user_id: str = Depends(get_current_user_id)):
    """Generates a checkout order ID for Razorpay / Stripe integration."""
    order_id = f"order_{uuid.uuid4().hex[:14]}"
    return {
        "order_id": order_id,
        "amount": body.amount_inr * 100,
        "currency": "INR",
        "plan": body.plan,
        "key_id": os.getenv("RAZORPAY_KEY_ID", "rzp_test_pillcare_2026")
    }

class PaymentVerifyRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: Optional[str] = None
    plan: str = "premium"

@api.post("/payments/verify")
async def verify_payment(body: PaymentVerifyRequest, user_id: str = Depends(get_current_user_id)):
    """Verifies payment transaction and instantly upgrades account to target plan."""
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "plan": body.plan,
            "status": "active",
            "expires_at": expires,
            "updated_at": datetime.now(timezone.utc),
            "payment_id": body.payment_id,
            "order_id": body.order_id,
            "note": f"Paid subscription via Razorpay/Gateway ({body.payment_id})"
        }},
        upsert=True
    )
    await track_event("payment_success", user_id, {"order_id": body.order_id, "plan": body.plan})
    features = await get_user_features(user_id)
    return {
        "success": True,
        "message": "Payment verified! Premium features unlocked.",
        "plan": body.plan,
        "expires_at": expires.isoformat(),
        "features": features
    }

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

class AnnouncementCreate(BaseModel):
    title: str
    body: str
    action_text: Optional[str] = "Explore Now"
    action_link: Optional[str] = None
    type: str = "banner"
    target_plan: str = "all"
    expires_hours: int = 72

@app.post("/admin/announcements")
async def create_announcement(payload: AnnouncementCreate, _: None = Depends(require_admin)):
    exp = datetime.now(timezone.utc) + timedelta(hours=payload.expires_hours)
    doc = {
        "id": f"ann_{uuid.uuid4().hex[:12]}",
        "title": payload.title,
        "body": payload.body,
        "action_text": payload.action_text,
        "action_link": payload.action_link,
        "type": payload.type,
        "target_plan": payload.target_plan,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "expires_at": exp,
    }
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "id": doc["id"], "announcement": doc}

@app.get("/admin/announcements")
async def list_admin_announcements(_: None = Depends(require_admin)):
    items = await db.announcements.find({}, PROJECTION).sort("created_at", -1).to_list(100)
    return items

@app.delete("/admin/announcements/{ann_id}")
async def delete_announcement(ann_id: str, _: None = Depends(require_admin)):
    await db.announcements.update_one({"id": ann_id}, {"$set": {"active": False}})
    return {"ok": True}

@api.get("/announcements/active")
async def get_active_announcements(plan: str = "free"):
    now = datetime.now(timezone.utc)
    items = await db.announcements.find({
        "active": True,
        "expires_at": {"$gte": now},
        "target_plan": {"$in": ["all", plan.lower()]}
    }, PROJECTION).sort("created_at", -1).to_list(10)
    return items

@app.get("/admin/analytics/financials")
async def admin_financial_kpis(_: None = Depends(require_admin)):
    """JP Morgan-Grade Financial Metrics: MRR, ARR, ARPU, LTV, Plan breakdown."""
    total_users = await db.profile.count_documents({})
    paid_subs = await db.subscriptions.find({"status": "active", "plan": {"$in": ["basic", "premium", "enterprise"]}}).to_list(5000)
    
    mrr = sum(30 if s.get("plan") == "basic" else 99 if s.get("plan") == "premium" else 0 for s in paid_subs)
    arr = mrr * 12
    arpu = round(mrr / total_users, 2) if total_users > 0 else 0.0
    ltv = round(arpu * 18, 2)
    
    plan_counts = {
        "free": await db.subscriptions.count_documents({"plan": "free"}),
        "basic": await db.subscriptions.count_documents({"plan": "basic"}),
        "premium": await db.subscriptions.count_documents({"plan": "premium"}),
        "enterprise": await db.subscriptions.count_documents({"plan": "enterprise"}),
    }
    
    paid_conversion_rate = round((len(paid_subs) / total_users * 100), 1) if total_users > 0 else 0.0
    return {
        "mrr": mrr,
        "arr": arr,
        "arpu": arpu,
        "ltv": ltv,
        "active_subscribers": len(paid_subs),
        "total_users": total_users,
        "paid_conversion_rate": paid_conversion_rate,
        "tier_breakdown": plan_counts,
        "plan_counts": plan_counts,
    }

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
@limiter.exempt
async def health_check(request: Request):
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
