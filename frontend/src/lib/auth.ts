import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "pillcare_auth_token";
const USER_KEY = "pillcare_auth_user";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  iosClientId: IOS_CLIENT_ID || undefined,
  offlineAccess: false,
});

export type PillcareUser = {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
};

export async function signInWithGoogle(): Promise<PillcareUser> {
  await GoogleSignin.hasPlayServices();
  let idToken: string | undefined;
  try {
    const result = await GoogleSignin.signIn();
    idToken = (result as any)?.data?.idToken || (result as any)?.idToken;
  } catch (e: any) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error("Sign-in was cancelled.");
      }
      if (e.code === statusCodes.IN_PROGRESS) {
        throw new Error("Sign-in is already in progress.");
      }
    }
    throw new Error("Google sign-in failed. Please try again.");
  }

  if (!idToken) {
    throw new Error("Google did not return an ID token.");
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
  try {
    await GoogleSignin.signOut();
  } catch {
  }
}
