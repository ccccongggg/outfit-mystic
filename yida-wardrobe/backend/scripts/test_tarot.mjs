// 塔罗 22 条回归：每张牌都要能转成约束，并真调引擎选出成套（至少 2 件真实 id）
// node scripts/test_tarot.mjs
import fs from "node:fs";
import path from "node:path";
import { loadWebIntoNode } from "./_web_loader.mjs";

const NS = loadWebIntoNode([
  "safe-storage.js",
  "vocab.js",
  "oracle-data.js",
  "busy.js",
  "engine.js",
  "oracle.js",
]);
const { constraintFromTarot, analyze, recommend } = NS;

const ROOT = process.cwd();
const tarot = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "data", "tarot.json"), "utf-8"));
const items = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "data", "items.json"), "utf-8"));

let ok = 0;
const total = tarot.length + 2;
function pass(name, cond, detail = "") {
  if (cond) ok += 1;
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${detail ? " → " + detail : ""}`);
}

pass("大阿尔卡纳 22 条", tarot.length === 22, String(tarot.length));

const STYLE_OK = new Set(["简约", "通勤", "文艺", "甜美", "运动", "复古", "明艳", "慵懒"]);
const ALIAS = { 极简: "简约", 温柔: "文艺", 街头: "运动" };

for (const card of tarot) {
  const c = constraintFromTarot(card);
  const a = analyze(items, c);
  const ids = recommend(items, c);
  const inWardrobe = ids.length >= 2 && ids.every((id) => items.some((i) => i.id === id));
  const hasStory = Boolean(c.story) && (c.style_tags || []).length > 0;
  const tagsOk = (card.style_tags || []).every((t) => STYLE_OK.has(ALIAS[t] || t));
  const colorsOk = (card.must_colors || []).length > 0;
  const passCard = inWardrobe && hasStory && tagsOk && colorsOk;
  pass(
    `${card.name}（${card.name_en}）`,
    passCard,
    `ids=${ids.join(",") || "-"} score=${a.outfitScore} tags=${(c.style_tags || []).join("/")}`
  );
}

const unique = new Set(tarot.map((c) => c.id));
pass("牌 id 不重复", unique.size === tarot.length, `${unique.size}/${tarot.length}`);

console.log("-".repeat(40));
console.log(`SUMMARY ${ok}/${total} passed`);
process.exit(ok === total ? 0 : 1);
