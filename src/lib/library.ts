import { CardLinks } from "./card-links.ts";
import type { Card, Clock, Collection, IdSource, LibraryData, Link } from "./model.ts";
import { MAIN_COLLECTION, SCHEMA_VERSION } from "./model.ts";
import { Palette } from "./palette.ts";

/** Where a card sits: its collection and its place there. */
export interface CardPlace {
  readonly collectionIndex: number;
  readonly cardIndex: number;
}

/**
 * The immutable library: collections of cards of links, with every operation the page needs. Each
 * operation returns a new library. A library always holds at least one collection, and a card id
 * appears once in the whole library, so card operations take a card id only.
 */
export class Library {
  /**
   * Creates a library; use empty() or fromData().
   * @param collections at least one collection
   */
  private constructor(readonly collections: readonly Collection[]) {}

  /**
   * A library with the one collection "Main" and no cards.
   * @returns the library
   */
  static empty(): Library {
    return new Library([MAIN_COLLECTION]);
  }

  /**
   * The library of a document; a document without collections gives the empty library.
   * @param data the document
   * @returns the library
   */
  static fromData(data: LibraryData): Library {
    if (data.collections.length === 0) {
      return Library.empty();
    }
    return new Library(data.collections);
  }

  /**
   * The document to store or export.
   * @returns the document
   */
  toData(): LibraryData {
    return { schemaVersion: SCHEMA_VERSION, collections: this.collections };
  }

  /**
   * A collection.
   * @param id its id
   * @returns the collection
   * @throws Error "no collection with id <id>"
   */
  collection(id: string): Collection {
    const found = this.collections.find((c) => c.id === id);
    if (found === undefined) {
      throw new Error(`no collection with id ${id}`);
    }
    return found;
  }

  /**
   * Whether a collection exists.
   * @param id its id
   * @returns true when the library holds it
   */
  hasCollection(id: string): boolean {
    return this.collections.some((c) => c.id === id);
  }

  /**
   * A card.
   * @param cardId its id
   * @returns the card
   * @throws Error "no card with id <id>"
   */
  card(cardId: string): Card {
    const place = this.locate(cardId);
    return this.cardAt(place);
  }

  /**
   * Where a card sits.
   * @param cardId its id
   * @returns its collection index and its place there
   * @throws Error "no card with id <id>"
   */
  locate(cardId: string): CardPlace {
    for (let collectionIndex = 0; collectionIndex < this.collections.length; collectionIndex++) {
      const cards = this.collections[collectionIndex]?.cards ?? [];
      const cardIndex = cards.findIndex((c) => c.id === cardId);
      if (cardIndex >= 0) {
        return { collectionIndex, cardIndex };
      }
    }
    throw new Error(`no card with id ${cardId}`);
  }

  /**
   * The collection that holds a card.
   * @param cardId the card's id
   * @returns the collection
   * @throws Error "no card with id <id>"
   */
  collectionOf(cardId: string): Collection {
    const place = this.locate(cardId);
    return this.collectionAt(place.collectionIndex);
  }

  /**
   * Every card of every collection, in document order.
   * @returns the cards
   */
  allCards(): readonly Card[] {
    return this.collections.flatMap((c) => c.cards);
  }

  // ---- collections ------------------------------------------------------------------------

  /**
   * Appends an empty collection.
   * @param name its name, trimmed
   * @param ids the id source
   * @returns the library with the new collection last
   * @throws Error "a collection needs a name"
   */
  createCollection(name: string, ids: IdSource): Library {
    const created: Collection = { id: ids.next(), name: Library.validName(name, "collection"), cards: [] };
    return new Library([...this.collections, created]);
  }

  /**
   * Renames a collection.
   * @param id its id
   * @param name the new name, trimmed
   * @returns the library with the new name
   * @throws Error for an unknown id or an empty name
   */
  renameCollection(id: string, name: string): Library {
    const collection = this.collection(id);
    return this.replaceCollection({ ...collection, name: Library.validName(name, "collection") });
  }

