import { describe, expect, it } from "vitest";
import { BackupFile } from "../src/lib/backup.ts";
import { CollectionBook } from "../src/lib/collections.ts";
import { CountingIdSource, FixedClock, pageA, pageB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");
const book = CollectionBook.empty().create("Work", clock, new CountingIdSource()).addPage("id-1", pageA).addPage("id-1", pageB);

describe("backup", () => {
  it("round-trips the document and stamps the file", () => {
    const text = BackupFile.serialize(book.toData(), new Date("2026-10-12T11:30:00.000Z"));
    expect(text).toContain('"app": "tabuzaur"');
    expect(text).toContain('"exportedAt": "2026-10-12T11:30:00.000Z"');
    expect(text.endsWith("\n")).toBe(true);
    expect(BackupFile.parse(text)).toEqual(book.toData());
  });

  it("parses an empty document", () => {
    expect(BackupFile.parse(BackupFile.serialize(CollectionBook.empty().toData(), new Date()))).toEqual({ schemaVersion: 1, collections: [] });
  });

  it("rejects text that is not JSON or not the schema", () => {
    expect(() => BackupFile.parse("{nope")).toThrow("the file is not JSON");
    expect(() => BackupFile.parse('{"app":"tabuzaur","schemaVersion":1}')).toThrow("store.collections is not an array");
    expect(() => BackupFile.parse('{"schemaVersion":3,"collections":[]}')).toThrow("unsupported schemaVersion 3");
  });

  it("names the file by the local date", () => {
    expect(BackupFile.fileName(new Date(2026, 9, 12, 23, 59))).toBe("tabuzaur-backup-2026-10-12.json");
    expect(BackupFile.fileName(new Date(2026, 0, 3))).toBe("tabuzaur-backup-2026-01-03.json");
  });
});
