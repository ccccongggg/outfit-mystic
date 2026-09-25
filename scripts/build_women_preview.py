#!/usr/bin/env python3
r"""把「AI 生成的候选」和「挑好的真图候选」拼成对照图，供人选型。

输出（outfit-mystic/design/women-preview/）：
    ai_gen.jpg        6 张图生图结果（按件标注）
    ai_text.jpg       2 张文生图结果
    real_pick.jpg     6 件已挑好的真图候选
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def _font(size: int = 14):
    """对照图要写中文标签，Pillow 默认位图字体画中文会出方块，必须挂系统字体。"""
    for name in ("msyh.ttc", "msyhbd.ttc", "simhei.ttf", "simsun.ttc"):
        p = Path("C:/Windows/Fonts") / name
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()
AI = ROOT / "web" / "assets" / "items" / "_ai_women"
CAND = ROOT / "web" / "assets" / "items" / "_cand_women"
OUT = ROOT / "design" / "women-preview"

CELL = 300
COLS = 3

# 生成结果按时间戳显式认领：文件名含时间戳，避免顺序漂移导致标签错位
SLOTS: list[tuple[str, str, str]] = [
    # (时间戳片段, 分组, 标签)
    ("02-50-14", "gen", "图生图 · w0002 黑泡泡袖上衣"),
    ("02-51-48", "gen", "图生图 · w0011 卡其风衣"),
    ("02-51-21", "gen", "图生图 · w0006 灰阔腿裤"),
    ("02-55-31", "gen", "图生图 · w0007 橄榄绿百褶裙"),
    ("02-54-16", "gen", "图生图 · w0008 砖红A字裙"),
    ("02-52-03", "text", "文生图 · 黑泡泡袖上衣"),
    ("02-52-23", "text", "文生图 · 卡其风衣"),
    ("02-53-26", "text", "文生图 · 雾蓝衬衫"),
    ("02-53-46", "text", "文生图 · 棕格纹衬衫"),
    ("02-54-01", "text", "文生图 · 砖红A字裙"),
]


def tile(paths_labels: list[tuple[Path, str]], dst: Path) -> None:
    rows = (len(paths_labels) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL, rows * CELL), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    font = _font(14)
    for i, (p, label) in enumerate(paths_labels):
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        try:
            with Image.open(p) as im:
                im = im.convert("RGB")
                im.thumbnail((CELL - 10, CELL - 34), Image.Resampling.LANCZOS)
            sheet.paste(im, (cx + (CELL - im.width) // 2, cy + 30 + (CELL - 34 - im.height) // 2))
        except Exception as exc:  # noqa: BLE001
            print("skip", p, exc)
        draw.rectangle([cx, cy, cx + CELL, cy + 26], fill=(28, 28, 26))
        draw.text((cx + 8, cy + 5), label, fill=(255, 255, 255), font=font)
        draw.rectangle([cx, cy, cx + CELL - 1, cy + CELL - 1], outline=(205, 205, 200))
    sheet.save(dst, quality=92)
    print("saved", dst, sheet.size)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    # AI 结果：按时间戳认领「图生图」与「文生图」两组，一张图看完全部对比
    pngs = list(AI.glob("*.png"))
    for group, fname in (("gen", "ai_gen.jpg"), ("text", "ai_text.jpg")):
        pairs: list[tuple[Path, str]] = []
        for stamp, g, label in SLOTS:
            if g != group:
                continue
            hit = next((p for p in pngs if stamp in p.name), None)
            if hit:
                pairs.append((hit, label))
        if pairs:
            tile(pairs, OUT / fname)

    # 真图已挑候选
    picks = [("w0001", 2, "真图 · w0001 白真丝吊带"), ("w0005", 4, "真图 · w0005 白连衣裙"),
             ("w0009", 2, "真图 · w0009 米白乐福鞋"), ("w0010", 7, "真图 · w0010 红玛丽珍"),
             ("w0012", 7, "真图 · w0012 裸色细高跟")]
    items = []
    for sid, n, label in picks:
        p = CAND / sid / f"cand_{n}.jpg"
        if p.exists():
            items.append((p, label))
    if items:
        tile(items, OUT / "real_pick.jpg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
