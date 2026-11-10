# 电子衣柜 · 易搭整合版（yida-wardrobe）

> **电子衣柜 · 易搭整合版**的唯一独立仓库（2026-10 从原合并仓拆出）。原合并仓已于 2026-11 归档停用（只读，最终删除待仓库管理员执行），弦养项目与补充资料统一归到 `xianyang-s4`。

🌐 **手机端公网链接（已部署）**：<https://yida-wardrobe-33227.app.workbuddy.host/>

🔗 **相关仓库**
- 八段锦 × 古琴（弦养）：<https://github.com/ccccongggg/xianyang-s4>
- 队友补充资料（弦养方向，已并入弦养仓）：<https://github.com/ccccongggg/xianyang-s4/tree/main/supplementary>

⚠️ **密钥红线**：真实 `VLM_API_KEY` 绝不入库、绝不外发；本仓仅含 `backend/.env.example` 模板。

---

# 易搭整合版 1.0

电子衣柜项目的**最小稳定运行单元**：前端（wardrobe-app）+ 当前真实后端（outfit-mystic/server）+ 历史归档（区分保存）。

> 生成于 2026-10-06。本目录自包含，可整体拷贝到任意机器（需自备 Python venv，见下）。

## 目录结构

```
易搭整合版1.0/
├── frontend/                 # 前端：wardrobe-app（迭代2）
│   ├── index.html
│   ├── assets/  js/  css/  data/  prototype/
│   └── ...
├── backend/                 # 后端：outfit-mystic/server 改造版
│   ├── server/app.py        # 已改造：serving frontend/，并挂 /api/v1 适配桥
│   ├── scripts/             # remove_bg / tag_image / write_reason / build_offline_data 等
│   ├── data/                # items.json / samples.json / pending.json 等（来自 outfit-mystic/web/data）
│   ├── .env.example         # 复制为 .env 并填 VLM_API_KEY 启用打标
│   └── requirements.txt      # rembg / Pillow / numpy
├── archive/                 # 历史探索方向（与主线区分保存）
│   ├── zz-src/              # 旧源码尝试
│   └── 银发计划/            # 银发计划探索方向（非本电子衣柜项目文件）
├── start.bat                # Windows 一键启动（端口 8790）
└── README.md
```

## 运行方式（便携，无需写死路径）

1. 双击 `start.bat`（Windows）/ 运行 `bash start.sh`（macOS·Linux）。
   脚本会自动探测本机 Python（py / python / python3）→ 在 `backend/venv` 建虚拟环境 → `pip install -r backend/requirements.txt`（含 rembg）→ 启动后端（端口 8790）。
2. 浏览器打开 `http://127.0.0.1:8790`（即 wardrobe-app 前端）。
3. 想体验**真实 AI 功能**，打开 `http://127.0.0.1:8790/real-demo.html`（见下章）。

> 旧版 README 写死的 `C:\Users\Cccong\...` venv 路径已废弃，现改用自动探测，队友机器直接可跑。

## 在手机 / 平板上使用（局域网访问）

默认 `start.bat` / `start.sh` 把后端绑在 `127.0.0.1`（仅本机），**手机访问不到**。要让手机能打开，用「局域网模式」启动：

1. **Windows**：双击 `start-phone.bat`（或先 `set HOST=0.0.0.0` 再跑 `start.bat`）。
   **macOS·Linux**：`bash start-phone.sh`（或 `HOST=0.0.0.0 bash start.sh`）。
2. 启动日志会打印形如 `http://192.168.x.x:8790` 的**局域网地址**（电脑需连 Wi-Fi，手机连同一 Wi-Fi）。
3. **手机浏览器**打开这个地址：
   - 主应用（衣柜 / 拿主意 / 广场）：`http://192.168.x.x:8790/`
   - 真实功能体验台：`http://192.168.x.x:8790/real-demo.html`
4. 若手机打不开：检查电脑**系统防火墙**是否放行 8790 端口；确认手机和电脑在同一网段（同一 Wi-Fi，且路由器未开「访客隔离 / AP 隔离」）。

> 手机端已做适配：真机竖屏铺满全屏、避让刘海与底部小白条（`env(safe-area-inset-*)` + `100dvh`）、横屏自动铺满；主应用默认 `apiMode:"mock"`，**不连后端也能完整浏览衣橱与玩法演示**，只有「真实抠底 / VLM 打标 / 玄学文案」需要后端在局域网启动。

## 给队友体验真实功能（推荐入口：real-demo.html）

队友要的是**真实链路**（抠底 / VLM 打标 / 玄学文案 / 塔罗全链路）而非 mock 演示。`frontend/real-demo.html` 是一张独立的「真实功能体验台」，直连后端真实接口，不依赖 wardrobe-app 那套对不上的 `/api/v1` 契约。包含四块：

1. **真实抠底 + VLM 打标**：上传你的衣服图 → `POST /ingest`（真实 rembg 抠底 + 真实 VLM 打标）。
2. **免上传示例体验**：`POST /api/ingest_sample`，用内置示例图跑完整真实流水线（无素材也能演示）。
3. **玄学文案生成**：`POST /api/reason`，真实生成推荐理由。
4. **当前衣橱 / 待确认区**：实时查看入柜单品与「试穿照待人工放行」队列。

页面会**如实**标注每次调用的真实状态：
- `tag_ok=true` + `source=ai` → VLM 真实打标成功；
- `tag_ok=false` → VLM 未配置/不可用，标签为兜底空结果；
- `source=sample-preset` → 使用示例预设标签（断网/无密钥时的离线兜底）；
- 文案若含兜底模板特征 → 页面会标红提示「该文案为兜底模板，配置密钥后即为 AI 真实生成」。

> 即点即看真实效果，队友据此给修改建议最直观。

## 工作模式

- 前端默认 `apiMode: "mock"`：**无需后端即可完整演示**（衣橱数据走本地 `frontend/data/*.json` 兜底）。
- 后端提供真实 API：
  - `GET /api/items`、`POST /api/reason`、`POST /ingest`、`/api/pending/*` 等（outfit-mystic 原接口）
  - `GET /api/v1/bootstrap`、`GET /api/v1/wardrobes/current/items`（wardrobe-app 最小适配桥；前者返回版本信息，后者直读 `frontend/data/wardrobe-items.json`）
- 若要让 wardrobe-app 切到真实后端：在 `frontend/js/config.js` 把 `apiMode` 改为 `"real"`、并把 `/api/v1` 其余端点（recommendations / intent / outfits 等）在 `backend/server/app.py` 补齐。当前仅桥接了衣橱数据，保证稳定。

## 启用 VLM 打标（可选，但真实体验需要）

复制 `backend/.env.example` 为 `backend/.env`，填入：
```
VLM_API_KEY=你的DashScopeKey
VLM_MODEL=qwen-vl-max
VLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

> ⚠️ **密钥红线**：`VLM_API_KEY` 是真实凭据，**绝不进项目文件夹、绝不入库、绝不发群里**。队长（Cong）私下把 key 发给队友，队友在自己机器 `backend/` 下新建 `.env` 填入即可。当前仓库只发 `.env.example`，无真实密钥。

不填也能启动，仅 `/ingest` 打标与 `/api/reason` 文案会走兜底，不影响前端浏览与真实抠底演示。

## 归档说明

- `archive/zz-src/` 与 `archive/银发计划/` 为**前期构思/探索尝试**，非当前电子衣柜主链路。仅作留存参考，不在本整合版内运行。
- 其中「银发计划」属于另一方向的早期探索文件，与本电子衣柜项目无依赖关系，单独区分保存以免混淆。
