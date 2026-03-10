import { useTheme } from "../context/ThemeContext";

export default function useDarkMode() {
  const { isDark, toggleTheme } = useTheme();
  return [isDark, toggleTheme];
}
