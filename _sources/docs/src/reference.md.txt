# API reference

## Python

`Pointers` aliases the generated `SpadayPointers` component with tag `spaday-pointers`.

| Property | Value                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `peers`  | List of `{peer: str, pointer: {target: str, x: float, y: float} \| None, label?: str, color?: str}`. Defaults to empty. |

`pointer-change` emits `detail.pointer`: a target-relative pointer or `null` on withdrawal. Coordinates are finite numbers in `[0, 1]`. Empty target IDs and malformed remote pointers are ignored. Labels use plain text; colors must be valid CSS colors. Programmatic peer updates do not emit local movement events.

`package` registers the `collab` component package and bundled assets. `TOKENS` exports `spa_collab_accent`, `spa_collab_label_text`, and `spa_collab_z_index`.

## Browser

`SpadayPointers.adapter` accepts a `PointerAdapter`. The default is `domTargets(document)`, which selects `[data-collab-target]` elements. Target IDs must be unique within that adapter. Multiple overlays can use disjoint roots.

`PointerAdapter` has:

- `hitTest(x, y): string | null`: target ID under viewport coordinates.
- `resolve(id): Geometry | undefined`: current target geometry.
- `roots?(): (Element | ShadowRoot)[]`: observed mutation, resize, and scroll roots. Defaults to the document body.

`Geometry` has `bounds: DOMRectReadOnly`, optional `visibleBounds: DOMRectReadOnly`, and `hit(x, y): boolean`. Bounds and hit tests use viewport coordinates.

`elementGeometry(element)` returns DOM bounds, ancestor clipping, and a hit test. `domTargets(root = document)` creates an adapter for ordinary HTML targets beneath that root; shadow-root contents require their own adapter root.

`connectPointers(adapter, changed, draw)` returns:

- `current()`: last local pointer or `null`.
- `render(peers)`: project `{peer, pointer}` entries through current geometry.
- `refresh()`: recheck local geometry and schedule remote drawing.
- `disconnect()`: remove listeners and observers, withdraw the local pointer, and clear the display. Repeated calls do nothing.

`changed(pointer)` is throttled to at most once per 40 ms while moving. Withdrawals are immediate. Mouse and pen movement are tracked; touch movement is ignored.

`draw(pointers)` receives `{peer, x, y, bounds}` entries in viewport coordinates. `bounds` describes the visible hover outline. Drawing is scheduled through animation frames on peer updates, layout events, and observed changes.

`isPointer(value)` validates a target-relative pointer.

## Styling

| Token                     | Default                        |
| ------------------------- | ------------------------------ |
| `--spa-collab-accent`     | `--spa-accent`, then `#90c2ff` |
| `--spa-collab-label-text` | `--spa-text`, then `#101820`   |
| `--spa-collab-z-index`    | `1000`                         |

The display exposes `cursor`, `label`, and `hover` shadow parts. Its overlay ignores pointer input and is hidden from accessibility navigation.
