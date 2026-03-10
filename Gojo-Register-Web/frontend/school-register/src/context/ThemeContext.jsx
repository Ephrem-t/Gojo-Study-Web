import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const ThemeContext = createContext();

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  const legacyDarkMode = localStorage.getItem("darkMode");
  if (legacyDarkMode === "true") {
    return "dark";
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const isDark = theme === "dark";

    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("light-mode", !isDark);

    localStorage.setItem("theme", theme);
    localStorage.setItem("darkMode", String(isDark));
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  const value = useMemo(() => ({
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
