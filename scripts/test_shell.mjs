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
  // jsdom 不执行 ES module，移除 app.js（业务逻辑不在本测试范围）
  .replace(/<script type="module"[^>]*><\/script>/, "");

const shellJs = fs.readFileSync(path.join(WEB, "shell.js"), "utf-8");

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1:8787/" });
const { window } = dom;
const { document } = window;

let ok = 0;
const check = (name, cond, extra = "") => {
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
check("底部 Tab 数量 = 导航项数", tabs.length === document.querySelectorAll(".nav-btn").length, `${tabs.length} 个`);
check("Tab 文案正确", tabs.map((t) => t.textContent.trim()).join("/") === "衣橱/风格/入口/结果", tabs.map((t) => t.textContent.trim()).join("/"));

// 模拟业务切页（app.js 的 switchView 行为：先清后加），外壳应自动同步轨道与 Tab
const navBtns = [...document.querySelectorAll(".nav-btn")];
navBtns.forEach((b) => b.classList.remove("active"));
navBtns[1].classList.add("active");
await new Promise((r) => setTimeout(r, 30));
const idx = main.style.getPropertyValue("--phone-i");
check("MutationObserver 同步轨道下标", idx === "1", `--phone-i=${idx}`);
check("底部 Tab 高亮同步", tabs[1].classList.contains("active"));

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

console.log(`\n${ok}/17 通过`);
process.exit(ok === 17 ? 0 : 1);
