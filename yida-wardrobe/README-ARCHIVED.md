# 本目录 = 已归档的 `yida-wardrobe`

> 来源：`ccccongggg/yida-wardrobe`（Private，原「易搭整合版 1.0」）
> 归档时间：2026-11-10
> 操作：**原样并入**本仓 `outfit-mystic`，零修改、零丢失。原远程仓已归档停用（Archived）。

## 为什么在这里

`outfit-mystic` 与 `yida-wardrobe` 是**同一条「电子衣橱 × AI 玄学搭配」产品线的两个平行版本**，目录约定不同：

- `outfit-mystic`（本仓根）：`web/` + `server/app.py` + `scripts/`（更轻量、带可外链离线 demo）
- `yida-wardrobe`（本子目录）：`frontend/` + `backend/`（更完整，含 44 个脚本 + 数据 + 真机截图）

两者 56/73 同名文件逐字节相同，17 个核心文件（含 `app.js`/`index.html`/`app.py`/数据）各自演进过。合并为单一公开主仓时采用「保底不丢」策略：yida 整个内容原样放在此子目录，后续再逐步统一结构。

## 内部结构（原样）

- `frontend/` — wardrobe-app 前端（375 文件，含 assets / data / contracts / docs）
- `backend/` — `app.py` + `scripts/`（44 脚本：rembg 抠底 / VLM 打标 / 玄学文案 / 女装化改造等）+ `data/`
- `_preview/` — 7 张真机截图
- `start*.{sh,bat}` — 启动脚本
- `技术路线图.html` / `给下个对话AI_可并行_绿灯区23实现规格.md` — 规划交接文档

## 还原方法

如需把这部分独立回一个仓库，直接将此目录内容作为新仓库根即可（`.git` 未带入，干净）。
