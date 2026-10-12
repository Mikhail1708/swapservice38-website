"""Build checked-in responsive Hero assets; never modifies the original photos.

Development-only requirement: Pillow 12.2.0 (with WebP support).
Run from any directory: python frontend/scripts/build-hero-images.py
No Python/image library is required to build or run the website afterwards.
When adding an original, rerun this script and commit the WebP files and manifest.
"""

import json
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageOps


FRONTEND = Path(__file__).resolve().parents[1]
IMAGES = FRONTEND / "public" / "images"
OUTPUT = IMAGES / "hero" / "optimized"
MANIFEST = FRONTEND / "src" / "lib" / "hero-image-assets.json"
SOURCES = [
    "hero-suv4.png", "swap1.png", "swap2.png", "swap3.png", "swap4.png",
    "hero-suv2.png", "tunning1.png", "tunning2.png", "tunning3.png", "tunning4.png",
    "hero-suv3.png", "proizvodstvo.png",
    "hero-suv1.png", "service1.png", "service2.png", "service3.png",
    "hero-suv5.png", "dorozh1.png", "dorozh2.png", "dorozh3.png",
]


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    total = 0
    for name in SOURCES:
        # New uploads may live in hero/; existing originals stay where they are.
        candidates = [IMAGES / name] if name.startswith("hero-suv") else [IMAGES / "hero" / name, IMAGES / name]
        if name == "tunning2.png":
            candidates.append(IMAGES / "tunning 2.png")
        original = next((path for path in candidates if path.is_file()), None)
        if original is None:
            print(f"Missing: {name}; runtime uses the theme's existing photo.")
            continue
        with Image.open(original) as source:
            photo = ImageOps.exif_transpose(source).convert("RGB")
            width, height = photo.size
            widths = sorted({min(target, width) for target in (640, 1280, 1920, 2560)})
            variants = []
            for target in widths:
                resized = photo.resize((target, round(height * target / width)), Image.Resampling.LANCZOS)
                filename = f"{Path(name).stem}-{target}.webp"
                destination = OUTPUT / filename
                resized.save(destination, "WEBP", quality=82, method=6)
                total += destination.stat().st_size
                variants.append(f"/images/hero/optimized/{filename} {target}w")
            original_url = "/images/" + quote(original.relative_to(IMAGES).as_posix())
            manifest[original_url] = {"srcSet": ", ".join(variants), "width": width, "height": height}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(manifest)} image families; combined WebP size: {total:,} bytes")


if __name__ == "__main__":
    build()
