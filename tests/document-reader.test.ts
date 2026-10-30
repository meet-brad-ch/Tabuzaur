import { describe, expect, it } from "vitest";
import { DocumentReader } from "../src/lib/document-reader.ts";
import { pageA, pageB } from "./fakes.ts";

const oldCard = { id: "a", name: "A", createdAt: "2026-10-12T10:00:00.000Z", pages: [pageA, pageB], hue: 4 };
const oldDoc = { schemaVersion: 1, collections: [oldCard] };
const newCard = { id: "a", name: "A", createdAt: "2026-10-12T10:00:00.000Z", hue: 4, links: [pageA, pageB] };
const newDoc = { schemaVersion: 2, collections: [{ id: "main", name: "Main", cards: [newCard] }] };

describe("DocumentReader, schema 1 (0.8 and earlier)", () => {
  it("reads the cards, with their links from pages, and drops unknown fields", () => {
    const content = DocumentReader.read({ ...oldDoc, extra: 1 });
    expect(content).toEqual({ kind: "cards", cards: [newCard] });
  });

  it("gives a card without a hue the hue of its place, as the page showed it then", () => {
    const noHue = { id: "a", name: "A", createdAt: oldCard.createdAt, pages: oldCard.pages };
    const content = DocumentReader.read({ schemaVersion: 1, collections: [oldCard, { ...noHue, id: "b" }, { ...noHue, id: "c" }] });
    expect(content.kind === "cards" ? content.cards.map((c) => c.hue) : []).toEqual([4, 1, 2]);
  });

  it("reads the pre-0.1.0 field name tabs as pages", () => {
    const { pages, ...rest } = oldCard;
    expect(DocumentReader.read({ schemaVersion: 1, collections: [{ ...rest, tabs: pages }] })).toEqual({ kind: "cards", cards: [newCard] });
  });

  it.each([
    [{ schemaVersion: 1 }, "store.collections is not an array"],
    [{ schemaVersion: 1, collections: [1] }, "collections[0] is not an object"],
    [{ schemaVersion: 1, collections: [{ ...oldCard, id: 1 }] }, "collections[0].id is not a string"],
    [{ schemaVersion: 1, collections: [{ ...oldCard, pages: {} }] }, "collections[0].pages is not an array"],
    [{ schemaVersion: 1, collections: [{ ...oldCard, pages: [{ title: "t" }] }] }, "collections[0].pages[0].url is not a string"],
    [{ schemaVersion: 1, collections: [{ ...oldCard, pages: [{ ...pageA, favIconUrl: 3 }] }] }, "collections[0].pages[0].favIconUrl is not a string"],
    [{ schemaVersion: 1, collections: [{ ...oldCard, hue: 16 }] }, "collections[0].hue is not an integer in 0..15"],
  ])("rejects %j", (raw, message) => {
    expect(() => DocumentReader.read(raw)).toThrow(message);
  });
});

describe("DocumentReader, schema 2", () => {
  it("reads collections of cards and keeps an optional favicon", () => {
    const content = DocumentReader.read(newDoc);
    expect(content).toEqual({ kind: "library", data: newDoc });
    const data = content.kind === "library" ? content.data : undefined;
    expect("favIconUrl" in (data?.collections[0]?.cards[0]?.links[0] ?? {})).toBe(false);
  });

  it.each([
    [null, "store is not an object"],
    [[], "store is not an object"],
    [{ schemaVersion: 3, collections: [] }, "unsupported schemaVersion 3"],
    [{ schemaVersion: 3 }, "unsupported schemaVersion 3"],
    [{ schemaVersion: 2 }, "store.collections is not an array"],
    [{ schemaVersion: 2, collections: [{ id: "c", name: "C" }] }, "collections[0].cards is not an array"],
    [{ schemaVersion: 2, collections: [{ id: "c", name: 5, cards: [] }] }, "collections[0].name is not a string"],
    [{ schemaVersion: 2, collections: [{ id: "c", name: "C", cards: [{ ...newCard, links: {} }] }] }, "collections[0].cards[0].links is not an array"],
    [{ schemaVersion: 2, collections: [{ id: "c", name: "C", cards: [{ ...newCard, hue: undefined }] }] }, "collections[0].cards[0].hue is not an integer in 0..15"],
    [{ schemaVersion: 2, collections: [{ id: "c", name: "C", cards: [newCard, { ...newCard, links: [{ url: "u" }] }] }] }, "collections[0].cards[1].links[0].title is not a string"],
  ])("rejects %j", (raw, message) => {
    expect(() => DocumentReader.read(raw)).toThrow(message);
  });
});
