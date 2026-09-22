import os

old_url = "https://github.com/ntnr737/Pillcare-Reminder_V01/releases/download/v1.0.1/app-release.apk"
new_url = "https://github.com/ntnr737/Pillcare-Reminder_V01/releases/download/v1.0.2/app-release.apk"

def update_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace(old_url, new_url)
    content = content.replace("v1.0.1", "v1.0.2")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {filepath} to v1.0.2")

update_file("../pillcare-website/index.html")
update_file("../pillcare-website/admin.html")
if os.path.exists("../pillcare-website/admin/index.html"):
    update_file("../pillcare-website/admin/index.html")

