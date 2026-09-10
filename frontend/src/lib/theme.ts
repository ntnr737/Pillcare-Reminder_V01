export const theme = {
  colors: {
    bg: "#0B0D14",
    surface: "#161926",
    surfaceElevated: "#1E2235",
    overlay: "rgba(0,0,0,0.75)",
    borderSubtle: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.16)",
    textPrimary: "#F9FAFB",
    textSecondary: "rgba(249, 250, 251, 0.65)",
    textDisabled: "rgba(249, 250, 251, 0.35)",
    textInverse: "#0B0D14",
    brand: "#8B5CF6",
    brandMuted: "rgba(139, 92, 246, 0.18)",
    secondary: "#06B6D4",
    secondaryMuted: "rgba(6, 182, 212, 0.18)",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, touch: 48 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 9999 },
  font: { h1: 32, h2: 28, h3: 24, h4: 20, bodyLg: 18, body: 16, label: 14, caption: 12 },
} as const;

export type Theme = typeof theme;
