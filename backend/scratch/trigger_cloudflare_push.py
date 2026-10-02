import time

timestamp = time.strftime("%Y-%m-%d %H:%M:%S IST")

def update_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Update version comment or meta string
    comment = f"<!-- PillCare Admin Dashboard Redesign - Synced {timestamp} -->"
    if "<!-- PillCare Admin Dashboard Redesign" in content:
        import re
        content = re.sub(r"<!-- PillCare Admin Dashboard Redesign.*?-->", comment, content)
    else:
        content = content.replace("<!DOCTYPE html>", f"<!DOCTYPE html>\n{comment}", 1)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {filepath}")

# Update all paths
update_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/pillcare-website/admin.html")
update_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/pillcare-website/admin/index.html")
update_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin.html")
update_file("/Users/nitin/Documents/PillCare-Reminder_V01.1/Pillcare-Reminder_V01/pillcare-website/admin/index.html")

print("Finished updating files with trigger comments.")
