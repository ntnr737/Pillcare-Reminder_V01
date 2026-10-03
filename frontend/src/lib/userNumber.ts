/**
 * Utility to generate & retrieve a consistent 7-digit User Number (1000000 - 9999999)
 * for all PillCare users (authenticated or guest mode).
 */

export function get7DigitUserNumber(profile?: any, authUser?: any): string {
  if (profile?.user_number) return String(profile.user_number);
  if (authUser?.user_number) return String(authUser.user_number);

  const seed = profile?.email || authUser?.email || profile?.id || authUser?.id || "pillcare-guest-user-default";
  
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  
  const positiveHash = Math.abs(hash);
  const num = (positiveHash % 9000000) + 1000000;
  return String(num);
}
