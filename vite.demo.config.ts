import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "/credintel-ai/",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
  },
});
