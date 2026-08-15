import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify("https://karyuuhxeismshhxuokg.supabase.co"),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify("karyuuhxeismshhxuokg"),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify("sb_publishable_25BwU4iAs32JWOuQOZLm3A_ZZE3uClG"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },

}));
