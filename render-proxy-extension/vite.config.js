import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react({ include: /\.(js|jsx)$/ }),
    {
      name: "copy-extension-manifest",
      closeBundle() {
        mkdirSync(resolve(__dirname, "dist"), { recursive: true });
        copyFileSync(resolve(__dirname, "extension/manifest.json"), resolve(__dirname, "dist/manifest.json"));
        copyFileSync(resolve(__dirname, "extension/devtools.html"), resolve(__dirname, "dist/devtools.html"));
      }
    }
  ],
  root: "extension",
  publicDir: false,
  esbuild: {
    loader: "jsx",
    include: /.*\.(js|jsx)$/
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "extension/panel.html"),
        content: resolve(__dirname, "extension/content.js"),
        background: resolve(__dirname, "extension/background.js"),
        devtools: resolve(__dirname, "extension/devtools.js"),
        inject: resolve(__dirname, "extension/inject.js")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
