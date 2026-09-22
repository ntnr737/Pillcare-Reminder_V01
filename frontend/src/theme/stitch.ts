/**
 * PillCare Google Stitch Design System Palette & Tokens
 * Dual Theme Engine: Sleek Dark Obsidian Noir & Crisp Light Slate
 */

export const DarkTheme = {
  isDark: true,
  // Core Backgrounds & Surfaces
  bg: "#0B0D14",              // Deep Obsidian Noir Canvas
  surface: "#141724",         // Frosted Dark Slate Surface
  surfaceElevated: "#1C2032", // Elevated Card Surface
  surfaceBorder: "rgba(255, 255, 255, 0.08)", // 1px Subtle Glass Border
  cardBg: "#141724",

  // Text Hierarchy
  textPrimary: "#F9FAFB",     // Crisp Pure White
  textSecondary: "rgba(249, 250, 251, 0.65)", // Muted Silver Frost
  textDisabled: "rgba(249, 250, 251, 0.35)",  // Soft Charcoal

  // Accents & Signals
  accent: "#6366F1",          // Sleek Slate Indigo Accent
  accentLight: "#818CF8",     // Soft Indigo Slate Highlight
  accentGlow: "rgba(99, 102, 241, 0.18)", // Ambient Matte Glow
  accentBg: "rgba(99, 102, 241, 0.12)",

  // Action & Status Tokens
  success: "#10B981",         // Emerald Pulse (Taken / Goal Met)
  successGlow: "rgba(16, 185, 129, 0.2)",
  
  refill: "#06B6D4",          // Cyan Surge (Stock Refilled / Pharmacy)
  refillGlow: "rgba(6, 182, 212, 0.2)",

  warning: "#F59E0B",         // Amber Glow (Low Stock / Pending)
  alert: "#EF4444",           // Coral Red (Missed / Overdue)

  // Decorative Badges
  yogaBadge: "#14B8A6",       // Calm AYUSH Teal (AI Yoga Therapy)
  courseBadge: "#38BDF8",     // Ice Blue (Course Completed)

  // Card Borders & Radii
  borderRadius: {
    sm: 8,
    md: 14,
    lg: 20,
    full: 9999,
  },
} as const;

export const LightTheme = {
  isDark: false,
  // Core Backgrounds & Surfaces
  bg: "#F8FAFC",              // Crisp Light Slate Canvas
  surface: "#FFFFFF",         // Pure White Card Surface
  surfaceElevated: "#F1F5F9", // Elevated Card Surface
  surfaceBorder: "rgba(0, 0, 0, 0.08)", // Subtle Border
  cardBg: "#FFFFFF",

  // Text Hierarchy
  textPrimary: "#0F172A",     // Deep Slate Black
  textSecondary: "#64748B",   // Muted Slate Gray
  textDisabled: "#94A3B8",    // Soft Gray

  // Accents & Signals
  accent: "#4F46E5",          // Deep Slate Indigo
  accentLight: "#6366F1",     // Soft Indigo Highlight
  accentGlow: "rgba(79, 70, 229, 0.12)", // Subtle Accent Tint
  accentBg: "rgba(79, 70, 229, 0.08)",

  // Action & Status Tokens
  success: "#059669",         // Emerald Green
  successGlow: "rgba(5, 150, 105, 0.15)",
  
  refill: "#0891B2",          // Cyan Refill
  refillGlow: "rgba(8, 145, 178, 0.15)",

  warning: "#D97706",         // Warm Amber
  alert: "#DC2626",           // Deep Coral Red

  // Decorative Badges
  yogaBadge: "#0D9488",       // Soothing AYUSH Teal
  courseBadge: "#0284C7",     // Ice Blue

  // Card Borders & Radii
  borderRadius: {
    sm: 8,
    md: 14,
    lg: 20,
    full: 9999,
  },
} as const;

// Backward compatible default export
export const StitchTheme = DarkTheme;
export type StitchThemeType = typeof DarkTheme | typeof LightTheme;
