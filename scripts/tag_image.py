#!/usr/bin/env python3
"""S2 VLM 打标：白底图 → 单品标签 JSON。

接口约定:
  python tag_image.py <白底图.png>  → stdout 输出 item 标签 JSON

后处理:
  1. JSON 解析失败 → 重试 1 次 → 仍失败走缓存/手动
  2. 非法枚举 → 映射到「其他」/默认
  3. 写入 cache/tagged/<md5>.json（断网/二跑缓存）
  4. 主色校验：非透明/非白像素上取色，color_hex 换成取色器结果，color_name 保留 VLM 的

失败兜底: 读 cache/tagged/；再失败返回 {} 并走手动标签 UI。
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "cache" / "tagged"

CATEGORY = {"top", "bottom", "outer", "shoes", "bag"}
TYPE = {"短袖", "长袖", "短裤", "长裤", "外套", "鞋", "包", "其他"}
FIT = {"紧身", "合身", "宽松", "直筒", "阔腿", "其他"}
PATTERN = {"纯色", "条纹", "格纹", "印花", "其他"}
SEASON = {"春", "夏", "秋", "冬"}
STYLE = {"温柔", "简约", "通勤", "街头", "运动", "甜美", "极简", "复古"}

PROMPT = (
    "你是服装档案员。看这张衣服图，只返回 JSON，不要 Markdown 围栏，不要解释。\n"
    "{\n"
    '  "category": "top|bottom|outer|shoes|bag",\n'
    '  "type": "短袖|长袖|短裤|长裤|外套|鞋|包|其他",\n'
    '  "color_name": "中文色名",\n'
    '  "color_hex": "#RRGGBB",\n'
    '  "fit": "紧身|合身|宽松|直筒|阔腿|其他",\n'
    '  "pattern": "纯色|条纹|格纹|印花|其他",\n'
    '  "season": ["春","秋"],\n'
    '  "style_tags": ["温柔","简约"],\n'
    '  "formality": 2\n'
    "}"
)


def _load_env() -> None:
    """加载项目根目录 .env（若存在）。"""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _md5_file(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _parse_json_loose(text: str) -> dict | None:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None


def _sanitize(raw: dict) -> dict:
    category = raw.get("category") if raw.get("category") in CATEGORY else "other_bucket"
    if category == "other_bucket":
        # 非法/未知 → 尽量映射
        category = "top" if raw.get("category") in (None, "其他") else raw.get("category")
        if category not in CATEGORY:
            category = "top"

    typ = raw.get("type") if raw.get("type") in TYPE else "其他"
    fit = raw.get("fit") if raw.get("fit") in FIT else "其他"
    pattern = raw.get("pattern") if raw.get("pattern") in PATTERN else "其他"

    season = [s for s in (raw.get("season") or []) if s in SEASON]
    style_tags = [s for s in (raw.get("style_tags") or []) if s in STYLE]

    formality = raw.get("formality", 2)
    try:
        formality = int(formality)
    except (TypeError, ValueError):
        formality = 2
    formality = max(1, min(5, formality))

    color_name = raw.get("color_name") or "未知"
    color_hex = raw.get("color_hex") or "#CCCCCC"
    if isinstance(color_hex, str) and not color_hex.startswith("#"):
        color_hex = "#" + color_hex

    return {
        "category": category,
        "type": typ,
        "color_name": color_name,
        "color_hex": color_hex,
        "palette": [color_hex],
        "fit": fit,
        "pattern": pattern,
        "season": season,
        "style_tags": style_tags,
        "formality": formality,
    }


def _dominant_color(path: Path) -> str | None:
    """在非白/非透明像素上取主色。优先 colorthief，否则纯 PIL。"""
    img = Image.open(path).convert("RGBA")
    # 先过滤掉接近白/透明的背景像素
    pixels = []
    for r, g, b, a in img.getdata():  # noqa: PLW2901
        if a < 16:
            continue
        if r > 245 and g > 245 and b > 245:
            continue
        pixels.append((r, g, b))
    if not pixels:
        return None

    # 粗采样
    step = max(1, len(pixels) // 2000)
    sample = pixels[::step]

    # 简单中位色 + 量化桶
    buckets: dict[tuple[int, int, int], int] = {}
    for r, g, b in sample:
        key = (r // 16 * 16, g // 16 * 16, b // 16 * 16)
        buckets[key] = buckets.get(key, 0) + 1
    best = max(buckets.items(), key=lambda kv: kv[1])[0]
    r, g, b = best
    # 再在桶内取均值细化
    in_bucket = [(pr, pg, pb) for pr, pg, pb in sample if pr // 16 * 16 == r and pg // 16 * 16 == g and pb // 16 * 16 == b]
    if in_bucket:
        n = len(in_bucket)
        r = sum(p[0] for p in in_bucket) // n
        g = sum(p[1] for p in in_bucket) // n
        b = sum(p[2] for p in in_bucket) // n
    return f"#{r:02X}{g:02X}{b:02X}"


def _call_vlm(image_path: Path) -> dict | None:
    base = os.environ.get("VLM_BASE_URL", "").rstrip("/")
    key = os.environ.get("VLM_API_KEY", "")
    model = os.environ.get("VLM_MODEL", "qwen-vl-max")
    if not base or not key or key.startswith("sk-xxxx"):
        return None

    data_url = "data:image/png;base64," + base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0.1,
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    content = body["choices"][0]["message"]["content"]
    return _parse_json_loose(content)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python tag_image.py <white_image.png>", file=sys.stderr)
        return 2

    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(json.dumps({}, ensure_ascii=False))
        return 1

    _load_env()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    digest = _md5_file(image_path)
    cache_file = CACHE_DIR / f"{digest}.json"

    # 1) VLM（失败重试 1 次）
    raw = None
    for _ in range(2):
        try:
            raw = _call_vlm(image_path)
            if raw:
                break
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, json.JSONDecodeError, TimeoutError) as exc:
            print(f"vlm error: {exc}", file=sys.stderr)
            raw = None

    # 2) 缓存兜底
    if not raw and cache_file.exists():
        try:
            raw = json.loads(cache_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raw = None

    if not raw:
        print(json.dumps({}, ensure_ascii=False))
        return 1

    tags = _sanitize(raw)

    # 3) 主色校验
    try:
        hex_color = _dominant_color(image_path)
        if hex_color:
            tags["color_hex"] = hex_color
            tags["palette"] = [hex_color] + [c for c in (raw.get("palette") or []) if isinstance(c, str)][:2]
    except Exception as exc:  # noqa: BLE001
        print(f"color extract failed: {exc}", file=sys.stderr)

    tags["source"] = "ai"
    tags["manual_override"] = False

    # 4) 写缓存
    try:
        cache_file.write_text(json.dumps(tags, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        print(f"cache write failed: {exc}", file=sys.stderr)

    print(json.dumps(tags, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
