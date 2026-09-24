#!/usr/bin/env python3
"""S2.5 联网找「白底同款图」——把用户实拍图换成干净的商品白底图。

思路（本项目自研近似方案，替代拍立淘级以图搜图）：
    结构化标签（品类/类型/颜色/材质/版型） → 文本检索图片 → 下载候选 →
    白底检测 + 尺寸/域名打分 → 择优一张 → 交回 ingest 链路入库

CLI:
    python find_product_image.py --tags '{"category":"top","type":"短袖","color_name":"白色","material":"棉"}'
    python find_product_image.py --item w0001          # 直接读 items.json
    python find_product_image.py --query "白色 棉 短袖 白底 商品图"

输出 JSON:
    {"ok":true,"path":"...","source_url":"...","page_url":"...","white_ratio":0.92,
     "width":800,"height":800,"candidates":[...]}
    {"ok":false,"message":"..."}

失败一律 ok:false，调用方回落到「用原图 + 手动补标」，不影响主链路。
"""
from __future__ import annotations

import argparse
import html
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "cache" / "find"

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 白底商品图/素材图来源，命中大幅加分（不强制，只影响排序）
# 实测：本机网络下 Bing 被锁中文区，英文图库站（vecteezy/freepik/pngwing）全部 403，
# 能抓到的干净图源基本是国内素材/电商图床，因此以中文语料为主。
GOOD_DOMAINS = (
    "699pic", "nipic", "nximg", "tukuppt", "shetu66", "quanjing", "vcg", "dtstatic",
    "vecteezy", "freepik", "pngimg", "pngwing", "cleanpng", "istock", "shutterstock",
    "cdn.shopify", "alicdn", "taobaocdn", "jd.com", "tmall",
)
# 明显不是商品图的来源：词典/百科/壁纸/技术博客/生活社区，直接丢弃
BAD_DOMAINS = (
    "hanyuguoxue", "bishun", "hanzi", "zdic", "cidian", "baike", "baidu.com/item",
    "zhidao", "gss0.baidu", "exp-picture.cdn.bcebos", "bkimg.cdn.bcebos",
    "csdnimg", "csdn.net", "zhimg.com", "zhihu", "netbian", "duitang", "gei6.com",
    "xuexili", "fontyi", "51wendang", "shuomingshu", "sinaimg", "sinacn",
    "weibo", "bilibili", "toutiao", "163.com", "qq.com", "sohu",
)

# 中文色名 → 检索友好的朴素色名（「柔白」「浅金棕」这类诗意色名会把搜索带偏）
COLOR_ALIAS = {
    "柔白": "白色", "米白": "米色", "纯白": "白色", "奶油白": "白色", "雾白": "白色",
    "纯黑": "黑色", "雾灰": "灰色", "雾蓝": "蓝色", "砖红": "红色", "红黑": "红色",
    "橄榄绿": "绿色", "浅金棕": "卡其色", "卡其": "卡其色", "暖棕": "棕色",
    "浅紫": "紫色", "米": "米色",
}

MIN_SIDE = 400          # 候选图短边下限
# 白底阈值刻意放宽：像素采样只用于排序，真正的裁判是 VLM（见 VERIFY_PROMPT）。
# 实测 Bing 中文区语料里白底商品图本来就少，卡 0.6 会把真命中的图也筛掉。
WHITE_OK = 0.18
WHITE_GOOD = 0.55       # 达到这个占比算「很干净」，打分额外加权
BAND = 0.12             # 四边采样条带占比


# ---------------- 查询构造 ----------------
EN_COLOR = {
    "白色": "white", "米色": "beige", "黑色": "black", "灰色": "grey", "蓝色": "blue",
    "红色": "red", "绿色": "green", "卡其色": "khaki", "棕色": "brown", "紫色": "purple",
}
EN_TYPE = {
    "短袖": "t-shirt", "长袖": "long sleeve shirt", "短裤": "shorts", "长裤": "pants",
    "外套": "jacket", "鞋": "shoes", "包": "bag", "其他": "clothing",
}
EN_CAT = {"top": "top", "bottom": "pants", "outer": "jacket", "shoes": "shoes", "bag": "bag"}


