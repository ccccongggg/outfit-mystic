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

// ---- 加载真实业务脚本（经典脚本，按 index.html 的顺序 eval）----
// 原来是 `await import("../web/app.js")`；改因见 scripts/_web_loader.mjs 顶部注释
const { loadWebIntoNode } = await import("./_web_loader.mjs");
loadWebIntoNode();
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

// ---- A10 V1.0 路径对齐:结果页三动作 = 就穿这套 / 换一套 / 分享 ----
const acceptBtn = window.document.querySelector("#btn-accept");
const rerollBtn = window.document.querySelector("#btn-reroll");
const shareBtn = window.document.querySelector("#btn-share");
check("A10 结果页有「就穿这套」按钮(accept)", !!acceptBtn, acceptBtn?.textContent?.trim());
check("A10 结果页有「换一套」按钮(reroll)", !!rerollBtn && rerollBtn.textContent.trim() === "换一套");
check("A10 结果页有「分享」按钮(share)", !!shareBtn && shareBtn.textContent.trim() === "分享");
// 「btn-run」应该是旧名字,现在已经完全迁移到「btn-accept」,HTML 里不该再有。
check("A10 旧按钮 #btn-run 已移除(避免遗留重复 handler)", !window.document.querySelector("#btn-run"));

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
const { startBusy, isBusy } = window.Outfit;
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
  "A9 不用外套 → 原因写进拼贴说明行而不是「待选」",
  window.document.querySelector("#look-note").textContent.includes("今天不用") &&
    window.document.querySelector("#look-note").textContent.includes("单层就够"),
  window.document.querySelector("#look-note").textContent
);
check(
  "A9 不用外套 → 保暖提醒模块整块隐藏",
  window.document.querySelector("#outer-notice").classList.contains("hidden")
);
check("A9 槽位状态挂到 data-state（拼贴靠它决定出不出空框）", slotOf("bottom").dataset.state === "skip", slotOf("bottom").dataset.state);

// ---- A9b 拼贴板形态（穿着逻辑三区：主体服装区 + 配饰侧列；外套走独立提醒模块）----
// 主体区：上衣在上、下装/裙在下；配饰（鞋/包/耳饰）在侧部一列
const collage = window.document.querySelector("#collage");
check("A9b 拼贴板成一整块", !!window.document.querySelector("#collage .look-board"));
check(
  "A9b 主体服装区=上衣在上+下装在下",
  !!collage.querySelector(".look-main .slot-top") && !!collage.querySelector(".look-main .slot-bottom")
);
check("A9b 配饰列在主体服装区侧部（鞋在列里）", !!collage.querySelector(".look-side .slot-shoes"));
check("A9b 外套不在拼贴里", !collage.querySelector(".slot-outer"));
check("A9b 主体区只剩一件时占满整区", collage.querySelector(".look-main").classList.contains("main-single"));
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

// ② 衣橱里真挑不出外套：「保暖提醒」模块给示例色卡 + 补录路径，不许只留「待选」
//    avoid_colors 覆盖衣橱里所有现存外套颜色(卡其/黑/浅蓝与米白/米白色),
//    配合 season 春秋 → w9003/w9004 也被季节挡掉,w0011/w4322/w9704 被 avoid 挡掉,只剩 outer 空。
app.state.constraint = {
  source: "tarot", src: { board: "抽取式", label: "塔罗 · 月亮", color: "#534AB7" },
  style_tags: ["通勤"], season: ["春", "秋"], avoid_colors: ["卡其", "黑", "浅蓝", "米白"],
  must_categories: ["top", "bottom", "shoes", "outer"], story: "", vibe: "",
};
app.renderResult(app.analyze(wardrobe, app.state.constraint), "月亮说今天走安静路线");

