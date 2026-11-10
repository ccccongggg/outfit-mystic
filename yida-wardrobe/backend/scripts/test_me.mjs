// web/me.js 回归：T06「我的」主页线 M01–M04（2026-09-26 冻结规格 36–47）
// 覆盖：① 静态结构(me.css/6 section/脚本顺序) ② NS 导出与 viewRenderers 注册
//       ③ 抽屉/头像进 M01 真渲染 ④ me 系页内部导航 + 主题切换 + 个人信息存盘
//       ⑤ acceptOutfit → confirmed 落盘（同日二次弹覆盖、未来日期、M03 双 Tab）
//       ⑥ 结果页挂件接线 ⑦ file:// 断网场景 me.js 仍可加载与渲染
// 注：本文件为 2026-09-26 晚间接线棒重建（并行棒 17:55 的 30 项版本在 mv 时被
//     覆盖，覆盖范围已在本版恢复并新增 confirmed/覆盖弹框/未来日期断言）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JSDOM_HOME =
  process.env.JSDOM_HOME || "C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules";
let JSDOM;
try {
  ({ default: { JSDOM } } = await import(new URL("file:///" + path.join(JSDOM_HOME, "jsdom", "lib", "api.js").replace(/\\/g, "/").replace(/^\/+/, "")).href));
} catch {
  ({ default: { JSDOM } } = await import("jsdom"));
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");
const html = fs.readFileSync(path.join(WEB, "index.html"), "utf-8");

const dom = new JSDOM(html, { url: "http://127.0.0.1:8787/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const doc = window.document;
window.fetch = async (url) => {
  const u = String(url);
  const name = u.split("?")[0].split("/").pop();
  let body = {};
  try {
    if (u.includes("/api/items")) body = { items: JSON.parse(fs.readFileSync(path.join(WEB, "data", "items.json"), "utf-8")) };
    else if (name.endsWith(".json")) body = JSON.parse(fs.readFileSync(path.join(WEB, "data", name), "utf-8"));
  } catch { body = {}; }
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
};
window.alert = () => {};

const { loadWebIntoWindow, WEB_FILES } = await import("./_web_loader.mjs");
loadWebIntoWindow(window, [...WEB_FILES, "shell.js"]);
await new Promise((r) => setTimeout(r, 30)); // 让 init()/defer 语义跑完

let ok = 0, total = 0;
const check = (name, cond, extra = "") => {
  total++;
  if (cond) { ok++; console.log(`[PASS] ${name}`); }
  else console.log(`[FAIL] ${name} ${extra}`);
};
const NS = window.Outfit;
const orc = window.__oracle;
const app = window.__outfitApp;

// ⓪ 静态结构（恢复并行棒 test_me 原稿的静态段）
check("index.html 引用 me.css", /<link[^>]+href="me\.css/.test(html));
check("index.html 有 6 个 me 系 section", ["me", "settings", "me-profile", "me-theme", "records", "record-detail"].every((id) => new RegExp(`<section id="${id}" class="view"`).test(html)));
check("index.html 脚本含 me.js 且在 shell.js 之后", html.indexOf('src="me.js"') > html.indexOf('src="shell.js"'));

// ① 导出齐（缺口4）
check("NS 导出 toast/setThemePref/imgSrc", [NS.toast, NS.setThemePref, NS.imgSrc].every((f) => typeof f === "function"));
check("NS.Me 挂件在位", NS.Me && typeof NS.Me.onConfirmed === "function");
check("NS.viewRenderers 含 me 系 + result", ["me", "settings", "me-profile", "me-theme", "records", "record-detail", "result"].every((k) => typeof NS.viewRenderers[k] === "function"));

// ② 抽屉项存在 + go("me") 真渲染 M01（缺口2/3/抽屉入口）
const drawerMe = doc.querySelector('.drawer-sub[data-go="me"]');
check("抽屉有「我的」入口", !!drawerMe);
orc.go("me");
check("go('me') 后 #me 为 active 视图", doc.getElementById("me").classList.contains("active"));
check("M01 真渲染：hero + 快捷双入口", !!doc.querySelector("#me .me-hero") && doc.querySelectorAll("#me .mq-btn").length === 2);
check("M01 设置齿轮在位", !!doc.querySelector("#me .me-gear"));

// ③ me 系页内部导航（me.js go → 宿主 switchView）
doc.querySelector("#me .me-gear").click();
check("齿轮 → 设置目录真渲染", doc.getElementById("settings").classList.contains("active") && doc.querySelectorAll("#settings .set-row").length === 4);
doc.querySelector('#settings [data-me-go="me-theme"]').click();
check("主题设置真渲染：三主题 + 减少动态", doc.getElementById("me-theme").classList.contains("active") && doc.querySelectorAll('#me-theme [data-theme-pref]').length === 3);
doc.querySelector('[data-theme-pref="space"]').click();
check("点「深空」→ dataset.theme 生效且写偏好", doc.documentElement.dataset.theme === "space" && window.localStorage.getItem("outfit-theme") === "space");
doc.querySelector('[data-theme-pref="flow"]').click();

// ③b 个人信息存盘（M02-1，规格 42）
doc.querySelector('#settings [data-me-go="me-profile"]').click();
check("个人信息页真渲染", doc.getElementById("me-profile").classList.contains("active") && !!doc.getElementById("pf-save"));
doc.getElementById("pf-name").value = "测试昵称";
doc.getElementById("pf-save").click();
const pf = JSON.parse(window.localStorage.getItem("outfit-profile-v1") || "{}");
check("个人信息保存 → profile store + 顶栏头像同步", pf.name === "测试昵称" && doc.getElementById("me-top-ava-t").textContent === "测");

// ④ acceptOutfit → confirmed（缺口5）
orc.go("home");
app.state.constraint = { source: "tarot", src: { label: "塔罗·节制" }, must_categories: ["top", "bottom", "shoes"] };
const items = app.state.items;
app.state.result = {
  picks: [items[0], items[1], items[2]],
  items: [items[0].id, items[1].id, items[2].id],
  reason: "测试理由第一句。后面不要。",
  constraint: app.state.constraint,
  score: 58,
};
app.acceptOutfit();
const conf1 = JSON.parse(window.localStorage.getItem("outfit-confirmed-v1") || "{}");
const today = new Date().toISOString().slice(0, 10);
check("acceptOutfit → confirmed 落盘(今日)", !!conf1[today], Object.keys(conf1).join(","));
check("entry 结构齐：slots/images/reason/source_ai", (() => { const e = conf1[today]; return e && e.slots?.length === 3 && e.images?.length === 3 && e.reason === "测试理由第一句。后面不要。" && e.source_ai === true && e.outfit_score === 58; })());
// 同日第二次 → 弹覆盖框
app.acceptOutfit();
check("同日第二次确认 → 覆盖弹框出现", !!doc.querySelector(".me-dialog"));
doc.querySelector('.me-dialog [data-md="ok"]').click();
check("点覆盖 → 弹框消失且 confirmed 仍在", !doc.querySelector(".me-dialog") && !!(JSON.parse(window.localStorage.getItem("outfit-confirmed-v1") || "{}"))[today]);

// ⑤ 结果页挂件接线（缺口6）
orc.go("result");
const tdr = doc.getElementById("target-date-row");
check("结果页目标日期条可见且有 7 chip + 自定义输入", !tdr.hidden && tdr.querySelectorAll("[data-td]").length === 7 && !!tdr.querySelector(".td-input"));
check("发到广场按钮已绑定", doc.getElementById("btn-post").dataset.bound === "1");
// 选明天 → confirmed 写到未来日期（M03 未来 Tab 可见）
const tomorrowD = new Date(Date.now() + 864e5);
const tomorrow = tomorrowD.toISOString().slice(0, 10);
tdr.querySelector(`[data-td="${tomorrow}"]`).click();
app.state.result.reason = "第二套。";
app.acceptOutfit();
const conf2 = JSON.parse(window.localStorage.getItem("outfit-confirmed-v1") || "{}");
check("选明天再确认 → 写入未来日期", !!conf2[tomorrow]);
orc.go("records");
const cn = (d) => { const x = new Date(d + "T00:00:00"); return `${x.getMonth() + 1}月${x.getDate()}日`; };
check("M03 未来 Tab 可见明天那条", doc.getElementById("records").classList.contains("active") && (doc.querySelector("#records .rec-list")?.textContent || "").includes(cn(tomorrow)));

// ⑦ file:// 断网场景：fetch 一律 reject，me.js 仍加载且「我的」可渲染（硬要求）
const domF = new JSDOM(html, { url: "file:///" + WEB.replace(/\\/g, "/") + "/index.html", runScripts: "outside-only", pretendToBeVisual: true });
const wf = domF.window;
wf.fetch = async () => { throw new TypeError("URL scheme must be http or https for CORS request"); };
wf.alert = () => {};
try {
  loadWebIntoWindow(wf, [...WEB_FILES, "shell.js"]);
} catch (e) {
  check("file:// 下全部脚本加载无异常", false, String(e && e.message));
}
await new Promise((r) => setTimeout(r, 30));
check("file:// 下 me.js 加载（NS.Me 在位）", !!wf.Outfit?.Me);
wf.Outfit?.Me && wf.document.querySelector("#btn-me").click();
check("file:// 下点头像 → M01 真渲染", wf.document.getElementById("me").classList.contains("active") && !!wf.document.querySelector("#me .me-hero"));

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