def build_queries(tags: dict) -> list[str]:
    """结构化标签 → 检索词。

    实测本机 Bing 被锁中文区（mkt=en-US 无效，英文查询会搜出「white」单词卡片图），
    所以中文检索词排在最前，英文只作补充。
    """
    t = tags or {}
    color = COLOR_ALIAS.get(t.get("color_name") or "", t.get("color_name") or "")
    typ = t.get("type") or ""
    mat = t.get("material") or ""
    cat = t.get("category") or ""

    cn_bits = [b for b in (color, mat if mat not in ("其他", "未知") else "", typ) if b]
    cn_q = " ".join(cn_bits) + " 白底图 平铺拍摄 商品"

    en_bits = [b for b in (EN_COLOR.get(color, ""), EN_TYPE.get(typ) or EN_CAT.get(cat, "clothing")) if b]
    en_q = " ".join(en_bits) + " isolated on white background product photo"

    queries = []
    if cn_bits:
        queries += [
            cn_q,
            f"{color}{typ} 白底 商品主图 电商 服装",
            f"纯{color}{typ} 服装 白底 高清 素材",
        ]
    queries.append(en_q)
    return queries


# ---------------- 检索 ----------------
BAIDU_API = "https://image.baidu.com/search/acjson"
BAIDU_HEADERS = {
    **UA,
    "Referer": "https://image.baidu.com/",
}


def baidu_image_search(query: str, limit: int = 20) -> list[dict]:
    """百度图片 JSON 接口（主检索源）。

    实测本机唯一可用的图片检索：Bing 的响应与查询无关（被代理缓存/挡住），
    图库站（vecteezy/freepik/pngwing）全部 403；百度接口则稳定返回强相关结果。

    拿图用 middleURL（百度自家 CDN，实测最高 ~800px）。
    objURL 是百度加密码、官方 down 代理端点已失效，故不采用。
    """
    url = (
        f"{BAIDU_API}?tn=resultjson_com&logid=1&ipn=rj&ct=201326592&is=&fp=result"
        f"&word={urllib.parse.quote(query)}&pn=0&rn={min(60, max(10, limit))}&gsm=1e"
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        req = urllib.request.Request(url, headers=BAIDU_HEADERS)
        with urllib.request.urlopen(req, timeout=25, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        data = json.loads(raw.replace("\\'", "'"))
    except Exception as exc:  # noqa: BLE001
        print(f"baidu search failed: {type(exc).__name__} {exc}", file=sys.stderr)
        return []

    out, seen = [], set()
    for item in data.get("data", []) or []:
        if not item:
            continue
        img = item.get("middleURL") or item.get("hoverURL") or item.get("thumbURL") or ""
        if not img or img in seen:
            continue
        seen.add(img)
        out.append({
            "image": img,
            "page": item.get("fromURL") or item.get("fromJumpUrl") or "",
            "title": re.sub(r"<[^>]+>", "", item.get("fromPageTitleEnc") or "")[:60],
            "declared": f"{item.get('width') or '?'}x{item.get('height') or '?'}",
        })
        if len(out) >= limit:
            break
    return out


def bing_image_search(query: str, limit: int = 12) -> list[dict]:
    """抓 Bing 图片搜索结果页（备用源；本机实测常被缓存/拦截，结果可能与查询无关）。"""
    url = (
        "https://www.bing.com/images/search?q=" + urllib.parse.quote(query) +
        "&form=HDRSC2&first=1&mkt=en-US&qft=" + urllib.parse.quote("+filterui:photo-photo")
    )
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            page = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        print(f"bing search failed: {exc}", file=sys.stderr)
        return []

    out = []
    seen = set()
    for m in re.finditer(r'm="([^"]+)"', page):
        raw = html.unescape(m.group(1))
        murl = re.search(r'"murl":"(.*?)"', raw)
        purl = re.search(r'"purl":"(.*?)"', raw)
        if not murl:
            continue
        u = murl.group(1)
        if u in seen:
            continue
        seen.add(u)
        out.append({"image": u, "page": purl.group(1) if purl else "", "title": "", "declared": ""})
        if len(out) >= limit:
            break
    return out


def search_hits(queries: list[str], limit: int) -> list[dict]:
    """按查询词列表搜集命中；百度主源，Bing 兜底。"""
    hits: list[dict] = []
    seen: set[str] = set()
    for q in queries:
        for hit in baidu_image_search(q, limit=limit):
            if hit["image"] not in seen:
                seen.add(hit["image"])
                hits.append(hit)
        if len(hits) >= limit * 2:
            break
    if len(hits) < 4:  # 主源不给力时再问一次备用源
        for q in queries[:2]:
            for hit in bing_image_search(q, limit=limit):
                if hit["image"] not in seen:
                    seen.add(hit["image"])
                    hits.append(hit)
    return hits


# ---------------- 下载与打分 ----------------
def _safe_url(url: str) -> str:
    """把非 ASCII 字符转义，避免 urllib 的 ascii 编码报错。"""
    try:
        url.encode("ascii")
        return url
    except UnicodeEncodeError:
        parts = urllib.parse.urlsplit(url)
        path = urllib.parse.quote(parts.path)
        query = urllib.parse.quote(parts.query, safe="=&?")
        return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, query, parts.fragment))


