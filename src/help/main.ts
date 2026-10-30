import { SettingsStore } from "../lib/settings.ts";
import type { Theme } from "../lib/settings.ts";

/**
 * The help page is static HTML. This script fills the version line and applies the theme the
 * Tabuzaur page uses, so both pages look the same. Outside the extension runtime (the render
 * harness opens the page from a file) there is no chrome.* API: the version stays unknown and
 * the theme follows the system.
 */
class HelpPage {
  private readonly dark = window.matchMedia("(prefers-color-scheme: dark)");

  /**
   * Creates the page script.
   * @param version the element that shows the version or a failure
   * @param api the chrome.* API, undefined outside the extension
   */
  constructor(private readonly version: HTMLElement, private readonly api: typeof chrome | undefined) {}

  /**
   * Starts the script on the help page.
   * @throws Error when help.html has no #version element
   */
  static start(): void {
    const version = document.getElementById("version");
    if (version === null) {
      throw new Error("help.html has no #version element");
    }
    const api = (globalThis as { chrome?: typeof chrome }).chrome;
    new HelpPage(version, api).run();
  }

  /** Fills the version, turns chrome:// addresses into buttons, and follows the theme. */
  private run(): void {
    const api = this.api;
    this.version.textContent = api === undefined ? "not installed (preview)" : api.runtime.getManifest().version;
    if (api !== undefined) {
      this.linkChromePages(api);
    }
    this.dark.addEventListener("change", () => {
      this.applyThemeLater();
    });
    this.applyThemeLater();
  }

  /**
   * A link cannot navigate to a chrome:// address, but an extension page may open one through the
   * tabs API: every chrome:// address shown in the text becomes a button that does so.
   * @param api the chrome.* API
   */
  private linkChromePages(api: typeof chrome): void {
    for (const code of document.querySelectorAll("code")) {
      const address = code.textContent;
      if (address.startsWith("chrome://") && !address.includes("<")) {
        code.replaceWith(this.chromeButton(api, address));
      }
    }
  }

  /**
   * A button that opens a chrome:// page in a new tab.
   * @param api the chrome.* API
   * @param address the chrome:// address
   * @returns the button
   */
  private chromeButton(api: typeof chrome, address: string): HTMLButtonElement {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "chrome-link";
    open.textContent = address;
    open.title = `Open ${address} in a new tab`;
    open.addEventListener("click", () => {
      api.tabs.create({ url: address, active: true }).catch((error: unknown) => {
        this.version.textContent = `could not open ${address}: ${HelpPage.message(error)}`;
      });
    });
    return open;
  }

  /** Applies the theme; a failure shows in the version line. */
  private applyThemeLater(): void {
    this.applyTheme().catch((error: unknown) => {
      this.version.textContent = `theme not loaded: ${HelpPage.message(error)}`;
    });
  }

  /** Applies the theme the Tabuzaur page uses; "system" resolves to the system's choice. */
  private async applyTheme(): Promise<void> {
    let theme: Theme = "system";
    if (this.api !== undefined) {
      const settings = await new SettingsStore(this.api.storage.local).load();
      theme = settings.theme;
    }
    const system = this.dark.matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme === "system" ? system : theme;
  }

  /**
   * The text of a failure.
   * @param error what was thrown
   * @returns its message
   */
  private static message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

HelpPage.start();
