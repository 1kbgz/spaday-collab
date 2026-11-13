export interface Pointer {
  target: string;
  x: number;
  y: number;
}
export interface Geometry {
  bounds: DOMRectReadOnly;
  visibleBounds?: DOMRectReadOnly;
  hit: (x: number, y: number) => boolean;
}
export interface PointerAdapter {
  hitTest(x: number, y: number): string | null;
  resolve(target: string): Geometry | undefined;
  roots?(): (Element | ShadowRoot)[];
}
export interface RemotePointer {
  peer: string;
  pointer?: unknown;
}
export interface ProjectedPointer {
  peer: string;
  x: number;
  y: number;
  bounds: DOMRectReadOnly;
}
export function isPointer(value: unknown): value is Pointer {
  if (!value || typeof value !== "object") return false;
  const p = value as Pointer;
  return (
    typeof p.target === "string" &&
    p.target.length > 0 &&
    typeof p.x === "number" &&
    Number.isFinite(p.x) &&
    p.x >= 0 &&
    p.x <= 1 &&
    typeof p.y === "number" &&
    Number.isFinite(p.y) &&
    p.y >= 0 &&
    p.y <= 1
  );
}
function hitElement(x: number, y: number): Element | null {
  let hit = document.elementFromPoint(x, y);
  while (hit?.shadowRoot) {
    const inner = hit.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === hit) break;
    hit = inner;
  }
  return hit;
}
function containsComposed(element: Element, hit: Element | null): boolean {
  while (hit) {
    if (element === hit || element.contains(hit)) return true;
    const root = hit.getRootNode();
    hit = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}
export function elementGeometry(element: Element): Geometry {
  const bounds = element.getBoundingClientRect();
  let left = Math.max(0, bounds.left),
    top = Math.max(0, bounds.top);
  let right = Math.min(innerWidth, bounds.right),
    bottom = Math.min(innerHeight, bounds.bottom);
  let ancestor: Element | null = element;
  while (ancestor) {
    const root = ancestor.getRootNode();
    ancestor =
      ancestor.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
    if (!ancestor) break;
    const style = getComputedStyle(ancestor),
      clip = ancestor.getBoundingClientRect();
    if (style.overflowX !== "visible") {
      left = Math.max(left, clip.left + ancestor.clientLeft);
      right = Math.min(
        right,
        clip.left + ancestor.clientLeft + ancestor.clientWidth,
      );
    }
    if (style.overflowY !== "visible") {
      top = Math.max(top, clip.top + ancestor.clientTop);
      bottom = Math.min(
        bottom,
        clip.top + ancestor.clientTop + ancestor.clientHeight,
      );
    }
  }
  const visibleBounds = new DOMRect(
    left,
    top,
    Math.max(0, right - left),
    Math.max(0, bottom - top),
  );
  return {
    bounds,
    visibleBounds,
    hit(x, y) {
      const hit = hitElement(x, y);
      return containsComposed(element, hit);
    },
  };
}
/** Stable IDs for ordinary HTML. Use a custom adapter for virtualized targets. */
export function domTargets(root: ParentNode = document): PointerAdapter {
  const targets = () =>
    Array.from(root.querySelectorAll("[data-collab-target]"));
  return {
    hitTest(x, y) {
      const hit = hitElement(x, y);
      return (
        targets()
          .reverse()
          .find((el) => containsComposed(el, hit))
          ?.getAttribute("data-collab-target") ?? null
      );
    },
    resolve(id) {
      const element = targets().find(
        (el) => el.getAttribute("data-collab-target") === id,
      );
      return element ? elementGeometry(element) : undefined;
    },
    roots: () => [
      root instanceof Document ? root.body : (root as Element | ShadowRoot),
    ],
  };
}
/** Track relative pointers without choosing a transport, user identity, or renderer. */
export function connectPointers(
  adapter: PointerAdapter,
  changed: (pointer: Pointer | null) => void,
  draw: (pointers: ProjectedPointer[]) => void,
) {
  let pointer: Pointer | null = null;
  let position: { x: number; y: number } | undefined;
  let peers: RemotePointer[] = [];
  let last = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0,
    active = true;
  const roots = new Set<Element | ShadowRoot>();
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
    if (pointer) {
      pointer = null;
      changed(null);
    }
  };
  const render = () => {
    frame = 0;
    if (!active) return;
    observe();
    const projected = peers.flatMap(({ peer, pointer: p }) => {
      if (!isPointer(p)) return [];
      const target = adapter.resolve(p.target);
      if (!target) return [];
      const { bounds } = target,
        box = target.visibleBounds ?? bounds;
      const x = bounds.left + bounds.width * p.x,
        y = bounds.top + bounds.height * p.y;
      if (
        bounds.width <= 0 ||
        bounds.height <= 0 ||
        box.width <= 0 ||
        box.height <= 0 ||
        x < box.left ||
        x > box.right ||
        y < box.top ||
        y > box.bottom ||
        !target.hit(x, y)
      )
        return [];
      return [{ peer, x, y, bounds: box }];
    });
    const encoded = JSON.stringify(projected);
    if (encoded !== last) {
      last = encoded;
      draw(projected);
    }
  };
  const schedule = () => {
    if (active && !frame) frame = requestAnimationFrame(render);
  };
  const refresh = () => {
    if (pointer && position) {
      const target = adapter.resolve(pointer.target);
      if (
        !target ||
        !target.hit(position.x, position.y) ||
        Math.abs(
          target.bounds.left + target.bounds.width * pointer.x - position.x,
        ) > 0.5 ||
        Math.abs(
          target.bounds.top + target.bounds.height * pointer.y - position.y,
        ) > 0.5
      )
        clear();
    }
    schedule();
  };
  const observer = new MutationObserver(refresh);
  const resize = new ResizeObserver(refresh);
  function observe() {
    const next = new Set(adapter.roots?.() ?? [document.body]);
    if (next.size === roots.size && [...next].every((root) => roots.has(root)))
      return;
    observer.disconnect();
    resize.disconnect();
    for (const root of roots) root.removeEventListener("scroll", refresh, true);
    roots.clear();
    for (const root of next) {
      roots.add(root);
      root.addEventListener("scroll", refresh, true);
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      resize.observe(root instanceof ShadowRoot ? root.host : root);
    }
  }
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    position = { x: event.clientX, y: event.clientY };
    const target = adapter.hitTest(event.clientX, event.clientY);
    const geometry = target === null ? undefined : adapter.resolve(target);
    if (
      !target ||
      !geometry ||
      !geometry.bounds.width ||
      !geometry.bounds.height ||
      !geometry.hit(event.clientX, event.clientY)
    ) {
      clear();
      return;
    }
    const rect = geometry.bounds;
    pointer = {
      target,
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
    if (!timer)
      timer = setTimeout(() => {
        timer = undefined;
        if (active) changed(pointer);
      }, 40);
  };
  const visibility = () => {
    if (document.hidden) clear();
    else schedule();
  };
  const events: [EventTarget, string, EventListener, boolean?][] = [
    [document, "pointermove", move as EventListener],
    [document.documentElement, "pointerleave", clear],
    [document, "scroll", refresh, true],
    [document, "viewport-change", refresh],
    [document, "visibilitychange", visibility],
    [window, "resize", refresh],
    [window, "blur", clear],
    [window, "pagehide", clear],
    [window, "pageshow", refresh],
  ];
  events.forEach(([target, type, listener, capture]) =>
    target.addEventListener(type, listener, capture),
  );
  observe();
  return {
    current: () => pointer,
    render(values: RemotePointer[]) {
      if (active) {
        peers = values;
        last = "";
        schedule();
      }
    },
    refresh,
    disconnect() {
      if (!active) return;
      active = false;
      clear();
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      for (const root of roots)
        root.removeEventListener("scroll", refresh, true);
      events.forEach(([target, type, listener, capture]) =>
        target.removeEventListener(type, listener, capture),
      );
      draw([]);
    },
  };
}
