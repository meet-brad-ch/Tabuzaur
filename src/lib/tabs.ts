import type { SavedPage } from "./model.ts";

/** A tab that is open right now. */
export interface OpenTab extends SavedPage {
  readonly tabId: number;
  readonly windowId: number;
  /** The active tab of its window. */
  readonly active: boolean;
}

/** The open tab showing a URL, exact match, first in tab-strip order; undefined when none. */
export function findOpenTab(tabs: readonly OpenTab[], url: string): OpenTab | undefined {
  return tabs.find((t) => t.url === url);
}

/**
 * Whether a freshly created tab is Chrome's blank new-tab page (Ctrl+T, the + button), as opposed
 * to a tab opened on an address. Chrome reports the page as pendingUrl while it loads and as url
 * afterwards, with or without a trailing slash.
 */
export function isBlankNewTab(url: string | undefined, pendingUrl: string | undefined): boolean {
  const blank = (u: string | undefined): boolean => u === "chrome://newtab/" || u === "chrome://newtab";
  return blank(pendingUrl) || (pendingUrl === undefined && blank(url));
}

/**
 * The Tabuzaur tab already open in a window: the first one in tab-strip order showing the page,
 * with or without a query or a fragment. A new blank tab in that window jumps to it instead of
 * becoming a second copy. Undefined when the window has none.
 */
export function homeTab(tabs: readonly OpenTab[], pageUrl: string, windowId: number): OpenTab | undefined {
  return pageTabsIn(tabs, pageUrl, windowId)[0];
}

/** The Tabuzaur tabs of a window other than `keptTabId`: the copies that close when that one is active. */
export function extraPageTabs(tabs: readonly OpenTab[], pageUrl: string, windowId: number, keptTabId: number): OpenTab[] {
  return pageTabsIn(tabs, pageUrl, windowId).filter((t) => t.tabId !== keptTabId);
}

/** Whether the URL shows the page, with or without a query or a fragment. */
export function isPageUrl(url: string, pageUrl: string): boolean {
  return url.replace(/[?#].*$/, "") === pageUrl.replace(/[?#].*$/, "");
}

function pageTabsIn(tabs: readonly OpenTab[], pageUrl: string, windowId: number): OpenTab[] {
  return tabs.filter((t) => t.windowId === windowId && isPageUrl(t.url, pageUrl));
}

/** Reads and changes the browser's tabs. The Chrome adapter is the only implementation outside tests. */
export interface TabBrowser {
  /** Every open tab of every window, in window and tab-strip order, without tabs that have no URL yet. */
  openTabs(): Promise<readonly OpenTab[]>;
  /** The window the calling page lives in. */
  currentWindowId(): Promise<number>;
  /** Makes the tab active and focuses its window. */
  activate(tab: OpenTab): Promise<void>;
  openInNewTab(url: string): Promise<void>;
  /** Activates the open tab showing the URL, or opens the URL in a new tab. */
  jumpTo(url: string): Promise<void>;
  /** Calls the listener after any tab is created, removed, moved, updated or activated. */
  onChange(listener: () => void): void;
  /** The key Chrome assigned to the toolbar action, e.g. "Alt+T"; empty when none is assigned. */
  actionShortcut(): Promise<string>;
}

export class ChromeTabBrowser implements TabBrowser {
  async openTabs(): Promise<readonly OpenTab[]> {
    const tabs = await chrome.tabs.query({});
    const open: OpenTab[] = [];
    for (const tab of tabs) {
      if (tab.id === undefined || tab.url === undefined || tab.url === "") {
        continue;
      }
      const base: OpenTab = {
        tabId: tab.id,
        windowId: tab.windowId,
        active: tab.active,
        title: tab.title === undefined || tab.title === "" ? tab.url : tab.title,
        url: tab.url,
      };
      open.push(tab.favIconUrl === undefined || tab.favIconUrl === "" ? base : { ...base, favIconUrl: tab.favIconUrl });
    }
    return open;
  }

  async currentWindowId(): Promise<number> {
    const window = await chrome.windows.getCurrent();
    if (window.id === undefined) {
      throw new Error("the current window has no id");
    }
    return window.id;
  }

  async activate(tab: OpenTab): Promise<void> {
    await chrome.tabs.update(tab.tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  async openInNewTab(url: string): Promise<void> {
    await chrome.tabs.create({ url, active: true });
  }

  async jumpTo(url: string): Promise<void> {
    const open = findOpenTab(await this.openTabs(), url);
    if (open === undefined) {
      await this.openInNewTab(url);
    } else {
      await this.activate(open);
    }
  }

  async actionShortcut(): Promise<string> {
    const commands = await chrome.commands.getAll();
    const action = commands.find((c) => c.name === "_execute_action");
    if (action === undefined) {
      throw new Error("the manifest declares no _execute_action command");
    }
    return action.shortcut ?? "";
  }

  onChange(listener: () => void): void {
    const events: { addListener(callback: () => void): void }[] = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onActivated,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
    ];
    for (const event of events) {
      event.addListener(listener);
    }
  }
}
