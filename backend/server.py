from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import csv
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, date, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
OPENWA_ENABLED = os.environ.get("OPENWA_ENABLED", "false").lower() == "true"

app = FastAPI(title="PillCare API")
api = APIRouter(prefix="/api")

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
class Profile(BaseModel):
    id: str = "default"
    nickname: str
    gender: str
    year_of_birth: int
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
    routine_wake: Optional[str] = "07:00"
    routine_breakfast: Optional[str] = "08:00"
    routine_lunch: Optional[str] = "13:00"
    routine_dinner: Optional[str] = "19:00"
    routine_sleep: Optional[str] = "22:00"
    caregiver_phone: Optional[str] = None
    notifications_enabled: Optional[bool] = True


class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    medication_id: str
    date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    status: Literal["pending", "taken", "skipped", "missed"] = "pending"
    taken_at: Optional[datetime] = None


class DoseStatusUpdate(BaseModel):
    status: Literal["pending", "taken", "skipped", "missed"]


class Measurement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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


# ---------- Helpers ----------
PROJECTION = {"_id": 0}


def _clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


def _dates_in_range(start: str, days: int) -> List[str]:
    start_dt = datetime.strptime(start, "%Y-%m-%d").date()
    return [(start_dt + timedelta(days=i)).isoformat() for i in range(days)]


async def _ensure_doses_for_date(target_date: str):
    """Generate dose log entries for all active meds for a given date if missing."""
    meds = await db.medications.find({"active": True}, PROJECTION).to_list(1000)
    for m in meds:
        if m["start_date"] > target_date:
            continue
        if m.get("duration_days"):
            end = (datetime.strptime(m["start_date"], "%Y-%m-%d").date() + timedelta(days=m["duration_days"])).isoformat()
            if target_date > end:
                continue
        for t in m.get("times", []):
            existing = await db.doses.find_one({"medication_id": m["id"], "date": target_date, "scheduled_time": t}, PROJECTION)
            if not existing:
                d = DoseLog(medication_id=m["id"], date=target_date, scheduled_time=t)
                await db.doses.insert_one(d.dict())


# ---------- Routes ----------
@api.get("/")
async def root():
    return {"message": "PillCare API ready"}


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
async def get_profile():
    doc = await db.profile.find_one({"id": "default"}, PROJECTION)
    return doc


@api.post("/profile")
async def upsert_profile(payload: ProfileUpsert):
    existing = await db.profile.find_one({"id": "default"}, PROJECTION)
    if existing:
        update_data = payload.dict()
        await db.profile.update_one({"id": "default"}, {"$set": update_data})
        merged = {**existing, **update_data}
        return merged
    p = Profile(**payload.dict())
    await db.profile.insert_one(p.dict())
    return _clean(p.dict())


# Medications
@api.get("/medications")
async def list_medications(active: Optional[bool] = None):
    q = {}
    if active is not None:
        q["active"] = active
    items = await db.medications.find(q, PROJECTION).to_list(1000)
    return items


@api.post("/medications")
async def create_medication(payload: MedicationCreate):
    # Optionally resolve generic name if not provided
    generic = payload.generic_name
    if not generic and EMERGENT_LLM_KEY:
        try:
            generic = await _resolve_generic(payload.name)
        except Exception as e:
            logger.warning(f"Generic resolution failed: {e}")
    data = payload.dict()
    data["generic_name"] = generic
    med = Medication(**data)
    await db.medications.insert_one(med.dict())
    return _clean(med.dict())


@api.get("/medications/{med_id}")
async def get_medication(med_id: str):
    doc = await db.medications.find_one({"id": med_id}, PROJECTION)
    if not doc:
        raise HTTPException(404, "Medication not found")
    return doc


