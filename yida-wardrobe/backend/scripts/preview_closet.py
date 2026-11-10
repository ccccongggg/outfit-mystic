#!/usr/bin/env python3
r"""把当前衣橱里的预置单品拼成一张总览图，用来目视检查落盘效果。

用法: python scripts/preview_closet.py [输出文件名]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_women_preview import _font  # noqa: E402

ITEMS = ROOT / "web" / "data" / "items.json"
CELL = 250
COLS = 4


def main() -> int:
    out = ROOT / "design" / "women-preview" / (sys.argv[1] if len(sys.argv) > 1 else "closet.jpg")
    items = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = [it for it in items if it.get("category")]
    rows = (len(items) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL, rows * CELL), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    font = _font(13)
    for i, it in enumerate(items):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        p = ROOT / "web" / Path(it["image"])
        if p.exists():
            with Image.open(p) as im:
                im = im.convert("RGB")
                im.thumbnail((CELL - 10, CELL - 34), Image.Resampling.LANCZOS)
            sheet.paste(im, (cx + (CELL - im.width) // 2, cy + 28 + (CELL - 34 - im.height) // 2))
        label = f"{it['id']} {it.get('color_name','')}·{it.get('type','')}"
        draw.rectangle([cx, cy, cx + CELL, cy + 24], fill=(28, 28, 26))
        draw.text((cx + 6, cy + 4), label, fill=(255, 255, 255), font=font)
        draw.rectangle([cx, cy, cx + CELL - 1, cy + CELL - 1], outline=(205, 205, 200))
    sheet.save(out, quality=92)
    print("saved", out, sheet.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
