import { describe, expect, it } from "vitest";
import { CollectionBook, findMatch } from "../src/lib/collections.ts";
import { SCHEMA_VERSION } from "../src/lib/model.ts";
import { CountingIdSource, FixedClock, pageA, pageB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");

/** "First" holds pageA; "Second" holds pageA and pageB. */
function bookWithTwo(): CollectionBook {
  const ids = new CountingIdSource();
  return CollectionBook.empty()
    .create("First", clock, ids)
    .create("Second", clock, ids)
    .addPage("id-1", pageA)
    .addPage("id-2", pageA)
    .addPage("id-2", pageB);
}

describe("CollectionBook.create", () => {
  it("appends an empty collection with a trimmed name, id and timestamp", () => {
    const book = CollectionBook.empty().create("  Work  ", clock, new CountingIdSource());
    expect(book.collections).toEqual([
      { id: "id-1", name: "Work", createdAt: "2026-10-12T10:00:00.000Z", pages: [] },
    ]);
    expect(bookWithTwo().collections.map((c) => c.name)).toEqual(["First", "Second"]);
  });

  it("rejects an empty name", () => {
    expect(() => CollectionBook.empty().create("   ", clock, new CountingIdSource())).toThrow("needs a name");
  });

  it("does not change the original book", () => {
    const empty = CollectionBook.empty();
    empty.create("Work", clock, new CountingIdSource());
    expect(empty.collections).toEqual([]);
  });
});

describe("CollectionBook.remove / rename / get", () => {
  it("removes by id and keeps the order of the rest", () => {
    expect(bookWithTwo().remove("id-1").collections.map((c) => c.id)).toEqual(["id-2"]);
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

describe("CollectionBook.addPage", () => {
  it("appends in insertion order", () => {
    expect(bookWithTwo().get("id-2").pages).toEqual([pageA, pageB]);
  });

  it("rejects a url already in that collection, naming the collection", () => {
    expect(() => bookWithTwo().addPage("id-1", { ...pageA, title: "other title" })).toThrow("already in First");
  });

  it("allows the same url in another collection", () => {
    expect(bookWithTwo().addPage("id-1", pageB).get("id-1").pages).toEqual([pageA, pageB]);
  });

  it("fails on an unknown id", () => {
    expect(() => bookWithTwo().addPage("nope", pageA)).toThrow("no collection with id nope");
  });
});

describe("CollectionBook.removePage", () => {
  it("removes one page by index", () => {
    expect(bookWithTwo().removePage("id-2", 0).get("id-2").pages).toEqual([pageB]);
  });

  it("keeps an emptied collection", () => {
    const book = bookWithTwo().removePage("id-1", 0);
    expect(book.get("id-1").pages).toEqual([]);
    expect(book.collections.length).toBe(2);
  });

  it("rejects an index that is out of range or not an integer", () => {
    expect(() => bookWithTwo().removePage("id-1", 1)).toThrow("no page at index 1");
    expect(() => bookWithTwo().removePage("id-1", -1)).toThrow("no page at index -1");
    expect(() => bookWithTwo().removePage("id-1", 0.5)).toThrow("no page at index 0.5");
  });
});

describe("CollectionBook.editPage", () => {
  it("changes that page's title and url, trimmed", () => {
    const book = bookWithTwo().editPage("id-2", 1, "  New title ", " https://new.example/p ");
    expect(book.get("id-2").pages).toEqual([pageA, { ...pageB, title: "New title", url: "https://new.example/p" }]);
    expect(book.get("id-1").pages).toEqual([pageA]);
  });

  it("keeps the url when it is unchanged", () => {
    expect(bookWithTwo().editPage("id-2", 1, "x", pageB.url).get("id-2").pages[1]?.url).toBe(pageB.url);
  });

  it("rejects an empty title, a bad url, a url of another page in the collection, or a missing page", () => {
    expect(() => bookWithTwo().editPage("id-2", 1, " ", pageB.url)).toThrow("a link needs a title");
    expect(() => bookWithTwo().editPage("id-2", 1, "x", "not a url")).toThrow("not a valid url: not a url");
    expect(() => bookWithTwo().editPage("id-2", 1, "x", pageA.url)).toThrow("already in Second");
    expect(() => bookWithTwo().editPage("id-1", 1, "x", pageA.url)).toThrow("no page at index 1");
  });
});

describe("CollectionBook.reorderPage", () => {
  const pageC = { title: "C", url: "https://c.example/" };
  const three = (): CollectionBook => bookWithTwo().addPage("id-2", pageC);
  const urls = (book: CollectionBook): string[] => book.get("id-2").pages.map((p) => p.url);

  it("moves a page down: to is the slot before the move", () => {
    expect(urls(three().reorderPage("id-2", 0, 2))).toEqual([pageB.url, pageA.url, pageC.url]);
    expect(urls(three().reorderPage("id-2", 0, 3))).toEqual([pageB.url, pageC.url, pageA.url]);
  });

  it("moves a page up", () => {
    expect(urls(three().reorderPage("id-2", 2, 0))).toEqual([pageC.url, pageA.url, pageB.url]);
    expect(urls(three().reorderPage("id-2", 2, 1))).toEqual([pageA.url, pageC.url, pageB.url]);
  });

  it("changes nothing when the page lands on its own place", () => {
    expect(urls(three().reorderPage("id-2", 1, 1))).toEqual([pageA.url, pageB.url, pageC.url]);
    expect(urls(three().reorderPage("id-2", 1, 2))).toEqual([pageA.url, pageB.url, pageC.url]);
  });

  it("rejects a missing page or an impossible place", () => {
    expect(() => three().reorderPage("id-2", 3, 0)).toThrow("no page at index 3");
    expect(() => three().reorderPage("id-2", 0, 4)).toThrow("no place at index 4");
    expect(() => three().reorderPage("id-2", 0, -1)).toThrow("no place at index -1");
  });
});

describe("CollectionBook.movePage", () => {
  it("appends the page to the target and removes it from the source", () => {
    const book = bookWithTwo().movePage("id-2", 1, "id-1");
    expect(book.get("id-1").pages).toEqual([pageA, pageB]);
    expect(book.get("id-2").pages).toEqual([pageA]);
  });

  it("changes nothing when source and target are the same collection and no place is given", () => {
    const book = bookWithTwo();
    expect(book.movePage("id-2", 0, "id-2")).toBe(book);
  });

  it("reorders when source and target are the same collection and a place is given", () => {
    expect(bookWithTwo().movePage("id-2", 0, "id-2", 2).get("id-2").pages).toEqual([pageB, pageA]);
  });

  it("inserts at the given place in the target", () => {
    const book = bookWithTwo().movePage("id-2", 1, "id-1", 0);
    expect(book.get("id-1").pages).toEqual([pageB, pageA]);
    expect(book.get("id-2").pages).toEqual([pageA]);
  });

  it("rejects a url already in the target, leaving the source untouched", () => {
    expect(() => bookWithTwo().movePage("id-2", 0, "id-1")).toThrow("already in First");
  });

  it("fails on a missing page or collection", () => {
    expect(() => bookWithTwo().movePage("id-1", 1, "id-2")).toThrow("no page at index 1");
    expect(() => bookWithTwo().movePage("nope", 0, "id-2")).toThrow("no collection with id nope");
    expect(() => bookWithTwo().movePage("id-2", 1, "nope")).toThrow("no collection with id nope");
  });
});

describe("CollectionBook.search", () => {
  it("returns everything for a blank query", () => {
    expect(bookWithTwo().search("  ").length).toBe(2);
  });

  it("matches the name, a page title and a page url, case-insensitively", () => {
    const book = bookWithTwo();
    expect(book.search("FIRST").map((c) => c.id)).toEqual(["id-1"]);
    expect(book.search("docs").map((c) => c.id)).toEqual(["id-2"]);
    expect(book.search("example.com").map((c) => c.id)).toEqual(["id-1", "id-2"]);
    expect(book.search("nothing")).toEqual([]);
  });
});

describe("findMatch", () => {
  it("splits the text around the first case-insensitive hit, keeping the original case", () => {
    expect(findMatch("Hello Docs world", "docs")).toEqual({ before: "Hello ", match: "Docs", after: " world" });
    expect(findMatch("abcabc", "ABC")).toEqual({ before: "", match: "abc", after: "abc" });
  });

  it("returns undefined for a blank query or no hit", () => {
    expect(findMatch("Hello", "  ")).toBeUndefined();
    expect(findMatch("Hello", "x")).toBeUndefined();
  });
});

describe("CollectionBook data round-trip", () => {
  it("toData and fromData are inverse", () => {
    const data = bookWithTwo().toData();
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(CollectionBook.fromData(data).collections).toEqual(data.collections);
  });
});