def download(url: str, dest: Path) -> bool:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # 部分图床证书过期，只做下载用途
    for candidate in (_safe_url(url), url):
        try:
            req = urllib.request.Request(candidate, headers=UA)
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                data = resp.read()
            if len(data) < 2048:
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return True
        except Exception as exc:  # noqa: BLE001
            last = exc
    print(f"download failed: {type(last).__name__} {last}", file=sys.stderr)
    return False


def white_ratio(path: Path) -> float:
    """四边条带的白像素占比：白底商品图应接近 1。"""
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            w, h = im.size
            band = max(2, int(min(w, h) * BAND))
            px = im.load()
            total = 0
            white = 0
            for x in range(w):
                for y in list(range(band)) + list(range(h - band, h)):
                    r, g, b = px[x, y]
                    total += 1
                    if r > 240 and g > 240 and b > 240:
                        white += 1
            for y in range(h):
                for x in list(range(band)) + list(range(w - band, w)):
                    r, g, b = px[x, y]
                    total += 1
                    if r > 240 and g > 240 and b > 240:
                        white += 1
            return white / max(1, total)
    except Exception:  # noqa: BLE001
        return 0.0


def ratio_ok(cand: dict) -> bool:
    """服装商品图多为竖构图/方图，超宽图（横幅、汽车 360 图）直接排除。"""
    w, h = cand.get("width", 0), cand.get("height", 0)
    if not w or not h:
        return False
    r = w / h
    return 0.45 <= r <= 1.8


COLOR_FAMILY = {
    "白色": "light", "米色": "light", "奶油白": "light", "浅紫": "light",
    "黑色": "dark", "灰色": "dark", "深蓝": "dark",
    "红色": "red", "砖红": "red", "蓝色": "blue", "绿色": "green", "橄榄绿": "green",
    "卡其色": "khaki", "棕色": "khaki", "米黄": "khaki", "浅金棕": "khaki",
    "紫色": "purple", "黄色": "warm", "橙色": "warm",
}

VERIFY_PROMPT = (
    "这是一张从网上搜来的服装图片。以「电商白底商品图」为标准严格判断，只返回 JSON，不要解释。\n"
    "判断要点：\n"
    "1) 画面里必须只有【一件】衣物。多件同款、一排衣服、拼图、详情页长图 → is_single_product=false。\n"
    "2) 背景必须是【专业棚拍白底】：纯白或接近纯白、无纹理、无阴影渐变、无桌面/地板/木纹/大理石纹理。\n"
    "   在自家地板/床上/桌上随手拍的照片，即使背景很浅，background 也只能算 solid 或 scene。\n"
    "3) 有人（模特上身、手持、脚穿）→ has_person=true。\n"
    "{\n"
    '  "is_single_product": true|false,   // 是否单件单品\n'
    '  "has_person": true|false,\n'
    '  "background": "white|solid|scene|other",  // white=专业棚拍纯白底；solid=纯色但非纯白或带纹理；scene=生活场景；other=其他\n'
    '  "scene": "商品图|模特上身|生活场景|其他",\n'
    '  "category": "top|bottom|outer|shoes|bag|other",\n'
    '  "type": "短袖|长袖|短裤|长裤|外套|鞋|包|其他",\n'
    '  "color_name": "中文色名"\n'
    "}"
)


def _vlm_json(path: Path, prompt: str) -> dict | None:
    """按自定义 prompt 调一次 VLM（复用 .env 里的配置）。"""
    import base64 as _b64
    import os as _os

    sys.path.insert(0, str(ROOT / "scripts"))
    from tag_image import _load_env, _parse_json_loose  # noqa: PLC0415

    _load_env()
    base = _os.environ.get("VLM_BASE_URL", "").rstrip("/")
    key = _os.environ.get("VLM_API_KEY", "")
    model = _os.environ.get("VLM_MODEL", "qwen-vl-max")
    if not base or not key or key.startswith("sk-xxxx"):
        return None

    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _b64.b64encode(path.read_bytes()).decode("ascii")}},
            ],
        }],
        "temperature": 0.1,
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return _parse_json_loose(body["choices"][0]["message"]["content"])


