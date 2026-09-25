/* web/shell.js —— 真机外壳层：把现有页面「装进手机里」跑
   · 不改动业务代码（app.js / index.html 结构 / 接口），只是把节点搬进外壳
   · 屏内滚动（overscroll-behavior:contain）、横向滑动切页、底部 Tab、状态栏时钟、灵动岛通知
   · 自适应缩放；可切换回网页模式（localStorage 记忆，?mode=web / ?mode=phone 强制）
*/
(function () {
  const KEY = "outfit-phone-mode";
  const PW = 390;
  const PH = 844;

  const LABELS = { wardrobe: "衣橱", style: "风格", entry: "入口", result: "结果" };
  const ICONS = {
    wardrobe: '<path d="M4 7h16v13H4z"/><path d="M9 7V4.5h6V7"/><path d="M4 12h16"/>',
    style: '<path d="M12 3.5l2.2 5.1 5.6.5-4.2 3.7 1.2 5.4L12 15.6 7.2 18.2l1.2-5.4L4.2 9.1l5.6-.5z"/>',
    entry: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.2 2"/>',
    result: '<rect x="3.5" y="4.5" width="7" height="15" rx="2"/><rect x="13.5" y="4.5" width="7" height="9" rx="2"/><path d="M13.5 17.5h7"/>',
  };

  let built = null; // { stage, slot, scaler, phone, screen, viewport, tabbar, tabs, ind, island, toast, main, topbar, footer }
  let islandTimer = null;
  let toastTimer = null;

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function desiredMode() {
    const q = new URLSearchParams(location.search).get("mode");
    if (q === "web" || q === "phone") return q;
    return localStorage.getItem(KEY) || "phone";
  }

  // ---------- 构建外壳 ----------
  function build() {
    if (built) return built;

    const stage = el("div", "phone-stage");
    const slot = el("div", "phone-slot");
    const scaler = el("div", "phone-scaler");
    const phone = el("div", "phone");

    phone.innerHTML = `
      <span class="phone-btn silent"></span>
      <span class="phone-btn volup"></span>
      <span class="phone-btn voldn"></span>
      <span class="phone-btn power"></span>
      <div class="phone-screen">
        <div class="phone-status">
          <span id="phone-clock">--:--</span>
          <span class="right">
            <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1" opacity=".35"/></svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M1 4.2 A10 10 0 0 1 15 4.2"/><path d="M3.6 6.9 A6.4 6.4 0 0 1 12.4 6.9"/><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>
            <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.8" y="0.8" width="21" height="11.4" rx="3.4" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.2"/><rect x="2.6" y="2.6" width="14.6" height="7.8" rx="2.2" fill="currentColor"/><path d="M23.6 4.4 v4.2 a2.4 2.4 0 0 0 0-4.2 z" fill="currentColor" fill-opacity=".5"/></svg>
          </span>
        </div>
      </div>`;

    const screen = phone.querySelector(".phone-screen");
    const viewport = el("div", "phone-viewport");

    // 注意取引用的时机：phone/screen/viewport 此刻都还是游离节点，
    // 一旦把 main 搬进 viewport，整棵业务 DOM 就脱离了 document —— 之后再
    // document.getElementById(...) 一律返回 null。所以必须先抓引用，再搬迁。
    const topbar = document.querySelector(".topbar");
    const main = document.querySelector("main.shell") || document.querySelector(".shell");
    const footer = document.querySelector(".footer");
    // 业务侧所有固定定位的浮层都必须脱离 main.shell：
    // main.shell 在手机模式下被 transform 拉成 400% 宽的横向轨道，有 transform 的祖先
    // 会成为 position:fixed 的包含块，浮层会按 4 倍屏宽铺开 → 屏内右侧被切、内容错乱。
    // 搬到 viewport 下（position:relative）后，改成 absolute 铺满屏幕即可。
    //   #found-modal  联网找图的候选确认
    //   #drawer       「拿主意」的侧边抽屉
    //   #stub-sheet   灰卡点开的说明卡片
    const FLOAT_SEL = ["#found-modal", "#drawer", "#stub-sheet"];
    const floats = FLOAT_SEL.map((sel) => {
      const n = document.querySelector(sel);
      return n ? { node: n, home: n.parentNode } : null;
    }).filter(Boolean);
    const modal = floats.find((f) => f.node.id === "found-modal")?.node || null;
    const modalHome = modal ? modal.parentNode : null;

    if (main) viewport.appendChild(main);
    floats.forEach((f) => viewport.appendChild(f.node));
    screen.appendChild(viewport);

    // 底部 Tab（复用顶部导航的 data-view，点击等价于点原来的 nav-btn）
    const tabbar = el("div", "phone-tabbar");
    const ind = el("span", "phone-tab-ind");
    tabbar.appendChild(ind);

    // 底部 Tab 的清单优先问「拿主意」那一层要（它会按导航形态 A/B 给不同的项），
    // 拿不到就退回顶部导航的 data-view。
    let tabs = [];
    let navBtns = [];
    let srcBtns = [];
    function navDefs() {
      const o = window.__oracle;
      if (o && typeof o.navItems === "function") {
        return o.navItems().map((n) => ({ view: n.view, label: n.label, fire: () => o.go(n.view) }));
      }
      const list = [...document.querySelectorAll(".nav-btn")];
      srcBtns = list;
      return list.map((b) => ({
        view: b.dataset.view,
        label: LABELS[b.dataset.view] || b.textContent.trim(),
        fire: () => b.click(),
      }));
    }
    function rebuildTabs() {
      tabs.forEach((t) => t.remove());
      tabs = [];
      navBtns = [];
      const defs = navDefs();
      tabbar.style.display = defs.length ? "" : "none";
      defs.forEach((d) => {
        const t = el("button", "phone-tab");
        t.type = "button";
        t.dataset.view = d.view;
        t.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          (ICONS[d.view] || ICONS.result) +
          "</svg><span>" + d.label + "</span>";
        t.addEventListener("click", () => {
          d.fire();
          setTimeout(syncIndex, 0);
          buzz();
        });
        tabbar.appendChild(t);
        tabs.push(t);
        navBtns.push(t);
      });
      syncIndex();
    }
    rebuildTabs();
    screen.appendChild(tabbar);

    const homebar = el("div", "phone-homebar");
    homebar.innerHTML = "<i></i>";
    screen.appendChild(homebar);

    const gloss = el("div", "phone-gloss");
    const island = el("div", "phone-island");
    island.innerHTML = '<span class="cam"></span><span class="txt"></span>';
    const toast = el("div", "phone-toast");
    [gloss, island, toast].forEach((n) => screen.appendChild(n));

    if (topbar) screen.insertBefore(topbar, viewport);
    if (footer) viewport.appendChild(footer);

    // 模式切换
    const toggle = el("button", "phone-toggle");
    toggle.type = "button";
    toggle.textContent = "退出手机模拟";
    toggle.addEventListener("click", () => disable());

    const hint = el("div", "phone-hint");
    hint.innerHTML =
      "<b>手机模拟已开启</b>：底部 Tab 切换 · 屏幕内左右拖动翻页 · 滚动锁在屏内 · " +
      "<kbd>←</kbd><kbd>→</kbd> 切页 · <kbd>Esc</kbd> 无效（点上方按钮退出）";

    slot.appendChild(scaler);
    scaler.appendChild(phone);
    stage.appendChild(slot);
    stage.appendChild(hint);
    stage.appendChild(toggle);

    built = { stage, slot, scaler, phone, screen, viewport, tabbar, tabs, ind, island, toast, main, topbar, footer, navBtns, srcBtns, modal, modalHome, floats, rebuildTabs };

    // 导航形态在抽屉里被切换（A 纯抽屉 / B 抽屉+底栏）时重建底部 Tab
    window.addEventListener("oracle:nav", () => {
      if (built && built.rebuildTabs) built.rebuildTabs();
    });
    return built;
  }

  // ---------- 状态同步 ----------
  function currentIndex() {
    // 优先认 documentElement.dataset.view：app.js 的 switchView 和 oracle 的 go 都会写它，
    // 这样纯抽屉模式（没有底部 Tab 可点）也能把轨道下标对上。
    const v = document.documentElement.dataset.view;
    if (v && built) {
      const byView = built.navBtns.findIndex((b) => b.dataset.view === v);
      if (byView >= 0) return byView;
    }
    // 顺序很关键：先问业务侧真正的来源（.nav-btn），最后才看 Tab 自己。
    // 因为 syncIndex 会给 Tab 打 active，先看 Tab 会把自己上一轮的结果锁死。
    if (built && built.srcBtns && built.srcBtns.length) {
      const k = built.srcBtns.findIndex((b) => b.classList.contains("active"));
      if (k >= 0) return k;
    }
    const btns = built ? built.navBtns : [];
    const i = btns.findIndex((b) => b.classList.contains("active"));
    return i < 0 ? 0 : i;
  }

  function syncIndex() {
    if (!built) return;
    const i = currentIndex();
    built.main.style.setProperty("--phone-i", i);
    built.tabs.forEach((t, k) => t.classList.toggle("active", k === i));
    const w = built.tabbar.clientWidth / Math.max(1, built.tabs.length);
    built.ind.style.transform = "translateX(" + (i * w + w / 2 - 13) + "px)";
  }

  function fit() {
    if (!built) return;
    const s = Math.max(0.42, Math.min(1, (window.innerWidth - 32) / PW, (window.innerHeight - 120) / PH));
    built.scaler.style.setProperty("--phone-scale", s);
    built.slot.style.width = Math.round(PW * s) + "px";
    built.slot.style.height = Math.round(PH * s) + "px";
  }

  function tickClock() {
    const d = new Date();
    const n = document.getElementById("phone-clock");
    if (n) n.textContent = d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function island(text) {
    if (!built) return;
    built.island.querySelector(".txt").textContent = text || "";
    built.island.classList.add("open");
    clearTimeout(islandTimer);
    islandTimer = setTimeout(() => built.island.classList.remove("open"), 2000);
  }

  function toast(text) {
    if (!built) return;
    built.toast.textContent = text || "";
    built.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => built.toast.classList.remove("show"), 1900);
  }

  function buzz(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 8); } catch (e) { /* ignore */ }
    }
  }

  // ---------- 横向滑动翻页 ----------
  function bindSwipe() {
    if (!built || built.swipeBound) return;
    if (!built.tabs.length) return; // A 版纯抽屉没有底部 Tab，横滑切页就无从谈起
    built.swipeBound = true;
    const track = built.main;
    let x0 = 0, y0 = 0, dx = 0, dragging = false, horiz = false;

    track.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input,select,textarea,summary")) return;
      dragging = true; horiz = false; dx = 0;
      x0 = e.clientX; y0 = e.clientY;
    });

    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const ddx = e.clientX - x0;
      const ddy = e.clientY - y0;
      if (!horiz) {
        if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
          horiz = true;
          track.classList.add("dragging");
        } else if (Math.abs(ddy) > 10) {
          dragging = false;
          return;
        }
      }
      if (horiz) {
        dx = ddx;
        const i = currentIndex();
        const w = built.viewport.clientWidth;
        let p = -i * w + dx * 0.85;
        const min = -(built.tabs.length - 1) * w;
        if (p > 0) p = p * -0.35;
        if (p < min) p = min + (p - min) * -0.35;
        track.style.transform = "translateX(" + p + "px)";
      }
    });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("dragging");
      track.style.transform = "";
      if (horiz && Math.abs(dx) > 56) {
        const i = currentIndex();
        const n = dx < 0 ? Math.min(built.tabs.length - 1, i + 1) : Math.max(0, i - 1);
        if (n !== i) built.navBtns[n].click();
      }
      setTimeout(syncIndex, 0);
      dx = 0;
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
    track.addEventListener("pointerleave", end);
  }

  // 业务侧事件 → 灵动岛提示（不侵入 app.js，只做观察）
  function bindObservers() {
    if (!built || built.observed) return;
    built.observed = true;

    const nav = document.querySelector(".nav");
    if (nav) {
      new MutationObserver(syncIndex).observe(nav, { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
    const status = document.getElementById("upload-status");
    if (status) {
      new MutationObserver(() => {
        const msg = status.querySelector(".status-msg");
        const text = msg && msg.textContent.trim();
        if (text) island(text.slice(0, 24));
      }).observe(status, { childList: true, subtree: true, characterData: true });
    }
    const err = document.getElementById("upload-error");
    if (err) {
      new MutationObserver(() => {
        const t = err.textContent.trim();
        if (t && !err.classList.contains("hidden")) toast(t.slice(0, 30));
      }).observe(err, { childList: true, characterData: true, subtree: true });
    }
  }

  function bindKeys() {
    if (!built || built.keysBound) return;
    if (!built.tabs.length) return;
    built.keysBound = true;
    document.addEventListener("keydown", (e) => {
      if (!document.documentElement.classList.contains("phone-mode")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.target.closest && e.target.closest("input,select,textarea")) return;
      const i = currentIndex();
      const n = e.key === "ArrowRight" ? Math.min(built.tabs.length - 1, i + 1) : Math.max(0, i - 1);
      if (n !== i) built.navBtns[n].click();
    });
  }

  // ---------- 开关 ----------
  function enable() {
    const b = build();
    document.documentElement.classList.add("phone-mode");
    if (!b.stage.isConnected) document.body.appendChild(b.stage);
    bindSwipe();
    bindObservers();
    bindKeys();
    tickClock();
    clearInterval(tickClock._t);
    tickClock._t = setInterval(tickClock, 15000);
    window.addEventListener("resize", fit);
    fit();
    syncIndex();
    localStorage.setItem(KEY, "phone");
    setTimeout(() => island("电子衣柜已就绪"), 800);
  }

  function disable() {
    if (built) {
      const { stage, topbar, main, footer, floats } = built;
      // 先放回业务 DOM，否则这些浮层会随外壳一起被移除
      (floats || []).forEach((f) => f.home && f.home.appendChild(f.node));
      if (topbar) document.body.appendChild(topbar);
      if (main) document.body.appendChild(main);
      if (footer) document.body.appendChild(footer);
      if (stage.isConnected) stage.remove();
      window.removeEventListener("resize", fit);
    }
    document.documentElement.classList.remove("phone-mode");
    localStorage.setItem(KEY, "web");
    addFloatToggle();
  }

  let floatBtn = null;
  function addFloatToggle() {
    if (floatBtn) return;
    floatBtn = el("button", "phone-toggle float");
    floatBtn.type = "button";
    floatBtn.textContent = "进入手机模拟";
    floatBtn.addEventListener("click", () => {
      floatBtn.remove();
      floatBtn = null;
      enable();
    });
    document.body.appendChild(floatBtn);
  }

  function boot() {
    if (desiredMode() === "phone") enable();
    else addFloatToggle();
  }

  window.PhoneShell = { enable, disable, island, toast, fit, sync: syncIndex, rebuildTabs: () => built && built.rebuildTabs && built.rebuildTabs() };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
