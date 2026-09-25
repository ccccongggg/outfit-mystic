// 手机模式布局静态校验：确认 shell.css 里每条 .phone-mode 规则的选择器
// 都能命中 index.html 里的真实元素（或 JS 动态生成的已知类），避免打错类名静默失效。
// 用法: node scripts/test_layout.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 先剥掉注释 —— 注释里也会出现 ".phone-mode"，不剥会被当成选择器
const css = fs.readFileSync(path.join(ROOT, "web", "shell.css"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
const html = fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf-8");
const appJs = fs.readFileSync(path.join(ROOT, "web", "app.js"), "utf-8");
const shellJs = fs.readFileSync(path.join(ROOT, "web", "shell.js"), "utf-8");

let ok = 0;
let total = 0;
const fails = [];
function check(name, cond, detail = "") {
  total += 1;
  if (cond) {
    ok += 1;
    console.log(`[PASS] ${name}${detail ? " → " + detail : ""}`);
  } else {
    fails.push(name);
    console.log(`[FAIL] ${name}${detail ? " → " + detail : ""}`);
  }
}

// 1) 收集 shell.css 里出现在 .phone-mode 语境下的类名
const phoneSelectors = [];
for (const m of css.matchAll(/(^|\})\s*([^{}@]*?\.phone-mode[^{}]*?)\{/g)) {
  phoneSelectors.push(m[2].trim().replace(/\s+/g, " "));
}
const classNames = new Set();
for (const sel of phoneSelectors) {
  for (const m of sel.matchAll(/\.([a-z][a-z0-9-]*)/gi)) {
    if (m[1] !== "phone-mode") classNames.add(m[1]);
  }
}

// 2) 页面里真实存在的类：HTML 里写死的 + app.js 里拼字符串生成的
const htmlClasses = new Set();
for (const m of html.matchAll(/class="([^"]+)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) htmlClasses.add(c);
}
const jsClasses = new Set();
for (const src of [appJs, shellJs]) {
  for (const m of src.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) if (c && !c.includes("$")) jsClasses.add(c);
  }
  for (const m of src.matchAll(/className = "([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) jsClasses.add(c);
  }
  for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\("([^"]+)"/g)) jsClasses.add(m[1]);
  for (const m of src.matchAll(/el\("[a-z]+",\s*"([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) jsClasses.add(c);
  }
}
// 已知由 shell.js 生成的壳内类，与业务无关
const shellOwned = new Set(["phone-toggle", "float", "phone-mode", "phone-stage", "phone-tab", "phone-tab-ind"]);

const missing = [...classNames].filter(
  (c) => !htmlClasses.has(c) && !jsClasses.has(c) && !shellOwned.has(c)
);

console.log(`扫描到 .phone-mode 规则 ${phoneSelectors.length} 条，涉及类名 ${classNames.size} 个`);
check("所有 .phone-mode 选择器的类名都能命中真实元素", missing.length === 0, missing.length ? "未命中: " + missing.join(", ") : "");

// 3) 业务桌面布局必须在手机模式下被覆盖（否则又会挤爆）
const expected = [
  [".phone-mode .item-grid", "1fr 1fr"],
  [".phone-mode .entry-grid", "1fr"],
  [".phone-mode .result-layout", "1fr"],
  [".phone-mode .preview-body", "1fr"],
  [".phone-mode .manual-grid", "1fr 1fr"],
];
for (const [sel, want] of expected) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  const body = m ? m[1].replace(/\s+/g, " ") : "";
  check(`覆盖 ${sel}`, !!m && body.includes("grid-template-columns: " + want), body.includes("grid-template-columns") ? body.match(/grid-template-columns:[^;]*/)[0] : "无该声明");
}

// 4) 横向溢出保险
check("屏内禁横向滚动", /\.phone-mode \.view \{[^}]*overflow-x: hidden/.test(css.replace(/\s+/g, " ")));
const minW = (css.match(/min-width: 0/g) || []).length;
check("栅格子项可收缩 min-width:0", minW >= 2, `${minW} 处`);

// 5) CSS 基础健全性：括号配平
const ob = (css.match(/\{/g) || []).length;
const cb = (css.match(/\}/g) || []).length;
check("CSS 花括号配平", ob === cb, `${ob} 开 / ${cb} 闭`);

// 6) 关键断点前提：确认 style.css 的移动断点确实覆盖不到手机模式
const styleCss = fs.readFileSync(path.join(ROOT, "web", "style.css"), "utf-8");
check(
  "style.css 的移动断点仍是视口宽度驱动（解释了原问题）",
  /@media \(max-width: 560px\)/.test(styleCss) && !/\.phone-mode/.test(styleCss),
  "外壳缩放时该断点不会命中，故必须按类重排"
);

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
