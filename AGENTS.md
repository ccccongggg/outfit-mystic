# 电子衣柜(outfit-mystic)· 局部协作约定(Claude Code / Codex 共用入口)

> 本文件只适用于 `outfit-mystic/` 及其子目录。
> 总体项目合同见 `../AGENTS.md`;总体计划、交接和文档分别见 `../flow/`、`../docs/`。
> 同目录 `CLAUDE.md` 指向本文件(Windows 为副本),两个工具读取同一份局部规则。
> **本目录是独立 git 仓库(main 分支)**——代码提交在这里,协作控制层在根级。

## 职责边界

- **负责**:电子衣柜的完整主链路 —— 上传单品图 → 自动白底 → AI 打标 → 衣橱 → 塔罗约束 → 规则选款 → 文案与三格拼贴结果页。
- **不负责**:
  - 项目级计划 / 决策 / 交接记录(在根级 `../flow/`)
  - 跨模块或需统一发现的文档(在根级 `../docs/`)
  - `../archive/` 下的历史方向(银发计划、zz-src),与本模块无关,不要改动
- **输入 / 依赖**:用户上传的单品图;`.env` 中的 `VLM_API_KEY`(qwen-vl-max,dashscope 兼容模式);根级 `../DESIGN.md` 的视觉 token。
- **输出 / 对外契约**:HTTP API(`/ingest`、`/api/items`、`/api/reason`、`/api/items/manual`);跨模块口径若需固化,真相源写根级 `../docs/contracts/`。

## 本模块入口

- **源码**:
  - 前端:`web/`(`index.html`、`app.js`、`engine.js`、样式)
  - 后端:`server/app.py`
  - 脚本:`scripts/`(`remove_bg.py` 抠底、`tag_image.py` 打标、`write_reason.py` 文案、`smoke_dod.py` 冒烟)
- **资源**:`web/assets/items/` 预置单品图、`web/assets/tarot/` 塔罗图与 `tarot.json`、`cache/tagged/` 打标缓存、`uploads/` 上传图
- **测试 / 验收**:`python scripts/smoke_dod.py`(需先起服务)
- **构建 / 运行**:`python server/app.py` → `http://127.0.0.1:8787`
- **关键配置**:`.env`(真实密钥,**不入库**)、`.env.example`(样例)、`package.json`

## 局部约束

- **断网可跑是硬要求**:抠底、打标、选款、文案各层必须保留本地 / 缓存 / 模板兜底路径,不得让整条链路强依赖外网或单一模型。
- **预置单品图必须是真实白底或纯色底商品图**,禁扁平矢量假图(判定:unique colors < 6000);人物上身照 / 杂乱背景在**输入端**拦截提示(见 `web/app.js` 的 `analyzeCutDifficulty`)。
- **`.env` 绝不入库、绝不写进文档**;密钥相关改动只改 `.env`,同步更新 `.env.example` 的字段名(不含值)。
- **视觉遵循 `../DESIGN.md`**:禁 Inter / Roboto,禁紫蓝渐变;token 以 DESIGN.md 为准。
- 这里只记录本模块非显而易见的心智模型、内部约定、禁区和模块级踩坑。
- 跨模块约定写入根级 `../docs/contracts/`,并同步受影响模块的局部入口。
- 总体目标、计划、任务卡、决策、问题和交接只写根级 `../flow/`,**不在本模块重复建立控制层**(本目录内不再建 `flow/`、`docs/`、`.hooks/`、`.claude/`、`.codex/`)。
- 项目文档默认集中在根级 `../docs/`;本目录已有的 `README.md` 属紧贴代码的运行说明,**保留在此**,已从根级 `../docs/README.md` 索引过去。
- 设计稿 `design/mystic-oracle-ui.html` 是「雾紫神谕」换皮的落地依据,改视觉前先对照它。

## 局部知识(durable,随模块积累)

- **各层兜底顺序**(改动时务必保持):
  - 抠底 `remove_bg.py`:rembg → 洪水连通抠底 → 原图透传(三层,无模型也能跑)
  - 打标 `tag_image.py`:VLM → `cache/tagged/` 缓存 → 手动
  - 文案 `write_reason.py`:LLM → 模板兜底
- **已知缺口**(见 `../flow/plan.md`):塔罗仅 4 条(目标 22);`smoke_dod.py` 未实跑且 A5 此前用内联近似替代真调引擎;视觉尚未换皮。
- **引擎**:`web/engine.js` 为极简规则——色名**粗匹配**、**无色距**;禁止色 / 必须色 / 风格重合打分。若要引入真实色距需先在根级 `../flow/decisions.md` 记决策。
