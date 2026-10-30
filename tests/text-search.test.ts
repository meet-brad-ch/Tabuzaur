import { describe, expect, it } from "vitest";
import { TextSearch } from "../src/lib/text-search.ts";

describe("TextSearch.firstMatch", () => {
  it("splits the text around the first case-insensitive hit, keeping the original case", () => {
    expect(TextSearch.firstMatch("Hello Docs world", "docs")).toEqual({ before: "Hello ", match: "Docs", after: " world" });
    expect(TextSearch.firstMatch("abcabc", "ABC")).toEqual({ before: "", match: "abc", after: "abc" });
  });

  it("returns undefined for a blank query or no hit", () => {
    expect(TextSearch.firstMatch("Hello", "  ")).toBeUndefined();
    expect(TextSearch.firstMatch("Hello", "x")).toBeUndefined();
  });
});

describe("TextSearch.contains", () => {
  it("is true for a case-insensitive hit and false for a blank query or no hit", () => {
    expect(TextSearch.contains("Hello Docs", "DOCS")).toBe(true);
    expect(TextSearch.contains("Hello", " ")).toBe(false);
    expect(TextSearch.contains("Hello", "x")).toBe(false);
  });
});
