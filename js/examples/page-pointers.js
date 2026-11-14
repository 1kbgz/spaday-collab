// Example policy: use target geometry first, then optional viewport presence.
// Prefix target IDs so a component cannot collide with the page fallback.
export function pageTargets(targets, enabled) {
  const viewport = "page";
  const prefix = "target:";
  const pageGeometry = () => ({
    bounds: new DOMRect(
      0,
      0,
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
    ),
    hit: (x, y) => document.elementFromPoint(x, y) !== null,
  });
  return {
    hitTest(x, y) {
      const id = targets.hitTest(x, y);
      if (id !== null) return prefix + id;
      return enabled && pageGeometry().hit(x, y) ? viewport : null;
    },
    resolve(id) {
      // The checkbox controls what this browser shares, not what it receives.
      if (id === viewport) return pageGeometry();
      return id.startsWith(prefix)
        ? targets.resolve(id.slice(prefix.length))
        : undefined;
    },
    roots: () => targets.roots?.() ?? [document.body],
  };
}
