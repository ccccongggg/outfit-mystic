// web/vocab.js —— 全站受控词表（8 风格 / 24 色 / 7 品类）
//
// 参考稿的原话：「所有入口必须用同一套词汇，不许各写各的——否则同一个颜色
// 在不同地方写两个名字，筛选会出错。」这条不落地，入口越多错得越多：
// 塔罗说「浅蓝」、衣橱写「雾蓝」，打分直接漏命中。
//
// 设计取舍：
//   · 不改写 items.json（历史数据、打标缓存都指着它），而是在加载时做一次
//     normalizeItems()，给每件单品补 color_std / style_std / category_std。
//   · 引擎只认 std；展示继续用原始的 color_name（更口语）。
//   · 别名只做「收敛」，不做「发明」：温柔→文艺 这类映射是可争议的，
//     所以同时保留原值参与匹配（styleHit 两边都试），避免归一后反而漏分。

// ---------- 8 种风格 ----------
export const STYLES = ["简约", "通勤", "文艺", "甜美", "运动", "复古", "明艳", "慵懒"];

// 现有衣橱里跑出来的风格词 → 受控 8 风格
export const STYLE_ALIAS = {
  极简: "简约",
  温柔: "文艺",
  街头: "运动",
};

// ---------- 24 个色（策划口径）----------
// 前 16 个来自参考稿原文，后 8 个是现有 17 件真实单品需要的补位色名。
// 一个颜色只允许有一个名字：雾蓝、米色这类口语写法一律当别名收敛进来，
// 不能既当正名又当别名，否则约束写「浅蓝」时永远匹配不到单品的「雾蓝」。
export const COLORS = [
  "奶油白", "米白", "纯白", "燕麦", "焦糖", "浅蓝", "牛仔蓝", "雾紫",
  "藕粉", "玫粉", "正红", "酒红", "亮黄", "炭灰", "纯黑", "银灰",
  "橄榄绿", "墨绿", "砖红", "卡其", "驼色", "藏蓝", "深棕", "米色",
];

// 原始写法 → 受控色名。顺序敏感：先长后短，避免「浅金棕」被「棕」抢走。
const COLOR_RULES = [
  ["暖棕格纹", "驼色"],
  ["浅金棕", "焦糖"],
  ["柔白", "纯白"],
  ["奶白", "奶油白"],
  ["白色", "纯白"],
  ["黑色", "纯黑"],
  ["红色", "正红"],
  ["雾蓝", "浅蓝"],
  ["雾灰", "银灰"],
];

// ---------- 7 个品类 ----------
export const CATEGORIES = [
  { k: "top", name: "上装" },
  { k: "bottom", name: "下装" },
  { k: "outer", name: "外套" },
  { k: "dress", name: "连衣裙" },
  { k: "shoes", name: "鞋" },
  { k: "accessory", name: "配饰" },
  { k: "bag", name: "包" },
];

export const CATEGORY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.k, c.name]));

/** 连身单品判定：连衣裙/连体裤自带下装，选中后不再另配 bottom。 */
export function isOnepieceType(type) {
  return /连衣裙|连体|吊带裙|背带裙|套装裙/.test(String(type || ""));
}

/** 单品的真实品类：type 优先（w0005 的 category 还是 top，但 type 是连衣裙）。 */
export function categoryOf(item) {
  if (!item) return "";
  if (isOnepieceType(item.type)) return "dress";
  return item.category || "";
}

/** 色名归一：原始写法 → 受控 24 色之一（不在表里的原样返回）。 */
export function normColor(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  if (COLORS.includes(n)) return n;
  for (const [from, to] of COLOR_RULES) if (n.includes(from)) return to;
  return n;
}

/** 风格词归一。 */
export function normStyle(t) {
  const n = String(t || "").trim();
  return STYLE_ALIAS[n] || n;
}

/**
 * 颜色是否命中约束里给的色键。
 * 两边都归一后再做双向子串匹配：约束写「浅蓝」能命中单品「雾蓝」，
 * 约束写「米」这种宽口径也能命中「米白」。
 */
export function colorHit(itemColorName, keys) {
  const raw = String(itemColorName || "");
  const std = normColor(raw);
  return (keys || []).some((k) => {
    const ks = normColor(k);
    if (!ks) return false;
    if (std && (std.includes(ks) || ks.includes(std))) return true;
    return raw.includes(k) || (k.length > 1 && k.includes(raw));
  });
}

/** 风格命中：返回命中的受控风格词数组（原值与归一值都试）。 */
export function styleHit(itemTags, keys) {
  const tags = (itemTags || []).map((t) => String(t));
  const stdTags = new Set(tags.map(normStyle));
  const out = [];
  for (const k of keys || []) {
    const ks = normStyle(k);
    if (tags.includes(ks) || stdTags.has(ks) || tags.includes(k)) out.push(ks);
  }
  return [...new Set(out)];
}

/** 给一批单品补上 std 字段（不改原对象，返回新数组）。 */
export function normalizeItems(items) {
  return (items || []).map((it) => ({
    ...it,
    color_std: normColor(it.color_name),
    style_std: [...new Set((it.style_tags || []).map(normStyle))],
    category_std: categoryOf(it),
  }));
}
