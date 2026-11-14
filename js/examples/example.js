import { domTargets } from "../src/ts/pointers.js";
import { pageTargets } from "./page-pointers.js";

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
    let active = true;
    const configure = () =>
      queueMicrotask(() => {
        if (!active) return;
        document.querySelector("spaday-pointers").adapter = pageTargets(
          domTargets(),
          Boolean(store.get("page_pointers")),
        );
      });
    const stops = [
      store.subscribe("remote_activity", render),
      store.subscribe("page_pointers", configure),
    ];
    configure();
    render();
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) {
        active = false;
        stops.forEach((stop) => stop());
      }
    });
  },
);
