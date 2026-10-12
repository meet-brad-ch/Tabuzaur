import type { StoreData } from "./model.ts";
import { parseStoreData } from "./storage.ts";

/**
 * A backup file is the stored document with a stamp; reading it uses the same parser as storage.
 * The file text: the document plus `app` and `exportedAt`, pretty-printed for readable diffs.
 */
export function serializeBackup(data: StoreData, exportedAt: Date): string {
  return JSON.stringify({ app: "tabuzaur", exportedAt: exportedAt.toISOString(), ...data }, null, 2) + "\n";
}

/** The document in a backup file. Anything that is not valid JSON or not the schema is an error. */
export function parseBackup(text: string): StoreData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("the file is not JSON");
  }
  return parseStoreData(raw);
}

/** tabuzaur-backup-YYYY-MM-DD.json, from the local date. */
export function backupFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `tabuzaur-backup-${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
