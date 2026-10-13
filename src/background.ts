import { ChromeTabBrowser } from "./lib/tabs.ts";

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
