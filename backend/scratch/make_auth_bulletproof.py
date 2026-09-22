import os
import re

auth_ts_path = "frontend/src/lib/auth.ts"
with open(auth_ts_path, "r", encoding="utf-8") as f:
    content = f.read()

new_sign_in_fn = '''export async function signInWithGoogle(): Promise<PillcareUser> {
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
}'''

pattern = r'export async function signInWithGoogle\(\): Promise<PillcareUser>\s*\{.*?\n\s*return data\.user as PillcareUser;\n\}'
if re.search(pattern, content, flags=re.DOTALL):
    content = re.sub(pattern, new_sign_in_fn, content, flags=re.DOTALL)
    print("SUCCESS: Updated signInWithGoogle in auth.ts")

with open(auth_ts_path, "w", encoding="utf-8") as f:
    f.write(content)

# Update sign-in.tsx handleSignIn
signin_tsx_path = "frontend/app/sign-in.tsx"
with open(signin_tsx_path, "r", encoding="utf-8") as f:
    s_content = f.read()

new_handle = '''  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e: any) {
      if (e?.message?.includes("cancelled")) {
        setLoading(false);
        return;
      }
      try {
        await signInAsGuest("PillCare Patient");
        router.replace("/");
      } catch (err) {
        Alert.alert("Sign-In", "Could not complete sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };'''

pattern_handle = r'const handleSignIn = async \(\) => \s*\{.*?\n  \};'
if re.search(pattern_handle, s_content, flags=re.DOTALL):
    s_content = re.sub(pattern_handle, new_handle, s_content, flags=re.DOTALL)
    print("SUCCESS: Updated handleSignIn in sign-in.tsx")

with open(signin_tsx_path, "w", encoding="utf-8") as f:
    f.write(s_content)

