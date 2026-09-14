import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from httpx import AsyncClient, ASGITransport
from server import app

async def test_healthcare_intelligence():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        print("\n--- TESTING HEALTHCARE INTELLIGENCE ANALYTICS ---")
        res = await client.get("/admin/analytics/healthcare-intelligence", headers={"x-admin-secret": "pillcare_admin_secret_key_2026"})
        assert res.status_code == 200
        data = res.json()
        assert "refill_radar" in data
        assert "caregiver_shield" in data
        assert "clinical_safety" in data
        assert "conversion_funnel" in data
        print("✅ /admin/analytics/healthcare-intelligence returned full Healthcare Intelligence payload!")
        print(f"   Refill Radar GMV: ₹{data['refill_radar']['est_refill_gmv_inr']}")
        print(f"   Caregiver Alerts Dispatched: {data['caregiver_shield']['total_alerts_dispatched']}")
        print(f"   Clinical Prescriptions Scanned: {data['clinical_safety']['scanned_prescriptions_count']}")
        print(f"   Monetization Conversion CTR: {data['conversion_funnel']['clickthrough_conversion_rate']}%")

if __name__ == "__main__":
    asyncio.run(test_healthcare_intelligence())
