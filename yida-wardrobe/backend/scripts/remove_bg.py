#!/usr/bin/env python3
"""S1 抠底：原图 → 透明 PNG，可选合成白底图。

接口约定:
  python remove_bg.py <in.jpg> <out.png> [--white out_white.jpg]

失败兜底: 抠图异常时直接把原图当单品图继续走，并标记 cut_ok: false。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def _composite_white(cut, white: Path | None) -> None:
    from PIL import Image

    if white is None:
        return
    canvas = Image.new("RGBA", cut.size, (255, 255, 255, 255))
    canvas.alpha_composite(cut)
    canvas.convert("RGB").save(white)


def _rembg_model_ready(model: str = "u2net") -> bool:
    """模型文件已在本地才走 rembg，避免现场卡在下载。"""
    home = Path.home() / ".rembg" / "models"
    candidates = [
        home / model / f"{model}.onnx",
        home / model / "bria-rmbg.onnx",
        home / "u2net" / "u2net.onnx",
        home / "u2netp" / "u2netp.onnx",
    ]
    return any(p.exists() and p.stat().st_size > 1024 for p in candidates)


def _pick_rembg_model() -> str:
    home = Path.home() / ".rembg" / "models"
    for name in ("u2netp", "u2net", "bria-rmbg"):
        for p in (home / name / f"{name}.onnx", home / name / "bria-rmbg.onnx"):
            if p.exists() and p.stat().st_size > 1024:
                return name if name != "bria-rmbg" else "bria-rmbg"
    return "u2netp"


def _remove_with_rembg(src: Path, dst: Path, white: Path | None) -> bool:
    model = _pick_rembg_model()
    if not _rembg_model_ready(model):
        raise RuntimeError("rembg model not local; skip download")

    from rembg import remove, new_session
    from PIL import Image

    img = Image.open(src).convert("RGBA")
    session = new_session(model)
    cut = remove(img, session=session)
    cut.save(dst)
    _composite_white(cut, white)
    return True


def _fallback_simple_cut(src: Path, dst: Path, white: Path | None) -> bool:
    """高质量纯视觉抠底：边缘连通背景洪水填充 + 软边 + 最大连通主体。

    比「全局按颜色抠」稳：红鞋/红底不会被整块挖穿，只去掉与边缘连通的背景。
    """
    from collections import deque

    import numpy as np
    from PIL import Image, ImageFilter

    img = Image.open(src).convert("RGB")
    # 大图先缩小再算 mask，再放回，速度/质量平衡
    max_side = 1024
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

    arr = np.asarray(img, dtype=np.int16)
    h, w = arr.shape[:2]

    # 边缘条带估背景色（中位数，抗噪）
    band = max(2, min(h, w) // 40)
    edges = np.concatenate(
        [
            arr[:band].reshape(-1, 3),
            arr[-band:].reshape(-1, 3),
            arr[:, :band].reshape(-1, 3),
            arr[:, -band:].reshape(-1, 3),
        ],
        axis=0,
    )
    bg = np.median(edges, axis=0)

    # 与背景的近似感知距离
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))

    # 自适应阈值：按边缘距离分位数收紧/放宽
    thr = float(np.percentile(dist, 18))
    thr = max(18.0, min(thr, 55.0))
    bg_like = dist <= thr

    # 从边界 BFS：只把「与边界连通的 bg_like」当背景
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg_like[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg_like[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and bg_like[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    # 前景 = 非背景连通；内部同色洞保留（鞋面/衣身与背景同色但不连通边界）
    fg = ~visited

    # 去掉前景里的小噪点（面积过小的连通块当噪声）
    # 简单实现：仅保留最大连通块 + 面积 > 0.3% 全图 的块
    def components(mask: np.ndarray) -> list[np.ndarray]:
        seen = np.zeros_like(mask, dtype=bool)
        blocks = []
        ys, xs = np.where(mask)
        for y0, x0 in zip(ys, xs):
            if seen[y0, x0]:
                continue
            comp = np.zeros_like(mask, dtype=bool)
            dq = deque([(y0, x0)])
            seen[y0, x0] = True
            comp[y0, x0] = True
            while dq:
                cy, cx = dq.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        comp[ny, nx] = True
                        dq.append((ny, nx))
            blocks.append(comp)
        return blocks

    blocks = components(fg)
    if blocks:
        blocks.sort(key=lambda m: int(m.sum()), reverse=True)
        min_px = max(64, int(h * w * 0.003))
        keep = np.zeros_like(fg)
        for b in blocks:
            if int(b.sum()) >= min_px:
                keep |= b
        # 至少保留最大块
        if not keep.any():
            keep = blocks[0]
        fg = keep

    # 软边：用距离背景阈值的过渡做 alpha
    soft = np.clip((dist - thr) / max(thr * 0.65, 1.0), 0.0, 1.0)
    alpha = np.where(fg, np.maximum(soft, 0.35), 0.0)
    # 边界一圈羽化
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8), mode="L")
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.8))
    alpha = np.asarray(alpha_img, dtype=np.float32) / 255.0
    alpha = np.where(fg | (alpha > 0.08), alpha, 0.0)
    # 主体核心区打满
    core = fg & (dist > thr * 1.2)
    alpha[core] = 1.0

    rgba = np.dstack([arr.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    out = Image.fromarray(rgba, mode="RGBA")
    # 若处理时缩小过，放大回原尺寸
    if out.size != Image.open(src).size:
        out = out.resize(Image.open(src).size, Image.Resampling.LANCZOS)
    out.save(dst)
    _composite_white(out, white)
    return True


def _fallback_passthrough(src: Path, dst: Path, white: Path | None) -> bool:
    """最后兜底：原图直接当单品图，标记 cut_ok=false。"""
    from PIL import Image

    img = Image.open(src).convert("RGBA")
    img.save(dst)
    _composite_white(img, white)
    return False


def remove_bg_to(src: Path, dst: Path, white: Path | None = None) -> bool:
    """统一入口：rembg → 边缘连通抠底 → 原图透传。返回 cut_ok。"""
    try:
        return _remove_with_rembg(src, dst, white)
    except Exception as exc:  # noqa: BLE001
        print(f"rembg failed: {exc}; trying flood-cut", file=sys.stderr)
    try:
        return _fallback_simple_cut(src, dst, white)
    except Exception as exc:  # noqa: BLE001
        print(f"flood-cut failed: {exc}; passthrough", file=sys.stderr)
    try:
        return _fallback_passthrough(src, dst, white)
    except Exception as exc:  # noqa: BLE001
        print(f"passthrough failed: {exc}", file=sys.stderr)
        raise


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: python remove_bg.py <in.jpg> <out.png> [--white out_white.jpg]", file=sys.stderr)
        return 2

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    white = None
    if "--white" in sys.argv:
        idx = sys.argv.index("--white")
        if idx + 1 >= len(sys.argv):
            print("--white needs a path", file=sys.stderr)
            return 2
        white = Path(sys.argv[idx + 1])

    src.parent.mkdir(parents=True, exist_ok=True)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if white is not None:
        white.parent.mkdir(parents=True, exist_ok=True)

    cut_ok = False
    try:
        cut_ok = remove_bg_to(src, dst, white)
    except Exception as exc:  # noqa: BLE001
        print(f"remove_bg failed: {exc}", file=sys.stderr)
        return 1

    # 机器可读结果，供 /ingest 读取
    result = {"cut_ok": cut_ok, "out": str(dst), "white": str(white) if white else None}
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
