// Opt in static, non-overlapping text blocks with stable data-collab-text IDs.
export function connectPageSelection(root, changed) {
  let enabled = false,
    paused = false,
    disposed = false,
    last = "";
  let peers = [];
  const names = [];
  const prefix = `collab-${crypto.randomUUID()}`;
  const style = document.createElement("style");
  document.head.append(style);
  const blocks = () => Array.from(root.querySelectorAll("[data-collab-text]"));
  const publish = () => {
    if (disposed) return;
    const selection = document.getSelection();
    const values = [];
    if (
      enabled &&
      !paused &&
      !document.hidden &&
      document.hasFocus() &&
      selection?.rangeCount &&
      !selection.isCollapsed &&
      !document.activeElement?.matches("input,textarea,[contenteditable]")
    ) {
      const selected = selection.getRangeAt(0);
      for (const el of blocks()) {
        if (!selected.intersectsNode(el)) continue;
        const bounds = document.createRange();
        bounds.selectNodeContents(el);
        const part = selected.cloneRange();
        if (part.compareBoundaryPoints(Range.START_TO_START, bounds) < 0)
          part.setStart(bounds.startContainer, bounds.startOffset);
        if (part.compareBoundaryPoints(Range.END_TO_END, bounds) > 0)
          part.setEnd(bounds.endContainer, bounds.endOffset);
        if (part.collapsed) continue;
        bounds.setEnd(part.startContainer, part.startOffset);
        const start = bounds.toString().length;
        values.push({
          target: el.dataset.collabText,
          text: el.textContent,
          start,
          end: start + part.toString().length,
        });
      }
    }
    const encoded = JSON.stringify(values);
    if (encoded !== last) {
      last = encoded;
      changed(values);
    }
  };
  const clear = () => {
    for (const name of names) CSS.highlights?.delete(name);
    names.length = 0;
    style.textContent = "";
  };
  const draw = () => {
    clear();
    if (!CSS.highlights || !globalThis.Highlight) return;
    for (const { state } of peers) {
      if (!Array.isArray(state?.selection)) continue;
      const ranges = [];
      for (const value of state.selection) {
        const el = blocks().find(
          (el) => el.dataset.collabText === value?.target,
        );
        if (
          !el ||
          el.textContent !== value.text ||
          !Number.isInteger(value.start) ||
          !Number.isInteger(value.end) ||
          value.start < 0 ||
          value.end <= value.start ||
          value.end > value.text.length
        )
          continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let offset = 0,
          started = false;
        while (walker.nextNode()) {
          const node = walker.currentNode,
            end = offset + node.length;
          if (!started && value.start < end) {
            range.setStart(node, value.start - offset);
            started = true;
          }
          if (started && value.end <= end) {
            range.setEnd(node, value.end - offset);
            ranges.push(range);
            break;
          }
          offset = end;
        }
      }
      if (!ranges.length) continue;
      const name = `${prefix}-${names.length}`;
      names.push(name);
      CSS.highlights.set(name, new Highlight(...ranges));
      const index = style.sheet.insertRule(
        `::highlight(${name}) {}`,
        style.sheet.cssRules.length,
      );
      style.sheet.cssRules[index].style.backgroundColor =
        typeof state.color === "string" && CSS.supports("color", state.color)
          ? state.color
          : "#90c2ff";
      style.sheet.cssRules[index].style.color = "#101820";
    }
  };
  const refresh = () => {
    publish();
    draw();
  };
  const observer = new MutationObserver(refresh);
  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  const hide = () => {
    paused = true;
    publish();
  };
  const show = () => {
    paused = false;
    publish();
  };
  const events = [
    [document, "selectionchange", publish],
    [document, "focusin", publish],
    [document, "visibilitychange", publish],
    [window, "blur", hide],
    [window, "focus", show],
    [window, "pagehide", hide],
    [window, "pageshow", show],
  ];
  events.forEach(([owner, name, fn]) => owner.addEventListener(name, fn));
  return {
    enable(value) {
      enabled = value;
      publish();
    },
    render(values) {
      if (!disposed) {
        peers = values;
        draw();
      }
    },
    disconnect() {
      if (disposed) return;
      enabled = false;
      publish();
      disposed = true;
      observer.disconnect();
      events.forEach(([owner, name, fn]) =>
        owner.removeEventListener(name, fn),
      );
      clear();
      style.remove();
    },
  };
}