  /**
   * Deletes an empty collection; the last collection stays.
   * @param id its id
   * @returns the library without it
   * @throws Error for an unknown id, a collection with cards, or the last collection
   */
  removeCollection(id: string): Library {
    const collection = this.collection(id);
    const count = collection.cards.length;
    if (count > 0) {
      const cards = count === 1 ? "card" : "cards";
      throw new Error(`the collection "${collection.name}" still holds ${String(count)} ${cards}`);
    }
    if (this.collections.length === 1) {
      throw new Error("the last collection cannot be deleted");
    }
    return new Library(this.collections.filter((c) => c.id !== id));
  }

  /**
   * Moves a collection so that it sits where place `to` was before the move.
   * @param id its id
   * @param to the place, 0 .. collections.length (the end); its own place changes nothing
   * @returns the library in the new order
   * @throws Error for an unknown id or "no place for a collection at index <n>"
   */
  reorderCollection(id: string, to: number): Library {
    const collection = this.collection(id);
    const inside = Number.isInteger(to) && to >= 0 && to <= this.collections.length;
    if (!inside) {
      throw new Error(`no place for a collection at index ${String(to)}`);
    }
    const from = this.collections.indexOf(collection);
    const rest = this.collections.filter((c) => c.id !== id);
    const at = to > from ? to - 1 : to;
    return new Library([...rest.slice(0, at), collection, ...rest.slice(at)]);
  }

  // ---- cards ------------------------------------------------------------------------------

  /**
   * Appends an empty card to a collection, in the next free color.
   * @param collectionId the collection
   * @param name the card's name, trimmed
   * @param clock the clock for the creation time
   * @param ids the id source
   * @returns the library with the new card
   * @throws Error for an unknown collection or "a card needs a name"
   */
  createCard(collectionId: string, name: string, clock: Clock, ids: IdSource): Library {
    const collection = this.collection(collectionId);
    const hues = this.allCards().map((c) => c.hue);
    const created: Card = {
      id: ids.next(),
      name: Library.validName(name, "card"),
      createdAt: clock.now().toISOString(),
      hue: Palette.next(hues),
      links: [],
    };
    return this.replaceCollection({ ...collection, cards: [...collection.cards, created] });
  }

  /**
   * Renames a card.
   * @param cardId its id
   * @param name the new name, trimmed
   * @returns the library with the new name
   * @throws Error for an unknown card or "a card needs a name"
   */
  renameCard(cardId: string, name: string): Library {
    const card = this.card(cardId);
    return this.replaceCard({ ...card, name: Library.validName(name, "card") });
  }

  /**
   * Deletes a card with its links.
   * @param cardId its id
   * @returns the library without it
   * @throws Error "no card with id <id>"
   */
  removeCard(cardId: string): Library {
    const collection = this.collectionOf(cardId);
    return this.replaceCollection({ ...collection, cards: collection.cards.filter((c) => c.id !== cardId) });
  }

  /**
   * Moves a card within its collection, so that it sits where place `to` was before the move.
   * @param cardId its id
   * @param to the place, 0 .. cards.length (the end); its own place changes nothing
   * @returns the library in the new order
   * @throws Error for an unknown card or "no place for a card at index <n>"
   */
  reorderCard(cardId: string, to: number): Library {
    const collection = this.collectionOf(cardId);
    const card = this.card(cardId);
    const inside = Number.isInteger(to) && to >= 0 && to <= collection.cards.length;
    if (!inside) {
      throw new Error(`no place for a card at index ${String(to)}`);
    }
    const from = collection.cards.indexOf(card);
    const rest = collection.cards.filter((c) => c.id !== cardId);
    const at = to > from ? to - 1 : to;
    return this.replaceCollection({ ...collection, cards: [...rest.slice(0, at), card, ...rest.slice(at)] });
  }

  /**
   * Moves a card to the end of another collection; within its own collection nothing changes.
   * @param cardId the card
   * @param collectionId the target collection
   * @returns the library after the move
   * @throws Error for an unknown card or collection
   */
  moveCard(cardId: string, collectionId: string): Library {
    const card = this.card(cardId);
    const target = this.collection(collectionId);
    const source = this.collectionOf(cardId);
    if (source.id === target.id) {
      return this;
    }
    const removed = this.replaceCollection({ ...source, cards: source.cards.filter((c) => c.id !== cardId) });
    return removed.replaceCollection({ ...target, cards: [...target.cards, card] });
  }

  // ---- links ------------------------------------------------------------------------------

