#!/usr/bin/env python3
r"""女装替换的「候选 → 人眼挑选 → 落盘」两段式工具。

为什么不用全自动：qwen-vl-max 对「浅色衣物在白底上」的颜色判定不可靠
（实测把白色真丝吊带判成黑色），作为硬闸门会大量误杀。所以把最终裁决交给人：
    collect  → 每件抓 6 张候选，拼成一张对照图（contact sheet，带编号）
    apply    → 按人选定的编号做白底处理、800×800、替换图 + 回填 items.json

用法：
    python scripts/pick_womenswear.py collect                 # 抓全部候选 + 拼图
    python scripts/pick_womenswear.py apply --choices w0001=2,w0002=5
    python scripts/pick_womenswear.py apply --choices w0001=2 --dry

产物：
    web/assets/items/_cand_women/<id>/cand_1..6.jpg   候选原图
    web/assets/items/_cand_women/<id>/sheet.jpg       对照图（编号 1-6）
    cache/find/women_candidates.json                  候选清单（含来源 URL / 白底占比）
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

ITEMS_JSON = ROOT / "web" / "data" / "items.json"
ASSETS = ROOT / "web" / "assets" / "items"
CAND = ASSETS / "_cand_women"
BACKUP = ASSETS / "_backup_unisex"
MANIFEST = ROOT / "cache" / "find" / "women_candidates.json"

SIZE = 800
THUMB = 212          # 对照图单格尺寸
COLS = 3             # 9 张候选 = 3×3 一张看完
PER_ITEM = 9         # 每件候选数量

from refresh_womenswear import WOMEN, apply_tags, contain_white, to_white_square  # noqa: E402


# ---------------------------------------------------------------- 检索
def queries_for(spec: dict) -> list[str]:
    """覆盖「平铺 / 挂拍 / 无模特 / 免抠素材」几种电商单品图拍法。

    实测：泛词（如「灰色 阔腿裤 女 白底」）在百度图片下几乎全是模特上身图，
    必须显式把「无模特 / 单品 / 平铺 / 免抠」写进查询词，才能把单品图捞上来。
    """
    base = spec["query"].replace(" 商品图", "")
    typ = spec.get("type_label") or ""
    color = spec.get("color_name") or ""
    return [
        base + " 白底 商品图",
        f"{color} {typ} 女 白底 无模特 单品图",
        f"{color} {typ} 女 平铺 白底 电商主图 单品",
        f"{color} 女装 {typ} 免抠 png 素材 白底",
        f"{typ} 女 挂拍 白底 单件",
        f"{color} {typ} 女 单品 白底 高清",
    ]


def collect_one(spec: dict, item: dict, need: int) -> dict:
    from find_product_image import BAD_DOMAINS, MIN_SIDE, _safe_url, download, search_hits, white_ratio
    from PIL import Image

    outdir = CAND / spec["id"]
    outdir.mkdir(parents=True, exist_ok=True)

    hits = search_hits(queries_for(spec), limit=20)
    picked: list[dict] = []
    seen_url: set[str] = set()
    idx = 0
    for hit in hits:
        if len(picked) >= need:
            break
        url = hit["image"]
        blob = (url + " " + hit.get("page", "")).lower()
        if url in seen_url or any(d in blob for d in BAD_DOMAINS):
            continue
        seen_url.add(url)
        idx += 1
        dest = outdir / f"cand_{idx}.jpg"
        if not download(url, dest):
            continue
        try:
            with Image.open(dest) as im:
                w, h = im.size
        except Exception:  # noqa: BLE001
            continue
        if min(w, h) < MIN_SIDE:
            continue
        picked.append({
            "n": len(picked) + 1,
            "file": str(dest.relative_to(ROOT)).replace("\\", "/"),
            "url": url,
            "page": hit.get("page", ""),
            "title": hit.get("title", ""),
            "width": w,
            "height": h,
            "white_ratio": round(white_ratio(dest), 3),
        })
        # 候选文件按最终编号重命名，保证编号与对照图一致
        final = outdir / f"cand_{len(picked)}.jpg"
        if final != dest:
            dest.replace(final)
            picked[-1]["file"] = str(final.relative_to(ROOT)).replace("\\", "/")

    if picked:
        make_sheet([Path(ROOT / p["file"]) for p in picked], outdir / "sheet.jpg")
    return {"id": spec["id"], "type_label": spec.get("type_label"), "color_name": item.get("color_name"),
            "candidates": picked}


def make_sheet(paths: list[Path], dst: Path) -> None:
    """把候选图拼成一张带编号的对照图，方便一次性目视比较。"""
    from PIL import Image, ImageDraw

    rows = (len(paths) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * THUMB, rows * THUMB), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(paths):
        try:
            with Image.open(p) as im:
                im = im.convert("RGB")
                im.thumbnail((THUMB - 8, THUMB - 8), Image.Resampling.LANCZOS)
        except Exception:  # noqa: BLE001
            continue
        cx, cy = (i % COLS) * THUMB, (i // COLS) * THUMB
        sheet.paste(im, (cx + (THUMB - im.width) // 2, cy + (THUMB - im.height) // 2))
        draw.rectangle([cx, cy, cx + 30, cy + 26], fill=(0, 0, 0))
        draw.text((cx + 10, cy + 7), str(i + 1), fill=(255, 255, 255))
        draw.rectangle([cx, cy, cx + THUMB - 1, cy + THUMB - 1], outline=(210, 210, 210))
    sheet.save(dst, quality=90)


# ---------------------------------------------------------------- 落盘
def recolor(item: dict, color_name: str, color_hex: str) -> None:
    """按最终选中的图改写色名/色值——找不到原色同款女装时，让标签跟着图走，保证图签一致。"""
    item["color_name"] = color_name
    item["color_hex"] = color_hex
    n = int(color_hex.lstrip("#"), 16)
    shade = "#" + "".join(f"{max(0, int(c * 0.9)):02X}" for c in ((n >> 16) & 255, (n >> 8) & 255, n & 255))
    item["palette"] = [color_hex, shade]


def apply_choices(choices: dict[str, int], dry: bool, recolor_map: dict[str, tuple[str, str]] | None = None) -> int:
    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    by_id = {it.get("id"): it for it in items}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    done = 0

    for sid, n in choices.items():
        spec = next((s for s in WOMEN if s["id"] == sid), None)
        item = by_id.get(sid)
        if not spec or not item:
            print(f"[{sid}] 未知 id，跳过")
            continue
        cands = (manifest.get(sid) or {}).get("candidates") or []
        cand = next((c for c in cands if c["n"] == n), None)
        if not cand:
            print(f"[{sid}] 没有候选 {n}，跳过")
            continue

        src = ROOT / cand["file"]
        target = ASSETS / Path(item["image"]).name
        print(f"[{sid}] 候选 {n} → {target.name}（白底占比 {cand['white_ratio']}）")
        if dry:
            done += 1
            continue

        BACKUP.mkdir(parents=True, exist_ok=True)
        if not (BACKUP / target.name).exists():
            shutil.copy2(target, BACKUP / target.name)
        tmp = CAND / sid / "_final.jpg"
        mode = to_white_square(src, tmp, float(cand.get("white_ratio") or 0))
        shutil.copy2(tmp, target)
        apply_tags(item, spec)
        if recolor_map and sid in recolor_map:
            cname, chex = recolor_map[sid]
            recolor(item, cname, chex)
            print(f"  ✓ 色名改为 {cname} {chex}")
        print(f"  ✓ 处理方式={mode}")
        done += 1

    if not dry and done:
        ITEMS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n落盘 {done}/{len(choices)}")
    return 0 if done else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["collect", "apply"])
    ap.add_argument("--only", default="")
    ap.add_argument("--choices", default="", help="形如 w0001=2,w0002=5")
    ap.add_argument("--recolor", default="", help="形如 w0005=奶白:#F2EFEA（改色名/色值）")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    by_id = {it.get("id"): it for it in items}

    if a.cmd == "collect":
        specs = WOMEN
        if a.only:
            want = {s.strip() for s in a.only.split(",") if s.strip()}
            specs = [s for s in WOMEN if s["id"] in want]
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
        for spec in specs:
            item = by_id.get(spec["id"])
            if not item:
                continue
            print(f"[{spec['id']}] {item.get('color_name')} · {spec.get('type_label')}", flush=True)
            got = collect_one(spec, item, PER_ITEM)
            manifest[spec["id"]] = got
            print(f"  候选 {len(got['candidates'])} 张 → {CAND / spec['id'] / 'sheet.jpg'}", flush=True)
            MANIFEST.parent.mkdir(parents=True, exist_ok=True)
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n对照图目录：{CAND}")
        return 0

    choices = {}
    for pair in a.choices.split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            choices[k.strip()] = int(v)
    if not choices:
        print("apply 需要 --choices，例如 --choices w0001=2,w0002=5")
        return 1

    recolor_map: dict[str, tuple[str, str]] = {}
    for pair in a.recolor.split(","):
        if "=" in pair and ":" in pair:
            k, v = pair.split("=", 1)
            cname, chex = v.split(":", 1)
            recolor_map[k.strip()] = (cname.strip(), chex.strip())
    return apply_choices(choices, a.dry, recolor_map)


if __name__ == "__main__":
    raise SystemExit(main())
