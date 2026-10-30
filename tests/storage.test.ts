import { describe, expect, it } from "vitest";
import { Library } from "../src/lib/library.ts";
import { STORAGE_KEY } from "../src/lib/model.ts";
import { LibraryStore } from "../src/lib/storage.ts";
import { CountingIdSource, FixedClock, MemoryArea, noChanges, pageA, pageB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");

describe("LibraryStore", () => {
  it("loads undefined when nothing was saved", async () => {
    expect(await new LibraryStore(new MemoryArea(), noChanges).load()).toBeUndefined();
  });

  it("round-trips a library through the area under the storage key", async () => {
    const area = new MemoryArea();
    const store = new LibraryStore(area, noChanges);
    const library = Library.empty()
      .createCard("main", "Work", clock, new CountingIdSource())
      .addLink("id-1", pageA, undefined)
      .addLink("id-1", pageB, undefined);
    await store.save(library.toData());
    expect(Object.keys(await area.get(STORAGE_KEY))).toEqual([STORAGE_KEY]);
    expect(await store.load()).toEqual(library.toData());
    expect(area.has(LibraryStore.BACKUP_KEY)).toBe(false);
  });

  it("upgrades a document of 0.8 to one collection Main, saves it, and keeps the old one aside", async () => {
    const area = new MemoryArea();
    const old = { schemaVersion: 1, collections: [{ id: "a", name: "Work", createdAt: "x", pages: [pageA] }] };
    area.seed(STORAGE_KEY, old);
    const store = new LibraryStore(area, noChanges);
    const upgraded = {
      schemaVersion: 2,
      collections: [{ id: "main", name: "Main", cards: [{ id: "a", name: "Work", createdAt: "x", hue: 0, links: [pageA] }] }],
    };
    expect(await store.load()).toEqual(upgraded);
    expect(await area.get(STORAGE_KEY)).toEqual({ [STORAGE_KEY]: upgraded });
    expect(await area.get(LibraryStore.BACKUP_KEY)).toEqual({ [LibraryStore.BACKUP_KEY]: old });
  });

  it("fails loudly on a document it does not understand and changes nothing", async () => {
    const area = new MemoryArea();
    area.seed(STORAGE_KEY, { schemaVersion: 3, collections: [] });
    await expect(new LibraryStore(area, noChanges).load()).rejects.toThrow("unsupported schemaVersion 3");
    expect(area.has(LibraryStore.BACKUP_KEY)).toBe(false);
  });
});
