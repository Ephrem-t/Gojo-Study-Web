import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
            return "react-vendor";
          }
          if (id.includes("firebase/database") || id.includes("@firebase/database")) {
            return "firebase-database-vendor";
          }
          if (id.includes("firebase/storage") || id.includes("@firebase/storage")) {
            return "firebase-storage-vendor";
          }
          if (id.includes("firebase") || id.includes("@firebase")) {
            return "firebase-vendor";
          }
          if (id.includes("recharts")) {
            return "charts-vendor";
          }
          if (id.includes("exceljs")) {
            return "excel-vendor";
          }
          if (id.includes("jspdf") || id.includes("jspdf-autotable")) {
            return "pdf-vendor";
          }
          if (id.includes("html2canvas") || id.includes("file-saver") || id.includes("dompurify")) {
            return "document-vendor";
          }
        },
      },
    },
  },
});
