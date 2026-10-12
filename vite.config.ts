import { defineConfig } from "vitest/config";

// Two entries: the toolbar popup and the Tabuzaur page. Output names are fixed (no hashes) so manifest.json can name
// them; public/manifest.json is copied verbatim into dist/.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { popup: "popup.html", tabs: "tabs.html" },
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
