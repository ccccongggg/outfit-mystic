// 入柜方式 + 联网白底图候选确认 —— 真实 DOM 冒烟测试（jsdom 直接跑 web/app.js）
// 用法: node scripts/test_intake.mjs
// jsdom 从 WorkBuddy 的 node workspace 里加载（避免污染项目 node_modules）
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

// ---- 起一个假的 DOM 环境 ----
const html = fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf-8");
const dom = new JSDOM(html, {
  url: "http://127.0.0.1:8791/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
for (const k of ["window", "document", "location", "localStorage", "URL", "HTMLElement", "Node", "Event", "CustomEvent", "MutationObserver", "FormData"]) {
  if (window[k] === undefined) continue;
  try {
    globalThis[k] = window[k];
  } catch {
    // node 22 里 navigator 等是只读 getter，跳过即可（业务代码没用到）
  }
}
globalThis.alert = () => {};

// fetch 桩：让 init() 里的 loadItems/loadTarot 拿到空数据，不真的联网
const fetchLog = [];
globalThis.fetch = async (url) => {
  fetchLog.push(String(url));
  const u = String(url);
  let body = {};
  if (u.includes("/api/items")) body = { items: [] };
  else if (u.includes("/api/samples")) body = { samples: [] };
  else if (u.includes("tarot")) body = { cards: [] };
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
};

window.eval("globalThis.__noop = true;");

// ---- 加载真实业务脚本（ESM）----
await import(new URL("../web/app.js", import.meta.url).href);
const app = window.__outfitApp;
check("app.js 加载并暴露测试钩子", !!app);
if (!app) {
  console.log("\n0/1 通过");
  process.exit(1);
}

// ---- A1 入柜方式选择器 ----
const segBtns = [...window.document.querySelectorAll("#ingest-mode .seg-btn")];
check("A1 入柜方式有三个选项", segBtns.length === 3, segBtns.map((b) => b.dataset.mode).join("/"));
check("A1 默认是 AI 抠图", app.state.ingestMode === "cut" && segBtns[0].classList.contains("active"));

// ---- A2 切换模式更新状态与提示 ----
segBtns[1].click();
const hintAfter = window.document.querySelector("#mode-hint").textContent;
check(
  "A2 切到「联网找白底图」",
  app.state.ingestMode === "web" && segBtns[1].classList.contains("active") && !segBtns[0].classList.contains("active"),
  hintAfter.slice(0, 24)
);
check("A2 提示文案含「全网」", hintAfter.includes("全网"));

segBtns[2].click();
check("A2 切到「自动」", app.state.ingestMode === "auto" && window.document.querySelector("#mode-hint").textContent.includes("回落"));
app.setIngestMode("cut");

// ---- A3 候选弹窗渲染 ----
const cands = [
  { path: "E:/tmp/a.jpg", url: "/api/findimg/last/cand_0.jpg", page_url: "https://detail.tmall.com/item.htm?id=1", width: 500, height: 500, white_ratio: 0.98, vlm: { ok: true, reason: "VLM 复核通过：白底单品图 · 短袖 · 白色" } },
  { path: "E:/tmp/b.jpg", url: "/api/findimg/last/cand_1.jpg", page_url: "https://www.taobao.com/x", width: 800, height: 1044, white_ratio: 0.42, vlm: { ok: false, reason: "背景不是白底/纯色底（scene）" } },
];
const p1 = app.openFoundModal({ ok: true, verified: true, candidates: cands, url: cands[0].url });
const modal = window.document.querySelector("#found-modal");
const items = [...window.document.querySelectorAll(".found-item")];
check("A3 弹窗打开", !modal.classList.contains("hidden"));
check("A3 渲染 2 个候选", items.length === 2);
check("A3 通过/未通过标记正确", items[0].querySelector(".badge").classList.contains("ok") && items[1].querySelector(".badge").classList.contains("no"));
check("A3 缩略图用绝对地址", items[0].querySelector("img").getAttribute("src").startsWith("http://127.0.0.1:8791/api/findimg/"));
check("A3 副标题说明 AI 已复核", window.document.querySelector("#found-sub").textContent.includes("AI 已复核"));

// ---- A4 点选候选 → resolve 出该图路径 ----
items[0].click();
const choice1 = await p1;
check("A4 点选返回候选路径", choice1 === cands[0].path, String(choice1).slice(-22));
check("A4 点选后弹窗关闭", modal.classList.contains("hidden"));

// ---- A5 「用我自己那张」/ 取消 ----
const p2 = app.openFoundModal({ ok: true, verified: false, message: "VLM 不可用", candidates: cands });
check("A5 未复核时提示目视确认", window.document.querySelector("#found-sub").textContent.includes("AI 复核不可用"));
window.document.querySelector("#btn-found-mine").click();
check("A5 「用自己的抠图」返回空串", (await p2) === "");

const p3 = app.openFoundModal({ ok: true, verified: true, candidates: cands });
window.document.querySelector("#btn-found-cancel").click();
check("A5 取消返回 null", (await p3) === null);

// ---- A6 工具函数 ----
check("A6 esc 转义尖括号与引号", app.esc('<img src="x">') === "&lt;img src=&quot;x&quot;&gt;");
check("A6 hostOf 取主机名去掉 www", app.hostOf("https://www.taobao.com/a/b") === "taobao.com");
check("A6 absUrl 拼服务端相对路径", app.absUrl("/api/findimg/last/cand_0.jpg").startsWith("http://127.0.0.1:8791/"));

// ---- A7 初始化没有异常 ----
check("A7 init 期间发起过接口请求", fetchLog.length > 0, fetchLog.length + " 次");

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
