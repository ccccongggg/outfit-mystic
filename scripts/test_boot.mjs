// scripts/test_boot.mjs —— 整页启动 + 交互冒烟：node scripts/test_boot.mjs
//
// 为什么单独有这个测试：
//   web/*.js 曾经是 ES module，而 Chrome/Edge 在 file:// 下禁止加载 type="module"
//   （CORS，origin 为 null）。双击 index.html 时页面能看（HTML/CSS 照常渲染），
//   但 app.js 一行都不执行 —— 表现就是「点了没反应」，且控制台之外毫无提示。
//   这个测试同时守住两件事：
//     ① 静态：index.html 不许再出现 type="module"，脚本顺序必须对；
//     ② 动态：把所有脚本灌进一个真窗口，然后**真的点几下**，看状态有没有变。
//
// 和 test_intake / test_oracle 的区别：那两个把 jsdom 的全局镜像到 Node 再跑代码，
// 这里直接在 jsdom window 自己的域里执行 —— 最贴近浏览器，也最能证明「交互通了」。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const JSDOM_HOME =
  process.env.JSDOM_HOME || "C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules";
let JSDOM;
try {
  ({ default: { JSDOM } } = await import(pathToFileURLSafe(path.join(JSDOM_HOME, "jsdom", "lib", "api.js"))));
} catch {
  ({ default: { JSDOM } } = await import("jsdom"));
}
function pathToFileURLSafe(p) {
  return new URL("file:///" + p.replace(/\\/g, "/").replace(/^\/+/, ""));
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..", "web");

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

// ---------- ① 静态：脚本装载方式 ----------
const html = fs.readFileSync(path.join(WEB, "index.html"), "utf-8");
// 注释里会提到 type="module" 解释原因，判断前先摘掉注释
const htmlNoComment = html.replace(/<!--[\s\S]*?-->/g, "");

check(
  "① index.html 不含 type=\"module\"（file:// 下会被浏览器拦掉 → 整页不可交互）",
  !/type\s*=\s*["']module["']/.test(htmlNoComment)
);

const srcs = [...htmlNoComment.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/g)].map((m) => m[1]);
const EXPECT = [
  "safe-storage.js",
  "vocab.js", "oracle-data.js", "busy.js", "engine.js", "oracle.js",
  "data/offline.js", // 离线数据快照：必须在 app.js 之前
  "app.js", "shell.js",
];
check("① 脚本装载顺序 = 依赖顺序", JSON.stringify(srcs) === JSON.stringify(EXPECT), srcs.join(" → "));
check(
  "① 每个 script 标签都带 defer（顺序执行，且在 DOMContentLoaded 前完成）",
  [...htmlNoComment.matchAll(/<script\b[^>]*\bsrc\s*=[^>]*>/g)].every((m) => /\bdefer\b/.test(m[0]))
);
check(
  "① 脚本都在业务 DOM 之后、</body> 之前（先把架子铺好再上电）",
  htmlNoComment.indexOf("<script") > htmlNoComment.indexOf("</main>") &&
    htmlNoComment.lastIndexOf("<script") < htmlNoComment.indexOf("</body>")
);

// ---------- ② 动态：真窗口里加载 + 真点击 ----------
const dom = new JSDOM(html, { url: "http://127.0.0.1:8787/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const doc = window.document;

// 断网/无服务时的兜底：所有请求都拿本地 web/data 里的真数据应答
window.fetch = async (url) => {
  const u = String(url);
  const name = u.split("?")[0].split("/").pop();
  let body = {};
  try {
    if (u.includes("/api/items")) body = { items: JSON.parse(fs.readFileSync(path.join(WEB, "data", "items.json"), "utf-8")) };
    else if (u.includes("/api/samples")) body = { samples: [] };
    else if (name.endsWith(".json")) body = JSON.parse(fs.readFileSync(path.join(WEB, "data", name), "utf-8"));
  } catch {
    body = {};
  }
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
};
window.alert = () => {};

const { loadWebIntoWindow, WEB_FILES } = await import("./_web_loader.mjs");

let loadErr = null;
try {
  // 连同外壳一起装：和 index.html 里的顺序完全一致
  loadWebIntoWindow(window, [...WEB_FILES, "shell.js"]);
} catch (e) {
  loadErr = e;
}
check("② 全部脚本在真窗口里加载无异常", !loadErr, loadErr ? String(loadErr && loadErr.message) : "");
if (loadErr) {
  console.log(`\n${ok}/${total} 通过`);
  process.exit(1);
}

check("② 公共命名空间已建立", !!window.Outfit, Object.keys(window.Outfit || {}).length + " 个公共名");
check("② 业务测试钩子在位（app.js 真的执行了）", !!window.__outfitApp);
check("② 手机外壳在位（shell.js 真的执行了）", !!window.PhoneShell);

// 等 init() 把抽屉那层装完（内部有 fetch，异步）
await new Promise((r) => setTimeout(r, 200));

check("② 「拿主意」这一层已挂载", !!window.__oracle);
check("② 手机模式默认开启", doc.documentElement.classList.contains("phone-mode"));
check("② 外壳已挂到页面上", !!doc.querySelector(".phone-stage .phone-screen"));

// 屏幕内的透明浮层不能吞掉点击 —— 这是另一类「点了没反应」
const gloss = doc.querySelector(".phone-gloss");
const toast = doc.querySelector(".phone-toast");
check(
  "② 玻璃反光层不拦截点击（pointer-events:none）",
  !!gloss && gloss.style.pointerEvents !== "auto",
  gloss ? gloss.getAttribute("style") || "(由 CSS 定义)" : "未找到"
);
check("② Toast 不拦截点击", !!toast && !doc.querySelector(".phone-island.open"));

// —— 交互 1：点汉堡菜单 → 抽屉打开 ——
doc.querySelector("#btn-menu").click();
const drawer = doc.querySelector("#drawer");
check("交互·点菜单 → 抽屉打开", drawer.classList.contains("open") && drawer.getAttribute("aria-hidden") === "false");

// —— 交互 2：点抽屉里的「我的衣柜」 → 视图切过去，抽屉自动收起 ——
const wardrobeBtn = [...doc.querySelectorAll(".drawer-sub")].find((b) => b.dataset.go === "wardrobe");
check("交互·抽屉里有「我的衣柜」入口", !!wardrobeBtn);
wardrobeBtn.click();
check(
  "交互·点入口 → 视图切到衣橱",
  doc.documentElement.dataset.view === "wardrobe" && doc.querySelector("#wardrobe").classList.contains("active"),
  doc.documentElement.dataset.view
);
check("交互·切页后抽屉自动收起", !drawer.classList.contains("open"));

// —— 交互 3：点底部 Tab → 轨道下标跟着走（手机外壳的切页） ——
const tabs = [...doc.querySelectorAll(".phone-tab")];
check("交互·底部 Tab 有内容", tabs.length > 0, tabs.map((t) => t.textContent.trim()).join("/"));
const resultsTab = tabs.find((t) => t.textContent.includes("结果"));
if (resultsTab) {
  resultsTab.click();
  await new Promise((r) => setTimeout(r, 20));
  check(
    "交互·点底部 Tab → 切到结果页并同步轨道下标",
    doc.documentElement.dataset.view === "result" && doc.querySelector("main.shell").style.getPropertyValue("--phone-i") !== "",
    `view=${doc.documentElement.dataset.view} --phone-i=${doc.querySelector("main.shell").style.getPropertyValue("--phone-i")}`
  );
} else {
  check("交互·点底部 Tab → 切到结果页并同步轨道下标", false, "没找到「结果」Tab");
}

// —— 交互 4：业务控件（原生点击真的落到了 app.js 上） ——
const segs = [...doc.querySelectorAll("#ingest-mode .seg-btn")];
check("交互·入柜方式有三个按钮", segs.length === 3);
segs[1].click();
check(
  "交互·点「联网找白底图」 → 状态真的变了",
  window.__outfitApp.state.ingestMode === "web" && segs[1].classList.contains("active"),
  window.__outfitApp.state.ingestMode
);

const ack = doc.querySelector("#rules-ack");
ack.click();
check("交互·勾选「我已按规范拍摄」", ack.checked === true);

// —— 交互 5：键盘切页（← → 属于外壳能力） ——
const before = doc.documentElement.dataset.view;
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
await new Promise((r) => setTimeout(r, 20));
check("交互·← 键能切页", doc.documentElement.dataset.view !== before, `${before} → ${doc.documentElement.dataset.view}`);

// —— ③ 离线快照：与 JSON 同源 + 真的能顶住 file:// ——
// 生成物必须和源保持一致，否则双击打开看到的是过期衣橱
const MD5_SOURCES = ["items", "samples", "slot-samples", "tarot"];
const h = crypto.createHash("md5");
for (const n of MD5_SOURCES) h.update(fs.readFileSync(path.join(WEB, "data", n + ".json")));
const expectMd5 = h.digest("hex");
const offlineJs = fs.readFileSync(path.join(WEB, "data", "offline.js"), "utf-8");
const gotMd5 = (offlineJs.match(/SOURCE_MD5:\s*([0-9a-f]{32})/) || [])[1];
check(
  "③ offline.js 与 data/*.json 同源（过期就重跑 python scripts/build_offline_data.py）",
  gotMd5 === expectMd5,
  `期望 ${expectMd5.slice(0, 8)}… 实际 ${String(gotMd5).slice(0, 8)}…`
);

// 真正模拟「双击打开」：把 fetch 变成一律失败（浏览器在 file:// 下就是这么干的）
const dom2 = new JSDOM(html, { url: "file:///E:/proj/outfit-mystic/web/index.html", runScripts: "outside-only", pretendToBeVisual: true });
const w2 = dom2.window;
w2.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
w2.alert = () => {};
loadWebIntoWindow(w2, [...WEB_FILES, "shell.js"]);
await new Promise((r) => setTimeout(r, 200));

const app2 = w2.__outfitApp;
check("③ file:// 下页面照样装起来了", !!app2 && !!w2.PhoneShell);
// file:// 是「不透明来源」，localStorage 可能直接抛 SecurityError —— 外壳不能因此挂掉
check(
  "③ file:// 下手机外壳照样装起来（SafeStore 挡住了 localStorage 异常）",
  w2.document.documentElement.classList.contains("phone-mode") && !!w2.document.querySelector(".phone-stage"),
  w2.document.querySelector(".phone-stage") ? "外壳在位" : "外壳缺失"
);
check(
  "③ file:// 下衣橱不是空的（走离线快照）",
  (app2.state.items || []).length > 0,
  (app2.state.items || []).length + " 件"
);
check("③ file:// 下塔罗不是空的", (app2.state.tarotCards || []).length > 0, (app2.state.tarotCards || []).length + " 张");
check("③ file:// 下示例图不是空的", (app2.state.samples || []).length > 0, (app2.state.samples || []).length + " 张");
check("③ file:// 下四格示例卡有数据", !!app2.state.slotSamples, Object.keys(app2.state.slotSamples || {}).join("/"));
check("③ file:// 下依然能交互（点菜单 → 抽屉打开）", (() => {
  w2.document.querySelector("#btn-menu").click();
  return w2.document.querySelector("#drawer").classList.contains("open");
})());

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