  /**
   * Adds a link to a card, at a place or at the end.
   * @param cardId the card
   * @param link the link
   * @param to the place, 0 .. links.length; undefined for the end
   * @returns the library with the link
   * @throws Error for an unknown card, "already in <card>", or a place outside the card
   */
  addLink(cardId: string, link: Link, to: number | undefined): Library {
    const card = this.card(cardId);
    return this.replaceCard(CardLinks.insert(card, link, to));
  }

  /**
   * Removes a link from a card.
   * @param cardId the card
   * @param index the link's place, from 0
   * @returns the library without the link
   * @throws Error for an unknown card or link
   */
  removeLink(cardId: string, index: number): Library {
    const card = this.card(cardId);
    return this.replaceCard(CardLinks.remove(card, index));
  }

  /**
   * Changes a link's title and address.
   * @param cardId the card
   * @param index the link's place, from 0
   * @param title the new title
   * @param url the new address
   * @returns the library with the changed link
   * @throws Error from CardLinks.edit, or for an unknown card
   */
  editLink(cardId: string, index: number, title: string, url: string): Library {
    const card = this.card(cardId);
    return this.replaceCard(CardLinks.edit(card, index, title, url));
  }

  /**
   * Moves a link to a place in the same or another card.
   * @param fromCardId the card that holds it
   * @param index its place there, from 0
   * @param toCardId the target card
   * @param to the place in the target, undefined for the end (in the same card: no change)
   * @returns the library after the move
   * @throws Error for an unknown card or link, a place outside the target, or "already in <card>"
   */
  moveLink(fromCardId: string, index: number, toCardId: string, to: number | undefined): Library {
    const source = this.card(fromCardId);
    if (fromCardId === toCardId) {
      if (to === undefined) {
        return this;
      }
      return this.replaceCard(CardLinks.reorder(source, index, to));
    }
    const link = CardLinks.at(source, index);
    const target = CardLinks.insert(this.card(toCardId), link, to);
    return this.replaceCard(target).replaceCard(CardLinks.remove(source, index));
  }

  // ---- whole collections of cards (import) -----------------------------------------------

  /**
   * The library with a collection's cards replaced.
   * @param collectionId the collection
   * @param cards the new cards; their ids must not be used in other collections
   * @returns the new library
   * @throws Error for an unknown collection
   */
  withCards(collectionId: string, cards: readonly Card[]): Library {
    const collection = this.collection(collectionId);
    return this.replaceCollection({ ...collection, cards });
  }

  /**
   * The library with a collection appended.
   * @param collection the collection; its id and its cards' ids must be new to the library
   * @returns the new library
   */
  withCollection(collection: Collection): Library {
    return new Library([...this.collections, collection]);
  }

  // ---- internals --------------------------------------------------------------------------

  /**
   * The library with one collection replaced (matched by id).
   * @param updated the new version of the collection
   * @returns the new library
   */
  private replaceCollection(updated: Collection): Library {
    return new Library(this.collections.map((c) => (c.id === updated.id ? updated : c)));
  }

  /**
   * The library with one card replaced in its collection (matched by id).
   * @param updated the new version of the card
   * @returns the new library
   */
  private replaceCard(updated: Card): Library {
    const collection = this.collectionOf(updated.id);
    const cards = collection.cards.map((c) => (c.id === updated.id ? updated : c));
    return this.replaceCollection({ ...collection, cards });
  }

  /**
   * The collection at a place.
   * @param index the place
   * @returns the collection
   */
  private collectionAt(index: number): Collection {
    const collection = this.collections[index];
    if (collection === undefined) {
      throw new Error(`no collection at index ${String(index)}`);
    }
    return collection;
  }

  /**
   * The card at a place.
   * @param place the collection and card index
   * @returns the card
   */
  private cardAt(place: CardPlace): Card {
    const card = this.collectionAt(place.collectionIndex).cards[place.cardIndex];
    if (card === undefined) {
      throw new Error(`no card at index ${String(place.cardIndex)}`);
    }
    return card;
  }

  /**
   * A trimmed name.
   * @param name the typed name
   * @param what "card" or "collection", for the error
   * @returns the trimmed name
   * @throws Error "a <what> needs a name" when it is empty
   */
  private static validName(name: string, what: "card" | "collection"): string {
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new Error(`a ${what} needs a name`);
    }
    return trimmed;
  }
}
