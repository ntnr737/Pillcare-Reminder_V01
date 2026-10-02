import urllib.request
import json

url = "https://pillcare-backend-1082668880575.europe-west1.run.app/admin/push-tokens"
req = urllib.request.Request(url, headers={"x-admin-secret": "pillcare_admin_secret_key_2026"})

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        data = json.loads(resp.read().decode())
        print("Tokens Count:", data.get("total_tokens", 0))
        print("Tokens Data:", json.dumps(data, indent=2))
except Exception as e:
    print("Error:", e)
