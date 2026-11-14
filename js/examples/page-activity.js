import { isPointer } from "../src/ts/pointers.js";

// Transient feedback only: never replay a remote click as a local action.
export function connectClicks(adapter, changed) {
  let enabled = false,
    disposed = false,
    timer;
  const seen = new Map();
  const marks = new Map();
  const withdraw = () => {
    clearTimeout(timer);
    if (!disposed) changed(null);
  };
  const click = (event) => {
    if (!enabled || document.hidden) return;
    let x = event.clientX,
      y = event.clientY;
    if (event.detail === 0 && event.target instanceof Element) {
      const box = event.target.getBoundingClientRect();
      x = box.left + box.width / 2;
      y = box.top + box.height / 2;
    }
    const target = adapter.hitTest(x, y),
      geometry = target && adapter.resolve(target);
    if (!geometry || !geometry.bounds.width || !geometry.bounds.height) return;
    const b = geometry.bounds;
    clearTimeout(timer);
    changed({
      id: crypto.randomUUID(),
      pointer: {
        target,
        x: Math.max(0, Math.min(1, (x - b.left) / b.width)),
        y: Math.max(0, Math.min(1, (y - b.top) / b.height)),
      },
    });
    timer = setTimeout(withdraw, 800);
  };
  const clearMarks = () => {
    for (const [el, timeout] of marks) {
      clearTimeout(timeout);
      el.remove();
    }
    marks.clear();
  };
  const hide = () => {
    withdraw();
    clearMarks();
  };
  const visibility = () => {
    if (document.hidden) hide();
  };
  const events = [
    [document, "click", click],
    [document, "scroll", clearMarks, true],
    [document, "visibilitychange", visibility],
    [window, "blur", hide],
    [window, "pagehide", hide],
  ];
  events.forEach(([owner, name, fn, capture]) =>
    owner.addEventListener(name, fn, capture),
  );
  return {
    enable(value) {
      enabled = value;
      if (!value) withdraw();
    },
    render(peers) {
      if (disposed) return;
      const live = new Set(peers.map(({ peer }) => peer));
      for (const peer of seen.keys()) if (!live.has(peer)) seen.delete(peer);
      for (const [el, timeout] of marks)
        if (!live.has(el.dataset.peer)) {
          clearTimeout(timeout);
          el.remove();
          marks.delete(el);
        }
      for (const { peer, state } of peers) {
        const value = state?.click;
        if (
          !value ||
          typeof value.id !== "string" ||
          seen.get(peer) === value.id ||
          !isPointer(value.pointer)
        )
          continue;
        seen.set(peer, value.id);
        const geometry = adapter.resolve(value.pointer.target);
        if (!geometry) continue;
        const b = geometry.bounds,
          clip = geometry.visibleBounds ?? b;
        const x = b.left + b.width * value.pointer.x,
          y = b.top + b.height * value.pointer.y;
        if (
          x < clip.left ||
          x > clip.right ||
          y < clip.top ||
          y > clip.bottom ||
          !geometry.hit(x, y)
        )
          continue;
        const mark = document.createElement("span");
        mark.className = "click-marker";
        mark.dataset.peer = peer;
        mark.setAttribute("aria-hidden", "true");
        mark.style.left = `${x}px`;
        mark.style.top = `${y}px`;
        mark.style.borderColor =
          typeof state.color === "string" && CSS.supports("color", state.color)
            ? state.color
            : "#90c2ff";
        document.body.append(mark);
        marks.set(
          mark,
          setTimeout(() => {
            mark.remove();
            marks.delete(mark);
          }, 800),
        );
      }
    },
    disconnect() {
      if (disposed) return;
      withdraw();
      disposed = true;
      clearMarks();
      seen.clear();
      events.forEach(([owner, name, fn, capture]) =>
        owner.removeEventListener(name, fn, capture),
      );
    },
  };
}

// Approximate reading progress, not a command to scroll another browser.
export function connectViewport(changed) {
  let enabled = false,
    paused = false,
    disposed = false,
    frame = 0,
    last;
  const publish = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (disposed) return;
    const height = document.documentElement.scrollHeight - innerHeight;
    const value =
      enabled && !paused && !document.hidden && document.hasFocus()
        ? Math.round(
            100 * Math.max(0, Math.min(1, height > 0 ? scrollY / height : 0)),
          )
        : null;
    if (value !== last) {
      last = value;
      changed(value);
    }
  };
  const refresh = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(publish);
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
    [window, "scroll", refresh],
    [window, "resize", refresh],
    [document, "visibilitychange", refresh],
    [window, "blur", hide],
    [window, "focus", show],
    [window, "pagehide", hide],
    [window, "pageshow", show],
  ];
  events.forEach(([owner, name, fn]) => owner.addEventListener(name, fn));
  const resize = new ResizeObserver(refresh);
  resize.observe(document.body);
  return {
    enable(value) {
      enabled = value;
      publish();
    },
    disconnect() {
      if (disposed) return;
      enabled = false;
      publish();
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      events.forEach(([owner, name, fn]) =>
        owner.removeEventListener(name, fn),
      );
    },
  };
}
