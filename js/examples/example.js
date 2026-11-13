// Application mapping from scoped awareness to the optional pointer UI.
document.addEventListener(
  "spaday:wire-client",
  ({ detail: { namespace, store } }) => {
    if (namespace !== "document") return;
    const render = () =>
      store.set(
        "pointers",
        (store.get("remote_activity") ?? []).map(({ peer, state }) => ({
          peer,
          pointer: state?.pointer,
          label: state?.label,
          color: state?.color,
        })),
      );
    const stop = store.subscribe("remote_activity", render);
    render();
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) stop();
    });
  },
);
