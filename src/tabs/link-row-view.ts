import type { Card, Link } from "../lib/model.ts";
import { TextSearch } from "../lib/text-search.ts";
import { UrlText } from "../lib/urls.ts";
import { Dom, Icons } from "./dom.ts";
import { DragKinds } from "./drag.ts";
import type { LinkSource } from "./drag.ts";
import { InlineEditor } from "./inline-editor.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/** One saved link in a card: the row follows the link, drags to another place, edits in place. */
export class LinkRowView {
  /**
   * Creates the view.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, private readonly actions: PageActions) {}

  /**
   * Builds the row.
   * @param card the card that holds the link
   * @param page the link
   * @param index its place in the card, from 0
   * @returns the list item
   */
  build(card: Card, page: Link, index: number): HTMLElement {
    const source: LinkSource = { cardId: card.id, index };
    const row = Dom.el("li", this.rowClasses(card, page));
    row.draggable = true;
    this.wireDrag(row, card, page, source);
    row.append(Dom.favicon(page));
    if (this.isEditing(source)) {
      row.append(this.editor(page, source));
      return row;
    }
    row.append(this.text(page));
    const actions = Dom.el("span", "actions");
    actions.append(this.editButton(source), this.removeButton(source));
    row.append(actions);
    // the whole row follows the link; the buttons and the editor are exempt
    row.addEventListener("click", (event) => {
      const onControl = (event.target as Element).closest("button, form, input") !== null;
      if (!onControl) {
        this.actions.openLink(page.url);
      }
    });
    return row;
  }

  /**
   * The row's classes: a search hit, and the one-time highlight after a drop.
   * @param card the card
   * @param page the link
   * @returns the class attribute
   */
  private rowClasses(card: Card, page: Link): string {
    const classes = ["page"];
    const query = this.state.query;
    if (TextSearch.contains(page.title, query) || TextSearch.contains(page.url, query)) {
      classes.push("hit");
    }
    const added = this.state.justAdded;
    if (added?.cardId === card.id && added.url === page.url) {
      classes.push("new");
    }
    return classes.join(" ");
  }

  /**
   * The row drags as a saved link and takes a dropped link before or after itself.
   * @param row the row
   * @param card the card
   * @param page the link
   * @param source its card and place
   */
  private wireDrag(row: HTMLElement, card: Card, page: Link, source: LinkSource): void {
    row.addEventListener("dragstart", (event) => {
      DragKinds.startLink(event, row, { link: page, from: source });
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });
    row.addEventListener("dragover", (event) => {
      if (DragKinds.isLink(event.dataTransfer)) {
        const after = DragKinds.isLowerHalf(row, event);
        row.classList.toggle("drop-before", !after);
        row.classList.toggle("drop-after", after);
      }
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-before", "drop-after");
    });
    row.addEventListener("drop", (event) => {
      this.onDrop(event, row, card, source.index);
    });
  }

  /**
   * A link dropped on the row goes before or after it; the card's own drop handler stays out.
   * @param event the drop event
   * @param row the row
   * @param card the card
   * @param index the row's place
   */
  private onDrop(event: DragEvent, row: HTMLElement, card: Card, index: number): void {
    const drag = DragKinds.readLink(event);
    if (drag === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    row.closest(".card")?.classList.remove("over");
    const after = DragKinds.isLowerHalf(row, event);
    row.classList.remove("drop-before", "drop-after");
    const to = after ? index + 1 : index;
    this.actions.dropLink(card.id, drag, to);
  }

  /**
   * The title as a link and the host under it, both marked by the search.
   * @param page the link
   * @returns the text block
   */
  private text(page: Link): HTMLElement {
    const body = Dom.el("span", "text");
    const link = Dom.el("a") as HTMLAnchorElement;
    link.href = page.url;
    link.replaceChildren(...Dom.marked(page.title, this.state.query));
    link.title = page.url;
    link.addEventListener("click", (event) => {
      event.preventDefault();  // the row handles it
    });
    const host = Dom.el("span", "host");
    host.replaceChildren(...Dom.marked(UrlText.hostname(page.url), this.state.query));
    body.append(link, host);
    return body;
  }

  /**
   * The pen that opens the editor.
   * @param source the link's card and place
   * @returns the button
   */
  private editButton(source: LinkSource): HTMLElement {
    const edit = Dom.button("icon edit", () => {
      this.actions.startEditLink(source);
    });
    edit.append(Icons.icon("pen"));
    Dom.labelled(edit, "Edit the title and the url");
    return edit;
  }

  /**
   * The cross that removes the link.
   * @param source the link's card and place
   * @returns the button
   */
  private removeButton(source: LinkSource): HTMLElement {
    const remove = Dom.button("icon remove", () => {
      this.actions.removeLink(source);
    });
    remove.append(Icons.icon("close"));
    Dom.labelled(remove, "Remove this link");
    return remove;
  }

  /**
   * The editor: title and address; Enter or leaving saves, Escape cancels.
   * @param page the link
   * @param source its card and place
   * @returns the form
   */
  private editor(page: Link, source: LinkSource): HTMLElement {
    const form = Dom.el("form", "edit") as HTMLFormElement;
    const title = Dom.input("text", "title");
    title.value = page.title;
    title.placeholder = "Title";
    const url = Dom.input("text", "url");
    url.value = page.url;
    url.placeholder = "https://";
    url.spellcheck = false;
    form.append(title, url);
    InlineEditor.attachForm(form, {
      save: () => {
        this.actions.editLink(source, title.value, url.value);
      },
      cancel: () => {
        this.actions.cancelEditLink();
      },
      stillEditing: () => this.isEditing(source),
    });
    return form;
  }

  /**
   * Whether this link's editor is open.
   * @param source the link's card and place
   * @returns true while editing it
   */
  private isEditing(source: LinkSource): boolean {
    const editing = this.state.editingLink;
    return editing?.cardId === source.cardId && editing.index === source.index;
  }
}
