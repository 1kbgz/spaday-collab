# Connect pointers to an application

## Use scoped awareness

Add `Pointers().bind("peers", "remote_pointers")` to the page. Handle `pointer-change` with `SetField` to write local pointer state. Configure `Wire.awareness` with an `Awareness(local="activity", peers="remote_activity")` scope, and map each `{peer, state}` entry to `{peer, pointer: state.pointer, label, color}` in `remote_pointers`.

Keep the local peer out of this list. Choose labels and colors in your application. Reuse the page's managed connection so reconnect and page lifecycle events also manage awareness. The [example](https://github.com/1kbgz/spaday-collab/blob/main/spaday_collab/example.py) includes this setup.

## Adapt a virtualized component

Set the browser element's `adapter` property after mounting it:

```javascript
pointers.adapter = {
  hitTest: (x, y) => tree.getItemAtPoint(x, y) ?? null,
  resolve: (id) => {
    const geometry = tree.getItemBounds(id);
    return geometry && {
      ...geometry,
      hit: (x, y) => tree.getItemAtPoint(x, y) === id,
    };
  },
  roots: () => [tree],
};
```

Use stable record IDs, including a field ID when appropriate. Return `undefined` for deleted, collapsed, or unmounted targets. Provide `visibleBounds` for clipped rows, and reject obscured points in `hit`. Dispatch a bubbling `viewport-change` event when internal layout changes cannot be observed from the supplied roots.

## Replace the renderer

Import `connectPointers` from `/components/collab/cdn/index.js`. Pass a geometry adapter, a callback for local state, and a callback for projected remote coordinates. Call `render(remotePeers)` when awareness changes and `disconnect()` when removing the integration. No `Pointers` element is required.

## Style pointers

Set `--spa-collab-accent`, `--spa-collab-label-text`, or `--spa-collab-z-index` on the page or component. A peer's explicit `color` overrides the default accent. Use `spaday-pointers::part(cursor)`, `::part(label)`, and `::part(hover)` for additional styling.

Mount the overlay outside transformed or clipped containers so fixed positioning uses the page viewport.
