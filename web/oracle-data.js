/* ------------------------------------------------------------------
   经典脚本（原为 ES module，语义等价）
   改因：file:// 下浏览器禁止加载 <script type="module">，双击 index.html
        会整页无法交互。改成经典脚本 + window.Outfit 命名空间后，
        双击打开 / 起本地服务两种方式都能完整跑。
   依赖：由 index.html 按顺序 defer 加载，公共名挂在 window.Outfit 上。
------------------------------------------------------------------ */
(function (NS) {
"use strict";

// web/oracle-data.js —— 「拿主意」这一层要用的全部静态内容
//
// 内容口径全部对齐参考稿（电子衣柜 Demo · 逻辑与内容清单）：
//   BOARDS     挂衣杆上的四个板块 + 一个扩展空位
//   CITIES     天气芯片（全 App 唯一的「自动注入」，只改厚薄）
//   KW         输入式的 8 组关键词对照表（打桩，诚实标注）
//   IDENTITIES 选择式 · 4 张人设卡
//   ENERGY     调节式 · 5 档电量文案
//   SCRATCH    抽取式 · 刮刮乐的 6 个奖面
//   FEED       广场动态流
//
// 改文案、加内容只动这个文件，不用碰逻辑。

// ---------- 二级 · 四个板块 ----------
const BOARDS = [
  {
    k: "draw",
    t: "抽取式",
    s: "交给看不见的力量",
    how: "翻牌 · 刮开 · 摇签",
    color: "#534AB7",
    soft: "#EDEBFB",
    ink: "#3C3489",
    shape: "bag",
    items: [
      { name: "塔罗牌", desc: "随机一张大阿尔卡纳，翻牌出牌义", go: "tarot", on: true },
      { name: "刮刮乐", desc: "手刮到一半，自动揭晓", go: "scratch", on: true },
      { name: "盲盒", desc: "还没挂上来", on: false },
    ],
  },
  {
    k: "dial",
    t: "调节式",
    s: "说说你今天的状态",
    how: "拖滑块 · 连续值 · 实时反馈",
    color: "#D4537E",
    soft: "#FBEAF0",
    ink: "#993556",
    shape: "belt",
    items: [
      { name: "能量条", desc: "拖出今天的电量，实时出状态文案", go: "energy", on: true },
      { name: "社交电量", desc: "还没挂上来", on: false },
    ],
  },
  {
    k: "pick",
    t: "选择式",
    s: "今天你想成为谁",
    how: "点卡片 · 明确的主动决策",
    color: "#1D9E75",
    soft: "#E1F5EE",
    ink: "#0F6E56",
    shape: "coat",
    items: [
      { name: "身份扮演", desc: "四张人设卡，选一个定基调", go: "identity", on: true },
      { name: "今日场景", desc: "还没挂上来", on: false },
    ],
  },
  {
    k: "type",
    t: "输入式",
    s: "直接告诉它",
    how: "打字 · 实时匹配",
    color: "#BA7517",
    soft: "#FAEEDA",
    ink: "#854F0B",
    shape: "tag",
    items: [
      { name: "一句话日记", desc: "打一句话，它自己匹配", go: "input", on: true },
      { name: "水晶能量", desc: "还没挂上来", on: false },
    ],
  },
];

/** 挂衣杆末端那个虚线空位：不是占位，是「结构可插拔」的证明。 */
const EXT_SLOT = {
  k: "ext",
  t: "＋ 再加一个",
  s: "板块可插拔的证明",
  color: "#888780",
  soft: "#F1EFE8",
  ink: "#5F5E5A",
  shape: "dashed",
};

/** 点扩展位要讲的三件事（参考稿原文口径）。 */
const EXT_COPY = [
  "加一个板块只需要三样东西",
  "① 一个交互范式：翻牌 / 拖条 / 选卡 / 打字，选一种",
  "② 一组受控词表：复用全站那套 8 风格 / 24 色 / 7 品类",
  "③ 一个约束生成器：把用户状态翻译成「风格 · 主色 · 避雷色」",
  "所以下一个板块不用改架构，挂上去就行。",
];

// ---------- 天气芯片（只改厚薄，不改风格、不改颜色）----------
const CITIES = [
  { city: "西安", temp: "18℃", w: "阴", label: "薄外套", season: ["春", "秋"], needOuter: true },
  { city: "北京", temp: "9℃", w: "晴", label: "加一件", season: ["秋", "冬"], needOuter: true },
  { city: "上海", temp: "21℃", w: "多云", label: "单层就够", season: ["春", "秋"], needOuter: false },
  { city: "成都", temp: "16℃", w: "小雨", label: "带伞 + 薄外套", season: ["春", "秋"], needOuter: true },
  { city: "广州", temp: "29℃", w: "闷热", label: "越薄越好", season: ["夏"], needOuter: false },
  { city: "哈尔滨", temp: "2℃", w: "风大", label: "羽绒", season: ["冬"], needOuter: true },
];

const DEFAULT_CITY = "西安";

// ---------- 输入式 · 8 组关键词对照表（打桩）----------
const KW = [
  {
    words: ["累", "困", "乏", "没劲", "疲惫", "熬夜", "不想动"],
    tag: "电量 · 低",
    say: "低电量，穿松一点、颜色少一点",
    dir: "米白衬衫 · 直筒牛仔 · 帆布鞋",
    c: { style_tags: ["慵懒", "简约"], must_colors: ["米白", "奶油白"], avoid_colors: ["纯黑"], prefs: { energy: 20, brightness: 78, formality: 2 } },
  },
  {
    words: ["面试", "实习", "答辩", "宣讲", "汇报", "正式"],
    tag: "场景 · 正式",
    say: "正式场合，先把锐角收掉",
    dir: "燕麦西装 · 白 T · 直筒西裤",
    c: { style_tags: ["通勤", "简约"], occasions: ["正式", "通勤"], must_colors: ["纯白", "燕麦"], prefs: { energy: 45, brightness: 60, formality: 4 } },
  },
  {
    words: ["约会", "见面", "喜欢", "暧昧", "相亲"],
    tag: "场景 · 约会",
    say: "柔色系，别用力过猛",
    dir: "藕粉针织 · 半裙 · 小手包",
    c: { style_tags: ["甜美", "文艺"], must_colors: ["藕粉", "奶油白"], avoid_colors: ["纯黑"], occasions: ["约会"], prefs: { energy: 50, brightness: 72, formality: 2 } },
  },
  {
    words: ["拍照", "拍片", "出片", "扫街", "看展", "展"],
    tag: "场景 · 出片",
    say: "要有轮廓，镜头里才立得住",
    dir: "文艺叠穿 · 长裙 · 帆布鞋",
    c: { style_tags: ["文艺", "复古"], must_colors: ["焦糖", "燕麦"], prefs: { energy: 55, brightness: 55, formality: 3 } },
  },
  {
    words: ["图书馆", "上课", "自习", "教室", "坐一天"],
    tag: "场景 · 久坐",
    say: "久坐要松，室内外温差要一层",
    dir: "宽松针织 · 直筒裤 · 薄外套",
    c: { style_tags: ["慵懒", "简约"], must_colors: ["米白"], prefs: { energy: 35, brightness: 65, formality: 2 } },
  },
  {
    words: ["热", "夏天", "晒", "闷"],
    tag: "天气 · 热",
    say: "先降温，颜色可以亮一点",
    dir: "棉麻衬衫 · 短裤 · 凉鞋",
    c: { style_tags: ["运动", "简约"], season: ["夏"], prefs: { energy: 70, brightness: 70, formality: 1 } },
  },
  {
    words: ["冷", "降温", "风大", "秋", "冬"],
    tag: "天气 · 冷",
    say: "先保厚，再谈风格",
    dir: "驼色大衣 · 高领 · 短靴",
    c: { style_tags: ["复古", "通勤"], season: ["秋", "冬"], must_colors: ["焦糖", "暖棕"], prefs: { energy: 40, brightness: 45, formality: 3 } },
  },
  {
    words: ["开心", "兴奋", "想美", "漂亮", "高兴"],
    tag: "情绪 · 上扬",
    say: "今天可以明艳一次",
    dir: "正红半裙 · 白衬衫 · 玛丽珍",
    c: { style_tags: ["明艳", "甜美"], must_colors: ["正红", "纯白"], prefs: { energy: 85, brightness: 60, formality: 3 } },
  },
];

// ---------- 选择式 · 4 张人设卡 ----------
const IDENTITIES = [
  {
    id: "heroine", symbol: "◆", name: "女主角", line: "今天你是镜头中心",
    style_tags: ["明艳", "甜美"], must_colors: ["正红", "奶油白"], avoid_colors: ["炭灰", "银灰"],
    prefs: { energy: 85, brightness: 62, formality: 3 },
  },
  {
    id: "senior", symbol: "◇", name: "学姐", line: "靠谱，但不费力",
    style_tags: ["通勤", "简约"], must_colors: ["燕麦", "浅蓝"], avoid_colors: ["玫粉"],
    prefs: { energy: 50, brightness: 60, formality: 4 },
  },
  {
    id: "villain", symbol: "▲", name: "反派", line: "不好惹，但好看",
    style_tags: ["复古", "慵懒"], must_colors: ["纯黑", "酒红"], avoid_colors: ["藕粉"],
    prefs: { energy: 55, brightness: 35, formality: 3 },
  },
  {
    id: "invisible", symbol: "○", name: "隐形人", line: "今天不想被看见",
    style_tags: ["慵懒", "简约"], must_colors: ["银灰", "米白"], avoid_colors: ["正红"],
    prefs: { energy: 25, brightness: 72, formality: 2 },
  },
];

// ---------- 调节式 · 5 档电量 ----------
const ENERGY = [
  { min: 0, max: 20, label: "只剩一格电", say: "别为难自己，穿最松的那件", style_tags: ["慵懒"], prefs: { energy: 15, brightness: 78, formality: 1 } },
  { min: 20, max: 45, label: "电量偏低", say: "穿松一点、颜色少一点", style_tags: ["简约"], must_colors: ["米白", "纯白"], prefs: { energy: 32, brightness: 70, formality: 2 } },
  { min: 45, max: 70, label: "半格电", say: "稳稳当当就行", style_tags: ["通勤"], prefs: { energy: 57, brightness: 58, formality: 3 } },
  { min: 70, max: 90, label: "状态不错", say: "可以有点想法", style_tags: ["文艺"], prefs: { energy: 80, brightness: 55, formality: 3 } },
  { min: 90, max: 100, label: "满电", say: "今天可以明艳一次", style_tags: ["明艳", "甜美"], must_colors: ["正红", "亮黄"], prefs: { energy: 95, brightness: 62, formality: 3 } },
];

// ---------- 抽取式 · 刮刮乐 6 个奖面 ----------
const SCRATCH = [
  { name: "今天可以偷懒", style_tags: ["慵懒"], must_colors: ["米白", "奶油白"], say: "刮到「偷懒」：松一点，颜色少一点" },
  { name: "去见想见的人", style_tags: ["甜美", "文艺"], must_colors: ["藕粉"], say: "刮到「想见的人」：柔色系，别用力过猛" },
  { name: "今天要出片", style_tags: ["文艺", "复古"], must_colors: ["焦糖", "燕麦"], say: "刮到「出片」：要有轮廓，镜头里才立得住" },
  { name: "稳住就好", style_tags: ["通勤", "简约"], must_colors: ["浅蓝", "纯白"], say: "刮到「稳住」：利落得体优先" },
  { name: "别管别人", style_tags: ["明艳"], must_colors: ["正红"], say: "刮到「别管别人」：明艳一次" },
  { name: "动起来", style_tags: ["运动"], must_colors: ["纯黑"], say: "刮到「动起来」：舒服好动最关键" },
];

// ---------- 广场动态流 ----------
const FEED = [
  { id: "f1", who: "小满", board: "抽取式", src: "塔罗 · 星星", text: "抽到星星，穿了一身米白去图书馆，坐一天都不闷。", ids: ["w0001", "w0006", "w0009"], likes: 12 },
  { id: "f2", who: "阿柚", board: "选择式", src: "人设 · 反派", text: "选了反派，一身黑去开会，居然被夸好看。", ids: ["w0002", "w0007", "w0010"], likes: 31 },
  { id: "f3", who: "KK", board: "调节式", src: "电量 28%", text: "电量只剩 28%，穿了最松的那件针织，舒服。", ids: ["w0001", "w0006", "w0012"], likes: 8 },
  { id: "f4", who: "枣枣", board: "输入式", src: "一句话 · 今天好累", text: "打了句「今天好累」，它给我挑了米白 + 直筒裤。", ids: ["w0005", "w0009"], likes: 19 },
  { id: "f5", who: "老陈", board: "抽取式", src: "刮刮乐 · 别管别人", text: "刮到「别管别人」，正红半裙出门，回头率爆表。", ids: ["w0008", "w0010", "w0012"], likes: 44 },
];

/** 每个板块挂在杆上的衣服图形（抽绳袋 / 腰带 / 外套 / 吊牌 / 虚线框）。 */
const SHAPES = {
  bag: '<path d="M14 18h20l2 20a4 4 0 0 1-4 5H16a4 4 0 0 1-4-5z"/><path d="M18 18a6 6 0 0 1 12 0"/><path d="M24 18v25"/>',
  belt: '<path d="M8 20h30a3 3 0 0 1 0 8H8a3 3 0 0 1 0-8z"/><rect x="20" y="18" width="8" height="12" rx="2"/><path d="M26 24h6"/>',
  coat: '<path d="M17 12l7 5 7-5 8 5-3 7-3-2v17H15V22l-3 2-3-7z"/><path d="M24 17v15"/>',
  tag: '<path d="M26 8h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H26L14 38a2 2 0 0 1-3-1V11a2 2 0 0 1 1-1z"/><circle cx="33" cy="15" r="2.5"/>',
  dashed: '<rect x="12" y="12" width="24" height="24" rx="4"/><path d="M24 18v12M18 24h12"/>',
};

  // 对外暴露（原来是 export）
  Object.assign(NS, { BOARDS, EXT_SLOT, EXT_COPY, CITIES, DEFAULT_CITY, KW, IDENTITIES, ENERGY, SCRATCH, FEED, SHAPES });
})(window.Outfit = window.Outfit || {});
