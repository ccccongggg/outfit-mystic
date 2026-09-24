# 电子衣柜 × AI 玄学搭配

一条主链路从上传跑到结果页：**上传 → 白底 → 打标 → 衣橱 → 塔罗约束 → 规则选款 → 文案拼贴**。

## 范围内

- 上传衣服照 → `rembg` 抠底 → 白底/透明 PNG
- VLM 打标（品类/色/版型/季节/风格）+ 缓存
- 衣橱列表（预置 + 新上传）
- 塔罗抽 1 张牌 → 约束 JSON
- 规则引擎选出上衣+下装+鞋
- 结果页：3 件拼贴 + 中文推荐理由

## 范围外（本期不做）

- 六入口全功能（只保塔罗 + 其它空壳）
- 完整搭配美学规则 / 学习模型 / CLIP 向量
- YOLO 拆混搭图、MediaPipe、图生图上身
- 登录、云库、多端同步
- UI 精修、移动端适配精修

## 快速开始

```bash
# 依赖
pip install rembg onnxruntime pillow
# 可选（更准的取色）
pip install colorthief

# 配置密钥
cp .env.example .env   # 填 VLM_*

# 启动本地小服务（推荐）
python server/app.py
# 浏览器打开 http://127.0.0.1:8787
```

无后端降级：直接打开 `web/index.html`，用手动标签模式。

## 数据契约

- 单品 `item` / 约束 `constraint` / 结果 `result` 见 `web/data/items.json`、`server/app.py` 注释。
- 六个入口只允许产出 `constraint` 结构；引擎只读该结构。

## 断网兜底

1. 打标失败 → 读 `cache/tagged/<md5>.json`
2. 仍失败 → 前端手动标签 UI
3. 理由失败 → 模板拼接文案

## 验收口令

| # | 检查 | 通过标准 |
|---|---|---|
| A1 | 上传 | 原图 → 透明 PNG / 白底图，背景干净 |
| A2 | 打标 | JSON 字段齐全；色号与肉眼主色基本一致 |
| A3 | 衣橱 | 新单品 1 秒内出现在列表 |
| A4 | 约束 | 点塔罗后 `constraint` 有 `story` 与 `style_tags` |
| A5 | 选款 | 结果 3 件都来自衣橱真实 id |
| A6 | 理由 | 2–3 句中文，提到氛围/牌意，无技术词 |
| A7 | 兜底 | 断网或 VLM 失败时仍能出结果 |
