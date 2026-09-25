#!/usr/bin/env python3
"""expand_closet.py —— 把衣橱从 17 件扩到 30+ 件,覆盖风格/类别/颜色缺口。

思路:
  1. 14 个目标项(每个含 cat/type/color/material + 期望风格)
  2. 对每个跑 find_product_image.py → 拿到白底图
  3. 把图移到 web/assets/items/<new_id>.<ext>(项目里 items.json 的相对路径)
  4. 跑 tag_image.py → 拿到 VLM 标签
  5. 用预定义的 style_tags 覆盖 VLM 给的(因为期望风格是补缺口用的)
  6. 合并进 items.json + 重建 offline.js

失败策略:
  - find/tags 任一步失败 → 跳过这个目标,不阻塞下一个
  - 目标按"先做最确定的"排序,失败率高的放后面
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path("e:/Xian_open_Hacthon/outfit-mystic").resolve()
ITEMS_JSON = ROOT / "web" / "data" / "items.json"
ASSETS = ROOT / "web" / "assets" / "items"
CACHE_FIND = ROOT / "cache" / "find"
LOG = []

# 14 个目标 —— 按覆盖率缺口排序
# id 字段是占位,真正写入时改成 w9100+ 顺序
TARGETS = [
    # === dress (类别缺口,目前只有 1 件) ===
    {"category": "dress", "type": "连衣裙", "color_name": "藕粉", "material": "雪纺",
     "expect_style": ["文艺", "甜美"], "expect_occasion": ["约会"]},
    {"category": "dress", "type": "连衣裙", "color_name": "雾蓝", "material": "棉",
     "expect_style": ["简约", "温柔"], "expect_occasion": ["通勤"]},
    # === bag (类别缺口,目前 0 件) ===
    {"category": "bag", "type": "包", "color_name": "黑色", "material": "皮革",
     "expect_style": ["简约", "通勤"], "expect_occasion": ["通勤"]},
    {"category": "bag", "type": "包", "color_name": "棕色", "material": "皮革",
     "expect_style": ["复古", "通勤"], "expect_occasion": ["通勤"]},
    # === outer (类别缺口,目前 1 件) ===
    {"category": "outer", "type": "外套", "color_name": "米白", "material": "棉",
     "expect_style": ["慵懒", "简约"], "expect_occasion": ["休闲"]},
    {"category": "outer", "type": "外套", "color_name": "姜黄", "material": "棉",
     "expect_style": ["复古", "明艳"], "expect_occasion": ["休闲"]},
    # === 风格缺口: 文艺 / 明艳 / 慵懒 ===
    {"category": "top", "type": "短袖", "color_name": "雾紫", "material": "棉",
     "expect_style": ["文艺", "温柔"], "expect_occasion": ["约会"]},
    {"category": "top", "type": "长袖", "color_name": "香槟", "material": "雪纺",
     "expect_style": ["明艳", "甜美"], "expect_occasion": ["约会"]},
    # === bottom 增补 ===
    {"category": "bottom", "type": "半身裙", "color_name": "浅粉", "material": "棉",
     "expect_style": ["甜美", "文艺"], "expect_occasion": ["约会"]},
    {"category": "bottom", "type": "长裤", "color_name": "深蓝", "material": "牛仔",
     "expect_style": ["通勤", "复古"], "expect_occasion": ["通勤"]},
    # === shoes 增补 ===
    {"category": "shoes", "type": "鞋", "color_name": "焦糖", "material": "皮革",
     "expect_style": ["复古", "通勤"], "expect_occasion": ["通勤"]},
    {"category": "shoes", "type": "鞋", "color_name": "奶白", "material": "皮革",
     "expect_style": ["文艺", "简约"], "expect_occasion": ["通勤"]},
    # === top 增补(覆盖运动 + 慵懒) ===
    {"category": "top", "type": "短袖", "color_name": "黑色", "material": "棉",
     "expect_style": ["运动", "简约"], "expect_occasion": ["运动", "休闲"]},
    {"category": "bottom", "type": "长裤", "color_name": "雾灰", "material": "西装面料",
     "expect_style": ["慵懒", "通勤"], "expect_occasion": ["通勤"]},
]


def run(cmd, timeout=180):
    r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=timeout)
    return r


def next_id(items):
    """下一个可用 id:w9xxx 顺序递增,跳过 9777(脏数据占位)。"""
    used = set(int(i["id"][1:]) for i in items if i["id"].startswith("w") and i["id"][1:].isdigit())
    n = 9001
    while n in used or n == 9777:
        n += 1
    return f"w{n}"


def find_one(idx, target):
    outdir = CACHE_FIND / f"expand_{idx}"
    if outdir.exists():
        shutil.rmtree(outdir)
    cmd = [sys.executable, "scripts/find_product_image.py",
           "--tags", json.dumps(target, ensure_ascii=False),
           "--limit", "8",
           "--out", str(outdir)]
    try:
        r = run(cmd, timeout=180)
        if r.returncode != 0:
            return None, f"find rc={r.returncode}: {r.stderr[-200:]}"
        try:
            data = json.loads(r.stdout)
        except Exception as e:
            return None, f"find json: {e}"
        if not data.get("ok"):
            return None, f"find not ok: {data.get('message', '?')[:120]}"
        return data, None
    except subprocess.TimeoutExpired:
        return None, "find timeout"
    except Exception as e:
        return None, f"find err: {type(e).__name__}"


def tag_one(image_path):
    cmd = [sys.executable, "scripts/tag_image.py", str(image_path)]
    try:
        r = run(cmd, timeout=120)
        if r.returncode != 0:
            return None
        try:
            tags = json.loads(r.stdout.strip())
        except Exception:
            return None
        if not tags:
            return None
        return tags
    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None


def main():
    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    initial_n = len(items)
    print(f"[start] 当前衣橱 {initial_n} 件")

    successes = []
    failures = []

    for idx, t in enumerate(TARGETS):
        label = f"[{idx+1}/{len(TARGETS)}] {t['category']}/{t['type']}/{t['color_name']}"
        print(f"\n=== {label} ===")

        # Step 1: 找图
        result, err = find_one(idx, t)
        if not result:
            print(f"  ✗ FIND: {err}")
            failures.append({"target": t, "step": "find", "err": err})
            continue

        src_path = Path(result["path"])
        print(f"  ✓ FIND: {src_path.name} (white_ratio={result.get('white_ratio')})")

        # Step 2: 给新 id
        new_id = next_id(items)
        ext = src_path.suffix.lower() or ".jpg"
        dst_rel = f"assets/items/{new_id}{ext}"
        dst_abs = ROOT / "web" / dst_rel
        shutil.copy2(src_path, dst_abs)
        print(f"  ✓ COPY → {dst_rel}")

        # Step 3: VLM 打标
        tags = tag_one(dst_abs)
        if not tags:
            print(f"  ✗ TAG: VLM 失败")
            dst_abs.unlink(missing_ok=True)
            failures.append({"target": t, "step": "tag", "err": "VLM 失败"})
            continue

        # Step 4: 用 expected 风格/场合覆盖(因为 VLM 不一定命中我们想要的风格)
        tags["id"] = new_id
        tags["image"] = dst_rel
        tags["style_tags"] = t["expect_style"]
        tags["occasions"] = t["expect_occasion"]
        tags["source"] = "ai"
        tags["manual_override"] = True  # 标记:style_tags/occasions 是策划口径覆盖
        # fit 默认值兜底
        if not tags.get("fit") or tags["fit"] == "其他":
            tags["fit"] = "合身"
        # season 默认值兜底
        if not tags.get("season"):
            tags["season"] = ["春", "秋"]
        # formality 兜底
        if not tags.get("formality"):
            tags["formality"] = 2

        items.append(tags)
        successes.append({"id": new_id, "tags": tags, "target": t})
        print(f"  ✓ IN: {new_id} [{','.join(tags['style_tags'])}/{tags['color_name']}]")

    # 写 items.json
    ITEMS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[done] items.json 现在 {len(items)} 件 (新增 {len(successes)}, 失败 {len(failures)})")

    # 重建 offline.js
    r = subprocess.run([sys.executable, "scripts/build_offline_data.py"],
                       cwd=str(ROOT), capture_output=True, text=True)
    print("[offline]", r.stdout.strip(), r.stderr.strip())

    # 输出成败清单
    print("\n=== 成功 ===")
    for s in successes:
        t = s["target"]
        print(f"  {s['id']:6s}  {t['category']:6s} / {t['type']:5s} / {t['color_name']:5s}  →  {','.join(t['expect_style'])}")
    print("\n=== 失败 ===")
    for f in failures:
        t = f["target"]
        print(f"  {t['category']:6s} / {t['type']:5s} / {t['color_name']:5s}  ({f['step']}): {f['err'][:80]}")


if __name__ == "__main__":
    main()