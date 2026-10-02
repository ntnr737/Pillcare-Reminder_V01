with open("pillcare-website/admin.html", "r", encoding="utf-8") as f:
    admin_html = f.read()

with open("backend/server.py", "r", encoding="utf-8") as f:
    server_py = f.read()

start_idx = server_py.find('ADMIN_PANEL_HTML = """')
if start_idx != -1:
    end_str = '</html>\n"""\n\n@app.get("/", response_class=HTMLResponse)'
    end_idx = server_py.find(end_str, start_idx)
    if end_idx != -1:
        new_server_py = server_py[:start_idx] + 'ADMIN_PANEL_HTML = """' + admin_html + '"""\n\n@app.get("/", response_class=HTMLResponse)' + server_py[end_idx+len(end_str):]
        with open("backend/server.py", "w", encoding="utf-8") as f:
            f.write(new_server_py)
        print("Successfully synced admin.html into backend/server.py!")
    else:
        print("Could not find end of ADMIN_PANEL_HTML string")
else:
    print("Could not find ADMIN_PANEL_HTML in backend/server.py")
