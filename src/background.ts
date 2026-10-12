import { ChromeTabBrowser } from "./lib/tabs.ts";

/** The toolbar button opens the Tabuzaur page, or jumps to it when it is already open. */
chrome.action.onClicked.addListener(() => {
  new ChromeTabBrowser().jumpTo(chrome.runtime.getURL("tabs.html")).catch((error: unknown) => {
    console.error("Tabuzaur could not open its page", error);
  });
});
