"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return t;
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(t);
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  html.classList.add(resolved);
}

/**
 * useTheme — Gestion du thème light / dark / system.
 *
 * - Au premier chargement, si l'utilisateur a déjà fait un choix → on le respecte (localStorage).
 * - Sinon → on suit la préférence système (prefers-color-scheme).
 * - Les classes .dark / .light sont posées sur <html>.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null) as Theme | null;
    const initial: Theme =
      stored === "dark" || stored === "light" ? stored : "system";
    /* eslint-disable react-hooks/set-state-in-effect -- restauration thème depuis localStorage / OS */
    setThemeState(initial);
    /* eslint-enable react-hooks/set-state-in-effect */
    applyTheme(initial);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (t === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, t);
    }
    applyTheme(t);
  };

  const toggleTheme = () => {
    const resolved = resolveTheme(theme);
    setTheme(resolved === "dark" ? "light" : "dark");
  };

  const isDark = resolveTheme(theme) === "dark";

  return { theme, isDark, setTheme, toggleTheme };
}

export default useTheme;
