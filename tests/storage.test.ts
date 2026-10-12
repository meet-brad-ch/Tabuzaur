import { describe, expect, it } from "vitest";
import { CollectionBook } from "../src/lib/collections.ts";
import { STORAGE_KEY } from "../src/lib/model.ts";
import { LocalPersistence, parseStoreData } from "../src/lib/storage.ts";
import { CountingIdSource, FixedClock, MemoryArea, tabA, tabB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");

describe("LocalPersistence", () => {
  it("loads undefined when nothing was saved", async () => {
    expect(await new LocalPersistence(new MemoryArea()).load()).toBeUndefined();
  });

  it("round-trips a book through the area under the storage key", async () => {
    const area = new MemoryArea();
    const persistence = new LocalPersistence(area);
    const book = CollectionBook.empty().add("Work", [tabA, tabB], clock, new CountingIdSource());
    await persistence.save(book.toData());
    expect(Object.keys(await area.get(STORAGE_KEY))).toEqual([STORAGE_KEY]);
    expect(await persistence.load()).toEqual(book.toData());
  });

  it("fails loudly on a document it does not understand", async () => {
    const area = new MemoryArea();
    area.seed(STORAGE_KEY, { schemaVersion: 2, collections: [] });
    await expect(new LocalPersistence(area).load()).rejects.toThrow("unsupported schemaVersion 2");
  });
});

describe("parseStoreData", () => {
  const collection = { id: "a", name: "A", createdAt: "2026-10-12T10:00:00.000Z", tabs: [tabA, tabB] };
  const valid = { schemaVersion: 1, collections: [collection] };

  it("accepts a valid document and drops unknown fields", () => {
    const parsed = parseStoreData({ ...valid, extra: 1 });
    expect(parsed).toEqual(valid);
    expect(parsed.collections[0]?.tabs[0]).toEqual(tabA);
    expect("favIconUrl" in (parsed.collections[0]?.tabs[0] ?? {})).toBe(false);
  });

  it.each([
    [null, "store is not an object"],
    [[], "store is not an object"],
    [{ schemaVersion: 1 }, "store.collections is not an array"],
    [{ schemaVersion: 1, collections: [1] }, "collections[0] is not an object"],
    [{ schemaVersion: 1, collections: [{ ...collection, id: 1 }] }, "collections[0].id is not a string"],
    [{ schemaVersion: 1, collections: [{ ...collection, tabs: {} }] }, "collections[0].tabs is not an array"],
    [{ schemaVersion: 1, collections: [{ ...collection, tabs: [{ title: "t" }] }] }, "collections[0].tabs[0].url is not a string"],
    [{ schemaVersion: 1, collections: [{ ...collection, tabs: [{ ...tabA, favIconUrl: 3 }] }] }, "collections[0].tabs[0].favIconUrl is not a string"],
  ])("rejects %j", (raw, message) => {
    expect(() => parseStoreData(raw)).toThrow(message);
  });
});
