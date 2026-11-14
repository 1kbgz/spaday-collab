// Plain-textarea example: offsets are valid only for the exact shared text snapshot.
export function connectTextSelection(textarea) {
  const layer = document.createElement("div");
  layer.className = "text-presence";
  layer.setAttribute("aria-hidden", "true");
  const mirror = document.createElement("div");
  mirror.className = "text-mirror";
  layer.append(mirror);
  textarea.parentElement.append(layer);
  let peers = [];
  let frame = 0;
  let disposed = false;
  const draw = () => {
    frame = 0;
    if (disposed) return;
    layer
      .querySelectorAll(".text-selection,.text-caret")
      .forEach((el) => el.remove());
    const style = getComputedStyle(textarea);
    Object.assign(layer.style, {
      left: `${textarea.offsetLeft + textarea.clientLeft}px`,
      top: `${textarea.offsetTop + textarea.clientTop}px`,
      width: `${textarea.clientWidth}px`,
      height: `${textarea.clientHeight}px`,
    });
    for (const property of [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "fontVariant",
      "lineHeight",
      "letterSpacing",
      "wordSpacing",
      "textAlign",
      "textIndent",
      "textTransform",
      "direction",
      "tabSize",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ])
      mirror.style[property] = style[property];
    Object.assign(mirror.style, {
      width: `${textarea.clientWidth}px`,
      whiteSpace: textarea.wrap === "off" ? "pre" : "pre-wrap",
      transform: `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`,
    });
    mirror.textContent = textarea.value + "\u200b";
    const origin = layer.getBoundingClientRect();
    const range = document.createRange();
    const text = mirror.firstChild;
    for (const { peer, state } of peers) {
      const selection = state?.focus?.selection;
      if (
        state?.focus?.target !== textarea.dataset.collabTarget ||
        !selection ||
        selection.text !== textarea.value
      )
        continue;
      const { anchor, head } = selection;
      if (
        ![anchor, head].every(
          (n) => Number.isInteger(n) && n >= 0 && n <= textarea.value.length,
        )
      )
        continue;
      const color =
        typeof state.color === "string" && CSS.supports("color", state.color)
          ? state.color
          : "#90c2ff";
      const mark = (rect, kind) => {
        const el = document.createElement("span");
        el.className = kind;
        el.dataset.peer = peer;
        Object.assign(el.style, {
          left: `${rect.left - origin.left}px`,
          top: `${rect.top - origin.top}px`,
          width: `${kind === "text-caret" ? 2 : rect.width}px`,
          height: `${rect.height}px`,
          backgroundColor: color,
        });
        layer.append(el);
      };
      if (anchor !== head) {
        range.setStart(text, Math.min(anchor, head));
        range.setEnd(text, Math.max(anchor, head));
        for (const rect of range.getClientRects())
          if (rect.width && rect.height) mark(rect, "text-selection");
      }
      range.setStart(text, head);
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      if (rect.height) mark(rect, "text-caret");
    }
  };
  const refresh = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(draw);
  };
  const resize = new ResizeObserver(refresh);
  resize.observe(textarea);
  textarea.addEventListener("scroll", refresh);
  textarea.addEventListener("input", refresh);
  return {
    render(values) {
      peers = values;
      refresh();
    },
    refresh,
    disconnect() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      textarea.removeEventListener("scroll", refresh);
      textarea.removeEventListener("input", refresh);
      layer.remove();
    },
  };
}
