import type { ImportAction, ImportSummary } from "../lib/import-plan.ts";
import { ImportPlan } from "../lib/import-plan.ts";
import { Dom } from "./dom.ts";

/** The answer to the import question. */
export type ImportChoice = ImportAction | "cancel";

/** What the import question shows. */
export interface ImportQuestion {
  /** The name of the chosen file. */
  readonly fileName: string;
  /** What the file holds. */
  readonly summary: ImportSummary;
  /** The collection open on the page, where a file of cards only goes. */
  readonly openName: string;
  /** How many cards the open collection holds. */
  readonly openCards: number;
  /** How many collections the library holds. */
  readonly collections: number;
  /** How many cards the library holds. */
  readonly cards: number;
}

/** The modal question before an import: Replace, Merge or Cancel. */
export class ImportDialog {
  /**
   * Shows the question and waits for the answer; Escape counts as Cancel.
   * @param question the file and what Replace and Merge would act on
   * @returns the choice
   */
  static ask(question: ImportQuestion): Promise<ImportChoice> {
    const dialog = Dom.el("dialog", "import") as HTMLDialogElement;
    const heading = Dom.el("h3");
    const replaceText = Dom.el("p");
    const mergeText = Dom.el("p");
    ImportDialog.fillTexts(question, heading, replaceText, mergeText);
    const actions = Dom.el("div", "actions");
    dialog.append(heading, replaceText, mergeText, actions);
    return new Promise((resolve) => {
      const choose = (choice: ImportChoice): void => {
        dialog.close();
        dialog.remove();
        resolve(choice);
      };
      actions.append(
        Dom.textButton("danger-outline", "Replace", () => {
          choose("replace");
        }),
        Dom.textButton("primary", "Merge", () => {
          choose("merge");
        }),
        Dom.textButton("ghost", "Cancel", () => {
          choose("cancel");
        }),
      );
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        choose("cancel");
      });
      document.body.append(dialog);
      dialog.showModal();
    });
  }

  /**
   * The heading and the two explanations: a file with collections acts on everything, a file of
   * cards only on the open collection.
   * @param question the file and the targets
   * @param heading the heading element
   * @param replaceText the Replace explanation
   * @param mergeText the Merge explanation
   */
  private static fillTexts(question: ImportQuestion, heading: HTMLElement, replaceText: HTMLElement, mergeText: HTMLElement): void {
    const summary = question.summary;
    const fileCards = ImportPlan.count(summary.cards, "card");
    if (summary.kind === "cards") {
      heading.textContent = `Import ${fileCards} into ${question.openName} from ${question.fileName}`;
      const openCards = ImportPlan.count(question.openCards, "card");
      const verb = question.openCards === 1 ? "is" : "are";
      replaceText.textContent = `Replace: the ${openCards} in ${question.openName} ${verb} removed first. Other collections stay.`;
      mergeText.textContent = `Merge: the cards join the cards in ${question.openName} by name, links you already have are kept, nothing is removed.`;
      return;
    }
    const fileCollections = ImportPlan.count(summary.collections, "collection");
    heading.textContent = `Import ${fileCollections} with ${fileCards} from ${question.fileName}`;
    const collections = ImportPlan.count(question.collections, "collection");
    const cards = ImportPlan.count(question.cards, "card");
    replaceText.textContent = `Replace: everything you have now, ${collections} with ${cards}, is removed first.`;
    mergeText.textContent = "Merge: collections and cards join yours by name, links you already have are kept, nothing is removed.";
  }
}
