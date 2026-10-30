// Drives the built page in headless Chrome through the render harness and checks what the unit
// tests on happy-dom cannot: real drag events, focus, the fake storage after each action, and the
// upgrade of a 0.8 document. Run after `npm run build`: `npm run check:page`. Needs Chrome (CHROME
// env or a default install path) and Node 22 or later (WebSocket). Prints one line per check and
// exits with 1 when any check fails.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(resolve(here, "..", ".."), "dist");
const PORT = 9335;

/** The Chrome DevTools session on one page of the harness. */
class Session {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.onmessage = (message) => {
      const reply = JSON.parse(message.data);
      const waiting = this.pending.get(reply.id);
      if (waiting === undefined) {
        return;
      }
      this.pending.delete(reply.id);
      if (reply.error) {
        waiting.reject(new Error(reply.error.message));
        return;
      }
      waiting.resolve(reply.result);
    };
  }

  /** Sends a DevTools command and waits for its result. */
  send(method, params = {}) {
    this.nextId += 1;
    const id = this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /** The value of an expression in the page; a thrown error fails the run. */
  async value(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(`the page threw: ${JSON.stringify(result.exceptionDetails).slice(0, 400)}`);
    }
    return result.result.value;
  }

  /** Opens a harness state and waits until the tab bar is there. A blank page first: a change of the hash alone does not reload. */
  async open(url) {
    await this.send("Page.navigate", { url: "about:blank" });
    await Check.sleep(150);
    await this.send("Page.navigate", { url });
    for (let i = 0; i < 40; i++) {
      await Check.sleep(150);
      if (await this.value(`document.querySelector("li.ctab") !== null`)) {
        return;
      }
    }
    throw new Error(`the page did not render: ${url}`);
  }
}

/** The checks, one line each. */
class Check {
  static failed = 0;

  static sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  static equal(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
      Check.failed += 1;
    }
    const tail = ok ? "" : ` expected ${JSON.stringify(expected)}`;
    console.log(`${ok ? "ok    " : "FAILED"} ${label}: ${JSON.stringify(actual)}${tail}`);
  }

  static chromePath() {
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
}

const tabNames = `[...document.querySelectorAll("li.ctab")].map((t) => t.querySelector(".name")?.textContent ?? t.querySelector("input")?.value)`;
const openTab = `document.querySelector("li.ctab.open .name")?.textContent`;
const cardNames = `[...document.querySelectorAll("main .card header .name")].map((n) => n.textContent)`;

/** A 0.8 document becomes one collection Main; the old document is kept aside. */
async function upgrade(page, harness) {
  await page.open(`${harness}#v1`);
  Check.equal("an old document opens as one collection", await page.value(tabNames), ["Main"]);
  Check.equal("with all its cards", await page.value(cardNames), ["Work", "Reading", "Trip to Lisbon", "Home"]);
  Check.equal("the old document is kept aside", await page.value(`store["tabuzaur-backup-v1"].schemaVersion`), 1);
}

/** + creates a collection and opens it; a click opens another; the open one is saved. */
async function createAndOpen(page, harness) {
  await page.open(`${harness}#page`);
  Check.equal("two collections in the harness", await page.value(tabNames), ["Main", "Later"]);
  await page.value(`document.querySelector("li.add button").click()`);
  await Check.sleep(200);
  Check.equal("+ opens a focused name field", await page.value(`document.activeElement === document.querySelector("li.add input")`), true);
  await page.value(`(() => { const i = document.querySelector("li.add input"); i.value = "Trip"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); })()`);
  await Check.sleep(400);
  Check.equal("Enter creates the collection and opens it", [await page.value(tabNames), await page.value(openTab)], [["Main", "Later", "Trip"], "Trip"]);
  Check.equal("the open collection is saved", await page.value(`store["tabuzaur-settings"].openCollectionId === store.tabuzaur.collections[2].id`), true);
  await page.value(`document.querySelector("li.ctab").click()`);
  await Check.sleep(300);
  Check.equal("a click opens Main again", await page.value(openTab), "Main");
}

