import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://0.0.0.0:3002",
        changeOrigin: true,
      },
    },
  },
});
