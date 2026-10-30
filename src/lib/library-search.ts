import type { Card, Collection } from "./model.ts";
import { TextSearch } from "./text-search.ts";

/** The search over cards: a card matches when its name, or a link's title or address, contains the query. */
export class LibrarySearch {
  /**
   * Whether a card matches; every card matches a blank query.
   * @param card the card
   * @param query the typed query
   * @returns true for a match
   */
  static cardMatches(card: Card, query: string): boolean {
    if (query.trim() === "") {
      return true;
    }
    if (TextSearch.contains(card.name, query)) {
      return true;
    }
    return card.links.some((l) => TextSearch.contains(l.title, query) || TextSearch.contains(l.url, query));
  }

  /**
   * The cards of a collection that match, in their order.
   * @param collection the collection
   * @param query the typed query
   * @returns the matching cards
   */
  static matchingCards(collection: Collection, query: string): readonly Card[] {
    return collection.cards.filter((c) => LibrarySearch.cardMatches(c, query));
  }

  /**
   * How many cards of a collection match: the count on its tab while a search is typed.
   * @param collection the collection
   * @param query the typed query
   * @returns the count
   */
  static matchCount(collection: Collection, query: string): number {
    return LibrarySearch.matchingCards(collection, query).length;
  }
}
