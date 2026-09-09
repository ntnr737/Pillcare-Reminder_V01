import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { storage } from "@/src/utils/storage";
import { set, remove, K } from "./store";

const TOKEN_KEY = "pillcare_auth_token";
const USER_KEY = "pillcare_auth_user";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

try {
  if (GoogleSignin && typeof GoogleSignin.configure === "function") {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID || undefined,
      offlineAccess: false,
    });
  }
} catch (e) {
  console.warn("GoogleSignin.configure bypassed (Expo Go mode):", e);
}

export type PillcareUser = {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
};

export async function signInWithGoogle(): Promise<PillcareUser> {
  try {
    if (!GoogleSignin || typeof GoogleSignin.hasPlayServices !== "function") {
      throw new Error("Google Sign-In is unavailable in Expo Go. Please use 'Continue as Guest' or a Standalone Build.");
    }
    await GoogleSignin.hasPlayServices();
  } catch (e: any) {
    if (e.message?.includes("Expo Go") || e.message?.includes("RNGoogleSignin")) {
      throw e;
    }
  }
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
      // Show actual error code so we can debug
      throw new Error(`Google error code ${e.code}: ${e.message || "unknown"}`);
    }
    throw new Error(`Google sign-in failed: ${e?.message || "unknown"}. Try again.`);
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
    if (res.status === 429) {
      throw new Error("Too many sign-in attempts. Please wait a moment and try again.");
    }
    const text = await res.text();
    throw new Error(`Sign-in failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  await storage.secureSet(TOKEN_KEY, data.token);
  await storage.secureSet(USER_KEY, JSON.stringify(data.user));
  if (data.user) {
    await set(K.profile, { nickname: data.user.nickname || data.user.name || "User", ...data.user }).catch(() => {});
  }
  return data.user as PillcareUser;
}

export async function signInAsGuest(name: string = "PillCare User"): Promise<PillcareUser> {
  const guestUser: PillcareUser = {
    id: "user_" + Math.random().toString(36).substring(2, 9),
    email: "demo@pillcare.app",
    name: name,
  };
  const token = "demo_token_" + Date.now();
  await storage.secureSet(TOKEN_KEY, token);
  await storage.secureSet(USER_KEY, JSON.stringify(guestUser));
  await set(K.profile, { nickname: guestUser.name, email: guestUser.email }).catch(() => {});
  return guestUser;
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
  await remove(K.profile).catch(() => {});
  try {
    await GoogleSignin.signOut();
  } catch {
  }
}
