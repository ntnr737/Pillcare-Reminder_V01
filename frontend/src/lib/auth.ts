import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { storage } from "@/src/utils/storage";
import { set, remove, K } from "./store";

const TOKEN_KEY = "pillcare_auth_token";
const USER_KEY = "pillcare_auth_user";

const DEFAULT_WEB_ID = "1082668880575-lfoqgnieodb52b5ges1vppiv92ifbioc.apps.googleusercontent.com";
const DEFAULT_IOS_ID = "1082668880575-og9vm3sduk1g7dlj8g17in3r1cicnbt6.apps.googleusercontent.com";

const WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.trim().length > 5)
  ? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.trim()
  : DEFAULT_WEB_ID;
const IOS_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID && process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.trim().length > 5)
  ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.trim()
  : DEFAULT_IOS_ID;
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
      return await signInAsGuest("PillCare Patient");
    }
    await GoogleSignin.hasPlayServices();
  } catch (e: any) {
    console.warn("hasPlayServices notice:", e);
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
      console.warn(`Native Google Auth code ${e.code} — executing seamless fallback:`, e.message);
      return await signInAsGuest("PillCare Patient");
    }
    console.warn("Google Sign-In fallback:", e);
    return await signInAsGuest("PillCare Patient");
  }

  if (!idToken) {
    return await signInAsGuest("PillCare Patient");
  }

  try {
    const res = await fetch(`${BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (res.ok) {
      const data = await res.json();
      await storage.secureSet(TOKEN_KEY, data.token);
      await storage.secureSet(USER_KEY, JSON.stringify(data.user));
      if (data.user) {
        await set(K.profile, { nickname: data.user.nickname || data.user.name || "User", ...data.user }).catch(() => {});
      }
      return data.user as PillcareUser;
    }
  } catch (err) {
    console.warn("Backend auth fetch failed — executing fallback:", err);
  }

  return await signInAsGuest("PillCare Patient");
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

export function isGuestUser(user?: PillcareUser | null): boolean {
  if (!user) return true;
  return (
    user.email === "demo@pillcare.app" ||
    user.email?.endsWith("@pillcare.app") ||
    user.id?.startsWith("user_") ||
    !user.email
  );
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

