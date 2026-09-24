// 引擎回归测试（纯 node，不依赖浏览器）：node scripts/test_engine.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommend, analyze } from "../web/engine.js";

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
for (const { name, c } of cases) {
  const ids = recommend(items, c);
  const a = analyze(items, c);
  const inWardrobe = ids.every((id) => items.some((i) => i.id === id));
  const uniqCat = new Set(a.picks.map((p) => p.category)).size === a.picks.length;
  const scoreOk = a.outfitScore >= 0 && a.outfitScore <= 100 && a.perItem.every((p) => p.score >= 0 && p.score <= 100);
  const pass = inWardrobe && uniqCat && scoreOk;
  if (pass) ok++;
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} → ${ids.join(",")} | 整套 ${a.outfitScore} | 缺 ${a.missing.join(",") || "-"}`);
  a.perItem.forEach((p) => console.log(`     ${p.item.color_name}·${p.item.type} ${p.score}% ← ${p.reasons.join("；")}`));
  if (a.harmony.length) console.log("     和谐：" + a.harmony.join("；"));
}
console.log(`\n${ok}/${cases.length} 通过`);
process.exit(ok === cases.length ? 0 : 1);
