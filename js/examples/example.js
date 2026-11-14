import { domTargets } from "../src/ts/pointers.js";
import { connectTextSelection } from "./text-selection.js";
import { connectFocus } from "./focus.js";
import { pageTargets } from "./page-pointers.js";

// Application mapping from scoped awareness to the optional pointer UI.
document.addEventListener(
  "spaday:wire-client",
  ({ detail: { namespace, store } }) => {
    if (namespace !== "document") return;
    let selections;
    const render = () => {
      const peers = store.get("remote_activity") ?? [];
      selections?.render(peers);
      store.set(
        "pointers",
        peers.map(({ peer, state }) => ({
          peer,
          pointer: state?.pointer,
          label: state?.label,
          color: state?.color,
        })),
      );
      for (const target of ["note", "review"]) {
        const labels = peers.flatMap(({ state }) =>
          state?.focus?.target === target && typeof state.label === "string"
            ? [
                `${state.label}: ${state.focus.editing === true ? "Editing" : "Focused"}`,
              ]
            : [],
        );
        store.set(`focus_${target}`, [...new Set(labels)].join(" · "));
      }
    };
    let active = true;
    let focus = null;
    let stopFocus = () => {};
    const publish = () => {
      if (active)
        store.set("activity", {
          pointer: store.get("pointer"),
          focus,
          label: store.get("name"),
          color: store.get("color"),
        });
    };
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
      store.subscribe("pointer", publish),
      store.subscribe("document.note", () => selections?.refresh()),
      store.subscribe("page_pointers", configure),
    ];
    configure();
    render();
    queueMicrotask(() => {
      if (!active) return;
      selections = connectTextSelection(document.querySelector("textarea"));
      render();
      stopFocus = connectFocus((value) => {
        focus = value;
        publish();
      });
    });
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) {
        stopFocus();
        selections?.disconnect();
        active = false;
        stops.forEach((stop) => stop());
      }
    });
  },
);
