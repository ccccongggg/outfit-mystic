#!/usr/bin/env bash
# refresh_style_system.sh —— 风格谱系重跑：采集图 → 提取 → 归纳 → 离线快照
#
# 用法：
#   bash scripts/refresh_style_system.sh            # 默认读 cache/blog_seed/ 下的新博主穿搭图
#   bash scripts/refresh_style_system.sh <目录>     # 读任意图片目录
#
# 前置：outfit-mystic/.env 含有效 VLM_API_KEY（extract_look.py 提取单照风格用）。
# 依赖：仅 Python 标准库，无需 numpy/Pillow。
#
# 步骤：
#   1) extract_look.py  <种子目录>  → 每张图调 VLM 写 cache/looks/<md5>.json（断网/二跑读缓存）
#   2) induce_style_system.py       → 读 cache/looks/*.json + 衣橱 + 塔罗 → web/data/style-system.json
#   3) build_offline_data.py        → 把 style-system.json 打进 web/data/offline.js（第 5 源，双击可用）
set -e
cd "$(dirname "$0")/.." || exit 1
SEED="${1:-cache/blog_seed}"

echo "[1/3] extract_look.py → $SEED"
python scripts/extract_look.py "$SEED"
echo "[2/3] induce_style_system.py"
python scripts/induce_style_system.py
echo "[3/3] build_offline_data.py"
python scripts/build_offline_data.py
echo "DONE → web/data/style-system.json + web/data/offline.js"
