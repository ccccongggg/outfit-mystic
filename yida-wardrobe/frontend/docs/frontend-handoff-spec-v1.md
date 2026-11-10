# AI电子衣柜｜高保真前端交付包规范 V1

> 目标：把当前视觉体系真正变成可运行的高保真 App Web 界面，并让后端队友可以直接接入真实数据与接口。
> 核心原则：**视觉层与数据层分离；前端先用 Mock 数据跑通，后端只替换数据来源，不改页面结构。**

---

# 1. 最终应该输出什么

不是继续输出 PNG。

正式交付建议是一整个文件夹：

```text
ai-wardrobe-frontend/
├─ index.html
├─ css/
│  ├─ theme-tokens.css
│  ├─ app.css
│  ├─ components.css
│  └─ motion.css
│
├─ js/
│  ├─ app.js
│  ├─ router.js
│  ├─ state.js
│  ├─ mock-api.js
│  ├─ api-adapter.js
│  ├─ recommendation.js
│  └─ pages/
│     ├─ home.js
│     ├─ tarot.js
│     ├─ energy.js
│     ├─ identity.js
│     ├─ input.js
│     ├─ wardrobe.js
│     ├─ profile.js
│     └─ records.js
│
├─ data/
│  ├─ mock-user.json
│  ├─ mock-wardrobe.json
│  ├─ mock-outfits.json
│  ├─ identities.json
│  └─ tarot-deck.json
│
├─ assets/
│  ├─ icons/
│  ├─ tarot/
│  ├─ demo-clothes/
│  └─ backgrounds/
│
├─ contracts/
│  ├─ api-contract.md
│  ├─ frontend-data-schema.json
│  └─ event-contract.md
│
└─ README.md
```

---

# 2. 最核心的 4 个文件

## 2.1 `index.html`

用途：

> 真正能打开、点击、切换、体验的高保真 App。

要求：

- 不是概念图
- 不是 PPT
- 不是静态页面
- 手机端优先
- 所有核心页面可交互
- Flow / Space 双主题
- 支持真实页面切换
- 使用 Mock 数据也能完整跑 Demo

---

## 2.2 `theme-tokens.css`

用途：

> 把“流光 / 深空”视觉体系真正变成代码。

例如：

```css
[data-theme="flow"] {
  --bg-app: #FAF8F5;
  --bg-surface: #F4EFFB;
  --text-primary: #302A3D;
  --accent-primary: #7357D9;
}

[data-theme="space"] {
  --bg-app: #0B0B0C;
  --bg-surface: #171719;
  --text-primary: #F1ECE6;
  --accent-primary: #D4B896;
}
```

以后：

> 页面不直接写颜色。

只调用 Token。

这样换主题时：

> 页面结构完全不用改。

---

## 2.3 `api-adapter.js`

这是给后端队友最重要的文件。

前端页面永远只调用：

```js
api.getWardrobe()
api.getWeather()
api.createRecommendation()
api.confirmOutfit()
api.getRecords()
```

开发阶段：

```text
api-adapter
→ mock-api
```

接后端后：

```text
api-adapter
→ fetch / real API
```

页面本身不用重写。

---

## 2.4 `api-contract.md`

这是前后端交接文档。

必须写清：

```text
接口叫什么
输入什么
返回什么
哪个页面用
错误状态是什么
```

例如：

```text
POST /recommendations

Request:
{
  "wardrobe_id": "w_001",
  "target_date": "2026-09-27",
  "source": {
    "type": "identity",
    "payload": {
      "identity": "大女主"
    }
  }
}

Response:
{
  "session_id": "rec_001",
  "outfits": [...]
}
```

后端队友：

> 按这个格式返回即可。

---

# 3. 为什么不能继续只做单文件 HTML

单文件 HTML：

> 很适合 Demo。

但不适合正式联调。

因为后面会出现：

```text
页面越来越多
CSS 越来越长
数据写死
接口不好替换
玩法代码互相污染
```

所以正式高保真阶段应该：

> **保留 HTML Demo 的视觉和交互语言，但拆成前端工程结构。**

---

# 4. 页面应该怎么拆

不要每个页面都写一个独立 HTML。

建议：

```text
一个 index.html
+
JS Router
+
多个 Page Module
```

例如：

```text
/home
/tarot
/energy
/identity
/input
/wardrobe
/me
/records
```

这更接近真实 App。

---

# 5. 组件怎么拆

## 全局组件

```text
AppShell
StatusBar
TopNav
BottomNav
ThemeBackground
DateSelector
WeatherChip
WardrobeSelector
```

---

## 首页组件

```text
GameplayRail
GameplayCard
SeasonTrendPopup
DailySuggestion
```

---

## 结果组件

```text
OutfitCarousel
OutfitCard
SourceBadge
ReasonPanel
ConfirmButton
```

---

## 玩法组件

