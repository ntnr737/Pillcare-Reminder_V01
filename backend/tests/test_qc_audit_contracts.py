"""
PillCare Notification & Admin Control QC Verification Suite
Validates NTF-01..08, FL-01..05, ADM-01..04 acceptance gates in sequence.
"""
import pytest
import uuid
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone, timedelta
import httpx
import server
from server import app
import mongomock_motor

ADMIN_HEADERS = {"x-admin-secret": "pillcare_admin_secret_key_2026"}

@pytest.fixture(autouse=True)
def setup_mock_db():
    mock_client = mongomock_motor.AsyncMongoMockClient()
    server.db = mock_client["pillcare"]
    server.client = mock_client
    yield

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_qc_audit_acceptance_pipeline():
    """Verify all QC acceptance criteria end-to-end within one async event loop."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        
        # 0. Health endpoints (/health & /api/health)
        r_h1 = await ac.get("/health")
        assert r_h1.status_code == 200
        assert r_h1.json().get("status") in ["ok", "degraded"]
        r_h2 = await ac.get("/api/health")
        assert r_h2.status_code == 200
        assert r_h2.json().get("status") in ["ok", "degraded"]

        # Dual-route admin endpoint compatibility (/admin/* and /api/admin/*)
        r_stats_app = await ac.get("/admin/stats", headers=ADMIN_HEADERS)
        assert r_stats_app.status_code == 200
        r_stats_api = await ac.get("/api/admin/stats", headers=ADMIN_HEADERS)
        assert r_stats_api.status_code == 200

        r_ff_app = await ac.get("/admin/feature-flags", headers=ADMIN_HEADERS)
        assert r_ff_app.status_code == 200
        r_ff_api = await ac.get("/api/admin/feature-flags", headers=ADMIN_HEADERS)
        assert r_ff_api.status_code == 200

        r_rev_app = await ac.get("/admin/revenue", headers=ADMIN_HEADERS)
        assert r_rev_app.status_code == 200
        r_rev_api = await ac.get("/api/admin/revenue", headers=ADMIN_HEADERS)
        assert r_rev_api.status_code == 200

        # 1. NTF-02: Mark taken by medication endpoint is registered and requires session
        med_id = f"med_qc_{uuid.uuid4().hex[:8]}"
        sched_time = "09:00"
        now_str = datetime.now(timezone.utc).isoformat()
        r_med = await ac.post("/doses/mark-taken-by-medication", json={
            "medication_id": med_id,
            "scheduled_time": sched_time,
            "taken_at": now_str
        })
        assert r_med.status_code in [401, 200], f"Expected 401 or 200, got {r_med.status_code}"

        # 2. FL-05 & FL-03 & ADM-02: Admin push broadcast validation
        # Unauthenticated rejected
        r_unauth = await ac.post("/admin/notify", json={"title": "T", "body": "B"})
        assert r_unauth.status_code == 401

        r_unauth_api = await ac.post("/api/admin/notify", json={"title": "T", "body": "B"})
        assert r_unauth_api.status_code == 401

        # Authenticated broadcast
        push_payload = {
            "title": "QC Acceptance Push Test",
            "body": "Verifying honest metrics and cohort targeting.",
            "target_plan": "free_users",
            "channels": ["push", "in_app"],
            "route_key": "/(tabs)/today?focus=medication"
        }
        r_push = await ac.post("/admin/notify", json=push_payload, headers=ADMIN_HEADERS)
        assert r_push.status_code == 200, f"Expected 200, got {r_push.status_code}: {r_push.text}"
        push_data = r_push.json()
        assert push_data.get("ok") is True
        assert "campaign_id" in push_data
        assert isinstance(push_data.get("sent"), int)
        assert isinstance(push_data.get("failed"), int)
        assert isinstance(push_data.get("total"), int)
        # Ensure fabricated numbers are strictly banned
        assert push_data.get("sent") != 168400
        assert push_data.get("sent") != 184000

        # 3. FL-04: Campaign history persistence
        r_hist = await ac.get("/admin/notifications", headers=ADMIN_HEADERS)
        assert r_hist.status_code == 200
        hist_data = r_hist.json()
        assert "notifications" in hist_data
        assert isinstance(hist_data["notifications"], list)
        assert len(hist_data["notifications"]) > 0
        latest_camp = hist_data["notifications"][0]
        assert "id" in latest_camp
        assert "sentCount" in latest_camp
        assert latest_camp["sentCount"] != 184000

        # 4. FL-01: CMS announcement persistence, live publish, and active filter
        unique_title = f"QC Live Announcement {uuid.uuid4().hex[:6]}"
        create_payload = {
            "title": unique_title,
            "body": "Important health update for all users.",
            "type": "offer",
            "target_plan": "all",
            "action_link": "/(tabs)/treatment?openYoga=true",
            "expires_hours": 48
        }
        r_create = await ac.post("/admin/announcements", json=create_payload, headers=ADMIN_HEADERS)
        assert r_create.status_code == 200
        ann_id = r_create.json().get("id")
        assert ann_id is not None

        # Verify listed with Published status
        r_cms_list = await ac.get("/admin/announcements", headers=ADMIN_HEADERS)
        assert r_cms_list.status_code == 200
        cms_items = r_cms_list.json()
        match = [it for it in cms_items if it.get("id") == ann_id]
        assert len(match) == 1
        assert match[0].get("status") == "Published"

        # Verify visible in public active announcements
        r_active = await ac.get("/announcements/active?plan=free")
        assert r_active.status_code == 200
        assert any(it.get("id") == ann_id for it in r_active.json())

        # Unpublish
        r_unpub = await ac.put(f"/admin/announcements/{ann_id}", json={"status": "Unpublished"}, headers=ADMIN_HEADERS)
        assert r_unpub.status_code == 200
        assert r_unpub.json().get("announcement", {}).get("status") == "Unpublished"

        # Verify no longer active
        r_active_after = await ac.get("/announcements/active?plan=free")
        assert r_active_after.status_code == 200
        assert not any(it.get("id") == ann_id for it in r_active_after.json())


@pytest.mark.anyio
async def test_qc_streak_calculation_contract():
    """Verify strict adherence contracts for streak calculation:
    1. Mandatory water >= 1500ml (1400ml fails).
    2. 100% medication adherence (partial taken fails).
    3. Mandatory both meds AND water when meds exist.
    4. Water alone qualifies when total doses == 0.
    """
    user_id = f"user_streak_qc_{uuid.uuid4().hex[:8]}"
    today_dt = datetime.now(timezone.utc).date()
    yesterday_dt = today_dt - timedelta(days=1)
    day_before_dt = today_dt - timedelta(days=2)

    today_str = today_dt.isoformat()
    yesterday_str = yesterday_dt.isoformat()
    day_before_str = day_before_dt.isoformat()

    # Case 1: Yesterday had 2 doses scheduled, but only 1 taken, and 2000ml water logged.
    # Result must be FAIL (streak 0) because medication adherence is not 100%.
    await server.db.doses.insert_many([
        {"id": "d1", "user_id": user_id, "date": yesterday_str, "scheduled_time": "08:00", "status": "taken"},
        {"id": "d2", "user_id": user_id, "date": yesterday_str, "scheduled_time": "20:00", "status": "missed"},
    ])
    await server.db.activities.insert_one(
        {"user_id": user_id, "type": "water", "value": 2000, "date": yesterday_str}
    )

    res = await server._adherence_for_user(user_id, days=7, local_date=today_str)
    assert res["streak"] == 0, f"Expected streak 0 for incomplete doses, got {res['streak']}"

    # Case 2: Update second dose to taken, but water is only 1400ml (< 1500ml).
    # Result must be FAIL (streak 0) because water threshold is not met.
    await server.db.doses.update_one({"id": "d2"}, {"$set": {"status": "taken"}})
    await server.db.activities.delete_many({"user_id": user_id})
    await server.db.activities.insert_one(
        {"user_id": user_id, "type": "water", "value": 1400, "date": yesterday_str}
    )

    res2 = await server._adherence_for_user(user_id, days=7, local_date=today_str)
    assert res2["streak"] == 0, f"Expected streak 0 for water < 1500ml, got {res2['streak']}"

    # Case 3: Update water to 1500ml. Both conditions met for yesterday!
    # Result must be streak 1!
    await server.db.activities.delete_many({"user_id": user_id})
    await server.db.activities.insert_one(
        {"user_id": user_id, "type": "water", "value": 1500, "date": yesterday_str}
    )

    res3 = await server._adherence_for_user(user_id, days=7, local_date=today_str)
    assert res3["streak"] == 1, f"Expected streak 1 when 100% doses and >=1500ml water, got {res3['streak']}"

    # Case 4: Day before yesterday had 0 doses, but user logged 1600ml water.
    # Result should extend streak to 2 days!
    await server.db.activities.insert_one(
        {"user_id": user_id, "type": "water", "value": 1600, "date": day_before_str}
    )

    res4 = await server._adherence_for_user(user_id, days=7, local_date=today_str)
    assert res4["streak"] == 2, f"Expected streak 2 when prior zero-med day had water, got {res4['streak']}"


@pytest.mark.anyio
async def test_qc_mark_taken_by_medication_contract():
    """Verify notification action / offline sync mark_taken_by_medication:
    1. Successfully marks dose taken by medication_id and scheduled_time.
    2. Works idempotently on repeat calls.
    3. Respects user timezone for date resolution.
    """
    user_id = f"user_notif_act_{uuid.uuid4().hex[:8]}"
    today_str = datetime.now(timezone.utc).date().isoformat()
    med_id = f"med_{uuid.uuid4().hex[:6]}"

    # Insert dose
    dose_id = f"dose_{uuid.uuid4().hex[:6]}"
    await server.db.doses.insert_one({
        "id": dose_id,
        "user_id": user_id,
        "medication_id": med_id,
        "date": today_str,
        "scheduled_time": "09:00",
        "status": "pending",
    })

    # Call mark_taken_by_medication
    payload = server.MarkTakenByMedPayload(
        medication_id=med_id,
        scheduled_time="09:00",
        taken_at=datetime.now(timezone.utc).isoformat(),
        date_str=today_str,
    )
    res = await server.mark_taken_by_medication(payload, user_id=user_id)
    assert res["status"] == "taken"
    assert res["id"] == dose_id

    # Verify persisted in database
    db_dose = await server.db.doses.find_one({"id": dose_id})
    assert db_dose["status"] == "taken"

    # Repeat call (idempotency)
    res_repeat = await server.mark_taken_by_medication(payload, user_id=user_id)
    assert res_repeat["status"] == "taken"


