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
