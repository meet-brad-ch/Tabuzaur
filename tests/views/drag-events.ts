/** Drag and key events for view tests. happy-dom ignores the dataTransfer of a DragEvent's init, so the event gets it as a property. */
export class DragEvents {
  /** Dispatches a drag event of one type carrying one data item; returns the event. */
  static fire(target: Element, name: "dragover" | "drop", type: string, data: string): DragEvent {
    const transfer = new DataTransfer();
    transfer.setData(type, data);
    const event = new DragEvent(name, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
    target.dispatchEvent(event);
    return event;
  }

  /** Dispatches a key press. */
  static key(target: Element, name: string): void {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
  }
}
