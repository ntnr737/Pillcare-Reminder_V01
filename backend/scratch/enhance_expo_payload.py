with open("backend/server.py", "r", encoding="utf-8") as f:
    content = f.read()

target = '''            messages = [{
                "to": token,
                "title": title,
                "body": body,
                "sound": "pillcare_reminder",
                "channelId": "broadcasts",
                "data": {"type": "broadcast"},
            } for token in batch]'''

replacement = '''            messages = [{
                "to": token,
                "title": title,
                "body": body,
                "sound": "default",
                "priority": "high",
                "channelId": "broadcasts",
                "_displayInForeground": True,
                "data": {"type": "broadcast"},
            } for token in batch]'''

if target in content:
    content = content.replace(target, replacement)
    with open("backend/server.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Enhanced Expo Push payload in backend/server.py")
else:
    print("WARNING: Could not find target pattern in server.py")

