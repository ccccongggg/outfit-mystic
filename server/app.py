#!/usr/bin/env python3
"""本地小服务：包装抠底 + 打标，提供 /ingest 与静态资源。

POST /ingest
  req: multipart file（字段名 file）
  res: { "item": {...}, "white_image": "...", "raw_image": "...", "state": "committed" }
       | { "state": "pending_review", "pending_id": "...", "reason": "..." }
  err: 500 + { "stage": "cut|tag", "message": "..." }

其它接口:
  GET  /                        → web/index.html
  GET  /api/items               → 读 data/items.json
  POST /api/reason              → { story, items[], vibe } → { reason }
  POST /api/items/manual        → 手动补标后写回 items.json
  GET  /api/pending             → 读 data/pending.json（试穿照/不确定图）
  POST /api/pending/<id>/commit → pending → items.json（人工确认）
  POST /api/pending/<id>/skip   → pending → 丢弃
"""
from __future__ import annotations

import json
import mimetypes
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from remove_bg import remove_bg_to  # noqa: E402
import build_offline_data  # noqa: E402  （写完 items.json 顺手重建离线快照）
from tag_image import _load_env as tag_load_env  # noqa: E402
from tag_image import _md5_file, _sanitize, _dominant_color, _call_vlm  # noqa: E402
from write_reason import write_reason  # noqa: E402

WEB = ROOT / "web"
DATA = WEB / "data"
SAMPLES_JSON = DATA / "samples.json"
UPLOADS = ROOT / "uploads"
CUTS = ROOT / "cache" / "cuts"
TAGGED = ROOT / "cache" / "tagged"
CACHE_FIND = ROOT / "cache" / "find"
ITEMS_JSON = DATA / "items.json"
PENDING_JSON = DATA / "pending.json"

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
    # 顺手刷新 web/data/offline.js：file:// 双击打开时浏览器不许 fetch，
    # 衣橱数据只能靠这份 <script> 快照。放在同一个写入口，两者就不会走岔。
    try:
        build_offline_data.build(quiet=True)
    except Exception:
        pass  # 快照只是兜底，失败绝不能影响入柜


def _load_pending() -> list:
    if not PENDING_JSON.exists():
        return []
    try:
        data = json.loads(PENDING_JSON.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_pending(pending: list) -> None:
    PENDING_JSON.parent.mkdir(parents=True, exist_ok=True)
    PENDING_JSON.write_text(json.dumps(pending, ensure_ascii=False, indent=2), encoding="utf-8")


def _new_id() -> str:
    return "w" + format(int(time.time() * 1000) % 10000, "04d")


def _load_samples() -> list:
    """内置示例衣物图（无素材时可直接入柜跑通主链路）。"""
    if not SAMPLES_JSON.exists():
        return []
    try:
        data = json.loads(SAMPLES_JSON.read_text(encoding="utf-8"))
        return data.get("samples", []) if isinstance(data, dict) else []
    except json.JSONDecodeError:
        return []


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


EMPTY_TAGS = {
    "category": None,
    "type": None,
    "color_name": None,
    "color_hex": None,
    "palette": [],
    "fit": None,
    "pattern": None,
    "material": None,
    "season": [],
    "style_tags": [],
    "occasions": [],
    "formality": 3,
}


def _save_raw(file_bytes: bytes, filename: str, min_side: int = 480) -> Path:
    """校验 + 落盘原图，返回 uploads 里的路径。不满足录入规范直接抛 ValueError。"""
    if len(file_bytes) > 10 * 1024 * 1024:
        raise ValueError("图片过大，请压缩到 10MB 以内")
    if len(file_bytes) < 1024:
        raise ValueError("文件过小，不是有效图片")

    UPLOADS.mkdir(parents=True, exist_ok=True)
    ext = Path(filename).suffix or ".jpg"
    raw_path = UPLOADS / f"{uuid.uuid4().hex}{ext}"
    raw_path.write_bytes(file_bytes)

    try:
        from PIL import Image

        with Image.open(raw_path) as probe:
            w, h = probe.size
        if min(w, h) < min_side:
            raw_path.unlink(missing_ok=True)
            raise ValueError(f"分辨率过低（{w}×{h}），短边需 ≥ {min_side}px")
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001
        raw_path.unlink(missing_ok=True)
        raise ValueError(f"无法解码图片：{exc}") from exc
    return raw_path


def _cut_and_tag(raw_path: Path) -> dict:
    """对一张已落盘的原图执行「抠底 → 打标」，不写 items.json。"""
    CUTS.mkdir(parents=True, exist_ok=True)
    TAGGED.mkdir(parents=True, exist_ok=True)

    cut_png = CUTS / f"{raw_path.stem}_cut.png"
    white_jpg = CUTS / f"{raw_path.stem}_white.jpg"

    cut_ok = False
    try:
        cut_ok = remove_bg_to(raw_path, cut_png, white_jpg)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"抠底失败：{exc}") from exc

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

    tags = _sanitize(raw_tags) if raw_tags else dict(EMPTY_TAGS)

    try:
        hex_color = _dominant_color(display_img)
        if hex_color:
            tags["color_hex"] = hex_color
    except Exception:  # noqa: BLE001
        pass

    return {
        "tags": tags,
        "cut_ok": cut_ok,
        "tag_ok": bool(raw_tags),
        "cut_png": cut_png,
        "white_jpg": white_jpg,
        "raw_path": raw_path,
        "cache_file": cache_file,
    }


