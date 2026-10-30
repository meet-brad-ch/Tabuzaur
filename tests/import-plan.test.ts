import { describe, expect, it } from "vitest";
import type { DocumentContent } from "../src/lib/document-reader.ts";
import { ImportPlan } from "../src/lib/import-plan.ts";
import type { ImportTarget } from "../src/lib/import-plan.ts";
import { Library } from "../src/lib/library.ts";
import type { Card } from "../src/lib/model.ts";
import { CountingIdSource, pageA, pageB } from "./fakes.ts";

function card(id: string, name: string, links: Card["links"]): Card {
  return { id, name, createdAt: "x", hue: 0, links };
}

/** Main: "Work" (w, pageA); Later: "Reading" (r, pageB). */
const library = Library.fromData({ schemaVersion: 2, collections: [
  { id: "main", name: "Main", hue: 0, cards: [card("w", "Work", [pageA])] },
  { id: "later", name: "Later", hue: 0, cards: [card("r", "Reading", [pageB])] },
] });

function target(openCollectionId: string): ImportTarget {
  return { library, openCollectionId, fileName: "backup.json", ids: new CountingIdSource() };
}

const oldFile: DocumentContent = { kind: "cards", cards: [card("w", "Work", [pageB]), card("n", "New", [])] };
const newFile: DocumentContent = { kind: "library", data: { schemaVersion: 2, collections: [
  { id: "trip", name: "Trip", hue: 0, cards: [card("t", "Lisbon", [])] },
  { id: "later", name: "Later", hue: 0, cards: [card("r", "Reading", [pageA])] },
] } };

describe("ImportPlan.summary", () => {
  it("counts the collections and cards of a file", () => {
    expect(ImportPlan.summary(newFile)).toEqual({ kind: "library", collections: 2, cards: 2 });
    expect(ImportPlan.summary(oldFile)).toEqual({ kind: "cards", collections: 0, cards: 2 });
  });
});

describe("ImportPlan.apply, a file of cards only (0.8 and earlier)", () => {
  it("merges into the open collection only", () => {
    const outcome = ImportPlan.apply(oldFile, "merge", target("later"));
    expect(outcome.notice).toBe("Merged 2 cards into Later from backup.json.");
    expect(outcome.library.card("w").links).toEqual([pageA, pageB]);
    expect(outcome.library.collection("later").cards.map((c) => c.id)).toEqual(["r", "n"]);
  });

  it("replaces the cards of the open collection and leaves the others", () => {
    const outcome = ImportPlan.apply(oldFile, "replace", target("later"));
    expect(outcome.notice).toBe("Replaced the cards of Later with 2 cards from backup.json.");
    expect(outcome.library.collection("main")).toEqual(library.collection("main"));
    expect(outcome.library.collection("later").cards.map((c) => [c.id, c.name])).toEqual([["id-1", "Work"], ["n", "New"]]);
  });
});

describe("ImportPlan.apply, a file with collections", () => {
  it("replaces everything", () => {
    const outcome = ImportPlan.apply(newFile, "replace", target("main"));
    expect(outcome.notice).toBe("Replaced everything with 2 collections with 2 cards from backup.json.");
    expect(outcome.library.collections.map((c) => c.id)).toEqual(["trip", "later"]);
  });

  it("merges collection by collection", () => {
    const outcome = ImportPlan.apply(newFile, "merge", target("main"));
    expect(outcome.notice).toBe("Merged 2 collections with 2 cards from backup.json.");
    expect(outcome.library.collections.map((c) => c.id)).toEqual(["main", "later", "trip"]);
    expect(outcome.library.card("r").links).toEqual([pageB, pageA]);
  });

  it("counts in singular and plural", () => {
    expect(ImportPlan.count(1, "card")).toBe("1 card");
    expect(ImportPlan.count(0, "collection")).toBe("0 collections");
  });
});
