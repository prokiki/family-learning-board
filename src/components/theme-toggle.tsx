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

  const nextPreferenceMap: Record<ThemePreference, ThemePreference> = {
    light: "system",
    dark: "light",
    system: "dark",
  };

  const labelMap: Record<ThemePreference, string> = {
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
  };

  const iconMap: Record<ThemePreference, string> = {
    light: "☀",
    dark: "☾",
    system: "◑",
  };

  const toneClassMap: Record<ThemePreference, string> = {
    light:
      "bg-[var(--primary-light)] text-[var(--primary)] border-[color:rgba(26,138,125,0.22)]",
    dark:
      "bg-[var(--info-subtle)] text-[var(--info)] border-[color:rgba(125,178,255,0.3)]",
    system:
      "bg-[var(--warning-subtle)] text-[var(--warning)] border-[color:rgba(234,140,0,0.24)]",
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${toneClassMap[preference]}`}
      onClick={() => updatePreference(nextPreferenceMap[preference])}
      title={`当前：${labelMap[preference]}，点击切换`}
      aria-label={`当前主题：${labelMap[preference]}，点击切换`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {iconMap[preference]}
      </span>
      <span className="theme-toggle__label">{labelMap[preference]}</span>
    </button>
  );
}
