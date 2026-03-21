"use client";

import { useEffect, useSyncExternalStore } from "react";

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

function readPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

function subscribePreference(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) {
      callback();
    }
  };
  const handleMediaChange = () => {
    if (readPreference() === "system") {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  media.addEventListener("change", handleMediaChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    media.removeEventListener("change", handleMediaChange);
  };
}

export function ThemeToggle() {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribePreference,
    readPreference,
    () => "system",
  );

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  function updatePreference(nextPreference: ThemePreference) {
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
    light: "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--line)]",
    dark: "bg-[var(--info-subtle)] text-[var(--info)] border-[var(--line)]",
    system: "bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--line)]",
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
