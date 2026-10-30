import type { DocumentContent } from "./document-reader.ts";
import { Library } from "./library.ts";
import { LibraryMerge } from "./library-merge.ts";
import type { IdSource } from "./model.ts";

/** How to take an import. */
export type ImportAction = "replace" | "merge";

/** What the import question shows. */
export interface ImportSummary {
  /** A file with collections (schema 2), or a file of cards only (0.8 and earlier). */
  readonly kind: DocumentContent["kind"];
  /** How many collections the file holds; 0 for a file of cards only. */
  readonly collections: number;
  /** How many cards the file holds. */
  readonly cards: number;
}

/** What an import does: the new library and the notice that says so. */
export interface ImportOutcome {
  readonly library: Library;
  readonly notice: string;
}

/** What an import needs to know besides the file content. */
export interface ImportTarget {
  /** The library now. */
  readonly library: Library;
  /** The collection open on the page: a file of cards only goes there. */
  readonly openCollectionId: string;
  /** The file name, for the notice. */
  readonly fileName: string;
  /** New ids for cards whose id another collection uses. */
  readonly ids: IdSource;
}

/**
 * The rules of an import. A file with collections acts on the whole library: Replace loads it in
 * place of everything, Merge joins collections and cards by id or name. A file of cards only, from
 * 0.8 or earlier, acts on the open collection: Replace replaces its cards, Merge adds to them; the
 * other collections stay.
 */
export class ImportPlan {
  /**
   * What the file holds.
   * @param content the read file
   * @returns the counts for the question
   */
  static summary(content: DocumentContent): ImportSummary {
    if (content.kind === "cards") {
      return { kind: "cards", collections: 0, cards: content.cards.length };
    }
    const collections = content.data.collections;
    const cards = collections.reduce((sum, c) => sum + c.cards.length, 0);
    return { kind: "library", collections: collections.length, cards };
  }

  /**
   * Takes an import.
   * @param content the read file
   * @param action replace or merge
   * @param target the library, the open collection, the file name and the id source
   * @returns the new library and the notice
   * @throws Error for an unknown open collection
   */
  static apply(content: DocumentContent, action: ImportAction, target: ImportTarget): ImportOutcome {
    const summary = ImportPlan.summary(content);
    if (content.kind === "library") {
      const library = action === "replace" ? Library.fromData(content.data) : LibraryMerge.mergeLibrary(target.library, content.data);
      const verb = action === "replace" ? "Replaced everything with" : "Merged";
      const what = `${ImportPlan.count(summary.collections, "collection")} with ${ImportPlan.count(summary.cards, "card")}`;
      return { library, notice: `${verb} ${what} from ${target.fileName}.` };
    }
    const open = target.library.collection(target.openCollectionId);
    const cards = ImportPlan.count(summary.cards, "card");
    if (action === "replace") {
      const library = LibraryMerge.replaceCards(target.library, open.id, content.cards, target.ids);
      return { library, notice: `Replaced the cards of ${open.name} with ${cards} from ${target.fileName}.` };
    }
    const library = LibraryMerge.mergeCards(target.library, open.id, content.cards);
    return { library, notice: `Merged ${cards} into ${open.name} from ${target.fileName}.` };
  }

  /**
   * A count with its noun.
   * @param count how many
   * @param noun the singular noun
   * @returns "1 card", "3 cards"
   */
  static count(count: number, noun: string): string {
    const word = count === 1 ? noun : `${noun}s`;
    return `${String(count)} ${word}`;
  }
}
