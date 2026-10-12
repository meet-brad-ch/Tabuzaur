/** One saved link. */
export interface SavedPage {
  readonly title: string;
  readonly url: string;
  readonly favIconUrl?: string;
}

/** A hand-made folder of saved links, in insertion order. May be empty. */
export interface Collection {
  readonly id: string;
  readonly name: string;
  /** ISO 8601 timestamp. */
  readonly createdAt: string;
  readonly pages: readonly SavedPage[];
}

/** The whole persisted document, as stored under {@link STORAGE_KEY}. */
export interface StoreData {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly collections: readonly Collection[];
}

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = "tabuzaur";

/** A source of the current time; injected so tests are deterministic. */
export interface Clock {
  now(): Date;
}

/** A source of unique collection ids; injected so tests are deterministic. */
export interface IdSource {
  next(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class RandomIdSource implements IdSource {
  next(): string {
    return crypto.randomUUID();
  }
}
