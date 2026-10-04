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
  is_guest?: boolean;
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

  if (!idToken) {
    throw new Error("Google Sign-In failed to return an ID token. Please try again.");
  }

  const existingGuestToken = await getStoredToken();
  const res = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(existingGuestToken ? { Authorization: `Bearer ${existingGuestToken}` } : {}),
    },
    body: JSON.stringify({
      id_token: idToken,
      guest_token: existingGuestToken || undefined,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Google sign-in failed (${res.status}): ${errorText || "Server error"}`);
  }

  const data = await res.json();
  if (!data.user || !data.token) {
    throw new Error("Invalid response from Google authentication server.");
  }

  const user: PillcareUser = {
    id: data.user.id || data.user._id,
    email: data.user.email || googleUserData?.email || "",
    name: data.user.name || googleUserData?.name || "PillCare User",
    picture: data.user.picture || googleUserData?.photo || null,
    is_guest: false,
  };

  await storage.secureSet(TOKEN_KEY, data.token);
  await storage.secureSet(USER_KEY, JSON.stringify(user));
  await set(K.profile, { nickname: user.name, email: user.email, picture: user.picture, is_guest: false }).catch(() => {});
  return user;
}

export async function signInAsGuest(name: string = "PillCare Guest"): Promise<PillcareUser> {
  try {
    const res = await fetch(`${BASE}/api/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token && data.user) {
        const guestUser: PillcareUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || name,
          is_guest: true,
        };
        await storage.secureSet(TOKEN_KEY, data.token);
        await storage.secureSet(USER_KEY, JSON.stringify(guestUser));
        await set(K.profile, { nickname: guestUser.name, email: guestUser.email, is_guest: true }).catch(() => {});
        return guestUser;
      }
    }
  } catch (err) {
    console.warn("Server guest creation offline — generating local guest session:", err);
  }

  // Fallback for offline guest session creation
  const guestId = `guest_${Math.random().toString(36).substring(2, 10)}`;
  const guestUser: PillcareUser = {
    id: guestId,
    email: `${guestId}@guest.pillcare.app`,
    name: name,
    is_guest: true,
  };
  const token = `guest_offline_${Date.now()}`;
  await storage.secureSet(TOKEN_KEY, token);
  await storage.secureSet(USER_KEY, JSON.stringify(guestUser));
  await set(K.profile, { nickname: guestUser.name, email: guestUser.email, is_guest: true }).catch(() => {});
  return guestUser;
}

export async function getStoredToken(): Promise<string | null> {
  return storage.secureGet(TOKEN_KEY, null);
}

export async function getStoredUser(): Promise<PillcareUser | null> {
  const raw = await storage.secureGet(USER_KEY, null);
  if (!raw) return null;
  try {
    const user = typeof raw === "string" ? JSON.parse(raw) : raw;
    return user as PillcareUser;
  } catch {
    return null;
  }
}

export function isGuestUser(user?: PillcareUser | null): boolean {
  if (!user) return true;
  if (user.is_guest === true) return true;
  if (user.id?.startsWith("guest_") || user.email?.includes("@guest.pillcare.app")) return true;
  return false;
}

export async function signOut(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
  await storage.secureRemove(USER_KEY);
  await remove(K.profile).catch(() => {});
  try {
    const { clearAllCachesOnSignOut } = require("./sync");
    await clearAllCachesOnSignOut();
  } catch (e) {}
  try {
    const { cancelAllScheduledNotifications } = require("./notifications");
    await cancelAllScheduledNotifications();
  } catch (e) {}
  try {
    await GoogleSignin.signOut();
  } catch {}
}

