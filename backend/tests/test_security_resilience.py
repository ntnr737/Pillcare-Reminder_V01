import os
import sys
import unittest
from pathlib import Path

# Add backend directory to path
backend_dir = str(Path(__file__).parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from pydantic import ValidationError

# Set dummy env vars for import
os.environ.setdefault("JWT_SECRET", "test_jwt_secret_for_hardening_audit_2026")
os.environ.setdefault("ADMIN_SECRET", "PILLCARE_ADMIN_test_secret_32_chars_long")
os.environ.setdefault("SCHEDULER_SECRET", "test_scheduler_secret_2026")

from server import (
    MedicationCreate,
    MedicationUpdate,
    MeasurementCreate,
    ActivityCreate,
    MoodCreate,
    AppointmentCreate,
    AnnouncementCreate,
    CaregiverAlert,
    PaymentOrderRequest,
    PaymentVerifyRequest,
    OFFICIAL_PLAN_PRICES,
    _is_allowed_origin,
    _dates_in_range,
    is_safe_public_ip,
    clamp_pagination,
    sanitize_action_url,
    sanitize_text_content,
    require_admin,
    is_admin_ip_locked,
    record_admin_failure,
    record_admin_success,
)

class SecurityHardeningTests(unittest.TestCase):
    def test_01_medication_update_validation(self):
        # Valid update
        update = MedicationUpdate(name="Aspirin 100mg", dosage=100.0, stock=50)
        self.assertEqual(update.name, "Aspirin 100mg")
        self.assertEqual(update.dosage, 100.0)

        # Out-of-bounds dosage
        with self.assertRaises(ValidationError):
            MedicationUpdate(dosage=-10)

        # Invalid date format
        with self.assertRaises(ValidationError):
            MedicationUpdate(start_date="not-a-date")

        # Name too long
        with self.assertRaises(ValidationError):
            MedicationUpdate(name="A" * 200)

    def test_02_measurement_bounds(self):
        # Valid measurement
        m = MeasurementCreate(type="blood_pressure", value=120.0, value_secondary=80.0, unit="mmHg")
        self.assertEqual(m.value, 120.0)

        # Negative value
        with self.assertRaises(ValidationError):
            MeasurementCreate(type="bp", value=-50.0, unit="mmHg")

        # Massive value
        with self.assertRaises(ValidationError):
            MeasurementCreate(type="bp", value=1e8, unit="mmHg")

    def test_03_activity_water_bounds(self):
        # Valid water log
        a = ActivityCreate(type="water", value=500.0, unit="ml", date="2026-10-21")
        self.assertEqual(a.value, 500.0)

        # Negative water
        with self.assertRaises(ValidationError):
            ActivityCreate(type="water", value=-500.0, unit="ml")

        # Invalid date format
        with self.assertRaises(ValidationError):
            ActivityCreate(type="water", value=250.0, unit="ml", date="21/10/2026")

    def test_04_mood_bounds(self):
        # Valid mood scores (1-5)
        m = MoodCreate(score=4, note="Feeling energetic")
        self.assertEqual(m.score, 4)

        # Out of bounds (< 1)
        with self.assertRaises(ValidationError):
            MoodCreate(score=0)

        # Out of bounds (> 5)
        with self.assertRaises(ValidationError):
            MoodCreate(score=6)

    def test_05_appointment_patterns(self):
        # Valid appointment
        apt = AppointmentCreate(
            doctor_name="Dr. Sharma",
            date="2026-10-25",
            time="14:30"
        )
        self.assertEqual(apt.doctor_name, "Dr. Sharma")

        # Malformed date
        with self.assertRaises(ValidationError):
            AppointmentCreate(doctor_name="Dr. Smith", date="2026-10-25-bad", time="14:30")

        # Malformed time
        with self.assertRaises(ValidationError):
            AppointmentCreate(doctor_name="Dr. Smith", date="2026-10-25", time="2:30 PM")

    def test_06_payment_tampering_defense(self):
        # Verify official prices are authoritative
        self.assertEqual(OFFICIAL_PLAN_PRICES["premium"], 99)
        self.assertEqual(OFFICIAL_PLAN_PRICES["family"], 199)
        self.assertEqual(OFFICIAL_PLAN_PRICES["lifetime"], 999)

        # Valid order request
        req = PaymentOrderRequest(plan="premium", amount_inr=99)
        self.assertEqual(req.plan, "premium")

        # Verify negative amounts are rejected
        with self.assertRaises(ValidationError):
            PaymentOrderRequest(plan="premium", amount_inr=-10)

    def test_07_cors_origin_safelist(self):
        # Allowed official origins
        self.assertTrue(_is_allowed_origin("https://admin.pillcare.in"))
        self.assertTrue(_is_allowed_origin("https://pillcare.in"))
        self.assertTrue(_is_allowed_origin("http://localhost:3000"))
        self.assertTrue(_is_allowed_origin("https://staging.pillcare.in"))
        self.assertTrue(_is_allowed_origin("https://pillcare.nitinrai264.workers.dev"))

        # Blocked malicious/attacker origins
        self.assertFalse(_is_allowed_origin("https://evil-attacker.com"))
        self.assertFalse(_is_allowed_origin("https://attacker-pillcare.in.evil.com"))
        self.assertFalse(_is_allowed_origin("https://pillcare.in.attacker.com"))
        self.assertFalse(_is_allowed_origin("https://fake-workers.dev.phishing.com"))
        self.assertFalse(_is_allowed_origin(""))

    def test_08_dates_in_range_safety(self):
        # Malformed start date falls back to safe dates
        dates = _dates_in_range("invalid-start-date", 5)
        self.assertEqual(len(dates), 5)

        # Extreme days clamped to 365
        dates_clamped = _dates_in_range("2026-10-21", 1000)
        self.assertEqual(len(dates_clamped), 365)

    def test_09_ssrf_ip_filtering(self):
        # Private and loopback IPv4/IPv6 must be blocked
        self.assertFalse(is_safe_public_ip("127.0.0.1"))
        self.assertFalse(is_safe_public_ip("10.0.0.1"))
        self.assertFalse(is_safe_public_ip("192.168.1.1"))
        self.assertFalse(is_safe_public_ip("172.16.0.1"))
        self.assertFalse(is_safe_public_ip("169.254.169.254"))  # Cloud metadata IP
        self.assertFalse(is_safe_public_ip("::1"))
        self.assertFalse(is_safe_public_ip("fe80::1"))
        self.assertFalse(is_safe_public_ip("0.0.0.0"))
        self.assertFalse(is_safe_public_ip("255.255.255.255"))

        # Malformed strings or injection strings must be blocked
        self.assertFalse(is_safe_public_ip("attacker.com"))
        self.assertFalse(is_safe_public_ip("127.0.0.1:8080"))
        self.assertFalse(is_safe_public_ip("http://127.0.0.1"))
        self.assertFalse(is_safe_public_ip(None))
        self.assertFalse(is_safe_public_ip(""))

        # Valid public internet IPs must be accepted
        self.assertTrue(is_safe_public_ip("8.8.8.8"))
        self.assertTrue(is_safe_public_ip("1.1.1.1"))
        self.assertTrue(is_safe_public_ip("103.21.244.1"))

    def test_10_cors_strict_regex(self):
        # Specific allowed worker passes
        self.assertTrue(_is_allowed_origin("https://pillcare.nitinrai264.workers.dev"))
        # Official subdomains pass
        self.assertTrue(_is_allowed_origin("https://admin.pillcare.in"))
        self.assertTrue(_is_allowed_origin("https://api.pillcare.in"))
        self.assertTrue(_is_allowed_origin("https://staging.pillcare.in"))

        # Rogue workers.dev origins MUST be blocked
        self.assertFalse(_is_allowed_origin("https://attacker.workers.dev"))
        self.assertFalse(_is_allowed_origin("https://evil-hacker.workers.dev"))
        self.assertFalse(_is_allowed_origin("https://pillcare.workers.dev"))

    def test_11_pagination_limit_clamping(self):
        # Clamping excessive upper limit
        lim, sk = clamp_pagination(limit=1000000, default=50, max_limit=200, skip=0)
        self.assertEqual(lim, 200)
        self.assertEqual(sk, 0)

        # Clamping negative limit to minimum 1
        lim, sk = clamp_pagination(limit=-50, default=50, max_limit=200, skip=-10)
        self.assertEqual(lim, 1)
        self.assertEqual(sk, 0)

        # Malformed non-numeric values fallback safely
        lim, sk = clamp_pagination(limit="malformed", default=50, max_limit=200, skip="bad")
        self.assertEqual(lim, 50)
        self.assertEqual(sk, 0)

        # Valid in-bounds values preserved
        lim, sk = clamp_pagination(limit=25, default=50, max_limit=200, skip=10)
        self.assertEqual(lim, 25)
        self.assertEqual(sk, 10)

    def test_12_url_and_text_sanitization(self):
        # Dangerous schemes are stripped
        self.assertIsNone(sanitize_action_url("javascript:alert(document.cookie)"))
        self.assertIsNone(sanitize_action_url("data:text/html,<script>alert(1)</script>"))
        self.assertIsNone(sanitize_action_url("vbscript:msgbox(1)"))
        self.assertIsNone(sanitize_action_url(None))

        # Safe schemes are preserved
        self.assertEqual(sanitize_action_url("https://pillcare.in/offers"), "https://pillcare.in/offers")
        self.assertEqual(sanitize_action_url("pillcare://medications/add"), "pillcare://medications/add")
        self.assertEqual(sanitize_action_url("/app-control/control-room"), "/app-control/control-room")

        # HTML / Script tags stripped from text content
        raw_xss = "<script>alert('pwned')</script>Exclusive Offer: Flat 50% Off"
        cleaned = sanitize_text_content(raw_xss)
        self.assertNotIn("<script>", cleaned)
        self.assertEqual(cleaned, "Exclusive Offer: Flat 50% Off")

    def test_13_admin_brute_force_lockout(self):
        attacker_ip = "198.51.100.99"
        # Reset any prior state for test isolation
        record_admin_success(attacker_ip)
        self.assertFalse(is_admin_ip_locked(attacker_ip))

        # Simulate 10 consecutive failed attempts
        for _ in range(10):
            record_admin_failure(attacker_ip)

        # IP must now be locked out
        self.assertTrue(is_admin_ip_locked(attacker_ip))

        # Successful auth clears lockout
        record_admin_success(attacker_ip)
        self.assertFalse(is_admin_ip_locked(attacker_ip))

if __name__ == "__main__":
    unittest.main()
