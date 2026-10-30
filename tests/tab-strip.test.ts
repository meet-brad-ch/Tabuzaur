import { describe, expect, it } from "vitest";
import { DropRules } from "../src/lib/drop-rules.ts";
import { Library } from "../src/lib/library.ts";
import type { Card } from "../src/lib/model.ts";
import { TabStrip } from "../src/lib/tab-strip.ts";
import { pageA, pageB } from "./fakes.ts";

function card(id: string, name: string, links: Card["links"]): Card {
  return { id, name, createdAt: "x", hue: 0, links };
}

const library = Library.fromData({ schemaVersion: 2, collections: [
  { id: "main", name: "Main", hue: 0, cards: [card("w", "Work", [pageA]), card("r", "Reading", [pageB])] },
  { id: "later", name: "Later", hue: 0, cards: [card("t", "Trip", [pageB])] },
  { id: "empty", name: "Empty", hue: 0, cards: [] },
] });

describe("TabStrip.tabs", () => {
  it("gives one tab per collection, marks the open one, and no counts without a search", () => {
    const tabs = TabStrip.tabs(library, "later", "");
    expect(tabs.map((t) => [t.id, t.name, t.open, t.count])).toEqual([
      ["main", "Main", false, undefined],
      ["later", "Later", true, undefined],
      ["empty", "Empty", false, undefined],
    ]);
  });

  it("opens the first tab when the open id no longer exists", () => {
    expect(TabStrip.tabs(library, "gone", "").map((t) => t.open)).toEqual([true, false, false]);
  });

  it("counts the matching cards of every collection while a search is typed", () => {
    expect(TabStrip.tabs(library, "main", "docs").map((t) => t.count)).toEqual([1, 1, 0]);
  });

  it("lets only an empty collection be deleted, never the last one, and says why", () => {
    expect(TabStrip.tabs(library, "main", "").map((t) => [t.deletable, t.deleteLabel])).toEqual([
      [false, "Move or delete its cards first"],
      [false, "Move or delete its cards first"],
      [true, "Delete this collection"],
    ]);
    expect(TabStrip.tabs(Library.empty(), "main", "").map((t) => [t.deletable, t.deleteLabel])).toEqual([
      [false, "The last collection stays"],
    ]);
  });
});

describe("DropRules.accepts", () => {
  it("lets a link into a card or onto a link row, never onto a tab", () => {
    expect([DropRules.accepts("link", "card"), DropRules.accepts("link", "link"), DropRules.accepts("link", "tab")]).toEqual([true, true, false]);
  });

  it("lets a card move among the cards or onto a tab", () => {
    expect([DropRules.accepts("card", "card"), DropRules.accepts("card", "link"), DropRules.accepts("card", "tab")]).toEqual([true, false, true]);
  });

  it("lets a collection move among the tabs only", () => {
    expect([DropRules.accepts("collection", "card"), DropRules.accepts("collection", "link"), DropRules.accepts("collection", "tab")]).toEqual([false, false, true]);
  });
});
