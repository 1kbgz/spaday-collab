import ast
from pathlib import Path

from spaday import SetField, event_value, generate
from spaday.bootstrap import bootstrap
from starlette.testclient import TestClient

from spaday_collab import TOKENS, Pointers, SpadayPointers, package
from spaday_collab.example import create_app
from spaday_collab.gallery import gallery

ROOT = Path(__file__).parents[1]


def test_pointer_state_serializes():
    pointer = {"target": "note", "x": 0.25, "y": 0.5}
    component = Pointers(peers=[{"peer": "a", "pointer": pointer, "label": "Alice"}])
    component.on("pointer-change", SetField("pointer", event_value("pointer")))
    node = component.to_node()
    assert Pointers is SpadayPointers
    assert node["tag"] == "spaday-pointers"
    assert node["props"]["peers"]["List"][0]["Map"]["pointer"]["Map"]["target"] == {"Str": "note"}
    assert "pointer-change" in str(node)


def test_generated_component_is_current():
    assert ast.dump(ast.parse(generate(str(ROOT / "components.cem.json")))) == ast.dump(ast.parse((ROOT / "components.py").read_text()))


def test_assets_and_tokens():
    html = bootstrap(packages=[package])
    assert "/components/collab/cdn/index.js" in html
    assert "/components/collab/css/index.css" in html
    for _, path in package.assets:
        assert (package.assets_dir / path).is_file()
    source = (ROOT.parent / "js/src/ts/index.ts").read_text()
    assert all(token.property in source for token in TOKENS.values())
    assert package.catalog[0].tag == "spaday-pointers"


def test_real_components_in_gallery():
    assert "spaday-pointers" in str(gallery().to_node())


def test_example_pages_and_assets():
    with TestClient(create_app()) as client:
        for path in ("/", "/bob", "/components/collab/cdn/index.js", "/components/collab/cdn/example.js"):
            response = client.get(path)
            assert response.status_code == 200
        assert "remote_activity" in client.get("/").text
