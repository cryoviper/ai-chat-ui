import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves from /ai-chat-ui/; Netlify serves from the root.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? "/ai-chat-ui/" : "/",
});
