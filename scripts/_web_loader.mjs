// scripts/_web_loader.mjs —— 在测试宿主里按依赖顺序加载 web/ 下的前端脚本
//
// 背景：web/*.js 原本是 ES module，2026-09-25 改成经典脚本 + window.Outfit 命名空间。
// 改因：Chrome/Edge 在 file:// 下禁止加载 <script type="module">（CORS，origin 为 null），
//       双击 index.html 时 app.js 根本不执行 —— 页面能看、点了没反应。
// 因此测试也不再 `import`，而是在宿主里 eval 同样的文件，顺带把真实的加载顺序也测进去
// （顺序错了 NS.require 会当场抛错，而不是留一个点了没反应的页面）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web");

/** 依赖顺序，必须与 web/index.html 里的 <script defer> 顺序一致 */
export const WEB_FILES = [
  "safe-storage.js", // 无依赖，最先（file:// 下 localStorage 会抛，先备好安全读写）
  "vocab.js",
  "oracle-data.js",
  "busy.js",
  "engine.js",
  "oracle.js",
  "data/offline.js", // 离线数据快照：app.js 之前
  "app.js",
];

function read(f) {
  return fs.readFileSync(path.join(WEB, f), "utf-8");
}

/**
 * 在 jsdom window 里跑（代码与 DOM 同一个域）。
 * @returns {object} window.Outfit —— 前端各模块挂在它上面的公共名
 */
export function loadWebIntoWindow(win, files = WEB_FILES) {
  for (const f of files) win.eval(read(f));
  return win.Outfit;
}

/**
 * 在 Node 全局里跑（DOM 由外部镜像到 globalThis 时用得了，比如 jsdom 的
 * runScripts:"outside-only" + 手动把 window.document 拷到 globalThis）。
 * 没有 window 时把 window 指回 globalThis，纯逻辑测试（engine）就不必起 jsdom。
 * @returns {object} window.Outfit
 */
export function loadWebIntoNode(files = WEB_FILES) {
  if (!globalThis.window) globalThis.window = globalThis;
  const geval = eval; // 间接 eval → 在全局作用域执行，和 ESM 顶层变量解析方式一致
  for (const f of files) geval(read(f));
  return globalThis.window.Outfit;
}

/** 只加载引擎（不碰 DOM）：test_engine 用 */
export function loadEngine() {
  return loadWebIntoNode(["vocab.js", "engine.js"]);
}
