#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_offline_data.py —— 把 web/data/*.json 打包成 web/data/offline.js

为什么需要这个文件
------------------
浏览器在 file:// 下**拒绝一切 fetch / XHR**（"URL scheme must be http or https for CORS
request"，Chrome/Edge 都是这样）。所以双击 index.html 时：

  · HTML / CSS / 图片照常显示（这些不走 fetch）
  · data/items.json、tarot.json、samples.json、slot-samples.json 全读不到 → 衣橱空、塔罗空

这是「断网可跑」的最后一公里。做法：把这些 JSON 也导出一份经典脚本快照
（`window.__offlineData`），页面里用 <script> 加载 —— <script> 不受 file:// 限制。
app.js 的读取顺序是：先 fetch（起服务时用最新数据）→ 失败才用这份快照。

单一真相源没有变：*.json 仍是唯一的数据源，offline.js 是**生成物**，不要手改。
server/app.py 每次写 items.json 后会自动重建它，所以起服务时两者不会走岔。
手动改过 samples / slot-samples / tarot 之后跑一次本脚本即可：

    python scripts/build_offline_data.py

（scripts/test_boot.mjs 会校验快照与 JSON 是否同源：不同源会直接报错让你重跑。）
"""
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "web", "data")
OUT = os.path.join(DATA, "offline.js")

# 顺序固定：SOURCE_MD5 依赖它，JS 侧的校验也按这个顺序算
SOURCES = ["items", "samples", "slot-samples", "tarot"]


def _read(name):
    p = os.path.join(DATA, name + ".json")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def source_md5():
    """把 4 个 JSON 的原始字节按固定顺序拼起来算 md5（与 test_boot.mjs 同算法）。"""
    h = hashlib.md5()
    for name in SOURCES:
        with open(os.path.join(DATA, name + ".json"), "rb") as f:
            h.update(f.read())
    return h.hexdigest()


def build(quiet=False):
    """重建 web/data/offline.js。返回 (是否写入, md5)。"""
    pack = {}
    for name in SOURCES:
        pack[name] = _read(name)

    body = json.dumps(pack, ensure_ascii=False, indent=2)
    # JSON 几乎是 JS 的子集，但 U+2028 / U+2029 在旧解析器里会断行，转义掉更稳
    body = body.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")

    md5 = source_md5()
    text = (
        "/* web/data/offline.js —— 【自动生成，请勿手改】\n"
        "   来源：web/data/{items,samples,slot-samples,tarot}.json（唯一真相源仍是这些 JSON）\n"
        "   生成：python scripts/build_offline_data.py\n"
        "         （server/app.py 写入 items.json 后也会自动重建）\n"
        "   SOURCE_MD5: " + md5 + "\n"
        "\n"
        "   为什么要有这个文件：浏览器在 file:// 下拒绝一切 fetch（\"URL scheme must be\n"
        "   http or https for CORS request\"），双击 index.html 时 data/*.json 全读不到，\n"
        "   衣橱 / 塔罗 / 示例图会一片空白。<script> 不受这个限制，所以把数据也做成一份\n"
        "   经典脚本快照。app.js 的顺序是「先接口 / 再 fetch 相对路径 / 最后用这份快照」，\n"
        "   起服务时永远是接口的最新数据，这份只在断网或双击打开时兜底。*/\n"
        "window.__offlineData = " + body + ";\n"
    )

    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = f.read()
    if old == text:
        if not quiet:
            print("[skip] web/data/offline.js 已是最新（SOURCE_MD5 %s）" % md5)
        return False, md5

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    if not quiet:
        print("[ok] 写出了 web/data/offline.js（%d 字节，SOURCE_MD5 %s）" % (len(text.encode("utf-8")), md5))
    return True, md5


if __name__ == "__main__":
    try:
        build()
    except Exception as e:  # noqa: BLE001
        print("[fail] %s" % e, file=sys.stderr)
        raise SystemExit(1)
