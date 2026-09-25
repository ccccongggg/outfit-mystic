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

import {
  BOARDS, EXT_SLOT, EXT_COPY, CITIES, DEFAULT_CITY,
  KW, IDENTITIES, ENERGY, SCRATCH, FEED, SHAPES,
} from "./oracle-data.js";
import { CATEGORY_NAME } from "./vocab.js";

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

// ---------- 首屏（挂衣杆 + 天气芯片）----------
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

    <div class="rail" id="rail" role="list" aria-label="四个板块">
      ${BOARDS.map((b) => `
        <button class="rail-item" role="listitem" data-board="${b.k}" style="--bc:${b.color};--bs:${b.soft};--bi:${b.ink}">
          <span class="rail-hanger"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SHAPES[b.shape] || ""}</svg></span>
          <span class="rail-t">${esc(b.t)}</span>
          <span class="rail-s">${esc(b.s)}</span>
          <span class="rail-how">${esc(b.how)}</span>
        </button>`).join("")}
      <button class="rail-item rail-ext" role="listitem" data-board="ext" style="--bc:${EXT_SLOT.color};--bs:${EXT_SLOT.soft};--bi:${EXT_SLOT.ink}">
        <span class="rail-hanger"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3">${SHAPES.dashed}</svg></span>
        <span class="rail-t">${esc(EXT_SLOT.t)}</span>
        <span class="rail-s">${esc(EXT_SLOT.s)}</span>
        <span class="rail-how">点它看为什么留空位</span>
      </button>
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
  $$("#rail .rail-item").forEach((b) => b.addEventListener("click", () => openBoard(b.dataset.board)));
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

export function constraintFromTarot(card) {
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

export function constraintFromScratch(prize) {
  const c = baseConstraint("scratch", baseSrc("抽取式", "刮刮乐 · " + prize.name, "#534AB7"), {
    must_colors: prize.must_colors || [],
    style_tags: prize.style_tags || [],
    vibe: "scratch / luck",
    story: prize.say,
  });
  return applyThickness(c);
}

export function constraintFromEnergy(v) {
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

export function constraintFromIdentity(i) {
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

export function constraintFromKw(g, raw) {
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
export function install(api) {
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
    openBoard,
  };

  // 首屏
  go("home");
  return window.__oracle;
}

export { go, openBoard, applyNav, navItems, CATEGORY_NAME };
