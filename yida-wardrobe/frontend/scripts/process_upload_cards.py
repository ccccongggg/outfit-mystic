#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
process_upload_cards.py — 把豆包 AI 生成的悬挂卡图处理成透明底卡片资产。

来源: e:/Xian_open_Hacthon/outfit-mystic/web/assets/cards/{light,dark}_{tarot,social,identity,style,more}.png
      1295x3238 RGB 不透明底（light 浅底 / dark 近黑底），底部有死区与「豆包 AI 生成」水印。
去向: wardrobe-app/assets/cards/ 同名 10 张（透明底、宽约 400px、调色板压缩 PNG）。
旧图由 build_hanging_cards.py 生成、可再生，直接覆盖不备份。

管线（为什么这么做）:
  1. bg = 图像外圈 2px 环的中位数 —— 每张底色略有差异，逐图取样不写死。
  2. soft_alpha = smoothstep(t_lo, t_hi, d)，d = 与 bg 的 RGB 欧氏距离（算 d 前 RGB 预模糊压底噪）。
     用软阈值而非硬阈值：light_social 牌面与底色几乎同色（d≈8.8），硬阈值会把牌面吃掉。
  3. 塌洞填充：洪水只走非实心像素（从图像边界进），到不了的非实心区域 = 被描金边/链条
     封环包住的牌面内部 → α=1。描金边 d≈120（实心）封环挡洪水，是牌面存活的关键。
     洪水跑在 1/4 尺寸掩膜上（块内任一实心即视为实心 = 保守防漏），纯 numpy/python，无 scipy。
  4. α 轻微高斯羽化消锯齿，低于 0.06 的残余归零（干净透明边）。
  5. 裁切：行/列按 α>0.25 覆盖率 ≥1% 取『最大连续段』为内容主体——底部水印被 400+px 死区
     隔成独立短段，自动排除；bbox 外扩 4% 边距。
  6. 预乘 alpha 后 LANCZOS 缩到宽 400px，再反预乘（避免缩放黑/白边），调色板 256 色压缩（无抖动）。

