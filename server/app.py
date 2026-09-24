#!/usr/bin/env python3
"""本地小服务：包装抠底 + 打标，提供 /ingest 与静态资源。

POST /ingest
  req: multipart file（字段名 file）
  res: { "item": {...}, "white_image": "...", "raw_image": "..." }
  err: 500 + { "stage": "cut|tag", "message": "..." }

其它接口:
  GET  /            → web/index.html
  GET  /api/items   → 读 data/items.json
  POST /api/reason  → { story, items[], vibe } → { reason }
  POST /api/items/manual → 手动补标后写回 items.json
"""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from remove_bg import remove_bg_to  # noqa: E402
from tag_image import _load_env as tag_load_env  # noqa: E402
from tag_image import _md5_file, _sanitize, _dominant_color, _call_vlm  # noqa: E402
from write_reason import write_reason  # noqa: E402

WEB = ROOT / "web"
DATA = WEB / "data"
UPLOADS = ROOT / "uploads"
CUTS = ROOT / "cache" / "cuts"
TAGGED = ROOT / "cache" / "tagged"
ITEMS_JSON = DATA / "items.json"

PORT = int(os.environ.get("PORT", "8787"))


def _load_items() -> list:
    if not ITEMS_JSON.exists():
        return []
    try:
        data = json.loads(ITEMS_JSON.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("items", [])
    except json.JSONDecodeError:
        return []


def _save_items(items: list) -> None:
    ITEMS_JSON.parent.mkdir(parents=True, exist_ok=True)
    ITEMS_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def _new_id() -> str:
    return "w" + format(int(time.time() * 1000) % 10000, "04d")


def _parse_multipart(body: bytes, content_type: str) -> tuple[bytes, str]:
    """极简 multipart/form-data 解析，返回 (file_bytes, filename)。"""
    m = re.search(r'boundary="?([^";]+)"?', content_type)
    if not m:
        raise ValueError("no boundary")
    boundary = b"--" + m.group(1).encode("ascii")
    parts = body.split(boundary)
    for part in parts:
        if b"Content-Disposition" not in part:
            continue
        header, _, payload = part.partition(b"\r\n\r\n")
        if b'name="file"' not in header and b"name='file'" not in header:
            # 也接受任意第一个文件字段
            if b"filename=" not in header:
                continue
        fname_m = re.search(rb'filename="([^"]+)"', header)
        fname = fname_m.group(1).decode("utf-8", errors="replace") if fname_m else "upload.jpg"
        payload = payload.rstrip(b"\r\n")
        return payload, fname
    raise ValueError("no file field")


def _ensure_image_asset(item_id: str, src_png: Path) -> str:
    """把白底/透明 PNG 拷到 web/assets/items/，返回 web 相对路径。"""
    dest = WEB / "assets" / "items" / f"{item_id}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(src_png.read_bytes())
    return f"assets/items/{item_id}.png"


def ingest(file_bytes: bytes, filename: str) -> dict:
    tag_load_env()
    UPLOADS.mkdir(parents=True, exist_ok=True)
    CUTS.mkdir(parents=True, exist_ok=True)
    TAGGED.mkdir(parents=True, exist_ok=True)

    # --- 录入规范校验（与前端 rules 一致）---
    if len(file_bytes) > 10 * 1024 * 1024:
        return {"error": "cut", "message": "图片过大，请压缩到 10MB 以内"}
    if len(file_bytes) < 1024:
        return {"error": "cut", "message": "文件过小，不是有效图片"}

    ext = Path(filename).suffix or ".jpg"
    raw_name = f"{uuid.uuid4().hex}{ext}"
    raw_path = UPLOADS / raw_name
    raw_path.write_bytes(file_bytes)

    cut_png = CUTS / f"{raw_path.stem}_cut.png"
    white_jpg = CUTS / f"{raw_path.stem}_white.jpg"

    # 分辨率约束：短边 ≥ 480
    try:
        from PIL import Image

        with Image.open(raw_path) as probe:
            w, h = probe.size
        if min(w, h) < 480:
            raw_path.unlink(missing_ok=True)
            return {"error": "cut", "message": f"分辨率过低（{w}×{h}），短边需 ≥ 480px"}
    except Exception as exc:  # noqa: BLE001
        return {"error": "cut", "message": f"无法解码图片：{exc}"}

    # --- Stage: cut ---
    cut_ok = False
    try:
        cut_ok = remove_bg_to(raw_path, cut_png, white_jpg)
    except Exception as exc:  # noqa: BLE001
        return {"error": "cut", "message": str(exc)}

    # --- Stage: tag ---
    display_img = white_jpg if white_jpg.exists() else cut_png
    digest = _md5_file(display_img) if display_img.exists() else uuid.uuid4().hex
    cache_file = TAGGED / f"{digest}.json"

    raw_tags = None
    try:
        raw_tags = _call_vlm(display_img)
    except Exception as exc:  # noqa: BLE001
        print(f"tag stage vlm failed: {exc}", file=sys.stderr)

    if not raw_tags and cache_file.exists():
        try:
            raw_tags = json.loads(cache_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raw_tags = None

    if raw_tags:
        tags = _sanitize(raw_tags)
    else:
        # 打标失败：返回空标签 + cut_ok，前端走手动 UI
        tags = {
            "category": None,
            "type": None,
            "color_name": None,
            "color_hex": None,
            "palette": [],
            "fit": None,
            "pattern": None,
            "season": [],
            "style_tags": [],
            "formality": 3,
        }

    try:
        hex_color = _dominant_color(display_img)
        if hex_color:
            tags["color_hex"] = hex_color
    except Exception:  # noqa: BLE001
        pass

    item_id = _new_id()
    image_rel = _ensure_image_asset(item_id, cut_png if cut_png.exists() else raw_path)

    item = {
        "id": item_id,
        "image": image_rel,
        **tags,
        "source": "ai" if raw_tags else "manual",
        "manual_override": not bool(raw_tags),
        "cut_ok": cut_ok,
    }

    items = _load_items()
    items.append(item)
    _save_items(items)

    # 写打标缓存
    try:
        cache_file.write_text(json.dumps({**tags, "source": item["source"]}, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass

    return {
        "item": item,
        "white_image": str(white_jpg).replace("\\", "/") if white_jpg.exists() else None,
        "raw_image": str(raw_path).replace("\\", "/"),
        "tag_ok": bool(raw_tags),
    }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, obj: dict | list) -> None:
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(payload)

    def _send_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self._send_json(404, {"message": "not found"})
            return
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send_json(204, {})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/items":
            self._send_json(200, {"items": _load_items()})
            return

        if path == "/" or path == "/index.html":
            self._send_file(WEB / "index.html")
            return

        # 静态：web/**
        rel = path.lstrip("/")
        # 兼容 web/assets/... 与 assets/...
        candidates = [
            WEB / rel,
            WEB / rel.removeprefix("web/"),
            ROOT / rel,
        ]
        for c in candidates:
            try:
                c_resolved = c.resolve()
                if str(c_resolved).startswith(str(WEB.resolve())) and c_resolved.is_file():
                    self._send_file(c_resolved)
                    return
            except OSError:
                continue
        self._send_json(404, {"message": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length else b""
        ctype = self.headers.get("Content-Type", "")

        if path == "/ingest":
            try:
                file_bytes, filename = _parse_multipart(body, ctype)
            except ValueError as exc:
                self._send_json(400, {"stage": "cut", "message": str(exc)})
                return
            try:
                result = ingest(file_bytes, filename)
            except Exception as exc:  # noqa: BLE001
                self._send_json(500, {"stage": "cut", "message": str(exc)})
                return
            if "error" in result:
                self._send_json(500, {"stage": result["error"], "message": result["message"]})
                return
            self._send_json(200, result)
            return

        if path == "/api/reason":
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                data = {}
            reason = write_reason(
                data.get("story") or "",
                data.get("items") or [],
                data.get("vibe") or "",
            )
            self._send_json(200, {"reason": reason})
            return

        if path == "/api/items/manual":
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._send_json(400, {"message": "bad json"})
                return
            item_id = data.get("id")
            items = _load_items()
            for it in items:
                if it.get("id") == item_id:
                    for key in (
                        "category", "type", "color_name", "color_hex", "fit",
                        "pattern", "season", "style_tags", "formality",
                    ):
                        if key in data:
                            it[key] = data[key]
                    it["manual_override"] = True
                    it["source"] = "manual"
                    _save_items(items)
                    self._send_json(200, {"item": it})
                    return
            self._send_json(404, {"message": "item not found"})
            return

        self._send_json(404, {"message": "not found"})

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("[app] " + (fmt % args) + "\n")


def main() -> None:
    tag_load_env()
    for d in (UPLOADS, CUTS, TAGGED, DATA, WEB / "assets" / "items"):
        d.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"outfit-mystic listening on http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("bye")


if __name__ == "__main__":
    main()
