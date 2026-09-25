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

// ---- A8 AI 等待时必须看得见在动 ----
// 抠底 + VLM 打标几秒到十几秒，界面不能是一张不动的静态面板 —— 和卡死没区别
const { startBusy, isBusy } = await import(new URL("../web/busy.js", import.meta.url).href);
const busyHost = window.document.querySelector("#upload-busy");
check("A8 有专用的忙碌指示器容器", !!busyHost && busyHost.classList.contains("busy-host"));

const bh = startBusy(busyHost, { title: "AI 正在分析…", hints: ["先抠底…", "再打标…"] });
check(
  "A8 指示器三件套：转圈 + 计时 + 提示",
  !!busyHost.querySelector(".busy-spin") &&
    !!busyHost.querySelector(".busy-timer") &&
    busyHost.querySelector(".busy-title").textContent === "AI 正在分析…"
);
const t1 = busyHost.querySelector(".busy-timer").textContent;
await new Promise((r) => setTimeout(r, 160));
const t2 = busyHost.querySelector(".busy-timer").textContent;
check("A8 计时在往前走（证明没卡死）", t1 !== t2, `${t1} → ${t2}`);

bh.pause("等你挑一张");
check(
  "A8 等用户时停表停圈（不装作 AI 还在跑）",
  busyHost.querySelector(".busy").classList.contains("busy-wait") &&
    busyHost.querySelector(".busy-title").textContent === "等你挑一张"
);
bh.resume("AI 继续…");
check("A8 恢复后退出等待态", !busyHost.querySelector(".busy").classList.contains("busy-wait"));
bh.stop();
check("A8 结束后清干净", busyHost.innerHTML === "" && !isBusy());

// 真实链路：/ingest 慢的时候，指示器要在、重复提交要被挡住
const origFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url).includes("/ingest")) {
    await new Promise((r) => setTimeout(r, 260));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ item: { id: "w9999", cut_ok: true, category: "top" }, tag_ok: true }),
    };
  }
  return origFetch(url);
};
const file = new window.File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" });
const pUpload = app.handleUpload(file);
await new Promise((r) => setTimeout(r, 60));
check(
  "A8 上传期间指示器在跑",
  !!busyHost.querySelector(".busy"),
  busyHost.querySelector(".busy-title")?.textContent || "无指示器"
);
check("A8 上传期间挡住重复提交", window.document.querySelector("#btn-confirm").disabled === true);
await pUpload;
check("A8 上传结束后指示器收掉", busyHost.innerHTML === "");
check("A8 按钮恢复可用", window.document.querySelector("#btn-confirm").disabled === false);
globalThis.fetch = origFetch;

// ---- A9 结果页四格：不能留下「说不清为什么是空的」那一格 ----
// 截图那个 bug：连衣裙被选中却没格可放（上衣写「待选」），
// 天气判定不用外套也写「待选」——用户分不清「没选到」和「坏了」。
const wardrobe = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "data", "items.json"), "utf-8"));
app.state.items = wardrobe;

const slotOf = (k) => window.document.querySelector(`.slot-${k}`);
const labelOf = (k) => slotOf(k).querySelector(".slot-label").textContent;
const imgOf = (k) => slotOf(k).querySelector(".slot-img");
const emptyOf = (k) => slotOf(k).querySelector(".slot-empty");
const noteOf = (k) => slotOf(k).querySelector(".slot-note");
const sampleOf = (k) => slotOf(k).querySelector(".slot-sample");

// ① 天气说不用外套（上海 21℃ · 单层就够）
app.state.constraint = {
  source: "tarot", src: { board: "抽取式", label: "塔罗 · 星星", color: "#534AB7" },
  style_tags: ["温柔", "简约"], must_colors: ["奶油白"], avoid_colors: ["黑"],
  season: ["春", "秋"], must_categories: ["top", "bottom", "shoes"],
  weather: "多云", thickness: "单层就够", story: "", vibe: "",
};
app.renderResult(app.analyze(wardrobe, app.state.constraint), "星星说今天适合柔和地出门");

