import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@monaco-editor/react"],
    // xterm is NOT installed — exclude to prevent pre-bundle errors
    exclude: ["@xterm/xterm", "@xterm/addon-fit"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "monaco-editor": ["@monaco-editor/react"],
        },
      },
    },
  },
});
