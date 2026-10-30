/** What an inline editor does on its keys. */
export interface EditorHandlers {
  /** Saves the edit. */
  readonly save: () => void;
  /** Leaves the editor without a change. */
  readonly cancel: () => void;
  /** Whether the editor is still open; guards the blur that follows a save or a cancel. */
  readonly stillEditing: () => boolean;
}

/** The keys of the inline editors: Enter saves, Escape cancels, leaving the field saves. */
export class InlineEditor {
  /**
   * Wires one text field.
   * @param input the field
   * @param handlers save, cancel and the open check
   */
  static attach(input: HTMLInputElement, handlers: EditorHandlers): void {
    input.addEventListener("keydown", (event) => {
      InlineEditor.onKey(event, handlers);
    });
    input.addEventListener("blur", () => {
      if (handlers.stillEditing()) {
        handlers.save();
      }
    });
  }

  /**
   * Wires a form of several fields. Two text fields and no submit button never submit on Enter
   * (HTML implicit submission), so both keys are handled here; leaving the form, not moving
   * between its fields, saves.
   * @param form the form
   * @param handlers save, cancel and the open check
   */
  static attachForm(form: HTMLFormElement, handlers: EditorHandlers): void {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
    });
    form.addEventListener("keydown", (event) => {
      InlineEditor.onKey(event, handlers);
    });
    form.addEventListener("focusout", (event) => {
      const stays = form.contains(event.relatedTarget as Node | null);
      if (!stays && handlers.stillEditing()) {
        handlers.save();
      }
    });
  }

  /**
   * Enter saves, Escape cancels; other keys type.
   * @param event the key event
   * @param handlers save and cancel
   */
  private static onKey(event: KeyboardEvent, handlers: EditorHandlers): void {
    if (event.key === "Enter") {
      event.preventDefault();
      handlers.save();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handlers.cancel();
    }
  }
}
