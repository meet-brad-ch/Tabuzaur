import type { Card, Collection, IdSource, LibraryData } from "./model.ts";
import { Library } from "./library.ts";

/**
 * Takes imported cards into a library without removing anything. A card joins the library's card
 * with the same id (in any collection), else the card with the same name in the target collection,
 * and brings the links whose address that card lacks; the card keeps its own name and titles.
 * Otherwise the card is appended to the target collection.
 */
export class LibraryMerge {
  /**
   * Merges a whole document: a collection joins the one with the same id, else the same name; an
   * unknown collection is appended (empty first, then its cards come in by the card rule).
   * @param library the library
   * @param incoming the imported document
   * @returns the merged library
   */
  static mergeLibrary(library: Library, incoming: LibraryData): Library {
    let merged = library;
    for (const collection of incoming.collections) {
      const targetId = LibraryMerge.targetCollection(merged, collection);
      if (!merged.hasCollection(targetId)) {
        merged = merged.withCollection({ id: targetId, name: collection.name, cards: [] });
      }
      merged = LibraryMerge.mergeCards(merged, targetId, collection.cards);
    }
    return merged;
  }

  /**
   * Merges cards into one collection.
   * @param library the library
   * @param collectionId the target collection
   * @param cards the imported cards
   * @returns the merged library
   * @throws Error for an unknown collection
   */
  static mergeCards(library: Library, collectionId: string, cards: readonly Card[]): Library {
    let merged = library;
    for (const card of cards) {
      merged = LibraryMerge.mergeCard(merged, collectionId, card);
    }
    return merged;
  }

  /**
   * Replaces one collection's cards; the other collections stay. An imported card whose id another
   * collection uses gets a new id, so every card id stays unique.
   * @param library the library
   * @param collectionId the target collection
   * @param cards the imported cards
   * @param ids the id source for new ids
   * @returns the new library
   * @throws Error for an unknown collection
   */
  static replaceCards(library: Library, collectionId: string, cards: readonly Card[], ids: IdSource): Library {
    const usedElsewhere = new Set<string>();
    for (const collection of library.collections) {
      if (collection.id !== collectionId) {
        collection.cards.forEach((c) => usedElsewhere.add(c.id));
      }
    }
    const fresh = cards.map((c) => (usedElsewhere.has(c.id) ? { ...c, id: ids.next() } : c));
    return library.withCards(collectionId, fresh);
  }

  /**
   * The id of the collection an imported collection goes to: the same id, else the same name,
   * else its own id (a new collection).
   * @param library the library
   * @param incoming the imported collection
   * @returns the target id
   */
  private static targetCollection(library: Library, incoming: Collection): string {
    if (library.hasCollection(incoming.id)) {
      return incoming.id;
    }
    const byName = library.collections.find((c) => LibraryMerge.sameName(c.name, incoming.name));
    if (byName !== undefined) {
      return byName.id;
    }
    return incoming.id;
  }

  /**
   * Merges one card by the card rule.
   * @param library the library
   * @param collectionId the target collection
   * @param incoming the imported card
   * @returns the merged library
   */
  private static mergeCard(library: Library, collectionId: string, incoming: Card): Library {
    const existing = LibraryMerge.existingCard(library, collectionId, incoming);
    if (existing === undefined) {
      const collection = library.collection(collectionId);
      return library.withCards(collectionId, [...collection.cards, incoming]);
    }
    let merged = library;
    const known = new Set(existing.links.map((l) => l.url));
    for (const link of incoming.links) {
      if (!known.has(link.url)) {
        merged = merged.addLink(existing.id, link, undefined);
      }
    }
    return merged;
  }

  /**
   * The library's card an imported card joins.
   * @param library the library
   * @param collectionId the target collection
   * @param incoming the imported card
   * @returns the card with the same id anywhere, else with the same name in the target, else undefined
   */
  private static existingCard(library: Library, collectionId: string, incoming: Card): Card | undefined {
    const byId = library.allCards().find((c) => c.id === incoming.id);
    if (byId !== undefined) {
      return byId;
    }
    const target = library.collection(collectionId);
    return target.cards.find((c) => LibraryMerge.sameName(c.name, incoming.name));
  }

  /**
   * Whether two names are the same, ignoring case and surrounding spaces.
   * @param a one name
   * @param b the other
   * @returns true when they match
   */
  private static sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
}