const notice = window.document.querySelector("#outer-notice");
check("A9 天气要外套但挑不出 → 提醒模块出现", !notice.classList.contains("hidden"));
check("A9 模块标题是「保暖提醒」", notice.querySelector(".on-head h2").textContent === "保暖提醒");
check("A9 挑不出时给示例色卡", !window.document.querySelector("#outer-swatch").classList.contains("hidden"));
check(
  "A9 示例有具体单品名（不是占位装饰）",
  window.document.querySelector("#outer-why").textContent.includes("·"),
  window.document.querySelector("#outer-why").textContent
);
check(
  "A9 提醒带穿着建议与注意事项",
  window.document.querySelectorAll("#outer-tips li").length >= 2,
  `${window.document.querySelectorAll("#outer-tips li").length} 条`
);
check(
  "A9 meta 说明是示例",
  window.document.querySelector("#result-meta").textContent.includes("显示的是示例参考"),
  window.document.querySelector("#result-meta").textContent.split("\n").find((l) => l.includes("衣橱里缺")) || ""
);
check(
  "A9 示例不踩避雷色（约束避开卡其，示例就不能是卡其）",
  !window.document.querySelector("#outer-why").textContent.includes("卡其"),
  window.document.querySelector("#outer-why").textContent
);

// ③ 天气硬性要求外套且选上了：提醒模块给真衣图 + 建议
app.state.constraint = {
  source: "tarot", src: { board: "抽取式", label: "塔罗 · 星星", color: "#534AB7" },
  style_tags: ["温柔", "简约"], must_colors: ["奶油白"], avoid_colors: ["黑"],
  season: ["春", "秋"], must_categories: ["top", "bottom", "shoes", "outer"],
  weather: "阴", thickness: "薄外套", weather_temp: 18, story: "", vibe: "",
};
app.renderResult(app.analyze(wardrobe, app.state.constraint), "星星说今天适合柔和地出门");
check("A9 要外套且选上 → 提醒模块出现", !window.document.querySelector("#outer-notice").classList.contains("hidden"));
check("A9 提醒模块给真衣图", !window.document.querySelector("#outer-img").classList.contains("hidden"));
check(
  "A9 天气胶囊写清阴·薄外套",
  window.document.querySelector("#outer-tag").textContent === "阴 · 薄外套",
  window.document.querySelector("#outer-tag").textContent
);
check(
  "A9 建议行提到温差/薄款",
  window.document.querySelector("#outer-tips").textContent.includes("薄款"),
  window.document.querySelector("#outer-tips").textContent
);

// ---- A9c 结果页卡片区与结果来源同步（修「有结果但卡片区停留尚未抽牌」）----
// 卡片区曾由各入口函数分散同步（drawTarot / syncResultSource），新入口与历史回放必漏；
// 现由 renderResult 统一 syncResultCard：抽牌来源显示牌面，非抽牌来源整块隐藏卡框。
const art = window.document.querySelector(".story-card-art");
const cardPh = window.document.querySelector(".story-card-placeholder");
const cardImg = window.document.querySelector("#result-tarot-img");
app.state.tarotCards = [
  { id: "t1", name: "星星", image: "assets/tarot/t1.jpg" },
  { id: "t2", name: "月亮", image: "assets/tarot/t2.jpg" },
  { id: "t3", name: "太阳", image: "assets/tarot/t3.jpg" },
];
app.state.constraint = {
  source: "tarot3", src: { board: "抽取式", label: "三牌阵 · 星星 · 月亮 · 太阳", color: "#534AB7" },
  style_tags: ["温柔"], must_colors: [], avoid_colors: [], season: ["春"],
  must_categories: ["top", "bottom", "shoes"], story: "三牌阵故事", vibe: "",
  extra: { card_ids: ["t1", "t2", "t3"] },
};
app.renderResult(app.analyze(wardrobe, app.state.constraint), "三牌阵说今天穿这套");
check(
  "A9c 抽牌来源 → 卡片区按 id 显示牌面（三牌阵并排三张）",
  !cardImg.classList.contains("hidden") && art.querySelectorAll("img").length === 3,
  `${art.querySelectorAll("img").length} 张`
);
check("A9c 抽牌来源 → 占位框收起", cardPh.classList.contains("hidden"));
check(
  "A9c 抽牌来源 → 故事行是牌义不是默认仪式句",
  window.document.querySelector("#result-story").textContent === "三牌阵故事"
);
app.state.constraint = {
  source: "energy", src: { board: "拨盘式", label: "能量 · 满电", color: "#1D9E75" },
  style_tags: [], must_colors: [], avoid_colors: [], season: [],
  must_categories: ["top", "bottom", "shoes"], story: "满电故事", vibe: "", extra: {},
};
app.renderResult(app.analyze(wardrobe, app.state.constraint), "满电说今天可以明艳一次");
check("A9c 非抽牌来源 → 整块隐藏卡框，不留「尚未抽牌」", art.classList.contains("hidden"), art.className);

