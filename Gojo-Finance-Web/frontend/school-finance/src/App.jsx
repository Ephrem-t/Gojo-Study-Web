import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import AppRoutes from "./routes/AppRoutes";
import { ThemeProvider } from "./context/ThemeContext";
import { FinanceShellProvider } from "./context/FinanceShellContext";
import queryClient from "./queryClient";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FinanceShellProvider>
          <AppRoutes />
        </FinanceShellProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

