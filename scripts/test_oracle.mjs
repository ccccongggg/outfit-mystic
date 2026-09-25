// 「拿主意」这一层的冒烟测试：node scripts/test_oracle.mjs
//
// 参考稿最关键的一句话是「入口只负责翻译，引擎只有一套」。
// 这个测试就盯着两件事：
//   1. 五个入口各自能产出约束（收集意图 → 生成约束）
//   2. 五个约束长得一模一样，能喂给同一个引擎
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSDOM_ENTRY = "file:///C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js";
const { JSDOM } = (await import(JSDOM_ENTRY)).default;

let ok = 0;
let total = 0;
function check(name, cond, detail = "") {
  total += 1;
  if (cond) {
    ok += 1;
    console.log(`[PASS] ${name}${detail ? " → " + detail : ""}`);
  } else {
    console.log(`[FAIL] ${name}${detail ? " → " + detail : ""}`);
  }
}

const html = fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf-8");
const dom = new JSDOM(html, { url: "http://127.0.0.1:8791/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["window", "document", "location", "localStorage", "URL", "HTMLElement", "Node", "Event", "CustomEvent", "MutationObserver", "FormData", "URLSearchParams"]) {
  if (window[k] === undefined) continue;
  try { globalThis[k] = window[k]; } catch { /* 只读 getter，跳过 */ }
}
globalThis.alert = () => {};
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = () => {};

const items = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "data", "items.json"), "utf-8"));
const tarot = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "data", "tarot.json"), "utf-8"));
globalThis.fetch = async (url) => {
  const u = String(url);
  let body = {};
  if (u.includes("/api/items")) body = { items };
  else if (u.includes("/api/samples")) body = { samples: [] };
  else if (u.includes("tarot")) body = tarot;
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
};

try {
  await import(new URL("../web/app.js", import.meta.url).href);
} catch (e) {
  console.log("IMPORT ERR:", (e && e.stack) || e);
}
// init() 是异步的（拉衣橱 / 塔罗 / 示例图），等它跑完再断言
await new Promise((r) => setTimeout(r, 100));
const orc = window.__oracle;
const doc = window.document;

check("oracle 已挂载", !!orc);
if (!orc) { console.log(`\n0/${total} 通过`); process.exit(1); }

// ---------- 1) 三级架构：首屏挂衣杆 ----------
const rail = [...doc.querySelectorAll("#rail .rail-item")];
check("挂衣杆有 5 个槽位（4 板块 + 扩展位）", rail.length === 5, rail.map((r) => r.dataset.board).join("/"));
check("默认停在首屏", doc.documentElement.dataset.view === "home");
check("天气芯片默认西安", (doc.querySelector(".wc-city")?.textContent || "") === "西安");

// ---------- 2) 板块页 ----------
rail[0].click(); // 抽取式
const cards = [...doc.querySelectorAll("#board .oc-entry")];
check("进板块页", doc.documentElement.dataset.view === "board");
check("抽取式有 3 张入口卡（2 亮 + 1 灰）", cards.length === 3, cards.map((c) => c.dataset.entry || "灰卡").join("/"));
check(
  "灰卡点开说明「加一个入口只要三样东西」",
  (() => {
    doc.querySelector("#board .oc-entry.off").click();
    const t = doc.querySelector("#stub-sheet .ss-list")?.textContent || "";
    return doc.querySelector("#stub-sheet").classList.contains("open") && t.includes("受控词表");
  })()
);
doc.querySelector("#stub-sheet .ss-list") && doc.querySelector('#stub-sheet [data-act="close"]').click();

// ---------- 3) 五个入口都能产出约束 ----------
const keys = ["source", "src", "must_colors", "avoid_colors", "style_tags", "must_categories", "season", "prefs", "story"];
const picked = {};

// ① 抽取式 · 塔罗
doc.querySelector('#board .oc-entry[data-entry="tarot"]').click();
check("进塔罗页", doc.documentElement.dataset.view === "tarot");
doc.querySelector("#btn-tarot").click();
await new Promise((r) => setTimeout(r, 30)); // 抽牌是 resetTarot + rAF(drawTarot)，要等一帧
picked.tarot = window.__outfitApp.state.constraint;
check("塔罗产出约束", !!picked.tarot && picked.tarot.src.label.startsWith("塔罗 · "), picked.tarot?.src?.label);

// ② 调节式 · 能量条
rail[1].click();
doc.querySelector('#board .oc-entry[data-entry="energy"]').click();
check("进能量条", doc.documentElement.dataset.view === "energy");
const range = doc.querySelector("#e-range");
range.value = "95";
range.dispatchEvent(new window.Event("input"));
check("电量 95% 落在「满电」档", (doc.querySelector("#e-card b")?.textContent || "") === "满电", doc.querySelector("#e-card b")?.textContent);
doc.querySelector("#e-ok").click();
await new Promise((r) => setTimeout(r, 30));
picked.energy = window.__outfitApp.state.constraint;
check("能量条产出约束且偏明艳", picked.energy?.style_tags.includes("明艳"), picked.energy?.story);

