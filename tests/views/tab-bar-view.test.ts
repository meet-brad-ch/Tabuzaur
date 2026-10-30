// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { Library } from "../../src/lib/library.ts";
import type { Card } from "../../src/lib/model.ts";
import { DragKinds } from "../../src/tabs/drag.ts";
import { PageState } from "../../src/tabs/page-state.ts";
import { TabBarView } from "../../src/tabs/tab-bar-view.ts";
import { pageA, pageB } from "../fakes.ts";
import { DragEvents } from "./drag-events.ts";
import { RecordingActions } from "./recording-actions.ts";

function card(id: string, name: string, links: Card["links"]): Card {
  return { id, name, createdAt: "x", hue: 0, links };
}

/** Main: Work, Reading; Later: Trip; Empty: none. Later is open. */
function seeded(): PageState {
  const state = new PageState("chrome-extension://abc/tabs.html");
  state.library = Library.fromData({ schemaVersion: 2, collections: [
    { id: "main", name: "Main", hue: 0, cards: [card("w", "Work", [pageA]), card("r", "Reading", [pageB])] },
    { id: "later", name: "Later", hue: 0, cards: [card("t", "Trip", [pageB])] },
    { id: "empty", name: "Empty", hue: 0, cards: [] },
  ] });
  state.settings = { ...state.settings, openCollectionId: "later" };
  return state;
}

function tabs(bar: HTMLElement): HTMLElement[] {
  return [...bar.querySelectorAll<HTMLElement>("li.ctab")];
}

function tab(bar: HTMLElement, index: number): HTMLElement {
  const found = tabs(bar)[index];
  if (found === undefined) {
    throw new Error(`no tab ${String(index)}`);
  }
  return found;
}

describe("TabBarView", () => {
  let state: PageState;
  let actions: RecordingActions;
  let view: TabBarView;

  beforeEach(() => {
    state = seeded();
    actions = new RecordingActions();
    view = new TabBarView(state, actions);
  });

  it("shows one tab per collection, the open one selected with a pen and a trash, and a +", () => {
    const bar = view.build();
    expect(bar.getAttribute("aria-label")).toBe("Collections");
    expect(tabs(bar).map((t) => t.querySelector(".name")?.textContent)).toEqual(["Main", "Later", "Empty"]);
    expect(tabs(bar).map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(tabs(bar).map((t) => t.querySelectorAll("button").length)).toEqual([0, 2, 0]);
    expect(tabs(bar).map((t) => t.classList.contains("hue-0"))).toEqual([true, true, true]);
    expect(bar.querySelector("li.add button")?.getAttribute("aria-label")).toBe("New collection");
  });

  it("opens a collection on a click or Enter, and renames on a double click", () => {
    const bar = view.build();
    tab(bar, 0).click();
    DragEvents.key(tab(bar, 2), "Enter");
    tab(bar, 0).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(actions.calls).toEqual([
      { name: "openCollection", args: ["main"] },
      { name: "openCollection", args: ["empty"] },
      { name: "startRenameCollection", args: ["main"] },
    ]);
  });

  it("shows the count of matching cards on every tab while a search is typed", () => {
    state.query = "docs";
    const counts = tabs(view.build()).map((t) => [t.querySelector(".count")?.textContent, t.querySelector(".count")?.className]);
    expect(counts).toEqual([["1", "count"], ["1", "count"], ["0", "count zero"]]);
    state.query = "";
    expect(view.build().querySelector(".count")).toBeNull();
  });

  it("keeps the trash of a collection with cards disabled, says why, and explains on a click", () => {
    const trash = tab(view.build(), 1).querySelector<HTMLButtonElement>("button.trash");
    expect(trash?.getAttribute("aria-disabled")).toBe("true");
    expect(trash?.title).toBe("Move or delete its cards first");
    trash?.click();
    expect(actions.calls).toEqual([{ name: "explain", args: ["Later: Move or delete its cards first."] }]);
  });

  it("deletes an empty collection with its trash", () => {
    state.settings = { ...state.settings, openCollectionId: "empty" };
    tab(view.build(), 2).querySelector<HTMLButtonElement>("button.trash")?.click();
    expect(actions.calls).toEqual([{ name: "deleteCollection", args: ["empty"] }]);
  });

  it("renames in place: Enter saves, Escape cancels", () => {
    state.renamingCollection = "later";
    const input = tab(view.build(), 1).querySelector<HTMLInputElement>("input.name");
    if (input === null) {
      throw new Error("no name field");
    }
    expect(input.value).toBe("Later");
    input.value = "Someday";
    DragEvents.key(input, "Enter");
    DragEvents.key(input, "Escape");
    expect(actions.calls).toEqual([
      { name: "renameCollection", args: ["later", "Someday"] },
      { name: "cancelRenameCollection", args: [] },
    ]);
  });

  it("creates a collection from the + field, and a blank name only closes the field", () => {
    view.build().querySelector<HTMLButtonElement>("li.add button")?.click();
    state.addingCollection = true;
    const input = view.build().querySelector<HTMLInputElement>("li.add input");
    if (input === null) {
      throw new Error("no new collection field");
    }
    input.value = "  ";
    DragEvents.key(input, "Enter");
    input.value = "Trip";
    DragEvents.key(input, "Enter");
    expect(actions.names()).toEqual(["startNewCollection", "cancelNewCollection", "createCollection"]);
    expect(actions.last().args).toEqual(["Trip"]);
  });

  it("takes a card into its collection and a tab before itself, and refuses a link", () => {
    const bar = view.build();
    DragEvents.fire(tab(bar, 0), "drop", DragKinds.CARD, "t");
    DragEvents.fire(tab(bar, 2), "drop", DragKinds.COLLECTION, "main");
    const linkOver = DragEvents.fire(tab(bar, 0), "dragover", DragKinds.LINK, "{}");
    expect(linkOver.defaultPrevented).toBe(false);
    const cardOver = DragEvents.fire(tab(bar, 0), "dragover", DragKinds.CARD, "t");
    expect(cardOver.defaultPrevented).toBe(true);
    expect(tab(bar, 0).classList.contains("over")).toBe(true);
    expect(actions.calls).toEqual([
      { name: "moveCard", args: ["t", "main"] },
      { name: "reorderCollection", args: ["main", 2] },
    ]);
  });
});
