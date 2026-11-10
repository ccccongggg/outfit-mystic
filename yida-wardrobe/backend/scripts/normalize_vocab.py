#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""normalize_vocab.py —— 按权威受控词表（8 风格 / 24 色 / 7 品类）归一化衣橱数据

为什么需要
----------
项目转女装后，标签有三套写法并存：英文打标词（soft / sweet / commute）、
中文口语词（温柔 / 柔白 / 浅蓝与米白）、以及类别复数（shoes）。
「同一个颜色在不同地方写两个名字，筛选就会出错」——所以先把数据归一，
再让前端统一从 vocab 取展示。

权威词表：frontend/data/vocab.json（8 风格 / 24 色 / 7 品类）
  · 与 outfit-mystic/web/vocab.js 同源，synonym_map 只做「收敛」，不发明新词。

本脚本**只读**源数据、**只写** .vocab.json 归一化副本，并打印未命中审查清单。
不覆盖 items.json / wardrobe-items.json —— 词表仍待 stlwitch 复核，确认后再 apply。

用法：
    python scripts/normalize_vocab.py                # 生成 + 打印报告
    python scripts/normalize_vocab.py --apply        # 归一化结果写回源文件（慎用）
"""
from __future__ import annotations

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # 易搭整合版1.0
VOCAB_JSON = os.path.join(ROOT, "frontend", "data", "vocab.json")

TARGETS = [
    # (源文件, 归一化输出, id 字段名)
    ("backend/data/items.json", "backend/data/items.vocab.json", "id"),
    ("frontend/data/wardrobe-items.json", "frontend/data/wardrobe-items.vocab.json", "item_id"),
]


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


class Vocab:
    def __init__(self, data: dict):
        self.styles = set(data.get("styles", []))
        self.colors = set(data.get("colors", []))
        self.cats = {c["k"] for c in data.get("categories", [])}
        self.style_syn = data.get("style_synonyms", {})
        self.cat_syn = data.get("category_synonyms", {})
        # color_rules 按 from 长度倒序，保证「米白拼黑」不被「米白」抢走
        self.color_rules = sorted(data.get("color_rules", []), key=lambda p: -len(p[0]))

    def style(self, raw):
        """风格归一：原值若已在受控表内直接通过；否则查 synonym_map。"""
        s = str(raw or "").strip()
        if not s:
            return None
        if s in self.styles:
            return s
        return self.style_syn.get(s)  # 未命中返回 None → 进审查清单

    def color(self, raw):
        """颜色归一：受控 24 色直接通过；否则按 color_rules 做子串收敛。"""
        s = str(raw or "").strip()
        if not s:
            return None
        if s in self.colors:
            return s
        for frm, to in self.color_rules:
            if frm in s:
                return to
        return None  # 未命中 → 进审查清单

    def category(self, raw):
        s = str(raw or "").strip()
        if not s:
            return None
        if s in self.cats:
            return s
        return self.cat_syn.get(s)  # shoes→shoe；未命中返回 None


def iter_style_fields(item):
    """一件单品里所有出现风格标签的字段（原始不动的结构）。"""
    out = []
    for key in ("style_tags", "style_tags_cn"):
        if isinstance(item.get(key), list):
            out.append((key, item[key]))
    vt = item.get("visible_traits") or {}
    if isinstance(vt.get("style_tags"), list):
        out.append(("visible_traits.style_tags", vt["style_tags"]))
    return out


def normalize_item(item, v: Vocab, report: dict, path: str):
    iid = str(item.get("id") or item.get("item_id") or "?")
    changed = False

    # ---- 风格 ----
    for key, tags in iter_style_fields(item):
        new_tags, misses = [], []
        for t in tags:
            hit = v.style(t)
            if hit:
                new_tags.append(hit)
            else:
                new_tags.append(str(t))
                misses.append(str(t))
        # 去重但保持顺序
        dedup = list(dict.fromkeys(new_tags))
        if dedup != tags:
            if key == "visible_traits.style_tags":
                item["visible_traits"]["style_tags"] = dedup
            else:
                item[key] = dedup
            changed = True
        for m in misses:
            report["style"].append(f"{os.path.basename(path)}#{iid}: {m}")

    # ---- 颜色 ----
    raw_cn = item.get("color_name")
    if raw_cn:
        hit = v.color(raw_cn)
        if hit and hit != raw_cn:
            item["color_name"] = hit
            changed = True
        elif not hit:
            report["color"].append(f"{os.path.basename(path)}#{iid}: {raw_cn}")

    # ---- 品类 ----
    raw_cat = item.get("category")
    if raw_cat:
        hit = v.category(raw_cat)
        if hit and hit != raw_cat:
            item["category"] = hit
            changed = True
        elif not hit:
            report["category"].append(f"{os.path.basename(path)}#{iid}: {raw_cat}")

    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="把归一化结果写回源文件（默认只写 .vocab.json 副本）")
    args = ap.parse_args()

    vdata = load_json(VOCAB_JSON)
    if not vdata:
        print("找不到权威词表 frontend/data/vocab.json", file=sys.stderr)
        return 2
    v = Vocab(vdata)
    print(f"权威词表 {vdata.get('version')}: "
          f"{len(v.styles)} 风格 / {len(v.colors)} 色 / {len(v.cats)} 品类\n")

    report = {"style": [], "color": [], "category": []}
    total_changed = 0

    for rel, out_rel, _id in TARGETS:
        src = os.path.join(ROOT, rel)
        items = load_json(src, None)
        if items is None:
            print(f"  [skip] {rel} 不存在")
            continue
        if isinstance(items, dict):
            items = items.get("items", [])
        changed = sum(1 for it in items if isinstance(it, dict) and normalize_item(it, v, report, rel))
        total_changed += changed

        if args.apply:
            save_json(src, items)
            dest = rel
        else:
            save_json(os.path.join(ROOT, out_rel), items)
            dest = out_rel
        print(f"  {rel}: {len(items)} 件，{changed} 件需归一化 → {dest}")

    print("\n=== 未命中词表审查清单（需人工确认） ===")
    labels = {"style": "风格", "color": "颜色", "category": "品类"}
    total_miss = 0
    for key in ("style", "color", "category"):
        misses = report[key]
        uniq = sorted(set(misses))
        total_miss += len(uniq)
        print(f"\n[{labels[key]}] 未命中 {len(uniq)} 个唯一值")
        for u in uniq:
            cnt = misses.count(u)
            print(f"   - {u}  (×{cnt})")

    print(f"\n共 {total_miss} 个未命中唯一值；{total_changed} 件单品被归一化。")
    if not args.apply:
        print("（默认未覆盖源文件；确认词表与审查清单后，用 --apply 写回）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
