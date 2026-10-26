import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "blue-sky-public-theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light"; // light is the default, never system-derived
}

// Applied at module scope (runs once on import, before React's first paint
// in this client-rendered SPA) so there is no flash of the wrong theme —
// same reasoning the old wrapper-<div> approach used, just targeting the
// right element. See the comment below for why `<html>` specifically
// matters, not just "somewhere in the tree".
if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("dark", readStoredTheme() === "dark");
}

/**
 * One shared light/dark preference for the entire app — public site, login/
 * register/reset pages, admin dashboard, and family dashboard.
 *
 * The `dark` class goes on `<html>`, not a wrapper `<div>` inside the React
 * tree. That used to be the bug: `body { @apply bg-background text-foreground }`
 * sits OUTSIDE any in-tree wrapper (body is an ancestor of #root, not a
 * descendant), so body's own color/background always resolved the :root
 * (light) tokens regardless of theme. Any element with its own `text-*`/
 * `bg-*` class re-resolved correctly wherever it sat, but anything relying
 * on inherited color (a bare `<h2>`, `<p>` with no color class) inherited
 * body's permanently-light computed color — dark text landing on a dark
 * background painted by sibling elements that *did* set their own bg-*
 * class. Putting `.dark` on `<html>` makes body itself a descendant, so
 * `--foreground`/`--background` resolve correctly at the body level and
 * every inheriting element below it is correct for free — no need to add an
 * explicit `text-foreground` to every heading/paragraph in the app.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen">{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