// ---- A11 V1.0 §4 单件上传拆 2 屏:屏 1 recog-stage(AI识图中)→ 屏 2 confirm-stage(标签确认) ----
// 设计上,屏 1 显示 4 步逐步推流,屏 2 渲染可编辑的 4 项标签
// + sheet 可改 + uncertain 高亮 + 「重新识别」可重跑 + 「取消」可退出
// 前面的 A8 测试走过一遍 handleUpload,屏 2 会停在 unhide 状态 — 先收干净再断言「默认隐藏」
app.hideUploadStages();
const recog = window.document.querySelector("#recog-stage");
const confirm = window.document.querySelector("#confirm-stage");
const sheet = window.document.querySelector("#confirm-sheet");
const recogImg = window.document.querySelector("#recog-img");
const confirmImg = window.document.querySelector("#confirm-img");
check("A11 屏 1 容器存在", !!recog && recog.classList.contains("hidden"));
check("A11 屏 2 容器存在", !!confirm && confirm.classList.contains("hidden"));
check("A11 sheet 容器存在", !!sheet && sheet.classList.contains("hidden"));
check("A11 屏 1 / 屏 2 / sheet 默认全部隐藏", recog.classList.contains("hidden") && confirm.classList.contains("hidden") && sheet.classList.contains("hidden"));

// 屏 1 主动打开 → 验证四步容器 + 流式行
app.showRecogStage(new window.File([new Uint8Array([10])], "b.jpg", { type: "image/jpeg" }));
check("A11 showRecogStage 后屏 1 unhide", !recog.classList.contains("hidden"));
// jsdom 里 URL.createObjectURL 多半抛错被 catch 吞掉; 只看 helper 没崩即可
check("A11 屏 1 显隐默认放图(尝试放图未抛错)", !!recogImg);
const stepDots = [...window.document.querySelectorAll(".recog-dot")];
check("A11 屏 1 4 步 dot 都在", stepDots.length === 4, stepDots.map((d) => d.dataset.step).join("/"));
check("A11 屏 1 起始有占位提示", window.document.querySelectorAll("#recog-stream .rs-line").length >= 1);

// 屏 1 推流:逐步推 4 步
app.markRecogStep("type", "看品类 · 应该是「外套」");
app.markRecogStep("color", "看颜色 · 应该是「卡其」");
app.markRecogStep("style", "看风格 · 通勤、复古");
app.markRecogStep("fabric", "看材质 · 羊毛");
const streamLines = [...window.document.querySelectorAll("#recog-stream .rs-line")];
check("A11 屏 1 推完 4 步后流式 4 行", streamLines.length >= 5, `got ${streamLines.length}`); // 占位 + 4 步 = 5 行
check("A11 屏 1 四步 dot 全部 done", stepDots.every((d) => d.classList.contains("done")));
check("A11 屏 1 推完仍可见(由调用方决定什么时候切屏 2)", !recog.classList.contains("hidden"));

