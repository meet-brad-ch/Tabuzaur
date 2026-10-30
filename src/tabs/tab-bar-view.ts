import { DropRules } from "../lib/drop-rules.ts";
import { TabStrip } from "../lib/tab-strip.ts";
import type { TabModel } from "../lib/tab-strip.ts";
import { Dom, Icons } from "./dom.ts";
import { DragKinds } from "./drag.ts";
import { InlineEditor } from "./inline-editor.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/**
 * The collection bar under the header: one tab per collection and a + for a new one. A click opens
 * a collection; the open tab has a pen and a trash. Tabs reorder by drag, and a card dropped on a
 * tab moves to that collection.
 */
export class TabBarView {
  /**
   * Creates the view.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, private readonly actions: PageActions) {}

  /**
   * Builds the bar.
   * @returns the nav element
   */
  build(): HTMLElement {
    const bar = Dom.el("nav", "tabbar");
    this.fill(bar);
    return bar;
  }

  /**
   * Fills the bar.
   * @param bar the nav element
   */
  fill(bar: HTMLElement): void {
    bar.setAttribute("aria-label", "Collections");
    const list = Dom.el("ul", "tab-list");
    list.setAttribute("role", "tablist");
    const state = this.state;
    const tabs = TabStrip.tabs(state.library, state.settings.openCollectionId, state.query);
    tabs.forEach((tab, index) => {
      list.append(this.tab(tab, index));
    });
    list.append(this.addItem());
    bar.replaceChildren(list);
  }

  /**
   * One tab.
   * @param tab its model
   * @param index its place in the bar, from 0
   * @returns the list item
   */
  private tab(tab: TabModel, index: number): HTMLElement {
    const item = Dom.el("li", this.tabClasses(tab));
    item.setAttribute("role", "tab");
    item.setAttribute("aria-selected", String(tab.open));
    item.tabIndex = 0;
    item.dataset.id = tab.id;
    const renaming = this.state.renamingCollection === tab.id;
    item.append(...this.label(tab, renaming));
    if (tab.open && !renaming) {
      item.append(this.renameButton(tab), this.deleteButton(tab));
    }
    this.wireSelect(item, tab);
    this.wireDrag(item, tab, index, renaming);
    return item;
  }

  /**
   * The tab's classes: its color, open, and the one-time flash after a card was dropped on it.
   * @param tab its model
   * @returns the class attribute
   */
  private tabClasses(tab: TabModel): string {
    const classes = ["ctab", `hue-${String(tab.hue)}`];
    if (tab.open) {
      classes.push("open");
    }
    if (this.state.flashCollectionId === tab.id) {
      classes.push("flash");
    }
    return classes.join(" ");
  }

  /**
   * The name with the count of matching cards, or the name field while it is being renamed.
   * @param tab its model
   * @param renaming whether its name is being edited
   * @returns the elements
   */
  private label(tab: TabModel, renaming: boolean): HTMLElement[] {
    if (renaming) {
      const input = Dom.input("text", "name");
      input.value = tab.name;
      InlineEditor.attach(input, {
        save: () => {
          this.actions.renameCollection(tab.id, input.value);
        },
        cancel: () => {
          this.actions.cancelRenameCollection();
        },
        stillEditing: () => this.state.renamingCollection === tab.id,
      });
      return [input];
    }
    const name = Dom.el("span", "name");
    name.textContent = tab.name;
    if (tab.count === undefined) {
      return [name];
    }
    const count = Dom.el("span", tab.count === 0 ? "count zero" : "count");
    count.textContent = String(tab.count);
    count.title = tab.count === 1 ? "1 card matches" : `${String(tab.count)} cards match`;
    return [name, count];
  }

  /**
   * The pen on the open tab.
   * @param tab its model
   * @returns the button
   */
  private renameButton(tab: TabModel): HTMLElement {
    const pen = Dom.button("icon edit", () => {
      this.actions.startRenameCollection(tab.id);
    });
    pen.append(Icons.icon("pen"));
    Dom.labelled(pen, "Rename this collection");
    return pen;
  }

  /**
   * The trash on the open tab. When the collection cannot go, it stays visible but disabled, its
   * tooltip says why, and a click shows the reason.
   * @param tab its model
   * @returns the button
   */
  private deleteButton(tab: TabModel): HTMLElement {
    const trash = Dom.button(tab.deletable ? "icon trash" : "icon trash disabled", () => {
      if (tab.deletable) {
        this.actions.deleteCollection(tab.id);
        return;
      }
      this.actions.explain(`${tab.name}: ${tab.deleteLabel}.`);
    });
    trash.setAttribute("aria-disabled", String(!tab.deletable));
    trash.append(Icons.icon("trash"));
    Dom.labelled(trash, tab.deleteLabel);
    return trash;
  }

