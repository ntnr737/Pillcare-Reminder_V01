import os

apk_url = "https://github.com/ntnr737/Pillcare-Reminder_V01/releases/download/v1.0.1/app-release.apk"

# 1. Update index.html hero actions
with open("../pillcare-website/index.html", "r", encoding="utf-8") as f:
    idx_content = f.read()

idx_target = '''        <div class="hero-actions">
          <a class="primary-button" href="#features">
            Explore the app
            <span class="button-icon">↗</span>
          </a>'''

idx_replacement = f'''        <div class="hero-actions">
          <a class="primary-button" href="{apk_url}">
            📱 Download Android APK (v1.0.1)
            <span class="button-icon">↓</span>
          </a>'''

if idx_target in idx_content:
    idx_content = idx_content.replace(idx_target, idx_replacement)
    with open("../pillcare-website/index.html", "w", encoding="utf-8") as f:
        f.write(idx_content)
    print("SUCCESS: Updated index.html with direct APK download button")

# 2. Update admin.html & admin/index.html push status bar with APK download link
def update_admin_apk_link(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    admin_target = 'Expo Push API: <span style="color:var(--gr);font-weight:700">ONLINE ●</span> | Delivery Mode: <span style="color:var(--ac);font-weight:700">Real-Time Lockscreen + In-App Feed</span>'
    admin_replacement = f'Expo Push API: <span style="color:var(--gr);font-weight:700">ONLINE ●</span> | Android APK: <a href="{apk_url}" target="_blank" style="color:var(--ac);font-weight:700;text-decoration:underline">📱 Download Fresh Android Build (v1.0.1)</a>'

    if admin_target in content:
        content = content.replace(admin_target, admin_replacement)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"SUCCESS: Updated {filepath} with APK download link")

update_admin_apk_link("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    update_admin_apk_link("../pillcare-website/admin/index.html")

