// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // You can keep this or change back to default 5173
  server: {
    host: true,           // "true" is same as "::" - allows network access
    port: 5173,           // ← Most common Vite port (or keep 8080 if you prefer)
  },

  plugins: [
    react(),              // Fast React plugin using SWC
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // Nice @/components/... imports
    },
  },

  // Optional: good defaults for production
  build: {
    outDir: "dist",
    sourcemap: true,      // Helpful for debugging production issues
  },
});