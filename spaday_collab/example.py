"""Shared pointers and a shared note over one managed transports connection."""

import asyncio
from contextlib import asynccontextmanager, suppress

from pydantic import BaseModel
from spaday import Awareness, SetField, Wire, element, event_value, field, obj
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
        element("h1", "Shared pointers"),
        element("nav", element("a", "Alice", href="/"), element("a", "Bob", href="/bob")),
        element("p", f"Signed in as {user}. Open the other link in another browser to see their pointer."),
        element("p", "Names and colors are example settings. Both users can edit; URL names are not authentication."),
        element(
            "label",
            element("input", type="checkbox").bind("checked", "page_pointers", mode="two-way"),
            " Share my pointer across the page",
        ),
        element(
            "p",
            "Outside the note and review section, pointers use relative viewport positions. "
            "Over those targets, they follow the same content in the other browser. "
            "Missing or off-screen targets are hidden.",
        ),
        element(
            "label",
            "Shared note",
            element("textarea", **{"data-collab-target": "note", "aria-label": "Shared note"}).bind("value", "document.note", mode="two-way"),
        ),
        element("section", element("h2", "Review"), element("p", "Hover here to point out this section."), **{"data-collab-target": "review"}),
        element("p", "Connected: ", element("output").bind("textContent", "document.connected")),
        Pointers()
        .bind("peers", "pointers")
        .on(
            "pointer-change",
            SetField(
                "activity",
                obj(
                    {
                        "pointer": event_value("pointer"),
                        "label": field("name"),
                        "color": field("color"),
                    }
                ),
            ),
        ),
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
            title="Shared pointers",
            styles=[STYLE],
            store={"name": user.title(), "color": color, "pointers": [], "page_pointers": True},
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
