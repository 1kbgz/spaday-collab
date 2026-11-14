import { domTargets } from "../src/ts/pointers.js";
import { connectTextSelection } from "./text-selection.js";
import { connectPageSelection } from "./page-selection.js";
import { connectClicks, connectViewport } from "./page-activity.js";
import { connectFocus } from "./focus.js";
import { pageTargets } from "./page-pointers.js";

// Application mapping from scoped awareness to the optional pointer UI.
document.addEventListener(
  "spaday:wire-client",
  ({ detail: { namespace, store } }) => {
    if (namespace !== "document") return;
    let selections, pageSelection, clicks, viewport;
    const render = () => {
      const peers = store.get("remote_activity") ?? [];
      selections?.render(peers);
      pageSelection?.render(peers);
      clicks?.render(peers);
      store.set(
        "viewport_activity",
        peers
          .flatMap(({ state }) =>
            typeof state?.label === "string" &&
            Number.isInteger(state.viewport) &&
            state.viewport >= 0 &&
            state.viewport <= 100
              ? [`${state.label}: ${state.viewport}% down page`]
              : [],
          )
          .join(" · "),
      );
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
    let focus = null,
      selection = [],
      click = null,
      progress = null;
    let stopFocus = () => {};
    const publish = () => {
      if (active)
        store.set("activity", {
          pointer: store.get("pointer"),
          focus: store.get("share_focus") ? focus : null,
          selection,
          click,
          viewport: progress,
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
    const options = () => {
      pageSelection?.enable(Boolean(store.get("share_selection")));
      clicks?.enable(Boolean(store.get("share_clicks")));
      viewport?.enable(Boolean(store.get("share_viewport")));
      publish();
    };
    const stops = [
      store.subscribe("remote_activity", render),
      store.subscribe("pointer", publish),
      store.subscribe("document.note", () => selections?.refresh()),
      store.subscribe("page_pointers", configure),
      ...[
        "share_focus",
        "share_selection",
        "share_clicks",
        "share_viewport",
      ].map((key) => store.subscribe(key, options)),
    ];
    configure();
    render();
    queueMicrotask(() => {
      if (!active) return;
      selections = connectTextSelection(document.querySelector("textarea"));
      pageSelection = connectPageSelection(
        document.querySelector("main"),
        (value) => {
          selection = value;
          publish();
        },
      );
      clicks = connectClicks(pageTargets(domTargets(), true), (value) => {
        click = value;
        publish();
      });
      viewport = connectViewport((value) => {
        progress = value;
        publish();
      });
      options();
      render();
      stopFocus = connectFocus((value) => {
        focus = value;
        publish();
      });
    });
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) {
        stopFocus();
        pageSelection?.disconnect();
        clicks?.disconnect();
        viewport?.disconnect();
        selections?.disconnect();
        active = false;
        stops.forEach((stop) => stop());
      }
    });
  },
);
