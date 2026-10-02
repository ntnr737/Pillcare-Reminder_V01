import asyncio
import os
from pathlib import Path
import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent.parent / ".env")
mongo_url = os.environ.get("MONGO_URL")

async def test_push():
    print(f"Connecting to MongoDB at {mongo_url[:30]}...")
    client = AsyncIOMotorClient(mongo_url)
    db = client["pillcare"]

    users = await db.users.find({"push_token": {"$exists": True, "$ne": None}}).to_list(100)
    profiles = await db.profile.find({"push_token": {"$exists": True, "$ne": None}}).to_list(100)

    print(f"\n--- DATABASE TOKENS SEARCH ---")
    print(f"Users with push_token in db.users: {len(users)}")
    for u in users:
        print(f"  User Email/ID: {u.get('email', u.get('id'))} | Token: {u.get('push_token')}")

    print(f"\nProfiles with push_token in db.profile: {len(profiles)}")
    for p in profiles:
        print(f"  Profile User ID: {p.get('user_id')} | Token: {p.get('push_token')}")

    tokens = list(set([u.get('push_token') for u in users if u.get('push_token')] + [p.get('push_token') for p in profiles if p.get('push_token')]))
    print(f"\nTotal Unique Push Tokens in MongoDB: {len(tokens)}")

    if not tokens:
        print("⚠️ RESULT: 0 push tokens found in production database!")
        print("This is why no physical phone received notifications — no device has sent its Expo token to POST /api/users/push-token yet.")
    else:
        print("\nSending test push request to Expo Push Gateway...")
        messages = [{
            "to": token,
            "title": "💊 PillCare Lockscreen Push Test",
            "body": "This is a direct test notification sent to your registered smartphone!",
            "sound": "default",
            "priority": "high",
            "channelId": "broadcasts",
            "data": {"type": "test"}
        } for token in tokens]

        async with httpx.AsyncClient(timeout=30) as http_client:
            resp = await http_client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Content-Type": "application/json"}
            )
            print(f"Expo Gateway Response Code: {resp.status_code}")
            print(f"Expo Delivery Response Payload:\n{resp.text}")

if __name__ == "__main__":
    asyncio.run(test_push())
