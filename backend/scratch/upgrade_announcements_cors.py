import re

with open("backend/server.py", "r", encoding="utf-8") as f:
    content = f.read()

# Update create_announcement to accept dict with flexible payload fields
new_ann_endpoint = '''@app.post("/admin/announcements")
async def create_announcement(payload: dict = Body(...), _: None = Depends(require_admin)):
    title = (payload.get("title") or "").strip()
    body = (payload.get("body") or "").strip()
    type_val = payload.get("type") or "offer"
    target_plan = payload.get("target_plan") or payload.get("target") or "all"
    action_link = payload.get("action_link") or payload.get("link_url") or payload.get("link")
    expires_hours = int(payload.get("expires_hours") or 72)
    
    if not title or not body:
        raise HTTPException(400, "Title and body are required")
        
    exp = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    doc = {
        "id": f"ann_{uuid.uuid4().hex[:12]}",
        "title": title,
        "body": body,
        "action_text": payload.get("action_text") or "Explore Now",
        "action_link": action_link,
        "type": type_val,
        "target_plan": target_plan,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "expires_at": exp,
    }
    await db.announcements.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "id": doc["id"], "announcement": doc}'''

pattern_ann = r'@app\.post\("/admin/announcements"\)\s*async def create_announcement.*?(?=@app\.get\("/admin/announcements"\)|\Z)'
if re.search(pattern_ann, content, flags=re.DOTALL):
    content = re.sub(pattern_ann, new_ann_endpoint + "\n\n", content, flags=re.DOTALL)
    print("SUCCESS: Updated create_announcement in backend/server.py")
else:
    print("WARNING: Could not match create_announcement pattern in server.py")

with open("backend/server.py", "w", encoding="utf-8") as f:
    f.write(content)

print("backend/server.py updated!")
