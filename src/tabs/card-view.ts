import { DropRules } from "../lib/drop-rules.ts";
import type { Card } from "../lib/model.ts";
import { Dom, Icons } from "./dom.ts";
import { DragKinds } from "./drag.ts";
import { InlineEditor } from "./inline-editor.ts";
import { LinkRowView } from "./link-row-view.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/** One card: a colored band with the name, pen and trash, and the list of links below it. */
export class CardView {
  private readonly rows: LinkRowView;

  /**
   * Creates the view.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, private readonly actions: PageActions) {
    this.rows = new LinkRowView(state, actions);
  }

  /**
   * Builds the card.
   * @param card the card
   * @param hue its color, 0 to HUE_COUNT - 1
   * @returns the section element
   */
  build(card: Card, hue: number): HTMLElement {
    const section = Dom.el("section", `card hue-${String(hue)}`);
    this.wireDrop(section, card);
    section.append(this.band(section, card));
    if (card.links.length === 0) {
      section.append(CardView.emptyHint());
      return section;
    }
    const list = Dom.el("ul");
    const rows = card.links.map((page, index) => this.rows.build(card, page, index));
    list.append(...rows);
    section.append(list);
    return section;
  }

  /**
   * The card takes a dragged card (before or after itself) and a dragged link (at its end).
   * @param section the card element
   * @param card the card
   */
  private wireDrop(section: HTMLElement, card: Card): void {
    section.addEventListener("dragover", (event) => {
      CardView.onDragOver(event, section);
    });
    section.addEventListener("dragleave", (event) => {
      const inside = section.contains(event.relatedTarget as Node | null);
      if (!inside) {
        section.classList.remove("over", "insert-before", "insert-after");
      }
    });
    section.addEventListener("drop", (event) => {
      this.onDrop(event, section, card);
    });
  }

  /**
   * Shows where a drop would land: an insertion line for a card, a lift for a link.
   * @param event the dragover event
   * @param section the card element
   */
  private static onDragOver(event: DragEvent, section: HTMLElement): void {
    const transfer = event.dataTransfer;
    const kind = DragKinds.kindOf(transfer);
    if (transfer === null || kind === undefined || !DropRules.accepts(kind, "card")) {
      return;
    }
    event.preventDefault();
    if (kind === "card") {
      transfer.dropEffect = "move";
      const after = DragKinds.isLowerHalf(section, event);
      section.classList.toggle("insert-before", !after);
      section.classList.toggle("insert-after", after);
      return;
    }
    transfer.dropEffect = transfer.effectAllowed === "move" ? "move" : "copy";
    section.classList.add("over");
  }

  /**
   * A dropped card moves before or after this one; a dropped link goes to the end.
   * @param event the drop event
   * @param section the card element
   * @param card the card
   */
  private onDrop(event: DragEvent, section: HTMLElement, card: Card): void {
    event.preventDefault();
    section.classList.remove("over", "insert-before", "insert-after");
    const movedId = DragKinds.readCard(event);
    if (movedId !== "") {
      const after = DragKinds.isLowerHalf(section, event) ? 1 : 0;
      const place = this.state.library.locate(card.id).cardIndex + after;
      this.actions.reorderCard(movedId, place);
      return;
    }
    const drag = DragKinds.readLink(event);
    if (drag !== undefined) {
      this.actions.dropLink(card.id, drag, undefined);
    }
  }

  /**
   * The colored band: the name (or its editor), the pen and the trash; it drags the card.
   * @param section the card element, the drag image
   * @param card the card
   * @returns the header element
   */
  private band(section: HTMLElement, card: Card): HTMLElement {
    const header = Dom.el("header");
    header.append(...this.nameField(card), this.deleteButton(card));
    const renaming = this.state.renaming === card.id;
    header.draggable = !renaming;
    header.title = renaming ? "" : "Drag to move this card";
    header.addEventListener("dragstart", (event) => {
      DragKinds.startCard(event, section, card.id);
    });
    header.addEventListener("dragend", () => {
      section.classList.remove("dragging");
    });
    return header;
  }

  /**
   * The name and its pen, or a field while it is being renamed.
   * @param card the card
   * @returns the elements for the band
   */
  private nameField(card: Card): HTMLElement[] {
    if (this.state.renaming !== card.id) {
      const name = Dom.el("span", "name");
      name.replaceChildren(...Dom.marked(card.name, this.state.query));
      const edit = Dom.button("icon edit", () => {
        this.actions.startRename(card.id);
      });
      edit.append(Icons.icon("pen"));
      Dom.labelled(edit, "Rename this card");
      return [name, edit];
    }
    const input = Dom.input("text", "name");
    input.value = card.name;
    InlineEditor.attach(input, {
      save: () => {
        this.actions.renameCard(card.id, input.value);
      },
      cancel: () => {
        this.actions.cancelRename();
      },
      stillEditing: () => this.state.renaming === card.id,
    });
    return [input];
  }

  /**
   * A trash icon, shown on hover; deleting asks first.
   * @param card the card
   * @returns the button
   */
  private deleteButton(card: Card): HTMLElement {
    const trash = Dom.button("icon trash", () => {
      const count = card.links.length;
      const links = count === 1 ? "link" : "links";
      const question = `Delete the card "${card.name}" with ${String(count)} ${links}?`;
      if (window.confirm(question)) {
        this.actions.deleteCard(card.id);
      }
    });
    trash.append(Icons.icon("trash"));
    Dom.labelled(trash, "Delete this card");
    return trash;
  }

  /**
   * The drawing and caption of an empty card.
   * @returns the hint element
   */
  private static emptyHint(): HTMLElement {
    const hint = Dom.el("div", "empty-hint");
    const caption = Dom.el("span");
    caption.textContent = "Drop tabs here";
    hint.append(Icons.emptyArt(), caption);
    return hint;
  }
}
