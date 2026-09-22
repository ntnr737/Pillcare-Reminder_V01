import re

signin_path = "frontend/app/sign-in.tsx"
with open(signin_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'import { signInWithGoogle } from "@/src/lib/auth";',
    'import { signInWithGoogle, signInAsGuest } from "@/src/lib/auth";'
)

old_handle = '''  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Sign-In Failed", e?.message || "Could not sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };'''

new_handle = '''  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (e: any) {
      Alert.alert(
        "Google Sign-In",
        e?.message ? `${e.message}\n\nWould you like to continue as a Guest Patient?` : "Could not sign in with Google. Continue as Guest Patient?",
        [
          { text: "Try Again", style: "cancel" },
          {
            text: "Continue as Guest Patient",
            style: "default",
            onPress: async () => {
              try {
                await signInAsGuest();
                router.replace("/");
              } catch (err: any) {
                Alert.alert("Error", err?.message || "Failed to start guest session.");
              }
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    try {
      await signInAsGuest();
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Guest Login Failed", e?.message || "Could not start guest session.");
    } finally {
      setLoading(false);
    }
  };'''

if old_handle in content:
    content = content.replace(old_handle, new_handle)
    print("Updated handleSignIn & added handleGuestSignIn in sign-in.tsx")

old_btn_jsx = '''      {/* Google Sign-In button */}
      <TouchableOpacity style={[s.gBtn, loading && { opacity: 0.7 }]} onPress={handleSignIn} disabled={loading}>
        <Ionicons name="logo-google" size={16} color="#fff" />
        <Text style={s.gBtnTx}>{loading ? "Signing in…" : "Continue with Google"}</Text>
      </TouchableOpacity>'''

new_btn_jsx = '''      {/* Sign-In options */}
      <View style={{ gap: 8 }}>
        <TouchableOpacity style={[s.gBtn, loading && { opacity: 0.7 }]} onPress={handleSignIn} disabled={loading}>
          <Ionicons name="logo-google" size={16} color="#fff" />
          <Text style={s.gBtnTx}>{loading ? "Signing in…" : "Continue with Google"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.guestBtn, loading && { opacity: 0.7 }]} onPress={handleGuestSignIn} disabled={loading}>
          <Ionicons name="person-outline" size={15} color={A3} />
          <Text style={s.guestBtnTx}>Continue as Guest Patient</Text>
        </TouchableOpacity>
      </View>'''

if old_btn_jsx in content:
    content = content.replace(old_btn_jsx, new_btn_jsx)
    print("Added Guest Sign-In button to sign-in.tsx UI")

old_styles = '''  avatarRow: { flexDirection: "row", alignItems: "center", gap: 10 },'''

new_styles = '''  guestBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: SF, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: BD
  },
  guestBtnTx: { fontSize: 13, fontWeight: "600", color: TX },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 10 },'''

if old_styles in content:
    content = content.replace(old_styles, new_styles)
    print("Added guestBtn styles to sign-in.tsx")

with open(signin_path, "w", encoding="utf-8") as f:
    f.write(content)

print("sign-in.tsx updated successfully!")
