import type { Card, Link } from "./model.ts";

/** The rules on one card's links. Every method returns a new card; the card passed in stays as it was. */
export class CardLinks {
  /**
   * Appends a link.
   * @param card the card
   * @param link the link
   * @returns the card with the link at its end
   * @throws Error "already in <card>" when the card holds the address
   */
  static add(card: Card, link: Link): Card {
    if (card.links.some((l) => l.url === link.url)) {
      throw new Error(`already in ${card.name}`);
    }
    return { ...card, links: [...card.links, link] };
  }

  /**
   * Removes one link; an emptied card stays.
   * @param card the card
   * @param index the link's place, from 0
   * @returns the card without the link
   * @throws Error when the card has no link at that place
   */
  static remove(card: Card, index: number): Card {
    CardLinks.at(card, index);
    return { ...card, links: card.links.filter((_, i) => i !== index) };
  }

  /**
   * Changes a link's title and address. Both are trimmed.
   * @param card the card
   * @param index the link's place, from 0
   * @param title the new title
   * @param url the new address
   * @returns the card with the changed link
   * @throws Error for a missing link, an empty title, an address that does not parse, or one another link of the card has
   */
  static edit(card: Card, index: number, title: string, url: string): Card {
    CardLinks.at(card, index);
    const newTitle = title.trim();
    if (newTitle === "") {
      throw new Error("a link needs a title");
    }
    const newUrl = CardLinks.validUrl(url);
    if (card.links.some((l, i) => i !== index && l.url === newUrl)) {
      throw new Error(`already in ${card.name}`);
    }
    const links = card.links.map((l, i) => (i === index ? { ...l, title: newTitle, url: newUrl } : l));
    return { ...card, links };
  }

  /**
   * Moves a link so that it sits where place `to` was before the move.
   * @param card the card
   * @param from the link's place, from 0
   * @param to the place, 0 .. links.length (the end); its own place changes nothing
   * @returns the card in the new order
   * @throws Error for a missing link or a place outside the card
   */
  static reorder(card: Card, from: number, to: number): Card {
    const link = CardLinks.at(card, from);
    CardLinks.checkPlace(card, to);
    const rest = card.links.filter((_, i) => i !== from);
    const at = to > from ? to - 1 : to;
    return { ...card, links: [...rest.slice(0, at), link, ...rest.slice(at)] };
  }

  /**
   * Inserts a link at a place.
   * @param card the card
   * @param link the link
   * @param to the place, 0 .. links.length; undefined for the end
   * @returns the card with the link
   * @throws Error "already in <card>", or for a place outside the card
   */
  static insert(card: Card, link: Link, to: number | undefined): Card {
    const added = CardLinks.add(card, link);
    if (to === undefined) {
      return added;
    }
    return CardLinks.reorder(added, added.links.length - 1, to);
  }

  /**
   * The link at a place.
   * @param card the card
   * @param index the place, from 0
   * @returns the link
   * @throws Error "card <id> has no link at index <n>"
   */
  static at(card: Card, index: number): Link {
    const link = Number.isInteger(index) ? card.links[index] : undefined;
    if (link === undefined) {
      throw new Error(`card ${card.id} has no link at index ${String(index)}`);
    }
    return link;
  }

  /**
   * Checks a place for a link.
   * @param card the card
   * @param to the place, 0 .. links.length
   * @throws Error "card <id> has no place at index <n>"
   */
  private static checkPlace(card: Card, to: number): void {
    const inside = Number.isInteger(to) && to >= 0 && to <= card.links.length;
    if (!inside) {
      throw new Error(`card ${card.id} has no place at index ${String(to)}`);
    }
  }

  /**
   * The trimmed address, if it parses as one.
   * @param url the typed address
   * @returns the trimmed address
   * @throws Error "not a valid url: <url>"
   */
  private static validUrl(url: string): string {
    const trimmed = url.trim();
    if (!URL.canParse(trimmed)) {
      throw new Error(`not a valid url: ${trimmed}`);
    }
    return trimmed;
  }
}
