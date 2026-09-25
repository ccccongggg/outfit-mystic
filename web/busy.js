/* ------------------------------------------------------------------
   经典脚本（原为 ES module，语义等价）
   改因：file:// 下浏览器禁止加载 <script type="module">，双击 index.html
        会整页无法交互。改成经典脚本 + window.Outfit 命名空间后，
        双击打开 / 起本地服务两种方式都能完整跑。
   依赖：由 index.html 按顺序 defer 加载，公共名挂在 window.Outfit 上。
------------------------------------------------------------------ */
(function (NS) {
"use strict";

// web/busy.js —— 让「AI 正在干活」这件事在界面上看得见
//
// 之前的问题：抠底 + VLM 打标动辄 5~15 秒（联网找白底图更久），界面上只有一行
// 静态的「处理中…」，用户看到的是一个不动的页面 —— 和卡死没有区别。
//
// 这个模块给所有 AI 等待点统一补三样东西，任何一样都能单独证伪「界面卡住了」：
//   ① 会转的圆环      证明进程没死
//   ② 走了多少秒      证明时间在往前走（每 100ms 更新）
//   ③ 轮播的拟人提示  告诉用户此刻到底在等什么（AI 在看图 / 在判断主色…）
//
// 超过 slowAfter 还没结束，追加一句「还在跑，别关页面」——长等待最怕的不是慢，
// 是不知道还要不要继续等。
//
// 无动画偏好（prefers-reduced-motion）下不转，但计时和提示照常，信息量不减。

const REDUCE =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// 同一时刻只可能有一个 AI 操作在跑，用单例就够，也顺手做了防重入
let cur = null;

function fmt(ms) {
  const s = ms / 1000;
  return s < 10 ? s.toFixed(1) + "s" : Math.round(s) + "s";
}

/**
 * 在一个专用的空容器里挂上忙碌指示器。
 * @param {HTMLElement} host 专用容器（会被清空 / 填充，别传有内容的节点）
 * @param {object} opts
 *   title        string   主标题
 *   hints        string[] 轮播的副提示
 *   hintInterval number    提示轮播间隔（ms）
 *   slowAfter    number    超过多少 ms 追加「还在跑」
 *   slowHint     string    那句追加的话
 *   showBar      boolean   是否显示不确定进度条
 * @returns {object|null} 句柄，可 .title() / .progress() / .stop()
 */
function startBusy(host, opts = {}) {
  stopBusy();
  if (!host) return null;

  const o = Object.assign(
    {
      title: "AI 正在处理…",
      hints: [],
      hintInterval: 2600,
      slowAfter: 8000,
      slowHint: "比平时慢一点，还在跑，别关页面",
      showBar: true,
      barMode: "indeterminate",
    },
    opts
  );

  host.innerHTML = `
    <div class="busy${REDUCE ? " busy-still" : ""}" role="status" aria-live="polite">
      <span class="busy-spin" aria-hidden="true"></span>
      <div class="busy-body">
        <div class="busy-title"></div>
        <div class="busy-hint"></div>
        ${o.showBar ? '<div class="busy-bar"><i></i></div>' : ""}
      </div>
      <span class="busy-timer">0.0s</span>
    </div>`;

  const root = host.querySelector(".busy");
  const titleEl = host.querySelector(".busy-title");
  const hintEl = host.querySelector(".busy-hint");
  const timerEl = host.querySelector(".busy-timer");
  const barEl = host.querySelector(".busy-bar > i");

  titleEl.textContent = o.title;
  hintEl.textContent = o.hints[0] || "";

  let t0 = Date.now();
  let hi = 0;
  let slowed = false;
  let paused = false;
  let pausedAt = 0;

  const tick = () => {
    if (paused) return;
    const ms = Date.now() - t0;
    timerEl.textContent = fmt(ms);
    if (!slowed && ms > o.slowAfter && o.slowHint) {
      slowed = true;
      hintEl.textContent = o.slowHint;
      hintEl.classList.add("busy-slow");
    }
  };

  const hintId = o.hints.length > 1 ? setInterval(() => {
    if (paused || slowed) return; // 慢的时候锁定那句「还在跑」，别再跳来跳去
    hi = (hi + 1) % o.hints.length;
    hintEl.textContent = o.hints[hi];
  }, o.hintInterval) : null;

  const tickId = setInterval(tick, 100);
  tick();

  const handle = {
    host,
    /** 换主标题（比如「抠底」→「AI 正在分析」） */
    title(t) {
      titleEl.textContent = t;
      return handle;
    },
    /** 换提示语，并重置轮播 */
    hint(t) {
      hintEl.textContent = t;
      hintEl.classList.remove("busy-slow");
      slowed = true;
      return handle;
    },
    /** 0~1 确定进度；传 null 回到不确定 */
    progress(p) {
      if (!barEl) return handle;
      if (p == null) {
        root.classList.remove("busy-fixed");
        barEl.style.width = "";
      } else {
        root.classList.add("busy-fixed");
        barEl.style.width = Math.max(0, Math.min(1, p)) * 100 + "%";
      }
      return handle;
    },
    elapsed: () => (paused ? pausedAt : Date.now()) - t0,
    /**
     * 暂停：不是 AI 在等，是在等用户（比如挑一张白底图）。
     * 这时候继续转圈是在骗人 —— 停表、停圈，把标题换成「等你挑一张」。
     */
    pause(waitTitle) {
      if (paused) return handle;
      paused = true;
      pausedAt = Date.now();
      root.classList.add("busy-wait");
      if (waitTitle) titleEl.textContent = waitTitle;
      hintEl.textContent = "";
      hintEl.classList.remove("busy-slow");
      return handle;
    },
    /** 恢复：把等用户的那段时间从计时里扣掉，只算 AI 真正花掉的时间 */
    resume(runTitle) {
      if (!paused) return handle;
      t0 += Date.now() - pausedAt;
      paused = false;
      root.classList.remove("busy-wait");
      if (runTitle) titleEl.textContent = runTitle;
      return handle;
    },
    stop() {
      if (cur !== handle) return;
      clearInterval(tickId);
      if (hintId) clearInterval(hintId);
      host.innerHTML = "";
      cur = null;
    },
  };

  cur = handle;
  return handle;
}

/** 停掉当前指示器（幂等） */
function stopBusy() {
  if (cur) cur.stop();
  cur = null;
}

/** 当前是否正忙（用于防重入） */
function isBusy() {
  return !!cur;
}

/**
 * 包一层异步操作：自动 start / stop，并在 busy 期间把一批按钮禁掉。
 * 出错也会收干净，不会留下一个永远在转的圈。
 * @param {HTMLElement} host
 * @ {object} opts  同 startBusy，额外支持 disable: HTMLElement[]
 */
async function withBusy(host, opts, fn) {
  if (isBusy()) return undefined; // 防重入：上一个还没跑完就不接新的
  const disable = (opts.disable || []).filter(Boolean);
  const handle = startBusy(host, opts);
  const restore = disable.map((b) => {
    const had = b.disabled;
    const txt = b.textContent;
    b.disabled = true;
    if (opts.busyText) b.textContent = opts.busyText;
    return () => {
      b.disabled = had;
      b.textContent = txt;
    };
  });
  try {
    const out = await fn(handle);
    // 兜底防闪：本地兜底 / 缓存命中可能 20ms 就返回，指示器一闪而过反而像故障。
    // 不足 minVisible 就补足，让人至少看清「AI 跑过了」。
    const min = opts.minVisible ?? 420;
    const left = min - (handle ? handle.elapsed() : 0);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    return out;
  } finally {
    restore.forEach((r) => r());
    if (handle) handle.stop();
    else stopBusy();
  }
}

  // 对外暴露（原来是 export）
  Object.assign(NS, { startBusy, stopBusy, isBusy, withBusy });
})(window.Outfit = window.Outfit || {});
