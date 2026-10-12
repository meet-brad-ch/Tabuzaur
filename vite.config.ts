import { defineConfig } from "vitest/config";

// The popup is the only entry. Output names are fixed (no hashes) so manifest.json can name
// them; public/manifest.json is copied verbatim into dist/.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { popup: "popup.html" },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
