import { RandomIdSource, SystemClock } from "../lib/model.ts";
import { SettingsStore } from "../lib/settings.ts";
import { LibraryStore } from "../lib/storage.ts";
import { ChromeTabBrowser } from "../lib/tabs.ts";
import { PageController } from "./page-controller.ts";
import { PageState } from "./page-state.ts";

/** The entry point of tabs.html: builds the stores and adapters on Chrome's APIs and starts the page. */
class TabsApp {
  /**
   * Starts the page in its #app element; a failure to load replaces the page with the message.
   * @throws Error when tabs.html has no #app element
   */
  static start(): void {
    const root = document.getElementById("app");
    if (root === null) {
      throw new Error("tabs.html has no #app element");
    }
    const area = chrome.storage.local;
    const state = new PageState(chrome.runtime.getURL("tabs.html"));
    const controller = new PageController(state, {
      root,
      persistence: new LibraryStore(area, chrome.storage.onChanged),
      settings: new SettingsStore(area),
      browser: new ChromeTabBrowser(),
      clock: new SystemClock(),
      ids: new RandomIdSource(),
    });
    controller.start().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      root.textContent = `Tabuzaur could not load its data: ${message}`;
    });
  }
}

TabsApp.start();