  /**
   * A click, Enter or Space opens the collection; a double click renames it.
   * @param item the tab element
   * @param tab its model
   */
  private wireSelect(item: HTMLElement, tab: TabModel): void {
    item.addEventListener("click", (event) => {
      if (!TabBarView.onControl(event) && !tab.open) {
        this.actions.openCollection(tab.id);
      }
    });
    item.addEventListener("keydown", (event) => {
      const choose = event.key === "Enter" || event.key === " ";
      if (choose && event.target === item) {
        event.preventDefault();
        this.actions.openCollection(tab.id);
      }
    });
    item.addEventListener("dblclick", (event) => {
      if (!TabBarView.onControl(event)) {
        this.actions.startRenameCollection(tab.id);
      }
    });
  }

  /**
   * The tab drags as a collection, takes a dragged collection before or after itself, and takes
   * a dragged card into its collection.
   * @param item the tab element
   * @param tab its model
   * @param index its place in the bar
   * @param renaming whether its name field is open (then it does not drag)
   */
  private wireDrag(item: HTMLElement, tab: TabModel, index: number, renaming: boolean): void {
    item.draggable = !renaming;
    item.addEventListener("dragstart", (event) => {
      DragKinds.startCollection(event, item, tab.id);
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });
    item.addEventListener("dragover", (event) => {
      TabBarView.onDragOver(event, item);
    });
    item.addEventListener("dragleave", (event) => {
      if (!item.contains(event.relatedTarget as Node | null)) {
        item.classList.remove("over", "insert-before", "insert-after");
      }
    });
    item.addEventListener("drop", (event) => {
      this.onDrop(event, item, tab, index);
    });
  }

  /**
   * Shows where a drop would land: an insertion line for a collection, a lift for a card. Other
   * drags are refused (no preventDefault), so the pointer shows "no drop".
   * @param event the dragover event
   * @param item the tab element
   */
  private static onDragOver(event: DragEvent, item: HTMLElement): void {
    const kind = DragKinds.kindOf(event.dataTransfer);
    if (kind === undefined || !DropRules.accepts(kind, "tab") || event.dataTransfer === null) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (kind === "card") {
      item.classList.add("over");
      return;
    }
    const after = DragKinds.isRightHalf(item, event);
    item.classList.toggle("insert-before", !after);
    item.classList.toggle("insert-after", after);
  }

  /**
   * A dropped collection moves before or after this tab; a dropped card moves into its collection.
   * @param event the drop event
   * @param item the tab element
   * @param tab its model
   * @param index its place in the bar
   */
  private onDrop(event: DragEvent, item: HTMLElement, tab: TabModel, index: number): void {
    item.classList.remove("over", "insert-before", "insert-after");
    const kind = DragKinds.kindOf(event.dataTransfer);
    if (kind === "collection") {
      event.preventDefault();
      const after = DragKinds.isRightHalf(item, event) ? 1 : 0;
      this.actions.reorderCollection(DragKinds.readCollection(event), index + after);
      return;
    }
    if (kind === "card") {
      event.preventDefault();
      this.actions.moveCard(DragKinds.readCard(event), tab.id);
    }
  }

  /**
   * The + at the end of the bar, or the name field of the new collection.
   * @returns the list item
   */
  private addItem(): HTMLElement {
    const item = Dom.el("li", "add");
    if (!this.state.addingCollection) {
      const plus = Dom.button("icon add", () => {
        this.actions.startNewCollection();
      });
      plus.append(Icons.icon("plus"));
      Dom.labelled(plus, "New collection");
      item.append(plus);
      return item;
    }
    const input = Dom.input("text", "name");
    input.placeholder = "New collection";
    InlineEditor.attach(input, {
      save: () => {
        this.saveNew(input.value);
      },
      cancel: () => {
        this.actions.cancelNewCollection();
      },
      stillEditing: () => this.state.addingCollection,
    });
    item.append(input);
    return item;
  }

  /**
   * Creates the collection, or closes the field quietly when it is blank.
   * @param name the typed name
   */
  private saveNew(name: string): void {
    if (name.trim() === "") {
      this.actions.cancelNewCollection();
      return;
    }
    this.actions.createCollection(name);
  }

  /**
   * Whether an event started on a button or a field inside the tab.
   * @param event the event
   * @returns true for a control
   */
  private static onControl(event: Event): boolean {
    return (event.target as Element).closest("button, input") !== null;
  }
}
