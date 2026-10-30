import { HUE_COUNT } from "../lib/model.ts";
import { CardView } from "./card-view.ts";
import { Dom } from "./dom.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/** The cards area: a heading and the grid of cards that match the search. */
export class CardGridView {
  private readonly cards: CardView;

  /**
   * Creates the view.
   * @param state the page state
   * @param actions the page actions
   */
  constructor(private readonly state: PageState, actions: PageActions) {
    this.cards = new CardView(state, actions);
  }

  /**
   * Fills the cards area.
   * @param main the cards area
   */
  fill(main: HTMLElement): void {
    const heading = Dom.el("h2");
    heading.textContent = "Collections";
    main.replaceChildren(heading);
    const book = this.state.book;
    const shown = book.search(this.state.query);
    if (shown.length === 0) {
      const empty = Dom.el("p", "empty");
      const none = book.collections.length === 0;
      empty.textContent = none ? "No collections yet. Create one above, then drag tabs into it." : "Nothing matches.";
      main.append(empty);
      return;
    }
    const grid = Dom.el("div", "cards");
    for (const card of shown) {
      const hue = card.hue ?? book.collections.indexOf(card) % HUE_COUNT;
      grid.append(this.cards.build(card, hue));
    }
    main.append(grid);
  }
}
