import type { SavedPage } from "./model.ts";

/** A tab that is open right now. */
export interface OpenTab extends SavedPage {
  readonly tabId: number;
  readonly windowId: number;
  /** The active tab of its window. */
  readonly active: boolean;
}

/** Rules over the list of open tabs: finding a page's tab, Chrome's new-tab page, Tabuzaur's own tabs. */
export class OpenTabs {
  /**
   * The open tab showing a URL, exact match, first in tab-strip order.
   * @param tabs the open tabs
   * @param url the address to find
   * @returns that tab, or undefined when none shows it
   */
  static find(tabs: readonly OpenTab[], url: string): OpenTab | undefined {
    return tabs.find((t) => t.url === url);
  }

  /**
   * Whether a freshly created tab is Chrome's blank new-tab page (Ctrl+T, the + button), as opposed
   * to a tab opened on an address. Chrome reports the page as pendingUrl while it loads and as url
   * afterwards, with or without a trailing slash.
   * @param url the tab's url, if known
   * @param pendingUrl the url the tab is loading, if any
   * @returns true for the new-tab page
   */
  static isBlankNewTab(url: string | undefined, pendingUrl: string | undefined): boolean {
    if (pendingUrl !== undefined) {
      return OpenTabs.isNewTabPage(pendingUrl);
    }
    if (url === undefined) {
      return false;
    }
    return OpenTabs.isNewTabPage(url);
  }

  /**
   * The Tabuzaur tab already open in a window: the first one in tab-strip order. A new blank tab
   * in that window jumps to it instead of becoming a second copy.
   * @param tabs the open tabs
   * @param pageUrl the Tabuzaur page address
   * @param windowId the window to look in
   * @returns that tab, or undefined when the window has none
   */
  static homeTab(tabs: readonly OpenTab[], pageUrl: string, windowId: number): OpenTab | undefined {
    const pageTabs = OpenTabs.pageTabsIn(tabs, pageUrl, windowId);
    return pageTabs[0];
  }

  /**
   * The Tabuzaur tabs of a window other than the kept one: the copies that close when it is active.
   * @param tabs the open tabs
   * @param pageUrl the Tabuzaur page address
   * @param windowId the window to look in
   * @param keptTabId the tab that stays
   * @returns the copies in tab-strip order
   */
  static extraPageTabs(tabs: readonly OpenTab[], pageUrl: string, windowId: number, keptTabId: number): OpenTab[] {
    const pageTabs = OpenTabs.pageTabsIn(tabs, pageUrl, windowId);
    return pageTabs.filter((t) => t.tabId !== keptTabId);
  }

  /**
   * Whether the URL shows the page, with or without a query or a fragment.
   * @param url the address to test
   * @param pageUrl the page address
   * @returns true when both name the same page
   */
  static isPageUrl(url: string, pageUrl: string): boolean {
    const bare = url.replace(/[?#].*$/, "");
    const page = pageUrl.replace(/[?#].*$/, "");
    return bare === page;
  }

  /**
   * Whether the address is Chrome's new-tab page.
   * @param url an address
   * @returns true for chrome://newtab with or without the slash
   */
  private static isNewTabPage(url: string): boolean {
    return url === "chrome://newtab/" || url === "chrome://newtab";
  }

  /**
   * The Tabuzaur tabs of one window.
   * @param tabs the open tabs
   * @param pageUrl the page address
   * @param windowId the window
   * @returns those tabs in tab-strip order
   */
  private static pageTabsIn(tabs: readonly OpenTab[], pageUrl: string, windowId: number): OpenTab[] {
    return tabs.filter((t) => t.windowId === windowId && OpenTabs.isPageUrl(t.url, pageUrl));
  }
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

/** The TabBrowser on Chrome's tabs, windows and commands APIs. */
export class ChromeTabBrowser implements TabBrowser {
  /** @inheritdoc */
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

  /** @inheritdoc */
  async currentWindowId(): Promise<number> {
    const window = await chrome.windows.getCurrent();
    if (window.id === undefined) {
      throw new Error("the current window has no id");
    }
    return window.id;
  }

  /** @inheritdoc */
  async activate(tab: OpenTab): Promise<void> {
    await chrome.tabs.update(tab.tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  /** @inheritdoc */
  async openInNewTab(url: string): Promise<void> {
    await chrome.tabs.create({ url, active: true });
  }

  /** @inheritdoc */
  async jumpTo(url: string): Promise<void> {
    const tabs = await this.openTabs();
    const open = OpenTabs.find(tabs, url);
    if (open === undefined) {
      await this.openInNewTab(url);
    } else {
      await this.activate(open);
    }
  }

  /** @inheritdoc */
  async actionShortcut(): Promise<string> {
    const commands = await chrome.commands.getAll();
    const action = commands.find((c) => c.name === "_execute_action");
    if (action === undefined) {
      throw new Error("the manifest declares no _execute_action command");
    }
    return action.shortcut ?? "";
  }

  /** @inheritdoc */
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
