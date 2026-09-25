/* ------------------------------------------------------------------
   经典脚本（原为 ES module，语义等价）
   改因：file:// 下浏览器禁止加载 <script type="module">，双击 index.html
        会整页无法交互。改成经典脚本 + window.Outfit 命名空间后，
        双击打开 / 起本地服务两种方式都能完整跑。
   依赖：由 index.html 按顺序 defer 加载，公共名挂在 window.Outfit 上。
------------------------------------------------------------------ */
(function (NS) {
"use strict";
  const { colorHit, styleHit, categoryOf, STYLES, normStyle } = NS;   // 原来是 import { ... } from "./vocab.js"
  NS.require("engine.js", { colorHit, styleHit, categoryOf, STYLES, normStyle });

// web/engine.js —— 打通版最小推荐引擎
// 规则负责选款 + 风格匹配度；保证「选出的都在衣橱里 + 能成套」
//
// 对外 API（保持向后兼容，新增字段只做扩展）：
//   recommend(items, constraint) -> string[]       逐槽位取最高分单品 id
//   itemsByIds(items, ids)       -> object[]       按 id 取回单品
//   matchScore(item, constraint) -> {score, reasons}   单件与风格的匹配度
//   slotStates(picks, constraint) -> object[]          结果页四格的状态（on/skip/off/empty）
//   analyze(items, constraint)   -> {picks, perItem, outfitScore, missing, slots}  整套匹配分析
//
// constraint 可扩展字段（缺省都按「不限制」处理，便于后续接入更多入口）：
//   must_colors / avoid_colors / style_tags / season / occasions
//   must_categories / formality / prefer_materials
//   exclude_ids: string[]        ← 「换一套」用：这些 id 本次不许再被选中
//   prefs: { formality:1-5, energy:0-100, brightness:0-100 }   ← 滑动条偏好
//
// 参考稿第 6 节的口径：入口只负责把模糊念头翻译成约束，出搭配只有这一套引擎。
// 颜色 / 风格的匹配一律走 vocab.js 的受控词表，不许各写各的。


/** 默认四件套：上装 + 下装 + 鞋 + 外套。连衣裙占用「上装」槽位。 */
const DEFAULT_SLOTS = ["top", "bottom", "shoes", "outer"];

/**
 * 结果页那四格的固定定义 —— 顺序就是 UI 顺序。
 * accepts 表示这一格能放哪些品类：连衣裙和上衣抢同一个上身格。
 */
const SLOT_DEF = [
  { k: "top", label: "上衣", accepts: ["top", "dress"] },
  { k: "bottom", label: "下装", accepts: ["bottom"] },
  { k: "shoes", label: "鞋", accepts: ["shoes"] },
  { k: "outer", label: "外套", accepts: ["outer"] },
];

/** 槽位 → 允许的单品品类。连衣裙和上衣抢同一个上身槽。 */
const SLOT_MAP = {
  top: ["top", "dress"],
  dress: ["dress"],
  bottom: ["bottom"],
  shoes: ["shoes"],
  outer: ["outer"],
  accessory: ["accessory"],
  bag: ["bag"],
};

/** 连身单品判定：连衣裙/连体裤自带下装，选中后不再另配 bottom。 */
function isOnepiece(item) {
  return categoryOf(item) === "dress";
}

/**
 * 从 c.style_tags 求反 → 得到「不在目标里的风格集」。
 * 比如用户要 甜美/文艺,avoid = {简约, 通勤, 运动, 复古, 明艳, 慵懒}。
 * 衣橱里 item.style_tags 命中 avoid 的,会在 matchScore 扣分(见下)。
 */
function avoidStyles(c) {
  const want = new Set((c.style_tags || []).map(normStyle));
  return STYLES.filter((s) => !want.has(s));
}

/** 衣橱里命中 must_colors 的:返回缺失色数组(must_colors 减掉衣橱里能匹配上的)。 */
function missingColors(items, c) {
  const wants = c.must_colors || [];
  if (!wants.length) return [];
  return wants.filter((col) => !items.some((it) => colorHit(it.color_name, [col])));
}

/**
 * 四格的最终状态 —— 结果页只认这个，别再自己写死「四格都画、空的就写待选」。
 *
 *   on      这一格有真单品（连衣裙落在上衣格）
 *   skip    连身单品自带下装，本来就不用配
 *   off     今天不需要这一格（天气判定不用外套）—— 不是缺件，是刻意不要
 *   empty   需要、但衣橱里挑不出来 —— 只有这种才该提示补货 / 给示例
 *
 * 之前 UI 自己硬编码四格，于是「连衣裙被选中但没格可放」和「今天不用外套」
 * 都表现成一句「待选」，看起来像坏了。
 */
function slotStates(picks, constraint) {
  const c = constraint || {};
  const cats = c.must_categories || DEFAULT_SLOTS;
  const list = picks || [];
  const onepiece = list.some(isOnepiece);
  return SLOT_DEF.map((d) => {
    const item = list.find((p) => d.accepts.includes(categoryOf(p))) || null;
    if (item) {
      return {
        k: d.k,
        label: d.label,
        state: "on",
        item,
        // 上衣格被连衣裙占住时单独标出来，UI 才能把标题改成「连衣裙」
        why: isOnepiece(item) ? { code: "onepiece" } : null,
      };
    }
    if (onepiece && d.k === "bottom") {
      return { k: d.k, label: d.label, state: "skip", item: null, why: { code: "onepiece" } };
    }
    if (!cats.includes(d.k)) {
      return {
        k: d.k,
        label: d.label,
        state: "off",
        item: null,
        why: { code: "not_required", weather: c.weather || null, thickness: c.thickness || null },
      };
    }
    return { k: d.k, label: d.label, state: "empty", item: null, why: { code: "no_candidate" } };
  });
}

function recommend(items, constraint) {
  const c = constraint || {};
  const cats = c.must_categories || DEFAULT_SLOTS;
  const pool = items.filter((it) => it && it.category);

  // 0) 换一套：排除名单
  const banned = new Set(c.exclude_ids || []);

  // 1) 硬筛：季节
  let cand = pool.filter((it) => {
    if (banned.has(it.id)) return false;
    if (!c.season || !c.season.length) return true;
    if (!it.season || !it.season.length) return true;
    return it.season.some((s) => c.season.includes(s));
  });

  // 2) 硬筛：禁用色（走受控词表，约束写「浅蓝」要能命中单品「雾蓝」）
  cand = cand.filter((it) => {
    if (!c.avoid_colors || !c.avoid_colors.length) return true;
    return !colorHit(it.color_name, c.avoid_colors);
  });

  // 3) 软分：必须色 + 风格标签重合
  const scoreOf = (it) => {
    let s = 0;
    for (const col of c.must_colors || []) {
      if (colorHit(it.color_name, [col])) s += 3;
    }
    s += styleHit(it.style_tags, c.style_tags || []).length * 2;
    return s + Math.random() * 0.01;
  };

  // 4) 每槽位取分最高的 1 件；某槽位空则该槽位留空（允许 2 件套）
  //    连衣裙是连身单品：上身选中它之后就不再取下装，避免「连衣裙 + 半裙」这种无效搭配
  const picked = [];
  let onepiece = false;
  for (const cat of cats) {
    if (onepiece && cat === "bottom") continue;
    const allow = SLOT_MAP[cat] || [cat];
    const slot = cand
      .filter((it) => allow.includes(categoryOf(it)))
      .sort((a, b) => scoreOf(b) - scoreOf(a));
    if (slot[0]) {
      picked.push(slot[0].id);
      if (isOnepiece(slot[0])) onepiece = true;
    }
  }
  return picked;
}

function itemsByIds(items, ids) {
  const map = new Map(items.map((it) => [it.id, it]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

// ---------- 风格匹配度（schema v2：含 material / occasions / prefs） ----------

const ENERGY_HIGH = ["运动", "街头"];
const ENERGY_LOW = ["极简", "温柔", "通勤"];

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 单件单品与当前风格倾向的匹配度（0-100）+ 可读理由。
 * 各项加权后可解释：风格 / 颜色 / 季节 / 场合 / 正式度 / 材质 / 滑动偏好。
 */
function matchScore(item, constraint) {
  const c = constraint || {};
  const prefs = c.prefs || {};
  const reasons = [];
  let score = 20; // 基础分：在衣橱里、可成套

  // 风格标签(受控 8 风格,别名也认)
  const hitStyles = styleHit(item.style_tags, c.style_tags || []);
  if (hitStyles.length) {
    score += Math.min(40, hitStyles.length * 18);
    reasons.push("风格命中：" + hitStyles.join("、"));
  }

  // 风格冲突:item.style_tags 命中 avoid_styles(目标风格的反集)→ 扣分。
  // 这是 v2026-09-26 加的,修「黑皮衣强塞甜美」那种 bug —— 之前只加命中分,冲突照样入选。
  const avoid = avoidStyles(c);
  const conflicts = (item.style_tags || []).map(normStyle).filter((s) => avoid.includes(s));
  if (conflicts.length) {
    score -= Math.min(30, conflicts.length * 15);
    reasons.push("风格冲突：" + conflicts.join("、") + " 不在目标里");
  }

  // 颜色（受控 24 色，别名也认）
  if ((c.must_colors || []).length && colorHit(item.color_name, c.must_colors)) {
    score += 22;
    reasons.push(`颜色贴合想要的「${c.must_colors.join("/")}」`);
  }
  if ((c.avoid_colors || []).length && colorHit(item.color_name, c.avoid_colors)) {
    score -= 40;
    reasons.push("踩到忌讳色，已大幅降权");
  }

  // 季节
  if ((c.season || []).length && (item.season || []).some((s) => c.season.includes(s))) {
    score += 12;
    reasons.push("适合当季：" + c.season.join("、"));
  }

  // 场合（schema v2）
  const wantOcc = [c.occasion, ...(c.occasions || [])].filter(Boolean);
  if (wantOcc.length && (item.occasions || []).some((o) => wantOcc.includes(o))) {
    score += 12;
    reasons.push("适合场合：" + wantOcc.join("、"));
  }

  // 正式度
  const target = prefs.formality || c.formality;
  if (typeof target === "number" && typeof item.formality === "number") {
    const diff = Math.abs(target - item.formality);
    const s = Math.max(0, 8 - diff * 4);
    score += s;
    if (s > 0) reasons.push(`正式度 ${item.formality} 接近目标 ${target}`);
  }

  // 材质偏好
  if ((c.prefer_materials || []).length && c.prefer_materials.includes(item.material)) {
    score += 10;
    reasons.push("材质符合偏好：" + item.material);
  }

  // 滑动偏好：活力值 → 偏运动街头 / 极简温柔
  if (typeof prefs.energy === "number") {
    const high = prefs.energy >= 60;
    const pool = high ? ENERGY_HIGH : ENERGY_LOW;
    if ((item.style_tags || []).some((t) => pool.includes(t))) {
      score += 8;
      reasons.push(high ? "活力值高 → 更偏有劲的单品" : "活力值低 → 更偏安静的单品");
    }
  }

  // 滑动偏好：明度 → 与单品主色亮度接近
  if (typeof prefs.brightness === "number") {
    const lum = luminance(item.color_hex);
    if (lum !== null) {
      const diff = Math.abs(lum - prefs.brightness / 100);
      const s = Math.max(0, 10 - diff * 14);
      score += s;
      if (s > 4) reasons.push("明暗程度符合你的偏好");
    }
  }

  if (!reasons.length) reasons.push("没有明显加分项，作为稳妥底搭入选");

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/** 整套的和谐度加成/扣减（配色关系 + 风格一致性） */
function harmony(picks, c) {
  const bonus = [];
  const top = picks.find((p) => p.category === "top");
  const bottom = picks.find((p) => p.category === "bottom");
  const shoes = picks.find((p) => p.category === "shoes");
  if (top && bottom) {
    const lt = luminance(top.color_hex);
    const lb = luminance(bottom.color_hex);
    if (lt !== null && lb !== null) {
      const diff = Math.abs(lt - lb);
      if (diff > 0.35) {
        bonus.push({ v: 5, why: "上下明暗拉开，层次清楚" });
      } else if (diff < 0.12) {
        bonus.push({ v: 4, why: "上下同色域，整体干净统一" });
      }
    }
  }
  if (shoes && top) {
    const ls = luminance(shoes.color_hex);
    const lt = luminance(top.color_hex);
    if (ls !== null && lt !== null && ls < 0.35 && lt > 0.6) {
      bonus.push({ v: 4, why: "深色鞋收住上身的亮，重心稳" });
    }
  }
  // 套装风格一致性:v2026-09-26 加的。如果目标风格已指定,过半单品都对不上就扣分。
  // 比如 4 件里只有 1 件命中"甜美/文艺",就扣 —— 别让「1 件对 3 件跑偏」的搭配装成没事。
  const target = (c && c.style_tags || []).map(normStyle);
  if (target.length && picks.length >= 2) {
    const onTag = picks.filter((p) =>
      (p.style_tags || []).some((s) => target.includes(normStyle(s)))
    ).length;
    const ratio = onTag / picks.length;
    if (ratio < 0.5) {
      bonus.push({ v: -12, why: `仅 ${onTag}/${picks.length} 件命中目标风格，整体偏散` });
    }
  }
  return bonus;
}

/**
 * 整套分析：逐件匹配度 + 整套匹配度 + 缺槽位。
 * 返回结构稳定，前端直接渲染；后续换 LLM 理由也不影响调用方。
 */
function analyze(items, constraint) {
  const ids = recommend(items, constraint);
  const picks = itemsByIds(items, ids);
  const perItem = picks.map((it) => ({ item: it, ...matchScore(it, constraint) }));
  // 四格状态是唯一口径：连衣裙自带下装算 skip，天气判定的 off 不算缺件
  const slots = slotStates(picks, constraint);
  const missing = slots.filter((s) => s.state === "empty").map((s) => s.k);

  const base = perItem.length
    ? perItem.reduce((a, b) => a + b.score, 0) / perItem.length
    : 0;
  const notes = harmony(picks, constraint);
  const bonus = notes.reduce((a, b) => a + b.v, 0);
  const outfitScore = Math.max(0, Math.min(100, Math.round(base + bonus - missing.length * 12)));

  // v2026-09-26 加:把「衣橱里没的 must_colors」也告诉前端,用户就能看到「想要藕粉但衣橱没有」。
  // 注意:只在衣橱里**完全找不到**匹配色时算缺失;存在但被 engine 因为分数低没被选中的不算。
  const missing_colors = missingColors(items, constraint);

  return { picks, perItem, outfitScore, missing, missing_colors, harmony: notes.map((n) => n.why), slots };
}

  // 对外暴露（原来是 export）
  Object.assign(NS, { DEFAULT_SLOTS, SLOT_DEF, isOnepiece, slotStates, recommend, itemsByIds, matchScore, analyze });
})(window.Outfit = window.Outfit || {});
