import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, LightTheme, StitchThemeType } from "../theme/stitch";

export type ThemeMode = "dark" | "light" | "system";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  theme: StitchThemeType;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "@pillcare_theme_mode_v1";

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "dark",
  isDark: true,
  theme: DarkTheme,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedMode === "dark" || savedMode === "light" || savedMode === "system") {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (e) {
        console.warn("Failed to load theme preference:", e);
      }
    })();
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch((e) =>
      console.warn("Failed to save theme preference:", e)
    );
  };

  const toggleTheme = () => {
    const nextMode = isDark ? "light" : "dark";
    setThemeMode(nextMode);
  };

  const isDark =
    themeMode === "system"
      ? systemColorScheme === "dark" || !systemColorScheme
      : themeMode === "dark";

  const theme: StitchThemeType = isDark ? DarkTheme : LightTheme;

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, theme, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