/** A card dragged by its band onto a tab moves there; the tab lifts and flashes. */
async function cardOntoTab(page) {
  const moved = await page.value(`(() => {
    const band = document.querySelectorAll("main .card header")[2];
    const dt = new DataTransfer();
    band.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    const later = document.querySelectorAll("li.ctab")[1];
    const over = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true });
    later.dispatchEvent(over);
    const lifted = later.classList.contains("over");
    later.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    band.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }));
    return [over.defaultPrevented, lifted];
  })()`);
  await Check.sleep(400);
  Check.equal("a tab takes a card and lifts", moved, [true, true]);
  Check.equal("the card left Main", await page.value(cardNames), ["Work", "Reading", "Home"]);
  Check.equal("the target tab flashes", await page.value(`document.querySelectorAll("li.ctab")[1].classList.contains("flash")`), true);
  Check.equal("the card is in Later", await page.value(`store.tabuzaur.collections[1].cards.map((c) => c.name)`), ["Recipes", "Trip to Lisbon"]);
}

/** The search counts the matching cards on every tab and keeps the focus in its field. */
async function searchCounts(page) {
  await page.value(`(() => { const i = document.querySelector("header.top .search input"); i.focus(); i.value = "lisbon"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await Check.sleep(200);
  Check.equal("the tabs count the matching cards", await page.value(`[...document.querySelectorAll("li.ctab .count")].map((c) => c.textContent)`), ["0", "1", "0"]);
  Check.equal("the search field keeps the focus", await page.value(`document.activeElement === document.querySelector("header.top .search input")`), true);
  await page.value(`(() => { const i = document.querySelector("header.top .search input"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
}

/** A tab dropped on the left half of another goes before it; a full collection cannot be deleted. */
async function reorderAndDelete(page) {
  const line = await page.value(`(() => {
    const tabs = document.querySelectorAll("li.ctab");
    const dt = new DataTransfer();
    tabs[1].dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }));
    const box = tabs[0].getBoundingClientRect();
    const at = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: box.left + 2, clientY: box.top + 5 };
    tabs[0].dispatchEvent(new DragEvent("dragover", at));
    const before = tabs[0].classList.contains("insert-before");
    tabs[0].dispatchEvent(new DragEvent("drop", at));
    return before;
  })()`);
  await Check.sleep(400);
  Check.equal("a tab over the left half shows the line before it", line, true);
  Check.equal("the tabs reorder", await page.value(tabNames), ["Later", "Main", "Trip"]);
  await page.value(`document.querySelectorAll("li.ctab")[1].click()`);
  await Check.sleep(300);
  await page.value(`document.querySelector("li.ctab.open button.trash").click()`);
  await Check.sleep(200);
  Check.equal("a full collection's trash explains", await page.value(`document.querySelector(".notice").textContent`), "Main: Move or delete its cards first.");
  await page.value(`document.querySelectorAll("li.ctab")[2].click()`);
  await Check.sleep(300);
  await page.value(`document.querySelector("li.ctab.open button.trash").click()`);
  await Check.sleep(400);
  Check.equal("an empty collection's trash deletes it", await page.value(tabNames), ["Later", "Main"]);
}

async function main() {
  if (!existsSync(join(dist, "tabs.js"))) {
    throw new Error("dist/tabs.js is missing: run `npm run build` first");
  }
  const work = mkdtempSync(join(tmpdir(), "tabuzaur-check-"));
  cpSync(dist, join(work, "dist"), { recursive: true });
  cpSync(join(here, "harness.html"), join(work, "dist", "harness.html"));
  const chrome = spawn(Check.chromePath(), ["--headless=new", "--allow-file-access-from-files", `--remote-debugging-port=${String(PORT)}`,
    `--user-data-dir=${join(work, "profile")}`, "--window-size=1280,895", "--no-first-run", "about:blank"], { stdio: "ignore" });
  try {
    let ready = false;
    for (let i = 0; i < 50 && !ready; i++) {
      ready = await fetch(`http://127.0.0.1:${String(PORT)}/json/version`).then(() => true, () => false);
      if (!ready) {
        await Check.sleep(200);
      }
    }
    const target = await (await fetch(`http://127.0.0.1:${String(PORT)}/json/new?about:blank`, { method: "PUT" })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => { socket.onopen = r; });
    const page = new Session(socket);
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    const harness = pathToFileURL(join(work, "dist", "harness.html")).href;
    await upgrade(page, harness);
    await createAndOpen(page, harness);
    await cardOntoTab(page);
    await searchCounts(page);
    await reorderAndDelete(page);
    socket.close();
  } finally {
    chrome.kill();
    await Check.sleep(600);
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
  console.log(Check.failed === 0 ? "all checks passed" : `${String(Check.failed)} checks FAILED`);
  process.exitCode = Check.failed === 0 ? 0 : 1;
}

await main();
