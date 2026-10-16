import { describe, expect, it } from "vitest";
import { CollectionBook } from "../src/lib/collections.ts";
import { STORAGE_KEY } from "../src/lib/model.ts";
import { CARD_SIZE_KEY, CardSizeStore, FlagStore, LocalPersistence, parseStoreData, SIDEBAR_PINNED_KEY, THEME_KEY, ThemeStore } from "../src/lib/storage.ts";
import { CountingIdSource, FixedClock, MemoryArea, noChanges, pageA, pageB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");

describe("LocalPersistence", () => {
  it("loads undefined when nothing was saved", async () => {
    expect(await new LocalPersistence(new MemoryArea(), noChanges).load()).toBeUndefined();
  });

  it("round-trips a book through the area under the storage key", async () => {
    const area = new MemoryArea();
    const persistence = new LocalPersistence(area, noChanges);
    const book = CollectionBook.empty()
      .create("Work", clock, new CountingIdSource())
      .addPage("id-1", pageA)
      .addPage("id-1", pageB);
    await persistence.save(book.toData());
    expect(Object.keys(await area.get(STORAGE_KEY))).toEqual([STORAGE_KEY]);
    expect(await persistence.load()).toEqual(book.toData());
  });

  it("fails loudly on a document it does not understand", async () => {
    const area = new MemoryArea();
    area.seed(STORAGE_KEY, { schemaVersion: 2, collections: [] });
    await expect(new LocalPersistence(area, noChanges).load()).rejects.toThrow("unsupported schemaVersion 2");
  });
});

describe("parseStoreData", () => {
  const collection = { id: "a", name: "A", createdAt: "2026-10-12T10:00:00.000Z", pages: [pageA, pageB] };
  const valid = { schemaVersion: 1, collections: [collection] };

  it("accepts a valid document and drops unknown fields", () => {
    const parsed = parseStoreData({ ...valid, extra: 1 });
    expect(parsed).toEqual(valid);
    expect(parsed.collections[0]?.pages[0]).toEqual(pageA);
    expect("favIconUrl" in (parsed.collections[0]?.pages[0] ?? {})).toBe(false);
  });

  it("keeps a valid hue and rejects a bad one", () => {
    expect(parseStoreData({ schemaVersion: 1, collections: [{ ...collection, hue: 15 }] }).collections[0]?.hue).toBe(15);
    for (const hue of [16, -1, 1.5, "3"]) {
      expect(() => parseStoreData({ schemaVersion: 1, collections: [{ ...collection, hue }] })).toThrow("collections[0].hue is not an integer in 0..15");
    }
  });

  it("reads the pre-0.1.0 field name tabs as pages", () => {
    const { pages, ...rest } = collection;
    expect(parseStoreData({ schemaVersion: 1, collections: [{ ...rest, tabs: pages }] })).toEqual(valid);
  });

  it.each([
    [null, "store is not an object"],
    [[], "store is not an object"],
    [{ schemaVersion: 1 }, "store.collections is not an array"],
    [{ schemaVersion: 1, collections: [1] }, "collections[0] is not an object"],
    [{ schemaVersion: 1, collections: [{ ...collection, id: 1 }] }, "collections[0].id is not a string"],
    [{ schemaVersion: 1, collections: [{ ...collection, pages: {} }] }, "collections[0].pages is not an array"],
    [{ schemaVersion: 1, collections: [{ ...collection, pages: [{ title: "t" }] }] }, "collections[0].pages[0].url is not a string"],
    [{ schemaVersion: 1, collections: [{ ...collection, pages: [{ ...pageA, favIconUrl: 3 }] }] }, "collections[0].pages[0].favIconUrl is not a string"],
  ])("rejects %j", (raw, message) => {
    expect(() => parseStoreData(raw)).toThrow(message);
  });
});

describe("ThemeStore", () => {
  it("is system until something is saved, then round-trips the choice", async () => {
    const area = new MemoryArea();
    const store = new ThemeStore(area);
    expect(await store.load()).toBe("system");
    await store.save("dark");
    expect(await store.load()).toBe("dark");
    expect(Object.keys(await area.get(STORAGE_KEY))).toEqual([]);
  });

  it("fails on a value it does not know", async () => {
    const area = new MemoryArea();
    area.seed(THEME_KEY, "sepia");
    await expect(new ThemeStore(area).load()).rejects.toThrow('unknown theme "sepia"');
  });
});

describe("CardSizeStore", () => {
  it("is medium until saved, then round-trips, under its own key", async () => {
    const area = new MemoryArea();
    const store = new CardSizeStore(area);
    expect(await store.load()).toBe("medium");
    await store.save("large");
    expect(await store.load()).toBe("large");
    expect(await area.get(CARD_SIZE_KEY)).toEqual({ [CARD_SIZE_KEY]: "large" });
  });

  it("rejects a value that is not one of the three steps", async () => {
    const area = new MemoryArea();
    await area.set({ [CARD_SIZE_KEY]: 320 });
    await expect(new CardSizeStore(area).load()).rejects.toThrow("unknown collection width 320");
  });
});

describe("FlagStore", () => {
  it("is false until saved, then round-trips, under its own key", async () => {
    const area = new MemoryArea();
    const store = new FlagStore(area, SIDEBAR_PINNED_KEY);
    expect(await store.load()).toBe(false);
    await store.save(true);
    expect(await store.load()).toBe(true);
    expect(Object.keys(await area.get(STORAGE_KEY))).toEqual([]);
  });

  it("fails on a value that is not a boolean", async () => {
    const area = new MemoryArea();
    area.seed(SIDEBAR_PINNED_KEY, "yes");
    await expect(new FlagStore(area, SIDEBAR_PINNED_KEY).load()).rejects.toThrow('tabuzaur-sidebar-pinned is not a boolean: "yes"');
  });
});
