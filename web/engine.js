// web/engine.js —— 打通版最小推荐引擎
// 规则负责选款 + 风格匹配度；保证「选出的都在衣橱里 + 能成套」
//
// 对外 API（保持向后兼容，新增字段只做扩展）：
//   recommend(items, constraint) -> string[]       逐槽位取最高分单品 id
//   itemsByIds(items, ids)       -> object[]       按 id 取回单品
//   matchScore(item, constraint) -> {score, reasons}   单件与风格的匹配度
//   analyze(items, constraint)   -> {picks, perItem, outfitScore, missing}  整套匹配分析
//
// constraint 可扩展字段（缺省都按「不限制」处理，便于后续接入更多入口）：
//   must_colors / avoid_colors / style_tags / season / occasions
//   must_categories / formality / prefer_materials
//   prefs: { formality:1-5, energy:0-100, brightness:0-100 }   ← 滑动条偏好

export function recommend(items, constraint) {
  const cats = constraint.must_categories || ["top", "bottom", "shoes"];
  const pool = items.filter((it) => it && it.category);

  // 1) 硬筛：季节
  let cand = pool.filter((it) => {
    if (!constraint.season || !constraint.season.length) return true;
    if (!it.season || !it.season.length) return true;
    return it.season.some((s) => constraint.season.includes(s));
  });

  // 2) 硬筛：禁用色（按 color_name 粗匹配）
  cand = cand.filter((it) => {
    if (!constraint.avoid_colors || !constraint.avoid_colors.length) return true;
    const name = it.color_name || "";
    return !constraint.avoid_colors.some((c) => name.includes(c) || (c && c.includes(name)));
  });

  // 3) 软分：必须色 + 风格标签重合
  const scoreOf = (it) => {
    let s = 0;
    for (const c of constraint.must_colors || []) {
      const name = it.color_name || "";
      if (name.includes(c) || (c && c.includes(name))) s += 3;
    }
    for (const t of constraint.style_tags || []) {
      if ((it.style_tags || []).includes(t)) s += 2;
    }
    return s + Math.random() * 0.01;
  };

  // 4) 每槽位取分最高的 1 件；某槽位空则该槽位留空（允许 2 件套）
  const picked = [];
  for (const cat of cats) {
    const slot = cand
      .filter((it) => it.category === cat)
      .sort((a, b) => scoreOf(b) - scoreOf(a));
    if (slot[0]) picked.push(slot[0].id);
  }
  return picked;
}

export function itemsByIds(items, ids) {
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

function colorHit(name, keys) {
  const n = name || "";
  if (!n) return false;
  return (keys || []).some((k) => k && (n.includes(k) || k.includes(n)));
}

/**
 * 单件单品与当前风格倾向的匹配度（0-100）+ 可读理由。
 * 各项加权后可解释：风格 / 颜色 / 季节 / 场合 / 正式度 / 材质 / 滑动偏好。
 */
export function matchScore(item, constraint) {
  const c = constraint || {};
  const prefs = c.prefs || {};
  const reasons = [];
  let score = 20; // 基础分：在衣橱里、可成套

  // 风格标签
  const want = c.style_tags || [];
  const hitStyles = want.filter((t) => (item.style_tags || []).includes(t));
  if (hitStyles.length) {
    score += Math.min(40, hitStyles.length * 18);
    reasons.push("风格命中：" + hitStyles.join("、"));
  }

  // 颜色
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

/** 整套的和谐度加成/扣减（配色关系） */
function harmony(picks) {
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
  return bonus;
}

/**
 * 整套分析：逐件匹配度 + 整套匹配度 + 缺槽位。
 * 返回结构稳定，前端直接渲染；后续换 LLM 理由也不影响调用方。
 */
export function analyze(items, constraint) {
  const ids = recommend(items, constraint);
  const picks = itemsByIds(items, ids);
  const perItem = picks.map((it) => ({ item: it, ...matchScore(it, constraint) }));
  const cats = constraint.must_categories || ["top", "bottom", "shoes"];
  const missing = cats.filter((c) => !picks.some((p) => p.category === c));

  const base = perItem.length
    ? perItem.reduce((a, b) => a + b.score, 0) / perItem.length
    : 0;
  const notes = harmony(picks);
  const bonus = notes.reduce((a, b) => a + b.v, 0);
  const outfitScore = Math.max(0, Math.min(100, Math.round(base + bonus - missing.length * 12)));

  return { picks, perItem, outfitScore, missing, harmony: notes.map((n) => n.why) };
}
