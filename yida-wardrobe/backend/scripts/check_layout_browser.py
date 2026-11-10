#!/usr/bin/env python3
"""在真实 Chrome 里量手机模式的实际几何（不是看图，是断言）。

原理：web/_layoutcheck.html 在同域 iframe 里加载真应用（?mode=phone），
     量完把 JSON 写进 <pre id="out">；本脚本用 chrome --dump-dom 把 DOM 取回再解析。
     因为外壳是 transform:scale() 缩放，媒体查询永远不命中，只能这样实测才准。

前置：已装 agent-browser 的 Chrome（或自行指定 --chrome 路径）
用法: python scripts/check_layout_browser.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHROME = Path(os.environ.get("LOCALAPPDATA", "")) / ".."  # 占位
CHROME_CANDIDATES = [
    Path(r"C:\Users\Cccong\.agent-browser\browsers\chrome-154.0.8037.57\chrome.exe"),
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
]
URL = "http://127.0.0.1:8787/_layoutcheck.html"


def find_chrome(explicit: str = "") -> Path | None:
    if explicit:
        p = Path(explicit)
        return p if p.is_file() else None
    for c in CHROME_CANDIDATES:
        if c.is_file():
            return c
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default="")
    ap.add_argument("--url", default=URL)
    a = ap.parse_args()

    chrome = find_chrome(a.chrome)
    if not chrome:
        print("找不到 Chrome，先用 agent-browser install 装，或用 --chrome 指定路径")
        return 1

    # 必须用独立临时 profile：默认 profile 会复用磁盘缓存，导致改完 js/css 仍量到旧版本
    profile = Path(tempfile.mkdtemp(prefix="layoutcheck-"))
    try:
        proc = subprocess.run(
            [
                str(chrome), "--headless=new", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--window-size=900,1120",
                "--user-data-dir=" + str(profile),
                "--no-first-run", "--no-default-browser-check",
                "--virtual-time-budget=15000", "--dump-dom", a.url,
            ],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
        )
        dom = proc.stdout or ""
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r"RESULT_JSON:(\{.*?\})\s*</pre>", dom, re.S)
    if not m:
        m = re.search(r"RESULT_JSON:(\{.*)", dom, re.S)
    if not m:
        print("没取到自检结果（页面没跑完？）")
        print(dom[:800])
        return 1

    raw = m.group(1)
    raw = raw.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    # 截到最后一个 }，避免把后续 HTML 带进来
    depth = 0
    end = 0
    for i, ch in enumerate(raw):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    try:
        data = json.loads(raw[:end])
    except json.JSONDecodeError as e:
        print("JSON 解析失败:", e)
        print(raw[:600])
        return 1

    if data.get("fatal"):
        print("自检失败:", data["fatal"])
        return 1

    print(f"手机屏幕: {data.get('info', {}).get('screen')} · view 数: {data.get('info', {}).get('views')}")
    ok = 0
    for c in data.get("checks", []):
        mark = "PASS" if c["pass"] else "FAIL"
        if c["pass"]:
            ok += 1
        print(f"  [{mark}] {c['name']} → {c['detail']}")
    total = len(data.get("checks", []))
    print(f"\n{ok}/{total} 通过")
    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