check("A9 连衣裙画进上衣格（不再是空的）", !imgOf("top").classList.contains("hidden"), imgOf("top").getAttribute("alt"));
check("A9 上衣格标题改成「连衣裙」", labelOf("top") === "连衣裙", labelOf("top"));
check(
  "A9 下装说明是「连衣裙自带」而不是「待选」",
  emptyOf("bottom").textContent.includes("连衣裙自带下装") && !noteOf("bottom").classList.contains("hidden"),
  emptyOf("bottom").textContent
);
check("A9 鞋格有真图", !imgOf("shoes").classList.contains("hidden"));
check(
  "A9 不用外套 → 写清原因而不是「待选」",
  emptyOf("outer").textContent.includes("今天不用外套") && noteOf("outer").textContent.includes("单层就够"),
  `${emptyOf("outer").textContent} / ${noteOf("outer").textContent}`
);
check("A9 不用外套的格子标成 off", slotOf("outer").classList.contains("slot-off"));
check("A9 四格状态挂到 data-state（拼贴靠它决定出不出空框）", slotOf("outer").dataset.state === "off" && slotOf("bottom").dataset.state === "skip", `${slotOf("outer").dataset.state}/${slotOf("bottom").dataset.state}`);

// ---- A9b 拼贴板形态（图一四格 → 图二一张拼贴）----
// 左列只剩连衣裙、右列只剩鞋 → 各自占满整列，不再是四个等大格子
const collage = window.document.querySelector("#collage");
check("A9b 拼贴板成一整块", !!window.document.querySelector("#collage .look-board"));
check("A9b 单件的那一列占满整列", collage.classList.contains("left-one") && collage.classList.contains("right-one"));
check(
  "A9b 顶部有氛围标签",
  window.document.querySelectorAll("#look-chips .lk").length >= 2,
  [...window.document.querySelectorAll("#look-chips .lk")].map((x) => x.textContent).join("/")
);
check(
  "A9b 拼贴下有说明行（替代格子里的「待选」）",
  window.document.querySelector("#look-note").textContent.includes("连衣裙自带") &&
    window.document.querySelector("#look-note").textContent.includes("今天不用"),
  window.document.querySelector("#look-note").textContent
);
check(
  "A9b 手写签名在位",
  window.document.querySelector(".look-sign").textContent.includes("Look")
);
check(
  "A9 meta 把「今天不用」和「缺件」分开说",
  !window.document.querySelector("#result-meta").textContent.includes("缺 1 件槽位"),
  window.document.querySelector("#result-meta").textContent.split("\n")[1] || ""
);

// ② 衣橱里真挑不出外套：给一张示例卡，不许只留「待选」
app.state.constraint = {
  source: "tarot", src: { board: "抽取式", label: "塔罗 · 月亮", color: "#534AB7" },
  style_tags: ["通勤"], season: ["春", "秋"], avoid_colors: ["卡其", "黑"],
  must_categories: ["top", "bottom", "shoes", "outer"], story: "", vibe: "",
};
app.renderResult(app.analyze(wardrobe, app.state.constraint), "月亮说今天走安静路线");

check("A9 挑不出时格子标成 blank", slotOf("outer").classList.contains("slot-blank"));
check("A9 示例格在拼贴里仍然可见", slotOf("outer").dataset.state === "empty");
check("A9 挑不出时给示例卡", !sampleOf("outer").classList.contains("hidden"));
check("A9 示例卡写明是「示例」", sampleOf("outer").querySelector(".sample-badge").textContent === "示例");
check(
  "A9 示例卡有具体单品名（不是占位装饰）",
  !!sampleOf("outer").querySelector(".sample-name").textContent.trim(),
  sampleOf("outer").querySelector(".sample-name").textContent
);
check(
  "A9 meta 说明该格是示例",
  window.document.querySelector("#result-meta").textContent.includes("该格显示的是示例"),
  window.document.querySelector("#result-meta").textContent.split("\n").find((l) => l.includes("衣橱里缺")) || ""
);
check(
  "A9 示例不踩避雷色（约束避开卡其，示例就不能是卡其）",
  !sampleOf("outer").querySelector(".sample-name").textContent.includes("卡其"),
  sampleOf("outer").querySelector(".sample-name").textContent
);

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
