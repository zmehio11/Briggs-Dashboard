import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// process.env.VITE_API_URL only picks up an actually-exported shell var --
// Vite doesn't auto-load .env/.env.local into this config file, only into
// import.meta.env for client code. loadEnv() reads the .env files too, so
// a plain VITE_API_URL=... in .env.local works for the dev proxy target.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": { target: env.VITE_API_URL || "http://localhost:4000", changeOrigin: true },
      },
    },
  };
});
