"use client";

import { useEffect, useState } from "react";

function getPreferredTheme() {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("fk-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const next = getPreferredTheme();
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("fk-theme", next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">
          {theme === "dark" ? "☾" : "☀"}
        </span>
      </span>
      <span className="theme-toggle__label">
        {theme === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
}
