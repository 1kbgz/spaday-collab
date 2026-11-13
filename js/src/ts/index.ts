import {
  connectPointers,
  domTargets,
  type PointerAdapter,
  type ProjectedPointer,
} from "./pointers.js";
export * from "./pointers.js";
export interface Peer {
  peer: string;
  pointer?: unknown;
  label?: string;
  color?: string;
}
/** Optional pointer presentation. Names and colors are supplied by the application. */
export class SpadayPointers extends HTMLElement {
  private _peers: Peer[] = [];
  private _adapter: PointerAdapter = domTargets();
  private tracker?: ReturnType<typeof connectPointers>;
  private layer: HTMLDivElement;
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host { display:contents; }
      .layer { position:fixed; inset:0; z-index:var(--spa-collab-z-index,1000); pointer-events:none; overflow:hidden; }
      .cursor,.hover { position:absolute; pointer-events:none; }
      .hover { box-sizing:border-box; border:2px solid var(--peer-color); border-radius:3px; opacity:.65; }
      .cursor { color:var(--spa-collab-label-text,var(--spa-text,#101820)); font:12px system-ui; display:flex; align-items:flex-start; gap:2px; }
      .arrow { width:14px; height:20px; background:var(--peer-color); clip-path:polygon(0 0,100% 65%,55% 68%,40% 100%); }
      .label { margin-top:16px; padding:2px 6px; border-radius:3px; background:var(--peer-color); }
      .label:empty { display:none; }
    </style>`;
    this.layer = document.createElement("div");
    this.layer.className = "layer";
    this.layer.setAttribute("aria-hidden", "true");
    root.append(this.layer);
  }
  get peers() {
    return this._peers;
  }
  set peers(value: Peer[]) {
    this._peers = Array.isArray(value)
      ? value.filter((p) => p && typeof p.peer === "string")
      : [];
    this.tracker?.render(this._peers);
  }
  get adapter() {
    return this._adapter;
  }
  set adapter(value: PointerAdapter) {
    this.tracker?.disconnect();
    this.tracker = undefined;
    this._adapter = value;
    if (this.isConnected) this.start();
  }
  connectedCallback() {
    for (const prop of ["peers", "adapter"] as const) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const value = this[prop];
        delete (this as unknown as Record<string, unknown>)[prop];
        Object.assign(this, { [prop]: value });
      }
    }
    if (!this.tracker) this.start();
  }
  disconnectedCallback() {
    this.tracker?.disconnect();
    this.tracker = undefined;
  }
  private start() {
    this.tracker = connectPointers(
      this._adapter,
      (pointer) =>
        this.dispatchEvent(
          new CustomEvent("pointer-change", {
            detail: { pointer },
            bubbles: true,
            composed: true,
          }),
        ),
      (pointers) => this.draw(pointers),
    );
    this.tracker.render(this._peers);
  }
  private draw(pointers: ProjectedPointer[]) {
    this.layer.replaceChildren(
      ...pointers.map(({ peer, x, y, bounds }) => {
        const entry = this._peers.find((p) => p.peer === peer)!;
        const group = document.createElement("div");
        group.dataset.peer = peer;
        const color =
          typeof entry.color === "string" && CSS.supports("color", entry.color)
            ? entry.color
            : "var(--spa-collab-accent,var(--spa-accent,#90c2ff))";
        group.style.setProperty("--peer-color", color);
        const hover = document.createElement("div");
        hover.className = "hover";
        hover.part.add("hover");
        Object.assign(hover.style, {
          left: `${bounds.left}px`,
          top: `${bounds.top}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        });
        const cursor = document.createElement("div");
        cursor.className = "cursor";
        cursor.part.add("cursor");
        Object.assign(cursor.style, { left: `${x}px`, top: `${y}px` });
        const arrow = document.createElement("span");
        arrow.className = "arrow";
        const label = document.createElement("span");
        label.className = "label";
        label.part.add("label");
        label.textContent = typeof entry.label === "string" ? entry.label : "";
        cursor.append(arrow, label);
        group.append(hover, cursor);
        return group;
      }),
    );
  }
}
if (!customElements.get("spaday-pointers"))
  customElements.define("spaday-pointers", SpadayPointers);
