import { FlagStore, OPEN_IN_NEW_TAB_KEY } from "./lib/storage.ts";
import { ChromeTabBrowser, isBlankNewTab } from "./lib/tabs.ts";

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
 * Optional, off by default: a new blank tab shows the Tabuzaur page. The setting is read on every
 * event, because the service worker may have been stopped and restarted in between.
 */
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === undefined || !isBlankNewTab(tab.url, tab.pendingUrl)) {
    return;
  }
  const id = tab.id;
  new FlagStore(chrome.storage.local, OPEN_IN_NEW_TAB_KEY).load()
    .then((on) => (on ? chrome.tabs.update(id, { url: chrome.runtime.getURL("tabs.html") }) : undefined))
    .catch((error: unknown) => {
      console.error("Tabuzaur could not take over the new tab", error);
    });
});
