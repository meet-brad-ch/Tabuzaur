import { describe, expect, it } from "vitest";
import { Library } from "../src/lib/library.ts";
import type { Card, LibraryData } from "../src/lib/model.ts";
import { CountingIdSource, FixedClock, pageA, pageB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");

/** Main holds "First" (pageA) and "Second" (pageA, pageB); "Later" (id-3) is empty. */
function twoCollections(): Library {
  const ids = new CountingIdSource();
  return Library.empty()
    .createCard("main", "First", clock, ids)
    .createCard("main", "Second", clock, ids)
    .createCollection("Later", ids)
    .addLink("id-1", pageA, undefined)
    .addLink("id-2", pageA, undefined)
    .addLink("id-2", pageB, undefined);
}

function card(id: string, hue: number): Card {
  return { id, name: id, createdAt: "x", hue, links: [] };
}

describe("Library.empty and fromData", () => {
  it("always holds a collection: Main when empty, also for a document without collections", () => {
    expect(Library.empty().collections).toEqual([{ id: "main", name: "Main", cards: [] }]);
    expect(Library.fromData({ schemaVersion: 2, collections: [] }).collections).toEqual(Library.empty().collections);
  });

  it("round-trips through its document", () => {
    const library = twoCollections();
    expect(Library.fromData(library.toData()).toData()).toEqual(library.toData());
    expect(library.toData().schemaVersion).toBe(2);
  });
});

describe("Library collections", () => {
  it("appends a collection with a trimmed name and finds it", () => {
    const library = Library.empty().createCollection("  Later  ", new CountingIdSource());
    expect(library.collections.map((c) => c.name)).toEqual(["Main", "Later"]);
    expect(library.collection("id-1").cards).toEqual([]);
    expect(library.hasCollection("id-1")).toBe(true);
    expect(library.hasCollection("nope")).toBe(false);
    expect(() => library.collection("nope")).toThrow("no collection with id nope");
  });

  it("rejects an empty name and renames with trimming", () => {
    expect(() => Library.empty().createCollection(" ", new CountingIdSource())).toThrow("a collection needs a name");
    expect(Library.empty().renameCollection("main", " Home ").collection("main").name).toBe("Home");
    expect(() => Library.empty().renameCollection("main", "")).toThrow("a collection needs a name");
  });

  it("deletes only an empty collection, and never the last one", () => {
    const library = twoCollections();
    expect(library.removeCollection("id-3").collections.map((c) => c.id)).toEqual(["main"]);
    expect(() => library.removeCollection("main")).toThrow('the collection "Main" still holds 2 cards');
    expect(() => Library.empty().removeCollection("main")).toThrow("the last collection cannot be deleted");
    expect(() => library.removeCollection("nope")).toThrow("no collection with id nope");
  });

  it("reorders collections: to is the place before the move", () => {
    const ids = new CountingIdSource();
    const library = Library.empty().createCollection("B", ids).createCollection("C", ids);
    expect(library.reorderCollection("main", 3).collections.map((c) => c.name)).toEqual(["B", "C", "Main"]);
    expect(library.reorderCollection("id-2", 0).collections.map((c) => c.name)).toEqual(["C", "Main", "B"]);
    expect(library.reorderCollection("id-1", 1)).toEqual(library);
    expect(() => library.reorderCollection("main", 4)).toThrow("no place for a collection at index 4");
    expect(() => library.reorderCollection("main", -1)).toThrow("no place for a collection at index -1");
  });
});

describe("Library cards", () => {
  it("creates a card in a collection with a trimmed name, id, time and the next hue across all collections", () => {
    const library = twoCollections().createCard("id-3", "  Recipes ", clock, { next: () => "r" });
    expect(library.collection("id-3").cards).toEqual([
      { id: "r", name: "Recipes", createdAt: "2026-10-12T10:00:00.000Z", hue: 2, links: [] },
    ]);
    expect(() => library.createCard("main", " ", clock, new CountingIdSource())).toThrow("a card needs a name");
    expect(() => library.createCard("nope", "X", clock, new CountingIdSource())).toThrow("no collection with id nope");
  });

  it("finds, renames and deletes a card by its id alone", () => {
    const library = twoCollections();
    expect(library.card("id-2").name).toBe("Second");
    expect(library.locate("id-2")).toEqual({ collectionIndex: 0, cardIndex: 1 });
    expect(library.collectionOf("id-2").id).toBe("main");
    expect(library.renameCard("id-2", " Two ").card("id-2").name).toBe("Two");
    expect(() => library.renameCard("id-2", "")).toThrow("a card needs a name");
    expect(library.removeCard("id-1").collection("main").cards.map((c) => c.id)).toEqual(["id-2"]);
    expect(() => library.card("nope")).toThrow("no card with id nope");
    expect(() => library.removeCard("nope")).toThrow("no card with id nope");
  });

  it("reorders a card within its collection", () => {
    const library = twoCollections();
    expect(library.reorderCard("id-1", 2).collection("main").cards.map((c) => c.name)).toEqual(["Second", "First"]);
    expect(library.reorderCard("id-2", 0).collection("main").cards.map((c) => c.name)).toEqual(["Second", "First"]);
    expect(library.reorderCard("id-1", 0)).toEqual(library);
    expect(() => library.reorderCard("id-1", 3)).toThrow("no place for a card at index 3");
  });

  it("moves a card to the end of another collection, keeping its links and color", () => {
    const library = twoCollections();
    const moved = library.moveCard("id-2", "id-3");
    expect(moved.collection("main").cards.map((c) => c.id)).toEqual(["id-1"]);
    expect(moved.collection("id-3").cards).toEqual([library.card("id-2")]);
    expect(moved.moveCard("id-2", "id-3")).toEqual(moved);
    expect(() => library.moveCard("id-2", "nope")).toThrow("no collection with id nope");
  });

  it("lists every card in document order", () => {
    const moved = twoCollections().moveCard("id-1", "id-3");
    expect(moved.allCards().map((c) => c.id)).toEqual(["id-2", "id-1"]);
  });

  it("takes the next hue from all cards, so a moved card does not repeat a color", () => {
    const data: LibraryData = { schemaVersion: 2, collections: [
      { id: "a", name: "A", cards: [card("x", 0), card("y", 1)] },
      { id: "b", name: "B", cards: [card("z", 2)] },
    ] };
    const library = Library.fromData(data).createCard("a", "New", clock, { next: () => "n" });
    expect(library.card("n").hue).toBe(3);
  });
});

describe("Library links", () => {
  it("adds a link at the end or at a place", () => {
    const library = twoCollections();
    const link = { title: "C", url: "https://c.example/" };
    expect(library.addLink("id-2", link, undefined).card("id-2").links).toEqual([pageA, pageB, link]);
    expect(library.addLink("id-2", link, 0).card("id-2").links).toEqual([link, pageA, pageB]);
    expect(() => library.addLink("id-2", pageB, undefined)).toThrow("already in Second");
    expect(() => library.addLink("nope", link, undefined)).toThrow("no card with id nope");
  });

  it("removes and edits a link", () => {
    const library = twoCollections();
    expect(library.removeLink("id-2", 0).card("id-2").links).toEqual([pageB]);
    expect(library.editLink("id-2", 0, " T ", " https://t.example/ ").card("id-2").links[0]).toEqual({ title: "T", url: "https://t.example/" });
    expect(() => library.removeLink("id-2", 5)).toThrow("card id-2 has no link at index 5");
  });

  it("moves a link to another card, at the end or at a place, and reorders within a card", () => {
    const library = twoCollections().addLink("id-1", { title: "C", url: "https://c.example/" }, undefined);
    const moved = library.moveLink("id-2", 1, "id-1", 0);
    expect(moved.card("id-1").links.map((l) => l.title)).toEqual(["Docs", "Example", "C"]);
    expect(moved.card("id-2").links).toEqual([pageA]);
    expect(library.moveLink("id-2", 0, "id-2", 2).card("id-2").links).toEqual([pageB, pageA]);
    expect(library.moveLink("id-2", 0, "id-2", undefined)).toEqual(library);
  });

  it("refuses a move into a card that holds the address, and leaves the source as it was", () => {
    const library = twoCollections();
    expect(() => library.moveLink("id-2", 0, "id-1", undefined)).toThrow("already in First");
    expect(library.card("id-2").links).toEqual([pageA, pageB]);
  });

  it("does not change the library it started from", () => {
    const library = twoCollections();
    library.removeCard("id-1").moveCard("id-2", "id-3").createCollection("X", new CountingIdSource());
    expect(library.collection("main").cards.map((c) => c.id)).toEqual(["id-1", "id-2"]);
    expect(library.collections).toHaveLength(2);
  });
});
