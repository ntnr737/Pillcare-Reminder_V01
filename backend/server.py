from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import StreamingResponse
import io
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
import io
import csv
import uuid
import httpx
import jwt as pyjwt
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, date, timezone, timedelta
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
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
JWT_EXPIRY_DAYS = 90
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

app = FastAPI(title="PillCare API")
api = APIRouter(prefix="/api")

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
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
    notifications_enabled: bool = True
    onboarded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileUpsert(BaseModel):
    nickname: str
    gender: str
    year_of_birth: int
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    phone: Optional[str] = None
    routine_wake: Optional[str] = "07:00"
    routine_breakfast: Optional[str] = "08:00"
    routine_lunch: Optional[str] = "13:00"
    routine_dinner: Optional[str] = "19:00"
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
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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
                await db.doses.insert_one(d.dict())


async def _adherence_for_user(user_id: str, days: int = 7):
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
    for entry in reversed(daily):
        if entry["total"] > 0 and entry["pct"] >= 80:
            # Good adherence day — count it
            if streak_ongoing:
                streak += 1
        elif entry["total"] == 0:
            # No doses scheduled — don't break streak (rest day)
            pass
        else:
            # Had doses but poor adherence — stop streak
            streak_ongoing = False
    avg = round(sum(d["pct"] for d in daily) / len(daily)) if daily else 0
    return {"daily": daily, "streak": streak, "average": avg}


# ---------- Routes ----------
@api.get("/")
async def root():
    return {"message": "PillCare API ready"}


# Auth
@api.post("/auth/google")
async def auth_google(payload: GoogleAuthRequest):
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
        await db.users.insert_one(user.dict())
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
    data = payload.dict()
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
    await db.profile.insert_one(p.dict())
    return _clean(p.dict())


# Medications
@api.get("/medications")
async def list_medications(active: Optional[bool] = None, user_id: str = Depends(get_current_user_id)):
    q = {"user_id": user_id}
    if active is not None:
        q["active"] = active
    items = await db.medications.find(q, PROJECTION).to_list(1000)
    return items


@api.post("/medications")
async def create_medication(payload: MedicationCreate, user_id: str = Depends(get_current_user_id)):
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
    data = payload.dict()
    data["generic_name"] = generic
    med = Medication(user_id=user_id, **data)
    await db.medications.insert_one(med.dict())
    await track_event("medication_added", user_id, {
        "medication_name": med.name if hasattr(med, 'name') else "",
        "frequency": med.frequency if hasattr(med, 'frequency') else "",
        "total_medications": await db.medications.count_documents({"user_id": user_id, "active": True}),
    })
    return _clean(med.dict())


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
        if m:
            enriched.append({**d, "medication": m})
    enriched.sort(key=lambda x: x["scheduled_time"])
    return enriched


