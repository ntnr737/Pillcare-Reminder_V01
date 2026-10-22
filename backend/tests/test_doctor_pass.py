import pytest
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient
import mongomock_motor
import server
from server import app

@pytest.fixture(autouse=True)
def setup_mock_db():
    server.db = mongomock_motor.AsyncMongoMockClient()["pillcare_test_db"]
    server.TEST_DEMO_ENABLED = True

def test_doctor_pass_endpoint_html_render():
    client = TestClient(app)
    response = client.get("/export/doctor-pass", headers={"Authorization": "Bearer demo_token_doctor_pass_test"})
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    text = response.text
    assert "PILLCARE CLINICAL HEALTH PASS" in text
    assert "CONFIDENTIAL CLINICAL DOCUMENT" in text
    assert "Physician Clinical Notes" in text
    assert "Doctor's Signature" in text
    assert "Current Prescriptions" in text

def test_doctor_pass_query_token_render():
    client = TestClient(app)
    response = client.get("/export/doctor-pass?token=demo_token_doctor_pass_test")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    text = response.text
    assert "PILLCARE CLINICAL HEALTH PASS" in text

def test_doctor_pass_xss_sanitization():
    # Verify that raw script tags or HTML injections in medication/profile are strictly sanitized
    client = TestClient(app)
    # Inject malicious profile name
    import asyncio
    async def seed_malicious_user():
        await server.db.profile.update_one(
            {"user_id": "demo_user"},
            {"$set": {"nickname": "<script>alert('xss_exploit')</script>", "caregiver_phone": "<img src=x onerror=alert(1)>"}},
            upsert=True
        )
        await server.db.medications.insert_one({
            "id": "med_xss_test",
            "user_id": "demo_user",
            "name": "<script>evil()</script>Amoxicillin",
            "generic_name": "<b>Injected</b>",
            "instructions": "<svg/onload=alert('vuln')>",
            "dosage": "500",
            "unit": "mg",
            "active": True
        })
    asyncio.run(seed_malicious_user())

    response = client.get("/export/doctor-pass", headers={"Authorization": "Bearer demo_token_doctor_pass_test"})
    assert response.status_code == 200
    text = response.text
    # Raw unescaped dangerous tags MUST NOT exist in HTML output
    assert "<script>alert('xss_exploit')</script>" not in text
    assert "&lt;script&gt;alert(&#x27;xss_exploit&#x27;)&lt;/script&gt;" in text or "&lt;script&gt;" in text
    assert "<svg/onload=alert('vuln')>" not in text
    assert "<img src=x onerror=alert(1)>" not in text

