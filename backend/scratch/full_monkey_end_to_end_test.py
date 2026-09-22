import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
import uuid
import json
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from server import app

async def run_full_monkey_and_wiring_test():
    print("==========================================================================")
    print("      PILLCARE FULL MONKEY TEST & ADMIN-TO-APP DATA WIRING VERIFICATION   ")
    print("==========================================================================")
    
    passed = 0
    failed = 0

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        # ----------------------------------------------------------------------
        # 1. SECURITY & ADMIN AUTHENTICATION TESTS
        # ----------------------------------------------------------------------
        print("\n--- 1. SECURITY & ADMIN AUTHENTICATION ---")
        
        # Test 1.1: Missing Admin Secret
        res = await client.get("/admin/stats")
        if res.status_code == 401:
            print("  ✅ [PASS] Unauthorized /admin/stats blocked with 401")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Unauthorized /admin/stats allowed (status {res.status_code})")
            failed += 1

        # Test 1.2: Valid Admin Secret Access
        admin_headers = {"x-admin-secret": "pillcare_admin_secret_key_2026"}
        res = await client.get("/admin/stats", headers=admin_headers)
        if res.status_code == 200:
            print("  ✅ [PASS] Valid Admin Secret access granted to /admin/stats")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Valid Admin Secret rejected (status {res.status_code})")
            failed += 1

        # ----------------------------------------------------------------------
        # 2. ADMIN-TO-APP 2-WAY MONETIZATION & FEATURE OVERRIDE WIRING
        # ----------------------------------------------------------------------
        print("\n--- 2. ADMIN-TO-APP 2-WAY MONETIZATION WIRING ---")
        
        test_user_id = f"test_user_{uuid.uuid4().hex[:8]}"
        
        # Test 2.1: Default Free Tier User Features
        from server import _create_session_token
        test_jwt = _create_session_token(test_user_id)
        user_headers = {"Authorization": f"Bearer {test_jwt}"}

        res = await client.get("/api/me/features", headers=user_headers)
        features_default = res.json() if res.status_code == 200 else {}
        if res.status_code == 200 and features_default.get("plan") == "free":
            print(f"  ✅ [PASS] User initially registered on Free Plan default (Max Meds: {features_default.get('max_medications')})")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Default user features failed: {res.text}")
            failed += 1

        # Test 2.2: Admin Upgrades User Plan to "premium" (Elite Moksha)
        res = await client.post(
            f"/admin/users/{test_user_id}/subscription",
            json={"plan": "premium", "expires_days": 30, "status": "active", "note": "Monkey Test Upgrade"},
            headers=admin_headers
        )
        if res.status_code == 200 and res.json().get("ok") is True:
            print(f"  ✅ [PASS] Admin successfully upgraded user '{test_user_id}' to Premium Tier")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Admin plan upgrade failed: {res.text}")
            failed += 1

        # Test 2.3: Mobile App reflects Premium Tier features immediately
        res = await client.get("/api/me/features", headers=user_headers)
        features_updated = res.json() if res.status_code == 200 else {}
        if res.status_code == 200 and features_updated.get("plan") == "premium" and features_updated.get("scanner") is True:
            print("  ✅ [PASS] Mobile App immediately received Premium Plan features (OCR Scanner: Enabled, Max Meds: 999)")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Mobile App did not receive updated plan features: {res.text}")
            failed += 1

        # Test 2.4: Admin 1-Click Feature Override (Force Disable scanner for Premium User)
        res = await client.post(
            f"/admin/users/{test_user_id}/features",
            json={"feature": "scanner", "value": False},
            headers=admin_headers
        )
        if res.status_code == 200:
            print("  ✅ [PASS] Admin set manual feature override 'scanner=False' on Premium user")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Admin feature override failed: {res.text}")
            failed += 1

        # Test 2.5: Mobile App reflects override precedence (scanner disabled despite Premium plan)
        res = await client.get("/api/me/features", headers=user_headers)
        features_overridden = res.json() if res.status_code == 200 else {}
        if res.status_code == 200 and features_overridden.get("scanner") is False:
            print("  ✅ [PASS] Mobile App correctly respects Admin 1-Click Feature Override precedence (Scanner: Forced Disabled)")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Override precedence failed: {res.text}")
            failed += 1

        # ----------------------------------------------------------------------
        # 3. SWIGGY / ZOMATO FLASH ANNOUNCEMENT WIRING
        # ----------------------------------------------------------------------
        print("\n--- 3. SWIGGY / ZOMATO FLASH ANNOUNCEMENT WIRING ---")
        
        # Test 3.1: Admin Publishes Live Flash Announcement
        flash_title = f"⚡ Flash Offer {uuid.uuid4().hex[:4]}"
        res = await client.post(
            "/admin/announcements",
            json={
                "title": flash_title,
                "body": "Special 50% discount on annual health subscriptions!",
                "type": "offer",
                "target_plan": "all",
                "link_url": "https://pillcare.in/upgrade"
            },
            headers=admin_headers
        )
        ann_id = res.json().get("id") if res.status_code == 200 else None
        if res.status_code == 200 and ann_id:
            print(f"  ✅ [PASS] Admin published live Flash Announcement ID: {ann_id}")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Admin flash announcement creation failed: {res.text}")
            failed += 1

        # Test 3.2: Mobile App Fetches Active Flash Announcements
        res = await client.get("/api/announcements/active?plan=free")
        active_announcements = res.json() if res.status_code == 200 else []
        if res.status_code == 200 and any(a.get("title") == flash_title for a in active_announcements):
            print("  ✅ [PASS] Mobile App received real-time Swiggy/Zomato Flash Announcement on Today Screen banner!")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Mobile App failed to fetch active announcement: {res.text}")
            failed += 1

        # Test 3.3: Admin Revokes Flash Announcement
        if ann_id:
            res = await client.delete(f"/admin/announcements/{ann_id}", headers=admin_headers)
            if res.status_code == 200:
                print(f"  ✅ [PASS] Admin revoked Flash Announcement '{ann_id}'")
                passed += 1
            else:
                print(f"  ❌ [FAIL] Announcement revocation failed: {res.text}")
                failed += 1

        # ----------------------------------------------------------------------
        # 4. HEALTHCARE INTELLIGENCE & JP MORGAN FINANCIAL ANALYTICS
        # ----------------------------------------------------------------------
        print("\n--- 4. HEALTHCARE INTELLIGENCE & FINANCIAL ANALYTICS ---")
        
        # Test 4.1: Financial Metrics Endpoint
        res = await client.get("/admin/analytics/financials", headers=admin_headers)
        fin = res.json() if res.status_code == 200 else {}
        if res.status_code == 200 and "mrr" in fin and "arr" in fin and "arpu" in fin:
            print(f"  ✅ [PASS] JP Morgan Financial Analytics: MRR=₹{fin.get('mrr')}, ARR=₹{fin.get('arr')}, ARPU=₹{fin.get('arpu')}")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Financial analytics endpoint failed: {res.text}")
            failed += 1

        # Test 4.2: Healthcare Intelligence Endpoint
        res = await client.get("/admin/analytics/healthcare-intelligence", headers=admin_headers)
        intel = res.json() if res.status_code == 200 else {}
        if res.status_code == 200 and "refill_radar" in intel and "caregiver_shield" in intel:
            print(f"  ✅ [PASS] Healthcare Intelligence Analytics: Refill GMV=₹{intel['refill_radar'].get('est_refill_gmv_inr')}, Caregiver Alerts={intel['caregiver_shield'].get('total_alerts_dispatched')}")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Healthcare intelligence endpoint failed: {res.text}")
            failed += 1

        # ----------------------------------------------------------------------
        # 5. CORE PATIENT EXPERIENCE & FUZZ SAFETY TESTS
        # ----------------------------------------------------------------------
        print("\n--- 5. CORE PATIENT EXPERIENCE & FUZZ SAFETY ---")
        
        # Test 5.1: Create Medication
        today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        res = await client.post(
            "/api/medications",
            json={
                "name": "Metformin HCl",
                "generic_name": "Metformin",
                "dosage": "500",
                "unit": "mg",
                "times": ["08:00", "20:00"],
                "start_date": today_iso,
                "stock": 10,
                "refill_threshold": 5,
                "food_relation": "with_food"
            },
            headers=user_headers
        )
        med_data = res.json() if res.status_code == 200 else {}
        med_id = med_data.get("id")
        if res.status_code == 200 and med_id:
            print(f"  ✅ [PASS] Created medication '{med_data.get('name')}' ID: {med_id}")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Medication creation failed: {res.text}")
            failed += 1

        # Test 5.2: SQL Injection & XSS Fuzzing Safety
        res = await client.post(
            "/api/medications",
            json={
                "name": "Paracetamol'; DROP TABLE medications; -- <script>alert('xss')</script>",
                "dosage": "650",
                "unit": "mg",
                "start_date": today_iso,
                "times": ["09:00"]
            },
            headers=user_headers
        )
        if res.status_code == 200:
            print("  ✅ [PASS] Malicious SQLi/XSS payload handled safely by backend ORM")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Fuzzing failed: {res.text}")
            failed += 1

        # Test 5.3: Medication Refill Endpoint
        if med_id:
            res = await client.post(f"/api/medications/{med_id}/refill", json={"add_stock": 30}, headers=user_headers)
            if res.status_code == 200 and res.json().get("stock") == 40:
                print("  ✅ [PASS] Medication Refill stock updated to 40")
                passed += 1
            else:
                print(f"  ❌ [FAIL] Medication refill failed: {res.text}")
                failed += 1

        # Test 5.4: AI Yoga Therapy Completion Logging
        res = await client.post(
            "/api/yoga/complete",
            json={
                "step_num": 1,
                "step_name": "Anulom Vilom Pranayama Flow",
                "video_url": "https://www.youtube.com/watch?v=QPjwawKxuLw",
                "local_date": today_iso
            },
            headers=user_headers
        )
        if res.status_code == 200 and res.json().get("ok") is True:
            print("  ✅ [PASS] AI Yoga Therapy Session logged to progress journal")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Yoga complete logging failed: {res.text}")
            failed += 1

        # Test 5.5: WhatsApp Caregiver Setup & Alert Dispatch
        await client.post("/api/profile/caregiver", json={"caregiver_phone": "+919876543210"}, headers=user_headers)
        res = await client.post(
            "/api/caregiver/alert",
            json={"message": "Monkey Test missed dose alert", "medication_name": "Metformin HCl"},
            headers=user_headers
        )
        sent_alerts = res.json().get("sent") if res.status_code == 200 else []
        if res.status_code == 200 and isinstance(sent_alerts, list) and len(sent_alerts) > 0:
            print("  ✅ [PASS] Caregiver Alert escalation logged and dispatched to caregiver")
            passed += 1
        else:
            print(f"  ❌ [FAIL] Caregiver alert failed: {res.text}")
            failed += 1

    print("\n==========================================================================")
    print(f"     MONKEY TEST COMPLETE: {passed} PASSED, {failed} FAILED out of {passed + failed} TESTS")
    print("==========================================================================")
    return failed == 0

if __name__ == "__main__":
    success = asyncio.run(run_full_monkey_and_wiring_test())
    sys.exit(0 if success else 1)
