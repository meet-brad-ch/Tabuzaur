import { CardGridView } from "./card-grid-view.ts";
import { Dom } from "./dom.ts";
import { DragScroller } from "./drag-scroller.ts";
import { HeaderView } from "./header-view.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";
import { PanelView } from "./panel-view.ts";
import { TabBarView } from "./tab-bar-view.ts";

/** The kinds of notice in the strip under the header. */
export type NoticeKind = "info" | "error";

/**
 * Owns the page's regions (header, notice, collection bar, panel with rail, cards) and rebuilds
 * one or all of them from the state. A rebuild keeps the scroll positions, or a drop into a card
 * below the fold would throw the viewer back to the top; a switch to another collection starts
 * its cards at the top.
 */
export class Renderer {
  private readonly header: HeaderView;
  private readonly grid: CardGridView;
  private readonly panel: PanelView;
  private readonly tabs: TabBarView;

  /**
   * Creates the renderer.
   * @param root the page's #app element
   * @param state the page state
   * @param actions the page actions, passed to the views
   */
  constructor(private readonly root: HTMLElement, private readonly state: PageState, actions: PageActions) {
    this.header = new HeaderView(state, actions);
    this.grid = new CardGridView(state, actions);
    this.panel = new PanelView(state, actions);
    this.tabs = new TabBarView(state, actions);
  }

  /** Rebuilds the whole page and shows a pending notice. */
  renderAll(): void {
    const mainTop = this.state.cardsToTop ? 0 : this.root.querySelector("main")?.scrollTop ?? 0;
    const asideTop = this.root.querySelector("aside")?.scrollTop ?? 0;
    const barLeft = this.root.querySelector("nav.tabbar")?.scrollLeft ?? 0;
    this.state.cardsToTop = false;
    const notice = Dom.el("p", "notice");
    const bar = this.tabs.build();
    this.root.replaceChildren(this.header.build(), notice, bar, this.layout(bar));
    this.state.flashCollectionId = undefined;
    this.must("main").scrollTop = mainTop;
    this.must("aside").scrollTop = asideTop;
    bar.scrollLeft = barLeft;
    const pending = this.state.pendingNotice;
    this.state.pendingNotice = undefined;
    if (pending === undefined) {
      notice.setAttribute("hidden", "");
      return;
    }
    this.notify(pending, "info");
  }

  /** Rebuilds the cards; the one-time highlight of a dropped link is spent. */
  renderCards(): void {
    this.grid.fill(this.must("main"));
    this.state.justAdded = undefined;
  }

  /** Rebuilds the collection bar. */
  renderTabs(): void {
    const bar = this.must("nav.tabbar");
    const left = bar.scrollLeft;
    this.tabs.fill(bar);
    bar.scrollLeft = left;
  }

  /** Rebuilds the open-tab panel and the rail. */
  renderPanel(): void {
    this.panel.fillPanel(this.must("aside"));
    this.panel.fillRail(this.must(".rail"));
  }

  /**
   * Shows a message in the strip under the header.
   * @param message the text
   * @param kind info or error
   */
  notify(message: string, kind: NoticeKind): void {
    const notice = this.must(".notice");
    notice.textContent = message;
    notice.className = `notice ${kind}`;
    notice.removeAttribute("hidden");
  }

  /**
   * Puts the focus into a field after a rebuild.
   * @param selector the field
   * @param select whether its text is selected as well
   */
  focus(selector: string, select: boolean): void {
    const input = this.root.querySelector<HTMLInputElement>(selector);
    if (select) {
      Dom.focusAndSelect(input);
      return;
    }
    input?.focus();
  }

  /**
   * The rail, the panel and the cards area. Pinned: a two-column grid. Unpinned: the panel is a
   * flyout over the cards, opened by hovering the rail.
   * @param bar the collection bar, a second source of drags that may pass over the cards
   * @returns the layout element
   */
  private layout(bar: HTMLElement): HTMLElement {
    const layout = Dom.el("div", this.state.settings.panelPinned ? "layout pinned" : "layout");
    const rail = Dom.el("div", "rail");
    const aside = Dom.el("aside");
    const main = Dom.el("main");
    layout.append(rail, aside, main);
    new DragScroller(main, [layout, bar]);
    this.panel.fillPanel(aside);
    this.panel.fillRail(rail);
    this.grid.fill(main);
    this.state.justAdded = undefined;
    return layout;
  }

  /**
   * A required element of the page.
   * @param selector the element
   * @returns it
   * @throws Error when the page has no such element
   */
  private must(selector: string): HTMLElement {
    const node = this.root.querySelector<HTMLElement>(selector);
    if (node === null) {
      throw new Error(`the page has no ${selector}`);
    }
    return node;
  }
}
