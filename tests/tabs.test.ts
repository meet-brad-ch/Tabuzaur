import { describe, expect, it } from "vitest";
import type { OpenTab } from "../src/lib/tabs.ts";
import { OpenTabs } from "../src/lib/tabs.ts";

const first: OpenTab = { tabId: 1, windowId: 10, active: false, lastAccessed: 0, title: "A", url: "https://a.example/" };
const second: OpenTab = { tabId: 2, windowId: 20, active: true, lastAccessed: 0, title: "B", url: "https://b.example/x?y=1" };
const again: OpenTab = { tabId: 3, windowId: 20, active: false, lastAccessed: 0, title: "A again", url: "https://a.example/" };

describe("OpenTabs.find", () => {
  it("returns the first tab with exactly that url", () => {
    expect(OpenTabs.find([first, second, again], "https://a.example/")).toBe(first);
    expect(OpenTabs.find([first, second, again], "https://b.example/x?y=1")).toBe(second);
  });

  it("returns undefined when no tab shows the url, including near misses", () => {
    expect(OpenTabs.find([first, second], "https://a.example")).toBeUndefined();
    expect(OpenTabs.find([first, second], "https://b.example/x")).toBeUndefined();
    expect(OpenTabs.find([], "https://a.example/")).toBeUndefined();
  });
});

describe("OpenTabs.forLink", () => {
  const mailOld: OpenTab = { tabId: 11, windowId: 10, active: false, lastAccessed: 100, title: "Mail", url: "https://mail.example/u/0/#inbox" };
  const mailNew: OpenTab = { tabId: 12, windowId: 20, active: false, lastAccessed: 200, title: "Mail", url: "https://mail.example/u/1/#inbox" };
  const otherPort: OpenTab = { tabId: 13, windowId: 10, active: false, lastAccessed: 300, title: "Mail", url: "https://mail.example:8443/" };
  const tabs = [first, mailOld, mailNew, otherPort];

  it("takes the tab with exactly the address first", () => {
    expect(OpenTabs.forLink(tabs, { title: "M", url: "https://mail.example/u/0/#inbox" })).toBe(mailOld);
    expect(OpenTabs.forLink(tabs, { title: "M", url: "https://mail.example/u/0/#inbox", reuseSite: false })).toBe(mailOld);
  });

  it("else takes the last used tab on the same scheme, host and port", () => {
    expect(OpenTabs.forLink(tabs, { title: "M", url: "https://mail.example/settings" })).toBe(mailNew);
    expect(OpenTabs.forLink(tabs, { title: "M", url: "http://mail.example/settings" })).toBeUndefined();
  });

  it("takes no other tab on the site when the link opens only its own tab", () => {
    expect(OpenTabs.forLink(tabs, { title: "M", url: "https://mail.example/settings", reuseSite: false })).toBeUndefined();
  });

  it("does not reuse by site for an address that is not a web address", () => {
    const files: OpenTab = { ...first, tabId: 14, url: "file:///C:/a.txt" };
    expect(OpenTabs.forLink([files], { title: "F", url: "file:///C:/b.txt" })).toBeUndefined();
  });
});

const PAGE = "chrome-extension://abc/tabs.html";
const home10: OpenTab = { tabId: 5, windowId: 10, active: false, lastAccessed: 0, title: "Tabuzaur", url: PAGE };
const home10b: OpenTab = { tabId: 6, windowId: 10, active: true, lastAccessed: 0, title: "Tabuzaur", url: `${PAGE}#x` };
const home20: OpenTab = { tabId: 7, windowId: 20, active: false, lastAccessed: 0, title: "Tabuzaur", url: `${PAGE}?q=1` };

describe("OpenTabs.homeTab", () => {
  it("is the first Tabuzaur tab of that window, fragment or query ignored", () => {
    expect(OpenTabs.homeTab([first, home10, home10b], PAGE, 10)).toBe(home10);
    expect(OpenTabs.homeTab([first, home10b, home10], PAGE, 10)).toBe(home10b);
    expect(OpenTabs.homeTab([home10, home20], PAGE, 20)).toBe(home20);
  });

  it("is undefined when only other windows or other pages have one", () => {
    expect(OpenTabs.homeTab([home10, home20], PAGE, 30)).toBeUndefined();
    expect(OpenTabs.homeTab([first, second], PAGE, 10)).toBeUndefined();
    expect(OpenTabs.homeTab([{ ...home10, url: "chrome-extension://abc/help.html" }], PAGE, 10)).toBeUndefined();
    expect(OpenTabs.homeTab([], PAGE, 10)).toBeUndefined();
  });
});

describe("OpenTabs.extraPageTabs", () => {
  it("lists the window's other Tabuzaur tabs, in strip order, and nothing from other windows", () => {
    expect(OpenTabs.extraPageTabs([first, home10, home10b, home20], PAGE, 10, 6)).toEqual([home10]);
    expect(OpenTabs.extraPageTabs([first, home10, home10b, home20], PAGE, 10, 5)).toEqual([home10b]);
    expect(OpenTabs.extraPageTabs([home10, home20], PAGE, 20, 7)).toEqual([]);
    expect(OpenTabs.extraPageTabs([home10], PAGE, 10, 5)).toEqual([]);
  });
});

describe("OpenTabs.isPageUrl", () => {
  it("matches the page with or without a query or a fragment, and nothing else", () => {
    expect(OpenTabs.isPageUrl(PAGE, PAGE)).toBe(true);
    expect(OpenTabs.isPageUrl(`${PAGE}?q=1#top`, PAGE)).toBe(true);
    expect(OpenTabs.isPageUrl("chrome-extension://abc/help.html", PAGE)).toBe(false);
    expect(OpenTabs.isPageUrl(`${PAGE}x`, PAGE)).toBe(false);
  });
});

describe("OpenTabs.isBlankNewTab", () => {
  it("is true for Chrome's new-tab page, pending or loaded, with or without the slash", () => {
    expect(OpenTabs.isBlankNewTab(undefined, "chrome://newtab/")).toBe(true);
    expect(OpenTabs.isBlankNewTab("", "chrome://newtab")).toBe(true);
    expect(OpenTabs.isBlankNewTab("chrome://newtab/", undefined)).toBe(true);
  });

  it("is false for a tab opened on an address, or still unknown", () => {
    expect(OpenTabs.isBlankNewTab(undefined, "https://example.com/")).toBe(false);
    expect(OpenTabs.isBlankNewTab("https://example.com/", undefined)).toBe(false);
    expect(OpenTabs.isBlankNewTab("chrome://newtab/", "https://example.com/")).toBe(false);
    expect(OpenTabs.isBlankNewTab(undefined, undefined)).toBe(false);
    expect(OpenTabs.isBlankNewTab("", undefined)).toBe(false);
  });
});
