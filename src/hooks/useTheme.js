import { useCallback, useEffect, useRef, useState } from "react";
import { THEME_STORAGE_KEY } from "../config/theme.js";

function storedTheme() {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const explicitPreference = useRef(Boolean(storedTheme()));
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || storedTheme() || systemTheme(),
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0A0C0F" : "#FFFFFF");
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event) => {
      if (!explicitPreference.current) {
        setTheme(event.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      explicitPreference.current = true;
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
