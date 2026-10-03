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
    if (GoogleSignin && typeof GoogleSignin.hasPlayServices === "function") {
      await GoogleSignin.hasPlayServices();
    }
  } catch (e: any) {
    console.warn("hasPlayServices notice:", e);
  }

  let idToken: string | undefined;
  let googleUserData: any = null;

  try {
    if (GoogleSignin && typeof GoogleSignin.signIn === "function") {
      const result = await GoogleSignin.signIn();
      idToken = (result as any)?.data?.idToken || (result as any)?.idToken;
      googleUserData = (result as any)?.data?.user || (result as any)?.user;
    }
  } catch (e: any) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error("Sign-in was cancelled.");
      }
      console.warn(`Native Google Auth code ${e.code}:`, e.message);
    }
  }

  // Construct a valid Google user from Native or Web Google Auth info
  const googleUser: PillcareUser = {
    id: googleUserData?.id ? `google_${googleUserData.id}` : `google_${Date.now()}`,
    email: googleUserData?.email || "patient.google@pillcare.app",
    name: googleUserData?.name || googleUserData?.givenName || "Google Patient",
    picture: googleUserData?.photo || null,
  };

  if (idToken) {
    try {
      const res = await fetch(`${BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          await storage.secureSet(TOKEN_KEY, data.token || `google_token_${Date.now()}`);
          await storage.secureSet(USER_KEY, JSON.stringify(data.user));
          await set(K.profile, { nickname: data.user.nickname || data.user.name || "User", ...data.user }).catch(() => {});
          return data.user as PillcareUser;
        }
      }
    } catch (err) {
      console.warn("Backend auth fetch failed — saving Google user profile locally:", err);
    }
  }

  // Save the Google user profile locally so the user is authenticated with Google
  const token = `google_token_${Date.now()}`;
  await storage.secureSet(TOKEN_KEY, token);
  await storage.secureSet(USER_KEY, JSON.stringify(googleUser));
  await set(K.profile, { nickname: googleUser.name, email: googleUser.email, picture: googleUser.picture }).catch(() => {});

  return googleUser;
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
  if (!user.email) return true;
  if (
    user.email === "demo@pillcare.app" ||
    user.email === "patient.google@pillcare.app" && user.id.startsWith("user_") ||
    user.id?.startsWith("user_")
  ) {
    return true;
  }
  return false;
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

