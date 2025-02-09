import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "light";
    }
    return "light";
  });

  const [isMounted, setIsMounted] = useState(false); // ハイドレーション対策
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
    setIsMounted(true); // クライアント側でのみレンダリングさせる
  }, []);

  useEffect(() => {
    if (!isMounted) return; // 初回レンダリング時は適用しない
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    // color-scheme を適用
    document.documentElement.style.colorScheme = theme;
  }, [theme, isMounted]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {isMounted && children}
    </ThemeContext.Provider>
  );
};
