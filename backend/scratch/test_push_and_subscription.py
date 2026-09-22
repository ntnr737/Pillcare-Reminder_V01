import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from httpx import AsyncClient, ASGITransport
from server import app, _create_session_token, db

async def test_push_and_subscription():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        print("\n--- TESTING PUSH TOKEN INGESTION & ADMIN NOTIFICATION BROADCAST ---")
        
        user_id = "push_test_user_99"
        await db.users.update_one({"id": user_id}, {"$set": {"id": user_id, "email": "push_test@example.com", "name": "Push Tester"}}, upsert=True)
        jwt_token = _create_session_token(user_id)
        headers = {"Authorization": f"Bearer {jwt_token}"}
        
        # 2. Test saving push token in ExpoPushToken format with 'push_token' key
        expo_token = "ExpoPushToken[xxxx_test_token_12345]"
        save_res = await client.post("/api/profile/push-token", json={"push_token": expo_token}, headers=headers)
        assert save_res.status_code == 200
        assert save_res.json().get("ok") is True
        print(f"✅ Push token '{expo_token}' saved successfully via /profile/push-token!")

        # 3. Test saving push token in ExponentPushToken format with 'token' key
        exponent_token = "ExponentPushToken[yyyy_test_token_67890]"
        save_res2 = await client.post("/api/profile/push-token", json={"token": exponent_token}, headers=headers)
        assert save_res2.status_code == 200
        assert save_res2.json().get("ok") is True
        print(f"✅ Push token '{exponent_token}' saved successfully via /profile/push-token!")

        # 4. Test admin notification targeted to user
        admin_headers = {"x-admin-secret": "pillcare_admin_secret_key_2026"}
        notify_res = await client.post("/admin/notify", json={"title": "Test Title", "body": "Test Body", "user_id": user_id}, headers=admin_headers)
        assert notify_res.status_code == 200
        data = notify_res.json()
        assert data.get("ok") is True
        assert data.get("total") >= 1
        print(f"✅ Target Push Notification broadcast succeeded! Delivered/Total: {data['total']}")

        # 5. Test admin notification broadcast to ALL
        broadcast_res = await client.post("/admin/notify", json={"title": "Global Alert", "body": "Global Body"}, headers=admin_headers)
        assert broadcast_res.status_code == 200
        bdata = broadcast_res.json()
        assert bdata.get("ok") is True
        print(f"✅ Global Push Notification broadcast succeeded! Delivered/Total: {bdata['total']}")

        print("\n--- TESTING ADMIN MONTHLY VS ANNUAL SUBSCRIPTION CONTROL ---")
        # 6. Set Monthly Subscription
        sub_m = await client.post(f"/admin/users/{user_id}/subscription", json={"plan": "basic", "billing_cycle": "monthly"}, headers=admin_headers)
        assert sub_m.status_code == 200
        assert sub_m.json().get("billing_cycle") == "monthly"
        print(f"✅ Admin set user plan to BASIC (MONTHLY). Response: {sub_m.json()}")

        # 7. Set Annual Subscription
        sub_a = await client.post(f"/admin/users/{user_id}/subscription", json={"plan": "premium", "billing_cycle": "annual"}, headers=admin_headers)
        assert sub_a.status_code == 200
        assert sub_a.json().get("billing_cycle") == "annual"
        print(f"✅ Admin set user plan to PREMIUM (ANNUAL). Response: {sub_a.json()}")

if __name__ == "__main__":
    asyncio.run(test_push_and_subscription())
