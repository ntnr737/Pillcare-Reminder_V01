import pytest
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import jwt as pyjwt

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient
import mongomock_motor
import server
from server import app, OFFICIAL_PLAN_PRICES, PLAN_FEATURES, VALID_PROMO_CODES, JWT_SECRET, JWT_ALGORITHM

@pytest.fixture(autouse=True)
def setup_mock_db():
    server.db = mongomock_motor.AsyncMongoMockClient()["pillcare_test_db"]
    server.TEST_DEMO_ENABLED = True

def get_admin_headers():
    server.ADMIN_SECRET = "super_admin_secret_for_tests_12345"
    secret_key = server.JWT_SECRET if (server.JWT_SECRET and len(server.JWT_SECRET) > 0) else "test_jwt_secret_key_1234567890123456"
    server.JWT_SECRET = secret_key
    admin_token = pyjwt.encode(
        {"sub": "admin_test", "role": "admin", "is_admin": True, "purpose": "admin_session", "exp": datetime.now(timezone.utc) + timedelta(hours=2)},
        secret_key,
        algorithm=server.JWT_ALGORITHM
    )
    return {"Authorization": f"Bearer {admin_token}", "x-admin-secret": server.ADMIN_SECRET}

def test_create_payment_order_authoritative_pricing():
    client = TestClient(app)
    # 1. Test Caregiver Shield order (₹149)
    resp = client.post("/payments/create-order", json={"plan": "caregiver_shield"}, headers={"Authorization": "Bearer demo_token_earning_user"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["order_id"].startswith("order_")
    assert data["amount"] == 14900  # in paisa
    assert data["amount_inr"] == 149
    assert data["plan"] == "caregiver_shield"
    assert data["currency"] == "INR"

    # 2. Test Family Annual order (₹999)
    resp2 = client.post("/payments/create-order", json={"plan": "family_annual"}, headers={"Authorization": "Bearer demo_token_earning_user"})
    assert resp2.status_code == 200
    assert resp2.json()["amount_inr"] == 999

    # 3. Test invalid plan rejection
    resp_invalid = client.post("/payments/create-order", json={"plan": "super_mega_free"}, headers={"Authorization": "Bearer demo_token_earning_user"})
    assert resp_invalid.status_code == 400

def test_verify_payment_and_unlock_features():
    client = TestClient(app)
    order_resp = client.post("/payments/create-order", json={"plan": "caregiver_shield"}, headers={"Authorization": "Bearer demo_token_user_1"})
    order_id = order_resp.json()["order_id"]
    payment_id = f"pay_test_{uuid.uuid4().hex[:10]}"

    # Verify payment
    verify_resp = client.post("/payments/verify", json={
        "order_id": order_id,
        "payment_id": payment_id,
        "plan": "caregiver_shield",
        "signature": "SANDBOX_VERIFIED"
    }, headers={"Authorization": "Bearer demo_token_user_1"})
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["success"] is True
    assert v_data["plan"] == "caregiver_shield"
    assert "transaction_id" in v_data
    features = v_data["features"]
    assert features["max_medications"] == 999
    assert features["caregiver_alerts"] == 999
    assert features["scanner"] is True
    assert features["export_data"] is True
    assert features["yoga_full"] is True

def test_promo_code_redemption():
    client = TestClient(app)
    # Redeem valid promo code
    resp = client.post("/me/upgrade", json={
        "promo_code": "VIP2026"
    }, headers={"Authorization": "Bearer demo_token_promo_user"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["plan"] == "caregiver_shield"

    # Reject invalid promo code without checkout
    resp_bad = client.post("/me/upgrade", json={
        "promo_code": "INVALID_CODE_XYZ"
    }, headers={"Authorization": "Bearer demo_token_promo_user_2"})
    assert resp_bad.status_code == 400

def test_medication_limit_free_vs_paid():
    client = TestClient(app)
    user_header = {"Authorization": "Bearer demo_token_limit_tester"}

    # Seed 3 active medications
    for i in range(1, 4):
        med_resp = client.post("/api/medications", json={
            "name": f"Medicine {i}",
            "dosage": "1",
            "unit": "tablet",
            "freq": "1",
            "times": ["08:00"],
            "start_date": "2026-10-23",
            "stock": 30
        }, headers=user_header)
        assert med_resp.status_code == 200

    # Attempt to add 4th medication on Free plan -> Expect 402 Payment Required
    med_4 = client.post("/api/medications", json={
        "name": "Medicine 4 (Exceeds Limit)",
        "dosage": "1",
        "unit": "tablet",
        "freq": "1",
        "times": ["12:00"],
        "start_date": "2026-10-23",
        "stock": 30
    }, headers=user_header)
    assert med_4.status_code == 402

    # Upgrade to Caregiver Shield via in-app payment
    order_resp = client.post("/payments/create-order", json={"plan": "caregiver_shield"}, headers=user_header)
    client.post("/payments/verify", json={
        "order_id": order_resp.json()["order_id"],
        "payment_id": "pay_test_limit_upgrade",
        "plan": "caregiver_shield",
        "signature": "SANDBOX_VERIFIED"
    }, headers=user_header)

    # 4th medication now succeeds
    med_4_paid = client.post("/api/medications", json={
        "name": "Medicine 4 (Now Allowed)",
        "dosage": "1",
        "unit": "tablet",
        "freq": "1",
        "times": ["12:00"],
        "start_date": "2026-10-23",
        "stock": 30
    }, headers=user_header)
    assert med_4_paid.status_code == 200

def test_admin_revenue_and_refund_lifecycle():
    client = TestClient(app)
    admin_header = get_admin_headers()
    user_header = {"Authorization": "Bearer demo_token_refund_user"}

    # 1. User buys Caregiver Shield
    order_resp = client.post("/payments/create-order", json={"plan": "caregiver_shield"}, headers=user_header)
    order_id = order_resp.json()["order_id"]
    payment_id = f"pay_upi_{uuid.uuid4().hex[:8]}"
    verify_resp = client.post("/payments/verify", json={
        "order_id": order_id,
        "payment_id": payment_id,
        "plan": "caregiver_shield",
        "signature": "SANDBOX_VERIFIED"
    }, headers=user_header)
    txn_id = verify_resp.json()["transaction_id"]

    # 2. Query admin revenue
    rev_resp = client.get("/admin/revenue", headers=admin_header)
    assert rev_resp.status_code == 200
    rev_data = rev_resp.json()
    # Check that transaction appears in transactions list
    txn_ids = [t["id"] for t in rev_data["transactions"]]
    assert txn_id in txn_ids

    # 3. Admin refunds the transaction
    ref_resp = client.post("/admin/finance/refund", json={
        "txn_id": txn_id,
        "reason": "Test refund execution"
    }, headers=admin_header)
    assert ref_resp.status_code == 200

    # 4. Confirm transaction status is now Refunded
    rev_resp_after = client.get("/admin/revenue", headers=admin_header)
    matching_txn = next(t for t in rev_resp_after.json()["transactions"] if t["id"] == txn_id)
    assert matching_txn["status"] == "Refunded"