SCENE_PROMPT = (
    "你是图像场景判断员。看这张图，只返回 JSON，不要 Markdown 围栏，不要解释。\n"
    "{\n"
    '  "has_person": true|false,\n'
    '  "scene": "model_wearing|hanger_layflat|isolated_product|other",\n'
    '  "confidence": 0.0-1.0\n'
    "}\n"
    "判别规则：\n"
    "- 有真人上半身/试穿 → has_person=true, scene=model_wearing\n"
    "- 只有单品，挂拍或平铺 → has_person=false, scene=hanger_layflat\n"
    "- 只有单品，干净白底/纯色底商品图 → has_person=false, scene=isolated_product\n"
    "- 其他看不清的 → has_person=false, scene=other, confidence 调低"
)


def _detect_has_person(image_path: Path) -> dict:
    """轻量级 VLM 场景探测：判断是否「试穿照 / 模特上身照」。

    返回 {has_person: bool, scene: str, confidence: float, error?: str}。
    VLM 失败或不可用时返回 has_person=False（保守放行，让原 cut+tag 链路兜底）。
    """
    import base64 as _b64

    tag_load_env()
    base = os.environ.get("VLM_BASE_URL", "").rstrip("/")
    key = os.environ.get("VLM_API_KEY", "")
    model = os.environ.get("VLM_MODEL", "qwen-vl-max")
    if not base or not key or key.startswith("sk-xxxx"):
        return {"has_person": False, "scene": "unknown", "confidence": 0.0, "error": "vlm_unavailable"}

    try:
        data_url = "data:image/png;base64," + _b64.b64encode(image_path.read_bytes()).decode("ascii")
        payload = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": SCENE_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }],
            "temperature": 0.0,
        }
        ctx = ssl.create_default_context()
        req = urllib.request.Request(
            base + "/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        parsed = _parse_json_loose(content) or {}
        return {
            "has_person": bool(parsed.get("has_person", False)),
            "scene": str(parsed.get("scene", "unknown")),
            "confidence": float(parsed.get("confidence", 0.0)),
        }
    except Exception as exc:  # noqa: BLE001
        return {"has_person": False, "scene": "unknown", "confidence": 0.0, "error": f"{type(exc).__name__}: {exc}"}


def _parse_json_loose(text: str) -> dict | None:
    """从 VLM 输出里抠 JSON。"""
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


def _prune_uploads(hours: int = 24) -> None:
    """清掉超期未入柜的待处理原图（用户中途取消会留下 pending 文件）。"""
    if not UPLOADS.exists():
        return
    cutoff = time.time() - hours * 3600
    for p in UPLOADS.iterdir():
        try:
            if p.is_file() and p.stat().st_mtime < cutoff:
                p.unlink()
        except OSError:
            pass


def prepare(file_bytes: bytes, filename: str, min_side: int = 480) -> dict:
    """只跑「抠底 → 打标」，不入柜。供联网搜图先拿到结构化标签。"""
    tag_load_env()
    _prune_uploads()
    raw_path = _save_raw(file_bytes, filename, min_side=min_side)
    st = _cut_and_tag(raw_path)
    return {
        "pending": raw_path.stem,
        "tags": st["tags"],
        "cut_ok": st["cut_ok"],
        "tag_ok": st["tag_ok"],
        "white_image": str(st["white_jpg"]).replace("\\", "/") if st["white_jpg"].exists() else None,
        "raw_image": str(raw_path).replace("\\", "/"),
    }


def _find_raw(pending: str) -> Path | None:
    for p in UPLOADS.iterdir() if UPLOADS.exists() else []:
        if p.stem == pending:
            return p
    return None


def commit(pending: str, found_path: str = "", tags_override: dict | None = None) -> dict:
    """把待入柜的原图正式写进 items.json。

    found_path 非空时，用「联网搜到的白底图」替换原图再走一遍抠底+打标
    （联网搜图与原抠底是互补的两条路，最终都汇到同一条入库链路）。
    """
    tag_load_env()
    raw_path = _find_raw(pending)
    if raw_path is None:
        return {"error": "commit", "message": "待入柜记录已过期，请重新上传"}

    if found_path:
        src = Path(found_path)
        if not src.is_file():
            return {"error": "commit", "message": "联网图已失效，请重试"}
        # 顶掉原图：联网白底图直接作为新的原始素材
        target = raw_path.with_suffix(src.suffix or ".jpg")
        try:
            target.write_bytes(src.read_bytes())
            if target != raw_path:
                raw_path.unlink(missing_ok=True)
            raw_path = target
        except OSError as exc:
            return {"error": "commit", "message": f"写入联网图失败：{exc}"}

    st = _cut_and_tag(raw_path)
    tags = dict(st["tags"])
    if tags_override:
        # 用户/前端确认过的标签优先（例如手动补标）
        tags.update({k: v for k, v in tags_override.items() if v not in (None, "", [])})

    item_id = _new_id()
    image_rel = _ensure_image_asset(item_id, st["cut_png"] if st["cut_png"].exists() else raw_path)

    item = {
        "id": item_id,
        "image": image_rel,
        **tags,
        "source": "web" if found_path else ("ai" if st["tag_ok"] else "manual"),
        "manual_override": not st["tag_ok"],
        "cut_ok": st["cut_ok"],
    }
    if found_path:
        item["from_web_search"] = True

    items = _load_items()
    items.append(item)
    _save_items(items)

    try:
        st["cache_file"].write_text(
            json.dumps({**tags, "source": item["source"]}, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        pass

    return {
        "item": item,
        "white_image": str(st["white_jpg"]).replace("\\", "/") if st["white_jpg"].exists() else None,
        "raw_image": str(raw_path).replace("\\", "/"),
        "tag_ok": st["tag_ok"],
    }


def ingest(file_bytes: bytes, filename: str) -> dict:
    """一步到位：抠底 → 场景探测 → (试穿照)写 pending | (单品)直接入柜。

    决策：
    - VLM 不可用 → 保守按 has_person=False 走 commit（原链路）
    - VLM 判 has_person=True → 写 data/pending.json，state=pending_review
    - VLM 判 has_person=False → 直接 commit，state=committed
    """
    try:
        pre = prepare(file_bytes, filename)
    except ValueError as exc:
        return {"error": "cut", "message": str(exc)}

    pending_id = pre["pending"]
    raw_path = _find_raw(pending_id)
    if raw_path is None:
        return {"error": "commit", "message": "待入柜记录已过期，请重新上传"}

    # 场景探测：用 cut 后图（更小、更聚焦）
    display_img = None
    white_jpg = CUTS / f"{pending_id}_white.jpg"
    cut_png = CUTS / f"{pending_id}_cut.png"
    if white_jpg.exists():
        display_img = white_jpg
    elif cut_png.exists():
        display_img = cut_png
    else:
        display_img = raw_path

    scene = _detect_has_person(display_img) if display_img else {"has_person": False, "scene": "unknown"}

    # 试穿照 → 进 pending
    if scene.get("has_person"):
        pending_entry = {
            "id": pending_id,
            "added_at": time.time(),
            "raw_image": pre["raw_image"],
            "white_image": pre["white_image"],
            "cut_image": str(display_img).replace("\\", "/") if display_img else None,
            "tags": pre["tags"],
            "cut_ok": pre["cut_ok"],
            "tag_ok": pre["tag_ok"],
            "scene": scene,
            "filename": filename,
            "reason": "VLM 判定为试穿照/模特上身照，需要人工确认或换拍干净背景图",
        }
        pending = _load_pending()
        # 去重（同一张图已存在则跳过）
        if not any(p.get("id") == pending_id for p in pending):
            pending.append(pending_entry)
            _save_pending(pending)
        return {
            "state": "pending_review",
            "pending_id": pending_id,
            "scene": scene,
            "reason": pending_entry["reason"],
            "raw_image": pre["raw_image"],
            "white_image": pre["white_image"],
            "tags": pre["tags"],
            "cut_ok": pre["cut_ok"],
            "tag_ok": pre["tag_ok"],
        }

    # 单品图 → 直接 commit
    res = commit(pending_id)
    if "error" in res:
        return res
    return {**res, "state": "committed"}


def find_image(tags: dict) -> dict:
    """S2.5 联网找白底同款图。任何异常都退化成 ok:false，由调用方回落抠底。"""
    tag_load_env()
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from find_product_image import CACHE, find  # noqa: PLC0415

        res = find(tags=tags, limit=16)
        # 候选图补上可访问的 URL（cache 目录不在 web 下，走专用路由）
        for c in res.get("candidates", []) or []:
            try:
                rel = Path(c["path"]).resolve().relative_to(CACHE.resolve())
                c["url"] = "/api/findimg/" + str(rel).replace("\\", "/")
            except (ValueError, KeyError, OSError):
                c["url"] = ""
        if res.get("path"):
            try:
                rel = Path(res["path"]).resolve().relative_to(CACHE.resolve())
                res["url"] = "/api/findimg/" + str(rel).replace("\\", "/")
            except (ValueError, OSError):
                res["url"] = ""
        return res
    except Exception as exc:  # noqa: BLE001
        print(f"find_image failed: {type(exc).__name__} {exc}", file=sys.stderr)
        return {"ok": False, "message": f"联网搜图不可用：{type(exc).__name__}"}


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

        # 联网搜图的候选缩略图（cache/find/** 不在 web 目录下，单独开一条只读路由）
        if path.startswith("/api/findimg/"):
            rel = path[len("/api/findimg/"):]
            target = (CACHE_FIND / rel).resolve()
            try:
                inside = str(target).startswith(str(CACHE_FIND.resolve()))
            except OSError:
                inside = False
            if inside and target.is_file():
                self._send_file(target)
            else:
                self._send_json(404, {"message": "not found"})
            return

        if path == "/api/samples":
            samples = _load_samples()
            self._send_json(200, {
                "samples": [
                    {
                        "id": s.get("id"),
                        "title": s.get("title"),
                        "desc": s.get("desc"),
                        "url": s.get("file"),
                        "tags": s.get("tags") or {},
                    }
                    for s in samples
                ]
            })
            return

        # 试穿照/待确认区
        if path == "/api/pending":
            self._send_json(200, {"pending": _load_pending()})
            return

        # 静态：uploads 与 cache/cuts（让前端能预览待确认项的原图/抠底图）
        if path.startswith("/uploads/") or path.startswith("/cache/cuts/"):
            rel = path.lstrip("/")
            for root, prefix in ((UPLOADS, "uploads/"), (CUTS, "cache/cuts/")):
                if not rel.startswith(prefix):
                    continue
                sub = rel[len(prefix):]
                target = (root / sub).resolve()
                try:
                    inside_root = str(target).startswith(str(root.resolve()))
                except OSError:
                    inside_root = False
                if inside_root and target.is_file():
                    self._send_file(target)
                    return
            self._send_json(404, {"message": "not found"})
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

        # --- 联网搜白底图链路（与本地抠底互补：先打标 → 搜图 → 人工确认 → 入柜）---
        if path == "/api/prepare":
            # 只抠底 + 打标，不入柜；返回 pending 供后续 commit 使用
            try:
                file_bytes, filename = _parse_multipart(body, ctype)
            except ValueError as exc:
                self._send_json(400, {"stage": "cut", "message": str(exc)})
                return
            try:
                result = prepare(file_bytes, filename)
            except ValueError as exc:
                self._send_json(500, {"stage": "cut", "message": str(exc)})
                return
            except Exception as exc:  # noqa: BLE001
                self._send_json(500, {"stage": "cut", "message": str(exc)})
                return
            self._send_json(200, result)
            return

        if path == "/api/find_image":
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                data = {}
            self._send_json(200, find_image(data.get("tags") or {}))
            return

        if path == "/api/commit":
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                data = {}
            result = commit(
                data.get("pending") or "",
                found_path=data.get("found_path") or "",
                tags_override=data.get("tags"),
            )
            if "error" in result:
                self._send_json(500, {"stage": result["error"], "message": result["message"]})
                return
            self._send_json(200, result)
            return

        # --- 待确认区管理：把 pending 项强制 commit / skip ---
        if path.startswith("/api/pending/") and (path.endswith("/commit") or path.endswith("/skip")):
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                data = {}
            parts = path[len("/api/pending/"):].rstrip("/").split("/")
            if len(parts) != 2:
                self._send_json(400, {"message": "path 应为 /api/pending/<id>/commit 或 /skip"})
                return
            pid, action = parts
            pending_list = _load_pending()
            entry = next((p for p in pending_list if p.get("id") == pid), None)
            if not entry:
                self._send_json(404, {"message": f"pending {pid} not found"})
                return

            if action == "skip":
                pending_list = [p for p in pending_list if p.get("id") != pid]
                _save_pending(pending_list)
                self._send_json(200, {"skipped": pid})
                return

            # commit：把 pending 项的 raw_image 拿出来走 commit(pending=stem)
            raw_image_str = entry.get("raw_image", "")
            raw_path = (ROOT / raw_image_str).resolve() if raw_image_str else None
            if not raw_path or not raw_path.exists():
                candidates = list(UPLOADS.glob(f"{pid}*")) if UPLOADS.exists() else []
                if not candidates:
                    self._send_json(410, {"message": "原始上传已过期，请重新上传"})
                    return
                raw_path = candidates[0]
            tags_override = data.get("tags") if isinstance(data.get("tags"), dict) else None
            try:
                stem = raw_path.stem
                result = commit(stem, found_path="", tags_override=tags_override)
            except Exception as exc:
                self._send_json(500, {"stage": "commit", "message": str(exc)})
                return
            if "error" in result:
                self._send_json(500, {"stage": result["error"], "message": result["message"]})
                return
            pending_list = [p for p in pending_list if p.get("id") != pid]
            _save_pending(pending_list)
            self._send_json(200, {"committed": pid, "item": result.get("item")})
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

        if path == "/api/ingest_sample":
            # 无素材时：把内置示例图当作一次真实上传走完整 ingest（抠底 + VLM 打标 + 入柜）
            try:
                data = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                data = {}
            sid = data.get("id")
            sample = next((s for s in _load_samples() if s.get("id") == sid), None)
            if not sample:
                self._send_json(404, {"message": "sample not found"})
                return
            sample_path = WEB / str(sample.get("file", ""))
            if not sample_path.is_file():
                self._send_json(404, {"message": "sample file missing"})
                return
            try:
                result = ingest(sample_path.read_bytes(), sample_path.name)
            except Exception as exc:  # noqa: BLE001
                self._send_json(500, {"stage": "cut", "message": str(exc)})
                return
            if "error" in result:
                self._send_json(500, {"stage": result["error"], "message": result["message"]})
                return
            # 打标失败时回落到 samples.json 里预置的标签，保证流程仍可继续
            if not result.get("tag_ok"):
                for key, val in (sample.get("tags") or {}).items():
                    result["item"].setdefault(key, val)
                result["item"]["source"] = "sample-preset"
                items = _load_items()
                for it in items:
                    if it.get("id") == result["item"]["id"]:
                        it.update(result["item"])
                _save_items(items)
                result["tag_ok"] = True
            self._send_json(200, result)
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
                        "pattern", "material", "season", "style_tags",
                        "occasions", "formality",
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
