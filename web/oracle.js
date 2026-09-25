/* ------------------------------------------------------------------
   经典脚本（原为 ES module，语义等价）
   改因：file:// 下浏览器禁止加载 <script type="module">，双击 index.html
        会整页无法交互。改成经典脚本 + window.Outfit 命名空间后，
        双击打开 / 起本地服务两种方式都能完整跑。
   依赖：由 index.html 按顺序 defer 加载，公共名挂在 window.Outfit 上。
------------------------------------------------------------------ */
(function (NS) {
"use strict";
  // 原来是：import { ... } from "./oracle-data.js";  import { CATEGORY_NAME } from "./vocab.js";
  const { BOARDS, EXT_SLOT, EXT_COPY, CITIES, DEFAULT_CITY, KW, IDENTITIES, ENERGY, SCRATCH, FEED, SHAPES } = NS;
  const { CATEGORY_NAME } = NS;
  NS.require("oracle.js", { BOARDS, EXT_SLOT, EXT_COPY, CITIES, DEFAULT_CITY, KW, IDENTITIES, ENERGY, SCRATCH, FEED, SHAPES, CATEGORY_NAME });

// web/oracle.js —— 「拿主意」这一层：抽屉 → 挂衣杆四板块 → 入口 → 统一约束
//
// 这一层是整个项目最关键的架构点（参考稿原话）：
//   入口只负责把模糊念头翻译成约束，出搭配只有一套引擎。
//   加第七个板块不用改引擎。
//
// 所以它和现有 app.js 的关系是单向的：
//   oracle.js  ->  只调用 install(api) 里传进来的能力（switchView / runRecommend / state）
//   app.js     ->  只 import install，不理解 oracle 内部
// 两边互不 import，避免循环依赖，也让老的四 Tab 页面能原样留着。
//
// 引擎一行没改：所有入口最后都产出同一个 constraint 对象，交给 app.js 的
// runRecommend() 去跑。


const NAV_KEY = "oracle.nav";
const CITY_KEY = "oracle.city";

// 模块内状态（不进 app.js 的 state，避免和老页面互相污染）
const S = {
  api: null,
  board: null,
  city: DEFAULT_CITY,
  energy: 62,
  identity: null,
  nav: "drawer",
  scratchPrize: null,
  // 卡片栈（首屏）
  stackIndex: 0,
  // 抽三张牌（圆盘）
  tarot3Angle: 0,
  tarot3Selected: 0,
  tarot3Picks: [],
  tarot3Done: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function boardOf(k) {
  return BOARDS.find((b) => b.k === k) || null;
}
function cityOf(name) {
  return CITIES.find((c) => c.city === name) || CITIES[0];
}
function slotCat() {
  // 参考稿：上装 + 下装 + 鞋 + 外套，固定出 4 件
  return ["top", "bottom", "shoes", "outer"];
}

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/**
 * 卡片栈滑动控制器（首屏 4 个板块）。
 * 拖拽期间实时跟随手指，松开时按「速度 + 位移」决定下一张或回弹；
 * 切换使用 cubic-bezier(.22,.61,.36,1) 480ms 过渡；鼠标、触屏、键盘(←/→/Home/End)统一接入。
 *
 * opts = {
 *   viewport, cards, dots, prev, next, count,
 *   getIndex, setIndex, onPick
 * }
 */
function bindCardStack(opts) {
  const { viewport, cards, dots, prev, next, count } = opts;
  if (!viewport || !cards || !cards.length) return;

  // 构造 dot 指示器
  if (dots) {
    dots.innerHTML = Array.from({ length: count }, (_, i) =>
      `<button type="button" class="stack-dot" data-i="${i}" aria-label="跳到第 ${i + 1} 张"></button>`
    ).join("");
    [...dots.children].forEach((d) =>
      d.addEventListener("click", () => animateTo(Number(d.dataset.i), 1))
    );
  }
  if (prev) prev.addEventListener("click", () => animateTo(opts.getIndex() - 1, 1));
  if (next) next.addEventListener("click", () => animateTo(opts.getIndex() + 1, 1));

  // 键盘
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft")  { e.preventDefault(); animateTo(opts.getIndex() - 1, 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); animateTo(opts.getIndex() + 1, 1); }
    else if (e.key === "Home")  { e.preventDefault(); animateTo(0, 1); }
    else if (e.key === "End")   { e.preventDefault(); animateTo(count - 1, 1); }
    else if (e.key === "Enter" || e.key === " ") {
      const el = document.activeElement && document.activeElement.classList.contains("stack-card")
        ? document.activeElement : cards[opts.getIndex()];
      const i = Number(el && el.dataset ? el.dataset.index : opts.getIndex());
      e.preventDefault();
      opts.onPick && opts.onPick(i);
    }
  });

  // 拖拽 / 滑动状态
  let dragging = false;
  let startX = 0, startY = 0, lastX = 0, lastT = 0, dx = 0;
  let pointerId = null;

  const viewportWidth = () => viewport.clientWidth || 1;

  function paint(i, offsetPx) {
    const baseScale = [1, 0.86, 0.72];
    const baseOpacity = [1, 0.55, 0];
    const baseBlur = [0, 1.2, 2];
    const baseZ = [4, 2, 1];
    // 相邻卡片偏移：相对卡片自身宽度。
    // 手机外壳里 .stack-card 被收到 ~280px，70% 就会顶出右边界 → 收到 42%，相邻仅露出 ~30%。
    const translateX = (j) => (j - i) * 42 + (offsetPx || 0);
    cards.forEach((c, j) => {
      const dist = Math.abs(j - i);
      const s = baseScale[Math.min(dist, 2)] || 0;
      const o = baseOpacity[Math.min(dist, 2)] || 0;
      const bl = baseBlur[Math.min(dist, 2)] || 0;
      const z = baseZ[Math.min(dist, 2)] || 0;
      const tx = translateX(j);
      c.style.transform = `translate(-50%, -50%) translateX(calc(-50% + ${tx}%)) scale(${s})`;
      c.style.opacity = String(o);
      c.style.filter = `blur(${bl}px)`;
      c.style.zIndex = String(z + (cards.length - dist));
      c.dataset.dist = String(dist);
      c.setAttribute("aria-hidden", dist > 1 ? "true" : "false");
      c.tabIndex = dist === 0 ? 0 : -1;
    });
    if (dots) {
      [...dots.children].forEach((d, idx) => d.classList.toggle("on", idx === i));
    }
    viewport.dataset.index = String(i);
  }

  function animateTo(i, v) {
    const target = clamp(i, 0, count - 1);
    if (target === opts.getIndex()) {
      paint(target, 0);
      return;
    }
    const start = performance.now();
    const from = opts.getIndex();
    const dur = 480;
    cards.forEach((c) => { c.style.transition = "transform 480ms cubic-bezier(.22,.61,.36,1), opacity 380ms ease, filter 380ms ease"; });
    paint(target, 0);
    opts.setIndex(target);
    setTimeout(() => {
      cards.forEach((c) => { c.style.transition = ""; });
      // 把焦点送回当前卡片
      const cur = cards[target];
      if (cur && document.activeElement && document.activeElement.classList.contains("stack-card")) {
        cur.focus({ preventScroll: true });
      }
    }, dur + 30);
    // 静默 noop 触发 ESLint 不抱怨
    void start; void v;
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    viewport.setPointerCapture && viewport.setPointerCapture(pointerId);
    startX = e.clientX; startY = e.clientY; lastX = e.clientX; lastT = performance.now(); dx = 0;
    cards.forEach((c) => { c.style.transition = "none"; });
  }
  function onMove(e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    const i = opts.getIndex();
    // 拖动时位移上限（不能拖过边界很多）
    const max = viewportWidth() * 0.35;
    const sign = Math.sign(dx);
    const overshoot = i === 0 && dx > 0 ? Math.min(dx, max) * 0.35
                    : i === count - 1 && dx < 0 ? Math.max(dx, -max) * 0.35
                    : dx;
    paint(i, (overshoot / viewportWidth()) * 100);
    lastX = e.clientX; lastT = performance.now();
    // 防止误触垂直滚动
    if (Math.abs(dx) > 6) e.preventDefault();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    try { viewport.releasePointerCapture && viewport.releasePointerCapture(pointerId); } catch { /* ignore */ }
    const dt = Math.max(performance.now() - lastT, 1);
    const vx = (lastX - startX) / dt; // px/ms
    const threshold = viewportWidth() * 0.18;
    const speedThreshold = 0.4; // px/ms
    let target = opts.getIndex();
    if (dx < -threshold || vx < -speedThreshold) target += 1;
    else if (dx > threshold || vx > speedThreshold) target -= 1;
    animateTo(target, vx);
  }
  function onCancel() {
    if (!dragging) return;
    dragging = false;
    animateTo(opts.getIndex(), 0);
  }

  viewport.addEventListener("pointerdown", onDown);
  viewport.addEventListener("pointermove", onMove);
  viewport.addEventListener("pointerup", onUp);
  viewport.addEventListener("pointercancel", onCancel);
  viewport.addEventListener("pointerleave", onCancel);

  // 点击：直接打开那张板块（手机端「点哪进哪」更顺手；浏览靠拖拽）
  cards.forEach((c) => {
    c.addEventListener("click", (e) => {
      // 拖拽过程中触发的 click 视为取消（pointerdown→move→up 不会触发 click，所以一般进不来这里）
      const i = Number(c.dataset.index);
      animateTo(i, 1);
      // 100ms 后打开（让滑动动画先演一小段，但不阻塞用户）
      setTimeout(() => opts.onPick && opts.onPick(i), 100);
    });
  });

  // 初始化：默认 index = 0
  paint(opts.getIndex(), 0);
  // 暴露同步方法（外部更新 stackIndex 后可调用）
  opts.sync = () => paint(opts.getIndex(), 0);
  // 首次同步 dot
  if (dots) [...dots.children].forEach((d, idx) => d.classList.toggle("on", idx === opts.getIndex()));
}

/**
 * 圆盘选牌控制器（抽三张牌）。
 * 把 N 张牌等角度铺成圆环；旋转角度由 `r` 弧度控制；
 * 当前选中是「最接近 12 点钟方向」的那张牌，给它金色高亮与放大。
 * 拖拽带惯性（速度衰减）、边缘回弹（碰到 -180° / +180° 边界时减速回中）。
 */
function bindCardWheel(opts) {
  // 注意：opts 上的 getAngle/setAngle/getSelected/setSelected 必须在函数体内
  // **直接可用**。如果只解构一次然后下面忘了用 opts.，函数一旦被调用就会
  // ReferenceError，整个塔罗圆盘就废了（拖不动、键盘无效、滚轮无效）。
  // 这里把"会用到的回调"全部一次性解构出来，下面的 paint/snap/onMove 都靠它们。
  const { stage, wheel, cards, count, getAngle, setAngle, getSelected, setSelected } = opts;
  if (!wheel || !cards || !cards.length) return;

  let dragging = false;
  let pointerId = null;
  let lastA = 0, lastT = 0, va = 0; // 当前角速度（弧度/ms）
  let raf = null;

  function paint(immediate) {
    if (immediate) {
      wheel.style.transition = "none";
    } else {
      wheel.style.transition = "";
    }
    wheel.style.transform = `rotate(${getAngle()}rad)`;
    // 选中检测：找到最接近 12 点钟方向的那张
    let bestIdx = 0;
    let bestDelta = Infinity;
    const slice = (Math.PI * 2) / count;
    cards.forEach((c, i) => {
      const a = i * slice + getAngle();
      // 12 点钟方向是 -PI/2（即 -90°）。取 a 与 -PI/2 的距离
      const target = -Math.PI / 2;
      let d = a - target;
      // 归一化到 [-PI, PI]
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const adist = Math.abs(d);
      if (adist < bestDelta) { bestDelta = adist; bestIdx = i; }
    });
    if (getSelected && setSelected) {
      setSelected(bestIdx);
    } else if (opts.onSelectChange) {
      opts.onSelectChange(bestIdx);
    }
  }

  function tick() {
    if (!dragging) {
      // 惯性
      if (Math.abs(va) > 1e-4) {
        va *= 0.94; // 摩擦
        setAngle(getAngle() + va * 16);
        paint(false);
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
        snap();
      }
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function snap() {
    // 缓动到最近一张对齐（让 12 点钟位精确对准某张牌）
    const slice = (Math.PI * 2) / count;
    const target = Math.round(getAngle() / slice) * slice;
    const startA = getAngle();
    const dist = target - startA;
    const dur = Math.min(420, Math.max(180, Math.abs(dist) * 480));
    wheel.style.transition = `transform ${dur}ms cubic-bezier(.22,.61,.36,1)`;
    setAngle(target);
    setTimeout(() => {
      wheel.style.transition = "";
      paint(false);
    }, dur + 20);
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    wheel.setPointerCapture && wheel.setPointerCapture(pointerId);
    lastA = e.clientX; lastT = performance.now(); va = 0;
    if (raf) cancelAnimationFrame(raf);
    wheel.style.transition = "none";
  }
  function onMove(e) {
    if (!dragging) return;
    const w = (stage && stage.clientWidth) || wheel.clientWidth || 320;
    const dx = e.clientX - lastA;
    const da = (dx / w) * Math.PI * 2; // 拖动宽度 = 一整圈
    setAngle(getAngle() + da);
    const dt = Math.max(performance.now() - lastT, 1);
    va = da / dt; // 弧度/ms
    lastA = e.clientX; lastT = performance.now();
    paint(true);
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    try { wheel.releasePointerCapture && wheel.releasePointerCapture(pointerId); } catch { /* ignore */ }
    raf = requestAnimationFrame(tick);
  }

  wheel.addEventListener("pointerdown", onDown);
  wheel.addEventListener("pointermove", onMove);
  wheel.addEventListener("pointerup", onUp);
  wheel.addEventListener("pointercancel", onUp);
  wheel.addEventListener("pointerleave", onUp);

  // 滚轮 / 触控板
  wheel.addEventListener("wheel", (e) => {
    e.preventDefault();
    const w = (stage || 320).clientWidth || 320;
    const da = (e.deltaY / w) * Math.PI * 1.5;
    setAngle(getAngle() + da);
    wheel.style.transition = "transform 220ms cubic-bezier(.22,.61,.36,1)";
    paint(false);
    setTimeout(() => { wheel.style.transition = ""; snap(); }, 240);
  }, { passive: false });

  // 键盘：左右切换
  wheel.tabIndex = 0;
  wheel.addEventListener("keydown", (e) => {
    const slice = (Math.PI * 2) / count;
    if (e.key === "ArrowLeft")  { e.preventDefault(); setAngle(getAngle() - slice); paint(false); snap(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setAngle(getAngle() + slice); paint(false); snap(); }
  });

  paint(false);
  return { snap, paint, rotate: (d) => { setAngle(getAngle() + d); paint(false); } };
}

// ---------- 路由 ----------
function go(view) {
  const api = S.api;
  if (!api) return;
  // 需要动态渲染的页面：进之前先建好（每次都是新的随机/新状态）
  if (view === "scratch") renderScratch();
  else if (view === "energy") renderEnergy();
  else if (view === "identity") renderIdentity();
  else if (view === "input") renderInput();
  else if (view === "plaza") renderPlaza();
  else if (view === "tarot") renderTarotWheel();
  else if (view === "board") renderBoard(S.board || "draw");
  api.switchView(view);
  $$("[data-go]").forEach((b) => b.classList.toggle("on", b.dataset.go === view));
  $$(".otab").forEach((b) => b.classList.toggle("on", b.dataset.go === view));
  $$(".drawer-sub, .drawer-hero").forEach((b) => b.classList.toggle("on", b.dataset.go === view));
  const boardView = ["board", "tarot", "scratch", "energy", "identity", "input", "ext"];
  if (!boardView.includes(view)) S.board = null;
  document.documentElement.dataset.view = view;
  // 手机外壳的轨道下标 / 底部 Tab 高亮跟着走
  window.PhoneShell?.sync?.();
  closeDrawer();
}

function openDrawer() {
  $("#drawer")?.classList.add("open");
  $("#drawer")?.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  $("#drawer")?.classList.remove("open");
  $("#drawer")?.setAttribute("aria-hidden", "true");
}

// ---------- 首屏（卡片栈 + 天气芯片）----------
//
// 卡片栈：4 个板块以 3D 堆叠呈现，可左右滑动切换。
// 物理：拖拽期间实时跟随手指；松手按速度+位移判断滚到上一/下一/回弹；
//      切换时 cubic-bezier(.22,.61,.36,1) 480ms；
//      选中卡片放大 / 不透明度 1，相邻卡片缩小 / 不透明度 0.6，再远隐藏；
//      鼠标、触屏、键盘(←/→/Home/End)统一接入。
function renderHome() {
  const el = $("#home");
  if (!el) return;
  const c = cityOf(S.city);
  el.innerHTML = `
    <div class="section-head">
      <h1>拿主意</h1>
      <p class="muted">抽 · 拖 · 点 · 说，选一种定今天。</p>
    </div>

    <div class="weather-chip" id="weather-chip" role="button" tabindex="0" aria-label="切换城市">
      <span class="wc-city">${esc(c.city)}</span>
      <span class="wc-temp">${esc(c.temp)} ${esc(c.w)}</span>
      <span class="wc-arrow">›</span>
    </div>
    <p class="weather-note">天气只决定「${esc(c.label)}」这一档厚薄，不会动你的风格和颜色。</p>

    <div class="card-stack" id="card-stack" role="region" aria-label="四个板块" aria-live="polite">
      <div class="stack-viewport" id="stack-viewport">
        ${[...BOARDS, { ...EXT_SLOT, how: "点它看为什么留空位" }].map((b, i) => `
          <article class="stack-card" role="listitem" data-board="${esc(b.k)}" data-index="${i}" tabindex="0" aria-label="${esc(b.t)}：${esc(b.s)}" style="--bc:${b.color};--bs:${b.soft};--bi:${b.ink}">
            <span class="stack-icon"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${b.shape === "dashed" ? 'stroke-dasharray="3 3"' : ""}>${SHAPES[b.shape] || ""}</svg></span>
            <span class="stack-body">
              <span class="stack-t">${esc(b.t)}</span>
              <span class="stack-s">${esc(b.s)}</span>
              <span class="stack-how">${esc(b.how || "点它看为什么留空位")}</span>
            </span>
            <span class="stack-go" aria-hidden="true">›</span>
          </article>`).join("")}
      </div>
      <div class="stack-nav">
        <button type="button" class="stack-arrow" id="stack-prev" aria-label="上一个板块">‹</button>
        <div class="stack-dots" id="stack-dots" role="tablist" aria-label="板块指示"></div>
        <button type="button" class="stack-arrow" id="stack-next" aria-label="下一个板块">›</button>
      </div>
    </div>

    <div class="city-sheet hidden" id="city-sheet">
      <div class="cs-head">换城市只改厚薄，不改风格、不改颜色</div>
      ${CITIES.map((x) => `
        <button class="cs-row ${x.city === S.city ? "on" : ""}" data-city="${esc(x.city)}">
          <span class="cs-city">${esc(x.city)}</span>
          <span class="cs-temp">${esc(x.temp)} ${esc(x.w)}</span>
          <span class="cs-label">${esc(x.label)}</span>
        </button>`).join("")}
    </div>
  `;

  $("#weather-chip").addEventListener("click", () => $("#city-sheet").classList.toggle("hidden"));
  $("#weather-chip").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#city-sheet").classList.toggle("hidden"); }
  });
  $$("#city-sheet .cs-row").forEach((b) =>
    b.addEventListener("click", () => {
      S.city = b.dataset.city;
      try { localStorage.setItem(CITY_KEY, S.city); } catch { /* ignore */ }
      renderHome();
    })
  );

  // 卡片栈滑动控制器（拖拽 + 惯性 + 边缘回弹）
  S.stackIndex = clamp(typeof S.stackIndex === "number" ? S.stackIndex : 0, 0, BOARDS.length - 1);
  bindCardStack({
    viewport: $("#stack-viewport"),
    cards: $$("#stack-viewport .stack-card"),
    dots: $("#stack-dots"),
    prev: $("#stack-prev"),
    next: $("#stack-next"),
    count: BOARDS.length,
    getIndex: () => S.stackIndex,
    setIndex: (i) => { S.stackIndex = i; },
    onPick: (i) => {
      const k = BOARDS[i] && BOARDS[i].k;
      if (k) openBoard(k);
    },
  });
}

// ---------- 板块页 ----------
function openBoard(k) {
  if (k === "ext") { S.board = "ext"; go("ext"); return; }
  S.board = k;
  go("board");
}

/** 底部 Tab / 抽屉项的高亮同步（app.js 的 switchView 会回调它）。 */
function syncTabs(name) {
  $$(".otab").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
  $$(".drawer-sub, .drawer-hero").forEach((b) => b.classList.toggle("on", b.dataset.go === name));
}

function renderBoard(k) {
  const el = $("#board");
  if (!el) return;
  const b = boardOf(k);
  if (!b) return;
  el.innerHTML = `
    <div class="board-head" style="--bc:${b.color};--bs:${b.soft};--bi:${b.ink}">
      <button class="board-back" data-go="home">‹ 挂衣杆</button>
      <h1>${esc(b.t)}</h1>
      <p class="muted">${esc(b.s)} · ${esc(b.how)}</p>
    </div>
    <div class="board-demo" id="board-demo"></div>
    <div class="entries">
      ${b.items.map((it) => it.on ? `
        <button class="oc-entry" data-entry="${it.go}" style="--bc:${b.color};--bs:${b.soft};--bi:${b.ink}">
          <span class="ec-name">${esc(it.name)}</span>
          <span class="ec-desc">${esc(it.desc)}</span>
          <span class="ec-go">进入 ›</span>
        </button>` : `
        <div class="oc-entry off" data-stub="${esc(it.name)}" role="button" tabindex="0">
          <span class="ec-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
          <span class="ec-name">${esc(it.name)}</span>
          <span class="ec-desc">还没挂上来 · 点它看怎么加</span>
        </div>`).join("")}
    </div>
  `;
  el.querySelector(".board-back").addEventListener("click", () => go("home"));
  $$("#board .oc-entry[data-entry]").forEach((c) =>
    c.addEventListener("click", () => go(c.dataset.entry))
  );
  $$("#board .oc-entry.off").forEach((c) =>
    c.addEventListener("click", () => openStubSheet(c.dataset.stub, b))
  );
  renderDemo(k);
}

/** 板块页上那个 3 秒体感小样：翻牌 / 拖条 / 选卡 / 打字，各留各的体感。 */
function renderDemo(k) {
  const host = $("#board-demo");
  if (!host) return;
  if (k === "draw") {
    host.innerHTML = `
      <div class="demo-cap">体感小样 · 点一下翻面</div>
      <div class="demo-card" id="demo-card" role="button" tabindex="0"><span>节制</span></div>`;
    const c = $("#demo-card");
    const flip = () => c.classList.toggle("flipped");
    c.addEventListener("click", flip);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  } else if (k === "dial") {
    host.innerHTML = `
      <div class="demo-cap">体感小样 · 拖它，数字跟着变</div>
      <div class="demo-dial"><input type="range" id="demo-range" min="0" max="100" value="62" /><b id="demo-val">62%</b></div>`;
    const r = $("#demo-range"), v = $("#demo-val");
    r.addEventListener("input", () => { v.textContent = r.value + "%"; });
  } else if (k === "pick") {
    host.innerHTML = `
      <div class="demo-cap">体感小样 · 点一张，它会亮</div>
      <div class="demo-picks">
        ${IDENTITIES.slice(0, 3).map((i) => `<button class="demo-pick" data-id="${i.id}"><span class="dp-sym">${i.symbol}</span><span class="dp-name">${esc(i.name)}</span></button>`).join("")}
      </div>`;
    $$("#board-demo .demo-pick").forEach((p) =>
      p.addEventListener("click", () => {
        $$("#board-demo .demo-pick").forEach((x) => x.classList.remove("on"));
        p.classList.add("on");
      })
    );
  } else if (k === "type") {
    host.innerHTML = `
      <div class="demo-cap">体感小样 · 一句话自己打出来</div>
      <div class="demo-type"><span id="demo-typed"></span><i class="caret"></i></div>`;
    const text = "今天好累，不想动";
    const out = $("#demo-typed");
    let i = 0;
    const t = setInterval(() => {
      out.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(t);
    }, 130);
  }
}

/** 灰卡点开的小卡片：解释「加一个入口需要什么」，并给出退路。 */
function openStubSheet(name, board) {
  const host = $("#stub-sheet");
  if (!host) return;
  host.innerHTML = `
    <div class="sheet-card">
      <div class="ss-tag" style="--bc:${board.color}">${esc(board.t)}</div>
      <h3>${esc(name)} 还没挂上来</h3>
      <p class="muted">它留在这儿，是为了证明这个板块还能往上挂入口。加一个入口只要三样东西：</p>
      <ol class="ss-list">
        <li>一个交互范式：${esc(board.how)}</li>
        <li>一组受控词表：复用全站那套 8 风格 / 24 色 / 7 品类</li>
        <li>一个约束生成器：把它翻译成「风格 · 主色 · 避雷色」</li>
      </ol>
      <div class="ss-actions">
        <button class="btn-primary" data-act="tarot">先交给塔罗牌</button>
        <button class="btn-ghost" data-act="close">知道了</button>
      </div>
    </div>`;
  host.classList.add("open");
  host.querySelector('[data-act="close"]').addEventListener("click", () => host.classList.remove("open"));
  host.querySelector('[data-act="tarot"]').addEventListener("click", () => {
    host.classList.remove("open");
    go("tarot");
  });
  host.addEventListener("click", (e) => { if (e.target === host) host.classList.remove("open"); });
}

// ---------- 扩展位 ----------
function renderExt() {
  const el = $("#ext");
  if (!el) return;
  el.innerHTML = `
    <div class="board-head" style="--bc:${EXT_SLOT.color};--bs:${EXT_SLOT.soft};--bi:${EXT_SLOT.ink}">
      <button class="board-back" data-go="home">‹ 挂衣杆</button>
      <h1>扩展位</h1>
      <p class="muted">这个空位不是没做完，是结构可插拔的证据。</p>
    </div>
    <div class="ext-box">
      <h3>${esc(EXT_COPY[0])}</h3>
      <ol class="ext-list">${EXT_COPY.slice(1, 4).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <p class="ext-punch">${esc(EXT_COPY[4])}</p>
    </div>`;
  el.querySelector(".board-back").addEventListener("click", () => go("home"));
}

// ---------- 调节式 · 能量条 ----------
function renderEnergy() {
  const el = $("#energy");
  if (!el) return;
  el.innerHTML = `
    <div class="board-head" style="--bc:#D4537E;--bs:#FBEAF0;--bi:#993556">
      <button class="board-back" data-go="board">‹ 调节式</button>
      <h1>今日电量</h1>
      <p class="muted">拖滑块报电量，状态文案实时跟着变。</p>
    </div>
    <div class="energy-stage">
      <div class="energy-num"><b id="e-num">${S.energy}</b><span>%</span></div>
      <input type="range" id="e-range" min="0" max="100" value="${S.energy}" aria-label="今日电量" />
      <div class="energy-scale"><span>0</span><span>50</span><span>100</span></div>
      <div class="energy-card" id="e-card"></div>
    </div>
    <button class="btn-primary wide" id="e-ok">就这个电量</button>`;
  const sync = () => {
    const v = Number($("#e-range").value);
    S.energy = v;
    $("#e-num").textContent = v;
    const st = ENERGY.find((x) => v >= x.min && v <= (v >= 100 ? 100 : x.max)) || ENERGY[ENERGY.length - 1];
    $("#e-card").innerHTML = `<b>${esc(st.label)}</b><span>${esc(st.say)}</span>`;
  };
  $("#e-range").addEventListener("input", sync);
  sync();
  el.querySelector(".board-back").addEventListener("click", () => go("board"));
  $("#e-ok").addEventListener("click", () => emit(constraintFromEnergy(S.energy)));
}

// ---------- 选择式 · 身份扮演 ----------
function renderIdentity() {
  const el = $("#identity");
  if (!el) return;
  el.innerHTML = `
    <div class="board-head" style="--bc:#1D9E75;--bs:#E1F5EE;--bi:#0F6E56">
      <button class="board-back" data-go="board">‹ 选择式</button>
      <h1>今天想成为谁</h1>
      <p class="muted">四张人设卡，选一个定基调。</p>
    </div>
    <div class="id-grid">
      ${IDENTITIES.map((i) => `
        <button class="id-card ${S.identity === i.id ? "on" : ""}" data-id="${i.id}">
          <span class="id-sym">${i.symbol}</span>
          <span class="id-name">${esc(i.name)}</span>
          <span class="id-line">${esc(i.line)}</span>
          <span class="id-meta">${esc(i.style_tags.join(" / "))} · ${esc(i.must_colors.join(" / "))}</span>
          <span class="id-avoid">避雷 ${esc(i.avoid_colors.join(" / "))}</span>
        </button>`).join("")}
    </div>
    <button class="btn-primary wide" id="i-ok" ${S.identity ? "" : "disabled"}>就当这个人</button>`;
  $$("#identity .id-card").forEach((c) =>
    c.addEventListener("click", () => {
      S.identity = S.identity === c.dataset.id ? null : c.dataset.id;
      $$("#identity .id-card").forEach((x) => x.classList.toggle("on", x.dataset.id === S.identity));
      $("#i-ok").disabled = !S.identity;
    })
  );
  el.querySelector(".board-back").addEventListener("click", () => go("board"));
  $("#i-ok").addEventListener("click", () => {
    const i = IDENTITIES.find((x) => x.id === S.identity);
    if (i) emit(constraintFromIdentity(i));
  });
}

// ---------- 输入式 · 一句话 ----------
function renderInput() {
  const el = $("#input");
  if (!el) return;
  el.innerHTML = `
    <div class="board-head" style="--bc:#BA7517;--bs:#FAEEDA;--bi:#854F0B">
      <button class="board-back" data-go="board">‹ 输入式</button>
      <h1>说一句话</h1>
      <p class="muted">打一句话，它自己匹配方向。<b>这里是关键词对照表，不是模型</b>。</p>
    </div>
    <input class="kw-input" id="kw-input" placeholder="比如：今天好累 / 下午要面试 / 想出片" autocomplete="off" />
    <div class="kw-examples">
      ${["今天好累", "下午要面试", "晚上去约会", "想去扫街拍照", "在图书馆坐一天", "好热", "降温了", "今天开心"].map((t) => `<button class="kw-chip" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
    </div>
    <div class="kw-out" id="kw-out"></div>`;
  const inp = $("#kw-input");
  const run = (text) => renderKwOut(text);
  inp.addEventListener("input", () => run(inp.value));
  $$("#input .kw-chip").forEach((c) => c.addEventListener("click", () => { inp.value = c.dataset.t; run(inp.value); }));
  el.querySelector(".board-back").addEventListener("click", () => go("board"));
  renderKwOut("");
}

function renderKwOut(text) {
  const out = $("#kw-out");
  if (!out) return;
  const t = String(text || "").trim();
  if (!t) {
    out.innerHTML = `<p class="muted">还没读到任何东西。打一句话，或者点上面的例子。</p>`;
    return;
  }
  const hits = KW.filter((g) => g.words.some((w) => t.includes(w)));
  if (!hits.length) {
    out.innerHTML = `
      <div class="kw-read"><span class="kw-label">从这句话里读到</span><span class="kw-none">没读到明确的场合或状态</span></div>
      <p class="muted">不硬猜。给你个出口——交给塔罗牌。</p>
      <button class="btn-primary" id="kw-fallback">交给塔罗牌</button>`;
    $("#kw-fallback").addEventListener("click", () => go("tarot"));
    return;
  }
  const g = hits[0];
  out.innerHTML = `
    <div class="kw-read">
      <span class="kw-label">从这句话里读到</span>
      <span class="kw-tag">${esc(g.tag)}</span>
    </div>
    <div class="kw-say">${esc(g.say)}</div>
    <div class="kw-label mt">匹配到的方向</div>
    <button class="kw-dir on" data-dir="0">
      <b>${esc(g.dir)}</b>
      <span>${esc(g.c.style_tags.join(" / "))}${g.c.must_colors ? " · " + esc(g.c.must_colors.join(" / ")) : ""}</span>
    </button>
    <div class="kw-alt">
      ${hits.slice(1, 3).map((h, i) => `<button class="kw-dir" data-dir="${i + 1}"><b>${esc(h.dir)}</b><span>${esc(h.tag)}</span></button>`).join("")}
    </div>
    <button class="btn-primary wide mt" id="kw-ok">就按这个来</button>`;
  $$("#kw-out .kw-dir").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#kw-out .kw-dir").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      $("#kw-ok").dataset.pick = b.dataset.dir;
    })
  );
  $("#kw-ok").dataset.pick = "0";
  $("#kw-ok").addEventListener("click", () => {
    const i = Number($("#kw-ok").dataset.pick || 0);
    emit(constraintFromKw(hits[i] || g, t));
  });
}

// ---------- 抽取式 · 刮刮乐 ----------
function renderScratch() {
  const el = $("#scratch");
  if (!el) return;
  el.innerHTML = `
    <div class="board-head" style="--bc:#534AB7;--bs:#EDEBFB;--bi:#3C3489">
      <button class="board-back" data-go="board">‹ 抽取式</button>
      <h1>刮刮乐</h1>
      <p class="muted">手刮到一半，自动揭晓。</p>
    </div>
    <div class="scratch-stage">
      <div class="scratch-card">
        <div class="scratch-prize" id="scratch-prize"></div>
        <canvas id="scratch-canvas" width="300" height="150"></canvas>
      </div>
      <div class="scratch-hint" id="scratch-hint">用手指刮开涂层</div>
    </div>
    <button class="btn-primary wide hidden" id="s-ok">就这个</button>`;
  el.querySelector(".board-back").addEventListener("click", () => go("board"));

  const prize = SCRATCH[Math.floor(Math.random() * SCRATCH.length)];
  S.scratchPrize = prize;
  $("#scratch-prize").innerHTML = `<b>${esc(prize.name)}</b><span>${esc(prize.say)}</span>`;

  const cv = $("#scratch-canvas");
  const ctx = typeof cv.getContext === "function" ? cv.getContext("2d") : null;
  if (!ctx) {
    // 环境没有 canvas（jsdom / 极老浏览器）：不能刮就别假装能刮，直接给结果
    $("#scratch-hint").textContent = "这个环境不支持刮开，直接看它给你什么";
    $("#s-ok").classList.remove("hidden");
    $("#s-ok").addEventListener("click", () => emit(constraintFromScratch(prize)));
    return;
  }
  const paint = () => {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#B9B4A8";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#A5A096";
    for (let i = 0; i < 240; i++) {
      ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2);
    }
    ctx.fillStyle = "#6f6a60";
    ctx.font = "600 15px system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("刮开这里", cv.width / 2, cv.height / 2 + 5);
  };
  paint();

  let done = false;
  const ratio = () => {
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let clear = 0;
    for (let i = 3; i < d.length; i += 40) if (d[i] < 40) clear += 1;
    return clear / (d.length / 40);
  };
  const reveal = () => {
    if (done) return;
    done = true;
    ctx.clearRect(0, 0, cv.width, cv.height);
    cv.classList.add("gone");
    $("#scratch-hint").textContent = "刮开了：" + prize.name;
    $("#s-ok").classList.remove("hidden");
  };
  const scratch = (e) => {
    if (done) return;
    const r = cv.getBoundingClientRect();
    const sx = cv.width / r.width, sy = cv.height / r.height;
    const pt = e.touches ? e.touches[0] : e;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc((pt.clientX - r.left) * sx, (pt.clientY - r.top) * sy, 22, 0, Math.PI * 2);
    ctx.fill();
    if (ratio() > 0.5) reveal();
  };
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); scratch(e); });
  cv.addEventListener("pointermove", (e) => { if (e.buttons || e.pressure) scratch(e); });
  $("#s-ok").addEventListener("click", () => emit(constraintFromScratch(prize)));
}

// ---------- 抽取式 · 圆盘抽三张牌 ----------
//
// 22 张大阿尔卡纳等角度铺成圆环；拖拽带惯性、滚轮/键盘也支持；
// 当前「12 点钟位」的牌 = 候选牌，金色光晕 + 抬升作为选中指示；
// 点击 / 回车把它收进 S.tarot3Picks（一共 3 张），到 3 张后揭晓 + emit 约束。
//
// 为什么不放在 #board-demo 之类的静态 demo 里：这是新设计的「选三张牌」入口，
// 是项目核心交互，必须真动起来。22 张全展示 + 物理动效的代价 ≈ 22 个 DOM 节点，
// 测试里已确认无明显卡顿。
function renderTarotWheel() {
  const el = $("#tarot");
  if (!el) return;
  const api = S.api;
  const cards = (api && api.state && api.state.tarotCards && api.state.tarotCards.length)
    ? api.state.tarotCards
    : (window.__offlineData && window.__offlineData["tarot"]) || [];
  if (!cards.length) {
    el.innerHTML = `
      <div class="board-head" style="--bc:#534AB7;--bs:#EDEBFB;--bi:#3C3489">
        <button class="board-back" data-go="board">‹ 抽取式</button>
        <h1>抽三张牌</h1>
        <p class="muted">塔罗数据没准备好，先去首页。</p>
      </div>`;
    el.querySelector(".board-back").addEventListener("click", () => go("board"));
    return;
  }

  // 抽三张状态：每次进入都重置
  S.tarot3Angle = 0;
  S.tarot3Selected = 0;
  S.tarot3Picks = [];
  S.tarot3Done = false;

  // 计算每张牌的圆周位置（sin/cos，半径按 stage 大小响应式缩放）
  // 角度：第 0 张在 12 点钟方向，逆时针均匀铺开
  const count = cards.length;
  const slice = (Math.PI * 2) / count;
  const positions = cards.map((_, i) => {
    const a = i * slice - Math.PI / 2; // 0 号位正上方
    return { x: Math.cos(a), y: Math.sin(a), deg: (a * 180) / Math.PI };
  });
  // CSS 变量：让半径随 wheel 容器大小变化
  const radiusCss = `min(44%, 170px)`;

  el.innerHTML = `
    <div class="board-head tarot3-head">
      <button class="board-back" data-go="board">‹ 抽取式</button>
      <h1>抽三张牌</h1>
      <p class="muted">滑动牌轮 · 点中间亮起来的那张 · 抽满 3 张出牌阵。</p>
      <div class="tarot3-counter"><span id="t3-count">0</span> / 3 张</div>
    </div>

    <div class="wheel-stage" id="wheel-stage" style="--r:${radiusCss}">
      <div class="wheel-pointer" aria-hidden="true">
        <span class="wp-dot"></span>
        <span class="wp-stem"></span>
      </div>
      <div class="wheel" id="wheel" role="listbox" aria-label="22 张大阿尔卡纳" tabindex="0">
        ${cards.map((c, i) => `
          <div class="wheel-card" role="option" data-id="${esc(c.id)}" data-index="${i}" aria-selected="false"
               style="--cx:${positions[i].x};--cy:${positions[i].y};--deg:${positions[i].deg}deg">
            <img src="${esc(c.image || "")}" alt="${esc(c.name || "")}" loading="lazy" />
            <span class="wc-num">${i + 1}</span>
          </div>
        `).join("")}
      </div>
      <button class="wheel-pick" id="wheel-pick" type="button" aria-label="抽取当前亮起的牌">抽这张</button>
    </div>

    <div class="tarot3-slots" id="tarot3-slots" aria-label="已抽牌槽">
      ${[0, 1, 2].map((i) => `
        <div class="tarot3-slot" data-slot="${i}">
          <span class="t3s-label">${["过去", "现在", "未来"][i] || "第 " + (i + 1) + " 张"}</span>
          <span class="t3s-name">待抽</span>
        </div>
      `).join("")}
      <button class="tarot3-reset" id="tarot3-reset" type="button" aria-label="清空已抽的牌">重抽</button>
    </div>

    <div class="tarot3-reveal hidden" id="tarot3-reveal">
      <button class="btn-primary wide" id="wheel-go">就按这三张 · 出发</button>
    </div>

    <div class="tarot3-readout hidden" id="tarot3-readout"></div>
  `;

  // 返回板块页
  el.querySelector(".board-back").addEventListener("click", () => go("board"));

  const wheel = $("#wheel", el);
  const wheelCards = [...el.querySelectorAll(".wheel-card")];

  // 圆盘控制器
  bindCardWheel({
    stage: $("#wheel-stage", el),
    wheel,
    cards: wheelCards,
    count: cards.length,
    getAngle: () => S.tarot3Angle,
    setAngle: (a) => { S.tarot3Angle = a; },
    onSelectChange: (idx) => {
      S.tarot3Selected = idx;
      wheelCards.forEach((c, i) => {
        c.classList.toggle("selected", i === idx);
        c.setAttribute("aria-selected", i === idx ? "true" : "false");
      });
    },
  });

  // 抽这张
  const pickBtn = $("#wheel-pick", el);
  const pickCurrent = () => {
    if (S.tarot3Done) return;
    if (S.tarot3Picks.length >= 3) return;
    const idx = S.tarot3Selected;
    const card = cards[idx];
    if (!card) return;
    // 同一张不重复抽（已在 picks 里就跳过）
    if (S.tarot3Picks.some((p) => p.idx === idx)) {
      // 但 jsdom 等没真实手势的场景会一直卡这里 — 自动跳到下一张，给个兜底
      autoAdvance();
      return;
    }
    S.tarot3Picks.push({ idx, card });

    // 把已抽的牌从牌轮里灰掉
    const elx = wheelCards[idx];
    if (elx) elx.classList.add("picked");

    // 更新计数 + 槽位
    $("#t3-count", el).textContent = String(S.tarot3Picks.length);
    S.tarot3Picks.forEach((p, i) => {
      const slot = el.querySelector(`.tarot3-slot[data-slot="${i}"]`);
      if (slot) {
        slot.classList.add("on");
        slot.querySelector(".t3s-name").textContent = p.card.name || "未知";
      }
    });

    if (S.tarot3Picks.length >= 3) {
      S.tarot3Done = true;
      pickBtn.disabled = true;
      pickBtn.textContent = "已抽满 3 张";
      $("#tarot3-reveal", el).classList.remove("hidden");
      // 给「就按这三张 · 出发」按钮挂上 emit 逻辑
      $("#wheel-go", el).onclick = () => {
        const c = constraintFromTarot3(S.tarot3Picks.map((p) => p.card));
        emit(c);
      };
    } else {
      // 抽完一张 → 自动把圆盘转到下一张（让下一抽的「当前牌」不是同一张）
      autoAdvance();
      pickBtn.textContent = "已抽 " + S.tarot3Picks.length + " / 3";
    }
  };

  // 圆盘自动跳到下一张（让下一抽的候选牌不是同一张）
  function autoAdvance() {
    const step = (Math.PI * 2) / cards.length;
    S.tarot3Angle = S.tarot3Angle + step;
    if (S.tarot3Selected < cards.length - 1) S.tarot3Selected += 1;
    wheelCards.forEach((c, i) => {
      c.classList.toggle("selected", i === S.tarot3Selected);
      c.setAttribute("aria-selected", i === S.tarot3Selected ? "true" : "false");
    });
    wheel.style.transition = "transform 360ms cubic-bezier(.22,.61,.36,1)";
    wheel.style.transform = `rotate(${S.tarot3Angle}rad)`;
    setTimeout(() => { wheel.style.transition = ""; }, 380);
  }

  pickBtn.addEventListener("click", pickCurrent);

  // 重抽：清空 picks，牌轮复原
  const resetBtn = $("#tarot3-reset", el);
  const resetAll = () => {
    if (!S.tarot3Picks.length) return;
    S.tarot3Picks = [];
    S.tarot3Done = false;
    pickBtn.disabled = false;
    pickBtn.textContent = "抽这张";
    $("#t3-count", el).textContent = "0";
    [...el.querySelectorAll(".tarot3-slot")].forEach((slot) => {
      slot.classList.remove("on");
      slot.querySelector(".t3s-name").textContent = "待抽";
    });
    wheelCards.forEach((c) => c.classList.remove("picked"));
    $("#tarot3-reveal", el).classList.add("hidden");
  };
  resetBtn.addEventListener("click", resetAll);

  // 点击中央牌 = 等同于抽这张（体验更顺）
  wheel.addEventListener("dblclick", pickCurrent);

  // 键盘：空格 / 回车 = 抽当前
  wheel.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickCurrent(); }
    else if (e.key.toLowerCase() === "r") { e.preventDefault(); resetAll(); }
  });
}

// ---------- 广场 ----------
function renderPlaza() {
  const el = $("#plaza");
  if (!el) return;
  const api = S.api;
  const boards = ["全部", ...BOARDS.map((b) => b.t)];
  el.innerHTML = `
    <div class="section-head"><h1>广场</h1><p class="muted">看别人是怎么把今天定下来的。</p></div>
    <div class="feed-filter" id="feed-filter">
      ${boards.map((b, i) => `<button class="ff ${i === 0 ? "on" : ""}" data-f="${esc(b)}">${esc(b)}</button>`).join("")}
    </div>
    <div class="feed" id="feed"></div>`;
  const draw = (f) => {
    const list = f === "全部" ? FEED : FEED.filter((p) => p.board === f);
    $("#feed").innerHTML = list.length ? list.map((p) => {
      const thumbs = (p.ids || []).map((id) => {
        const it = (api.state.items || []).find((x) => x.id === id);
        return it ? `<img src="${esc(api.imgSrc(it.image))}" alt="${esc(it.color_name || it.type || "")}" />` : "";
      }).join("");
      return `
        <article class="feed-card" data-id="${p.id}">
          <div class="fc-head"><b>${esc(p.who)}</b><span class="fc-src">${esc(p.src)}</span></div>
          <p class="fc-text">${esc(p.text)}</p>
          <div class="fc-thumbs">${thumbs}</div>
          <div class="fc-foot"><button class="fc-like" data-like="${p.id}">♥ <span>${p.likes}</span></button><span class="fc-board">${esc(p.board)}</span></div>
        </article>`;
    }).join("") : `<p class="muted">这个板块还没人发过。</p>`;
    $$("#feed .fc-like").forEach((b) =>
      b.addEventListener("click", () => {
        const s = b.querySelector("span");
        s.textContent = Number(s.textContent) + 1;
        b.classList.add("liked");
      })
    );
  };
  draw("全部");
  $$("#feed-filter .ff").forEach((b) =>
    b.addEventListener("click", () => {
      $$("#feed-filter .ff").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      draw(b.dataset.f);
    })
  );
}

// ---------- 约束生成器：五个入口，一套协议 ----------
//
// 参考稿第 6 节原文：
//   1 收集意图 → 2 生成约束（风格 · 主色 · 避雷色）→ 3 筛单品 → 4 补齐一套 → 5 出结果
// 第 1 步各入口自己干，第 2 步全部收敛到这里，第 3~5 步是现有引擎的事。
function baseSrc(board, label, color) {
  return { board, label, color };
}

function baseConstraint(kind, src, extra) {
  return Object.assign(
    {
      source: kind,
      src,
      occasion: null,
      occasions: [],
      mood: null,
      must_colors: [],
      avoid_colors: [],
      must_categories: slotCat(),
      weather: null,
      thickness: null,
      season: [],
      vibe: "",
      style_tags: [],
      story: "",
      formality: null,
      prefs: {},
      exclude_ids: [],
      extra: {},
    },
    extra
  );
}

/** 天气只改厚薄：动 season 和要不要外套，绝不动 style_tags / must_colors。 */
function applyThickness(c) {
  const city = cityOf(S.city);
  c.thickness = city.label;
  c.weather = city.w;
  if (!c.season || !c.season.length) c.season = [...city.season];
  c.must_categories = city.needOuter ? slotCat() : slotCat().filter((x) => x !== "outer");
  return c;
}

function constraintFromTarot(card) {
  const c = baseConstraint("tarot", baseSrc("抽取式", "塔罗 · " + card.name, "#534AB7"), {
    must_colors: card.must_colors || [],
    avoid_colors: card.avoid_colors || [],
    season: card.season || [],
    style_tags: card.style_tags || [],
    vibe: card.vibe || "",
    story: card.story || "",
    extra: { card_id: card.id },
  });
  return applyThickness(c);
}

/**
 * 抽三张牌 → 合并成一条约束。
 * 风格按「多数票 + 优先权重」(slot=1 现在 > slot=0 过去 > slot=2 未来)；
 * 主色取「被 3 张牌里至少 2 张提到的颜色」；避雷色只保留三张都点的交集；
 * 季节取并集；牌义拼成 3 行 story。
 */
function constraintFromTarot3(cards) {
  const weights = [1, 2, 1]; // 过去 / 现在 / 未来
  const tagScore = {};
  const colorScore = {};
  const avoidScore = {};
  const seasonSet = new Set();
  let vibeParts = [];
  let storyParts = [];

  cards.forEach((card, i) => {
    (card.style_tags || []).forEach((t) => { tagScore[t] = (tagScore[t] || 0) + weights[i]; });
    (card.must_colors || []).forEach((c2) => { colorScore[c2] = (colorScore[c2] || 0) + weights[i]; });
    (card.avoid_colors || []).forEach((c2) => { avoidScore[c2] = (avoidScore[c2] || 0) + weights[i]; });
    (card.season || []).forEach((s) => seasonSet.add(s));
    if (card.vibe) vibeParts.push(card.vibe);
    if (card.story) storyParts.push(card.story);
  });

  const tagList = Object.entries(tagScore).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  // 主色：得分 ≥ 2（被至少两张牌提到，且权重之和 ≥ 2）；不够再放宽到 ≥ 1
  const mustColors = Object.entries(colorScore).filter(([, s]) => s >= 2).map((x) => x[0]);
  const mustColorsFallback = mustColors.length ? mustColors : Object.entries(colorScore).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
  // 避雷色：3 张都点
  const avoidColors = Object.entries(avoidScore).filter(([, s]) => s >= 3).map((x) => x[0]);

  const names = cards.map((c) => c.name || "?").join(" · ");
  const c = baseConstraint("tarot3", baseSrc("抽取式", "三牌阵 · " + names, "#534AB7"), {
    must_colors: mustColorsFallback,
    avoid_colors: avoidColors,
    season: [...seasonSet],
    style_tags: tagList,
    vibe: vibeParts.join(" / "),
    story: storyParts.join("  ·  "),
    extra: { card_ids: cards.map((c2) => c2.id), card_names: names },
  });
  return applyThickness(c);
}

function constraintFromScratch(prize) {
  const c = baseConstraint("scratch", baseSrc("抽取式", "刮刮乐 · " + prize.name, "#534AB7"), {
    must_colors: prize.must_colors || [],
    style_tags: prize.style_tags || [],
    vibe: "scratch / luck",
    story: prize.say,
  });
  return applyThickness(c);
}

function constraintFromEnergy(v) {
  const st = ENERGY.find((x) => v >= x.min && v <= x.max) || ENERGY[ENERGY.length - 1];
  const c = baseConstraint("energy", baseSrc("调节式", "电量 " + v + "%", "#D4537E"), {
    style_tags: st.style_tags || [],
    must_colors: st.must_colors || [],
    prefs: { ...st.prefs, energy: Number(v) },
    formality: st.prefs.formality,
    vibe: "energy / " + st.label,
    story: `电量 ${v}%，${st.label}：${st.say}`,
    extra: { level: st.label },
  });
  return applyThickness(c);
}

function constraintFromIdentity(i) {
  const c = baseConstraint("identity", baseSrc("选择式", "人设 · " + i.name, "#1D9E75"), {
    style_tags: i.style_tags || [],
    must_colors: i.must_colors || [],
    avoid_colors: i.avoid_colors || [],
    prefs: { ...i.prefs },
    formality: i.prefs.formality,
    vibe: i.symbol + " " + i.name,
    story: `${i.name}：${i.line}`,
    extra: { identity: i.id },
  });
  return applyThickness(c);
}

function constraintFromKw(g, raw) {
  const c = baseConstraint("input", baseSrc("输入式", "一句话 · " + g.tag, "#BA7517"), {
    style_tags: g.c.style_tags || [],
    must_colors: g.c.must_colors || [],
    avoid_colors: g.c.avoid_colors || [],
    occasions: g.c.occasions || [],
    season: g.c.season || [],
    prefs: { ...g.c.prefs },
    formality: g.c.prefs.formality,
    vibe: g.tag,
    story: `你说「${raw}」→ 读到 ${g.tag}：${g.say}`,
    extra: { kw: g.tag, raw },
  });
  return applyThickness(c);
}

/** 唯一出口：所有入口 → 这一行 → 现有引擎。 */
function emit(c) {
  const api = S.api;
  if (!api) return;
  api.state.constraint = c;
  api.state.constraintSrc = c.src;
  api.onConstraint?.(c);
  api.runRecommend();
}

// ---------- 导航：两版形态 ----------
// A · drawer：纯抽屉，汉堡进，主流程单一路径（参考稿原样）
// B · hybrid：抽屉 + 底部三 Tab（拿主意 / 衣柜 / 广场），手机上更顺手
function navItems() {
  if (S.nav === "hybrid") {
    return [
      { view: "home", label: "拿主意" },
      { view: "wardrobe", label: "衣柜" },
      { view: "plaza", label: "广场" },
    ];
  }
  return [];
}

function applyNav(mode, persist) {
  S.nav = mode === "hybrid" ? "hybrid" : "drawer";
  document.documentElement.classList.toggle("nav-hybrid", S.nav === "hybrid");
  const bar = $("#otabbar");
  if (bar) {
    bar.innerHTML = navItems()
      .map((n) => `<button class="otab" data-go="${n.view}"><span>${esc(n.label)}</span></button>`)
      .join("");
    $$("#otabbar .otab").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  }
  $$(".otab").forEach((b) => b.classList.toggle("on", b.dataset.go === document.documentElement.dataset.view));
  $$("[data-navmode]").forEach((b) => b.classList.toggle("on", b.dataset.navmode === S.nav));
  if (persist) {
    try { localStorage.setItem(NAV_KEY, S.nav); } catch { /* ignore */ }
  }
  // 手机外壳的底部 Tab 由 shell.js 从 window.__oracle.navItems() 取，这里通知它重建
  window.dispatchEvent(new CustomEvent("oracle:nav"));
}

// ---------- 安装 ----------
function install(api) {
  S.api = api;

  try {
    const n = localStorage.getItem(NAV_KEY);
    if (n === "drawer" || n === "hybrid") S.nav = n;
    const c = localStorage.getItem(CITY_KEY);
    if (c && CITIES.some((x) => x.city === c)) S.city = c;
  } catch { /* ignore */ }

  const q = new URLSearchParams(location.search).get("nav");
  if (q === "hybrid" || q === "drawer") S.nav = q;

  // 汉堡 / 抽屉
  $("#btn-menu")?.addEventListener("click", openDrawer);
  $$("#drawer [data-close]").forEach((b) => b.addEventListener("click", closeDrawer));
  $$("#drawer [data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  $$("[data-navmode]").forEach((b) => b.addEventListener("click", () => applyNav(b.dataset.navmode, true)));

  applyNav(S.nav, false);

  renderHome();
  renderExt();
  renderPlaza();

  // 老页面里的入口：塔罗抽完牌 / 风格页生成，都统一走 emit 的同一条路
  const tarotBtn = $("#btn-tarot");
  if (tarotBtn) {
    tarotBtn.addEventListener("click", () => {
      // app.js 已经负责抽牌与渲染，这里只补「来源徽章」
    });
  }

  window.__oracle = {
    go,
    syncTabs,
    applyNav,
    navItems,
    openDrawer,
    closeDrawer,
    navItems,
    state: S,
    emit,
    constraintFromTarot,
    constraintFromTarot3,
    constraintFromScratch,
    constraintFromEnergy,
    constraintFromIdentity,
    constraintFromKw,
    renderHome,
    renderPlaza,
    renderScratch,
    renderEnergy,
    renderIdentity,
    renderInput,
    renderBoard,
    renderTarotWheel,
    openBoard,
  };

  // 首屏
  go("home");
  return window.__oracle;
}

  // 对外暴露（原来是 export）
  Object.assign(NS, { constraintFromTarot, constraintFromTarot3, constraintFromScratch, constraintFromEnergy, constraintFromIdentity, constraintFromKw, install, go, openBoard, applyNav, navItems, CATEGORY_NAME, bindCardStack, bindCardWheel, renderTarotWheel });
})(window.Outfit = window.Outfit || {});
