# AI 电子衣柜｜全局主题动态与身份平铺 V8

整个手机页面在 `#phone` 下分为 Theme Motion、Atmosphere、App Content、Interaction Effect 四个系统。主题星点跨首页、衣柜、玩法和个人页持续存在，强度随页面降低。流光有稀疏雾紫星点和光尘；深空有两层金色星点、极淡光斑和偶发微弱流星。切主题时两套背景与 UI 在约 820ms 内过渡。

首页流光和深空背景已换成用户提供的两张原图，分别为 `assets/home-layers/flow-background.png` 和 `assets/home-layers/space-background.png`。原图本身包含拱窗、帘幕与花叶，已停用重复的叠加素材。场景图片由 Atmosphere 承载，卡片与衣物属于稳定的 App Content。点击、抽牌等反馈只在 Interaction Effect 短暂出现。回访用户进入首页，左上角打开“我的”，右上角切换流光 / 深空。身份页六组两列平铺，每组两个身份。

打开 `standalone-demo.html` 看单文件；`index.html` 为可接 API 工程。完整清单见 `页面组件与素材清单_V8.md`。
