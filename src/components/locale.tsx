"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
export type Locale = "zh" | "en";
export type Translate = (zh: string, en: string) => string;
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}>({ locale: "zh", setLocale: () => {}, t: (zh) => zh });
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, update] = useState<Locale>("zh");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("orbit.locale");
      if (saved === "zh" || saved === "en") update(saved);
    } catch {}
    const sync = (event: StorageEvent) => {
      if (
        event.key === "orbit.locale" &&
        (event.newValue === "zh" || event.newValue === "en")
      )
        update(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title =
      locale === "zh" ? "ORBIT | 地址观测" : "ORBIT | IP Observatory";
  }, [locale]);
  const setLocale = (value: Locale) => {
    update(value);
    try {
      localStorage.setItem("orbit.locale", value);
    } catch {}
  };
  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, t: (zh, en) => (locale === "zh" ? zh : en) }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  return useContext(LocaleContext);
}
