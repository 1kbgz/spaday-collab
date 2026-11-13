# Collaboration boundaries

Pointer location describes transient activity. It belongs in awareness, while edits belong in the shared document or CRDT. Transports manages that state and connection lifecycle; Spaday binds it to page state.

`spaday-collab` projects relative pointer coordinates and optionally displays them. Stable target IDs let a pointer refer to the same record when users have different viewport sizes, sort orders, or local selections. A component adapter translates those IDs into current geometry. Missing or obscured targets have no visible pointer.

The package does not choose user identities, colors, roles, rooms, or tab grouping. Applications supply those policies. CodeMirror selections and decorations remain editor-specific; table and tree identity and geometry remain component-specific. A page can use scoped awareness without installing this package, or use its tracker with a custom display and transport.

Removing a pointer component disconnects its observers and listeners. Blur, page hiding, and leaving a target withdraw local pointer state. Network disconnects, reconnects, and stale-peer expiry remain the awareness connection's responsibility. These boundaries allow the optional display to change without a Spaday or transports release.

The browser gallery uses labeled sample pointers to demonstrate rendering. The server example exchanges real awareness and shared note updates between browsers.
