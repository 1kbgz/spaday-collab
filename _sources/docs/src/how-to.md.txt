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

## Track pointers outside component targets

Run `python -m spaday_collab.example` and leave **Share my pointer across the page** checked. The checkbox controls local sharing; remote pointers remain visible when it is unchecked.

The example's `js/examples/page-pointers.js` wraps a `PointerAdapter`:

```javascript
pointers.adapter = pageTargets(componentAdapter, true);
```

A component target takes priority. Otherwise, the wrapper uses a normalized viewport position. Target IDs are prefixed to distinguish component targets from the page fallback. This helper is example code, not a package export; copy it into your application and wrap the same adapter used for table rows, tree items, or ordinary HTML.

Viewport positions show approximate activity when users have different page layouts or scroll positions. Component positions identify the same content. If a component target is missing or off-screen in the receiving browser, its pointer stays hidden; the example does not reinterpret it as a page position. Blur, leaving the page, and awareness disconnects still withdraw pointers.

## Show focus and editing activity

Run the local example in two browsers. Focus the shared note as Alice: Bob sees “Alice: Focused”
beside it. Type to show “Alice: Editing”; after 1.5 seconds without input, the label returns to
“Focused”. Press Tab to move the focus indicator to the review section. Moving the pointer does
not change keyboard focus.

To adapt this behavior, copy `js/examples/focus.js` and the awareness mapping in
`js/examples/example.js`. The helper reports `{target, editing, selection?}` or `null`, using the focused
HTML element's nearest `data-collab-target`. Keep this state alongside the pointer in one awareness
value so updating either field preserves the other. Use `SetField("pointer", event_value("pointer"))`
for pointer events, then compose the awareness value in the store subscription as the example does.

Render each remote target's labels through ordinary Python components and `textContent` bindings.
Clear focus on window blur, hidden pages, and navigation. Disconnect the helper when removing the
page integration. The managed awareness connection removes disconnected peers and republishes
current local state after reconnect.

The helper and its timeout are example policy, not package exports. For virtualized rows or shadow
components, map the component's focus/selection events to stable record or field IDs in your adapter;
do not use DOM row indices as shared identities. Keep editor text anchors in the editor's existing
collaboration API. Focus labels communicate activity and do not lock fields or grant permission.

## Show a textarea selection

Select text in Alice's shared note to show a colored highlight in Bob's textarea. Collapse the
selection to show a caret; a backward selection places that caret at its active end. Each browser
uses its own wrapping, textarea size, and scroll position. The overlay ignores pointer input.

The example helper `js/examples/text-selection.js` measures text in a hidden mirror of the textarea
and draws the remote ranges above it. Focus changes publish the textarea's UTF-16 `anchor` and
`head` offsets along with the exact `text` snapshot. Only matching snapshots render, so a model
update arriving before its awareness update hides stale marks. Empty text and trailing newlines
still have caret positions. Blur, target changes, and disconnected peers remove the marks.

This small-note example includes the note text in awareness to validate offsets. It does not
transform selections through concurrent edits or turn the textarea into a text CRDT. Use
spaday-codemirror's anchored selections for collaborative code editing; keep this mirror and
snapshot policy in example code.

## Share other page activity

Use **Share my activity** in the local example to control each outgoing signal independently:

| Control                       | Default | Remote display                                           |
| ----------------------------- | ------- | -------------------------------------------------------- |
| Page-text selections          | On      | Selected text highlighted in matching content.           |
| Focus and textarea selections | On      | Focus/editing labels and textarea ranges/carets.         |
| Click indicators              | Off     | A colored marker that fades after 800 ms.                |
| Viewport position             | Off     | A percentage showing approximate progress down the page. |

Turning a control off withdraws that local state. It does not hide incoming activity. The pointer
checkbox remains independent. All signals use the same awareness connection.

For ordinary text, mark static, non-overlapping blocks with unique `data-collab-text` IDs. The
`js/examples/page-selection.js` helper splits a native selection across those blocks and sends exact
text snapshots plus UTF-16 offsets. The receiver resolves its own text nodes, rejects mismatched
snapshots, and uses the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
to paint ranges without replacing its local selection. Keep form controls, private text, and presence
labels outside these opted-in blocks. Browsers without that API omit the page highlights.

`js/examples/page-activity.js` demonstrates click and viewport sharing. Clicks use the existing
geometry adapter; keyboard activation uses the activated element's center. Receiving a click only
paints a marker and never activates a control. Markers expire, ignore duplicate deliveries, and clear
on scroll or disconnect. Viewport progress is approximate when layouts differ. It never scrolls the
receiving page; a scrollbar overlay or minimap can be added by the application if useful.

These helpers and defaults are example policy, not public library APIs. Dispose the helpers when
removing the integration; blur, hidden pages, and page lifecycle events withdraw local activity.

## Replace the renderer

Import `connectPointers` from `/components/collab/cdn/index.js`. Pass a geometry adapter, a callback for local state, and a callback for projected remote coordinates. Call `render(remotePeers)` when awareness changes and `disconnect()` when removing the integration. No `Pointers` element is required.

## Style pointers

Set `--spa-collab-accent`, `--spa-collab-label-text`, or `--spa-collab-z-index` on the page or component. A peer's explicit `color` overrides the default accent. Use `spaday-pointers::part(cursor)`, `::part(label)`, and `::part(hover)` for additional styling.

Mount the overlay outside transformed or clipped containers so fixed positioning uses the page viewport.
