import urllib.request
import json

url = "https://pillcare-backend-1082668880575.europe-west1.run.app/admin/notify"
headers = {
    "Content-Type": "application/json",
    "x-admin-secret": "pillcare_admin_secret_key_2026"
}
payload = {
    "title": "PillCare QC Test Notification",
    "body": "This is a live QC broadcast test from PillCare Admin Panel.",
    "target_plan": "all"
}

req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode())
except Exception as e:
    print("Error:", e)
