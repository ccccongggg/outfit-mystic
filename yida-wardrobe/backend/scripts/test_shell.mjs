// 外壳层 DOM 冒烟：node scripts/test_shell.mjs
// jsdom 装在哪由 JSDOM_HOME 指定（默认 managed node workspace）：
//   JSDOM_HOME="C:/Users/<you>/.workbuddy/binaries/node/workspace/node_modules" node scripts/test_shell.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const JSDOM_HOME =
  process.env.JSDOM_HOME || "C:/Users/Cccong/.workbuddy/binaries/node/workspace/node_modules";
let JSDOM;
try {
  ({ default: { JSDOM } } = await import(pathToFileURL(path.join(JSDOM_HOME, "jsdom", "lib", "api.js")).href));
} catch {
  ({ default: { JSDOM } } = await import("jsdom"));
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const WEB = path.join(ROOT, "web");

const html = fs
  .readFileSync(path.join(WEB, "index.html"), "utf-8")
  // jsdom 这里是 runScripts:"outside-only"，页面里的 <script> 本来就不会执行；
  // 仍然先摘掉，保证「本测试只跑外壳、不跑业务」这件事是显式的
  .replace(/<script\b[^>]*><\/script>/g, "");

const shellJs = fs.readFileSync(path.join(WEB, "shell.js"), "utf-8");

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1:8787/" });
const { window } = dom;
const { document } = window;

let ok = 0;
let total = 0;
const check = (name, cond, extra = "") => {
  total++;
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}${extra ? " → " + extra : ""}`);
  if (cond) ok++;
};

// 等 DOM 就绪（jsdom 解析是异步的）
await new Promise((resolve) => {
  if (document.readyState === "complete" || document.readyState === "interactive") return resolve();
  window.addEventListener("load", resolve);
});

// 执行外壳脚本
window.eval(shellJs);

const root = document.documentElement;
check("进入手机模式", root.classList.contains("phone-mode"));
check("外壳已挂载", !!document.querySelector(".phone-stage"));
check("机身/屏幕/视口齐全", !!document.querySelector(".phone") && !!document.querySelector(".phone-screen") && !!document.querySelector(".phone-viewport"));

const main = document.querySelector("main.shell");
check("业务 main 已搬进屏内", !!main && !!main.closest(".phone-viewport"));
const topbar = document.querySelector(".topbar");
check("顶栏已搬进屏内（导航交给底部 Tab）", !!topbar && !!topbar.closest(".phone-screen"));

// 业务侧的固定定位弹窗必须脱离 main.shell：main 是被 transform 拉成 400% 宽的横向轨道，
// 有 transform 的祖先会成为 position:fixed 的包含块，弹窗会按 4 倍屏宽铺开。
const modal = document.querySelector("#found-modal");
check(
  "候选弹窗已脱离 main 轨道（搬到 viewport 下）",
  !!modal && !!modal.closest(".phone-viewport") && !modal.closest("main.shell"),
  modal ? "父级 ." + modal.parentElement.className : "未找到弹窗"
);

const tabs = [...document.querySelectorAll(".phone-tab")];
// 2026-09-26 UI 调整：底栏不再是 .nav-btn 的镜像（那会把「风格」也带进来），
// 而是 shell.js 的 TAB_LAYOUT 三席 —— 侧位 衣橱/广场 + 居中放大的「拿主意」。
check(
  "底部 Tab = TAB_LAYOUT 三席（风格只在抽屉，不进底栏）",
  tabs.map((t) => t.dataset.view).join("/") === "wardrobe/home/plaza",
  tabs.map((t) => t.dataset.view).join("/")
);
check(
  "Tab 文案正确",
  tabs.map((t) => t.textContent.trim()).join("/") === "衣橱/拿主意/广场",
  tabs.map((t) => t.textContent.trim()).join("/")
);

// 抽屉和灰卡卡片同样是 position:fixed，必须一起脱离 main 轨道
for (const [sel, name] of [["#drawer", "抽屉"], ["#stub-sheet", "灰卡卡片"]]) {
  const n = document.querySelector(sel);
  check(
    `${name}已脱离 main 轨道`,
    !!n && !!n.closest(".phone-viewport") && !n.closest("main.shell"),
    n ? "父级 ." + n.parentElement.className : "未找到"
  );
}

// 模拟业务切页（app.js switchView 的真实行为：切 .nav-btn active + 写 dataset.view）。
// 2026-09-26 15:10 废除位置轨道后，dataset.view 是唯一真相源：外壳靠 .nav 的
// class MutationObserver 触发 syncIndex，再读 dataset.view 定高亮；--phone-i 不再写。
const navBtns = [...document.querySelectorAll(".nav-btn")];
navBtns.forEach((b) => b.classList.remove("active"));
navBtns[1].classList.add("active");
document.documentElement.dataset.view = navBtns[1].dataset.view;
await new Promise((r) => setTimeout(r, 30));
check("轨道已废除：--phone-i 不再写", main.style.getPropertyValue("--phone-i") === "", `--phone-i=${main.style.getPropertyValue("--phone-i")}`);
// 高亮要按 dataset.view 找到对应 Tab，不能按下标 —— TAB_LAYOUT 重排后
// tabs 顺序（衣橱/拿主意/广场）与 .nav-btn 顺序（拿主意/衣柜/广场/风格）不再对齐。
{
  const expectTab = tabs.find((t) => t.dataset.view === navBtns[1].dataset.view);
  check(
    "底部 Tab 高亮同步（dataset.view 为真相源）",
    !!expectTab && expectTab.classList.contains("active") && !tabs.some((t) => t !== expectTab && t.classList.contains("active")),
    `view=${navBtns[1].dataset.view} active=${tabs.filter((t) => t.classList.contains("active")).map((t) => t.dataset.view).join(",") || "无"}`
  );
}

// 子流程视图（塔罗等）不属于任何 Tab：不高亮
navBtns.forEach((b) => b.classList.remove("active"));
document.documentElement.dataset.view = "tarot";
await new Promise((r) => setTimeout(r, 30));
check("子流程视图不高亮任何 Tab", !tabs.some((t) => t.classList.contains("active")));
navBtns[1].classList.add("active");
document.documentElement.dataset.view = navBtns[1].dataset.view;
await new Promise((r) => setTimeout(r, 30));

// 灵动岛 / Toast 可调用
window.PhoneShell.island("测试通知");
window.PhoneShell.toast("测试 toast");
check("灵动岛可展开", document.querySelector(".phone-island").classList.contains("open"));
check("Toast 可显示", document.querySelector(".phone-toast").classList.contains("show"));

// 切回网页模式，节点应回到 body
window.PhoneShell.disable();
check("退出后移除 phone-mode", !root.classList.contains("phone-mode"));
check("退出后 main 回到 body", main.parentElement === document.body);
check("退出后外壳已卸载", !document.querySelector(".phone-stage"));
check("退出后出现浮动入口", !!document.querySelector(".phone-toggle.float"));
check(
  "退出后候选弹窗放回业务 DOM（不随外壳被删）",
  !!modal && !!modal.closest("main.shell") && document.body.contains(modal),
  modal ? "父级 ." + modal.parentElement.className : "丢失"
);

console.log(`\n${ok}/${total} 通过`);
process.exit(ok === total ? 0 : 1);
