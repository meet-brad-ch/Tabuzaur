// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { ImportDialog } from "../../src/tabs/import-dialog.ts";
import type { ImportQuestion } from "../../src/tabs/import-dialog.ts";

const base: Omit<ImportQuestion, "summary"> = { fileName: "backup.json", openName: "Later", openCards: 1, collections: 2, cards: 5 };

/** The dialog's texts and a button to answer with, once it is in the document. */
function shown(): { texts: string[]; answer: (label: string) => void } {
  const dialog = document.querySelector("dialog.import");
  if (dialog === null) {
    throw new Error("no import dialog");
  }
  const texts = [...dialog.querySelectorAll("h3, p")].map((e) => e.textContent);
  const answer = (label: string): void => {
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === label)?.click();
  };
  return { texts, answer };
}

describe("ImportDialog", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("asks about a file with collections in terms of everything you have", async () => {
    const answer = ImportDialog.ask({ ...base, summary: { kind: "library", collections: 3, cards: 7 } });
    const dialog = shown();
    expect(dialog.texts).toEqual([
      "Import 3 collections with 7 cards from backup.json",
      "Replace: everything you have now, 2 collections with 5 cards, is removed first.",
      "Merge: collections and cards join yours by name, links you already have are kept, nothing is removed.",
    ]);
    dialog.answer("Merge");
    expect(await answer).toBe("merge");
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("asks about a file of cards only in terms of the open collection", async () => {
    const answer = ImportDialog.ask({ ...base, summary: { kind: "cards", collections: 0, cards: 1 } });
    const dialog = shown();
    expect(dialog.texts).toEqual([
      "Import 1 card into Later from backup.json",
      "Replace: the 1 card in Later is removed first. Other collections stay.",
      "Merge: the cards join the cards in Later by name, links you already have are kept, nothing is removed.",
    ]);
    dialog.answer("Replace");
    expect(await answer).toBe("replace");
  });

  it("answers Cancel on the button", async () => {
    const answer = ImportDialog.ask({ ...base, summary: { kind: "cards", collections: 0, cards: 2 } });
    shown().answer("Cancel");
    expect(await answer).toBe("cancel");
  });
});
