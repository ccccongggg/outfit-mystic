#!/usr/bin/env python3
"""DoD A1–A7 冒烟：本地起服务后跑一遍主链路。用法: python scripts/smoke_dod.py

A1–A3 走「干净单品图」的真实上传链路（抠底 + VLM 打标 + 入柜 / 待确认），
跑完自动清理测试产生的单品 / 待确认项，不污染运行时数据与离线快照。

为什么 A1–A3 要挑「干净单品图」而不是随便一张样例：
`POST /ingest` 会先做场景探测，**试穿照 / 模特上身照按设计进待确认区（pending_review）**，
不入柜；只有干净白底 / 纯色底 / 挂拍单品图才走 committed 直接入柜。
所以验证「上传→入库」主链必须用干净单品图，否则会一直停在 pending_review。
"""
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


def _get_json(url: str, timeout: int = 15) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _post_json(url: str, obj: dict | None = None, timeout: int = 30) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(obj or {}, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    results = []
    test_item_id = None
    pending_id = None

    # A1/A2/A3 —— 干净单品图优先（隔离白底 / 挂拍），验证「上传 → 入柜」主链。
    candidates = [
        ROOT / "web" / "assets" / "samples" / "sample_sneaker.jpg",
        ROOT / "web" / "assets" / "items" / "prod_tee_white.jpg",
        ROOT / "web" / "assets" / "samples" / "sample_denim_jacket.jpg",
        ROOT / "uploads" / "sample_tee.jpg",
    ]
    sample = next((c for c in candidates if c.exists()), None)
    if sample is None:
        print("missing sample image (web/assets/samples/sample_sneaker.jpg 等)")
        return 1

    try:
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

        # /ingest 现行契约：{state: committed|pending_review, ...}
        #   committed       → 字段在顶层 item（**tags 展开）
        #   pending_review  → 字段在 tags 下，另有 pending_id
        state = payload.get("state")
        committed = payload.get("item") or {}
        pending_id = payload.get("pending_id")
        tags = committed if state == "committed" else (payload.get("tags") or {})
        test_item_id = committed.get("id") if state == "committed" else None

        results.append(check(
            "A1 上传链路跑通",
            bool(state) and (bool(committed) or bool(pending_id)),
            f"state={state} cut_ok={payload.get('cut_ok')} tag_ok={payload.get('tag_ok')}",
        ))
        results.append(check(
            "A2 打标字段",
            bool(tags.get("category") and tags.get("type") and tags.get("color_hex")),
            f"{tags.get('category')}/{tags.get('type')}/{tags.get('color_hex')}",
        ))

        if state == "committed" and test_item_id:
            items = _get_json(BASE + "/api/items")["items"]
            ok3 = any(i.get("id") == test_item_id for i in items)
            detail3 = f"committed id={test_item_id} 在衣橱"
        elif pending_id:
            pend = _get_json(BASE + "/api/pending").get("pending", [])
            ok3 = any(p.get("id") == pending_id for p in pend)
            detail3 = f"pending id={pending_id} 在待确认区"
        else:
            ok3, detail3 = False, "无 id 可归属"
        results.append(check("A3 归属落位（衣橱 / 待确认）", ok3, detail3))

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
        items = _get_json(BASE + "/api/items")["items"]
        ids = {i["id"] for i in items}
        real = []
        engine_detail = "engine.js via node"
        try:
            import subprocess

            node = shutil.which("node") or os.environ.get("MIMO_NODE") or "node"
            payload_in = json.dumps({"items": items, "constraint": constraint}, ensure_ascii=False)
            # Windows 默认 locale 是 GBK，Node 吐的 UTF-8 JSON 会被解炸；必须显式 utf-8
            proc = subprocess.run(
                [node, str(ROOT / "scripts" / "_pick_for_smoke.mjs")],
                input=payload_in.encode("utf-8"),
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
        reason = _post_json(BASE + "/api/reason", {
            "story": constraint["story"],
            "items": [{"type": "长袖", "color_name": "奶油白", "style_tags": ["温柔"]}],
            "vibe": constraint["vibe"],
        }).get("reason") or ""
        chinese = any("一" <= ch <= "鿿" for ch in reason)
        no_tech = all(w not in reason for w in ("JSON", "算法", "规则", "API"))
        results.append(check("A6 理由中文无技术词", chinese and no_tech and len(reason) > 10, reason[:40]))
        results.append(check("A7 兜底可出结果", bool(reason) and bool(real), "cache/template path"))
    finally:
        # 清理：删掉测试产生的单品 / 待确认项，避免污染 items.json / pending.json / offline.js
        if test_item_id:
            try:
                _post_json(f"{BASE}/api/items/{test_item_id}/delete")
                print(f"[clean] 已删除测试单品 {test_item_id}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] 清理测试单品失败：{e}", file=sys.stderr)
            # 删除端点只清 items.json，不删图片资产（web/assets/items/<id>.png）→ 冒烟自己扫掉
            for asset in (ROOT / "web" / "assets" / "items").glob(f"{test_item_id}.*"):
                try:
                    asset.unlink()
                    print(f"[clean] 已移除图片资产 {asset.name}")
                except OSError:
                    pass
        # 兜底：按当前 data/*.json 校准 offline.js。
        # 常驻 server 若还是旧进程，它 import 的 build_offline_data 可能漏掉新增数据源，
        # 会在 commit/delete 时把 offline.js 刷成过期版本（test_boot ③ 会红）。这里用本地
        # 脚本再生成一次，保证冒烟跑完 offline.js 与 JSON 一定同源。
        if test_item_id:
            try:
                sys.path.insert(0, str(ROOT / "scripts"))
                import build_offline_data

                _, md5 = build_offline_data.build(quiet=True)
                print(f"[clean] 已按当前 JSON 校准 offline.js（SOURCE_MD5 {md5[:8]}）")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] 校准 offline.js 失败：{e}", file=sys.stderr)
        if pending_id:
            try:
                _post_json(f"{BASE}/api/pending/{pending_id}/skip")
                print(f"[clean] 已丢弃测试待确认 {pending_id}")
            except Exception as e:  # noqa: BLE001
                print(f"[warn] 清理测试待确认失败：{e}", file=sys.stderr)

    print("-" * 40)
    print(f"SUMMARY {sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
