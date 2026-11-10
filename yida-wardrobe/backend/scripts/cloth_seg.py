#!/usr/bin/env python3
"""SegFormer-B2 人体解析「衣物分割」：真人上身照 -> 上衣 / 下装 / 连衣裙 掩膜。

模型权重: ~/.rembg/models/segformer_b2_clothes/model.onnx
  来源 mattmdjaga/segformer_b2_clothes（18 类 human parsing，ONNX 导出）。
  标签: 0 Background / 1 Hat / 2 Hair / 3 Sunglasses / 4 Upper-clothes / 5 Skirt /
        6 Pants / 7 Dress / 8 Belt / 9,10 Shoe / 11 Face / 12,13 Leg /
        14,15 Arm / 16 Bag / 17 Scarf

与 scripts/remove_bg.py 的分工:
  remove_bg.py 用 u2netp 抠「整个人」（含脸 / 头发 / 鞋），产出白底商品图；
  本模块抠「衣物本体」，把人脸 / 头发 / 皮肤 / 背景全部剔除，用于从街拍
  反推单品，并顺带算出可直接喂给 web/vocab.js 受控词表的颜色 / 廓形特征。

四个关键处理（少一个就出废图）:
  1. letterbox 保比例 —— 街拍多为 3:4 竖图，直接 resize 成 512² 会把横向拉伸
     33%，模型会把手臂 / 手里的道具糊进衣服。改成等比缩放 + 灰边填充。
  2. 两遍 ROI 精修 —— 全身照里人在 512² 画布上只有 ~200px 高，细节全糊。
     第一遍整图找人 -> 裁人物框 -> 第二遍在人物区域以 768² 重跑，等效分辨率
     提升约 3 倍，边缘和「手 / 道具」这类混淆区明显变干净。
  3. 遮挡补洞 —— 手臂 / 手横在衣服前会挖出洞。洞内像素若被判为人体（头发 /
     脸 / 手臂 / 腿）说明是「人挡着衣服」，补满；若被判为背景说明是「裤腿之间的
     真空隙」，保留透明。
  4. 头发压肩 —— 长发垂在肩线外侧会啃掉衣服的肩。只对上衣 / 连衣裙做小半径
     闭运算把发丝桥接回来；下装不做，避免把两条裤腿之间的缝隙糊死。

用法:
  python scripts/cloth_seg.py <in.jpg> <outdir> [--prefix p] [--roi-size 768]
产物:
  <p>_look_white.jpg    衣物主体（上衣+下装 / 连衣裙）白底图 —— 主交付
  <p>_styled_white.jpg  含配饰（包 / 鞋 / 腰带 / 围巾）的完整造型白底图
  <p>_top_white.jpg     上装单品白底图（有则出）
  <p>_bottom_white.jpg  下装单品白底图（有则出）
  <p>_dress_white.jpg   连衣裙单品白底图（有则出）
  <p>_overlay.jpg       掩膜叠加，肉眼验收用
  <p>_cutout.png        衣物主体透明底
  <p>_features.json     颜色 / 廓形 / 占比特征（已映射到受控词表）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

MODEL_DIR = Path.home() / ".rembg" / "models" / "segformer_b2_clothes"
MODEL_PATH = MODEL_DIR / "model.onnx"

PASS1_SIZE = 512    # 整图找人
PASS2_SIZE = 768    # 人物区域精修

CLASSES = [
    "Background", "Hat", "Hair", "Sunglasses", "Upper-clothes", "Skirt", "Pants",
    "Dress", "Belt", "Left-shoe", "Right-shoe", "Face", "Left-leg", "Right-leg",
    "Left-arm", "Right-arm", "Bag", "Scarf",
]
I = {n: i for i, n in enumerate(CLASSES)}

IDS_TOP = [I["Upper-clothes"]]
IDS_BOTTOM = [I["Skirt"], I["Pants"]]
IDS_DRESS = [I["Dress"]]
IDS_GARMENT = IDS_TOP + IDS_BOTTOM + IDS_DRESS
IDS_ACCESSORY = [I["Hat"], I["Belt"], I["Left-shoe"], I["Right-shoe"], I["Bag"], I["Scarf"]]
IDS_PERSON = [I["Hair"], I["Sunglasses"], I["Face"], I["Left-leg"], I["Right-leg"],
              I["Left-arm"], I["Right-arm"]]

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# web/vocab.js 的 24 个受控色（策划口径），带近似 RGB，用于把实测主色收敛到词表
PALETTE = [
    ("奶油白", (247, 243, 233)), ("米白", (239, 231, 216)), ("纯白", (255, 255, 255)),
    ("燕麦", (228, 217, 195)), ("焦糖", (181, 118, 58)), ("浅蓝", (168, 198, 229)),
    ("牛仔蓝", (91, 127, 166)), ("雾紫", (205, 187, 238)), ("藕粉", (227, 196, 200)),
    ("玫粉", (217, 124, 155)), ("正红", (208, 43, 43)), ("酒红", (122, 34, 48)),
    ("亮黄", (242, 197, 61)), ("炭灰", (74, 74, 78)), ("纯黑", (23, 23, 26)),
    ("银灰", (185, 189, 194)), ("橄榄绿", (110, 122, 74)), ("墨绿", (36, 70, 58)),
    ("砖红", (168, 69, 47)), ("卡其", (185, 164, 131)), ("驼色", (169, 123, 79)),
    ("藏蓝", (44, 58, 92)), ("深棕", (74, 49, 38)), ("米色", (220, 205, 180)),
]

_SESSION = None


def session():
    """onnxruntime 会话（进程内复用；GPU 可用则优先 GPU）。"""
    global _SESSION
    if _SESSION is None:
        import onnxruntime as ort

        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"缺模型 {MODEL_PATH}\n"
                "下载: mkdir -p ~/.rembg/models/segformer_b2_clothes && "
                "curl -L -o ~/.rembg/models/segformer_b2_clothes/model.onnx "
                "https://hf-mirror.com/Xenova/segformer_b2_clothes/resolve/main/onnx/model.onnx"
            )
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider")
                     if p in ort.get_available_providers()]
        _SESSION = ort.InferenceSession(str(MODEL_PATH), opts, providers=providers)
    return _SESSION


def _load_rgb(path: Path) -> np.ndarray:
    from PIL import Image, ImageOps

    return np.asarray(ImageOps.exif_transpose(Image.open(path)).convert("RGB"), dtype=np.uint8)


def _letterbox(rgb: np.ndarray, size: int):
    """等比缩放进 size² 画布（灰边填充），返回 NCHW 张量 + 画布内有效区域。"""
    import cv2

    h, w = rgb.shape[:2]
    s = min(size / h, size / w)
    nw, nh = max(32, int(w * s) // 32 * 32), max(32, int(h * s) // 32 * 32)
    nw, nh = min(nw, size), min(nh, size)
    interp = cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR
    resized = cv2.resize(rgb, (nw, nh), interpolation=interp)
    canvas = np.full((size, size, 3), 127, np.uint8)
    top, left = (size - nh) // 2, (size - nw) // 2
    canvas[top:top + nh, left:left + nw] = resized
    x = (canvas.astype(np.float32) / 255.0 - MEAN) / STD
    return np.ascontiguousarray(x.transpose(2, 0, 1)[None]), (top, left, nh, nw)


def _infer(rgb: np.ndarray, size: int):
    """在 rgb 上推理，返回 (18, h, w) 概率（已升采样回 rgb 尺寸）。"""
    import cv2

    x, (top, left, nh, nw) = _letterbox(rgb, size)
    sess = session()
    logits = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]      # (18, size/4, size/4)
    logits = logits - logits.max(axis=0, keepdims=True)
    exp = np.exp(logits)
    probs = exp / exp.sum(axis=0, keepdims=True)

    # 模型输出是 1/4 分辨率，先放回 size² 画布坐标系，才能按像素对齐切掉灰边
    n_cls = probs.shape[0]
    canvas_p = np.stack([cv2.resize(probs[c], (size, size), interpolation=cv2.INTER_LINEAR)
                         for c in range(n_cls)])
    sub = canvas_p[:, top:top + nh, left:left + nw]

    h, w = rgb.shape[:2]
    full = np.stack([cv2.resize(sub[c], (w, h), interpolation=cv2.INTER_LINEAR)
                     for c in range(n_cls)])
    full /= np.maximum(full.sum(axis=0, keepdims=True), 1e-6)
    return full


def predict_probs(rgb: np.ndarray, roi: tuple[int, int, int, int] | None = None,
                  size: int = PASS2_SIZE) -> np.ndarray:
    """整图概率；给 roi=(x0,y0,x1,y1) 时只在该区域高分辨率推理并贴回全图。

    roi=None 表示「第一遍找人」模式，固定用 PASS1_SIZE（够定位人，也快）。
    """
    if roi is None:
        return _infer(rgb, PASS1_SIZE)

    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = roi
    p_sub = _infer(rgb[y0:y1, x0:x1], size)

    out = np.zeros((p_sub.shape[0], h, w), dtype=np.float32)
    out[I["Background"]] = 1.0                    # ROI 外一律当背景
    out[:, y0:y1, x0:x1] = p_sub
    out /= np.maximum(out.sum(axis=0, keepdims=True), 1e-6)
    return out


def person_roi(probs: np.ndarray, margin: float = 0.10):
    """从整图概率里取人物包围盒（非背景类之和 > 0.5）。"""
    fg = probs[1:].sum(axis=0) > 0.5
    ys, xs = np.where(fg)
    if len(ys) < 64:
        return None
    h, w = fg.shape
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    dx, dy = int((x1 - x0) * margin), int((y1 - y0) * margin)
    return (max(0, x0 - dx), max(0, y0 - dy), min(w, x1 + dx + 1), min(h, y1 + dy + 1))


def _close(mask: np.ndarray, frac: float) -> np.ndarray:
    """小半径闭运算：把压在衣服上的发丝桥接回来。"""
    import cv2

    k = max(3, int(round(min(mask.shape) * frac)) | 1)
    return cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))).astype(bool)


def _drop_specks(mask: np.ndarray, min_px: int) -> np.ndarray:
    import cv2

    n, comp, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    keep = np.zeros_like(mask)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_px:
            keep |= comp == i
    return keep if keep.any() else mask


def _fill_occlusions(hard: np.ndarray, labels: np.ndarray, min_speck: int) -> np.ndarray:
    """补「被衣服挡住的人体」——扫描线法。

    逐行（再逐列）看：一段非衣服像素，若左右都紧邻衣服、且这段自己全是人体标签
    （手臂 / 手 / 头发），说明是「人挡在衣服前面」，补上；若这段里出现背景标签，
    说明是「胳膊与身体之间的真空隙 / 两条裤腿之间的缝」，保留透明。

    为什么不用逐个连通块判断：手臂上端连着肩膀、下端伸出袖子外，整条胳膊和
    「横在毛衣前的前臂」是同一个连通块，按块判会把前臂一起放过。
    """
    fillable = np.isin(labels, IDS_PERSON)
    out = hard.copy()
    h, w = hard.shape
    for axis in (0, 1):
        g = hard if axis == 0 else hard.T
        f = fillable if axis == 0 else fillable.T
        r = out if axis == 0 else out.T
        for i in range(g.shape[0]):
            row = g[i]
            idx = np.flatnonzero(row)
            if idx.size < 2:
                continue
            lo, hi = int(idx[0]), int(idx[-1])
            seg = row[lo:hi + 1]
            if seg.all():
                continue
            # 段内空隙：两侧都是衣服、且全为可填像素
            d = np.flatnonzero(np.diff(seg.astype(np.int8)))
            starts = d[0::2] + 1
            ends = d[1::2]
            for a, b in zip(starts, ends):
                if a == 0 or b == len(seg) - 1:
                    continue
                if not (seg[a - 1] and seg[b + 1]):
                    continue
                sl = slice(lo + int(a), lo + int(b) + 1)
                if f[i, sl].all():
                    r[i, sl] = True
    from scipy import ndimage as ndi

    return ndi.binary_fill_holes(out)


def _drop_props(mask: np.ndarray, labels: np.ndarray, min_px: int) -> np.ndarray:
    """剔掉被误认成衣服的「手里道具」（奶茶杯 / 手机 / 伞）。

    这类东西整块被手（手臂标签）包住：外圈几乎全是人体、几乎没有衣服。
    真衣服部件（袖子、下装）外圈一定混着背景或衣服本身，不会被误杀。
    """
    import cv2

    n, comp, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 2:
        return _drop_specks(mask, min_px)
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep = np.zeros_like(mask)
    person = np.isin(labels, IDS_PERSON)
    k = max(3, int(round(min(mask.shape) * 0.01)) | 1)
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    for i in range(1, n):
        sel = comp == i
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_px:
            continue
        ring = cv2.dilate(sel.astype(np.uint8), kern).astype(bool) & ~sel
        if ring.any() and area <= 0.15 * mask.sum():
            if float(person[ring].mean()) >= 0.55 and float(mask[ring].mean()) <= 0.25:
                continue                                   # 被手包住的道具 -> 丢
        keep |= sel
    return keep if keep.any() else mask


def build_masks(rgb: np.ndarray, probs: np.ndarray) -> dict:
    """由概率图得到各组掩膜（硬）+ 软 alpha + 18 类标签图 + 需修复区。"""
    import cv2

    h, w = rgb.shape[:2]
    labels = probs.argmax(axis=0)
    p_garment = probs[IDS_GARMENT].sum(axis=0)
    alpha0 = np.clip((p_garment - 0.42) / 0.20, 0.0, 1.0)

    min_speck = max(48, int(h * w * 0.0004))

    def group(ids, close_frac: float = 0.0) -> np.ndarray:
        m = _drop_props(np.isin(labels, ids), labels, min_speck)
        return _close(m, close_frac) if (m.any() and close_frac > 0) else m

    top = group(IDS_TOP, 0.010)
    bottom = group(IDS_BOTTOM)          # 下装不闭运算，别糊死裤腿缝
    dress = group(IDS_DRESS, 0.010)

    raw = top | bottom | dress
    garment = _fill_occlusions(raw, labels, min_speck)
    # 补出来的遮挡区 = 修复范围；再把被它包住的残留道具（手里的杯子等）一起纳入，
    # 否则补完织物后杯子会孤零零浮在毛衣上。
    from scipy import ndimage as ndi

    inpaint = ndi.binary_fill_holes(garment & ~raw)

    # 补出来的像素归哪个部件：用距离变换按「最近的真实衣服部件」认领
    if (garment & ~raw).any():
        grp = np.zeros((h, w), np.uint8)
        grp[top], grp[bottom], grp[dress] = 1, 2, 3
        _, (iy, ix) = ndi.distance_transform_edt(grp == 0, return_indices=True)
        claimed = grp[iy, ix]
        filled = garment & ~raw
        top = top | (filled & (claimed == 1))
        bottom = bottom | (filled & (claimed == 2))
        dress = dress | (filled & (claimed == 3))

    one = np.ones((3, 3), np.uint8)
    core = cv2.erode(garment.astype(np.uint8), one, iterations=2).astype(bool)
    outer = ~cv2.dilate(garment.astype(np.uint8), one, iterations=1).astype(bool)
    alpha = alpha0.copy()
    alpha[core] = 1.0
    alpha[outer] = 0.0
    alpha = np.clip(cv2.GaussianBlur(alpha, (0, 0), 0.6), 0.0, 1.0)

    acc = _drop_specks(np.isin(labels, IDS_ACCESSORY) & ~garment, min_speck)
    return {"labels": labels, "alpha": alpha, "garment": garment, "raw": raw,
            "inpaint": inpaint, "top": top & garment, "bottom": bottom & garment,
            "dress": dress & garment, "accessory": acc, "look": garment | acc}


def inpaint_occluded(rgb: np.ndarray, mask: np.ndarray, garment: np.ndarray) -> np.ndarray:
    """把遮挡区（手臂 / 头发 / 道具压住的地方）按周围织物补回来。

    不补的话掩膜补上了、露出的却是皮肤颜色，白底图会是一块「肉色补丁」。

    三步走：
      1. 镜像接续 —— 沿衣服边界把最近的织物镜像进来，针织 / 牛仔这类有纹理的面料
         能保住质感（纯修复会把纹理抹平）。
      2. 粗尺度铺底 —— 镜像够不到的死角（掩膜太厚 / 镜像落到背景上）在 1/4 尺度用
         Navier-Stokes 铺平，避免 TELEA 在大区域拉出条带。
      3. 接缝过渡 —— 只在掩膜边缘一圈做高斯过渡，免得补丁和原图之间有硬边。
    """
    import cv2
    from scipy import ndimage as ndi

    if not mask.any():
        return rgb
    h, w = rgb.shape[:2]
    m = cv2.dilate(mask.astype(np.uint8), np.ones((5, 5), np.uint8), iterations=1)
    sel = m.astype(bool)

    out = rgb.copy()
    done = np.zeros_like(sel)

    # 1) 镜像接续：masked 像素 p 的最近衣服像素是 q，则取 q 越过边界再等距的镜像点
    _, (iy, ix) = ndi.distance_transform_edt(sel, return_indices=True)
    ys, xs = np.nonzero(sel)
    my = ys + 2 * (iy[ys, xs] - ys)
    mx = xs + 2 * (ix[ys, xs] - xs)
    inb = (my >= 0) & (my < h) & (mx >= 0) & (mx < w)
    my, mx = np.clip(my, 0, h - 1), np.clip(mx, 0, w - 1)
    on_cloth = inb & garment[my, mx].astype(bool)     # 镜像点必须落在衣服上，不能吸到背景
    out[ys[on_cloth], xs[on_cloth]] = rgb[my[on_cloth], mx[on_cloth]]
    done[ys[on_cloth], xs[on_cloth]] = True

    # 2) 粗尺度铺底，补镜像够不到的剩余部分
    left = sel & ~done
    if left.any():
        small = cv2.resize(rgb, (max(1, w // 4), max(1, h // 4)), interpolation=cv2.INTER_AREA)
        ms = cv2.dilate(cv2.resize(left.astype(np.uint8), (small.shape[1], small.shape[0]),
                                   interpolation=cv2.INTER_NEAREST),
                        np.ones((3, 3), np.uint8), iterations=1)
        base = cv2.resize(cv2.inpaint(small, ms, 8, cv2.INPAINT_NS), (w, h),
                          interpolation=cv2.INTER_CUBIC)
        out[left] = base[left]

    # 3) 接缝过渡
    k = np.ones((9, 9), np.uint8)
    band = (cv2.dilate(m, k) - cv2.erode(m, k)).astype(bool)
    out[band] = cv2.GaussianBlur(out, (0, 0), 2.0)[band]
    return out


# ---------------- 特征（对齐 web/vocab.js 词表）----------------

def _hex_of(rgb_px) -> str:
    r, g, b = (int(v) for v in rgb_px)
    return f"#{r:02x}{g:02x}{b:02x}"


def nearest_vocab_color(rgb_px: np.ndarray) -> str:
    """把实测颜色收敛到 web/vocab.js 的 24 色词表（Lab 距离，抗明暗影响）。"""
    import cv2

    lab = cv2.cvtColor(np.array([[rgb_px]], np.uint8), cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)
    pal_lab = cv2.cvtColor(np.array([[c] for _, c in PALETTE], np.uint8),
                           cv2.COLOR_RGB2LAB)[:, 0, :].astype(np.float32)
    return PALETTE[int(((pal_lab - lab) ** 2).sum(axis=1).argmin())][0]


def dominant_colors(rgb: np.ndarray, mask: np.ndarray, k: int = 3) -> list[dict]:
    import cv2

    px = rgb[mask]
    if len(px) < k * 8:
        return []
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, lab, centers = cv2.kmeans(px.astype(np.float32), k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(lab.flatten(), minlength=k)
    out = []
    for i in np.argsort(-counts):
        c = np.clip(centers[i], 0, 255).round().astype(int)
        out.append({"hex": _hex_of(c), "rgb": [int(v) for v in c],
                    "share": round(float(counts[i]) / float(counts.sum()), 3),
                    "vocab": nearest_vocab_color(c)})
    return out


def width_profile(mask: np.ndarray, n: int = 5) -> list[float]:
    """沿高度等分取最大宽度，归一化到该掩膜最大宽 —— 判阔腿 / 直筒 / 修身。"""
    ys = np.where(mask.any(axis=1))[0]
    if len(ys) == 0:
        return []
    widths = mask.sum(axis=1).astype(np.float32)
    seg = np.linspace(int(ys[0]), int(ys[-1]), n + 1).astype(int)
    prof = [float(widths[a:max(b, a + 1)].max()) for a, b in zip(seg[:-1], seg[1:])]
    mx = max(prof) or 1.0
    return [round(v / mx, 3) for v in prof]


def features_of(rgb: np.ndarray, masks: dict) -> dict:
    h, w = rgb.shape[:2]
    total = float(h * w)
    labels = masks["labels"]
    # 颜色只在「真实拍到衣服」的像素上统计，排除修复补丁（补丁色是周围平均出来的）
    real = ~masks["inpaint"]

    def group_feat(mask: np.ndarray, ids: list[int]) -> dict | None:
        if int(mask.sum()) < max(64, total * 0.001):
            return None
        ys, xs = np.where(mask)
        solid = mask & (masks["alpha"] > 0.9) & real
        if int(solid.sum()) < 64:
            solid = mask & real
        if int(solid.sum()) < 64:
            solid = mask
        bb = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
        bw, bh = bb[2] - bb[0] + 1, bb[3] - bb[1] + 1
        return {
            "area_px": int(mask.sum()),
            "area_ratio": round(float(mask.sum()) / total, 4),
            "bbox": bb, "bbox_wh": [bw, bh],
            "aspect_h_w": round(bh / max(1, bw), 2),
            "classes": [CLASSES[i] for i in ids
                        if int((labels == i).sum()) > max(64, total * 0.0008)],
            "colors": dominant_colors(rgb, solid),
            "width_profile_top_to_bottom": width_profile(mask),
        }

    groups = {}
    for name, ids in (("top", IDS_TOP), ("bottom", IDS_BOTTOM), ("dress", IDS_DRESS)):
        f = group_feat(masks[name], ids)
        if f:
            groups[name] = f

    acc = {}
    for cid in IDS_ACCESSORY:
        m = labels == cid
        if int(m.sum()) >= max(64, total * 0.0008):
            solid = m & masks["look"]
            sub = rgb[solid] if int(solid.sum()) >= 32 else rgb[m]
            acc[CLASSES[cid]] = {
                "area_ratio": round(float(m.sum()) / total, 4),
                "mean_hex": _hex_of(sub.mean(axis=0).round().astype(int)),
                "colors": dominant_colors(rgb, solid) if int(solid.sum()) >= 64 else [],
            }

    garment_px = int(masks["garment"].sum())
    person_px = int(np.isin(labels, IDS_PERSON + IDS_GARMENT).sum())
    return {
        "image_wh": [w, h],
        "garment_area_ratio": round(garment_px / total, 4),
        "garment_over_person": round(garment_px / max(1, person_px), 3),
        "groups": groups,
        "accessories": acc,
    }


# ---------------- 合成 / 产出 ----------------

def _compose_white(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    a = alpha[..., None].astype(np.float32)
    return (rgb.astype(np.float32) * a + 255.0 * (1.0 - a)).round().clip(0, 255).astype(np.uint8)


def _crop_white(rgb: np.ndarray, alpha: np.ndarray, pad: float = 0.06):
    ys, xs = np.where(alpha > 0.35)
    if len(ys) == 0:
        return _compose_white(rgb, alpha), None
    h, w = rgb.shape[:2]
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    dx, dy = int((x1 - x0) * pad), int((y1 - y0) * pad)
    x0, x1 = max(0, x0 - dx), min(w - 1, x1 + dx)
    y0, y1 = max(0, y0 - dy), min(h - 1, y1 + dy)
    return (_compose_white(rgb[y0:y1 + 1, x0:x1 + 1], alpha[y0:y1 + 1, x0:x1 + 1]),
            [x0, y0, x1, y1])


def segment_file(src: Path, outdir: Path, prefix: str | None = None,
                 roi_size: int = PASS2_SIZE, save_cutout: bool = True) -> dict:
    from PIL import Image

    prefix = prefix or src.stem
    outdir.mkdir(parents=True, exist_ok=True)

    rgb = _load_rgb(src)
    probs1 = _infer(rgb, PASS1_SIZE)                 # 第一遍：整图定位
    roi = person_roi(probs1)
    probs = predict_probs(rgb, roi=roi, size=roi_size) if roi else probs1
    masks = build_masks(rgb, probs)
    fixed = inpaint_occluded(rgb, masks["inpaint"], masks["garment"])   # 遮挡区按织物纹理补回

    # 配饰单独立 alpha（没有衣物概率可用，用自己的类别概率取软边）
    acc_prob = probs[IDS_ACCESSORY].sum(axis=0)
    acc_alpha = np.where(masks["accessory"],
                         np.maximum(np.clip((acc_prob - 0.35) / 0.25, 0.0, 1.0), 0.96), 0.0).astype(np.float32)

    garment_alpha = masks["alpha"]
    styled_alpha = np.clip(np.maximum(garment_alpha, acc_alpha), 0.0, 1.0)

    Image.fromarray(_crop_white(fixed, garment_alpha)[0]).save(
        outdir / f"{prefix}_look_white.jpg", quality=95)
    Image.fromarray(_crop_white(fixed, styled_alpha)[0]).save(
        outdir / f"{prefix}_styled_white.jpg", quality=95)
    if save_cutout:
        Image.fromarray(np.dstack([fixed, (garment_alpha * 255).astype(np.uint8)]), "RGBA").save(
            outdir / f"{prefix}_cutout.png")

    made = []
    for name in ("top", "bottom", "dress"):
        alt = masks[name] & masks["garment"]
        if int(alt.sum()) < max(64, rgb.shape[0] * rgb.shape[1] * 0.001):
            continue
        a = np.where(alt, np.maximum(masks["alpha"], 0.99), 0.0).astype(np.float32)
        Image.fromarray(_crop_white(fixed, a)[0]).save(outdir / f"{prefix}_{name}_white.jpg", quality=95)
        made.append(name)

    ov = rgb.astype(np.float32)
    tint = np.zeros_like(ov)
    tint[masks["top"]] = (255, 90, 90)
    tint[masks["bottom"]] = (80, 140, 255)
    tint[masks["dress"]] = (255, 200, 60)
    tint[masks["accessory"]] = (120, 240, 140)
    sel = masks["look"]
    ov[sel] = ov[sel] * 0.45 + tint[sel] * 0.55
    Image.fromarray(ov.round().clip(0, 255).astype(np.uint8)).save(
        outdir / f"{prefix}_overlay.jpg", quality=92)

    feats = features_of(rgb, masks)
    feats.update({"source": str(src), "prefix": prefix, "items_made": made,
                  "roi": list(roi) if roi else None,
                  "label_share": {n: round(float((masks["labels"] == i).mean()), 5)
                                  for i, n in enumerate(CLASSES)
                                  if (masks["labels"] == i).any()}})
    (outdir / f"{prefix}_features.json").write_text(
        json.dumps(feats, ensure_ascii=False, indent=2), encoding="utf-8")
    return feats


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: python cloth_seg.py <in.jpg> <outdir> [--prefix p] [--roi-size N]", file=sys.stderr)
        return 2
    src, outdir = Path(sys.argv[1]), Path(sys.argv[2])
    prefix = sys.argv[sys.argv.index("--prefix") + 1] if "--prefix" in sys.argv else None
    roi_size = int(sys.argv[sys.argv.index("--roi-size") + 1]) if "--roi-size" in sys.argv else PASS2_SIZE
    feats = segment_file(src, outdir, prefix, roi_size=roi_size)
    print(json.dumps({"ok": True, "prefix": feats["prefix"], "items": feats["items_made"],
                      "garment_area_ratio": feats["garment_area_ratio"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
