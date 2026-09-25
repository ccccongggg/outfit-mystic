// 引擎回归测试（纯 node，不依赖浏览器）：node scripts/test_engine.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommend, analyze, slotStates } from "../web/engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const items = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "data", "items.json"), "utf-8"));

const cases = [
  { name: "塔罗·星星", c: { source: "tarot", must_colors: ["奶油白", "浅紫", "白", "米"], avoid_colors: ["黑"], style_tags: ["温柔", "简约"], season: ["春", "秋"], must_categories: ["top", "bottom", "shoes"] } },
  { name: "场合·通勤", c: { occasion: "通勤", occasions: ["通勤"], style_tags: ["通勤", "简约"], formality: 3, must_categories: ["top", "bottom", "shoes"] } },
  { name: "滑动·活力高亮色", c: { style_tags: ["运动"], prefs: { formality: 1, energy: 80, brightness: 80 }, must_categories: ["top", "bottom", "shoes"] } },
  { name: "滑动·安静深色", c: { style_tags: ["极简"], prefs: { formality: 4, energy: 20, brightness: 25 }, must_categories: ["top", "bottom", "shoes"] } },
  { name: "外搭优先（含 outer）", c: { style_tags: ["通勤", "复古"], season: ["秋", "冬"], must_categories: ["outer", "top", "bottom", "shoes"] } },
];

let ok = 0;
// 5 个用例 + 四格状态 9 条断言
const total = cases.length + 9;
function pass(name, cond, detail = "") {
  if (cond) ok += 1;
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`);
}

for (const { name, c } of cases) {
  const ids = recommend(items, c);
  const a = analyze(items, c);
  const inWardrobe = ids.every((id) => items.some((i) => i.id === id));
  const uniqCat = new Set(a.picks.map((p) => p.category)).size === a.picks.length;
  const scoreOk = a.outfitScore >= 0 && a.outfitScore <= 100 && a.perItem.every((p) => p.score >= 0 && p.score <= 100);
  // 四格必须齐：每一格都要有明确状态，不能靠 UI 自己猜
  const slotsOk = (a.slots || []).length === 4 &&
    a.slots.every((s) => ["on", "skip", "off", "empty"].includes(s.state));
  const passCase = inWardrobe && uniqCat && scoreOk && slotsOk;
  if (passCase) ok++;
  console.log(`[${passCase ? "PASS" : "FAIL"}] ${name} → ${ids.join(",")} | 整套 ${a.outfitScore} | 缺 ${a.missing.join(",") || "-"} | ${(a.slots || []).map((s) => s.k + ":" + s.state).join(" ")}`);
  a.perItem.forEach((p) => console.log(`     ${p.item.color_name}·${p.item.type} ${p.score}% ← ${p.reasons.join("；")}`));
  if (a.harmony.length) console.log("     和谐：" + a.harmony.join("；"));
}

// ---- 结果页四格状态（截图那个问题的根因）----
// 塔罗·星星：季节 春/秋，避雷纯黑，风格 温柔+简约
const star = {
  source: "tarot", style_tags: ["温柔", "简约"], must_colors: ["奶油白", "浅紫", "白", "米"],
  avoid_colors: ["黑"], season: ["春", "秋"],
};

// ① 天气说今天要外套（西安/北京）：连衣裙占上衣格 → 下装 skip → 外套 on
{
  const c = { ...star, must_categories: ["top", "bottom", "shoes", "outer"], weather: "阴", thickness: "薄外套" };
  const a = analyze(items, c);
  const s = Object.fromEntries(a.slots.map((x) => [x.k, x]));
  pass("连衣裙落在上衣格（不再是空的）", s.top.state === "on" && /连衣裙/.test(s.top.item.type), s.top.item ? s.top.item.id : "空");
  pass("连衣裙占住上衣格时标出 onepiece", s.top.why && s.top.why.code === "onepiece");
  pass("下装是 skip 不是缺件", s.bottom.state === "skip" && !a.missing.includes("bottom"), s.bottom.state);
  pass("要外套的天气里外套 on", s.outer.state === "on", s.outer.item ? s.outer.item.id : "空");
}

// ② 天气说今天不用外套（上海/广州）：外套是 off，不能算缺件
{
  const c = { ...star, must_categories: ["top", "bottom", "shoes"], weather: "多云", thickness: "单层就够" };
  const a = analyze(items, c);
  const s = Object.fromEntries(a.slots.map((x) => [x.k, x]));
  pass("不用外套的天气里外套是 off", s.outer.state === "off", s.outer.state);
  pass("off 带天气原因给 UI 用", s.outer.why && s.outer.why.thickness === "单层就够", JSON.stringify(s.outer.why));
  pass("off 不计入缺件、不扣分", !a.missing.includes("outer"), "missing=" + (a.missing.join(",") || "-"));
}

// ③ 衣橱里真挑不出：outer 全被避雷色干掉 → empty
{
  const c = {
    style_tags: ["通勤"], season: ["春", "秋"], avoid_colors: ["卡其", "黑"],
    must_categories: ["top", "bottom", "shoes", "outer"],
  };
  const a = analyze(items, c);
  const s = Object.fromEntries(a.slots.map((x) => [x.k, x]));
  pass("挑不出时是 empty 而不是 off", s.outer.state === "empty", s.outer.state);
  pass("empty 才计入缺件（UI 给示例卡）", a.missing.includes("outer"), "missing=" + a.missing.join(","));
}

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
