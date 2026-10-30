import { describe, expect, it } from "vitest";
import { Library } from "../src/lib/library.ts";
import { LibraryMerge } from "../src/lib/library-merge.ts";
import type { Card, Collection, LibraryData } from "../src/lib/model.ts";
import { CountingIdSource, pageA, pageB } from "./fakes.ts";

const pageC = { title: "C", url: "https://c.example/" };

function card(id: string, name: string, links: Card["links"]): Card {
  return { id, name, createdAt: "x", hue: 0, links };
}

function doc(...collections: Collection[]): LibraryData {
  return { schemaVersion: 2, collections };
}

/** Main: "Work" (w, pageA); Later (later): "Reading" (r, pageB). */
const library = Library.fromData(doc(
  { id: "main", name: "Main", hue: 0, cards: [card("w", "Work", [pageA])] },
  { id: "later", name: "Later", hue: 0, cards: [card("r", "Reading", [pageB])] },
));

describe("LibraryMerge.mergeLibrary", () => {
  it("joins a collection by id, then a card by id, adding only links it lacks and keeping its name", () => {
    const incoming = doc({ id: "main", name: "Renamed", hue: 0, cards: [card("w", "Other name", [{ ...pageA, title: "x" }, pageC])] });
    const merged = LibraryMerge.mergeLibrary(library, incoming);
    expect(merged.collection("main").name).toBe("Main");
    expect(merged.card("w")).toEqual(card("w", "Work", [pageA, pageC]));
  });

  it("joins a collection by name, a card by name inside it, and appends what it does not know", () => {
    const incoming = doc({ id: "elsewhere", name: " later ", hue: 0, cards: [card("r2", "reading", [pageC]), card("n", "New", [pageA])] });
    const merged = LibraryMerge.mergeLibrary(library, incoming);
    expect(merged.collections.map((c) => c.id)).toEqual(["main", "later"]);
    expect(merged.card("r").links).toEqual([pageB, pageC]);
    expect(merged.collection("later").cards.map((c) => c.id)).toEqual(["r", "n"]);
  });

  it("appends an unknown collection with its cards", () => {
    const incoming = doc({ id: "new", name: "Trip", hue: 0, cards: [card("t", "Lisbon", [pageC])] });
    const merged = LibraryMerge.mergeLibrary(library, incoming);
    expect(merged.collection("new")).toEqual({ id: "new", name: "Trip", hue: 5, cards: [card("t", "Lisbon", [pageC])] });
  });

  it("joins a card by id in whatever collection it sits now, so it never appears twice", () => {
    const moved = library.moveCard("w", "later");
    const incoming = doc({ id: "main", name: "Main", hue: 0, cards: [card("w", "Work", [pageA, pageC])] });
    const merged = LibraryMerge.mergeLibrary(moved, incoming);
    expect(merged.collection("main").cards).toEqual([]);
    expect(merged.card("w").links).toEqual([pageA, pageC]);
    expect(merged.allCards().filter((c) => c.id === "w")).toHaveLength(1);
  });

  it("changes nothing for an empty document and leaves the original library as it was", () => {
    expect(LibraryMerge.mergeLibrary(library, doc()).toData()).toEqual(library.toData());
    LibraryMerge.mergeLibrary(library, doc({ id: "new", name: "Trip", hue: 0, cards: [] }));
    expect(library.collections).toHaveLength(2);
  });
});

describe("LibraryMerge.mergeCards and replaceCards (a file of cards only)", () => {
  it("merges cards into one collection by the card rule", () => {
    const merged = LibraryMerge.mergeCards(library, "later", [card("x", "WORK", [pageC]), card("r", "Reading", [pageA])]);
    expect(merged.collection("later").cards.map((c) => c.id)).toEqual(["r", "x"]);
    expect(merged.card("r").links).toEqual([pageB, pageA]);
    expect(merged.collection("main")).toEqual(library.collection("main"));
  });

  it("replaces one collection's cards, leaves the others, and gives a clashing card a new id", () => {
    const ids = new CountingIdSource();
    const replaced = LibraryMerge.replaceCards(library, "later", [card("w", "Work copy", [pageC]), card("k", "Kept", [])], ids);
    expect(replaced.collection("main")).toEqual(library.collection("main"));
    expect(replaced.collection("later").cards.map((c) => [c.id, c.name])).toEqual([["id-1", "Work copy"], ["k", "Kept"]]);
    expect(() => LibraryMerge.replaceCards(library, "nope", [], ids)).toThrow("no collection with id nope");
  });
});
