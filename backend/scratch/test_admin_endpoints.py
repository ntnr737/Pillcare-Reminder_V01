import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
import json
from httpx import AsyncClient, ASGITransport
from server import app

async def test_admin_routing_and_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        print("\n--- TESTING ADMIN SUBDOMAIN & DASHBOARD ---")
        res = await client.get("/", headers={"host": "admin.pillcare.in"})
        assert res.status_code == 200
        assert "PillCare Admin Mission Control" in res.text
        print("✅ Host: admin.pillcare.in serves Admin Mission Control HTML directly!")

        res = await client.get("/admin")
        assert res.status_code == 200
        assert "PillCare Admin Mission Control" in res.text
        print("✅ /admin route serves Admin Mission Control HTML directly!")

        print("\n--- TESTING ADMIN FINANCIAL ANALYTICS ---")
        headers = {"x-admin-secret": "pillcare_admin_secret_key_2026"}
        res = await client.get("/admin/analytics/financials", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "mrr" in data
        assert "arr" in data
        assert "arpu" in data
        assert "ltv" in data
        assert "tier_breakdown" in data
        print(f"✅ /admin/analytics/financials returned valid financial data: MRR=₹{data['mrr']}, ARR=₹{data['arr']}")

        print("\n--- TESTING WEBSITE ADMIN.HTML ENDPOINTS (COHORTS, FILTER, COMPREHENSIVE) ---")
        res_cohorts = await client.get("/admin/analytics/cohorts", headers=headers)
        assert res_cohorts.status_code == 200
        assert "cohorts" in res_cohorts.json()
        print("✅ /admin/analytics/cohorts returned valid cohort retention array!")

        res_filter = await client.get("/admin/analytics/filter?metric=adherence&min_value=0", headers=headers)
        assert res_filter.status_code == 200
        assert "users" in res_filter.json()
        print("✅ /admin/analytics/filter returned filtered users array!")

        res_comp = await client.get("/admin/analytics/users/comprehensive?limit=50&sort_by=engagement_score", headers=headers)
        assert res_comp.status_code == 200
        assert "users" in res_comp.json()
        print("✅ /admin/analytics/users/comprehensive returned comprehensive user insights!")

        print("\n--- TESTING FLASH ANNOUNCEMENTS CRUD ---")
        # 1. Create announcement
        ann_payload = {
            "title": "⚡ Test Flash Offer",
            "body": "Get 50% off Elite Moksha plan today!",
            "type": "offer",
            "target_plan": "free",
            "link_url": "https://pillcare.in/upgrade"
        }
        res = await client.post("/admin/announcements", json=ann_payload, headers=headers)
        assert res.status_code == 200
        created = res.json()
        assert created.get("ok") is True
        ann_id = created.get("id")
        print(f"✅ POST /admin/announcements created announcement ID: {ann_id}")

        # 2. Get active announcements for free plan user
        res = await client.get("/api/announcements/active?plan=free")
        assert res.status_code == 200
        active = res.json()
        assert any(a["id"] == ann_id for a in active)
        print(f"✅ GET /api/announcements/active?plan=free retrieved live flash announcement!")

        # 3. Delete announcement
        res = await client.delete(f"/admin/announcements/{ann_id}", headers=headers)
        assert res.status_code == 200
        print(f"✅ DELETE /admin/announcements/{ann_id} cleaned up announcement successfully!")

if __name__ == "__main__":
    asyncio.run(test_admin_routing_and_endpoints())
