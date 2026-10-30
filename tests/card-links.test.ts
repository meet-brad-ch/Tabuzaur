import { describe, expect, it } from "vitest";
import { CardLinks } from "../src/lib/card-links.ts";
import type { Card } from "../src/lib/model.ts";
import { pageA, pageB } from "./fakes.ts";

const pageC = { title: "C", url: "https://c.example/" };
const card: Card = { id: "k", name: "Work", createdAt: "x", hue: 0, links: [pageA, pageB, pageC] };

describe("CardLinks.add and insert", () => {
  it("appends in insertion order and refuses an address the card holds, naming the card", () => {
    const empty: Card = { ...card, links: [] };
    expect(CardLinks.add(CardLinks.add(empty, pageA), pageB).links).toEqual([pageA, pageB]);
    expect(() => CardLinks.add(card, { title: "other title", url: pageA.url })).toThrow("already in Work");
  });

  it("inserts at a place or at the end", () => {
    const link = { title: "D", url: "https://d.example/" };
    expect(CardLinks.insert(card, link, 1).links).toEqual([pageA, link, pageB, pageC]);
    expect(CardLinks.insert(card, link, undefined).links).toEqual([pageA, pageB, pageC, link]);
  });
});

describe("CardLinks.remove", () => {
  it("removes one link by its place and keeps an emptied card", () => {
    expect(CardLinks.remove(card, 1).links).toEqual([pageA, pageC]);
    const one: Card = { ...card, links: [pageA] };
    expect(CardLinks.remove(one, 0)).toEqual({ ...one, links: [] });
  });

  it("rejects a place that is out of range or not an integer", () => {
    for (const index of [3, -1, 0.5]) {
      expect(() => CardLinks.remove(card, index)).toThrow(`card k has no link at index ${String(index)}`);
    }
  });
});

describe("CardLinks.edit", () => {
  it("changes the title and the address, trimmed, and keeps an unchanged address", () => {
    expect(CardLinks.edit(card, 1, "  Reference ", " https://ref.example/ ").links[1]).toEqual({ ...pageB, title: "Reference", url: "https://ref.example/" });
    expect(CardLinks.edit(card, 0, "New", pageA.url).links[0]).toEqual({ title: "New", url: pageA.url });
  });

  it("rejects an empty title, a bad address, an address of another link, or a missing link", () => {
    expect(() => CardLinks.edit(card, 0, " ", pageA.url)).toThrow("a link needs a title");
    expect(() => CardLinks.edit(card, 0, "T", "not a url")).toThrow("not a valid url: not a url");
    expect(() => CardLinks.edit(card, 0, "T", pageB.url)).toThrow("already in Work");
    expect(() => CardLinks.edit(card, 9, "T", pageA.url)).toThrow("card k has no link at index 9");
  });
});

describe("CardLinks.reorder", () => {
  it("moves down and up: to is the place before the move; its own place changes nothing", () => {
    expect(CardLinks.reorder(card, 0, 2).links).toEqual([pageB, pageA, pageC]);
    expect(CardLinks.reorder(card, 0, 3).links).toEqual([pageB, pageC, pageA]);
    expect(CardLinks.reorder(card, 2, 0).links).toEqual([pageC, pageA, pageB]);
    expect(CardLinks.reorder(card, 1, 1).links).toEqual(card.links);
    expect(CardLinks.reorder(card, 1, 2).links).toEqual(card.links);
  });

  it("rejects a missing link or an impossible place", () => {
    expect(() => CardLinks.reorder(card, 5, 0)).toThrow("card k has no link at index 5");
    expect(() => CardLinks.reorder(card, 0, 4)).toThrow("card k has no place at index 4");
    expect(() => CardLinks.reorder(card, 0, -1)).toThrow("card k has no place at index -1");
  });
});
