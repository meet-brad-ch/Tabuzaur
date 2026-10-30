import { CARD_WIDTHS } from "../lib/settings.ts";
import type { CardWidth } from "../lib/settings.ts";
import { Dom } from "./dom.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/** The settings dialog: the card width bar and the new-tab option (off by default). */
export class SettingsDialog {
  private static readonly SIZE_LABELS: Record<CardWidth, string> = { small: "Small", medium: "Medium", large: "Large" };

  /**
   * Creates the dialog.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, private readonly actions: PageActions) {}

  /** Shows the dialog as a modal; closing it removes it from the document. */
  open(): void {
    const dialog = Dom.el("dialog", "settings") as HTMLDialogElement;
    const heading = Dom.el("h3");
    heading.textContent = "Settings";
    const actions = Dom.el("div", "actions");
    const close = Dom.textButton("primary", "Close", () => {
      dialog.close();
      dialog.remove();
    });
    actions.append(close);
    dialog.append(heading, this.sizeRow(), this.newTabOption(), actions);
    dialog.addEventListener("cancel", () => {
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  }

  /**
   * The card width: a bar of three steps; the chosen one is filled.
   * @returns the row
   */
  private sizeRow(): HTMLElement {
    const row = Dom.el("div", "option size");
    const words = Dom.el("span");
    const name = Dom.el("strong");
    name.textContent = "Card width";
    const note = Dom.el("span", "note");
    note.textContent = "The least width of a card. Narrower cards give more columns.";
    words.append(name, note);
    const bar = Dom.el("div", "segments");
    bar.setAttribute("role", "radiogroup");
    bar.setAttribute("aria-label", "Card width");
    const segments = CARD_WIDTHS.map((size) => this.segment(size, bar));
    bar.append(...segments);
    row.append(words, bar);
    return row;
  }

  /**
   * One step of the width bar.
   * @param size the width it chooses
   * @param bar the bar, whose steps it marks after a save
   * @returns the button
   */
  private segment(size: CardWidth, bar: HTMLElement): HTMLButtonElement {
    const segment = Dom.textButton("segment", SettingsDialog.SIZE_LABELS[size], () => {
      void this.choose(size, bar);
    });
    const chosen = size === this.state.settings.cardWidth;
    segment.setAttribute("role", "radio");
    segment.setAttribute("aria-checked", String(chosen));
    segment.dataset.size = size;
    segment.autofocus = chosen;  // the dialog opens with the focus on the current step
    return segment;
  }

  /**
   * Saves a width and marks the step that is in effect afterwards.
   * @param size the chosen width
   * @param bar the bar of steps
   */
  private async choose(size: CardWidth, bar: HTMLElement): Promise<void> {
    await this.actions.setCardWidth(size);
    for (const step of bar.querySelectorAll<HTMLElement>(".segment")) {
      const inEffect = step.dataset.size === this.state.settings.cardWidth;
      step.setAttribute("aria-checked", String(inEffect));
    }
  }

  /**
   * The new-tab option.
   * @returns the labelled checkbox
   */
  private newTabOption(): HTMLElement {
    const option = Dom.el("label", "option");
    const box = Dom.input("checkbox");
    box.checked = this.state.settings.newTabPage;
    const words = Dom.el("span");
    const name = Dom.el("strong");
    name.textContent = "Open Tabuzaur in every new tab";
    const note = Dom.el("span", "note");
    note.textContent = "A new blank tab (Ctrl+T or the + button) shows the Tabuzaur page instead of Chrome's new-tab page. Tabs opened on an address are not affected.";
    words.append(name, note);
    option.append(box, words);
    box.addEventListener("change", () => {
      this.actions.setNewTabPage(box.checked);
    });
    return option;
  }
}
