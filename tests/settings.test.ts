import { describe, expect, it } from "vitest";
import { SettingsStore } from "../src/lib/settings.ts";
import type { Settings } from "../src/lib/settings.ts";
import { MemoryArea } from "./fakes.ts";

const chosen: Settings = { theme: "dark", cardWidth: "large", panelPinned: true, newTabPage: true };

describe("SettingsStore", () => {
  it("gives the defaults until something is saved, then round-trips the record under one key", async () => {
    const area = new MemoryArea();
    const store = new SettingsStore(area);
    expect(await store.load()).toEqual({ theme: "system", cardWidth: "medium", panelPinned: false, newTabPage: false });
    await store.save(chosen);
    expect(await store.load()).toEqual(chosen);
    expect(await area.get(SettingsStore.KEY)).toEqual({ [SettingsStore.KEY]: chosen });
  });

  it("fails on a stored record with a missing or unknown value, naming the field", async () => {
    const area = new MemoryArea();
    area.seed(SettingsStore.KEY, { ...chosen, theme: "sepia" });
    await expect(new SettingsStore(area).load()).rejects.toThrow('settings.theme is not a theme: "sepia"');
    area.seed(SettingsStore.KEY, { ...chosen, cardWidth: 320 });
    await expect(new SettingsStore(area).load()).rejects.toThrow("settings.cardWidth is not a card width: 320");
    area.seed(SettingsStore.KEY, { theme: "dark", cardWidth: "large", newTabPage: true });
    await expect(new SettingsStore(area).load()).rejects.toThrow("settings.panelPinned is not a boolean: undefined");
    area.seed(SettingsStore.KEY, "dark");
    await expect(new SettingsStore(area).load()).rejects.toThrow("settings is not an object");
  });

  it("moves the four keys of 0.8 into the record once and removes them", async () => {
    const area = new MemoryArea();
    area.seed("tabuzaur-theme", "light");
    area.seed("tabuzaur-card-size", "small");
    area.seed("tabuzaur-sidebar-pinned", true);
    const store = new SettingsStore(area);
    const expected: Settings = { theme: "light", cardWidth: "small", panelPinned: true, newTabPage: false };
    expect(await store.load()).toEqual(expected);
    expect(await area.get(SettingsStore.KEY)).toEqual({ [SettingsStore.KEY]: expected });
    for (const key of ["tabuzaur-theme", "tabuzaur-card-size", "tabuzaur-sidebar-pinned", "tabuzaur-open-in-new-tab"]) {
      expect(area.has(key)).toBe(false);
    }
    expect(await store.load()).toEqual(expected);
  });

  it("fails on an old key with a value it does not know, and leaves the old keys in place", async () => {
    const area = new MemoryArea();
    area.seed("tabuzaur-open-in-new-tab", "yes");
    await expect(new SettingsStore(area).load()).rejects.toThrow('tabuzaur-open-in-new-tab is not a boolean: "yes"');
    expect(area.has("tabuzaur-open-in-new-tab")).toBe(true);
    expect(area.has(SettingsStore.KEY)).toBe(false);
  });
});