// ③ 选择式 · 人设
rail[2].click();
doc.querySelector('#board .oc-entry[data-entry="identity"]').click();
doc.querySelector('#identity .id-card[data-id="villain"]').click();
doc.querySelector("#i-ok").click();
await new Promise((r) => setTimeout(r, 30));
picked.identity = window.__outfitApp.state.constraint;
check("人设产出约束且避雷藕粉", picked.identity?.avoid_colors.includes("藕粉"), picked.identity?.story);

// ④ 输入式 · 一句话
rail[3].click();
doc.querySelector('#board .oc-entry[data-entry="input"]').click();
const inp = doc.querySelector("#kw-input");
inp.value = "今天好累，不想动";
inp.dispatchEvent(new window.Event("input"));
const tag = doc.querySelector("#kw-out .kw-tag")?.textContent || "";
check("一句话命中「电量 · 低」", tag.includes("电量"), tag);
doc.querySelector("#kw-ok").click();
await new Promise((r) => setTimeout(r, 30));
picked.input = window.__outfitApp.state.constraint;

// ⑤ 抽取式 · 刮刮乐（无 canvas 环境走降级）
orc.go("scratch");
doc.querySelector("#s-ok").click();
await new Promise((r) => setTimeout(r, 30));
picked.scratch = window.__outfitApp.state.constraint;
check("刮刮乐产出约束", !!picked.scratch && picked.scratch.src.label.startsWith("刮刮乐 · "), picked.scratch?.src?.label);

// ---------- 4) 五个约束长得一模一样 → 能喂同一个引擎 ----------
const kinds = Object.keys(picked);
check("五个入口都产出了约束", kinds.length === 5 && kinds.every((k) => !!picked[k]), kinds.join("/"));
const allSame = kinds.every((k) => keys.every((key) => picked[k][key] !== undefined));
check("五份约束字段结构一致（引擎零改动的前提）", allSame);
const slotOk = kinds.every((k) => Array.isArray(picked[k].must_categories) && picked[k].must_categories.length >= 3);
check("都带品类占位", slotOk, picked.tarot.must_categories.join("/"));
const srcOk = kinds.every((k) => picked[k].src && picked[k].src.board && picked[k].src.label && picked[k].src.color);
check("都带来源徽章（结果页要显示来自哪个入口）", srcOk);

// ---------- 5) 天气只改厚薄，不改风格与颜色 ----------
orc.go("home");
const card = tarot[0];
const c1 = orc.constraintFromTarot(card);
const before = JSON.stringify({ s: c1.style_tags, c: c1.must_colors });
doc.querySelector("#weather-chip").click();
doc.querySelector('#city-sheet .cs-row[data-city="广州"]').click();
orc.go("home");
const c2 = orc.constraintFromTarot(card);
check("换城市后厚薄跟着变", c2.thickness === "越薄越好", c2.thickness);
check(
  "换城市不动风格 / 不动颜色",
  JSON.stringify({ s: c2.style_tags, c: c2.must_colors }) === before,
  JSON.stringify(c2.must_colors)
);
check("广州不需要外套 → 占位里没有 outer", !c2.must_categories.includes("outer"), c2.must_categories.join("/"));

// ---------- 6) 受控词表归一 ----------
const { normColor, normStyle } = await import(new URL("../web/vocab.js", import.meta.url).href);
check("雾蓝 → 浅蓝", normColor("雾蓝") === "浅蓝", normColor("雾蓝"));
check("柔白 → 纯白", normColor("柔白") === "纯白", normColor("柔白"));
check("浅金棕 → 焦糖", normColor("浅金棕") === "焦糖", normColor("浅金棕"));
check("温柔 → 文艺", normStyle("温柔") === "文艺", normStyle("温柔"));
const its = window.__outfitApp.state.items;
check("衣橱已补 color_std / category_std", its.every((i) => "color_std" in i && "category_std" in i));
check("连衣裙归到 dress 品类", its.find((i) => i.id === "w0005")?.category_std === "dress");

// ---------- 7) 导航两版 ----------
orc.applyNav("drawer");
check("A 版纯抽屉：没有底部 Tab", orc.navItems().length === 0 && !doc.documentElement.classList.contains("nav-hybrid"));
orc.applyNav("hybrid");
check(
  "B 版抽屉 + 底栏：三个 Tab",
  orc.navItems().length === 3 && doc.documentElement.classList.contains("nav-hybrid") && doc.querySelectorAll("#otabbar .otab").length === 3,
  orc.navItems().map((n) => n.label).join("/")
);
orc.applyNav("drawer");

// ---------- 8) 抽屉的视觉分级 ----------
check("抽屉里 hero 是「拿主意」", (doc.querySelector(".drawer-hero .dh-t")?.textContent || "") === "拿主意");
check(
  "另两项被压成配套灰字",
  [...doc.querySelectorAll(".drawer-sub")].map((b) => b.dataset.go).join("/") === "wardrobe/plaza"
);
check(
  "抽屉底部那句定位",
  (doc.querySelector(".drawer-quote")?.textContent || "").includes("我们不做推荐")
);

// ---------- 9) 结果页四件套 ----------
check("结果页有上装/下装/鞋/外套四个槽", doc.querySelectorAll("#collage .slot").length === 4);
check("结果页有来源徽章位", !!doc.querySelector("#result-source"));
check("结果页有换一套 / 换个板块", !!doc.querySelector("#btn-reroll") && !!doc.querySelector("#btn-back-entry"));

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
