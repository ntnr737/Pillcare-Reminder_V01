export const COLORS = {
  BG: "#0B0D14",
  SF: "#141724",
  TX: "#F9FAFB",
  TM: "rgba(249, 250, 251, 0.65)",
  A3: "#818CF8",
  BD: "rgba(255, 255, 255, 0.08)",
  AC: "#6366F1",
  AB: "rgba(99, 102, 241, 0.14)",
  N8: "#1A1D2B",
  SUCCESS: "#10B981",
  DANGER: "#EF4444",
  WARNING: "#F59E0B",
  INFO: "#38BDF8",
  TEAL: "#14B8A6",
};

export const COMMON_STYLES = {
  sheetBox: {
    backgroundColor: COLORS.N8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    gap: 12,
    zIndex: 10,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(233, 233, 237, 0.2)",
    alignSelf: "center" as const,
    marginBottom: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end" as const,
  },
};
