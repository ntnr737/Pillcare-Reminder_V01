import re

with open("backend/server.py", "r") as f:
    content = f.read()

new_code = '''@app.get("/admin/push-tokens")
async def admin_get_push_tokens(_: None = Depends(require_admin)):
    """Get telemetry on all registered device push tokens and broadcast logs."""
    try:
        users = await db.users.find({"push_token": {"$exists": True, "$ne": None}}, {"id": 1, "email": 1, "plan": 1, "push_token": 1, "push_token_updated": 1}).to_list(1000)
        profiles = await db.profile.find({"push_token": {"$exists": True, "$ne": None}}, {"user_id": 1, "email": 1, "plan": 1, "push_token": 1, "push_token_updated": 1}).to_list(1000)
        
        tokens_map = {}
        for u in users:
            t = u.get("push_token")
            if t:
                tokens_map[t] = {
                    "token": t,
                    "email": u.get("email") or u.get("id") or "user",
                    "plan": u.get("plan") or "free",
                    "updated": u.get("push_token_updated").isoformat() if isinstance(u.get("push_token_updated"), datetime) else str(u.get("push_token_updated", ""))
                }
        for p in profiles:
            t = p.get("push_token")
            if t and t not in tokens_map:
                tokens_map[t] = {
                    "token": t,
                    "email": p.get("email") or p.get("user_id") or "user",
                    "plan": p.get("plan") or "free",
                    "updated": p.get("push_token_updated").isoformat() if isinstance(p.get("push_token_updated"), datetime) else str(p.get("push_token_updated", ""))
                }
                
        recent_logs = await db.push_broadcast_logs.find({}, {"_id": 0}).sort("ts", -1).limit(10).to_list(10)
        for l in recent_logs:
            if isinstance(l.get("ts"), datetime):
                l["ts"] = l["ts"].isoformat()

        return {
            "total_tokens": len(tokens_map),
            "tokens": list(tokens_map.values()),
            "recent_broadcasts": recent_logs
        }
    except Exception as e:
        logger.error(f"Error fetching push tokens: {e}")
        return {"total_tokens": 0, "tokens": [], "recent_broadcasts": []}

@app.post("/admin/test-push-token")
async def admin_register_test_push_token(payload: dict = Body(...), _: None = Depends(require_admin)):
    """Register a simulated test push token in MongoDB for admin testing."""
    test_token = payload.get("push_token") or f"ExponentPushToken[TestAdminDevice_{int(datetime.now().timestamp())}]"
    user_id = payload.get("user_id", "test_admin_user@pillcare.in")
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"$or": [{"id": user_id}, {"email": user_id}]},
        {"$set": {"email": user_id, "push_token": test_token, "push_token_updated": now, "plan": "premium"}},
        upsert=True
    )
    return {"ok": True, "push_token": test_token, "user_id": user_id, "message": f"Test push token registered: {test_token}"}

@app.post("/admin/notify")
async def admin_broadcast_notification(payload: dict = Body(...), _: None = Depends(require_admin)):
    """Send push notification to all users, tier cohorts, or specific users from admin dashboard."""
    title = payload.get("title", "").strip()
    body = payload.get("body", "").strip()
    target_plan = payload.get("target_plan") or payload.get("target") or "all"
    
    raw_target = payload.get("user_id") or payload.get("user_ids") or []
    if isinstance(raw_target, str):
        target_ids = [raw_target.strip()] if raw_target.strip() else []
    elif isinstance(raw_target, list):
        target_ids = [str(u).strip() for u in raw_target if str(u).strip()]
    else:
        target_ids = []
    
    if not title or not body:
        raise HTTPException(400, "Title and body are required")
    if len(title) > 100 or len(body) > 300:
        raise HTTPException(400, "Title max 100 chars, body max 300 chars")
    
    query = {"push_token": {"$exists": True, "$ne": None}}
    if target_ids:
        query["$or"] = [
            {"id": {"$in": target_ids}},
            {"user_id": {"$in": target_ids}},
            {"email": {"$in": target_ids}}
        ]
    elif target_plan == "premium":
        query["$or"] = [
            {"plan": {"$in": ["premium", "pro", "annual", "monthly", "elite_moksha", "pro_dharma"]}},
            {"is_premium": True}
        ]
    elif target_plan == "free":
        query["$or"] = [
            {"plan": {"$in": ["free", "basic", None]}},
            {"is_premium": {"$ne": True}}
        ]
    
    users = await db.users.find(query, {"push_token": 1, "id": 1}).to_list(10000)
    profiles = await db.profile.find(query, {"push_token": 1, "user_id": 1, "id": 1}).to_list(10000)
    
    tokens = list(set(
        [u["push_token"] for u in users if u.get("push_token")] +
        [p["push_token"] for p in profiles if p.get("push_token")]
    ))
    
    # ALSO auto-publish as an in-app system broadcast so users see it in-app regardless of push token permissions
    announcement_doc = {
        "title": title,
        "body": body,
        "type": "info",
        "target": target_plan,
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
        "sent_by": "admin_push_broadcast"
    }
    await db.announcements.insert_one(announcement_doc)
    
    sent = 0
    failed = 0
    
    if tokens:
        import httpx
        batch_size = 100
        for i in range(0, len(tokens), batch_size):
            batch = tokens[i:i + batch_size]
            messages = [{
                "to": token,
                "title": title,
                "body": body,
                "sound": "pillcare_reminder",
                "channelId": "broadcasts",
                "data": {"type": "broadcast"},
            } for token in batch]
            
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        "https://exp.host/--/api/v2/push/send",
                        json=messages,
                        headers={"Content-Type": "application/json"},
                    )
                    data = resp.json()
                    for item in data.get("data", []):
                        if item.get("status") == "ok":
                            sent += 1
                        else:
                            failed += 1
            except Exception as e:
                logger.warning(f"Push batch failed: {e}")
                failed += len(batch)
    
    log_doc = {
        "title": title,
        "body": body,
        "target_plan": target_plan,
        "sent": sent,
        "failed": failed,
        "total_tokens": len(tokens),
        "in_app": True,
        "ts": datetime.now(timezone.utc)
    }
    await db.push_broadcast_logs.insert_one(log_doc)
    
    msg = f"Broadcast dispatched! Delivered to {sent} device(s) via Expo Push API ({len(tokens)} token(s) targeted) & published in-app!"
    if len(tokens) == 0:
        msg = f"In-App Announcement published! (Note: 0 physical push tokens registered in target cohort '{target_plan}')."
        
    return {
        "ok": True,
        "sent": sent,
        "failed": failed,
        "total": len(tokens),
        "in_app": True,
        "message": msg
    }'''

pattern = r'@app\.post\("/admin/notify"\)\s*async def admin_broadcast_notification.*?(?=@app\.delete|\Z)'
if re.search(pattern, content, flags=re.DOTALL):
    content = re.sub(pattern, new_code + "\n\n", content, flags=re.DOTALL)
    with open("backend/server.py", "w") as f:
        f.write(content)
    print("SUCCESS: backend/server.py updated!")
else:
    print("ERROR: Regex match failed!")
