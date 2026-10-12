/** One saved tab. */
export interface SavedTab {
  readonly title: string;
  readonly url: string;
  readonly favIconUrl?: string;
}

/** A named set of saved tabs. */
export interface Collection {
  readonly id: string;
  readonly name: string;
  /** ISO 8601 timestamp. */
  readonly createdAt: string;
  readonly tabs: readonly SavedTab[];
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
