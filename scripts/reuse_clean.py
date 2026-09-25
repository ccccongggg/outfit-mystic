"""reuse_clean.py —— 复用现有 12 张干净 prod_* 图,用不同风格标签补到 30+ 件。

前提:prod_* 全是干净白底商品图(原始 12 件就靠它们入库的)。
做法:挑 6 张,每张建 1 个新 id,指向相同 image,但 style_tags/occasions 不同
      —— 这样覆盖了「文艺/明艳/慵懒/运动」风格缺口,不需要再下载新图。
诚实:不是新单品,是同款的不同「搭法建议」;同 image 不同 id 在推荐时
      引擎会按风格偏好选不同件,达成「风格相近的不同方案」。
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("e:/Xian_open_Hacthon/outfit-mystic").resolve()
ITEMS_JSON = ROOT / "web" / "data" / "items.json"

# (原 prod_id, 新 id, 新 style_tags, 新 occasions)
VARIANTS = [
    ("w0001", "w9701", ["文艺", "温柔"], ["约会", "通勤"]),  # 柔白吊带
    ("w0003", "w9702", ["文艺", "简约"], ["通勤", "休闲"]),  # 雾蓝短袖
    ("w0007", "w9703", ["文艺", "复古"], ["约会", "休闲"]),  # 橄榄绿半身裙
    ("w0011", "w9704", ["慵懒", "通勤"], ["休闲", "通勤"]),  # 卡其外套
    ("w0010", "w9705", ["明艳", "甜美"], ["约会", "聚会"]),  # 正红鞋
    ("w0009", "w9706", ["运动", "通勤"], ["通勤", "休闲"]),  # 米白运动鞋
    ("w0008", "w9707", ["复古", "温柔"], ["约会", "通勤"]),  # 砖红半身裙
]


def main():
    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    by_id = {i["id"]: i for i in items}
    print(f"[start] {len(items)} 件")

    added = []
    for src_id, new_id, style, occ in VARIANTS:
        if new_id in by_id:
            print(f"  skip {new_id}: 已存在")
            continue
        src = by_id.get(src_id)
        if not src:
            print(f"  ✗ {src_id} 不存在")
            continue
        new_item = dict(src)  # 深拷贝
        new_item["id"] = new_id
        new_item["style_tags"] = style
        new_item["occasions"] = occ
        new_item["manual_override"] = True
        items.append(new_item)
        added.append((new_id, src_id, style, src.get("color_name")))
        print(f"  ✓ {new_id} ← {src_id} [{','.join(style)}/{src.get('color_name')}]")

    ITEMS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[done] 现在 {len(items)} 件 (新增 {len(added)})")

    r = subprocess.run([sys.executable, "scripts/build_offline_data.py"],
                       cwd=str(ROOT), capture_output=True, text=True)
    print("[offline]", r.stdout.strip())


if __name__ == "__main__":
    main()