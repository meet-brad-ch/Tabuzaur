import { SettingsStore } from "../lib/settings.ts";
import type { Theme } from "../lib/settings.ts";

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
  let theme: Theme = "system";
  if (api !== undefined) {
    const settings = await new SettingsStore(api.storage.local).load();
    theme = settings.theme;
  }
  const system = dark.matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme === "system" ? system : theme;
}

version.textContent = api === undefined ? "not installed (preview)" : api.runtime.getManifest().version;

// A link cannot navigate to a chrome:// address, but an extension page may open one through the
// tabs API: every chrome:// address shown in the text becomes a button that does so.
if (api !== undefined) {
  for (const code of document.querySelectorAll("code")) {
    const address = code.textContent;
    if (!address.startsWith("chrome://") || address.includes("<")) {
      continue;
    }
    const open = document.createElement("button");
    open.type = "button";
    open.className = "chrome-link";
    open.textContent = address;
    open.title = `Open ${address} in a new tab`;
    open.addEventListener("click", () => {
      api.tabs.create({ url: address, active: true }).catch((error: unknown) => {
        version.textContent = `could not open ${address}: ${error instanceof Error ? error.message : String(error)}`;
      });
    });
    code.replaceWith(open);
  }
}
dark.addEventListener("change", () => { void applyTheme(); });
applyTheme().catch((error: unknown) => {
  version.textContent = `theme not loaded: ${error instanceof Error ? error.message : String(error)}`;
});
