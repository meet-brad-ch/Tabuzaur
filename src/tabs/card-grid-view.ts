import { LibrarySearch } from "../lib/library-search.ts";
import { CardView } from "./card-view.ts";
import { Dom } from "./dom.ts";
import type { PageActions } from "./page-actions.ts";
import type { PageState } from "./page-state.ts";

/** The cards area: the cards of the open collection that match the search. */
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
    main.replaceChildren();
    const open = this.state.openCollection();
    const shown = LibrarySearch.matchingCards(open, this.state.query);
    if (shown.length === 0) {
      const empty = Dom.el("p", "empty");
      const none = open.cards.length === 0;
      empty.textContent = none
        ? `No cards in ${open.name} yet. Create one above, then drag tabs into it.`
        : `No card in ${open.name} matches. The tabs show where the matches are.`;
      main.append(empty);
      return;
    }
    const grid = Dom.el("div", "cards");
    for (const card of shown) {
      grid.append(this.cards.build(card, card.hue));
    }
    main.append(grid);
  }
}
