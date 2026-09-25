#!/usr/bin/env python3
r"""把预置衣橱整体换成「女装」：联网找女装白底商品图 → 抠/白底 → 800x800 方图 → 回填 items.json。

设计原则：**保色换款** —— 只换款式与图片，color_name / color_hex / palette 一律不动。
这样塔罗/各入口的颜色约束、engine 的配色规则、既有打标缓存全部继续生效，改动面最小。

用法：
    python scripts/refresh_womenswear.py                 # 跑全部（联网 + VLM 复核，较慢）
    python scripts/refresh_womenswear.py --only w0001    # 只跑某几件（逗号分隔）
    python scripts/refresh_womenswear.py --dry           # 只检索不落盘，看命中质量

产物：
    web/assets/items/_cand_women/<id>/   候选图（可删）
    web/assets/items/_backup_unisex/     换下来的原图备份
    cache/find/women_report.json         每件的结果：用了哪张、VLM 怎么判、失败原因

失败不破坏现状：某件没找到可信图 → 保留原图原标签，报告里写明原因。
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
BACKUP = ASSETS / "_backup_unisex"
CAND = ASSETS / "_cand_women"
REPORT = ROOT / "cache" / "find" / "women_report.json"

SIZE = 800          # 与既有预置图一致的方图尺寸
WHITE_DIRECT = 0.5  # 四边白占比 ≥ 此值 → 认为已是白底图，直接 contain，不再抠

# ---------------------------------------------------------------- 女装化清单
# type 必须用 find_product_image.VERIFY_PROMPT 的枚举值，否则 VLM 复核会以「类型不符」否决。
# category 保持不变（engine 的槽位就是 top/bottom/shoes/outer）。
WOMEN: list[dict] = [
    {
        "id": "w0001", "category": "top", "type": "吊带",
        "query": "白色 真丝吊带 女 白底 商品图 平铺",
        "type_label": "真丝吊带", "fit": "合身", "pattern": "纯色",
        "season": ["春", "夏"], "style_tags": ["温柔", "甜美"], "formality": 2,
        "material": "真丝", "occasions": ["约会", "休闲"],
    },
    {
        "id": "w0002", "category": "top", "type": "短袖",
        "query": "黑色 泡泡袖 雪纺衫 女 白底 商品图",
        "type_label": "泡泡袖上衣", "fit": "合身", "pattern": "纯色",
        "season": ["春", "夏", "秋"], "style_tags": ["甜美", "通勤"], "formality": 3,
        "material": "雪纺", "occasions": ["约会", "通勤"],
    },
    {
        "id": "w0003", "category": "top", "type": "长袖",
        "query": "蓝色 长袖 衬衫 女 白底 商品图",
        "type_label": "雪纺衬衫", "fit": "合身", "pattern": "纯色",
        "season": ["春", "秋"], "style_tags": ["通勤", "简约"], "formality": 3,
        "material": "棉", "occasions": ["通勤", "休闲"],
    },
    {
        "id": "w0004", "category": "top", "type": "长袖",
        "query": "棕色 格纹 衬衫 女 长袖 白底 商品图",
        "type_label": "格纹衬衫", "fit": "宽松", "pattern": "格纹",
        "season": ["秋", "冬"], "style_tags": ["复古", "街头"], "formality": 2,
        "material": "棉", "occasions": ["休闲"],
    },
    {
        "id": "w0005", "category": "top", "type": "连衣裙",
        "query": "灰色 连衣裙 女 白底 商品图 平铺",
        "type_label": "连衣裙", "fit": "合身", "pattern": "纯色",
        "season": ["春", "夏"], "style_tags": ["简约", "温柔"], "formality": 2,
        "material": "其他", "occasions": ["通勤", "休闲"],
    },
    {
        "id": "w0006", "category": "bottom", "type": "长裤",
        "query": "灰色 阔腿裤 女 西装裤 白底 商品图",
        "type_label": "阔腿西装裤", "fit": "宽松", "pattern": "纯色",
        "season": ["春", "秋"], "style_tags": ["简约", "通勤"], "formality": 3,
        "material": "西装面料", "occasions": ["通勤", "休闲"],
    },
    {
        "id": "w0007", "category": "bottom", "type": "半身裙",
        "query": "军绿色 百褶 半身裙 女 白底 商品图",
        "type_label": "百褶半身裙", "fit": "合身", "pattern": "纯色",
        "season": ["春", "夏", "秋"], "style_tags": ["简约", "复古"], "formality": 2,
        "material": "棉", "occasions": ["休闲", "约会"],
    },
    {
        "id": "w0008", "category": "bottom", "type": "半身裙",
        "query": "砖红色 A字 半身裙 女 白底 商品图",
        "type_label": "A字半身裙", "fit": "合身", "pattern": "纯色",
        "season": ["春", "秋"], "style_tags": ["温柔", "复古"], "formality": 2,
        "material": "棉", "occasions": ["约会", "休闲"],
    },
    {
        "id": "w0009", "category": "shoes", "type": "鞋",
        "query": "米白色 乐福鞋 女 单鞋 白底 商品图",
        "type_label": "乐福鞋", "fit": "合身", "pattern": "纯色",
        "season": ["春", "夏", "秋"], "style_tags": ["简约", "通勤"], "formality": 2,
        "material": "皮革", "occasions": ["通勤", "休闲"],
    },
    {
        "id": "w0010", "category": "shoes", "type": "鞋",
        "query": "红色 玛丽珍鞋 女 单鞋 白底 商品图",
        "type_label": "玛丽珍鞋", "fit": "合身", "pattern": "纯色",
        "season": ["春", "秋"], "style_tags": ["甜美", "复古"], "formality": 2,
        "material": "皮革", "occasions": ["约会", "休闲"],
    },
    {
        "id": "w0011", "category": "outer", "type": "外套",
        "query": "卡其色 风衣 女 中长款 白底 商品图",
        "type_label": "风衣", "fit": "宽松", "pattern": "纯色",
        "season": ["秋", "冬"], "style_tags": ["通勤", "复古"], "formality": 3,
        "material": "棉", "occasions": ["通勤", "休闲"],
    },
    {
        "id": "w0012", "category": "shoes", "type": "鞋",
        "query": "卡其色 细跟 高跟鞋 女 白底 商品图",
        "type_label": "细跟高跟鞋", "fit": "合身", "pattern": "纯色",
        "season": ["春", "夏"], "style_tags": ["甜美", "通勤"], "formality": 3,
        "material": "皮革", "occasions": ["通勤", "正式"],
    },
]


# ---------------------------------------------------------------- 图像处理
def contain_white(src: Path, dst: Path, size: int = SIZE) -> None:
    """等比 contain 到 size×size 白底方图（与既有预置图一致的呈现方式）。"""
    from PIL import Image

    with Image.open(src) as im:
        im = im.convert("RGB")
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (size, size), (255, 255, 255))
        canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
        canvas.save(dst, quality=92)


def to_white_square(src: Path, dst: Path, white_ratio: float) -> str:
    """把候选图整理成 800×800 白底方图；返回采用的处理方式。"""
    from remove_bg import remove_bg_to

    if white_ratio >= WHITE_DIRECT:
        contain_white(src, dst)
        return "direct"

    tmp_png = dst.with_suffix(".cut.png")
    tmp_white = dst.with_suffix(".cut_white.jpg")
    try:
        if remove_bg_to(src, tmp_png, tmp_white) and tmp_white.exists():
            contain_white(tmp_white, dst)
            return "cut"
    except Exception as exc:  # noqa: BLE001
        print(f"  cut failed: {type(exc).__name__} {exc}", file=sys.stderr)
    contain_white(src, dst)
    return "passthrough"


# ---------------------------------------------------------------- 单件处理
def process(spec: dict, item: dict, limit: int, dry: bool) -> dict:
    from find_product_image import find

    item_id = spec["id"]
    outdir = CAND / item_id
    tags = {
        "category": spec["category"],
        "type": spec["type"],
        "color_name": item.get("color_name") or "",
        "require_womenswear": True,
    }

    res = find(tags=tags, query=spec["query"], limit=limit, outdir=outdir)
    report = {
        "id": item_id,
        "query": spec["query"],
        "ok": bool(res.get("ok")),
        "verified": bool(res.get("verified")),
        "source_url": res.get("source_url", ""),
        "white_ratio": res.get("white_ratio"),
        "vlm_reason": (res.get("vlm") or {}).get("reason", ""),
        "message": res.get("message", ""),
        "candidates": [
            {"url": c.get("source_url", ""), "white_ratio": c.get("white_ratio"),
             "vlm_ok": (c.get("vlm") or {}).get("ok"),
             "reason": (c.get("vlm") or {}).get("reason", "")}
            for c in (res.get("candidates") or [])
        ],
    }
    if not res.get("ok") or dry:
        return report

    src = Path(res["path"])
    target = ASSETS / Path(item["image"]).name
    BACKUP.mkdir(parents=True, exist_ok=True)
    if not (BACKUP / target.name).exists():
        shutil.copy2(target, BACKUP / target.name)

    tmp_out = CAND / item_id / "_final.jpg"
    mode = to_white_square(src, tmp_out, float(res.get("white_ratio") or 0))
    shutil.copy2(tmp_out, target)
    report["mode"] = mode
    report["target"] = str(target.relative_to(ROOT)).replace("\\", "/")
    return report


# ---------------------------------------------------------------- 标签回填
def apply_tags(item: dict, spec: dict) -> None:
    """只改款式相关字段；color_* / palette / id / image 一律不动。"""
    item["type"] = spec["type"]
    item["fit"] = spec["fit"]
    item["pattern"] = spec["pattern"]
    item["season"] = list(spec["season"])
    item["style_tags"] = list(spec["style_tags"])
    item["formality"] = spec["formality"]
    item["material"] = spec["material"]
    item["occasions"] = list(spec["occasions"])
    item["source"] = "ai"
    item["manual_override"] = False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="只跑指定 id，逗号分隔")
    ap.add_argument("--limit", type=int, default=8, help="每件下载候选数")
    ap.add_argument("--dry", action="store_true", help="只检索不落盘")
    a = ap.parse_args()

    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    by_id = {it.get("id"): it for it in items}
    specs = WOMEN
    if a.only:
        want = {s.strip() for s in a.only.split(",") if s.strip()}
        specs = [s for s in WOMEN if s["id"] in want]

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    reports: list[dict] = []
    for spec in specs:
        item = by_id.get(spec["id"])
        if not item:
            reports.append({"id": spec["id"], "ok": False, "message": "items.json 里没有这件"})
            continue
        print(f"[{spec['id']}] {item.get('color_name')} · {spec['type_label']} —— {spec['query']}", flush=True)
        rep = process(spec, item, a.limit, a.dry)
        reports.append(rep)
        if rep["ok"] and not a.dry:
            apply_tags(item, spec)
            ITEMS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  -> ok={rep['ok']} verified={rep.get('verified')} mode={rep.get('mode','-')} "
              f"white={rep.get('white_ratio')} {rep.get('vlm_reason') or rep.get('message','')}", flush=True)

    REPORT.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    done = sum(1 for r in reports if r.get("ok"))
    print(f"\n完成 {done}/{len(specs)}，报告：{REPORT}")
    return 0 if done else 1


if __name__ == "__main__":
    raise SystemExit(main())
