import { SettingsStore } from "./lib/settings.ts";
import { ChromeTabBrowser, OpenTabs } from "./lib/tabs.ts";

/**
 * The service worker: the toolbar button, the help page after install, one Tabuzaur tab per
 * window, and the optional new-tab page. It keeps no state: the settings are read on every event,
 * because Chrome may stop and restart the worker in between.
 */
class ServiceWorker {
  /** Registers every listener. */
  static register(): void {
    chrome.action.onClicked.addListener(() => {
      ServiceWorker.openPage();
    });
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        ServiceWorker.openHelp();
      }
    });
    chrome.tabs.onActivated.addListener((info) => {
      ServiceWorker.closeCopies(info.tabId);
    });
    chrome.tabs.onUpdated.addListener((tabId, change) => {
      if (change.url !== undefined) {
        ServiceWorker.closeCopies(tabId);
      }
    });
    chrome.tabs.onCreated.addListener((tab) => {
      ServiceWorker.onCreated(tab);
    });
  }

  /** The toolbar button opens the Tabuzaur page, or jumps to it when it is already open. */
  private static openPage(): void {
    const page = chrome.runtime.getURL("tabs.html");
    new ChromeTabBrowser().jumpTo(page).catch((error: unknown) => {
      console.error("Tabuzaur could not open its page", error);
    });
  }

  /** The help page opens once, right after the first install; never on an update. */
  private static openHelp(): void {
    const help = chrome.runtime.getURL("help.html");
    new ChromeTabBrowser().openInNewTab(help).catch((error: unknown) => {
      console.error("Tabuzaur could not open its help page", error);
    });
  }

  /**
   * One Tabuzaur tab per window: when a Tabuzaur tab is active, the window's other Tabuzaur tabs
   * close. Runs when a tab gains focus and when a tab navigates to the page (the help page's link,
   * a typed address). The page keeps no state in its tab, so closing a copy loses nothing.
   * @param tabId the tab that became active or changed its address
   */
  private static closeCopies(tabId: number): void {
    ServiceWorker.closeCopiesOf(tabId).catch((error: unknown) => {
      console.error("Tabuzaur could not close its other tabs", error);
    });
  }

  /**
   * Closes the other Tabuzaur tabs of the tab's window when the tab is an active Tabuzaur tab.
   * @param tabId the tab
   */
  private static async closeCopiesOf(tabId: number): Promise<void> {
    const pageUrl = chrome.runtime.getURL("tabs.html");
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || tab.url === undefined || !OpenTabs.isPageUrl(tab.url, pageUrl)) {
      return;
    }
    const open = await new ChromeTabBrowser().openTabs();
    const copies = OpenTabs.extraPageTabs(open, pageUrl, tab.windowId, tabId);
    if (copies.length > 0) {
      await chrome.tabs.remove(copies.map((t) => t.tabId));
    }
  }

  /**
   * Optional, off by default: a new blank tab shows the Tabuzaur page. When the window already
   * has a Tabuzaur tab, the new tab closes and that one becomes active instead.
   * @param tab the created tab
   */
  private static onCreated(tab: chrome.tabs.Tab): void {
    if (tab.id === undefined || !OpenTabs.isBlankNewTab(tab.url, tab.pendingUrl)) {
      return;
    }
    ServiceWorker.takeOver(tab.id, tab.windowId).catch((error: unknown) => {
      console.error("Tabuzaur could not take over the new tab", error);
    });
  }

  /**
   * Shows the page in a new blank tab, or lands on the window's Tabuzaur tab, when the option is on.
   * @param created the new tab
   * @param windowId its window
   */
  private static async takeOver(created: number, windowId: number): Promise<void> {
    const settings = await new SettingsStore(chrome.storage.local).load();
    if (!settings.newTabPage) {
      return;
    }
    const pageUrl = chrome.runtime.getURL("tabs.html");
    const browser = new ChromeTabBrowser();
    const home = OpenTabs.homeTab(await browser.openTabs(), pageUrl, windowId);
    if (home === undefined) {
      await chrome.tabs.update(created, { url: pageUrl });
      return;
    }
    await chrome.tabs.remove(created);
    await browser.activate(home);  // closeCopies then removes any further copy in the window
  }
}

ServiceWorker.register();
