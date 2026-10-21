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

/**
 * One shared light/dark preference for the entire app — public site, login/
 * register/reset pages, admin dashboard, and family dashboard. The `dark`
 * class is applied to this provider's own wrapper element (not `<html>`),
 * which still works everywhere since this wraps the whole route tree. This
 * is a pure client-rendered SPA (no SSR), so reading localStorage in the
 * lazy useState initializer below runs before first paint — no
 * flash-of-wrong-theme script is needed. Defaults to light for anyone with
 * no stored preference yet, regardless of which route they land on first.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`min-h-screen ${theme === "dark" ? "dark" : ""}`}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
