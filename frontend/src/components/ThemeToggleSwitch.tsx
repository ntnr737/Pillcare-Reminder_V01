import React, { useEffect, useRef } from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

interface ThemeToggleSwitchProps {
  size?: "sm" | "md" | "lg";
  onToggle?: () => void;
}

export const ThemeToggleSwitch: React.FC<ThemeToggleSwitchProps> = ({
  size = "md",
  onToggle,
}) => {
  const { isDark, toggleTheme, theme } = useTheme();

  // Animation values
  const animatedValue = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isDark ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false, // Layout animations on left/backgroundColor
    }).start();
  }, [isDark]);

  const handlePress = () => {
    if (onToggle) {
      onToggle();
    } else {
      toggleTheme();
    }
  };

  // Dimensions based on size prop
  const dimensions = {
    sm: { width: 50, height: 26, knob: 20, padding: 2, iconSize: 12 },
    md: { width: 58, height: 30, knob: 24, padding: 2, iconSize: 14 },
    lg: { width: 68, height: 34, knob: 28, padding: 2, iconSize: 16 },
  }[size];

  const travelDistance = dimensions.width - dimensions.knob - dimensions.padding * 2 - 4; // 4 accounts for borders

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travelDistance],
  });

  const trackBorderColor = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)";
  const trackBgColor = isDark ? "#161926" : "#F1F5F9";
  const knobBgColor = isDark ? "#8B5CF6" : "#FFFFFF";
  const knobBorderColor = isDark ? "#A78BFA" : "#CBD5E1";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.track,
        {
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.height / 2,
          borderColor: trackBorderColor,
          backgroundColor: trackBgColor,
          padding: dimensions.padding,
        },
      ]}
    >
      {/* Background Static Icons */}
      <View style={styles.iconsOverlay}>
        <View style={styles.iconSlot}>
          <Ionicons
            name="sunny"
            size={dimensions.iconSize}
            color={isDark ? "rgba(255,255,255,0.3)" : "#F59E0B"}
          />
        </View>
        <View style={styles.iconSlot}>
          <Ionicons
            name="moon"
            size={dimensions.iconSize}
            color={isDark ? "#A78BFA" : "rgba(15,23,42,0.3)"}
          />
        </View>
      </View>

      {/* Animated Sliding Circular Knob */}
      <Animated.View
        style={[
          styles.knob,
          {
            width: dimensions.knob,
            height: dimensions.knob,
            borderRadius: dimensions.knob / 2,
            backgroundColor: knobBgColor,
            borderColor: knobBorderColor,
            transform: [{ translateX }],
          },
        ]}
      >
        <Ionicons
          name={isDark ? "moon" : "sunny"}
          size={dimensions.iconSize - 2}
          color={isDark ? "#FFFFFF" : "#D97706"}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    borderWidth: 2,
    justifyContent: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  iconsOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  iconSlot: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  knob: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
