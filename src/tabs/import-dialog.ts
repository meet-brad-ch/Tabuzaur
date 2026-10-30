import { Dom } from "./dom.ts";

/** The three ways to take an import. */
export type ImportChoice = "replace" | "merge" | "cancel";

/** What the import question shows. */
export interface ImportQuestion {
  /** The name of the chosen file. */
  readonly fileName: string;
  /** How many cards the file holds. */
  readonly incoming: number;
  /** How many cards the page holds now. */
  readonly current: number;
}

/** The modal question before an import: Replace, Merge or Cancel. */
export class ImportDialog {
  /**
   * Shows the question and waits for the answer; Escape counts as Cancel.
   * @param question the file name and the counts
   * @returns the choice
   */
  static ask(question: ImportQuestion): Promise<ImportChoice> {
    const dialog = Dom.el("dialog", "import") as HTMLDialogElement;
    const heading = Dom.el("h3");
    heading.textContent = `Import ${ImportDialog.cards(question.incoming)} from ${question.fileName}`;
    const replaceText = Dom.el("p");
    const verb = question.current === 1 ? "is" : "are";
    replaceText.textContent = `Replace: the ${ImportDialog.cards(question.current)} you have now ${verb} removed first.`;
    const mergeText = Dom.el("p");
    mergeText.textContent = "Merge: imported collections join yours by name, links you already have are kept, nothing is removed.";
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
   * A count with its noun.
   * @param count how many
   * @returns "1 collection" or "N collections"
   */
  static cards(count: number): string {
    const noun = count === 1 ? "collection" : "collections";
    return `${String(count)} ${noun}`;
  }
}
