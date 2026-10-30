import type { Card, Collection, LibraryData, Link } from "./model.ts";
import { HUE_COUNT, SCHEMA_VERSION } from "./model.ts";
import { Palette } from "./palette.ts";

/** What a stored or imported document holds. */
export type DocumentContent =
  /** Schema 2: collections of cards. */
  | { readonly kind: "library"; readonly data: LibraryData }
  /** Schema 1, Tabuzaur 0.8 and earlier: cards only, every card with a hue. */
  | { readonly kind: "cards"; readonly cards: readonly Card[] };

/**
 * Reads a stored or imported document, schema 1 or 2, and checks every field. Anything that is not
 * the schema fails with the path of the field, for example "collections[1].cards[0].links[2].url is
 * not a string". Unknown fields are dropped.
 */
export class DocumentReader {
  /**
   * The content of a document.
   * @param raw the parsed JSON
   * @returns the library (schema 2) or the cards (schema 1)
   * @throws Error naming the first field that is not the schema
   */
  static read(raw: unknown): DocumentContent {
    const doc = DocumentReader.record(raw, "store");
    if (!Array.isArray(doc.collections)) {
      DocumentReader.checkVersion(doc.schemaVersion);
      throw new Error("store.collections is not an array");
    }
    const items: unknown[] = doc.collections;
    if (doc.schemaVersion === 1) {
      const cards = items.map((c, i) => DocumentReader.card(c, i, `collections[${String(i)}]`, "pages"));
      return { kind: "cards", cards };
    }
    DocumentReader.checkVersion(doc.schemaVersion);
    const collections = items.map((c, i) => DocumentReader.collection(c, i, `collections[${String(i)}]`));
    return { kind: "library", data: { schemaVersion: SCHEMA_VERSION, collections } };
  }

  /**
   * Fails on a schema version other than 1 and 2.
   * @param version the stored version
   * @throws Error "unsupported schemaVersion <v>"
   */
  private static checkVersion(version: unknown): void {
    if (version !== 1 && version !== SCHEMA_VERSION) {
      throw new Error(`unsupported schemaVersion ${JSON.stringify(version)}`);
    }
  }

  /**
   * A schema-2 collection.
   * @param raw the stored value
   * @param place its place in the document, from 0
   * @param where its path for the error
   * @returns the collection
   * @throws Error naming the field
   */
  private static collection(raw: unknown, place: number, where: string): Collection {
    const c = DocumentReader.record(raw, where);
    if (!Array.isArray(c.cards)) {
      throw new Error(`${where}.cards is not an array`);
    }
    const items: unknown[] = c.cards;
    return {
      id: DocumentReader.text(c.id, `${where}.id`),
      name: DocumentReader.text(c.name, `${where}.name`),
      hue: DocumentReader.tabHue(c.hue, place, where),
      cards: items.map((k, j) => DocumentReader.card(k, j, `${where}.cards[${String(j)}]`, "links")),
    };
  }

  /**
   * A card. Schema 1 keeps its links in "pages" (in "tabs" before 0.1.0) and may lack a hue (before
   * 0.3.0): it gets the color of its place, as the page showed it then. Schema 2 needs both.
   * @param raw the stored value
   * @param place the card's place in its list, from 0
   * @param where its path for the error
   * @param field "pages" for schema 1, "links" for schema 2
   * @returns the card
   * @throws Error naming the field
   */
  private static card(raw: unknown, place: number, where: string, field: "pages" | "links"): Card {
    const c = DocumentReader.record(raw, where);
    const stored = field === "pages" && c.pages === undefined && Array.isArray(c.tabs) ? c.tabs : c[field];
    if (!Array.isArray(stored)) {
      throw new Error(`${where}.${field} is not an array`);
    }
    const items: unknown[] = stored;
    return {
      id: DocumentReader.text(c.id, `${where}.id`),
      name: DocumentReader.text(c.name, `${where}.name`),
      createdAt: DocumentReader.text(c.createdAt, `${where}.createdAt`),
      hue: DocumentReader.hue(c.hue, place, where, field),
      links: items.map((l, k) => DocumentReader.link(l, `${where}.${field}[${String(k)}]`)),
    };
  }

  /**
   * A card's hue. A schema-1 card without one gets the hue of its place.
   * @param raw the stored value
   * @param place the card's place in its list, from 0
   * @param where the card's path for the error
   * @param field "pages" for schema 1, "links" for schema 2
   * @returns the hue
   * @throws Error "<where>.hue is not an integer in 0..15"
   */
  private static hue(raw: unknown, place: number, where: string, field: "pages" | "links"): number {
    if (raw === undefined && field === "pages") {
      return place % HUE_COUNT;
    }
    const valid = typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < HUE_COUNT;
    if (!valid) {
      throw new Error(`${where}.hue is not an integer in 0..${String(HUE_COUNT - 1)}`);
    }
    return raw;
  }

  /**
   * A collection's hue. A collection from Tabuzaur 0.9.0 has none and gets the hue of its place.
   * @param raw the stored value
   * @param place its place in the document, from 0
   * @param where its path for the error
   * @returns the hue
   * @throws Error "<where>.hue is not an integer in 0..15"
   */
  private static tabHue(raw: unknown, place: number, where: string): number {
    if (raw === undefined) {
      return Palette.tabAt(place);
    }
    return DocumentReader.hue(raw, place, where, "links");
  }

  /**
   * A link.
   * @param raw the stored value
   * @param where its path for the error
   * @returns the link
   * @throws Error naming the field
   */
  private static link(raw: unknown, where: string): Link {
    const l = DocumentReader.record(raw, where);
    const link: Link = { title: DocumentReader.text(l.title, `${where}.title`), url: DocumentReader.text(l.url, `${where}.url`) };
    if (l.favIconUrl === undefined) {
      return link;
    }
    return { ...link, favIconUrl: DocumentReader.text(l.favIconUrl, `${where}.favIconUrl`) };
  }

  /**
   * An object.
   * @param raw the stored value
   * @param where its path for the error
   * @returns its fields
   * @throws Error "<where> is not an object"
   */
  private static record(raw: unknown, where: string): Record<string, unknown> {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new Error(`${where} is not an object`);
    }
    return raw as Record<string, unknown>;
  }

  /**
   * A string.
   * @param raw the stored value
   * @param where its path for the error
   * @returns the string
   * @throws Error "<where> is not a string"
   */
  private static text(raw: unknown, where: string): string {
    if (typeof raw !== "string") {
      throw new Error(`${where} is not a string`);
    }
    return raw;
  }
}
