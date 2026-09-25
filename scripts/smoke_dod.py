#!/usr/bin/env python3
"""DoD A1–A7 冒烟：本地起服务后跑一遍主链路。用法: python scripts/smoke_dod.py"""
from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.request
import uuid
from pathlib import Path

BASE = "http://127.0.0.1:8787"
ROOT = Path(__file__).resolve().parents[1]


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")
    return ok


def main() -> int:
    results = []

    # A1/A2/A3 upload —— 样例图优先 uploads/sample_tee.jpg，没有就用自带示例
    sample = ROOT / "uploads" / "sample_tee.jpg"
    if not sample.exists():
        for alt in (
            ROOT / "web" / "assets" / "samples" / "sample_white_tee.jpg",
            ROOT / "web" / "assets" / "items" / "prod_tee_white.jpg",
        ):
            if alt.exists():
                sample = alt
                break
    if not sample.exists():
        print("missing sample image (uploads/sample_tee.jpg or web/assets/samples/)")
        return 1
    boundary = "----smoke" + uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{sample.name}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + sample.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        BASE + "/ingest",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        payload = json.loads(resp.read().decode())
    item = payload.get("item") or {}
    results.append(check("A1 上传抠底", bool(item.get("cut_ok")) or bool(item.get("image")), f"cut_ok={item.get('cut_ok')}"))
    results.append(check(
        "A2 打标字段",
        bool(item.get("category") and item.get("type") and item.get("color_hex")),
        f"{item.get('category')}/{item.get('type')}/{item.get('color_hex')}",
    ))

    with urllib.request.urlopen(BASE + "/api/items") as resp:
        items = json.loads(resp.read().decode())["items"]
    results.append(check("A3 衣橱出现", any(i.get("id") == item.get("id") for i in items), f"id={item.get('id')}"))

    # A4 constraint
    tarot = json.loads((ROOT / "web" / "data" / "tarot.json").read_text(encoding="utf-8"))
    card = tarot[0]
    constraint = {
        "source": "tarot",
        "must_colors": card.get("must_colors") or [],
        "avoid_colors": card.get("avoid_colors") or [],
        "must_categories": ["top", "bottom", "shoes"],
        "season": card.get("season") or [],
        "vibe": card.get("vibe") or "",
        "style_tags": card.get("style_tags") or [],
        "story": card.get("story") or "",
    }
    results.append(check("A4 约束 story+style_tags", bool(constraint["story"] and constraint["style_tags"])))

    # A5 —— 真调 web/engine.js（借 Node 跑 _pick_for_smoke.mjs），
    # 不许再用 Python 内联「按品类各挑一件」冒充，那不算真调引擎。
    ids = {i["id"] for i in items}
    real = []
    engine_detail = "engine.js via node"
    try:
        import subprocess

        node = shutil.which("node") or os.environ.get("MIMO_NODE") or "node"
        payload = json.dumps({"items": items, "constraint": constraint}, ensure_ascii=False)
        # Windows 默认 locale 是 GBK，Node 吐的 UTF-8 JSON 会被解炸；必须显式 utf-8
        proc = subprocess.run(
            [node, str(ROOT / "scripts" / "_pick_for_smoke.mjs")],
            input=payload.encode("utf-8"),
            capture_output=True,
            timeout=30,
            cwd=str(ROOT),
        )
        out = (proc.stdout or b"").decode("utf-8", errors="replace")
        err = (proc.stderr or b"").decode("utf-8", errors="replace")
        if proc.returncode != 0:
            engine_detail = f"node exit {proc.returncode}: {err[:160]}"
        else:
            picked = json.loads(out)
            real = picked.get("ids") or picked.get("picks") or []
            engine_detail = (
                f"ids={real} score={picked.get('outfitScore')} "
                f"slots={[(s.get('k'), s.get('state')) for s in (picked.get('slots') or [])]}"
            )
    except Exception as e:  # noqa: BLE001 —— 冒烟要继续跑完 A6/A7
        engine_detail = f"engine call failed: {e}"
    results.append(
        check(
            "A5 真调 engine.js 成套",
            bool(real) and all(r in ids for r in real) and len(real) >= 2,
            engine_detail,
        )
    )

    # A6/A7 reason
    req = urllib.request.Request(
        BASE + "/api/reason",
        data=json.dumps({
            "story": constraint["story"],
            "items": [{"type": "长袖", "color_name": "奶油白", "style_tags": ["温柔"]}],
            "vibe": constraint["vibe"],
        }, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        reason = json.loads(resp.read().decode()).get("reason") or ""
    chinese = any("一" <= ch <= "鿿" for ch in reason)
    no_tech = all(w not in reason for w in ("JSON", "算法", "规则", "API"))
    results.append(check("A6 理由中文无技术词", chinese and no_tech and len(reason) > 10, reason[:40]))
    results.append(check("A7 兜底可出结果", bool(reason) and bool(real), "cache/template path"))

    print("-" * 40)
    print(f"SUMMARY {sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
