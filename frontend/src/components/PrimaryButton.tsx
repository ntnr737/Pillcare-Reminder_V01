import React from "react";
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, View, StyleProp, ViewStyle } from "react-native";
import { theme } from "@/src/lib/theme";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, testID, variant = "primary", loading, disabled, style }: Props) {
  const bg = variant === "primary" ? theme.colors.brand : variant === "secondary" ? "transparent" : "transparent";
  const fg = variant === "primary" ? theme.colors.textInverse : variant === "ghost" ? theme.colors.textPrimary : theme.colors.brand;
  const border = variant === "secondary" ? theme.colors.brand : "transparent";
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  label: { fontSize: 16, fontWeight: "600" },
});

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[cardStyles.card, style]}>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
  },
});