依赖: 仅 PIL + numpy（环境无 scipy）。
用法: python scripts/process_upload_cards.py   （在 wardrobe-app/ 下执行，或任意 cwd）
"""

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "outfit-mystic" / "web" / "assets" / "cards"
DST = ROOT / "wardrobe-app" / "assets" / "cards"

NAMES = ["tarot", "social", "identity", "style", "more"]
# (t_lo, t_hi)：light 底浅、牌面 d≈8.8~17.5；dark 有暗角 d≈19.5，阈值整体上移
THEME_TH = {"light": (8.0, 35.0), "dark": (22.0, 45.0)}

FLOOD_SOLID_TH = 0.5   # 洪水挡板阈值（只影响塌洞，不影响输出 alpha）
HOLE_FILL = 1.0        # 被封环包住的内部 → 全不透明
FEATHER = 1.2          # 高斯羽化半径（全分辨率）
PRE_BLUR = 2.0         # 算 d 前对 RGB 预模糊（压制底噪，防软 α 盐噪）
ALPHA_FLOOR = 0.06     # α 下限清噪（羽化后低于此值归零，边缘干净）
RUN_TH = 0.01          # 行/列内容段的覆盖率下限（取最大连续段；水印被底部死区隔成更短的段，自动排除）
COV_ALPHA_TH = 0.25    # 覆盖率统计用的 alpha 下限（把暗角噪声 d≈10~20 的假内容挡掉）
MARGIN = 0.04          # bbox 外扩边距（相对 bbox 尺寸）
TARGET_W = 400
QUANTIZE = 256         # 调色板压缩（软光晕渐变在 120px 显示尺寸下无可见损失）
NO_DITHER = getattr(Image, "Dither", Image).NONE  # 抖动会在软 α 上产生盐噪，关闭
FLOOD_SCALE = 4        # 洪水掩膜降采样倍率


def smoothstep(t_lo, t_hi, d):
    x = np.clip((d - t_lo) / (t_hi - t_lo), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def edge_bg_color(arr):
    ring = np.concatenate([
        arr[:2].reshape(-1, 3), arr[-2:].reshape(-1, 3),
        arr[:, :2].reshape(-1, 3), arr[:, -2:].reshape(-1, 3),
    ])
    return np.median(ring, axis=0)


def enclosed_holes(solid):
    """在 1/4 尺寸掩膜上从边界洪水（只走非实心），返回全尺寸的『被包围内部』掩膜。"""
    h, w = solid.shape
    sh, sw = (h + FLOOD_SCALE - 1) // FLOOD_SCALE, (w + FLOOD_SCALE - 1) // FLOOD_SCALE
    pad = np.zeros((sh * FLOOD_SCALE, sw * FLOOD_SCALE), dtype=bool)
    pad[:h, :w] = solid
    blocked = pad.reshape(sh, FLOOD_SCALE, sw, FLOOD_SCALE).any(axis=(1, 3))  # 任一实心即挡

    outside = np.zeros((sh, sw), dtype=bool)
    q = deque()

    def push(y, x):
        if not blocked[y, x] and not outside[y, x]:
            outside[y, x] = True
            q.append((y, x))

    for x in range(sw):
        push(0, x)
        push(sh - 1, x)
    for y in range(sh):
        push(y, 0)
        push(y, sw - 1)
    while q:
        y, x = q.popleft()
        if y > 0:
            push(y - 1, x)
        if y + 1 < sh:
            push(y + 1, x)
        if x > 0:
            push(y, x - 1)
        if x + 1 < sw:
            push(y, x + 1)

    outside_full = np.repeat(np.repeat(outside, FLOOD_SCALE, axis=0), FLOOD_SCALE, axis=1)[:h, :w]
    return (~outside_full) & (~solid)


def largest_run(flags):
    """最大的连续 True 段 (start, end)。"""
    best = (0, 0)
    i, n = 0, len(flags)
    while i < n:
        if flags[i]:
            j = i
            while j < n and flags[j]:
                j += 1
            if j - i > best[1] - best[0]:
                best = (i, j)
            i = j
        else:
            i += 1
    return best


def content_bbox(alpha):
    cov = alpha > COV_ALPHA_TH
    y0, y1 = largest_run(cov.mean(axis=1) >= RUN_TH)
    x0, x1 = largest_run(cov[y0:y1].mean(axis=0) >= RUN_TH)
    if y1 <= y0 or x1 <= x0:
        return 0, 0, alpha.shape[1], alpha.shape[0]
    my = int((y1 - y0) * MARGIN)
    mx = int((x1 - x0) * MARGIN)
    return max(0, x0 - mx), max(0, y0 - my), min(alpha.shape[1], x1 + mx), min(alpha.shape[0], y1 + my)


def resize_premultiplied(rgb, alpha, target_w):
    h, w = alpha.shape
    target_h = max(1, round(h * target_w / w))
    a3 = alpha[..., None]
    pm = Image.fromarray(np.clip(rgb * a3, 0, 255).astype(np.uint8), "RGB")
    am = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8), "L")
    pm_r = np.asarray(pm.resize((target_w, target_h), Image.LANCZOS), dtype=np.float64) / 255.0
    a_r = np.asarray(am.resize((target_w, target_h), Image.LANCZOS), dtype=np.float64) / 255.0
    safe = np.maximum(a_r, 1e-6)[..., None]
    rgb_r = np.clip(pm_r / safe * 255.0, 0, 255)
    return rgb_r, a_r


def process(theme, name):
    src = SRC / f"{theme}_{name}.png"
    img = Image.open(src).convert("RGB")
    arr = np.asarray(img, dtype=np.float64)
    h, w = arr.shape[:2]

    bg = edge_bg_color(arr)
    arr_b = np.asarray(
        Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(PRE_BLUR)),
        dtype=np.float64,
    )
    d = np.sqrt(((arr_b - bg) ** 2).sum(axis=2))
    t_lo, t_hi = THEME_TH[theme]
    alpha = smoothstep(t_lo, t_hi, d)

    holes = enclosed_holes(alpha > FLOOD_SOLID_TH)
    alpha[holes] = HOLE_FILL

    am = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8), "L")
    am = am.filter(ImageFilter.GaussianBlur(FEATHER))
    alpha = np.asarray(am, dtype=np.float64) / 255.0
    alpha[alpha < ALPHA_FLOOR] = 0.0

    x0, y0, x1, y1 = content_bbox(alpha)
    rgb = arr[y0:y1, x0:x1]
    alpha = alpha[y0:y1, x0:x1]

    rgb_r, a_r = resize_premultiplied(rgb, alpha, TARGET_W)
    out = np.dstack([rgb_r, np.clip(a_r * 255, 0, 255)]).astype(np.uint8)
    dst = DST / f"{theme}_{name}.png"
    rgba = Image.fromarray(out, "RGBA")
    if QUANTIZE:
        rgba = rgba.quantize(colors=QUANTIZE, method=Image.FASTOCTREE, dither=NO_DITHER)
    rgba.save(dst, "PNG", optimize=True)
    return dst, (x1 - x0, y1 - y0), (a_r.shape[1], a_r.shape[0]), int(holes.sum()), dst.stat().st_size


def main():
    DST.mkdir(parents=True, exist_ok=True)
    total = 0
    for theme in ("light", "dark"):
        for name in NAMES:
            dst, crop, out_wh, holes, kb = process(theme, name)
            total += kb
            print(f"{theme}_{name}: crop={crop[0]}x{crop[1]} -> {out_wh[0]}x{out_wh[1]}  holes={holes}px  {kb // 1024}KB  {dst}")
    print(f"total = {total // 1024}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
