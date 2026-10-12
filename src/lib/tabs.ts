import type { SavedTab } from "./model.ts";

/** A tab that is open right now. */
export interface OpenTab extends SavedTab {
  readonly tabId: number;
}

/** Reads and changes the browser's tabs. The Chrome adapter is the only implementation outside tests. */
export interface TabBrowser {
  /** Every tab of the window the popup belongs to, in tab-strip order, without tabs that have no URL yet. */
  currentWindowTabs(): Promise<readonly OpenTab[]>;
  /** Opens the URLs in a new window. */
  openInNewWindow(urls: readonly string[]): Promise<void>;
  /** Closes the tabs. When they are the whole window, a blank tab is opened first so the window stays. */
  close(tabs: readonly OpenTab[]): Promise<void>;
}

export class ChromeTabBrowser implements TabBrowser {
  async currentWindowTabs(): Promise<readonly OpenTab[]> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const open: OpenTab[] = [];
    for (const tab of tabs) {
      if (tab.id === undefined || tab.url === undefined || tab.url === "") {
        continue;
      }
      const saved: OpenTab = { tabId: tab.id, title: tab.title ?? tab.url, url: tab.url };
      open.push(tab.favIconUrl === undefined ? saved : { ...saved, favIconUrl: tab.favIconUrl });
    }
    return open;
  }

  async openInNewWindow(urls: readonly string[]): Promise<void> {
    if (urls.length === 0) {
      throw new Error("nothing to open");
    }
    await chrome.windows.create({ url: [...urls], focused: true });
  }

  async close(tabs: readonly OpenTab[]): Promise<void> {
    if (tabs.length === 0) {
      return;
    }
    const all = await chrome.tabs.query({ currentWindow: true });
    const closing = new Set(tabs.map((t) => t.tabId));
    const survivors = all.filter((t) => t.id !== undefined && !closing.has(t.id));
    if (survivors.length === 0) {
      await chrome.tabs.create({});
    }
    await chrome.tabs.remove([...closing]);
  }
}
