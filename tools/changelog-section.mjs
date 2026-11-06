// Prints the section of one version from CHANGELOG.md: the lines under "## <version>" up to the next
// "## ". CI puts it at the top of the release text. Fails when the section is missing or empty, so a
// release without a description of what changed cannot be published.
// Usage: node tools/changelog-section.mjs <version>
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The sections of the changelog. */
class Changelog {
  /**
   * The body of a version's section, without its heading and the blank lines around it, one line
   * per bullet.
   * @param {string} text the changelog
   * @param {string} version for example "0.9.3"
   * @returns {string} the section body
   * @throws {Error} when the changelog has no section for the version, or the section is empty
   */
  static section(text, version) {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} `));
    if (start < 0) {
      throw new Error(`CHANGELOG.md has no section "## ${version}"`);
    }
    const rest = lines.slice(start + 1);
    const next = rest.findIndex((line) => line.startsWith("## "));
    const section = next < 0 ? rest : rest.slice(0, next);
    // GitHub shows a line break in a release text as a break: one line per bullet
    const body = section.join("\n").trim().replace(/\n {2,}/g, " ");
    if (body === "") {
      throw new Error(`the section "## ${version}" in CHANGELOG.md is empty`);
    }
    return body;
  }
}

const version = process.argv[2];
if (version === undefined || version === "") {
  throw new Error("usage: node tools/changelog-section.mjs <version>");
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const text = readFileSync(join(root, "CHANGELOG.md"), "utf8");
console.log(Changelog.section(text, version));
