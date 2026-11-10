#!/usr/bin/env python3
"""demo_preflight.py —— 电子衣柜·演示前自检（一键确认「能不能成功演示」）

干什么：
  逐项检查「演示当天要用的每一环」——环境、密钥配置、本地抠底、打标/文案缓存、
  衣橱数据、离线快照、前端资源、服务与访问方式。输出 ✅/⚠️/❌ 自查清单，
  每项附修复指引；--fix 可自动修复安全项（重建 offline.js、补齐缺失目录）。

用法：
  python scripts/demo_preflight.py              # 只检查，输出自查清单
  python scripts/demo_preflight.py --fix        # 检查 + 自动修复安全项后再复查
  python scripts/demo_preflight.py --json       # 输出机器可读 JSON（供 AI 程序消费）

退出码：
  0 = 无阻断项（FAIL 为 0，可以演示）
  1 = 存在阻断项（❌），先按修复指引处理
  2 = 用法错误

注意：
  · 只读检查默认不写任何数据文件；--fix 只重建 offline.js（生成物）与缺失目录。
  · .env 的 VLM_API_KEY 只判断「是否已配置」，绝不打印密钥本身。
  · 实测抠底会跑一次本地模型推理（可能耗时数秒~数十秒），输出到
    cache/demo_preflight/ 临时目录，不污染 items.json / offline.js。
"""
from __future__ import annotations

import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

if sys.version_info >= (3, 7):
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 控制台/重定向不乱码
    except Exception:  # noqa: BLE001
        pass

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
DATA = WEB / "data"
SCRIPTS = ROOT / "scripts"
PORT = 8787

GROUPS = ["环境与依赖", "密钥配置", "本地抠底", "打标/文案缓存", "数据与离线快照", "前端资源", "服务与访问"]


class Check:
    """单个检查项。status: pass / warn / fail / info"""

    def __init__(self, cid: str, group: str, name: str):
        self.cid = cid
        self.group = group
        self.name = name
        self.status = "info"
        self.detail = ""
        self.fix = ""

    def done(self, status: str, detail: str = "", fix: str = "") -> "Check":
        self.status = status
        self.detail = detail
        self.fix = fix
        return self


CHECKS: list[Check] = []
_MARK = {"pass": "✅", "warn": "⚠️", "fail": "❌", "info": "ℹ️"}


def add(cid: str, group: str, name: str) -> Check:
    c = Check(cid, group, name)
    CHECKS.append(c)
    return c


# ---------- 小工具 ----------

def _load_env() -> dict:
    env: dict[str, str] = {}
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def _lan_ip() -> str | None:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # 不真正发包，只拿本机出口 IP
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:  # noqa: BLE001
        return None


def _port_in_use(port: int = PORT) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _api_items_ok() -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/items", timeout=5) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def _vlm_reachable(base_url: str) -> bool:
    """探测 VLM 网关可达性：任何 HTTP 响应（含 4xx/5xx）都算可达；只有
    连不上/超时/DNS 失败才算不可达。不发业务请求，不消耗额度。"""
    try:
        urllib.request.urlopen(base_url, timeout=6)
        return True
    except urllib.error.HTTPError:
        return True
    except Exception:  # noqa: BLE001
        return False


def _load_json(path: Path) -> tuple[bool, object]:
    if not path.exists():
        return False, None
    try:
        return True, json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {exc}"


def _fix_dirs() -> list[str]:
    """创建演示链路必需的目录（幂等）。返回已创建的目录名。"""
    created = []
    for rel in (
        "uploads", "cache/cuts", "cache/tagged", "cache/looks",
        "cache/find", "cache/demo_preflight", "web/assets/items",
    ):
        d = ROOT / rel
        if not d.exists():
            d.mkdir(parents=True, exist_ok=True)
            created.append(rel)
    return created


def _fix_offline() -> str:
    """重建 offline.js（生成物，安全）。返回执行结果描述。"""
    sys.path.insert(0, str(SCRIPTS))
    try:
        import build_offline_data  # noqa: PLC0415
        wrote, md5 = build_offline_data.build(quiet=True)
        return f"已重建 offline.js（SOURCE_MD5 {md5[:8]}）" if wrote else "offline.js 已是最新"
    except Exception as exc:  # noqa: BLE001
        return f"重建失败：{exc}"


def _pick_cut_test_image() -> Path | None:
    """挑一张本地真实单品图做抠底实测：优先 samples，其次 items 根目录的
    prod_* 干净单品图，最后任意 items 下的 jpg。"""
    samples_dir = WEB / "assets" / "samples"
    for n in ("sample_sneaker.jpg", "sample_white_tee.jpg", "sample_stripe_top.jpg"):
        p = samples_dir / n
        if p.exists():
            return p
    items_dir = WEB / "assets" / "items"
    if items_dir.exists():
        for n in ("prod_tee_white.jpg", "prod_sneaker_white.jpg", "prod_jacket.jpg"):
            p = items_dir / n
            if p.exists():
                return p
        for p in items_dir.glob("*.jpg"):
            return p
    return None


