import { describe, expect, it } from "vitest";
import type { OpenTab } from "../src/lib/tabs.ts";
import { findOpenTab, isBlankNewTab } from "../src/lib/tabs.ts";

const first: OpenTab = { tabId: 1, windowId: 10, active: false, title: "A", url: "https://a.example/" };
const second: OpenTab = { tabId: 2, windowId: 20, active: true, title: "B", url: "https://b.example/x?y=1" };
const again: OpenTab = { tabId: 3, windowId: 20, active: false, title: "A again", url: "https://a.example/" };

describe("findOpenTab", () => {
  it("returns the first tab with exactly that url", () => {
    expect(findOpenTab([first, second, again], "https://a.example/")).toBe(first);
    expect(findOpenTab([first, second, again], "https://b.example/x?y=1")).toBe(second);
  });

  it("returns undefined when no tab shows the url, including near misses", () => {
    expect(findOpenTab([first, second], "https://a.example")).toBeUndefined();
    expect(findOpenTab([first, second], "https://b.example/x")).toBeUndefined();
    expect(findOpenTab([], "https://a.example/")).toBeUndefined();
  });
});

describe("isBlankNewTab", () => {
  it("is true for Chrome's new-tab page, pending or loaded, with or without the slash", () => {
    expect(isBlankNewTab(undefined, "chrome://newtab/")).toBe(true);
    expect(isBlankNewTab("", "chrome://newtab")).toBe(true);
    expect(isBlankNewTab("chrome://newtab/", undefined)).toBe(true);
  });

  it("is false for a tab opened on an address, or still unknown", () => {
    expect(isBlankNewTab(undefined, "https://example.com/")).toBe(false);
    expect(isBlankNewTab("https://example.com/", undefined)).toBe(false);
    expect(isBlankNewTab("chrome://newtab/", "https://example.com/")).toBe(false);
    expect(isBlankNewTab(undefined, undefined)).toBe(false);
    expect(isBlankNewTab("", undefined)).toBe(false);
  });
});
