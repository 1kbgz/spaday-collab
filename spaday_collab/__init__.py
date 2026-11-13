from pathlib import Path

from spaday import ComponentPackage, Token

from .components import SpadayPointers

__version__ = "0.1.0"
Pointers = SpadayPointers
package = ComponentPackage(
    name="collab",
    assets_dir=Path(__file__).parent / "extension",
    assets=(("css", "css/index.css"), ("js", "cdn/index.js")),
    components=(SpadayPointers,),
)
TOKENS = {
    "spa_collab_accent": Token("--spa-collab-accent", "default pointer color", fallback="--spa-accent"),
    "spa_collab_label_text": Token("--spa-collab-label-text", "pointer label text", fallback="--spa-text"),
    "spa_collab_z_index": Token("--spa-collab-z-index", "pointer overlay stacking order"),
}
__all__ = ["TOKENS", "Pointers", "SpadayPointers", "package"]
