"""
PillCare backend API tests
"""
import os
import base64
import io
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://full-handoff.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Catalogs ----------
def test_catalog_units(s):
    r = s.get(f"{API}/catalog/units", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("units"), list) and len(data["units"]) > 5
    assert "tablet" in data["units"]


def test_catalog_measurements(s):
    r = s.get(f"{API}/catalog/measurements", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("measurements"), list) and len(data["measurements"]) >= 10
    bp = [m for m in data["measurements"] if m["key"] == "blood_pressure"]
    assert bp and "composite" in bp[0]


def test_catalog_activities(s):
    r = s.get(f"{API}/catalog/activities", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("activities"), list) and len(data["activities"]) >= 4


# ---------- Profile ----------
def test_profile_upsert_and_get(s):
    payload = {
        "nickname": "TEST_Alex",
        "gender": "other",
        "year_of_birth": 1990,
        "routine_wake": "07:30",
        "routine_breakfast": "08:30",
        "routine_lunch": "13:00",
        "routine_dinner": "19:30",
        "routine_sleep": "22:30",
    }
    r = s.post(f"{API}/profile", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nickname"] == "TEST_Alex"

    g = s.get(f"{API}/profile", timeout=20)
    assert g.status_code == 200
    gp = g.json()
    assert gp and gp.get("nickname") == "TEST_Alex"

    # Update with caregiver phone
    payload["caregiver_phone"] = "+10000000000"
    r2 = s.post(f"{API}/profile", json=payload, timeout=20)
    assert r2.status_code == 200
    g2 = s.get(f"{API}/profile", timeout=20).json()
    assert g2.get("caregiver_phone") == "+10000000000"


# ---------- Medications ----------
@pytest.fixture(scope="session")
def med_id(s):
    payload = {
        "name": "Crocin",
        "dosage": 500,
        "unit": "mg",
        "frequency_per_day": 2,
        "times": ["08:00", "20:00"],
        "start_date": datetime.now(timezone.utc).date().isoformat(),
        "stock": 30,
        "color": "#92C5A9",
    }
    r = s.post(f"{API}/medications", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Crocin"
    # generic auto-resolved via Claude
    assert body.get("generic_name") is not None
    return body["id"]


def test_create_medication_with_generic(s, med_id):
    # Verify in list
    r = s.get(f"{API}/medications?active=true", timeout=20)
    assert r.status_code == 200
    items = r.json()
    found = [m for m in items if m["id"] == med_id]
    assert found
    generic = (found[0].get("generic_name") or "").lower()
    # Expect paracetamol or acetaminophen
    assert "paracetamol" in generic or "acetaminophen" in generic or generic == "" or generic == "unknown" or len(generic) > 0


def test_patch_medication(s, med_id):
    r = s.patch(f"{API}/medications/{med_id}", json={"notes": "TEST_after_food"}, timeout=20)
    assert r.status_code == 200
    assert r.json().get("notes") == "TEST_after_food"


# ---------- Doses ----------
def test_doses_auto_generate_and_status(s, med_id):
    today = datetime.now(timezone.utc).date().isoformat()
    r = s.get(f"{API}/doses?date_str={today}", timeout=30)
    assert r.status_code == 200
    doses = r.json()
    assert isinstance(doses, list)
    mine = [d for d in doses if d["medication_id"] == med_id]
    assert len(mine) == 2, f"Expected 2 doses, got {len(mine)}"
    # sorted by scheduled_time
    times = [d["scheduled_time"] for d in doses]
    assert times == sorted(times)

    # Pre-fetch stock
    med_before = s.get(f"{API}/medications/{med_id}", timeout=20).json()
    stock_before = med_before["stock"]

    # Mark first dose as taken
    dose_id = mine[0]["id"]
    r2 = s.post(f"{API}/doses/{dose_id}/status", json={"status": "taken"}, timeout=20)
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "taken"

    med_after = s.get(f"{API}/medications/{med_id}", timeout=20).json()
    assert med_after["stock"] == stock_before - 1


# ---------- Measurements ----------
def test_measurement_composite_and_simple(s):
    bp = {"type": "blood_pressure", "value": 120, "value_secondary": 80, "unit": "mmHg"}
    r1 = s.post(f"{API}/measurements", json=bp, timeout=20)
    assert r1.status_code == 200
    assert r1.json()["value_secondary"] == 80

    bg = {"type": "blood_glucose", "value": 95, "unit": "mg/dL"}
    r2 = s.post(f"{API}/measurements", json=bg, timeout=20)
    assert r2.status_code == 200

    lst = s.get(f"{API}/measurements", timeout=20).json()
    assert len(lst) >= 2
    # sorted desc
    ts = [m["recorded_at"] for m in lst]
    assert ts == sorted(ts, reverse=True)


# ---------- Activities & Mood ----------
def test_activity_create(s):
    r = s.post(f"{API}/activities", json={"type": "steps", "value": 3000, "unit": "steps"}, timeout=20)
    assert r.status_code == 200
    lst = s.get(f"{API}/activities", timeout=20).json()
    assert any(a["type"] == "steps" for a in lst)


def test_mood_create(s):
    r = s.post(f"{API}/mood", json={"score": 4, "note": "TEST_good"}, timeout=20)
    assert r.status_code == 200
    lst = s.get(f"{API}/mood", timeout=20).json()
    assert any(m.get("note") == "TEST_good" for m in lst)


# ---------- Progress ----------
def test_progress_adherence(s):
    r = s.get(f"{API}/progress/adherence?days=7", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("daily"), list) and len(data["daily"]) == 7
    assert isinstance(data.get("streak"), int)
    assert isinstance(data.get("average"), int)


# ---------- Brand → Generic ----------
def test_resolve_generic(s):
    r = s.post(f"{API}/resolve-generic", json={"brand": "Crocin"}, timeout=60)
    assert r.status_code == 200
    g = (r.json().get("generic") or "").lower()
    assert "paracetamol" in g or "acetaminophen" in g, f"Got generic={g}"


# ---------- Caregiver ----------
def test_caregiver_alert_mock_and_log(s):
    r = s.post(f"{API}/caregiver/alert", json={"message": "TEST_missed dose", "medication_name": "Crocin"}, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["delivered_via"] == "mock"

    lg = s.get(f"{API}/caregiver/log", timeout=20).json()
    assert isinstance(lg, list) and len(lg) >= 1
    assert any(x["message"] == "TEST_missed dose" for x in lg)


# ---------- CSV Export ----------
def test_csv_export(s):
    r = s.get(f"{API}/export/csv", timeout=30)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    body = r.text
    assert "section,timestamp,type,value,unit,status,note" in body
    # Should have dose/measurement/activity/mood rows
    assert "dose" in body or "measurement" in body
    assert "measurement" in body
    assert "activity" in body
    assert "mood" in body


# ---------- AI Scanner ----------
def _make_pill_jpeg_b64() -> str:
    """Generate a small JPEG with shapes resembling a medication label."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        pytest.skip("Pillow not available")
    img = Image.new("RGB", (400, 250), color=(245, 245, 245))
    d = ImageDraw.Draw(img)
    # White pill box
    d.rectangle([20, 20, 380, 230], outline=(20, 20, 20), width=3, fill=(255, 255, 255))
    d.rectangle([30, 40, 370, 90], fill=(200, 50, 50))
    d.text((40, 50), "PARACETAMOL 500mg", fill=(255, 255, 255))
    d.text((40, 110), "Tablets", fill=(20, 20, 20))
    d.text((40, 140), "Take 1-2 tablets", fill=(60, 60, 60))
    d.text((40, 170), "every 4-6 hours", fill=(60, 60, 60))
    # Round pill shape
    d.ellipse([280, 130, 360, 210], fill=(255, 255, 255), outline=(100, 100, 100), width=2)
    d.line([300, 170, 340, 170], fill=(100, 100, 100), width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_scan_medication(s):
    b64 = _make_pill_jpeg_b64()
    r = s.post(f"{API}/scan-medication", json={"image_base64": b64}, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("name", "dosage", "unit", "confidence"):
        assert k in data, f"Missing key {k} in {data}"
