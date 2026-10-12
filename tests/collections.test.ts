import { describe, expect, it } from "vitest";
import { CollectionBook } from "../src/lib/collections.ts";
import { SCHEMA_VERSION } from "../src/lib/model.ts";
import { CountingIdSource, FixedClock, tabA, tabB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");

function bookWithTwo(): CollectionBook {
  const ids = new CountingIdSource();
  return CollectionBook.empty()
    .add("First", [tabA], clock, ids)
    .add("Second", [tabA, tabB], clock, ids);
}

describe("CollectionBook.add", () => {
  it("puts the new collection on top with a trimmed name, id and timestamp", () => {
    const book = bookWithTwo();
    expect(book.collections.map((c) => c.name)).toEqual(["Second", "First"]);
    expect(book.collections[0]).toEqual({
      id: "id-2",
      name: "Second",
      createdAt: "2026-10-12T10:00:00.000Z",
      tabs: [tabA, tabB],
    });
  });

  it("trims the name", () => {
    const book = CollectionBook.empty().add("  Work  ", [tabA], clock, new CountingIdSource());
    expect(book.collections[0]?.name).toBe("Work");
  });

  it("rejects an empty name and an empty tab list", () => {
    const ids = new CountingIdSource();
    expect(() => CollectionBook.empty().add("   ", [tabA], clock, ids)).toThrow("needs a name");
    expect(() => CollectionBook.empty().add("Work", [], clock, ids)).toThrow("at least one tab");
  });

  it("does not change the original book", () => {
    const empty = CollectionBook.empty();
    empty.add("Work", [tabA], clock, new CountingIdSource());
    expect(empty.collections).toEqual([]);
  });
});

describe("CollectionBook.remove / rename / get", () => {
  it("removes by id and keeps the order of the rest", () => {
    expect(bookWithTwo().remove("id-2").collections.map((c) => c.id)).toEqual(["id-1"]);
  });

  it("renames with trimming", () => {
    expect(bookWithTwo().rename("id-1", " Renamed ").get("id-1").name).toBe("Renamed");
  });

  it("fails on an unknown id or an empty name", () => {
    expect(() => bookWithTwo().remove("nope")).toThrow("no collection with id nope");
    expect(() => bookWithTwo().rename("nope", "x")).toThrow("no collection with id nope");
    expect(() => bookWithTwo().rename("id-1", "")).toThrow("needs a name");
  });
});

describe("CollectionBook.removeTab", () => {
  it("removes one tab by index", () => {
    expect(bookWithTwo().removeTab("id-2", 0).get("id-2").tabs).toEqual([tabB]);
  });

  it("removes the collection when its last tab goes", () => {
    expect(bookWithTwo().removeTab("id-1", 0).collections.map((c) => c.id)).toEqual(["id-2"]);
  });

  it("rejects an index that is out of range or not an integer", () => {
    expect(() => bookWithTwo().removeTab("id-1", 1)).toThrow("no tab at index 1");
    expect(() => bookWithTwo().removeTab("id-1", -1)).toThrow("no tab at index -1");
    expect(() => bookWithTwo().removeTab("id-1", 0.5)).toThrow("no tab at index 0.5");
  });
});

describe("CollectionBook.search", () => {
  it("returns everything for a blank query", () => {
    expect(bookWithTwo().search("  ").length).toBe(2);
  });

  it("matches the name, a tab title and a tab url, case-insensitively", () => {
    const book = bookWithTwo();
    expect(book.search("FIRST").map((c) => c.id)).toEqual(["id-1"]);
    expect(book.search("docs").map((c) => c.id)).toEqual(["id-2"]);
    expect(book.search("example.com").map((c) => c.id)).toEqual(["id-2", "id-1"]);
    expect(book.search("nothing")).toEqual([]);
  });
});

describe("CollectionBook data round-trip", () => {
  it("toData and fromData are inverse", () => {
    const data = bookWithTwo().toData();
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(CollectionBook.fromData(data).collections).toEqual(data.collections);
  });
});
