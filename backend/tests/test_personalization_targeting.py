import os
import sys
import unittest
from pathlib import Path

# Add backend directory to path
backend_dir = str(Path(__file__).parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set dummy env vars for import
os.environ.setdefault("JWT_SECRET", "test_jwt_secret_for_hardening_audit_2026")
os.environ.setdefault("ADMIN_SECRET", "PILLCARE_ADMIN_test_secret_32_chars_long")
os.environ.setdefault("SCHEDULER_SECRET", "test_scheduler_secret_2026")

from server import render_notification_template, Profile, ProfileUpsert, AnnouncementCreate, _user_doc_score

class PersonalizationAndTargetingTests(unittest.TestCase):
    def test_00_user_scoring_priority(self):
        real_user = {"user_id": "google_123", "email": "user@example.com", "name": "Subham"}
        stale_guest = {"user_id": "guest_abc", "name": "PillCare Guest", "nickname": "PillCare Guest"}
        empty_doc = {"user_id": None}
        self.assertGreater(_user_doc_score(real_user), _user_doc_score(stale_guest))
        self.assertGreater(_user_doc_score(stale_guest), _user_doc_score(empty_doc))
        self.assertEqual(_user_doc_score(real_user), 35)
    def test_01_first_name_extraction(self):
        # Multi-word name
        user = {"name": "rahul sharma", "nickname": "rahul"}
        result = render_notification_template("Good morning, {First_name}!", user)
        self.assertEqual(result, "Good morning, Rahul!")

        # Single word name
        user2 = {"name": "Priya"}
        result2 = render_notification_template("Hello {first_name}!", user2)
        self.assertEqual(result2, "Hello Priya!")

        # Fallback when name is empty
        user3 = {}
        result3 = render_notification_template("Welcome, {First_name}!", user3)
        self.assertEqual(result3, "Welcome, Friend!")

        # Generic name hygiene: PillCare User, PillCare Guest, Guest, YOU must cleanly fall back to Friend
        for generic in ["PillCare User", "PillCare Guest", "Pillcare", "Guest", "YOU", "User", "anonymous"]:
            res = render_notification_template("Hello, {First_name}!", {"name": generic})
            self.assertEqual(res, "Hello, Friend!", f"Failed for generic name: {generic}")
            res2 = render_notification_template("Hello, {FirstName}!", {"nickname": generic})
            self.assertEqual(res2, "Hello, Friend!", f"Failed for generic nickname: {generic}")

    def test_02_all_personalization_tags(self):
        user = {
            "name": "Amitabh Bachchan",
            "nickname": "Amitabh",
            "streak": 14,
            "location_city": "Mumbai",
            "location_country": "India",
            "country_code": "IN"
        }
        template = "Hi {First_name}! Congrats on your {Streak_Days}-day streak in {City}, {Country} with {App_Name}!"
        result = render_notification_template(template, user)
        self.assertEqual(result, "Hi Amitabh! Congrats on your 14-day streak in Mumbai, India with PillCare!")

    def test_03_double_bracket_and_case_variants(self):
        user = {"name": "Sarah Connor", "streak_days": 21, "city": "Los Angeles", "country": "USA"}
        template = "Hey {{first_name}}, streak: {{streak}}, city: {{city}}, country: {{country}}!"
        result = render_notification_template(template, user)
        self.assertEqual(result, "Hey Sarah, streak: 21, city: Los Angeles, country: USA!")

    def test_04_full_name_tag(self):
        user = {"name": "Dr. APJ Abdul Kalam"}
        result = render_notification_template("Account: {Full_Name}", user)
        self.assertEqual(result, "Account: Dr. APJ Abdul Kalam")

    def test_05_profile_schema_has_country_fields(self):
        p = Profile(
            id="user_123",
            nickname="Nitin",
            gender="male",
            year_of_birth=1995,
            location_country="India",
            country_code="IN"
        )
        self.assertEqual(p.country_code, "IN")
        self.assertEqual(p.location_country, "India")

        pu = ProfileUpsert(
            nickname="Nitin",
            location_country="United States",
            country_code="US"
        )
        self.assertEqual(pu.country_code, "US")
        self.assertEqual(pu.location_country, "United States")

    def test_06_announcement_schema_has_country_targeting(self):
        ann = AnnouncementCreate(
            title="Happy Diwali, {First_name}!",
            body="May your health and peace shine bright.",
            target_country="IN"
        )
        self.assertEqual(ann.target_country, "IN")
        self.assertIn("{First_name}", ann.title)

if __name__ == "__main__":
    unittest.main()
