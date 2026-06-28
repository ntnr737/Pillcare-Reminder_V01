export const theme = {
  colors: {
    bg: "#121413",
    surface: "#1A1D1B",
    surfaceElevated: "#222624",
    overlay: "rgba(0,0,0,0.6)",
    borderSubtle: "#2A2F2D",
    borderStrong: "#3C423F",
    textPrimary: "#E4E7E5",
    textSecondary: "#9AA19D",
    textDisabled: "#5A615D",
    textInverse: "#121413",
    brand: "#92C5A9",
    brandMuted: "#92C5A933",
    secondary: "#E59A85",
    secondaryMuted: "#E59A8533",
    success: "#92C5A9",
    warning: "#E5C185",
    error: "#E58585",
    info: "#85AEE5",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, touch: 48 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 9999 },
  font: { h1: 32, h2: 28, h3: 24, h4: 20, bodyLg: 18, body: 16, label: 14, caption: 12 },
} as const;

export type Theme = typeof theme;
