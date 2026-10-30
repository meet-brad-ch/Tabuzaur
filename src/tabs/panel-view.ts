import type { SavedPage } from "../lib/model.ts";
import type { OpenTab } from "../lib/tabs.ts";
import { TextSearch } from "../lib/text-search.ts";
import { UrlText } from "../lib/urls.ts";
import { Dom, Icons } from "./dom.ts";
import { DragKinds } from "./drag.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/** The open-tab panel (a flyout from the rail, or a pinned column) and the rail with its count. */
export class PanelView {
  /**
   * Creates the view.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, private readonly actions: PageActions) {}

  /**
   * Fills the rail: the count of open tabs and its label.
   * @param rail the rail element
   */
  fillRail(rail: HTMLElement): void {
    const count = this.otherTabs().length;
    const label = Dom.el("span", "label");
    label.textContent = "Open tabs";
    const badge = Dom.el("span", "count");
    badge.textContent = String(count);
    rail.replaceChildren(badge, label);
    rail.title = "Rest the pointer here to see the open tabs";
  }

  /**
   * Fills the panel: the head with the pin and the filter, then the open tabs grouped by window.
   * @param aside the panel element
   */
  fillPanel(aside: HTMLElement): void {
    aside.replaceChildren(this.head());
    const tabs = this.otherTabs().filter((t) => this.matches(t));
    for (const windowId of this.windowOrder(tabs)) {
      const inWindow = tabs.filter((t) => t.windowId === windowId);
      aside.append(this.windowGroup(windowId, inWindow));
    }
    if (tabs.length === 0) {
      const empty = Dom.el("p", "empty");
      const blank = this.state.tabQuery.trim() === "";
      empty.textContent = blank ? "No other tabs are open." : "No open tab matches.";
      aside.append(empty);
    }
  }

  /**
   * The panel head: the title with the pin, and the filter field.
   * @returns the head element
   */
  private head(): HTMLElement {
    const head = Dom.el("div", "side-head");
    const titleRow = Dom.el("div", "title-row");
    const heading = Dom.el("h2");
    heading.textContent = "Open tabs";
    titleRow.append(heading, this.pinButton());
    const filter = Dom.el("label", "field search small");
    const input = Dom.input("search");
    input.placeholder = "Filter tabs";
    input.value = this.state.tabQuery;
    input.addEventListener("input", () => {
      this.actions.filterTabs(input.value);
    });
    filter.append(Icons.icon("search"), input);
    head.append(titleRow, filter);
    return head;
  }

  /**
   * The pin that keeps the panel open as a column.
   * @returns the button
   */
  private pinButton(): HTMLElement {
    const pinned = this.state.pinned;
    const pin = Dom.button(pinned ? "icon pin on" : "icon pin", () => {
      this.actions.togglePin();
    });
    pin.append(Icons.icon("pin"));
    Dom.labelled(pin, pinned ? "Unpin: the panel slides in on hover" : "Pin the panel open");
    return pin;
  }

  /**
   * One window's tabs as a folding group, remembered while the page is open.
   * @param windowId the window
   * @param tabs its tabs that pass the filter
   * @returns the details element
   */
  private windowGroup(windowId: number, tabs: readonly OpenTab[]): HTMLElement {
    const group = Dom.el("details", "window") as HTMLDetailsElement;
    group.open = !this.state.collapsed.has(windowId);
    group.addEventListener("toggle", () => {
      if (group.open) {
        this.state.collapsed.delete(windowId);
      } else {
        this.state.collapsed.add(windowId);
      }
    });
    const summary = Dom.el("summary");
    const label = Dom.el("span", "label");
    const own = windowId === this.state.ownWindowId;
    label.textContent = own ? "This window" : `Window ${String(windowId)}`;
    const count = Dom.el("span", "count");
    count.textContent = String(tabs.length);
    summary.append(Icons.icon("chevron"), label, count);
    const list = Dom.el("ul");
    list.append(...tabs.map((t) => this.tabRow(t)));
    group.append(summary, list);
    return group;
  }

  /**
   * One open tab: a click brings it to the front, a drag carries it to a card.
   * @param tab the open tab
   * @returns the row
   */
  private tabRow(tab: OpenTab): HTMLElement {
    const row = Dom.el("li", tab.active ? "tab active" : "tab");
    row.draggable = true;
    row.title = tab.url;
    const body = Dom.el("span", "text");
    const title = Dom.el("span", "title");
    title.replaceChildren(...Dom.marked(tab.title, this.state.tabQuery));
    const host = Dom.el("span", "host");
    host.replaceChildren(...Dom.marked(UrlText.hostname(tab.url), this.state.tabQuery));
    body.append(title, host);
    row.append(Dom.favicon(tab), body);
    row.addEventListener("click", () => {
      this.actions.activateTab(tab);
    });
    row.addEventListener("dragstart", (event) => {
      PanelView.startTabDrag(event, row, tab);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      row.closest(".layout")?.classList.remove("dragging-out");
    });
    return row;
  }

  /**
   * Starts the drag of an open tab and folds the flyout away. No mouse events arrive during a
   * native drag, so :hover would keep the flyout open over the cards until the drag ends.
   * @param event the dragstart event
   * @param row the dragged row
   * @param tab the open tab
   */
  private static startTabDrag(event: DragEvent, row: HTMLElement, tab: OpenTab): void {
    const page: SavedPage = tab.favIconUrl === undefined
      ? { title: tab.title, url: tab.url }
      : { title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl };
    DragKinds.startLink(event, row, { page });
    // after the browser took the drag image
    setTimeout(() => {
      row.closest(".layout")?.classList.add("dragging-out");
    }, 0);
  }

  /**
   * The open tabs without the Tabuzaur page itself.
   * @returns those tabs
   */
  private otherTabs(): readonly OpenTab[] {
    return this.state.openTabs.filter((t) => t.url !== this.state.ownUrl);
  }

  /**
   * Whether a tab passes the panel filter.
   * @param tab the tab
   * @returns true for a blank filter or a match in the title or the address
   */
  private matches(tab: OpenTab): boolean {
    const query = this.state.tabQuery;
    if (query.trim() === "") {
      return true;
    }
    return TextSearch.contains(tab.title, query) || TextSearch.contains(tab.url, query);
  }

  /**
   * The windows to show: this window first, then the others by id.
   * @param tabs the tabs to show
   * @returns window ids
   */
  private windowOrder(tabs: readonly OpenTab[]): number[] {
    const own = this.state.ownWindowId;
    const ids = [...new Set(tabs.map((t) => t.windowId))];
    return ids.sort((a, b) => {
      const ownFirst = Number(b === own) - Number(a === own);
      if (ownFirst !== 0) {
        return ownFirst;
      }
      return a - b;
    });
  }
}
