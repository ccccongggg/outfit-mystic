#!/usr/bin/env python3
"""冒烟：联网找白底图这条互补链路 —— /api/prepare → /api/find_image → /api/commit。

用法: python scripts/smoke_webfind.py [port] [图片路径]
默认用 uploads/sample_tee.jpg（仓库自带样例）。

检查项:
  A1 /api/prepare 返回 pending + 结构化标签
  A2 /api/find_image 返回候选（ok 或明确失败原因，都不能 500）
  A3 /api/findimg/<rel> 能取到候选缩略图（若有候选）
  A4 /api/commit 无 found_path 时正常入柜（= 回落抠图路径）
  A5 /api/commit 带 found_path 时以联网图入柜（from_web_search=true）
收尾会把冒烟产生的单品从 items.json 删掉。
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = sys.argv[1] if len(sys.argv) > 1 else "8791"
BASE = f"http://127.0.0.1:{PORT}"
IMG = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "uploads" / "sample_tee.jpg"
ITEMS_JSON = ROOT / "web" / "data" / "items.json"

ok = 0
total = 5


def check(name: str, cond: bool, detail: str = "") -> None:
    global ok
    if cond:
        ok += 1
        print(f"  PASS  {name} {detail}")
    else:
        print(f"  FAIL  {name} {detail}")


def post_json(path: str, payload: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", "replace"))


def post_multipart(path: str, file_path: Path) -> tuple[int, dict]:
    boundary = "----smoke" + uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8") + file_path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", "replace"))


def drop_items(ids: list[str]) -> None:
    """删掉冒烟入柜的单品，并清掉拷贝进 web/assets/items 的图片。"""
    ids = [i for i in ids if i]
    items = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
    left = [i for i in items if i.get("id") not in ids]
    ITEMS_JSON.write_text(json.dumps(left, ensure_ascii=False, indent=2), encoding="utf-8")
    for it in items:
        if it.get("id") in ids and it.get("image"):
            try:
                (ROOT / "web" / str(it["image"])).unlink()
            except OSError:
                pass
    print(f"  清理冒烟单品: {len(items)} -> {len(left)}")


def main() -> int:
    if not IMG.is_file():
        print(f"样例图不存在: {IMG}")
        return 1
    print(f"== 联网搜白底图链路冒烟 (port={PORT}) ==")

    # A1 prepare
    code, pre = post_multipart("/api/prepare", IMG)
    check("A1 /api/prepare", code == 200 and bool(pre.get("pending")), f"code={code} tags={ {k: pre.get('tags', {}).get(k) for k in ('category','type','color_name')} }")
    if code != 200:
        print("   prepare 失败，终止:", pre)
        return 1
    pending = pre["pending"]

    # A2 find_image
    t0 = time.time()
    code, found = post_json("/api/find_image", {"tags": pre["tags"]})
    check("A2 /api/find_image 不报错", code == 200, f"code={code} ok={found.get('ok')} msg={(found.get('message') or '')[:60]}")
    cands = found.get("candidates") or []
    print(f"     候选 {len(cands)} 张 · 耗时 {time.time() - t0:.1f}s")

    # A3 候选缩略图可访问
    if cands and cands[0].get("url"):
        with urllib.request.urlopen(BASE + cands[0]["url"], timeout=20) as r:
            data = r.read()
        check("A3 候选图可访问", len(data) > 2048, f"{len(data)} bytes")
    else:
        check("A3 候选图可访问（跳过：无候选）", True)

    # A4 commit 回落（用自己那张的抠图）
    code, res4 = post_json("/api/commit", {"pending": pending})
    check(
        "A4 /api/commit 回落抠图",
        code == 200 and not res4.get("item", {}).get("from_web_search"),
        f"code={code} id={res4.get('item', {}).get('id')} source={res4.get('item', {}).get('source')}",
    )
    id4 = res4.get("item", {}).get("id")

    # A5 commit 用联网图入柜
    id5 = None
    if found.get("ok") and found.get("path"):
        pending2 = None
        code2, pre2 = post_multipart("/api/prepare", IMG)
        pending2 = pre2.get("pending") if code2 == 200 else None
        if pending2:
            code, res5 = post_json("/api/commit", {"pending": pending2, "found_path": found["path"]})
            id5 = res5.get("item", {}).get("id")
            check(
                "A5 /api/commit 用联网白底图",
                code == 200 and res5.get("item", {}).get("from_web_search") is True,
                f"code={code} id={id5} verified={found.get('verified')}",
            )
    else:
        check("A5 用联网白底图（跳过：本次未搜到可信图）", True, f"reason={(found.get('message') or '')[:60]}")

    drop_items([i for i in (id4, id5) if i])
    print(f"\n{ok}/{total} 通过")
    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