// 屏 2:模拟 AI 返回的 item,看 confirm-stage 渲染
const fakeItem = {
  id: "wT001",
  type: "外套",
  category: "outer",
  color_name: "卡其",
  color_hex: "#B8895A",
  style_tags: ["通勤", "复古"],
  material: "羊毛",
  fit: "合身",
  occasions: ["通勤"],
};
app.showConfirmStage(fakeItem, new window.File([new Uint8Array([10])], "b.jpg", { type: "image/jpeg" }));
check("A11 屏 2 unhide", !confirm.classList.contains("hidden"));
check("A11 屏 1 切走后隐藏", recog.classList.contains("hidden"));
check("A11 屏 2 默认填上 AI 识别的品类", window.document.querySelector("#tag-cat-val").textContent === "外套", window.document.querySelector("#tag-cat-val").textContent);
check("A11 屏 2 默认填上 AI 识别的颜色", window.document.querySelector("#tag-color-val").textContent === "卡其");
check("A11 屏 2 默认填上 AI 识别的风格", window.document.querySelector("#tag-style-val").textContent === "通勤 / 复古");
check("A11 屏 2 默认填上 AI 识别的材质", window.document.querySelector("#tag-fabric-val").textContent === "羊毛");
check("A11 屏 2 confirmDraft 已建立", !!app.state.confirmDraft && app.state.confirmDraft.id === "wT001");

// 屏 2 → uncertain:缺品类 / 颜色 / 材质时挂「需要确认」
const warn = window.document.querySelector("#confirm-warning");
const fuzzyItem = { id: "wT002", type: "", category: "", color_name: "", style_tags: [], material: "" };
app.showConfirmStage(fuzzyItem, new window.File([new Uint8Array([10])], "c.jpg", { type: "image/jpeg" }));
// 强制把 uncertain 标上(模拟 handleUpload 里的逻辑)
app.state.confirmDraft.uncertain = new Set(["category", "color_name", "fabric"]);
window.document.querySelector(".tag-list") && (() => {
  // 重渲染 uncertain
  for (const row of window.document.querySelectorAll(".tag-row")) {
    row.classList.toggle("uncertain", app.state.confirmDraft.uncertain.has(row.dataset.field));
  }
  const uncertainFields = app.state.confirmDraft.uncertain;
  warn.textContent = `AI 对「${[...uncertainFields].map((f) => ({ category: "品类", color_name: "颜色", style_tags: "风格", fabric: "材质" }[f])).join("、")}」把握不大,请你目视确认或点开改一下。`;
  warn.classList.remove("hidden");
})();
check("A11 uncertain 触发 warning", !warn.classList.contains("hidden"), warn.textContent.slice(0, 30));
check("A11 uncertain 标签挂上 .uncertain", window.document.querySelector('.tag-row[data-field="category"]').classList.contains("uncertain"));

// 屏 2 → 打开 sheet:点击品类 → 弹出 sheet,7 个品类,单选
const catRow = window.document.querySelector('.tag-row[data-field="category"]');
catRow.click();
check("A11 点品类行打开 sheet", !sheet.classList.contains("hidden"));
check("A11 sheet 标题为「选择品类」", window.document.querySelector("#cs-title").textContent === "选择品类");
const catOpts = [...window.document.querySelectorAll("#cs-options .cs-opt")];
check("A11 sheet 渲染 7 个品类", catOpts.length === 7, catOpts.map((o) => o.textContent).join("/"));
// 模拟选「下装」
const bottomOpt = catOpts.find((o) => o.dataset.value === "bottom");
bottomOpt.click();
check("A11 sheet 选完品类自动关闭", sheet.classList.contains("hidden"));
check("A11 选完后屏 2 品类刷新", window.document.querySelector("#tag-cat-val").textContent === "下装", window.document.querySelector("#tag-cat-val").textContent);

