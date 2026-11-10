#!/usr/bin/env python3
"""把源商品图统一成 800×800 白底商品卡；缺裤子则绘制同构图产品图。"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

try:
    import numpy as np
except ImportError:
    np = None

OUT = Path(__file__).resolve().parents[1] / "web" / "assets" / "items"
SIZE = 800
PAD = 0.10


def _alpha_crop(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    if np is None:
        return im
    arr = np.asarray(im)
    rgb = arr[:, :, :3]
    a = arr[:, :, 3].copy()
    white = (rgb[:, :, 0] > 242) & (rgb[:, :, 1] > 242) & (rgb[:, :, 2] > 242)
    a[white] = 0
    im.putalpha(Image.fromarray(a, mode="L"))
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def unify(src: Path, dest: Path) -> None:
    raw = Image.open(src)
    im = _alpha_crop(raw)

    margin = int(SIZE * PAD)
    inner = SIZE - margin * 2
    im.thumbnail((inner, inner), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    ox = (SIZE - im.width) // 2
    oy = (SIZE - im.height) // 2
    sw = int(im.width * 0.72)
    sh = max(10, int(im.height * 0.05))
    sx = (SIZE - sw) // 2
    sy = oy + im.height - sh // 3
    d.ellipse((sx, sy, sx + sw, sy + sh), fill=(43, 36, 48, 32))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas = Image.alpha_composite(shadow, canvas)
    canvas.alpha_composite(im, (ox, oy))
    canvas.convert("RGB").save(dest, quality=92)
    print("unified", dest.name)


def draw_pants(path: Path, fill: tuple, band: tuple) -> None:
    img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ds = ImageDraw.Draw(shadow)
    ds.ellipse((220, 620, 580, 690), fill=(43, 36, 48, 36))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    img = Image.alpha_composite(img, shadow)

    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top, crotch_y, bottom = 140, 360, 640
    cx = 400
    left = [
        (cx - 120, top), (cx - 10, top), (cx - 5, crotch_y),
        (cx - 70, bottom), (cx - 145, bottom), (cx - 155, crotch_y),
    ]
    right = [
        (cx + 10, top), (cx + 120, top), (cx + 155, crotch_y),
        (cx + 145, bottom), (cx + 70, bottom), (cx + 5, crotch_y),
    ]
    d.polygon(left, fill=fill, outline=band)
    d.polygon(right, fill=fill, outline=band)
    d.rectangle((cx - 125, top - 35, cx + 125, top), fill=band, outline=band)
    d.line((cx, top, cx, crotch_y), fill=band, width=2)
    img = Image.alpha_composite(img, layer)
    img.convert("RGB").save(path, quality=92)
    print("drawn", path.name)


# 源文件 → 最终文件
MAP = {
    "prod_tee_white.jpg": ["prod_tee_fs_white.jpg", "prod_tee_fs_w.jpg", "prod_tee_gray.jpg"],
    "prod_tee_black.jpg": ["prod_tee_fs_v.jpg"],
    "prod_shirt_blue.jpg": ["prod_shirt_sleeve.jpg", "prod_shirt_check.jpg"],
    "prod_shirt_plaid.jpg": ["prod_shirt_plaid.jpg"],
    "prod_sneaker_white.jpg": ["prod_sneaker_white.jpg", "prod_sneaker_puma.jpg"],
    "prod_sneaker_red.jpg": ["prod_sneaker_jordan.jpg"],
    "prod_jacket.jpg": ["prod_jacket.jpg", "prod_jacket_fs2.jpg"],
    "prod_dress_gray.jpg": ["prod_dress_gray.jpg", "prod_dress_blue.jpg", "prod_dress_summer.jpg"],
    "prod_shoes_heel.jpg": ["prod_shoes_heel.jpg"],
}

# 处理时写到 _out_，避免 src==dest 覆盖
for dest_name, src_names in MAP.items():
    src = next((OUT / s for s in src_names if (OUT / s).exists() and (OUT / s).stat().st_size > 1000), None)
    if not src:
        print("missing source for", dest_name)
        continue
    tmp = OUT / f"_out_{dest_name}"
    unify(src, tmp)
    tmp.replace(OUT / dest_name)

# 裤子补位（同构图）
draw_pants(OUT / "prod_jogger_gray.jpg", (168, 176, 184, 255), (120, 128, 138, 255))
draw_pants(OUT / "prod_short_olive.jpg", (120, 130, 78, 255), (88, 98, 56, 255))
draw_pants(OUT / "prod_jogger_red.jpg", (150, 50, 55, 255), (110, 35, 40, 255))

# 清理源文件与临时
keep = {
    "prod_tee_white.jpg", "prod_tee_black.jpg", "prod_shirt_blue.jpg", "prod_shirt_plaid.jpg",
    "prod_sneaker_white.jpg", "prod_sneaker_red.jpg", "prod_jacket.jpg", "prod_dress_gray.jpg",
    "prod_shoes_heel.jpg", "prod_jogger_gray.jpg", "prod_short_olive.jpg", "prod_jogger_red.jpg",
}
for p in OUT.iterdir():
    if p.is_file() and p.name not in keep:
        p.unlink()
        print("removed", p.name)

for p in sorted(OUT.iterdir()):
    im = Image.open(p)
    print("FINAL", p.name, im.size, p.stat().st_size)
