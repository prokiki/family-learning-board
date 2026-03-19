"use client";

import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "family-learning-board-theme";

function resolveTheme(preference: ThemePreference) {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return preference;
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });

  useEffect(() => {
    applyTheme(preference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentPreference =
        (window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? "system";

      if (currentPreference === "system") {
        applyTheme("system");
        setPreference("system");
      }
    };

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [preference]);

  function updatePreference(nextPreference: ThemePreference) {
    setPreference(nextPreference);
    window.localStorage.setItem(STORAGE_KEY, nextPreference);
    applyTheme(nextPreference);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="切换主题">
      <button
        type="button"
        className="theme-toggle__button"
        data-active={preference === "light"}
        onClick={() => updatePreference("light")}
      >
        浅色
      </button>
      <button
        type="button"
        className="theme-toggle__button"
        data-active={preference === "dark"}
        onClick={() => updatePreference("dark")}
      >
        深色
      </button>
      <button
        type="button"
        className="theme-toggle__button"
        data-active={preference === "system"}
        onClick={() => updatePreference("system")}
      >
        跟随系统
      </button>
    </div>
  );
}
