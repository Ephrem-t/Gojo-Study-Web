import React, { useEffect } from "react";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "./context/ThemeContext";
import { setupSchoolScopedRtdbRouting } from "./utils/schoolDbRouting";

export default function App() {
  useEffect(() => {
    setupSchoolScopedRtdbRouting();
  }, []);

  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  );
}
