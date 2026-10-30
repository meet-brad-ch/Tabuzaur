/** A saved page. */
export interface Link {
  readonly title: string;
  readonly url: string;
  /** The favicon address Chrome reported for the page, if any. */
  readonly favIconUrl?: string;
}

/** A colored box of links, in the order they were added or arranged. May be empty. */
export interface Card {
  readonly id: string;
  readonly name: string;
  /** ISO 8601 timestamp. */
  readonly createdAt: string;
  /** Index into the stylesheet's palette, 0 .. HUE_COUNT - 1. */
  readonly hue: number;
  readonly links: readonly Link[];
}

/** A tab of the page: a named group of cards. */
export interface Collection {
  readonly id: string;
  readonly name: string;
  /** The color of its tab: an index into the stylesheet's palette, 0 .. HUE_COUNT - 1. */
  readonly hue: number;
  readonly cards: readonly Card[];
}

/** The stored and exported document. */
export interface LibraryData {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly collections: readonly Collection[];
}

/** The number of card colors in the stylesheet's palette. */
export const HUE_COUNT = 16;

/** Schema 2: collections of cards. Schema 1 (up to 0.8) held cards only and is read as one collection. */
export const SCHEMA_VERSION = 2;

/** The key of the document in chrome.storage.local. */
export const STORAGE_KEY = "tabuzaur";

/** The collection an empty library starts with, and the one a schema-1 document becomes. */
export const MAIN_COLLECTION: Collection = { id: "main", name: "Main", hue: 0, cards: [] };

/** A source of the current time; injected so tests are deterministic. */
export interface Clock {
  now(): Date;
}

/** A source of unique card and collection ids; injected so tests are deterministic. */
export interface IdSource {
  next(): string;
}

/** The clock of the computer. */
export class SystemClock implements Clock {
  /**
   * The current time.
   * @returns now
   */
  now(): Date {
    return new Date();
  }
}

/** Random UUIDs from the browser's crypto API. */
export class RandomIdSource implements IdSource {
  /**
   * A new id.
   * @returns a random UUID
   */
  next(): string {
    return crypto.randomUUID();
  }
}
