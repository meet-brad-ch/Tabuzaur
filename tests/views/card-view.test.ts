// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionBook } from "../../src/lib/collections.ts";
import type { Collection } from "../../src/lib/model.ts";
import { CardView } from "../../src/tabs/card-view.ts";
import { DragKinds } from "../../src/tabs/drag.ts";
import { PageState } from "../../src/tabs/page-state.ts";
import { CountingIdSource, FixedClock, pageA, pageB } from "../fakes.ts";
import { RecordingActions } from "./recording-actions.ts";

const clock = new FixedClock("2026-10-29T10:00:00.000Z");

/** A page state with two cards: "Work" with two links, "Empty" without links. */
function seeded(): PageState {
  const state = new PageState("chrome-extension://abc/tabs.html");
  state.book = CollectionBook.empty()
    .create("Work", clock, new CountingIdSource())
    .addPage("id-1", pageA)
    .addPage("id-1", pageB);
  state.book = state.book.create("Empty", clock, { next: () => "id-2" });
  return state;
}

function card(state: PageState, id: string): Collection {
  return state.book.get(id);
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
}

/** happy-dom ignores the dataTransfer of a DragEvent's init, so the event gets it as a property. */
function drop(target: Element, type: string, data: string): void {
  const transfer = new DataTransfer();
  transfer.setData(type, data);
  const event = new DragEvent("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
}

describe("CardView", () => {
  let state: PageState;
  let actions: RecordingActions;
  let view: CardView;

  beforeEach(() => {
    state = seeded();
    actions = new RecordingActions();
    view = new CardView(state, actions);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the band with the name, pen and trash, in its hue, and a row per link", () => {
    const section = view.build(card(state, "id-1"), 3);
    expect(section.className).toBe("card hue-3");
    expect(section.querySelector("header .name")?.textContent).toBe("Work");
    expect(section.querySelector("header button.edit")?.getAttribute("aria-label")).toBe("Rename this collection");
    expect(section.querySelector("header button.trash")).not.toBeNull();
    const rows = [...section.querySelectorAll("li.page")];
    expect(rows.map((r) => r.querySelector("a")?.textContent)).toEqual(["Example", "Docs"]);
    expect(rows.map((r) => r.querySelector(".host")?.textContent)).toEqual(["example.com", "docs.example.com"]);
  });

  it("shows the drop hint in a card without links", () => {
    const section = view.build(card(state, "id-2"), 0);
    expect(section.querySelector(".empty-hint span")?.textContent).toBe("Drop tabs here");
    expect(section.querySelector("ul")).toBeNull();
  });

  it("marks search hits and the link that was just dropped", () => {
    state.query = "docs";
    state.justAdded = { cardId: "id-1", url: pageA.url };
    const rows = [...view.build(card(state, "id-1"), 0).querySelectorAll("li.page")];
    expect(rows.map((r) => r.className)).toEqual(["page new", "page hit"]);
    expect(rows[1]?.querySelector("mark")?.textContent).toBe("Docs");
  });

  it("asks to rename on the pen, and saves on Enter or cancels on Escape in the editor", () => {
    view.build(card(state, "id-1"), 0).querySelector<HTMLButtonElement>("header button.edit")?.click();
    expect(actions.last()).toEqual({ name: "startRename", args: ["id-1"] });
    state.renaming = "id-1";
    const editing = view.build(card(state, "id-1"), 0);
    expect(editing.querySelector("header")?.draggable).toBe(false);
    const input = editing.querySelector<HTMLInputElement>("header input.name");
    if (input === null) {
      throw new Error("no name field");
    }
    input.value = "Office";
    key(input, "Enter");
    expect(actions.last()).toEqual({ name: "renameCard", args: ["id-1", "Office"] });
    key(input, "Escape");
    expect(actions.last()).toEqual({ name: "cancelRename", args: [] });
  });

  it("deletes only after the question is confirmed", () => {
    const confirm = vi.fn<(question: string) => boolean>();
    vi.stubGlobal("confirm", confirm);
    confirm.mockReturnValueOnce(false);
    const trash = view.build(card(state, "id-1"), 0).querySelector<HTMLButtonElement>("header button.trash");
    trash?.click();
    expect(confirm).toHaveBeenCalledWith('Delete the collection "Work" with 2 links?');
    expect(actions.calls).toEqual([]);
    confirm.mockReturnValueOnce(true);
    trash?.click();
    expect(actions.last()).toEqual({ name: "deleteCard", args: ["id-1"] });
  });

  it("follows the link on a row click but not on its buttons", () => {
    const row = view.build(card(state, "id-1"), 0).querySelector<HTMLElement>("li.page");
    row?.click();
    expect(actions.last()).toEqual({ name: "openLink", args: [pageA.url] });
    row?.querySelector<HTMLButtonElement>("button.remove")?.click();
    expect(actions.names()).toEqual(["openLink", "removeLink"]);
    expect(actions.last().args).toEqual([{ cardId: "id-1", index: 0 }]);
  });

  it("edits a link in place: Enter saves the title and the address", () => {
    state.editingLink = { cardId: "id-1", index: 1 };
    const row = view.build(card(state, "id-1"), 0).querySelectorAll("li.page")[1];
    const title = row?.querySelector<HTMLInputElement>("input.title");
    const url = row?.querySelector<HTMLInputElement>("input.url");
    if (title == null || url == null) {
      throw new Error("no editor");
    }
    expect([title.value, url.value]).toEqual(["Docs", pageB.url]);
    title.value = "Reference";
    key(url, "Enter");
    expect(actions.last()).toEqual({ name: "editLink", args: [{ cardId: "id-1", index: 1 }, "Reference", pageB.url] });
  });

  it("takes a dropped card before itself and a dropped link at its end", () => {
    const section = view.build(card(state, "id-2"), 0);
    drop(section, DragKinds.CARD, "id-1");
    expect(actions.last()).toEqual({ name: "reorderCard", args: ["id-1", 1] });
    const drag = { page: pageA };
    drop(section, DragKinds.LINK, JSON.stringify(drag));
    expect(actions.last()).toEqual({ name: "dropLink", args: ["id-2", drag, undefined] });
  });

  it("takes a link dropped on a row before that row", () => {
    const row = view.build(card(state, "id-1"), 0).querySelectorAll("li.page")[1];
    if (row === undefined) {
      throw new Error("no second row");
    }
    const drag = { page: { title: "New", url: "https://new.example/" } };
    drop(row, DragKinds.LINK, JSON.stringify(drag));
    expect(actions.names()).toEqual(["dropLink"]);
    expect(actions.last().args).toEqual(["id-1", drag, 1]);
  });
});
