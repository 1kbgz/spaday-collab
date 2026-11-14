"""Shared pointers, focus, and a note over one managed transports connection."""

import asyncio
from contextlib import asynccontextmanager, suppress

from pydantic import BaseModel
from spaday import Awareness, SetField, Wire, element, event_value
from spaday.backends.starlette import PageSpec, build_site
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from transports import WRITE, Hub, autosync, ws_endpoint

from spaday_collab import Pointers, package
from spaday_collab.gallery import STYLE


class Document(BaseModel):
    note: str = "Edit this note from either browser."


def page(user):
    return element(
        "main",
        element("h1", "Shared pointers and focus", **{"data-collab-text": "title"}),
        element("nav", element("a", "Alice", href="/"), element("a", "Bob", href="/bob")),
        element("p", f"Signed in as {user}. Open the other link in another browser to see their pointer."),
        element(
            "p",
            "Names and colors are example settings. Both users can edit; URL names are not authentication.",
            **{"data-collab-text": "identity-note"},
        ),
        element(
            "label",
            element("input", type="checkbox").bind("checked", "page_pointers", mode="two-way"),
            " Share my pointer across the page",
        ),
        element(
            "fieldset",
            element("legend", "Share my activity"),
            *[
                element("label", element("input", type="checkbox").bind("checked", key, mode="two-way"), label)
                for key, label in (
                    ("share_selection", " Page-text selections"),
                    ("share_focus", " Focus and textarea selections"),
                    ("share_clicks", " Click indicators"),
                    ("share_viewport", " Viewport position"),
                )
            ],
        ),
        element("p", id="viewport-activity").bind("textContent", "viewport_activity"),
        element(
            "p",
            "Outside the note and review section, pointers use relative viewport positions. "
            "Over those targets, they follow the same content in the other browser. "
            "Missing or off-screen targets are hidden. Select this text to highlight it in the other browser.",
            **{"data-collab-text": "pointer-help"},
        ),
        element(
            "label",
            "Shared note",
            element("span", id="note-focus", class_="focus-status", role="status").bind("textContent", "focus_note"),
            element(
                "div",
                element("textarea", **{"data-collab-target": "note", "aria-label": "Shared note"}).bind("value", "document.note", mode="two-way"),
                class_="note-editor",
            ),
        ),
        element(
            "section",
            element("h2", "Review", **{"data-collab-text": "review-heading"}),
            element("span", id="review-focus", class_="focus-status", role="status").bind("textContent", "focus_review"),
            element(
                "p",
                "Hover here to point out this section, select its text, or focus it with Tab to mark it for review.",
                **{"data-collab-text": "review-help"},
            ),
            tabindex=0,
            **{"data-collab-target": "review", "aria-label": "Review"},
        ),
        element(
            "p",
            "Focus and recent typing appear beside the target. Remote selections and carets appear inside the note. These indicators do not lock fields or grant editing access.",
            **{"data-collab-text": "activity-help"},
        ),
        element("p", "Connected: ", element("output").bind("textContent", "document.connected")),
        Pointers().bind("peers", "pointers").on("pointer-change", SetField("pointer", event_value("pointer"))),
    )


def create_app(*, codec="json"):
    hub = Hub(key=lambda connection: connection.query_params.get("user", "alice"))
    model = hub.share(Document())
    for user in ("alice", "bob"):
        hub.subscribe(user, model, WRITE)

    @asynccontextmanager
    async def lifespan(_app):
        task = asyncio.create_task(autosync(hub))
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    pages = {
        path: PageSpec(
            lambda user=user: page(user),
            packages=[package],
            title="Shared pointers and focus",
            styles=[
                STYLE
                + """
fieldset { margin-top:1rem; border:1px solid #344854; border-radius:.5rem; }
fieldset label { margin:.4rem 0; }
#viewport-activity { min-height:1.5em; color:#90c2ff; }
.click-marker { position:fixed; width:24px; height:24px; margin:-12px 0 0 -12px; border:3px solid; border-radius:50%; pointer-events:none; z-index:1001; animation:click-fade .8s linear forwards; }
@keyframes click-fade { to { opacity:0; } }
.note-editor { position:relative; margin-top:.5rem; }
.note-editor textarea { margin:0; }
.text-presence { position:absolute; overflow:hidden; pointer-events:none; }
.text-mirror { position:absolute; box-sizing:border-box; overflow-wrap:break-word; visibility:hidden; }
.text-selection,.text-caret { position:absolute; pointer-events:none; }
.text-selection { opacity:.25; }
.focus-status { display:block; min-height:1.5em; color:#90c2ff; font-size:.875rem; }
label:has(.focus-status:not(:empty)) textarea, section:has(.focus-status:not(:empty)) { outline:2px solid #90c2ff; outline-offset:3px; }
"""
            ],
            store={
                "name": user.title(),
                "color": color,
                "pointers": [],
                "page_pointers": True,
                "share_selection": True,
                "share_focus": True,
                "share_clicks": False,
                "share_viewport": False,
                "viewport_activity": "",
                "pointer": None,
                "focus_note": "",
                "focus_review": "",
            },
            scripts=["/components/collab/cdn/example.js"],
            wire=Wire(
                f"/ws?user={user}",
                model=model,
                namespace="document",
                codec=codec,
                reconnect=True,
                awareness={"pointers": Awareness(local="activity", peers="remote_activity")},
            ),
        )
        for path, user, color in (("/", "alice", "#f4a261"), ("/bob", "bob", "#90c2ff"))
    }
    return Starlette(routes=build_site(pages, routes=[WebSocketRoute("/ws", ws_endpoint(hub))]).all(), lifespan=lifespan)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(create_app(), host="127.0.0.1", port=8044)
