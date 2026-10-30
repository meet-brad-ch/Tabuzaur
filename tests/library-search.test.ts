import { describe, expect, it } from "vitest";
import { LibrarySearch } from "../src/lib/library-search.ts";
import type { Card, Collection } from "../src/lib/model.ts";
import { pageA, pageB } from "./fakes.ts";

const work: Card = { id: "w", name: "Work", createdAt: "x", hue: 0, links: [pageA] };
const docs: Card = { id: "d", name: "Reading", createdAt: "x", hue: 1, links: [pageB] };
const collection: Collection = { id: "c", name: "Main", cards: [work, docs] };

describe("LibrarySearch", () => {
  it("matches every card for a blank query", () => {
    expect(LibrarySearch.matchingCards(collection, "  ")).toEqual([work, docs]);
    expect(LibrarySearch.matchCount(collection, "")).toBe(2);
  });

  it("matches the card name, a link title and a link address, case-insensitively", () => {
    expect(LibrarySearch.matchingCards(collection, "WORK")).toEqual([work]);
    expect(LibrarySearch.matchingCards(collection, "docs")).toEqual([docs]);
    expect(LibrarySearch.matchingCards(collection, "https://example.com")).toEqual([work]);
    expect(LibrarySearch.matchCount(collection, "nothing")).toBe(0);
  });

  it("does not match a collection name: the count is about cards", () => {
    expect(LibrarySearch.matchCount(collection, "main")).toBe(0);
  });
});
