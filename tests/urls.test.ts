import { describe, expect, it } from "vitest";
import { hostnameOf, hueOf, initialOf } from "../src/lib/urls.ts";

describe("hostnameOf", () => {
  it("drops www. and everything but the host", () => {
    expect(hostnameOf("https://www.example.com/a/b?c=1#d")).toBe("example.com");
    expect(hostnameOf("http://docs.example.co.uk:8080/")).toBe("docs.example.co.uk");
  });

  it("falls back to the scheme when there is no host", () => {
    expect(hostnameOf("file:///C:/notes/x.html")).toBe("file");
    expect(hostnameOf("about:blank")).toBe("about");
  });

  it("keeps the host of a chrome:// page", () => {
    expect(hostnameOf("chrome://extensions/")).toBe("extensions");
  });

  it("fails on an unparsable URL", () => {
    expect(() => hostnameOf("not a url")).toThrow();
  });
});

describe("initialOf", () => {
  it("is the upper-cased first character of the host", () => {
    expect(initialOf("https://www.example.com/")).toBe("E");
    expect(initialOf("file:///x")).toBe("F");
  });
});

describe("hueOf", () => {
  it("is deterministic and within [0, 360)", () => {
    expect(hueOf("example.com")).toBe(hueOf("example.com"));
    for (const text of ["", "a", "example.com", "docs.example.co.uk"]) {
      expect(hueOf(text)).toBeGreaterThanOrEqual(0);
      expect(hueOf(text)).toBeLessThan(360);
    }
  });

  it("differs for different hosts", () => {
    expect(hueOf("example.com")).not.toBe(hueOf("example.org"));
  });
});
