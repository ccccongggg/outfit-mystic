// web/engine.js —— 打通版最小推荐引擎
// 规则负责选款；保证「选出的都在衣橱里 + 能成套」

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
