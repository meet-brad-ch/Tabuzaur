import { defineConfig } from "vitest/config";

// Three entries: the Tabuzaur page, the help page and the service worker behind the toolbar button. Output names are fixed (no hashes) so manifest.json can name
// them; public/manifest.json is copied verbatim into dist/.
export default defineConfig({
  base: "./",  // relative asset paths: the pages work from chrome-extension:// and from a file (render tool)
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { tabs: "tabs.html", help: "help.html", background: "src/background.ts" },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
