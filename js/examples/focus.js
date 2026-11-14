// Example policy: focused targets remain active; input counts as editing for 1.5 seconds.
export function connectFocus(changed) {
  let paused = false;
  let disposed = false;
  let editing = null;
  let timer;
  let last = "";
  const target = () =>
    !paused && !document.hidden && document.hasFocus()
      ? (document.activeElement?.closest("[data-collab-target]")?.dataset
          .collabTarget ?? null)
      : null;
  const publish = () => {
    if (disposed) return;
    const id = target();
    if (editing !== id) {
      editing = null;
      clearTimeout(timer);
    }
    const value = id ? { target: id, editing: editing === id } : null;
    const element = document.activeElement;
    if (value && element instanceof HTMLTextAreaElement) {
      const backward = element.selectionDirection === "backward";
      value.selection = {
        text: element.value,
        anchor: backward ? element.selectionEnd : element.selectionStart,
        head: backward ? element.selectionStart : element.selectionEnd,
      };
    }
    const encoded = JSON.stringify(value);
    if (encoded !== last) {
      last = encoded;
      changed(value);
    }
  };
  const focus = () => queueMicrotask(publish);
  const input = (event) => {
    if (event.target !== document.activeElement) return;
    editing = target();
    clearTimeout(timer);
    timer = setTimeout(() => {
      editing = null;
      publish();
    }, 1500);
    publish();
  };
  const hide = () => {
    paused = true;
    publish();
  };
  const show = () => {
    paused = false;
    publish();
  };
  const events = [
    [document, "focusin", focus],
    [document, "focusout", focus],
    [document, "selectionchange", focus],
    [document, "select", focus],
    [document, "input", input],
    [document, "visibilitychange", publish],
    [window, "blur", hide],
    [window, "focus", show],
    [window, "pagehide", hide],
    [window, "pageshow", show],
  ];
  events.forEach(([owner, name, listener]) =>
    owner.addEventListener(name, listener),
  );
  publish();
  return () => {
    if (disposed) return;
    paused = true;
    publish();
    disposed = true;
    clearTimeout(timer);
    events.forEach(([owner, name, listener]) =>
      owner.removeEventListener(name, listener),
    );
  };
}
