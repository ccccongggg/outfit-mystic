# -*- coding: utf-8 -*-
"""把 design/mystic-oracle-ui.html 引用的图片转成 base64，产出可独立分发的产品说明 HTML。

用法: python scripts/build_ui_doc.py
"""
import base64
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "design", "mystic-oracle-ui.html")
DST = os.path.join(ROOT, "design", "mystic-oracle-ui-standalone.html")

MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "svg": "image/svg+xml"}


def main():
    html = open(SRC, encoding="utf-8").read()
    refs = sorted(set(re.findall(r'"(\.\./[^"]+?\.(?:jpg|jpeg|png|svg))"', html)))
    embedded = 0
    for rel in refs:
        fp = os.path.normpath(os.path.join(ROOT, "design", rel))
        if not os.path.isfile(fp):
            print("MISS", rel, "->", fp)
            continue
        ext = os.path.splitext(fp)[1].lstrip(".").lower()
        raw = open(fp, "rb").read()
        uri = "data:%s;base64,%s" % (MIME[ext], base64.b64encode(raw).decode())
        html = html.replace('"' + rel + '"', '"' + uri + '"')
        embedded += 1
        print("embed", rel, len(raw) // 1024, "KB")
    open(DST, "w", encoding="utf-8").write(html)
    print("refs=%d embedded=%d out=%d KB" % (len(refs), embedded, os.path.getsize(DST) // 1024))


if __name__ == "__main__":
    main()
