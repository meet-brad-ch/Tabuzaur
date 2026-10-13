// Renders the Tabuzaur page headless in a set of states and writes the pictures the help page
// and the README use. Run after `npm run build`: `npm run shots`. Needs Chrome (CHROME env or a
// default install path) and Python with Pillow for the GIF. Every failure is an error: no
// picture is silently skipped.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const dist = join(root, "dist");
const out = join(root, "public", "help", "img");

/** Window size; the new headless mode reserves about 95 px of it for window chrome. */
const WINDOW = "1280,895";

/** state → file name; the demo frames feed the GIF and are not kept as PNGs. */
const STATES = [
  ["page", "page.png"],
  ["flyout", "flyout.png"],
  ["pinned", "pinned.png"],
  ["dark", "dark.png"],
  ["search", "search.png"],
  ["edit", "edit.png"],
  ["drop", "drop.png"],
  ["dialog", "dialog.png"],
  ["empty", "empty.png"],
  ["demo1", "demo-1.png"],
  ["demo2", "demo-2.png"],
  ["demo3", "demo-3.png"],
];
const DEMO_FRAMES = ["demo-1.png", "demo-2.png", "demo-3.png"];

function chromePath() {
  const candidates = [
    process.env.CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((p) => p !== undefined && p !== "");
  const found = candidates.find((p) => existsSync(p));
  if (found === undefined) {
    throw new Error(`Chrome not found; set CHROME to its path. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

function main() {
  if (!existsSync(join(dist, "tabs.js"))) {
    throw new Error("dist/tabs.js is missing: run `npm run build` first");
  }
  const chrome = chromePath();
  const work = mkdtempSync(join(tmpdir(), "tabuzaur-render-"));
  try {
    cpSync(dist, join(work, "dist"), { recursive: true });
    cpSync(join(here, "harness.html"), join(work, "dist", "harness.html"));  // next to tabs.js: relative paths as in the real page
    mkdirSync(out, { recursive: true });
    const harness = pathToFileURL(join(work, "dist", "harness.html")).href;
    for (const [state, file] of STATES) {
      const target = join(file.startsWith("demo-") ? work : out, file);
      const result = spawnSync(chrome, [
        "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
        "--allow-file-access-from-files", `--window-size=${WINDOW}`, "--virtual-time-budget=3000",
        `--screenshot=${target}`, "--dump-dom", `${harness}#${state}`,
      ], { encoding: "utf8", timeout: 60000 });
      if (result.status !== 0) {
        throw new Error(`Chrome failed on state ${state}: ${result.stderr}`);
      }
      const title = /<title>([^<]*)<\/title>/.exec(result.stdout)?.[1] ?? "";
      if (!title.startsWith(`state ${state} |`) || !title.endsWith("broken images 0")) {
        throw new Error(`state ${state} did not render as expected: ${title || "(no title)"}`);
      }
      if (!existsSync(target) || statSync(target).size === 0) {
        throw new Error(`no screenshot written for state ${state}`);
      }
      console.log(`${file.padEnd(12)} ${title}`);
    }
    shootHelp(chrome, work);
    const gif = spawnSync("python", ["-I", join(here, "gif.py"), join(out, "demo.gif"), ...DEMO_FRAMES.map((f) => join(work, f))], { encoding: "utf8" });
    if (gif.status !== 0) {
      throw new Error(`gif.py failed: ${gif.stderr}${gif.stdout}`);
    }
    console.log(gif.stdout.trim());
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The help page itself, from the built copy: every picture it names must exist in dist/help/img. */
function shootHelp(chrome, work) {
  const html = readFileSync(join(work, "dist", "help.html"), "utf8");
  const pictures = [...html.matchAll(/src="(help\/img\/[^"]+)"/g)].map((m) => m[1]);
  const missing = pictures.filter((p) => !existsSync(join(work, "dist", p)));
  if (missing.length > 0) {
    throw new Error(`help.html names pictures that do not exist: ${missing.join(", ")}`);
  }
  const target = join(out, "help.png");
  const result = spawnSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    "--allow-file-access-from-files", `--window-size=${WINDOW}`, "--virtual-time-budget=3000",
    `--screenshot=${target}`, pathToFileURL(join(work, "dist", "help.html")).href,
  ], { encoding: "utf8", timeout: 60000 });
  if (result.status !== 0 || !existsSync(target)) {
    throw new Error(`Chrome failed on help.html: ${result.stderr}`);
  }
  console.log(`help.png      ${pictures.length} pictures present`);
}

main();