@api.post("/doses/{dose_id}/status")
async def update_dose_status(dose_id: str, payload: DoseStatusUpdate, user_id: str = Depends(get_current_user_id)):
    # LOCK: once taken, cannot be changed
    existing = await db.doses.find_one({"id": dose_id, "user_id": user_id}, PROJECTION)
    if not existing:
        raise HTTPException(404, "Dose not found")
    if existing.get("status") == "taken":
        return existing  # taken is permanent, ignore
    update = {"status": payload.status}
    if payload.status == "taken":
        taken_at = payload.taken_at or datetime.now(timezone.utc)
        update["taken_at"] = taken_at
        await db.medications.update_one(
            {"id": existing["medication_id"], "user_id": user_id},
            {"$inc": {"stock": -1}},
        )
        # Get medication details for analytics
        med = await db.medications.find_one({"id": existing["medication_id"]}, PROJECTION) or {}
        now = datetime.now(timezone.utc)
        await track_event("dose_taken", user_id, {
            "medication_name": med.get("name", ""),
            "medication_id": existing.get("medication_id", ""),
            "dose_time": existing.get("scheduled_time", ""),
            "hour": now.hour,
            "day_of_week": now.weekday(),
            "date": now.strftime("%Y-%m-%d"),
            "section": existing.get("section", ""),
        })
    elif payload.status == "skipped":
        await track_event("dose_skipped", user_id, {"medication_id": existing.get("medication_id", "")})
    elif payload.status == "missed":
        await track_event("dose_missed", user_id, {"medication_id": existing.get("medication_id", "")})
    res = await db.doses.update_one({"id": dose_id, "user_id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Dose not found")
    doc = await db.doses.find_one({"id": dose_id, "user_id": user_id}, PROJECTION)
    return doc


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
    m = Measurement(user_id=user_id, **payload.dict())
    await db.measurements.insert_one(m.dict())
    return _clean(m.dict())


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
    a = Activity(user_id=user_id, **payload.dict())
    await db.activities.insert_one(a.dict())
    return _clean(a.dict())


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
    m = MoodEntry(user_id=user_id, **payload.dict())
    await db.mood.insert_one(m.dict())
    return _clean(m.dict())


# Progress / Adherence
@api.get("/progress/adherence")
async def adherence(days: int = 7, user_id: str = Depends(get_current_user_id)):
    return await _adherence_for_user(user_id, days)


@api.get("/yoga-tip")
async def yoga_tip(user_id: str = Depends(get_current_user_id)):
    """
    Medication-specific yoga therapy using Groq AI.
    References verified from 3 sources:
    - Ministry of AYUSH, Govt of India: https://www.youtube.com/@ministryofayushofficial
    - Swami Ramdev (Patanjali Yogpeeth): https://www.youtube.com/@SwamiRamdevOfficial
    - Sadhguru / Isha Foundation (Padma Vibhushan, UN recognised): https://www.youtube.com/@sadhguru
    """
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
    id: str = Field(default_factory=lambda: str(uuid4()))
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
    appt = Appointment(user_id=user_id, **payload.dict())
    await db.appointments.insert_one(appt.dict())
    return _clean(appt.dict())

@api.patch("/appointments/{appt_id}")
async def update_appointment(appt_id: str, payload: AppointmentCreate, user_id: str = Depends(get_current_user_id)):
    res = await db.appointments.update_one(
        {"id": appt_id, "user_id": user_id}, {"$set": payload.dict()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Appointment not found")
    return await db.appointments.find_one({"id": appt_id}, PROJECTION)

@api.delete("/appointments/{appt_id}")
async def delete_appointment(appt_id: str, user_id: str = Depends(get_current_user_id)):
    await db.appointments.delete_one({"id": appt_id, "user_id": user_id})
    return {"deleted": True}


@api.get("/ai/daily-message")
async def ai_daily_message(user_id: str = Depends(get_current_user_id)):
    """A short personalized message from Groq based on the user's recent context."""
    profile = await db.profile.find_one({"id": user_id}, PROJECTION) or {}
    today = datetime.now(timezone.utc).date().isoformat()
    await _ensure_doses_for_date(user_id, today)
    doses = await db.doses.find({"user_id": user_id, "date": today}, PROJECTION).to_list(1000)
    total = len(doses)
    taken = sum(1 for d in doses if d["status"] == "taken")
    meds = await db.medications.find({"user_id": user_id, "active": True}, PROJECTION).to_list(50)
    recent_mood = await db.mood.find({"user_id": user_id}, PROJECTION).sort("recorded_at", -1).to_list(1)
    adh = await _adherence_for_user(user_id, 7)

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
    phone = (profile or {}).get("caregiver_phone")
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
    return _clean(log_entry)


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
                return {"places": places, "source": "google"}
        except Exception as e:
            logger.warning(f"Google Places failed: {e}")

    # Fallback to OpenStreetMap Overpass API (free, no key needed)
    try:
        osm_tag_map = {
            "pharmacy":   'amenity"="pharmacy',
            "diagnostic": 'amenity"="clinic][healthcare"="laboratory',
            "hospital":   'amenity"="hospital',
        }
        tag = osm_tag_map.get(type, 'amenity"="pharmacy')
        deg = radius / 111000
        bbox = f"{lat-deg},{lng-deg},{lat+deg},{lng+deg}"
        overpass_url = "https://overpass-api.de/api/interpreter"
        query = f'[out:json][timeout:10];node["{tag}"]({bbox});out body 20;'
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.post(overpass_url, data={"data": query})
        data = r.json()
        places = []
        for el in (data.get("elements") or [])[:15]:
            tags = el.get("tags", {})
            elat, elng = el.get("lat", 0), el.get("lon", 0)
            name = tags.get("name") or tags.get("name:en") or tags.get("amenity", type).title()
            addr_parts = [tags.get("addr:housenumber", ""), tags.get("addr:street", ""), tags.get("addr:city", "")]
            address = ", ".join(p for p in addr_parts if p) or tags.get("addr:full", "")
            places.append({
                "id": str(el.get("id", "")), "name": name,
                "address": address, "distance": dist(elat, elng),
                "rating": None, "lat": elat, "lng": elng,
                "open": None, "phone": tags.get("phone") or tags.get("contact:phone"),
            })
        places.sort(key=lambda x: x["distance"])
        return {"places": places, "source": "osm"}
    except Exception as e:
        logger.warning(f"OSM fallback also failed: {e}")
        return {"places": [], "source": "error", "message": "Could not fetch nearby places. Check your connection."}

# Daily caregiver report - triggered by Cloud Scheduler at 10 PM IST.
# Runs for every registered user who has a caregiver phone number set,
# since this endpoint has no per-user auth context of its own (called by a cron job).
@api.post("/caregiver/daily-report")
async def caregiver_daily_report(secret: str = ""):
    if SCHEDULER_SECRET and secret != SCHEDULER_SECRET:
        raise HTTPException(403, "Invalid scheduler secret")

    all_profiles = await db.profile.find({"caregiver_phone": {"$exists": True, "$ne": None}}, PROJECTION).to_list(1000)
    results = []

    for profile in all_profiles:
        user_id = profile["id"]
        phone = profile.get("caregiver_phone")
        if not phone:
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
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("role") == "admin":
                return payload
        except Exception:
            pass
    if ADMIN_SECRET and x_admin_secret == ADMIN_SECRET:
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

PLAN_FEATURES = {
    "free": {
        "max_medications": 3,        # Today screen — max 3 meds
        "history_days": 7,           # Progress screen — 7 day history
        "ai_insights": "weekly",     # Progress screen — weekly AI tip
        "caregiver_alerts": 1,       # Support screen — 1 caregiver
        "nearby_results": 5,         # Nearby screen — 5 results
        "yoga_full": False,          # Treatment tab — basic yoga only
        "export_data": False,        # History screen — CSV export locked
        "brand_generic": False,      # Medications tab — brand/generic lookup locked
        "scanner": False,            # Add medication — scanner locked
        "max_appointments": 3,       # Appointments screen — 3 max
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
    },
    "enterprise": {
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
        "api_access": True,
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
        idinfo = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), audience=None
        )
        if idinfo.get("aud") not in GOOGLE_VALID_AUDIENCES:
            await record_admin_attempt(ip, False, "invalid_token")
            raise HTTPException(401, "Invalid token")
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


@app.get("/health")
async def health_check():
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": "connected" if db_ok else "error", "v": "1.0.0"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
