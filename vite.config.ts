import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      ".trycloudflare.com",
      ".loca.lt",
      "yards-matrix-jack-soft.trycloudflare.com",
    ],
  },
  preview: {
    allowedHosts: [
      ".trycloudflare.com",
      ".loca.lt",
      "yards-matrix-jack-soft.trycloudflare.com",
    ],
  },
});
