#!/usr/bin/env python3
"""S6 文案理由：story + 选中单品 → 2–3 句中文推荐理由。

接口约定:
  python write_reason.py  或  write_reason(story, items) -> str

失败兜底: 模板拼接。
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REASON_PROMPT = (
    "你是温柔的穿搭顾问。用户今天的氛围是「{story}」。\n"
    "已按规则选出这套：{items}。\n"
    "请写 2–3 句中文推荐理由，口吻轻松、带一点玄学感。\n"
    "不要出现技术词，不要列 JSON，不要提「规则」「算法」。"
)


def _load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def template_reason(story: str, items: list[dict], vibe: str = "") -> str:
    """失败兜底模板。"""
    if items:
        first = items[0]
        color = first.get("color_name") or "喜欢的"
        typ = first.get("type") or "单品"
        others = "、".join(
            f"{i.get('color_name') or ''}{i.get('type') or ''}".strip()
            for i in items[1:]
        )
        pieces = f"{color}的{typ}" + (f"，配上{others}" if others else "")
    else:
        pieces = "几件轻盈的单品"

    vibe_part = f"，整套偏{vibe}" if vibe else ""
    return f"「{story}」——所以为你选了{pieces}{vibe_part}。穿上它，按自己的节奏来就好。"


def write_reason(story: str, items: list[dict], vibe: str = "") -> str:
    _load_env()
    base = os.environ.get("VLM_BASE_URL", "").rstrip("/")
    key = os.environ.get("VLM_API_KEY", "")
    model = os.environ.get("VLM_MODEL", "qwen-vl-max")

    summary = [
        {
            "type": it.get("type"),
            "color_name": it.get("color_name"),
            "style_tags": it.get("style_tags") or [],
        }
        for it in items
    ]
    prompt = REASON_PROMPT.format(story=story or "平静", items=json.dumps(summary, ensure_ascii=False))

    if base and key and not key.startswith("sk-xxxx"):
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
        }
        req = urllib.request.Request(
            base + "/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            text = body["choices"][0]["message"]["content"].strip()
            text = text.replace("```", "").strip()
            if text:
                return text
        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, json.JSONDecodeError, TimeoutError) as exc:
            print(f"reason llm failed: {exc}", file=sys.stderr)

    return template_reason(story, items, vibe)


def main() -> int:
    raw = sys.stdin.read() if not sys.stdin.isatty() else "{}"
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError:
        data = {}
    story = data.get("story") or "星星正位：今天适合温柔地对待自己"
    items = data.get("items") or []
    vibe = data.get("vibe") or ""
    print(json.dumps({"reason": write_reason(story, items, vibe)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
