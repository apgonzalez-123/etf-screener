import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "client" | "desk";
export type Theme = "dark" | "light";

interface AppState {
  mode: Mode;
  setMode: (m: Mode) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  paletteOpen: boolean;
  setPaletteOpen: (b: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

function read<T extends string>(key: string, fallback: T, allowed: T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable: preference lasts for this session only */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Default by role in production (SSO claims); this build defaults to Desk.
  const [mode, setModeS] = useState<Mode>(() => read("ses.mode", "desk", ["client", "desk"]));
  const [theme, setThemeS] = useState<Theme>(() => read("ses.theme", "dark", ["dark", "light"]));
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.theme = theme;
  }, [mode, theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setMode = (m: Mode) => {
    setModeS(m);
    write("ses.mode", m);
  };
  const setTheme = (t: Theme) => {
    setThemeS(t);
    write("ses.theme", t);
  };

  return <Ctx.Provider value={{ mode, setMode, theme, setTheme, paletteOpen, setPaletteOpen }}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
