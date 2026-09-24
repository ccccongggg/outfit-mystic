# -*- coding: utf-8 -*-
"""主链路冒烟：示例图入柜 → 结构化标签 → 风格约束 → 匹配度 → 整套生成。

用法: python scripts/smoke_flow.py [port]
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

PORT = sys.argv[1] if len(sys.argv) > 1 else "8787"
BASE = f"http://127.0.0.1:{PORT}"


def get(path: str) -> dict:
    with urllib.request.urlopen(BASE + path, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    ok = 0

    samples = get("/api/samples")
    got_samples = len(samples.get("samples", [])) >= 4
    print(f"[{'PASS' if got_samples else 'FAIL'}] /api/samples → {len(samples.get('samples', []))} 张示例图")
    ok += got_samples

    before = len(get("/api/items")["items"])
    res = post("/api/ingest_sample", {"id": "s1"})
    item = res.get("item", {})
    after = len(get("/api/items")["items"])
    fields = ["category", "type", "color_name", "fit", "material", "occasions", "style_tags"]
    have = [f for f in fields if item.get(f)]
    passed = res.get("tag_ok") and after == before + 1 and len(have) >= 5
    print(f"[{'PASS' if passed else 'FAIL'}] 示例入柜 → id={item.get('id')} tag_ok={res.get('tag_ok')} "
          f"cut_ok={item.get('cut_ok')} 衣橱 {before}→{after}")
    print("      结构化标签:", json.dumps({k: item.get(k) for k in fields}, ensure_ascii=False))
    ok += bool(passed)

    print(f"\n{ok}/2 通过")
    return 0 if ok == 2 else 1


if __name__ == "__main__":
    raise SystemExit(main())
