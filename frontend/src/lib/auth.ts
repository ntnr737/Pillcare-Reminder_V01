import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "pillcare_auth_token";
const USER_KEY = "pillcare_auth_user";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: "pillcare" });

export type PillcareUser = {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
};

export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    clientId: WEB_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: ["openid", "profile", "email"],
  });
}

export async function completeGoogleSignIn(response: Google.GoogleAuthSessionResult): Promise<PillcareUser> {
  if (response.type !== "success") {
    throw new Error("Sign-in was cancelled or did not complete.");
  }

  const idToken =
    (response as any).authentication?.idToken ||
    (response as any).params?.id_token;

  if (!idToken) {
    throw new Error("Google did not return an ID token. Check that the client IDs in app config match your Google Cloud OAuth clients.");
  }

  const res = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sign-in failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  await storage.secureSet(TOKEN_KEY, data.token);
  await storage.secureSet(USER_KEY, JSON.stringify(data.user));
  return data.user as PillcareUser;
}

export async function getStoredToken(): Promise<string | null> {
  return storage.secureGet(TOKEN_KEY, null);
}

export async function getStoredUser(): Promise<PillcareUser | null> {
  const raw = await storage.secureGet(USER_KEY, null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PillcareUser;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
  await storage.secureRemove(USER_KEY);
}
