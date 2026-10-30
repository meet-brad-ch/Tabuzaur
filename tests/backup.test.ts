import { describe, expect, it } from "vitest";
import { BackupFile } from "../src/lib/backup.ts";
import { Library } from "../src/lib/library.ts";
import { CountingIdSource, FixedClock, pageA, pageB } from "./fakes.ts";

const clock = new FixedClock("2026-10-12T10:00:00.000Z");
const library = Library.empty()
  .createCard("main", "Work", clock, new CountingIdSource())
  .addLink("id-1", pageA, undefined)
  .addLink("id-1", pageB, undefined);

describe("BackupFile", () => {
  it("round-trips the library and stamps the file", () => {
    const text = BackupFile.serialize(library.toData(), new Date("2026-10-12T11:30:00.000Z"));
    expect(text).toContain('"app": "tabuzaur"');
    expect(text).toContain('"exportedAt": "2026-10-12T11:30:00.000Z"');
    expect(text).toContain('"schemaVersion": 2');
    expect(text.endsWith("\n")).toBe(true);
    expect(BackupFile.parse(text)).toEqual({ kind: "library", data: library.toData() });
  });

  it("reads a file of 0.8 and earlier as cards only", () => {
    const text = '{"app":"tabuzaur","schemaVersion":1,"collections":[{"id":"a","name":"A","createdAt":"x","hue":3,"pages":[]}]}';
    expect(BackupFile.parse(text)).toEqual({ kind: "cards", cards: [{ id: "a", name: "A", createdAt: "x", hue: 3, links: [] }] });
  });

  it("rejects text that is not JSON or not the schema", () => {
    expect(() => BackupFile.parse("{nope")).toThrow("the file is not JSON");
    expect(() => BackupFile.parse('{"app":"tabuzaur","schemaVersion":2}')).toThrow("store.collections is not an array");
    expect(() => BackupFile.parse('{"schemaVersion":3,"collections":[]}')).toThrow("unsupported schemaVersion 3");
  });

  it("names the file by the local date", () => {
    expect(BackupFile.fileName(new Date(2026, 9, 12, 23, 59))).toBe("tabuzaur-backup-2026-10-12.json");
    expect(BackupFile.fileName(new Date(2026, 0, 3))).toBe("tabuzaur-backup-2026-01-03.json");
  });
});
