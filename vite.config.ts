import { defineConfig } from "vitest/config";

// Two entries: the Tabuzaur page and the service worker behind the toolbar button. Output names are fixed (no hashes) so manifest.json can name
// them; public/manifest.json is copied verbatim into dist/.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { tabs: "tabs.html", background: "src/background.ts" },
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
