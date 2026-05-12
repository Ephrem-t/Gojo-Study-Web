import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "./context/ThemeContext";
import { FinanceShellProvider } from "./context/FinanceShellContext";

export default function App() {
  return (
    <ThemeProvider>
      <FinanceShellProvider>
        <AppRoutes />
      </FinanceShellProvider>
    </ThemeProvider>
  );
}