def family_of(color_name: str) -> str | None:
    name = COLOR_ALIAS.get(color_name or "", color_name or "")
    for k, v in COLOR_FAMILY.items():
        if k and k in name:
            return v
    return None


def vlm_check(path: Path, expected: dict) -> dict:
    """下载回来的图让 VLM 严格复核：必须是「单件商品图」且品类/颜色对得上。

    文本检索必然有噪声，这一步是唯一的质量闸门——宁可返回失败，也不入库错图。
    """
    try:
        verdict = _vlm_json(path, VERIFY_PROMPT)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": f"VLM 校验失败：{type(exc).__name__}"}
    if not verdict:
        return {"ok": False, "reason": "VLM 不可用（无 key 或断网）"}

    if verdict.get("has_person"):
        return {"ok": False, "reason": "是模特上身照，不是单品图", "verdict": verdict}
    if not verdict.get("is_single_product"):
        return {"ok": False, "reason": f"不是独立商品图（{verdict.get('scene') or '未知场景'}）", "verdict": verdict}

    # 背景由 VLM 判 + 像素采样交叉验证（像素采样扛不住拼图/水印/渐变，VLM 扛不住「浅色地板」）
    bg = (verdict.get("background") or "").lower()
    wr = (expected or {}).get("_white_ratio", 0.0)
    if bg == "white":
        if wr and wr < 0.35:
            return {"ok": False, "reason": f"看着像白底但像素检测只有 {wr}", "verdict": verdict}
    elif bg == "solid":
        if wr < WHITE_GOOD:
            return {"ok": False, "reason": f"非纯白底（{verdict.get('background')}），白底占比 {wr}", "verdict": verdict}
    else:
        return {"ok": False, "reason": f"背景不是白底/纯色底（{verdict.get('background') or '未知'}）", "verdict": verdict}

    want_cat = (expected or {}).get("category")
    got_cat = verdict.get("category")
    if want_cat and got_cat and got_cat != "other" and want_cat != got_cat:
        return {"ok": False, "reason": f"品类不符：{got_cat} ≠ {want_cat}", "verdict": verdict}

    want_type = (expected or {}).get("type")
    got_type = verdict.get("type")
    if want_type and got_type and got_type != "其他" and want_type != got_type:
        return {"ok": False, "reason": f"类型不符：{got_type} ≠ {want_type}", "verdict": verdict}

    want_fam = family_of((expected or {}).get("color_name") or "")
    got_fam = family_of(verdict.get("color_name") or "")
    if want_fam and got_fam and want_fam != got_fam:
        return {"ok": False, "reason": f"颜色不符：{verdict.get('color_name')} ≠ {(expected or {}).get('color_name')}", "verdict": verdict}

    bgcn = {"white": "白底", "solid": "纯色底"}.get(bg, "干净背景")
    return {
        "ok": True,
        "reason": f"VLM 复核通过：{bgcn}单品图 · {got_type or got_cat} · {verdict.get('color_name') or ''}",
        "verdict": verdict,
    }


def score(cand: dict) -> float:
    s = cand["white_ratio"] * 100
    if cand["white_ratio"] >= WHITE_GOOD:
        s += 25  # 像素采样也确认是干净白底，加权
    if any(d in cand["image"].lower() for d in GOOD_DOMAINS):
        s += 40  # 图库/电商白底图来源，压倒性优先
    side = min(cand.get("width", 0), cand.get("height", 0))
    s += min(10, max(0, (side - MIN_SIDE) / 120))
    return s


