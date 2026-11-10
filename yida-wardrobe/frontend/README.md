# AI电子衣柜｜视觉交互前端工程 V8

当前视觉、交互和打开方式以 `README-visual-v8.md` 为准。

这不是视觉截图，而是一套可运行的手机端高保真前端壳。当前默认接 Mock API；后端完成后只需要切换 Adapter，不需要重新画页面。

## 1. 最快打开

直接双击 `index.html` 即可运行 Mock 版。

如果浏览器对本地文件有限制，运行：

```bash
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

Windows 也可以双击 `start-demo.bat`。

## 2. 切换真实后端

编辑 `js/config.js`：

```js
apiMode: "real",
apiBaseUrl: "http://localhost:你的后端端口"
```

前端页面只通过 `window.WardrobeAPI` 请求数据。
接口见：`contracts/api-contract.md`。

## 3. 当前已实现的高保真路径

- 首次欢迎，可跳过建柜
- 让 AI 认识衣柜，可跳过
- 拍照 / 相册 / 批量（三选一的视觉入口，Demo 使用模拟识别）
- 首页 target_date：今天 / 明天 / 选日期
- 首页悬挂式玩法卡：中央卡高亮；点击邻卡先居中；长按删除；`＋` 永久存在
- Flow / Space 双主题与动态背景
- 塔罗：大弧牌轮，抽 3 张，前三张收至顶部，3 张后一起翻牌；38% 逆位
- 社交电量：1–100 连续滑条
- 身份：6 频道 × 12 身份
- 跃然：输入 → 我读到了什么 → 衣服跃出 → 同页结果
- Outfit Carousel：用户衣柜结果 + AI 参考结果
- AI 参考明确标注“非我的衣柜”，不能直接记为已穿
- `就穿这套`：同日期已有结果时弹覆盖确认
- 我的：头像/昵称/介绍、今日穿搭背景、我的衣橱/穿搭记录、帖子 Grid
- 设置：个人信息、主题设置
- 穿搭记录：历史 / 未来两个库

## 4. 视觉系统

正式色值：

### 流光 Flow
- `#FAF8F5`
- `#F4EFFB`
- `#302A3D`
- `#7357D9`
- `#CDB8EE`

### 深空 Space
- `#0B0B0C`
- `#171719`
- `#F1ECE6`
- `#D4B896`
- `#B89568`

所有真实衣物图片区保持中性浅底，不被 Theme 染色。

## 5. 后端最重要的接入点

1. `POST /recommendations`
2. `POST /outfits/confirm`
3. `POST /intent/parse`
4. `GET /wardrobes/current/items`
5. `GET /outfit-records`
6. `GET /trends/seasonal`

具体 Schema 在 `contracts/`。

## 6. 文件说明

```text
index.html                 高保真 App 壳
css/theme-tokens.css       双主题 Token
css/app.css                基础布局
css/components.css         页面与组件视觉
css/motion.css             动效 / Reduced Motion
js/app.js                  当前高保真渲染与交互
js/api-adapter.js          唯一后端替换层
js/mock-api.js             Mock 后端
data/*.json                Demo / 内容数据
assets/demo-clothes/       服装与参考穿搭素材
contracts/                 API / Schema / Event Contract
docs/                      页面冻结与已知缺口
prototype/                 单文件原型备份
```

## 7. 注意

`docs/known-gaps.md` 中的 5 个事项仍需团队拍板/联调；它们不是前端漏做，而是当前项目业务源尚未冻结的接口点。
