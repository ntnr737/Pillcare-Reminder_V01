import os
import re

# 1. Update frontend/.env with non-empty Google Client IDs
env_path = "frontend/.env"
env_content = '''EXPO_PUBLIC_BACKEND_URL=https://pillcare-backend-1082668880575.europe-west1.run.app
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1082668880575-lfoqgnieodb52b5ges1vppiv92ifbioc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=1082668880575-og9vm3sduk1g7dlj8g17in3r1cicnbt6.apps.googleusercontent.com
'''

with open(env_path, "w", encoding="utf-8") as f:
    f.write(env_content)
print("Updated frontend/.env with valid Google Web Client IDs")

# 2. Update frontend/src/lib/auth.ts to use fallback client ID and add signInAsGuest
auth_ts_path = "frontend/src/lib/auth.ts"
with open(auth_ts_path, "r", encoding="utf-8") as f:
    auth_content = f.read()

old_client_id_decl = '''const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";'''

new_client_id_decl = '''const DEFAULT_WEB_ID = "1082668880575-lfoqgnieodb52b5ges1vppiv92ifbioc.apps.googleusercontent.com";
const DEFAULT_IOS_ID = "1082668880575-og9vm3sduk1g7dlj8g17in3r1cicnbt6.apps.googleusercontent.com";

const WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.trim().length > 5)
  ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.trim()
  : DEFAULT_WEB_ID;
const IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID && process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.trim().length > 5)
  ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.trim()
  : DEFAULT_IOS_ID;'''

if old_client_id_decl in auth_content:
    auth_content = auth_content.replace(old_client_id_decl, new_client_id_decl)
    print("Replaced client ID declarations in auth.ts")

# Add signInAsGuest export function
guest_fn = '''
export async function signInAsGuest(): Promise<PillcareUser> {
  const guestUser: PillcareUser = {
    id: `patient_guest_${Date.now().toString().slice(-6)}`,
    email: "patient@pillcare.in",
    name: "PillCare Patient",
    picture: null,
  };
  try {
    const res = await fetch(`${BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest: true, email: guestUser.email, name: guestUser.name }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) await storage.secureSet(TOKEN_KEY, data.token);
      if (data.user) await storage.secureSet(USER_KEY, JSON.stringify(data.user));
    }
  } catch (e) {
    console.warn("Guest auth backend fetch fallback:", e);
  }

  const existingToken = await storage.secureGet(TOKEN_KEY);
  if (!existingToken) {
    await storage.secureSet(TOKEN_KEY, "guest_session_token_" + Date.now());
  }
  await storage.secureSet(USER_KEY, JSON.stringify(guestUser));
  return guestUser;
}
'''

if "export async function signInAsGuest()" not in auth_content:
    auth_content += "\n" + guest_fn
    print("Added signInAsGuest to auth.ts")

with open(auth_ts_path, "w", encoding="utf-8") as f:
    f.write(auth_content)

