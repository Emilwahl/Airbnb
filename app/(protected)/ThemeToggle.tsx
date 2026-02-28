"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "rental-tax-theme";

const getPreferredTheme = (): Theme => {
  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};

function LightModeIcon() {
  return (
    <svg viewBox="0 0 72 34" aria-hidden="true">
      <rect x="1" y="1" width="70" height="32" rx="16" fill="#2caec4" />
      <circle cx="17" cy="17" r="9" fill="#ffd22e" />
      <ellipse cx="45" cy="19" rx="12" ry="5.5" fill="#ffffff" />
      <circle cx="38" cy="18.5" r="5.2" fill="#ffffff" />
      <circle cx="50" cy="16.5" r="6.2" fill="#ffffff" />
      <circle cx="58" cy="18.5" r="4.2" fill="#ffffff" />
      <rect x="1" y="1" width="70" height="32" rx="16" fill="none" stroke="rgba(0,0,0,0.08)" />
    </svg>
  );
}

function DarkModeIcon() {
  return (
    <svg viewBox="0 0 72 34" aria-hidden="true">
      <rect x="1" y="1" width="70" height="32" rx="16" fill="#0f2e4d" />
      <circle cx="15" cy="12" r="1.4" fill="#7db0d6" />
      <circle cx="23" cy="9.5" r="1.1" fill="#5f8db5" />
      <circle cx="28" cy="14.5" r="1" fill="#7db0d6" />
      <path d="M22 24c3.2-6.8 8.8-7.5 15-2.4-5.2 2.8-10 3.6-15 2.4Z" fill="#1e4b71" opacity="0.8" />
      <circle cx="55" cy="16" r="8.8" fill="#f2ecd0" />
      <rect x="1" y="1" width="70" height="32" rx="16" fill="none" stroke="rgba(0,0,0,0.18)" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      aria-pressed={theme === "dark"}
    >
      <span className="theme-toggle-icon">{theme === "dark" ? <DarkModeIcon /> : <LightModeIcon />}</span>
      <span className="theme-toggle-text">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
