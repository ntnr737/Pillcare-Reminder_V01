import asyncio
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from server import app

async def main():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        # Auth header
        headers = {"X-Admin-Secret": "pillcare_admin_secret_key_2026"}
        
        print("\n--- TEST 1: GET /admin/push-tokens ---")
        res = await client.get("/admin/push-tokens", headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        print(f"✅ Push Tokens Response: Total={data.get('total_tokens')}, Tokens={len(data.get('tokens', []))}")
        
        print("\n--- TEST 2: POST /admin/test-push-token ---")
        res = await client.post("/admin/test-push-token", json={
            "user_id": "test_push_user@pillcare.in",
            "push_token": "ExponentPushToken[TestAdminDevice_Unit99]"
        }, headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        tdata = res.json()
        print(f"✅ Test Token Registered: {tdata.get('push_token')}")
        
        print("\n--- TEST 3: POST /admin/notify (Broadcast) ---")
        res = await client.post("/admin/notify", json={
            "title": "💊 PillCare Dosage Alert",
            "body": "It's time to take your 8:00 PM Metformin dose!",
            "target_plan": "all"
        }, headers=headers)
        assert res.status_code == 200, f"Failed: {res.text}"
        ndata = res.json()
        print(f"✅ Push Broadcast Response: {ndata.get('message')}")
        
        print("\n--- TEST 4: GET /admin/push-tokens (Verify history) ---")
        res = await client.get("/admin/push-tokens", headers=headers)
        assert res.status_code == 200
        hdata = res.json()
        print(f"✅ Broadcast History Logged: {len(hdata.get('recent_broadcasts', []))} entries")
        
        print("\n=======================================================")
        print("   ALL 4 PUSH NOTIFICATION ENDPOINT TESTS PASSED!      ")
        print("=======================================================\n")

if __name__ == "__main__":
    asyncio.run(main())