# ---------- 检查项 ----------

def run_checks(fix: bool) -> None:
    # A. 环境与依赖
    c = add("A1", GROUPS[0], "Python 环境可用")
    v = sys.version_info
    if v.major == 3 and v.minor >= 9:
        c.done("pass", f"Python {v.major}.{v.minor}.{v.micro}")
    else:
        c.done("fail", f"Python {v.major}.{v.minor}（需 ≥3.9）", "安装 Python 3.9+ 后重跑")

    c = add("A2", GROUPS[0], "核心依赖可导入（PIL / numpy）")
    missing = []
    for mod in ("PIL", "numpy"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if not missing:
        c.done("pass", "PIL / numpy 均可导入")
    else:
        c.done("fail", f"缺少: {', '.join(missing)}", f"pip install {' '.join(missing)}")

    c = add("A3", GROUPS[0], "可选依赖 onnxruntime（rembg 抠底用）")
    try:
        __import__("onnxruntime")
        c.done("pass", "onnxruntime 可用（可走 rembg 抠底）")
    except ImportError:
        c.done(
            "warn",
            "未安装 onnxruntime（将走 flood-cut 纯视觉兜底抠底，仍可演示）",
            "想启用 rembg 高质量抠底：pip install onnxruntime rembg",
        )

    # B. 密钥配置
    env = _load_env()
    c = add("B1", GROUPS[1], ".env 配置存在")
    if env:
        c.done("pass", "ROOT/.env 已存在")
    else:
        c.done("fail", "缺少 .env", "复制 .env.example 为 .env 并填入 VLM_API_KEY")

    c = add("B2", GROUPS[1], "VLM_API_KEY 已配置（不泄露密钥）")
    key = env.get("VLM_API_KEY", "")
    if key and not key.startswith("sk-xxxx") and len(key) >= 8:
        c.done("pass", f"已配置（{len(key)} 字符，值保密）")
    else:
        c.done("fail", "未配置或仍是占位符 sk-xxxx", "在 .env 填入真实的 VLM_API_KEY")

    c = add("B3", GROUPS[1], "VLM 网关可达（断网时此项可忽略）")
    base = env.get("VLM_BASE_URL", "").rstrip("/")
    if not base:
        c.done("warn", "VLM_BASE_URL 未配置", "在 .env 配置 VLM_BASE_URL（默认见 .env.example）")
    elif _vlm_reachable(base):
        c.done("pass", f"可达: {base}")
    else:
        c.done(
            "warn",
            "当前连不上 VLM 网关（可能是演示现场无外网）",
            "断网不影响演示：打标/文案走 cache/ 缓存与模板兜底；有网时自动恢复正常",
        )

    # C. 本地抠底（上传动作的核心）
    c = add("C1", GROUPS[2], "rembg 抠底模型权重已在本地")
    home_models = Path.home() / ".rembg" / "models"
    found = []
    if home_models.exists():
        found = [p for p in home_models.rglob("*.onnx") if p.stat().st_size > 1024]
    if found:
        c.done("pass", f"本地模型 {len(found)} 个（总 {sum(p.stat().st_size for p in found)//1048576}MB），抠底不依赖网络")
    else:
        c.done(
            "warn",
            "未找到 rembg 模型（将走 flood-cut 纯视觉兜底，仍可抠底演示）",
            "想启用 rembg：mkdir -p ~/.rembg/models/segformer_b2_clothes && "
            "curl -L -o ~/.rembg/models/segformer_b2_clothes/model.onnx "
            "https://hf-mirror.com/Xenova/segformer_b2_clothes/resolve/main/onnx/model.onnx",
        )

    c = add("C2", GROUPS[2], "实测抠底跑通（真实跑一次本地推理）")
    sample = _pick_cut_test_image()
    if sample is None:
        c.done("warn", "web/assets/ 下没有可用的测试单品图，跳过实测", "补一张干净单品图到 web/assets/（samples 或 items 下）后重跑")
    else:
        sys.path.insert(0, str(SCRIPTS))
        try:
            from remove_bg import remove_bg_to  # noqa: PLC0415
            out_dir = ROOT / "cache" / "demo_preflight"
            out_dir.mkdir(parents=True, exist_ok=True)
            dst = out_dir / "cut_test.png"
            t0 = time.time()
            ok = remove_bg_to(sample, dst)
            cost = round(time.time() - t0, 1)
            if ok and dst.exists() and dst.stat().st_size > 0:
                c.done("pass", f"抠底成功，耗时 {cost}s（{sample.name} → cache/demo_preflight/cut_test.png）")
            else:
                c.done("fail", f"抠底未产出有效结果（cut_ok={ok}，耗时 {cost}s）", "查看 remove_bg.py 报错；确认 PIL/numpy 已装")
        except Exception as exc:  # noqa: BLE001
            c.done("fail", f"抠底实测异常: {type(exc).__name__}: {exc}", "按异常信息修复依赖后重跑")

    # D. 打标/文案缓存（断网演示的保障）
    def _count(rel: str) -> int:
        d = ROOT / rel
        return len(list(d.glob("*.json"))) if d.exists() else 0

    n_tag = _count("cache/tagged")
    c = add("D1", GROUPS[3], "打标缓存 cache/tagged/（断网时打标兜底数据）")
    if n_tag > 0:
        c.done("pass", f"{n_tag} 条历史打标缓存，断网也能为已见图出标签")
    else:
        c.done("warn", "暂无打标缓存", "联网时把要演示的单品图入柜一遍，打标结果会自动缓存进 cache/tagged/")

    n_look = _count("cache/looks")
    c = add("D2", GROUPS[3], "文案/选款缓存 cache/looks/（断网时文案兜底数据）")
    if n_look > 0:
        c.done("pass", f"{n_look} 条文案缓存")
    else:
        c.done("warn", "暂无文案缓存", "演示前跑 python scripts/extract_look.py <示例图目录> 预热，或接受模板兜底")

    # E. 数据与离线快照
    ok, items = _load_json(DATA / "items.json")
    c = add("E1", GROUPS[4], "衣橱数据 items.json 可解析")
    if ok and isinstance(items, list):
        c.done("pass", f"可解析，共 {len(items)} 件单品")
    else:
        c.done("fail", "items.json 缺失或损坏", "用 server/app.py 正常入柜一次，或检查 JSON 语法")

    c = add("E2", GROUPS[4], "衣橱非空（演示要有东西可展示）")
    if ok and isinstance(items, list) and len(items) > 0:
        c.done("pass", f"{len(items)} 件单品可展示")
    else:
        c.done("fail", "衣橱为空", "先联网入柜几件单品，或用示例图走 /api/ingest_sample 预置")

    c = add("E3", GROUPS[4], "单品图片资源完整（items 引用的图都存在）")
    if ok and isinstance(items, list):
        missing = []
        external = 0
        for it in items:
            img = (it.get("image") or "").strip()
            if not img:
                missing.append(it.get("id"))
                continue
            if img.startswith(("http://", "https://", "data:")):
                external += 1
                continue
            if not (WEB / img.lstrip("/")).exists():
                missing.append(it.get("id"))
        if not missing:
            extra = f"，另有 {external} 条外部图链接（断网时无法加载）" if external else ""
            c.done("pass", f"{len(items)} 件单品图片全部在本地{extra}")
        else:
            c.done(
                "fail",
                f"{len(missing)} 件单品缺图（id 前几个: {missing[:5]}）",
                "重新入柜这些单品，或从 git 恢复 web/assets/items/ 目录",
            )
    else:
        c.done("warn", "items 不可用，跳过图片完整性检查")

    ok_s, samples = _load_json(DATA / "samples.json")
    sample_imgs = [p for p in (WEB / "assets" / "samples").glob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")] if (WEB / "assets" / "samples").exists() else []
    c = add("E4", GROUPS[4], "示例素材 samples 可用（现场兜底入柜素材）")
    if ok_s and isinstance(samples, dict) and sample_imgs:
        n = len(samples.get("samples", []))
        c.done("pass", f"samples.json 含 {n} 条，assets/samples 有 {len(sample_imgs)} 张图")
    else:
        c.done("warn", "示例素材缺失或为空", "补 sample_*.jpg 到 web/assets/samples/ 并维护 samples.json")

    c = add("E5", GROUPS[4], "离线快照 offline.js 与 JSON 同源（file:// 双击兜底）")
    if fix:
        _fix_offline()
    sys.path.insert(0, str(SCRIPTS))
    try:
        import build_offline_data  # noqa: PLC0415
        wrote, md5 = build_offline_data.build(quiet=True)
        if not wrote:
            c.done("pass", f"已同步（SOURCE_MD5 {md5[:8]}）")
        else:
            c.done("fail", f"offline.js 落后于 JSON（SOURCE_MD5 应为 {md5[:8]}）", "重跑 python scripts/build_offline_data.py（或本脚本 --fix）")
    except Exception as exc:  # noqa: BLE001
        c.done("fail", f"无法校验: {type(exc).__name__}: {exc}", "确认 web/data/ 下 5 个 JSON 齐全后重跑")

    ok_p, pend = _load_json(DATA / "pending.json")
    n_pend = len(pend) if (ok_p and isinstance(pend, list)) else -1
    c = add("E6", GROUPS[4], "待确认区 pending 状态")
    if n_pend < 0:
        c.done("warn", "pending.json 缺失或不可解析（无待确认区，正常）")
    elif n_pend == 0:
        c.done("pass", "无待确认堆积")
    else:
        c.done(
            "warn",
            f"有 {n_pend} 条待确认（试穿照/不确定图）",
            "演示前处理：每条用 /api/pending/<id>/commit 确认入柜，或 /skip 丢弃，避免评委看到堆积",
        )

    c = add("E7", GROUPS[4], "其他数据文件齐全（tarot/style-system/slot-samples）")
    miss = [f for f in ("tarot.json", "style-system.json", "slot-samples.json") if not (DATA / f).exists()]
    if not miss:
        c.done("pass", "塔罗/风格系统/槽位样例数据齐全")
    else:
        c.done("fail", f"缺少: {', '.join(miss)}", "从 git 恢复或重新生成对应 JSON")

    # F. 前端资源与服务
    c = add("F1", GROUPS[5], "前端关键文件齐全")
    need = ["index.html", "app.js", "engine.js", "shell.js", "style.css", "me.js", "oracle.js", "data/offline.js"]
    miss = [f for f in need if not (WEB / f).exists()]
    if not miss:
        c.done("pass", "index.html + 主脚本 + offline.js 全部在位")
    else:
        c.done("fail", f"缺少: {', '.join(miss)}", "从 git 恢复 web/ 目录")

    c = add("F2", GROUPS[6], "本地服务状态（端口 8787）")
    if _port_in_use():
        if _api_items_ok():
            c.done("pass", f"服务已在运行，/api/items 返回 200")
        else:
            c.done("fail", "8787 被占用但 /api/items 无响应", "关掉占用进程后重跑 python server/app.py")
    else:
        c.done(
            "warn",
            "服务未启动",
            "演示前运行: python server/app.py  （然后浏览器打开 http://localhost:8787）",
        )

    c = add("F3", GROUPS[6], "演示访问方式（URL 汇总）")
    ip = _lan_ip()
    urls = [f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}"]
    if ip:
        urls.append(f"http://{ip}:{PORT}（真机同 WiFi）")
    urls.append("file:// 双击 web/index.html（完全离线兜底）")
    c.done("info", "；".join(urls))


def main() -> int:
    args = sys.argv[1:]
    fix = "--fix" in args
    want_json = "--json" in args
    unknown = [a for a in args if a not in ("--fix", "--json")]
    if unknown:
        print(f"未知参数: {unknown}", file=sys.stderr)
        print("用法: python scripts/demo_preflight.py [--fix] [--json]", file=sys.stderr)
        return 2

    # --fix：先修安全项（建目录 + 重建 offline.js），再统一检查
    if fix:
        created = _fix_dirs()
        offline_msg = _fix_offline()
        print("[fix] 补齐目录: " + (", ".join(created) if created else "无缺失"))
        print(f"[fix] {offline_msg}")
        print()

    run_checks(fix)

    if want_json:
        report = {
            "ok": all(c.status != "fail" for c in CHECKS),
            "counts": {s: sum(1 for c in CHECKS if c.status == s) for s in ("pass", "warn", "fail", "info")},
            "checks": [{"id": c.cid, "group": c.group, "name": c.name, "status": c.status, "detail": c.detail, "fix": c.fix} for c in CHECKS],
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["ok"] else 1

    last_group = None
    for c in CHECKS:
        if c.group != last_group:
            print(f"\n【{c.group}】")
            last_group = c.group
        line = f"  {_MARK[c.status]} {c.cid} {c.name}"
        if c.detail:
            line += f" —— {c.detail}"
        print(line)
        if c.status == "fail" and c.fix:
            print(f"        修复: {c.fix}")
        elif c.status == "warn" and c.fix:
            print(f"        提示: {c.fix}")

    counts = {s: sum(1 for c in CHECKS if c.status == s) for s in ("pass", "warn", "fail", "info")}
    print("\n" + "-" * 60)
    print(f"SUMMARY  ✅{counts['pass']}  ⚠️{counts['warn']}  ❌{counts['fail']}  ℹ️{counts['info']}")
    if counts["fail"]:
        print("结论: 存在阻断项 ❌，先按上方『修复』处理，再重跑本脚本到全绿。")
        return 1
    print("结论: 无阻断项，可以演示 ✅ （⚠️ 为提示项，不影响演示；ℹ️ 为信息）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
