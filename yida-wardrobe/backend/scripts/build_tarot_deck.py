#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_tarot_deck.py —— 生成/刷新 22 张大阿尔卡纳（tarot.json + SVG 牌面）

单一真相源是本文件顶部的 CARDS 内容表。改文案 / 改配色只改这里，然后：

    python scripts/build_tarot_deck.py

会重写：
  web/data/tarot.json          （引擎与 UI 读的约束表）
  web/assets/tarot/*.svg       （牌面图，风格对齐已有 star/moon/sun/hermit）
并顺手跑 build_offline_data.py 刷新 file:// 离线快照。

取值约束（与 web/vocab.js 对齐，别写表外词）：
  style_tags ⊆ 简约|通勤|文艺|甜美|运动|复古|明艳|慵懒
              （也允许别名：极简→简约、温柔→文艺、街头→运动）
  must/avoid_colors 优先用受控 24 色；宽口径子串（白/米/蓝…）引擎 colorHit 也认。
"""
from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "web", "data")
TAROT_DIR = os.path.join(ROOT, "web", "assets", "tarot")

# 牌面底色 / 描边 / 符号色：按牌意微调，保持同一套「夜幕紫 + 星金」气质
# (outer, inner, stroke, glyph, text)
THEMES = {
    "dawn": ("#2B2430", "#1E1A24", "#C4B0D9", "#F7F2EA", "#C4B0D9"),
    "night": ("#1A2230", "#121822", "#8B9BB4", "#E8EDF5", "#8B9BB4"),
    "gold": ("#2A2418", "#1C1810", "#C9A86A", "#F3E6C8", "#C9A86A"),
    "rose": ("#2A1C24", "#1C1218", "#C48BA0", "#F5E4EB", "#C48BA0"),
    "forest": ("#1A2820", "#101814", "#8BB49A", "#E4F0E8", "#8BB49A"),
    "violet": ("#221A38", "#161028", "#A890D4", "#EDE6F8", "#A890D4"),
}

# 22 张大阿尔卡纳。字段与旧 tarot.json 同构；style/colors 取值见文件头。
CARDS = [
    {
        "id": "tarot_fool",
        "name": "愚者",
        "name_en": "The Fool",
        "image": "assets/tarot/fool.svg",
        "theme": "dawn",
        "glyph": "feather",
        "style_tags": ["慵懒", "运动"],
        "must_colors": ["米白", "亮黄", "浅蓝", "白"],
        "avoid_colors": [],
        "season": ["春", "夏"],
        "vibe": "free / light",
        "story": "愚者正位：轻装上阵，今天不必把所有事都想清楚",
    },
    {
        "id": "tarot_magician",
        "name": "魔术师",
        "name_en": "The Magician",
        "image": "assets/tarot/magician.svg",
        "theme": "gold",
        "glyph": "wand",
        "style_tags": ["明艳", "通勤"],
        "must_colors": ["正红", "亮黄", "纯白", "焦糖"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "focus / spark",
        "story": "魔术师正位：你手里的牌够用，穿得像今天能成事",
    },
    {
        "id": "tarot_priestess",
        "name": "女祭司",
        "name_en": "The High Priestess",
        "image": "assets/tarot/priestess.svg",
        "theme": "night",
        "glyph": "moon",
        "style_tags": ["文艺", "简约"],
        "must_colors": ["雾紫", "银灰", "藏蓝", "纯白"],
        "avoid_colors": ["正红"],
        "season": ["秋", "冬"],
        "vibe": "inner / quiet",
        "story": "女祭司正位：先听自己的，穿得沉一点没关系",
    },
    {
        "id": "tarot_empress",
        "name": "皇后",
        "name_en": "The Empress",
        "image": "assets/tarot/empress.svg",
        "theme": "rose",
        "glyph": "heart",
        "style_tags": ["甜美", "文艺"],
        "must_colors": ["藕粉", "玫粉", "奶油白", "米色"],
        "avoid_colors": [],
        "season": ["春", "夏"],
        "vibe": "soft / abundant",
        "story": "皇后正位：今天值得被好好对待，挑柔软的那件",
    },
    {
        "id": "tarot_emperor",
        "name": "皇帝",
        "name_en": "The Emperor",
        "image": "assets/tarot/emperor.svg",
        "theme": "gold",
        "glyph": "crown",
        "style_tags": ["通勤", "简约"],
        "must_colors": ["炭灰", "藏蓝", "纯黑", "驼色"],
        "avoid_colors": ["亮黄"],
        "season": ["秋", "冬"],
        "vibe": "steady / solid",
        "story": "皇帝正位：把边界立住，穿得干净利落就好",
    },
    {
        "id": "tarot_hierophant",
        "name": "教皇",
        "name_en": "The Hierophant",
        "image": "assets/tarot/hierophant.svg",
        "theme": "violet",
        "glyph": "key",
        "style_tags": ["通勤", "复古"],
        "must_colors": ["米白", "驼色", "藏蓝", "卡其"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "classic / trusted",
        "story": "教皇正位：按你自己认的那套规矩穿，不会错",
    },
    {
        "id": "tarot_lovers",
        "name": "恋人",
        "name_en": "The Lovers",
        "image": "assets/tarot/lovers.svg",
        "theme": "rose",
        "glyph": "heart",
        "style_tags": ["甜美", "文艺"],
        "must_colors": ["藕粉", "奶油白", "浅蓝", "玫粉"],
        "avoid_colors": ["纯黑"],
        "season": ["春", "夏"],
        "vibe": "warm / open",
        "story": "恋人正位：今天适合穿得让人想靠近",
    },
    {
        "id": "tarot_chariot",
        "name": "战车",
        "name_en": "The Chariot",
        "image": "assets/tarot/chariot.svg",
        "theme": "night",
        "glyph": "shield",
        "style_tags": ["运动", "明艳"],
        "must_colors": ["藏蓝", "正红", "纯白", "牛仔蓝"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "drive / bold",
        "story": "战车正位：目标在前，穿得利落好赶路",
    },
    {
        "id": "tarot_strength",
        "name": "力量",
        "name_en": "Strength",
        "image": "assets/tarot/strength.svg",
        "theme": "gold",
        "glyph": "flame",
        "style_tags": ["运动", "简约"],
        "must_colors": ["砖红", "焦糖", "米白", "驼色"],
        "avoid_colors": [],
        "season": ["秋", "冬"],
        "vibe": "warm / steady",
        "story": "力量正位：温柔也是力气，选一件撑得住场面的",
    },
    {
        "id": "tarot_hermit",
        "name": "隐者",
        "name_en": "The Hermit",
        "image": "assets/tarot/hermit.svg",
        "theme": "night",
        "glyph": "lantern",
        "style_tags": ["极简", "通勤"],
        "must_colors": ["灰", "棕", "卡其"],
        "avoid_colors": [],
        "season": ["秋", "冬"],
        "vibe": "quiet / focused",
        "story": "隐者正位：把世界调成静音，选一身不吵的衣服",
    },
    {
        "id": "tarot_wheel",
        "name": "命运之轮",
        "name_en": "Wheel of Fortune",
        "image": "assets/tarot/wheel.svg",
        "theme": "violet",
        "glyph": "wheel",
        "style_tags": ["复古", "明艳"],
        "must_colors": ["雾紫", "亮黄", "玫粉", "焦糖"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "turn / chance",
        "story": "命运之轮正位：节奏会变，穿好走路的那身",
    },
    {
        "id": "tarot_justice",
        "name": "正义",
        "name_en": "Justice",
        "image": "assets/tarot/justice.svg",
        "theme": "night",
        "glyph": "scale",
        "style_tags": ["简约", "通勤"],
        "must_colors": ["纯白", "炭灰", "藏蓝", "银灰"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "clear / fair",
        "story": "正义正位：干净对称一点，心里会更稳",
    },
    {
        "id": "tarot_hanged",
        "name": "倒吊人",
        "name_en": "The Hanged Man",
        "image": "assets/tarot/hanged.svg",
        "theme": "night",
        "glyph": "spiral",
        "style_tags": ["慵懒", "文艺"],
        "must_colors": ["浅蓝", "银灰", "雾紫", "米白"],
        "avoid_colors": ["正红"],
        "season": ["春", "秋"],
        "vibe": "pause / soft",
        "story": "倒吊人正位：今天可以慢半拍，穿松一点",
    },
    {
        "id": "tarot_death",
        "name": "死神",
        "name_en": "Death",
        "image": "assets/tarot/death.svg",
        "theme": "night",
        "glyph": "rose",
        "style_tags": ["极简", "明艳"],
        "must_colors": ["纯黑", "纯白", "酒红", "炭灰"],
        "avoid_colors": [],
        "season": ["秋", "冬"],
        "vibe": "end / begin",
        "story": "死神正位：旧的翻篇，穿一件像重新开始的",
    },
    {
        "id": "tarot_temperance",
        "name": "节制",
        "name_en": "Temperance",
        "image": "assets/tarot/temperance.svg",
        "theme": "dawn",
        "glyph": "cup",
        "style_tags": ["简约", "文艺"],
        "must_colors": ["浅蓝", "米白", "雾紫", "燕麦"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "balance / calm",
        "story": "节制正位：刚好就好，别用力过猛",
    },
    {
        "id": "tarot_devil",
        "name": "恶魔",
        "name_en": "The Devil",
        "image": "assets/tarot/devil.svg",
        "theme": "rose",
        "glyph": "chain",
        "style_tags": ["明艳", "复古"],
        "must_colors": ["酒红", "纯黑", "焦糖", "砖红"],
        "avoid_colors": [],
        "season": ["秋", "冬"],
        "vibe": "dare / rich",
        "story": "恶魔正位：今天可以大胆一点，穿点有戏的",
    },
    {
        "id": "tarot_tower",
        "name": "高塔",
        "name_en": "The Tower",
        "image": "assets/tarot/tower.svg",
        "theme": "night",
        "glyph": "bolt",
        "style_tags": ["运动", "简约"],
        "must_colors": ["炭灰", "纯黑", "正红", "银灰"],
        "avoid_colors": [],
        "season": ["秋", "冬"],
        "vibe": "shake / clear",
        "story": "高塔正位：计划会变，穿好活动方便的那身",
    },
    {
        "id": "tarot_star",
        "name": "星星",
        "name_en": "The Star",
        "image": "assets/tarot/star.svg",
        "theme": "dawn",
        "glyph": "star",
        "style_tags": ["温柔", "简约"],
        "must_colors": ["奶油白", "浅紫", "白", "米"],
        "avoid_colors": ["黑"],
        "season": ["春", "秋"],
        "vibe": "soft / cozy",
        "story": "星星正位：今天适合温柔地对待自己",
    },
    {
        "id": "tarot_moon",
        "name": "月亮",
        "name_en": "The Moon",
        "image": "assets/tarot/moon.svg",
        "theme": "night",
        "glyph": "moon",
        "style_tags": ["复古", "极简"],
        "must_colors": ["蓝", "灰", "银"],
        "avoid_colors": [],
        "season": ["秋", "冬"],
        "vibe": "dreamy / mysterious",
        "story": "月亮正位：直觉会带你走对的那条路，穿得放松一点",
    },
    {
        "id": "tarot_sun",
        "name": "太阳",
        "name_en": "The Sun",
        "image": "assets/tarot/sun.svg",
        "theme": "gold",
        "glyph": "sun",
        "style_tags": ["甜美", "运动"],
        "must_colors": ["黄", "橙", "奶油"],
        "avoid_colors": [],
        "season": ["春", "夏"],
        "vibe": "bright / warm",
        "story": "太阳正位：把光穿在身上，今天会顺",
    },
    {
        "id": "tarot_judgement",
        "name": "审判",
        "name_en": "Judgement",
        "image": "assets/tarot/judgement.svg",
        "theme": "gold",
        "glyph": "horn",
        "style_tags": ["明艳", "通勤"],
        "must_colors": ["纯白", "亮黄", "雾紫", "正红"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "wake / clear",
        "story": "审判正位：听清自己真正想穿的那件",
    },
    {
        "id": "tarot_world",
        "name": "世界",
        "name_en": "The World",
        "image": "assets/tarot/world.svg",
        "theme": "violet",
        "glyph": "orbit",
        "style_tags": ["文艺", "明艳"],
        "must_colors": ["雾紫", "墨绿", "亮黄", "米白"],
        "avoid_colors": [],
        "season": ["春", "秋"],
        "vibe": "whole / arrive",
        "story": "世界正位：这一身就是完整的你，出门吧",
    },
]


def glyph_svg(kind: str, color: str) -> str:
    """牌面中央符号——几何简笔，和已有 star/moon 同一密度。"""
    c = color
    g = {
        "feather": f'<path d="M110 70 Q95 120 110 175 Q125 120 110 70Z" fill="none" stroke="{c}" stroke-width="1.5"/><path d="M110 75 L110 170" stroke="{c}" stroke-width="1"/>',
        "wand": f'<line x1="75" y1="165" x2="145" y2="85" stroke="{c}" stroke-width="2"/><circle cx="145" cy="85" r="8" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="75" cy="165" r="3" fill="{c}"/>',
        "moon": f'<circle cx="110" cy="120" r="42" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="128" cy="108" r="36" fill="none" stroke="{c}" stroke-width="1"/>',
        "heart": f'<path d="M110 165 C70 135 70 95 95 90 C108 88 110 100 110 100 C110 100 112 88 125 90 C150 95 150 135 110 165Z" fill="none" stroke="{c}" stroke-width="1.5"/>',
        "crown": f'<path d="M70 150 L70 95 L95 120 L110 85 L125 120 L150 95 L150 150 Z" fill="none" stroke="{c}" stroke-width="1.5"/>',
        "key": f'<circle cx="110" cy="95" r="18" fill="none" stroke="{c}" stroke-width="1.5"/><line x1="110" y1="113" x2="110" y2="165" stroke="{c}" stroke-width="1.5"/><line x1="110" y1="150" x2="128" y2="150" stroke="{c}" stroke-width="1.5"/>',
        "shield": f'<path d="M110 75 L155 95 L155 130 Q155 160 110 175 Q65 160 65 130 L65 95 Z" fill="none" stroke="{c}" stroke-width="1.5"/>',
        "flame": f'<path d="M110 75 Q135 110 125 145 Q120 165 110 170 Q100 165 95 145 Q85 110 110 75Z" fill="none" stroke="{c}" stroke-width="1.5"/>',
        "lantern": f'<rect x="88" y="95" width="44" height="55" rx="6" fill="none" stroke="{c}" stroke-width="1.5"/><line x1="110" y1="80" x2="110" y2="95" stroke="{c}" stroke-width="1.5"/><circle cx="110" cy="122" r="10" fill="none" stroke="{c}" stroke-width="1.2"/>',
        "wheel": f'<circle cx="110" cy="125" r="42" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="110" cy="125" r="12" fill="none" stroke="{c}" stroke-width="1.2"/><line x1="110" y1="83" x2="110" y2="167" stroke="{c}" stroke-width="1"/><line x1="68" y1="125" x2="152" y2="125" stroke="{c}" stroke-width="1"/>',
        "scale": f'<line x1="110" y1="80" x2="110" y2="165" stroke="{c}" stroke-width="1.5"/><line x1="75" y1="100" x2="145" y2="100" stroke="{c}" stroke-width="1.5"/><path d="M75 100 L62 130 Q75 140 88 130 Z" fill="none" stroke="{c}" stroke-width="1.2"/><path d="M145 100 L132 130 Q145 140 158 130 Z" fill="none" stroke="{c}" stroke-width="1.2"/>',
        "spiral": f'<path d="M110 165 A40 40 0 1 1 150 125 A28 28 0 1 0 118 105 A14 14 0 1 1 128 122" fill="none" stroke="{c}" stroke-width="1.5"/>',
        "rose": f'<circle cx="110" cy="125" r="18" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="110" cy="125" r="8" fill="none" stroke="{c}" stroke-width="1.2"/><path d="M110 143 L110 175 M110 155 Q95 150 90 140 M110 160 Q125 155 132 145" fill="none" stroke="{c}" stroke-width="1.2"/>',
        "cup": f'<path d="M80 95 L140 95 L128 145 Q110 165 92 145 Z" fill="none" stroke="{c}" stroke-width="1.5"/><line x1="110" y1="145" x2="110" y2="170" stroke="{c}" stroke-width="1.5"/><line x1="90" y1="170" x2="130" y2="170" stroke="{c}" stroke-width="1.5"/>',
        "chain": f'<circle cx="95" cy="110" r="16" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="125" cy="140" r="16" fill="none" stroke="{c}" stroke-width="1.5"/><path d="M105 122 L115 130" stroke="{c}" stroke-width="1.5"/>',
        "bolt": f'<path d="M120 75 L85 130 L108 130 L95 175 L145 115 L118 115 Z" fill="none" stroke="{c}" stroke-width="1.5"/>',
        "star": f'<path d="M110 55 L118 105 L160 90 L122 120 L160 150 L118 135 L110 185 L102 135 L60 150 L98 120 L60 90 L102 105 Z" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="110" cy="120" r="6" fill="{c}"/>',
        "sun": f'<circle cx="110" cy="125" r="28" fill="none" stroke="{c}" stroke-width="1.5"/><g stroke="{c}" stroke-width="1.5"><line x1="110" y1="75" x2="110" y2="88"/><line x1="110" y1="162" x2="110" y2="175"/><line x1="60" y1="125" x2="73" y2="125"/><line x1="147" y1="125" x2="160" y2="125"/><line x1="75" y1="90" x2="84" y2="99"/><line x1="136" y1="151" x2="145" y2="160"/><line x1="75" y1="160" x2="84" y2="151"/><line x1="136" y1="99" x2="145" y2="90"/></g>',
        "horn": f'<path d="M75 150 Q75 95 130 90 L145 105 Q100 115 100 150 Z" fill="none" stroke="{c}" stroke-width="1.5"/><line x1="75" y1="150" x2="75" y2="170" stroke="{c}" stroke-width="1.5"/>',
        "orbit": f'<circle cx="110" cy="125" r="38" fill="none" stroke="{c}" stroke-width="1.5"/><ellipse cx="110" cy="125" rx="55" ry="18" fill="none" stroke="{c}" stroke-width="1.2"/><circle cx="110" cy="125" r="6" fill="{c}"/>',
    }
    return g.get(kind, f'<circle cx="110" cy="125" r="32" fill="none" stroke="{c}" stroke-width="1.5"/>')


def render_svg(card: dict) -> str:
    outer, inner, stroke, glyph, text = THEMES[card.get("theme", "dawn")]
    name = card["name"]
    name_en = card["name_en"].upper()
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 320">
  <rect width="220" height="320" rx="14" fill="{outer}"/>
  <rect x="10" y="10" width="200" height="300" rx="10" fill="{inner}" stroke="{stroke}" stroke-width="1.5"/>
  {glyph_svg(card.get("glyph", "star"), glyph)}
  <text x="110" y="230" text-anchor="middle" fill="{glyph}" font-family="serif" font-size="22" letter-spacing="6">{name}</text>
  <text x="110" y="255" text-anchor="middle" fill="{text}" font-family="serif" font-size="10" letter-spacing="3">{name_en}</text>
  <circle cx="110" cy="290" r="4" fill="{stroke}"/>
</svg>
"""


def main() -> int:
    import json

    os.makedirs(TAROT_DIR, exist_ok=True)

    # 校验风格词：归一后必须落在受控 8 风格里（别名允许）
    alias = {"极简": "简约", "温柔": "文艺", "街头": "运动", "休闲": "慵懒"}
    styles = {"简约", "通勤", "文艺", "甜美", "运动", "复古", "明艳", "慵懒"}
    for c in CARDS:
        for t in c["style_tags"]:
            if alias.get(t, t) not in styles:
                print(f"[WARN] {c['id']} style_tag 不在受控词表: {t}", file=sys.stderr)

    # 1) tarot.json（去掉生成用的 theme/glyph 字段）
    out_cards = []
    for c in CARDS:
        row = {k: v for k, v in c.items() if k not in ("theme", "glyph")}
        out_cards.append(row)
    tarot_path = os.path.join(DATA, "tarot.json")
    with open(tarot_path, "w", encoding="utf-8") as f:
        json.dump(out_cards, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {tarot_path} ({len(out_cards)} cards)")

    # 2) SVG 牌面（已有 4 张也按表重绘，保证风格统一）
    for c in CARDS:
        svg_path = os.path.join(TAROT_DIR, os.path.basename(c["image"]))
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(render_svg(c))
    print(f"wrote {len(CARDS)} SVGs → {TAROT_DIR}")

    # 3) 刷新离线快照
    builder = os.path.join(ROOT, "scripts", "build_offline_data.py")
    r = subprocess.run([sys.executable, builder], cwd=ROOT)
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