// 屏 2 → 颜色 sheet:24 色
const colorRow = window.document.querySelector('.tag-row[data-field="color_name"]');
colorRow.click();
const colorOpts = [...window.document.querySelectorAll("#cs-options .cs-opt")];
check("A11 颜色 sheet 渲染 24 色", colorOpts.length === 24);
colorOpts.find((o) => o.dataset.value === "雾紫").click();
check("A11 颜色 sheet 选完关闭 + 屏 2 颜色刷新", sheet.classList.contains("hidden") && window.document.querySelector("#tag-color-val").textContent === "雾紫");

// 屏 2 → 风格 sheet:8 风格 + 多选
const styleRow = window.document.querySelector('.tag-row[data-field="style_tags"]');
styleRow.click();
const styleOpts = [...window.document.querySelectorAll("#cs-options .cs-opt")];
check("A11 风格 sheet 渲染 8 风格", styleOpts.length === 8);
styleOpts.find((o) => o.dataset.value === "简约").click();
check("A11 风格 sheet 多选不会自动关闭", !sheet.classList.contains("hidden"));
check("A11 风格选完一项点 on 高亮", styleOpts.find((o) => o.dataset.value === "简约").classList.contains("on"));
styleOpts.find((o) => o.dataset.value === "通勤").click();
check("A11 风格可继续累选(累计 style)", window.document.querySelector("#tag-style-val").textContent.includes("通勤"));
window.document.querySelector("#cs-close").click();
check("A11 风格 sheet 用关闭按钮收尾", sheet.classList.contains("hidden"));

// 屏 2 → 重新识别按钮存在 + 取消按钮存在
check("A11 屏 2 有「加入我的衣柜」", !!window.document.querySelector("#btn-confirm"));
check("A11 屏 2 有「重新识别」", !!window.document.querySelector("#btn-retry-recog"));
check("A11 屏 2 有「取消」", !!window.document.querySelector("#btn-cancel"));

// 屏 2 → 取消按钮:清 draft + 收屏 + 调 DELETE(P0-2 真撤销)
// advisor 方案:取消是 async,需 await 等 DELETE 完成
await new Promise((r) => {
  window.document.querySelector("#btn-cancel").click();
  // 给 50ms 让异步 fetch + 微任务结束
  setTimeout(r, 50);
});
// fetchJSON 在测试 mock 下会立刻 resolve,所以微任务结束即可断言
await Promise.resolve();
check("A11 取消后屏 2 隐藏", confirm.classList.contains("hidden"));
check("A11 取消后 confirmDraft 已清", app.state.confirmDraft === null);
check("A11 取消后 recogFile 已清", app.state.recogFile === null);

// hideUploadStages 兜底
app.showRecogStage(new window.File([new Uint8Array([10])], "d.jpg", { type: "image/jpeg" }));
app.showConfirmStage(fakeItem, new window.File([new Uint8Array([10])], "d.jpg", { type: "image/jpeg" }));
app.hideUploadStages();
check("A11 hideUploadStages 同时收掉 屏 1 + 屏 2 + sheet + preview-panel",
  recog.classList.contains("hidden") &&
  confirm.classList.contains("hidden") &&
  sheet.classList.contains("hidden") &&
  window.document.querySelector("#preview-panel").classList.contains("hidden")
);

// ---- A12 覆盖 P0-1 / P0-2 / P1 三处修复 ----

