import { ThemeStore } from "../lib/storage.ts";

/**
 * The help page is static HTML. This script fills the version line and applies the theme the
 * Tabuzaur page uses, so both pages look the same. Outside the extension runtime (the render
 * harness opens the page from a file) there is no chrome.* API: the version stays unknown and
 * the theme follows the system.
 */
const version = document.getElementById("version");
if (version === null) {
  throw new Error("help.html has no #version element");
}
const api = (globalThis as { chrome?: typeof chrome }).chrome;
const dark = window.matchMedia("(prefers-color-scheme: dark)");

async function applyTheme(): Promise<void> {
  const theme = api === undefined ? "system" : await new ThemeStore(api.storage.local).load();
  document.documentElement.dataset.theme = theme === "system" ? (dark.matches ? "dark" : "light") : theme;
}

version.textContent = api === undefined ? "not installed (preview)" : api.runtime.getManifest().version;
dark.addEventListener("change", () => { void applyTheme(); });
applyTheme().catch((error: unknown) => {
  version.textContent = `theme not loaded: ${error instanceof Error ? error.message : String(error)}`;
});
