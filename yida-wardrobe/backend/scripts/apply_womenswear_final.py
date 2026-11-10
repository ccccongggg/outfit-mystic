#!/usr/bin/env python3
r"""落盘女装化结果：把选定的真图 / 图生图整理成 800×800 白底方图，替换预置图并回填 items.json。

选型结论（用户 2026-09-25 拍板「先只落已确认的 10 件」）：
    真图 5 件   w0001 吊带 / w0005 连衣裙 / w0009 乐福鞋 / w0010 玛丽珍 / w0012 细高跟
    图生图 5 件 w0002 黑上衣 / w0006 阔腿裤 / w0007 百褶裙 / w0008 A字裙 / w0011 风衣
暂不动：w0003 雾蓝衬衫、w0004 格纹衬衫（保留原图，等后续定）。

用法：
    python scripts/apply_womenswear_final.py            # 落盘
    python scripts/apply_womenswear_final.py --dry      # 只打印将要做什么
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from pick_womenswear import recolor  # noqa: E402
from refresh_womenswear import (  # noqa: E402
    ASSETS, BACKUP, ITEMS_JSON, WOMEN, apply_tags, contain_white, to_white_square,
)

AI = ASSETS / "_ai_women"
CAND = ASSETS / "_cand_women"
REPORT = ROOT / "cache" / "find" / "women_apply_report.json"

# AI 图边缘的小字水印（"AI生成"）在右下角，落盘前按比例裁掉一圈
AI_TRIM = 0.06

# (item id, 源文件, 类型, 可选改色 (色名, hex))
FINAL: list[tuple[str, Path, str, tuple[str, str] | None]] = [
    # w0001 原真图候选是「白色吊带 + 浅灰底」，白底占比不足触发洪水抠底后留下白块残留，
    # 故改用图生图版（真实款式 + 纯白底，无残留）
    ("w0001", AI / "去掉画面中的人物和多余物品_只保留这件白色真丝_V_领细吊带_2026-09-25T02-58-42.png", "gen", None),
    ("w0005", CAND / "w0005" / "cand_4.jpg", "real", ("奶白", "#F1EEE8")),
    ("w0009", CAND / "w0009" / "cand_2.jpg", "real", None),
    ("w0010", CAND / "w0010" / "cand_7.jpg", "real", ("正红", "#C41E2A")),
    ("w0012", CAND / "w0012" / "cand_7.jpg", "real", None),
    ("w0002", AI / "去掉画面中的人物_只保留这件黑色荷叶边短袖雪纺上衣_改成电商_2026-09-25T02-50-14.png", "gen", None),
    ("w0006", AI / "去掉画面中的人物_包包和多余物品_只保留这条灰色高腰阔腿西装_2026-09-25T02-51-21.png", "gen", None),
    ("w0007", AI / "去掉画面中的人物和多余物品_只保留这条橄榄绿色高腰百褶半身裙_2026-09-25T02-55-31.png", "gen", None),
    ("w0008", AI / "去掉画面中的人物和多余物品_只保留这条砖红色_A_字半身裙__2026-09-25T02-54-16.png", "gen", None),
    ("w0011", AI / "去掉画面中的人物和多余物品_只保留这件卡其色中长款女式风衣__2026-09-25T02-51-48.png", "gen", None),
]


def trim_edges(src: Path, dst: Path, ratio: float = AI_TRIM) -> None:
    """裁掉四周一圈，去掉生成图的角标水印。"""
    from PIL import Image

    with Image.open(src) as im:
        im = im.convert("RGB")
        dx, dy = int(im.width * ratio), int(im.height * ratio)
        im = im.crop((dx, dy, im.width - dx, im.height - dy))
        im.save(dst, quality=95)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--only", default="", help="只重跑指定 id，逗号分隔")
    a = ap.parse_args()

    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    by_id = {it.get("id"): it for it in items}
    specs = {s["id"]: s for s in WOMEN}

    BACKUP.mkdir(parents=True, exist_ok=True)
    (CAND / "_final").mkdir(parents=True, exist_ok=True)
    report = []

    todo = FINAL
    if a.only:
        want = {s.strip() for s in a.only.split(",") if s.strip()}
        todo = [t for t in FINAL if t[0] in want]

    for item_id, src, kind, rec in todo:
        item = by_id.get(item_id)
        spec = specs.get(item_id)
        if not item or not spec:
            print(f"[{item_id}] 缺 item 或 spec，跳过")
            continue
        if not src.exists():
            print(f"[{item_id}] 源文件不存在：{src.name}")
            report.append({"id": item_id, "ok": False, "reason": "源文件缺失"})
            continue

        target = ASSETS / Path(item["image"]).name
        print(f"[{item_id}] {kind} {src.name[:46]}… → {target.name}")
        if a.dry:
            report.append({"id": item_id, "ok": True, "dry": True, "target": target.name})
            continue

        prepared = src
        if kind == "gen":
            prepared = CAND / "_final" / f"{item_id}_trim.jpg"
            trim_edges(src, prepared)

        tmp = CAND / "_final" / f"{item_id}_800.jpg"
        if kind == "gen":
            contain_white(prepared, tmp)      # 已是纯白底，直接 contain
            mode = "gen-trim"
        else:
            from find_product_image import white_ratio
            mode = to_white_square(prepared, tmp, white_ratio(prepared))

        if not (BACKUP / target.name).exists():
            shutil.copy2(target, BACKUP / target.name)
        shutil.copy2(tmp, target)

        apply_tags(item, spec)
        if rec:
            recolor(item, rec[0], rec[1])
            print(f"        色名 → {rec[0]} {rec[1]}")

        ITEMS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        report.append({"id": item_id, "ok": True, "kind": kind, "mode": mode,
                       "target": target.name, "recolor": list(rec) if rec else None})
        print(f"        ✓ {mode}")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = sum(1 for r in report if r.get("ok"))
    print(f"\n落盘 {ok}/{len(FINAL)}   报告：{REPORT}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
