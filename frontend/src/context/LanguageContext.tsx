import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "../i18n/locales/en.json";
import hi from "../i18n/locales/hi.json";
import bn from "../i18n/locales/bn.json";
import es from "../i18n/locales/es.json";
import fr from "../i18n/locales/fr.json";
import de from "../i18n/locales/de.json";

export type SupportedLocale = "en" | "hi" | "bn" | "es" | "fr" | "de";

export interface LanguageInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
];

const dictionaries: Record<SupportedLocale, any> = {
  en,
  hi,
  bn,
  es,
  fr,
  de,
};

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  currentLanguage: LanguageInfo;
  t: (path: string, defaultText?: string, params?: Record<string, any>) => string;
}

const STORAGE_KEY = "@pillcare_language_locale_v1";

const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLocale: () => {},
  currentLanguage: SUPPORTED_LANGUAGES[0],
  t: (path: string, defaultText?: string) => defaultText || path,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  useEffect(() => {
    (async () => {
      try {
        const savedLocale = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedLocale && savedLocale in dictionaries) {
          setLocaleState(savedLocale as SupportedLocale);
        }
      } catch (e) {
        console.warn("Failed to load language preference:", e);
      }
    })();
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    if (newLocale in dictionaries) {
      setLocaleState(newLocale);
      AsyncStorage.setItem(STORAGE_KEY, newLocale).catch((e) =>
        console.warn("Failed to save language preference:", e)
      );
    }
  };

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === locale) || SUPPORTED_LANGUAGES[0];

  const t = (path: string, defaultText?: string, params?: Record<string, any>): string => {
    const keys = path.split(".");
    let currentDict = dictionaries[locale] || dictionaries.en;
    let fallbackDict = dictionaries.en;

    for (const k of keys) {
      if (currentDict && typeof currentDict === "object" && k in currentDict) {
        currentDict = currentDict[k];
      } else {
        currentDict = undefined;
        break;
      }
    }

    let result = typeof currentDict === "string" ? currentDict : undefined;

    if (!result) {
      // Fallback to English
      for (const k of keys) {
        if (fallbackDict && typeof fallbackDict === "object" && k in fallbackDict) {
          fallbackDict = fallbackDict[k];
        } else {
          fallbackDict = undefined;
          break;
        }
      }
      if (typeof fallbackDict === "string") {
        result = fallbackDict;
      }
    }

    let strResult: string = result || defaultText || path;

    if (params) {
      Object.keys(params).forEach((key) => {
        const val = String(params[key]);
        strResult = strResult
          .replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val)
          .replace(new RegExp(`\\{${key}\\}`, "g"), val);
      });
    }

    return strResult;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, currentLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
