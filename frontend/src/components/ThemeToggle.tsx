import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem("burnadette-theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("burnadette-theme", theme); } catch { /* Theme still works without storage. */ }
  }, [theme]);
  useEffect(() => () => {
    clearTimeout(timer.current);
    document.documentElement.classList.remove("theme-transition");
  }, []);
  return <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => {
    clearTimeout(timer.current);
    document.documentElement.classList.add("theme-transition");
    setTheme((value) => value === "dark" ? "light" : "dark");
    timer.current = setTimeout(() => document.documentElement.classList.remove("theme-transition"), 260);
  }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z" />}
    </svg>
  </button>;
}