@api.patch("/medications/{med_id}")
async def update_medication(med_id: str, payload: dict):
    payload.pop("id", None)
    payload.pop("_id", None)
    res = await db.medications.update_one({"id": med_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Medication not found")
    doc = await db.medications.find_one({"id": med_id}, PROJECTION)
    return doc


@api.delete("/medications/{med_id}")
async def delete_medication(med_id: str):
    await db.medications.update_one({"id": med_id}, {"$set": {"active": False}})
    return {"ok": True}


# Doses
@api.get("/doses")
async def list_doses(date_str: str):
    await _ensure_doses_for_date(date_str)
    doses = await db.doses.find({"date": date_str}, PROJECTION).to_list(1000)
    # join with med info
    med_ids = list({d["medication_id"] for d in doses})
    meds = await db.medications.find({"id": {"$in": med_ids}}, PROJECTION).to_list(1000)
    med_map = {m["id"]: m for m in meds}
    enriched = []
    for d in doses:
        m = med_map.get(d["medication_id"])
        if m:
            enriched.append({**d, "medication": m})
    enriched.sort(key=lambda x: x["scheduled_time"])
    return enriched


@api.post("/doses/{dose_id}/status")
async def update_dose_status(dose_id: str, payload: DoseStatusUpdate):
    update = {"status": payload.status}
    if payload.status == "taken":
        update["taken_at"] = datetime.now(timezone.utc)
        # decrement stock
        dose = await db.doses.find_one({"id": dose_id}, PROJECTION)
        if dose:
            await db.medications.update_one(
                {"id": dose["medication_id"]},
                {"$inc": {"stock": -1}},
            )
    res = await db.doses.update_one({"id": dose_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Dose not found")
    doc = await db.doses.find_one({"id": dose_id}, PROJECTION)
    return doc


# Measurements
@api.get("/measurements")
async def list_measurements(type: Optional[str] = None, limit: int = 200):
    q = {}
    if type:
        q["type"] = type
    items = await db.measurements.find(q, PROJECTION).sort("recorded_at", -1).to_list(limit)
    return items


@api.post("/measurements")
async def create_measurement(payload: MeasurementCreate):
    m = Measurement(**payload.dict())
    await db.measurements.insert_one(m.dict())
    return _clean(m.dict())


@api.delete("/measurements/{m_id}")
async def delete_measurement(m_id: str):
    await db.measurements.delete_one({"id": m_id})
    return {"ok": True}


# Activities
@api.get("/activities")
async def list_activities(type: Optional[str] = None, limit: int = 200):
    q = {}
    if type:
        q["type"] = type
    items = await db.activities.find(q, PROJECTION).sort("recorded_at", -1).to_list(limit)
    return items


@api.post("/activities")
async def create_activity(payload: ActivityCreate):
    a = Activity(**payload.dict())
    await db.activities.insert_one(a.dict())
    return _clean(a.dict())


@api.delete("/activities/{a_id}")
async def delete_activity(a_id: str):
    await db.activities.delete_one({"id": a_id})
    return {"ok": True}


# Mood
@api.get("/mood")
async def list_mood(limit: int = 100):
    items = await db.mood.find({}, PROJECTION).sort("recorded_at", -1).to_list(limit)
    return items


@api.post("/mood")
async def create_mood(payload: MoodCreate):
    m = MoodEntry(**payload.dict())
    await db.mood.insert_one(m.dict())
    return _clean(m.dict())


# Progress / Adherence
@api.get("/progress/adherence")
async def adherence(days: int = 7):
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    # ensure doses present for last N days
    for i in range(days):
        await _ensure_doses_for_date((start + timedelta(days=i)).isoformat())
    daily = []
    streak = 0
    streak_ongoing = True
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        doses = await db.doses.find({"date": d}, PROJECTION).to_list(1000)
        total = len(doses)
        taken = sum(1 for x in doses if x["status"] == "taken")
        pct = round((taken / total) * 100) if total else 0
        daily.append({"date": d, "total": total, "taken": taken, "pct": pct})
    # streak walk backwards
    for entry in reversed(daily):
        if entry["total"] > 0 and entry["pct"] >= 80:
            if streak_ongoing:
                streak += 1
        else:
            streak_ongoing = False
    avg = round(sum(d["pct"] for d in daily) / len(daily)) if daily else 0
    return {"daily": daily, "streak": streak, "average": avg}


# Brand -> Generic resolver
async def _resolve_generic(brand: str) -> str:
    if not EMERGENT_LLM_KEY:
        return ""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"generic-{uuid.uuid4()}",
        system_message=(
            "You are a clinical pharmacology assistant. Given a medication brand name, "
            "respond with ONLY the generic (international nonproprietary) name in lowercase. "
            "If unknown, reply 'unknown'. Do not include any other text."
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    resp = await chat.send_message(UserMessage(text=brand.strip()))
    return resp.strip().split("\n")[0][:80]


@api.post("/resolve-generic")
async def resolve_generic(payload: BrandRequest):
    if not payload.brand.strip():
        raise HTTPException(400, "Brand required")
    generic = await _resolve_generic(payload.brand)
    return {"brand": payload.brand, "generic": generic}


# AI Medication Scanner
@api.post("/scan-medication")
async def scan_medication(payload: ScanRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Scanner unavailable")
    if not payload.image_base64:
        raise HTTPException(400, "image_base64 required")
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"scan-{uuid.uuid4()}",
        system_message=(
            "You read a photo of a medication package/blister/pill. Reply STRICTLY as JSON "
            "with keys: name, dosage, unit, confidence. If unreadable, set name to 'unknown'. "
            "Example: {\"name\":\"paracetamol\",\"dosage\":500,\"unit\":\"mg\",\"confidence\":\"high\"}"
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    img = ImageContent(image_base64=payload.image_base64)
    resp = await chat.send_message(UserMessage(text="Identify this medication.", file_contents=[img]))
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


# Caregiver alert (mocked OpenWA)
@api.post("/caregiver/alert")
async def caregiver_alert(payload: CaregiverAlert):
    profile = await db.profile.find_one({"id": "default"}, PROJECTION)
    phone = (profile or {}).get("caregiver_phone")
    log_entry = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "message": payload.message,
        "medication_name": payload.medication_name,
        "delivered_via": "openwa" if OPENWA_ENABLED else "mock",
        "sent_at": datetime.now(timezone.utc),
    }
    await db.caregiver_log.insert_one(log_entry.copy())
    if not OPENWA_ENABLED:
        logger.info(f"[MOCK OpenWA] -> {phone}: {payload.message}")
    return {"ok": True, "delivered_via": log_entry["delivered_via"], "phone": phone}


@api.get("/caregiver/log")
async def caregiver_log(limit: int = 50):
    items = await db.caregiver_log.find({}, PROJECTION).sort("sent_at", -1).to_list(limit)
    return items


# CSV export — lifetime history
@api.get("/export/csv")
async def export_csv():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["section", "timestamp", "type", "value", "unit", "status", "note"])
    doses = await db.doses.find({}, PROJECTION).to_list(10000)
    med_ids = list({d["medication_id"] for d in doses})
    meds = await db.medications.find({"id": {"$in": med_ids}}, PROJECTION).to_list(1000)
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
    for m in await db.measurements.find({}, PROJECTION).to_list(10000):
        w.writerow(["measurement", m["recorded_at"].isoformat() if isinstance(m.get("recorded_at"), datetime) else m.get("recorded_at"), m["type"], m["value"], m["unit"], "", m.get("note", "")])
    for a in await db.activities.find({}, PROJECTION).to_list(10000):
        w.writerow(["activity", a["recorded_at"].isoformat() if isinstance(a.get("recorded_at"), datetime) else a.get("recorded_at"), a["type"], a["value"], a["unit"], "", a.get("note", "")])
    for mo in await db.mood.find({}, PROJECTION).to_list(10000):
        w.writerow(["mood", mo["recorded_at"].isoformat() if isinstance(mo.get("recorded_at"), datetime) else mo.get("recorded_at"), "mood", mo["score"], "1-5", "", mo.get("note", "")])
    csv_bytes = buf.getvalue().encode("utf-8")
    return Response(content=csv_bytes, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=pillcare-history.csv"})


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
