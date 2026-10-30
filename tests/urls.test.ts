import { describe, expect, it } from "vitest";
import { UrlText } from "../src/lib/urls.ts";

describe("UrlText.hostname", () => {
  it("drops www. and everything but the host", () => {
    expect(UrlText.hostname("https://www.example.com/a/b?c=1#d")).toBe("example.com");
    expect(UrlText.hostname("http://docs.example.co.uk:8080/")).toBe("docs.example.co.uk");
  });

  it("falls back to the scheme when there is no host", () => {
    expect(UrlText.hostname("file:///C:/notes/x.html")).toBe("file");
    expect(UrlText.hostname("about:blank")).toBe("about");
  });

  it("keeps the host of a chrome:// page", () => {
    expect(UrlText.hostname("chrome://extensions/")).toBe("extensions");
  });

  it("fails on an unparsable URL", () => {
    expect(() => UrlText.hostname("not a url")).toThrow();
  });
});

describe("UrlText.initial", () => {
  it("is the upper-cased first character of the host", () => {
    expect(UrlText.initial("https://www.example.com/")).toBe("E");
    expect(UrlText.initial("file:///x")).toBe("F");
  });
});

describe("UrlText.hue", () => {
  it("is deterministic and within [0, 360)", () => {
    expect(UrlText.hue("example.com")).toBe(UrlText.hue("example.com"));
    for (const text of ["", "a", "example.com", "docs.example.co.uk"]) {
      expect(UrlText.hue(text)).toBeGreaterThanOrEqual(0);
      expect(UrlText.hue(text)).toBeLessThan(360);
    }
  });

  it("differs for different hosts", () => {
    expect(UrlText.hue("example.com")).not.toBe(UrlText.hue("example.org"));
  });
});
