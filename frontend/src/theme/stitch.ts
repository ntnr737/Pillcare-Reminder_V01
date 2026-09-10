/**
 * PillCare Google Stitch Design System Palette & Tokens
 * Sleek Dark Glassmorphism, Electric Violet Accents, Emerald Success & Cyber Cyan Refill
 */

export const StitchTheme = {
  // Core Backgrounds & Surfaces
  bg: "#0B0D14",              // Deep Obsidian Noir Canvas
  surface: "#161926",         // Frosted Dark Charcoal Glass Surface
  surfaceElevated: "#1E2235", // Elevated Card Surface
  surfaceBorder: "rgba(255, 255, 255, 0.08)", // 1px Subtle Glass Border

  // Text Hierarchy
  textPrimary: "#F9FAFB",     // Crisp Pure White
  textSecondary: "rgba(249, 250, 251, 0.65)", // Muted Silver Frost
  textDisabled: "rgba(249, 250, 251, 0.35)",  // Soft Charcoal

  // Accents & Signals
  accent: "#8B5CF6",          // Electric Violet Primary Accent
  accentLight: "#A78BFA",     // Soft Violet Highlight
  accentGlow: "rgba(139, 92, 246, 0.22)", // Ambient Neon Glow
  
  // Action & Status Tokens
  success: "#10B981",         // Emerald Pulse (Taken / Goal Met)
  successGlow: "rgba(16, 185, 129, 0.2)",
  
  refill: "#06B6D4",          // Cyan Surge (Stock Refilled / Pharmacy)
  refillGlow: "rgba(6, 182, 212, 0.2)",

  warning: "#F59E0B",         // Amber Glow (Low Stock / Pending)
  alert: "#EF4444",           // Coral Red (Missed / Overdue)

  // Decorative Badges
  yogaBadge: "#A855F7",       // Radiant Purple (AI Yoga Therapy)
  courseBadge: "#3B82F6",     // Sapphire Blue (Course Completed)

  // Card Borders & Radii
  borderRadius: {
    sm: 8,
    md: 14,
    lg: 20,
    full: 9999,
  },
} as const;

export type StitchThemeType = typeof StitchTheme;