# ---------------- 主流程 ----------------
def find(tags: dict | None = None, query: str | None = None, limit: int = 10, outdir: Path | None = None) -> dict:
    outdir = outdir or (CACHE / "last")
    outdir.mkdir(parents=True, exist_ok=True)

    queries = [query] if query else build_queries(tags or {})
    hits = search_hits(queries, limit)
    if not hits:
        return {"ok": False, "message": "联网检索失败（无结果/被拦截）", "candidates": []}

    candidates: list[dict] = []
    for i, hit in enumerate(hits[:limit]):
        blob = (hit["image"] + " " + hit.get("page", "")).lower()
        if any(d in blob for d in BAD_DOMAINS):
            continue
        ext = ".png" if ".png" in hit["image"].lower().split("?")[0] else ".jpg"
        dest = outdir / f"cand_{i}{ext}"
        if not download(hit["image"], dest):
            continue
        try:
            with Image.open(dest) as im:
                w, h = im.size
        except Exception:  # noqa: BLE001
            continue
        if min(w, h) < MIN_SIDE:
            continue
        cand = {
            "image": hit["image"],
            "page": hit.get("page", ""),
            "title": hit.get("title", ""),
            "path": str(dest),
            "width": w,
            "height": h,
            "white_ratio": round(white_ratio(dest), 3),
        }
        cand["score"] = round(score(cand), 2)
        candidates.append(cand)

    if not candidates:
        return {"ok": False, "message": "候选图全部下载/解码失败", "candidates": []}

    candidates.sort(key=lambda c: c["score"], reverse=True)

    # 逐张复核：构图 → 白底 → VLM 再认一次（最多验 5 张，控制耗时）
    checked: list[dict] = []
    for cand in candidates[:5]:
        cand["ratio_ok"] = ratio_ok(cand)
        if not cand["ratio_ok"]:
            cand["vlm"] = {"ok": False, "reason": "构图不像单品图（过宽/过扁）"}
            checked.append(cand)
            continue
        if cand["white_ratio"] < WHITE_OK:
            cand["vlm"] = {"ok": False, "reason": f"白底占比仅 {cand['white_ratio']}"}
            checked.append(cand)
            continue
        cand["vlm"] = vlm_check(Path(cand["path"]), {**(tags or {}), "_white_ratio": cand["white_ratio"]})
        checked.append(cand)

    # 全部候选（含未通过复核的）都交回上层 —— 前端要展示给人确认，不替用户拍板
    for cand in candidates:
        cand.setdefault("vlm", {"ok": False, "reason": "未复核（不在前 5）"})

    vlm_missing = any(
        "VLM" in (c["vlm"].get("reason") or "") for c in checked
    ) and not any(c["vlm"]["ok"] for c in checked)

    best = next((c for c in checked if c["vlm"]["ok"]), None)
    if best:
        out = {
            "ok": True,
            "path": best["path"],
            "source_url": best["image"],
            "page_url": best["page"],
            "white_ratio": best["white_ratio"],
            "width": best["width"],
            "height": best["height"],
            "vlm": best["vlm"],
            "verified": True,
        }
    else:
        # VLM 不可用（无 key / 断网）时，不强行否决——把白底最干净的候选交给人看
        clean = [c for c in candidates if c.get("ratio_ok") and c["white_ratio"] >= WHITE_OK]
        if vlm_missing and clean:
            b = clean[0]
            out = {
                "ok": True,
                "path": b["path"],
                "source_url": b["image"],
                "page_url": b["page"],
                "white_ratio": b["white_ratio"],
                "width": b["width"],
                "height": b["height"],
                "vlm": b["vlm"],
                "verified": False,
                "message": "VLM 不可用，未经 AI 复核，请目视确认后再入柜",
            }
        else:
            reason = checked[0]["vlm"].get("reason") if checked else "候选全部不合格"
            return {
                "ok": False,
                "message": f"没找到可信的白底同款图：{reason}",
                "best": {k: v for k, v in candidates[0].items() if k != "path"},
                "candidates": candidates[:5],
            }

    out["candidates"] = [
        {
            "path": c["path"],
            "source_url": c["image"],
            "page_url": c.get("page", ""),
            "width": c["width"],
            "height": c["height"],
            "white_ratio": c["white_ratio"],
            "score": c["score"],
            "vlm": {"ok": c["vlm"]["ok"], "reason": c["vlm"].get("reason", "")},
        }
        for c in candidates[:5]
    ]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tags", help="结构化标签 JSON")
    ap.add_argument("--item", help="items.json 里的单品 id")
    ap.add_argument("--query", help="自定义检索词")
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--out", default="")
    a = ap.parse_args()

    tags = None
    if a.item:
        items = json.loads((ROOT / "web" / "data" / "items.json").read_text(encoding="utf-8"))
        tags = next((i for i in items if i.get("id") == a.item), None)
        if not tags:
            print(json.dumps({"ok": False, "message": "item not found"}, ensure_ascii=False))
            return 1
    elif a.tags:
        tags = json.loads(a.tags)

    res = find(tags=tags, query=a.query, limit=a.limit,
               outdir=Path(a.out) if a.out else None)
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
