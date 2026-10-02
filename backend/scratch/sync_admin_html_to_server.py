import re

server_path = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/backend/server.py"
admin_html_path = "/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html"

with open(admin_html_path, "r", encoding="utf-8") as f:
    full_admin_html = f.read()

with open(server_path, "r", encoding="utf-8") as f:
    server_content = f.read()

# Replace ADMIN_PANEL_HTML definition in server.py
# Find start of ADMIN_PANEL_HTML = """ and end of """ before @app.get("/")
pattern = r'ADMIN_PANEL_HTML = """(.*?)"""\s*@app\.get\("/",'
match = re.search(pattern, server_content, re.DOTALL)

if match:
    clean_html = full_admin_html.replace('"""', '\\"\\"\\"')
    replacement = f'ADMIN_PANEL_HTML = """{clean_html}"""\n\n@app.get("/",'
    server_content = server_content[:match.start()] + replacement + server_content[match.end():]
    print("Successfully replaced ADMIN_PANEL_HTML in backend/server.py!")
else:
    print("Error: Could not match ADMIN_PANEL_HTML pattern in backend/server.py!")

# Also ensure admin_dashboard_ui checks file path first
old_route = """@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_ui():
    \"\"\"Renders the PillCare Web Admin Panel UI.\"\"\"
    return HTMLResponse(content=ADMIN_PANEL_HTML)"""

new_route = """@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_ui():
    \"\"\"Renders the PillCare Web Admin Panel UI.\"\"\"
    admin_file = ROOT_DIR.parent / "pillcare-website" / "admin.html"
    if admin_file.exists():
        try:
            return HTMLResponse(content=admin_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return HTMLResponse(content=ADMIN_PANEL_HTML)"""

if old_route in server_content:
    server_content = server_content.replace(old_route, new_route, 1)
    print("Updated admin_dashboard_ui route in backend/server.py!")

with open(server_path, "w", encoding="utf-8") as f:
    f.write(server_content)

print("Finished syncing admin HTML into backend/server.py")
