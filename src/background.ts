import { FlagStore, OPEN_IN_NEW_TAB_KEY } from "./lib/storage.ts";
import { ChromeTabBrowser, homeTab, isBlankNewTab } from "./lib/tabs.ts";

/** The toolbar button opens the Tabuzaur page, or jumps to it when it is already open. */
chrome.action.onClicked.addListener(() => {
  new ChromeTabBrowser().jumpTo(chrome.runtime.getURL("tabs.html")).catch((error: unknown) => {
    console.error("Tabuzaur could not open its page", error);
  });
});

/** The help page opens once, right after the first install; never on an update. */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") {
    return;
  }
  new ChromeTabBrowser().openInNewTab(chrome.runtime.getURL("help.html")).catch((error: unknown) => {
    console.error("Tabuzaur could not open its help page", error);
  });
});

/**
 * Optional, off by default: a new blank tab shows the Tabuzaur page. When the window already has a
 * Tabuzaur tab, the new tab closes and that one becomes active instead, so a window never piles
 * up copies of the page. The setting is read on every event, because the service worker may have
 * been stopped and restarted in between.
 */
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === undefined || !isBlankNewTab(tab.url, tab.pendingUrl)) {
    return;
  }
  const created = tab.id;
  const windowId = tab.windowId;
  const browser = new ChromeTabBrowser();
  new FlagStore(chrome.storage.local, OPEN_IN_NEW_TAB_KEY).load()
    .then(async (on) => {
      if (!on) {
        return;
      }
      const pageUrl = chrome.runtime.getURL("tabs.html");
      const home = homeTab(await browser.openTabs(), pageUrl, windowId);
      if (home === undefined) {
        await chrome.tabs.update(created, { url: pageUrl });
      } else {
        await browser.activate(home);
        await chrome.tabs.remove(created);
      }
    })
    .catch((error: unknown) => {
      console.error("Tabuzaur could not take over the new tab", error);
    });
});
