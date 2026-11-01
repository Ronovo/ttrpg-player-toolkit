import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` sends login and dice uploads to the Flask server (`flask --app server run --port 8080`).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/sso": "http://127.0.0.1:8080",
    },
  },
});
