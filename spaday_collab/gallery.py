"""Single-browser component preview, including supplied sample pointers."""

from spaday import SetField, element, event_value

from spaday_collab import Pointers

STYLE = """
:root { color-scheme: dark; --spa-text: #101820; --spa-accent: #90c2ff; }
body { margin:0; background:#101820; color:#e4ebef; font:16px/1.5 system-ui; }
main { max-width:56rem; margin:auto; padding:2rem; }
a { color:#90c2ff; } nav { display:flex; gap:1rem; }
section { background:#192630; border:1px solid #344854; border-radius:.5rem; padding:1rem; margin:2rem 0; min-height:8rem; }
label { display:block; margin-top:2rem; }
textarea { box-sizing:border-box; display:block; width:100%; min-height:8rem; font:inherit; padding:1rem; margin-top:.5rem; }
pre { white-space:pre-wrap; }
"""


def gallery():
    return element(
        "main",
        element("h1", "Shared pointer gallery"),
        element(
            "p", "Sample remote pointers show labels, colors, and hover outlines. Move your pointer over either panel to inspect local coordinates."
        ),
        element(
            "p",
            "This preview runs Python in Pyodide. For two real users, run python -m spaday_collab.example and open Alice and Bob in separate browsers.",
        ),
        element(
            "section",
            element("h2", "First target"),
            element("p", "Stable target IDs align pointers across different window sizes."),
            **{"data-collab-target": "first"},
        ),
        element(
            "section",
            element("h2", "Second target"),
            element("p", "Labels and colors belong to the application."),
            **{"data-collab-target": "second"},
        ),
        element("pre", id="pointer").bind("textContent", "pointer", codec="json"),
        Pointers(
            peers=[
                {"peer": "sample-a", "pointer": {"target": "first", "x": 0.7, "y": 0.5}, "label": "Alice (sample)", "color": "#f4a261"},
                {"peer": "sample-b", "pointer": {"target": "second", "x": 0.6, "y": 0.6}, "label": "Bob (sample)", "color": "#90c2ff"},
            ]
        ).on("pointer-change", SetField("pointer", event_value("pointer"))),
    )