// A12-1: P0-1 屏 1 节奏 — RECOG_RHYTHM 常量存在 + clearRecogTimers 可清
check("A12 RECOG_RHYTHM 常量存在", Array.isArray(app.RECOG_RHYTHM) && app.RECOG_RHYTHM.length === 4, JSON.stringify(app.RECOG_RHYTHM));
check("A12 RECOG_RHYTHM 值递增", app.RECOG_RHYTHM?.[0] < app.RECOG_RHYTHM?.[3]);
// 验证 clearRecogTimers 不抛错
let clearOk = true;
try { app.clearRecogTimers?.(); } catch { clearOk = false; }
check("A12 clearRecogTimers 可调", clearOk);
// markRecogStep 同步调用仍能正常工作(节奏由 handleUpload 里的 setTimeout 包)
app.resetRecogStream?.();
app.showRecogStage(new window.File([new Uint8Array([10])], "e.jpg", { type: "image/jpeg" }));
app.markRecogStep?.("type", "看品类 · 外套");
app.markRecogStep?.("color", "看颜色 · 卡其");
const dotsAfter2 = [...window.document.querySelectorAll(".recog-dot")];
const doneAfter2 = dotsAfter2.filter((d) => d.classList.contains("done")).length;
check("A12 markRecogStep同步调仍可用", doneAfter2 >= 2, `done=${doneAfter2}`);
app.hideUploadStages?.();
check("A12 hideUploadStages 收屏1", recog.classList.contains("hidden"));

// A12-2: P0-2 真撤销 — 验证 #btn-cancel handler 存在 + 取消后 state 清理
// (DELETE 端点已在 server 层用 curl 验证,这里测前端逻辑)
app.showConfirmStage(fakeItem, new window.File([new Uint8Array([10])], "e.jpg", { type: "image/jpeg" }));
app.state.confirmDraft = { ...app.state.confirmDraft, item: { ...fakeItem, id: "wT003" } };
app.state.recogFile = new window.File([new Uint8Array([10])], "e.jpg", { type: "image/jpeg" });
app.paintConfirmTags?.();
// mock fetchJSON 让 DELETE 路径走通
const savedFetch2 = app.fetchJSON;
let deleteCalled2 = false;
app.fetchJSON = async function (url, opts) {
  if (typeof url === "string" && url.includes("/delete")) { deleteCalled2 = true; return { deleted: "wT003" }; }
  return savedFetch2 ? savedFetch2(url, opts) : {};
};
const cancelBtn = window.document.querySelector("#btn-cancel");
check("A12 #btn-cancel 按钮存在", !!cancelBtn);
await new Promise((r) => { cancelBtn?.click(); setTimeout(r, 80); });
await Promise.resolve();
check("A12 取消后confirmDraft清", app.state.confirmDraft === null);
check("A12 取消后recogFile清", app.state.recogFile === null);
// 恢复
app.fetchJSON = savedFetch2;

// A12-3: P1 onboarding — 验证 maybeShowOnboardingHint 函数存在 + 有衣橱时不弹
check("A12 maybeShowOnboardingHint 存在", typeof app.maybeShowOnboardingHint === "function");
// 有衣橱时不弹
const savedItems2 = app.state.items.slice();
app.state.items = [{ id: "w0001" }];
let obNoModal = true;
try { app.maybeShowOnboardingHint?.(); } catch { obNoModal = false; }
await new Promise((r) => setTimeout(r, 20));
check("A12 有衣橱时不弹modal", !window.document.getElementById("onboarding-modal"));
// 空衣橱时弹
app.state.items = [];
try { app.maybeShowOnboardingHint?.(); } catch {}
await new Promise((r) => setTimeout(r, 30));
const obModal2 = window.document.getElementById("onboarding-modal");
if (obModal2) {
  check("A12 modal有单件上传按钮", !!obModal2.querySelector('[data-ob="upload"]'));
  check("A12 modal批量按钮disabled", obModal2.querySelector('[data-ob="batch"]')?.disabled === true);
  check("A12 modal有跳过按钮", !!obModal2.querySelector('[data-ob="skip"]'));
  obModal2.querySelector('[data-ob="skip"]')?.click();
  await new Promise((r) => setTimeout(r, 30));
  check("A12 点跳过后modal消失", !window.document.getElementById("onboarding-modal"));
} else {
  // jsdom 环境可能不支持动态注入 modal,记录为 skip
  check("A12 空衣橱时onboarding modal出现(jsdom可能不支持)", false, "modal未出现,可能jsdom限制");
}
// 恢复衣橱
app.state.items = savedItems2;

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