```text
TarotWheel
TarotPickedCards
EnergySlider
IdentityCard
InputParser
ConstraintChips
```

---

# 6. 结果页不要写死成一个页面

前端结构：

```text
TarotResult
EnergyResult
IdentityResult
InputResult
```

但共享：

```text
OutfitCarousel
ReasonPanel
ConfirmAction
```

这样既能：

> 保留每个玩法自己的视觉体验

又能：

> 避免重复写四套推荐逻辑。

---

# 7. Mock 数据必须独立

不要把：

```js
const wardrobe = [...]
```

散落在页面代码里。

统一放：

```text
/data
```

例如：

```text
mock-wardrobe.json
mock-outfits.json
```

以后后端一接：

> Mock 文件直接不用。

---

# 8. 推荐数据结构必须统一

所有玩法最终给前端的 Outfit 至少保持：

```json
{
  "outfit_id": "outfit_001",
  "source": "wardrobe",
  "items": [],
  "reason": "",
  "is_reference": false
}
```

AI 参考：

```json
{
  "source": "ai_reference",
  "is_reference": true
}
```

前端据此自动显示：

> AI 推荐参考｜非我的衣柜

不靠人工写文案。

---

# 9. `source` 玩法结构

建议固定：

```json
{
  "type": "tarot | social_energy | identity | input",
  "payload": {}
}
```

比如：

```json
{
  "type": "social_energy",
  "payload": {
    "value": 67
  }
}
```

页面只负责展示。

---

# 10. target_date 一定要进入接口

不能只显示在前端。

每次推荐都需要：

```json
{
  "created_at": "...",
  "target_date": "2026-09-27"
}
```

后端推荐、记录、覆盖逻辑全部以：

> `target_date`

为准。

---

# 11. “就穿这套”接口

前端：

```js
api.confirmOutfit({
  target_date,
  outfit_id
})
```

如果当天已有：

```json
{
  "status": "conflict"
}
```

前端弹：

> 这一天已经有一套穿搭，要覆盖吗？

确认后：

```js
api.confirmOutfit({
  target_date,
  outfit_id,
  overwrite: true
})
```

---

# 12. 视觉资产怎么处理

正式前端不要使用：

> 一张完整大图当页面背景截图。

应该拆：

```text
背景氛围
装饰元素
图标
卡牌
服装图
```

分别放到：

```text
/assets
```

Flow / Space：

> 尽量通过 CSS / SVG / Token 产生。

这样后端数据变了：

> 页面仍然成立。

---

# 13. 动效文件

建议单独：

```text
motion.css
```

以及少量 JS。

包括：

```text
玩法卡横滑
当前卡放大
主题星点
塔罗牌轮
抽牌飞到顶部
三张一起翻牌
Outfit 左右滑
页面 settle
```

支持：

```text
prefers-reduced-motion
```

---

# 14. 给队友的 README 必须写什么

README 第一屏直接告诉技术：

```text
怎么运行
入口在哪里
Mock 数据在哪里
真实 API 替换哪里
Theme Token 在哪里
页面 Route 有哪些
```

最重要一句：

> **请只替换 `api-adapter.js` 的数据来源，不要直接修改页面 Mock 数据。**

---

# 15. 最适合当前项目的交付形式

考虑目前仓库已经大量使用：

```text
HTML + CSS + JS
```

以及塔罗也是：

```text
web/tarot/index.html
```

当前黑客松阶段最稳妥的是：

> **原生 HTML / CSS / JS 高保真前端壳。**

不要现在突然重构 React / Vue。

除非技术队友明确说：

> 主项目已经使用 React / Vue。

否则会增加无意义成本。

---

# 16. 最终你要交给队友的不是“设计稿”

而是：

```text
可运行前端
+
Theme Token
+
Mock 数据
+
API Adapter
+
数据 Schema
+
接口 Contract
```

队友拿到以后：

```text
启动前端
↓
看到完整高保真页面
↓
后端按 Contract 写 API
↓
替换 Mock
↓
联调
```

---

# 17. 下一步应该怎么做

## Step 1

先做：

> **H01 玩法首页高保真真实代码版**

把你现在确认的：

- 悬挂玩法卡
- 中央卡放大
- 横滑
- Flow / Space
- 天气
- 今日建议
- Bottom Nav
- 背景动态

全部代码化。

---

## Step 2

做：

> **G01 塔罗高保真代码版**

- 大弧形牌轮
- 选牌
- 缩到顶部
- 3 张一起翻牌
- Result

---

## Step 3

再补：

```text
Energy
Identity
Input
我的
记录
```

---

## Step 4

最后统一：

> `api-adapter.js + contracts`

交给后端队友接。

---

# 18. 一句话结论

现在最应该输出的不是：

> 更多视觉图片。

而是：

> **一套可直接运行、视觉已经定稿、数据接口已解耦的高保真前端工程。**

这样视觉不会在后端接入时被推倒重做。
