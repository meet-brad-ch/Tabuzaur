import type { StoreData } from "./model.ts";
import { parseStoreData } from "./storage.ts";

/**
 * A backup file is the stored document with a stamp; reading it uses the same parser as storage.
 * The file text is the document plus `app` and `exportedAt`, pretty-printed for readable diffs.
 */
export class BackupFile {
  /**
   * The text of a backup file.
   * @param data the document to save
   * @param exportedAt the moment of the export, written as an ISO 8601 stamp
   * @returns JSON text ending with a newline
   */
  static serialize(data: StoreData, exportedAt: Date): string {
    const file = { app: "tabuzaur", exportedAt: exportedAt.toISOString(), ...data };
    const text = JSON.stringify(file, null, 2);
    return text + "\n";
  }

  /**
   * The document in a backup file.
   * @param text the file text
   * @returns the parsed document
   * @throws Error "the file is not JSON", or the parser's error when it is not the schema
   */
  static parse(text: string): StoreData {
    const raw = BackupFile.json(text);
    return parseStoreData(raw);
  }

  /**
   * The JSON value in the text.
   * @param text the file text
   * @returns the parsed value, not yet checked against the schema
   * @throws Error "the file is not JSON"
   */
  private static json(text: string): unknown {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("the file is not JSON");
    }
  }

  /**
   * The file name, from the local date.
   * @param date the moment of the export
   * @returns tabuzaur-backup-YYYY-MM-DD.json
   */
  static fileName(date: Date): string {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `tabuzaur-backup-${year}-${month}-${day}.json`;
  }
}
