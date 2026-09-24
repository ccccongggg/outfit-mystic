// web/app.js —— 三页合一：衣橱 / 入口 / 结果
import { recommend, itemsByIds } from "./engine.js";

const state = {
  items: [],
  tarotCards: [],
  constraint: null,
  result: null,
  pendingManualId: null,
  useServer: true,
  pendingFile: null,
};

// 后台固定走本地小服务（预览页与 8787 不同源时也可用；服务已开 CORS）
const API_BASE = "http://127.0.0.1:8787";

// 上传约束（与左侧规范文案保持一致）
const UPLOAD_RULES = {
  types: ["image/jpeg", "image/png", "image/webp"],
  maxMB: 10,
  minSide: 480,
};

// ---------- 工具 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 把历史 web/assets/... 或 /web/assets/... 规范成相对本页的 assets/... */
function imgSrc(path) {
  if (!path) return "";
  let p = String(path).replace(/\\/g, "/");
  if (p.startsWith("/web/")) p = p.slice(5);
  else if (p.startsWith("web/")) p = p.slice(4);
  else if (p.startsWith("/")) p = p.slice(1);
  return p;
}

function switchView(name) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === name));
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
}

async function fetchJSON(url, options) {
  const absolute = url.startsWith("http") ? url : API_BASE + url;
  let res;
  try {
    res = await fetch(absolute, options);
  } catch {
    // 退化为相对路径（若页面本身由 8787 提供）
    res = await fetch(url, options);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.message || j.stage || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

// ---------- 衣橱 ----------
function renderItems() {
  const grid = $("#item-grid");
  grid.innerHTML = "";
  for (const it of state.items) {
    const card = document.createElement("article");
    card.className = "item-card";
    const season = (it.season || []).join("·") || "四季";
    const styles = (it.style_tags || []).map((t) => `<span class="tag">${t}</span>`).join("");
    const sw = it.color_hex || "#ccc";
    card.innerHTML = `
      <img src="${imgSrc(it.image)}" alt="${it.type || "单品"}" onerror="this.style.opacity=0.15;this.alt='图缺失'" />
      <div class="item-meta">
        <div class="item-title">${it.color_name || "未命名"} · ${it.type || it.category || "单品"}</div>
        <div class="item-tags">
          <span class="tag swatch color" style="--sw:${sw}">${it.color_hex || ""}</span>
          <span class="tag">${it.fit || ""}</span>
          <span class="tag">${season}</span>
          ${styles}
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
}

function setServiceStatus(ok, msg) {
  const el = $("#service-status");
  if (!el) return;
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("ok", !!ok);
  el.classList.toggle("bad", !ok);
  el.textContent = msg || "";
}

async function loadItems() {
  // 优先服务端，失败则读本地 JSON + localStorage
  try {
    const data = await fetchJSON("/api/items");
    state.items = data.items || [];
    state.useServer = true;
    setServiceStatus(true, "已连接本地服务 · 抠底/打标/写入衣橱可用");
  } catch {
    state.useServer = false;
    try {
      const res = await fetch("data/items.json");
      state.items = await res.json();
    } catch {
      state.items = [];
    }
    try {
      const local = JSON.parse(localStorage.getItem("outfit-mystic-local-items") || "[]");
      for (const it of local) {
        if (!state.items.some((x) => x.id === it.id)) state.items.push(it);
      }
    } catch {
      /* ignore */
    }
    setServiceStatus(false, "未连接到后台（python server/app.py）· 已切换本地入柜，刷新可能丢失");
  }
  renderItems();
}

function saveLocalItem(item) {
  try {
    const raw = JSON.parse(localStorage.getItem("outfit-mystic-local-items") || "[]");
    raw.push(item);
    localStorage.setItem("outfit-mystic-local-items", JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

/** 无后台时：原图直接入柜 + 走手动标签，保证「确认入柜」有结果 */
async function localIngest(file) {
  const url = URL.createObjectURL(file);
  const dims = await readImageSize(file);
  const id = "w" + String(Date.now() % 10000).padStart(4, "0");
  const item = {
    id,
    image: url,
    category: "top",
    type: "其他",
    color_name: "待标注",
    color_hex: "#CCCCCC",
    palette: [],
    fit: "其他",
    pattern: "其他",
    season: [],
    style_tags: [],
    formality: 3,
    source: "local",
    manual_override: true,
    cut_ok: false,
    _local: true,
  };
  state.items.push(item);
  saveLocalItem({ ...item, image: url });
  renderItems();
  openManual(item);
  return {
    item,
    tag_ok: false,
    local: true,
    message: `本地入柜（${dims.w}×${dims.h}）· 请补标签；起后台可自动抠底打标`,
  };
}

function setStep(step, cls) {
  const el = $(`.status-steps [data-step="${step}"]`);
  if (!el) return;
  el.classList.remove("on", "done");
  if (cls) el.classList.add(cls);
}

function showStatus(show) {
  $("#upload-status").classList.toggle("hidden", !show);
}

function setStatusMsg(msg) {
  $("#upload-status .status-msg").textContent = msg || "";
}

function showUploadError(msg) {
  const el = $("#upload-error");
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function rulesAcknowledged() {
  return $("#rules-ack")?.checked;
}

/** 校验选中的照片是否满足录入规范 */
async function validateFile(file) {
  const issues = [];
  const warns = [];

  if (!UPLOAD_RULES.types.includes(file.type)) {
    issues.push("仅支持 JPG / PNG / WebP");
  }
  const mb = file.size / (1024 * 1024);
  if (mb > UPLOAD_RULES.maxMB) {
    issues.push(`图片过大（${mb.toFixed(1)}MB），请压缩到 ${UPLOAD_RULES.maxMB}MB 以内`);
  }

  let w = 0;
  let h = 0;
  try {
    const dims = await readImageSize(file);
    w = dims.w;
    h = dims.h;
    const shortSide = Math.min(w, h);
    if (shortSide < UPLOAD_RULES.minSide) {
      issues.push(`分辨率过低（${w}×${h}），短边需 ≥ ${UPLOAD_RULES.minSide}px`);
    }
    if (shortSide < 720) {
      warns.push("分辨率偏小，抠底/打标可能不够稳");
    }
    const ratio = w / h;
    if (ratio > 2.4 || ratio < 0.35) {
      warns.push("画幅过于极端，建议改成接近方形、单品居中");
    }
  } catch {
    issues.push("无法读取图片，请换一张");
  }

  return { ok: issues.length === 0, issues, warns, w, h };
}

function readImageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function hidePreview() {
  $("#preview-panel").classList.add("hidden");
  $("#preview-img").src = "";
  state.pendingFile = null;
}

/** 选图后先预览 + 规范检查，确认后才入柜 */
async function stageFile(file) {
  showUploadError("");
  hidePreview();
  showStatus(false);

  if (!rulesAcknowledged()) {
    showUploadError("请先勾选「我已按拍摄规范拍摄 / 选图」");
    return;
  }

  const check = await validateFile(file);
  if (!check.ok) {
    showUploadError("不符合录入规范：\n" + check.issues.join("\n"));
    return;
  }

  state.pendingFile = file;
  const panel = $("#preview-panel");
  panel.classList.remove("hidden");
  $("#preview-img").src = URL.createObjectURL(file);
  $("#preview-name").textContent = `${file.name || "照片"} · ${check.w}×${check.h} · ${(file.size / 1024).toFixed(0)}KB`;

  const rows = [];
  rows.push(`<div class="pass">✓ 格式与体积符合</div>`);
  rows.push(`<div class="pass">✓ 分辨率达标（${check.w}×${check.h}）</div>`);
  rows.push(`<div class="pass">✓ 请再目视确认：单件、无遮挡、完整入镜</div>`);
  for (const w of check.warns) rows.push(`<div class="warn">△ ${w}</div>`);
  $("#preview-checks").innerHTML = rows.join("");

  $("#dropzone").classList.add("disabled");
}

async function handleUpload(file) {
  if (!file) return;

  showStatus(true);
  setStep("cut", "on");
  setStep("tag", "");
  setStep("done", "");
  setStatusMsg("正在抠底…");
  showUploadError("");

  const form = new FormData();
  form.append("file", file);

  let result;
  try {
    result = await fetchJSON("/ingest", { method: "POST", body: form });
    setStep("cut", result.item?.cut_ok ? "done" : "on");
    setStep("tag", "on");
    setStatusMsg(result.tag_ok ? "打标完成，正在入柜…" : "VLM 不可用，准备手动标签…");
  } catch (err) {
    // 后台不可达 → 本地入柜，保证列表有反馈
    setStep("cut", "");
    setStatusMsg(`后台不可用（${err.message}）\n正在本地入柜…`);
    try {
      result = await localIngest(file);
      setStep("cut", "");
      setStep("tag", "on");
    } catch (e2) {
      setStatusMsg(`入柜失败：${e2.message}`);
      showStatus(false);
      showUploadError(`确认入柜失败：${err.message}\n请先启动后台：在 outfit-mystic 目录执行 python server/app.py`);
      return;
    }
  }

  // 列表刷新（服务端路径会重拉；本地路径已 push）
  if (!result.local) {
    await loadItems();
  }
  setStep("tag", result.tag_ok ? "done" : "");
  setStep("done", "done");
  setStatusMsg(
    result.tag_ok
      ? "已入柜 ✓"
      : result.local
        ? result.message || "已本地入柜（标签待补）✓"
        : "已入柜（标签待补）✓"
  );

  if (!result.tag_ok || !result.item?.category) {
    openManual(result.item);
  } else {
    $("#manual-panel").classList.add("hidden");
  }

  // 让用户立刻看到新单品
  const grid = $("#item-grid");
  grid?.scrollIntoView({ behavior: "smooth", block: "nearest" });

  setTimeout(() => showStatus(false), 2400);
}

function openManual(item) {
  if (!item) return;
  state.pendingManualId = item.id;
  $("#manual-panel").classList.remove("hidden");
  if (item.color_name) $("#m-color-name").value = item.color_name;
  if (item.category) $("#m-category").value = item.category;
  if (item.type) $("#m-type").value = item.type;
  if (item.fit) $("#m-fit").value = item.fit;
}

async function saveManual() {
  const id = state.pendingManualId;
  if (!id) return;
  const season = [...$("#m-season").selectedOptions].map((o) => o.value);
  const style_tags = [...$("#m-style").selectedOptions].map((o) => o.value);
  const payload = {
    id,
    category: $("#m-category").value,
    type: $("#m-type").value,
    color_name: $("#m-color-name").value || "未知",
    fit: $("#m-fit").value,
    season,
    style_tags,
    formality: 2,
    manual_override: true,
  };

  if (state.useServer) {
    try {
      await fetchJSON("/api/items/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      alert("保存失败：" + err.message);
      return;
    }
  } else {
    // 无服务端：本地改内存 + localStorage
    const it = state.items.find((x) => x.id === id);
    if (it) Object.assign(it, payload);
    try {
      localStorage.setItem("outfit-mystic-items", JSON.stringify(state.items));
    } catch {
      /* ignore */
    }
  }

  await loadItems();
  $("#manual-panel").classList.add("hidden");
  state.pendingManualId = null;
}

// ---------- 塔罗约束 ----------
function constraintFromTarot(card) {
  return {
    source: "tarot",
    occasion: "日常",
    mood: null,
    must_colors: card.must_colors || [],
    avoid_colors: card.avoid_colors || [],
    must_categories: ["top", "bottom", "shoes"],
    weather: null,
    season: card.season || [],
    vibe: card.vibe || "",
    style_tags: card.style_tags || [],
    story: card.story || "",
    extra: { card_id: card.id },
  };
}

// ===== 多入口约束生成（与塔罗同构，只改 source；引擎零改动，不动 HTML/CSS）=====
const MOODS = [
  { mood: "想被治愈", style_tags: ["温柔", "简约"], vibe: "soft / cozy", story: "今天适合温柔地对待自己，慢一点也没关系" },
  { mood: "元气满满", style_tags: ["运动", "街头"], vibe: "bright / energetic", story: "状态在线，穿点有劲的，今天要冲" },
  { mood: "安静独处", style_tags: ["极简", "复古"], vibe: "quiet / focused", story: "想把自己调成静音，选一身不吵的衣服" },
  { mood: "浪漫", style_tags: ["甜美", "温柔"], vibe: "soft / dreamy", story: "今天想有点甜，let it be gentle" },
  { mood: "松弛", style_tags: ["简约", "通勤"], vibe: "easy / relaxed", story: "不费力也好看，松弛感拉满" },
];
const WEATHERS = [
  { w: "晴", season: ["春", "夏", "秋"], avoid_colors: [], style_tags: ["简约"], vibe: "clear / light", story: "天晴，穿轻快点的" },
  { w: "雨", season: ["春", "秋", "冬"], avoid_colors: ["白"], style_tags: ["通勤"], vibe: "calm / practical", story: "下雨，深色更安心，别太娇气" },
  { w: "冷", season: ["秋", "冬"], avoid_colors: [], style_tags: ["复古", "通勤"], vibe: "warm / layered", story: "降温了，叠穿保暖优先" },
  { w: "热", season: ["夏"], avoid_colors: [], style_tags: ["运动", "简约"], vibe: "cool / airy", story: "好热，透气清爽最重要" },
  { w: "雪", season: ["冬"], avoid_colors: ["白"], style_tags: ["复古"], vibe: "quiet / snow", story: "下雪天，保暖又别全白撞景" },
];
const COLORS = [
  { name: "奶油白", must: ["奶油白", "米"] },
  { name: "雾蓝", must: ["蓝", "灰"] },
  { name: "橄榄绿", must: ["绿", "橄榄"] },
  { name: "砖红", must: ["红", "砖"] },
  { name: "卡其", must: ["卡其", "棕"] },
  { name: "浅紫", must: ["紫", "浅"] },
];
const OCCASIONS = [
  { o: "通勤", formality: 3, style_tags: ["通勤", "简约"], vibe: "neat / pro", story: "上班日，利落得体优先" },
  { o: "约会", formality: 2, style_tags: ["甜美", "温柔"], vibe: "soft / lovely", story: "约会局，温柔一点更对味" },
  { o: "出游", formality: 1, style_tags: ["运动", "街头"], vibe: "free / fun", story: "出去玩，舒服好动最关键" },
  { o: "聚会", formality: 3, style_tags: ["复古", "街头"], vibe: "bold / social", story: "聚会场合，有点态度更好" },
];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function baseConstraint(source, extra) {
  return Object.assign({
    source,
    occasion: null,
    mood: null,
    must_colors: [],
    avoid_colors: [],
    must_categories: ["top", "bottom", "shoes"],
    weather: null,
    season: [],
    vibe: "",
    style_tags: [],
    story: "",
    extra: {},
  }, extra);
}

function constraintFromMood() {
  const m = rnd(MOODS);
  return baseConstraint("mood", { mood: m.mood, style_tags: m.style_tags, vibe: m.vibe, story: `心情·${m.mood}：${m.story}` });
}
function constraintFromBlind() {
  const season = rnd([["春", "秋"], ["夏"], ["秋", "冬"], ["春", "夏"]]);
  const style = rnd([["温柔", "简约"], ["街头", "运动"], ["复古", "通勤"], ["甜美", "极简"]]);
  return baseConstraint("blind", { season, style_tags: style, vibe: "mystery / surprise", story: "盲盒：交给命运，今天穿它挑的那套" });
}
function constraintFromWeather() {
  const x = rnd(WEATHERS);
  return baseConstraint("weather", { weather: x.w, season: x.season, avoid_colors: x.avoid_colors, style_tags: x.style_tags, vibe: x.vibe, story: `天气·${x.w}：${x.story}` });
}
function constraintFromColor() {
  const c = rnd(COLORS);
  return baseConstraint("color", { must_colors: c.must, style_tags: [], vibe: "color / intent", story: `色彩·想穿${c.name}：用这个颜色定今天基调` });
}
function constraintFromOccasion() {
  const o = rnd(OCCASIONS);
  return baseConstraint("occasion", { occasion: o.o, formality: o.formality, style_tags: o.style_tags, vibe: o.vibe, story: `场合·${o.o}：${o.story}` });
}

// 非塔罗入口：生成约束后复用现有展示区（不动 HTML/CSS），提示去结果页生成
function applyConstraint(c, label) {
  state.constraint = c;
  $("#constraint-debug").textContent = JSON.stringify(c, null, 2);
  $("#result-tarot-img").classList.add("hidden");
  $(".story-card-placeholder")?.classList.remove("hidden");
  $("#result-story").textContent = c.story;
  $("#result-reason").textContent = "点「生成今日穿搭」，规则会从衣橱里选一套。";
  $("#result-meta").textContent = "";
  alert(`${label}已生成约束：\n${c.story}\n\n去「结果」页点「生成今日穿搭」。`);
}

async function loadTarot() {
  try {
    const res = await fetch("data/tarot.json");
    state.tarotCards = await res.json();
  } catch {
    state.tarotCards = [];
  }
}

function drawTarot() {
  if (!state.tarotCards.length) {
    alert("塔罗数据未加载");
    return;
  }
  const card = state.tarotCards[Math.floor(Math.random() * state.tarotCards.length)];
  state.constraint = constraintFromTarot(card);

  // 仪式感：翻牌
  $("#tarot-deck").classList.add("hidden");
  const flip = $("#tarot-flip");
  flip.classList.remove("hidden");
  const img = $("#tarot-img");
  img.src = imgSrc(card.image);
  img.alt = card.name;
  $("#tarot-name").textContent = `${card.name} · ${card.name_en || ""}`;

  // 调试区可见 constraint（验收 A4）
  $("#constraint-debug").textContent = JSON.stringify(state.constraint, null, 2);

  // 预填结果页
  const rimg = $("#result-tarot-img");
  rimg.src = imgSrc(card.image);
  rimg.classList.remove("hidden");
  $(".story-card-placeholder").classList.add("hidden");
  $("#result-story").textContent = state.constraint.story;
  $("#result-reason").textContent = "点「生成今日穿搭」，规则会从衣橱里选一套。";
  $("#result-meta").textContent = "";
}

function resetTarot() {
  state.constraint = null;
  $("#tarot-deck").classList.remove("hidden");
  $("#tarot-flip").classList.add("hidden");
  $("#constraint-debug").textContent = "";
}

// ---------- 推荐 + 理由 ----------
function templateReason(story, items, vibe) {
  if (items.length) {
    const first = items[0];
    const color = first.color_name || "喜欢的";
    const typ = first.type || "单品";
    const others = items
      .slice(1)
      .map((i) => `${i.color_name || ""}${i.type || ""}`.trim())
      .join("、");
    const pieces = `${color}的${typ}` + (others ? `，配上${others}` : "");
    const vibePart = vibe ? `，整套偏${vibe}` : "";
    return `「${story}」——所以为你选了${pieces}${vibePart}。穿上它，按自己的节奏来就好。`;
  }
  return `「${story}」——今天先从衣柜里轻轻挑几件。穿上它，按自己的节奏来就好。`;
}

async function writeReason(story, items, vibe) {
  if (!state.useServer) {
    return templateReason(story, items, vibe);
  }
  try {
    const data = await fetchJSON("/api/reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story, items, vibe }),
    });
    return data.reason || templateReason(story, items, vibe);
  } catch {
    return templateReason(story, items, vibe);
  }
}

function renderResult(pickedIds, reason) {
  const picked = itemsByIds(state.items, pickedIds);
  const byCat = {};
  for (const it of picked) byCat[it.category] = it;

  const slots = [
    ["top", ".slot-top"],
    ["bottom", ".slot-bottom"],
    ["shoes", ".slot-shoes"],
  ];

  let filled = 0;
  for (const [cat, sel] of slots) {
    const root = $(sel);
    const img = root.querySelector(".slot-img");
    const empty = root.querySelector(".slot-empty");
    const it = byCat[cat];
    if (it) {
      img.src = imgSrc(it.image);
      img.alt = it.type || cat;
      img.classList.remove("hidden");
      empty.classList.add("hidden");
      filled += 1;
    } else {
      img.classList.add("hidden");
      empty.classList.remove("hidden");
    }
  }

  const missing = 3 - filled;
  const meta = [];
  meta.push(`选中 ${picked.length} 件 · 全部来自衣橱真实 id`);
  if (missing > 0) meta.push(`缺 ${missing} 件槽位，允许成套不完整`);
  meta.push(picked.map((i) => `${i.color_name || ""}${i.type || ""}(${i.id})`).join(" · "));

  $("#result-reason").textContent = reason;
  $("#result-meta").textContent = meta.join("\n");
  state.result = {
    items: pickedIds,
    reason,
    constraint: state.constraint,
    score: 0,
  };
  console.log("[result]", state.result);
  console.log("[constraint]", state.constraint);
}

async function runRecommend() {
  if (!state.constraint) {
    alert("请先到「入口」抽一张塔罗牌");
    switchView("entry");
    return;
  }
  const pickedIds = recommend(state.items, state.constraint);
  const picked = itemsByIds(state.items, pickedIds);
  const reason = await writeReason(
    state.constraint.story || "今天适合温柔地对待自己",
    picked,
    state.constraint.vibe || ""
  );
  renderResult(pickedIds, reason);
  switchView("result");
}

// ---------- 启动 ----------
function bind() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  const dropzone = $("#dropzone");
  const fileInput = $("#file-input");
  const cameraInput = $("#camera-input");

  const openPicker = (input) => {
    if (!rulesAcknowledged()) {
      showUploadError("请先勾选「我已按拍摄规范拍摄 / 选图」");
      return;
    }
    input.click();
  };

  dropzone.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    openPicker(fileInput);
  });
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker(fileInput);
    }
  });
  $("#btn-pick")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openPicker(fileInput);
  });
  $("#btn-camera")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openPicker(cameraInput);
  });

  ["dragenter", "dragover"].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });
  dropzone.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) stageFile(f);
  });

  fileInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) stageFile(f);
    e.target.value = "";
  });
  cameraInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) stageFile(f);
    e.target.value = "";
  });

  $("#btn-confirm")?.addEventListener("click", () => {
    const f = state.pendingFile;
    if (!f) return;
    hidePreview();
    dropzone.classList.remove("disabled");
    handleUpload(f);
  });
  $("#btn-cancel")?.addEventListener("click", () => {
    hidePreview();
    dropzone.classList.remove("disabled");
    showUploadError("");
  });

  $("#manual-save").addEventListener("click", saveManual);

  const deck = $("#tarot-deck");
  deck.addEventListener("click", drawTarot);
  deck.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") drawTarot();
  });
  $("#btn-tarot").addEventListener("click", () => {
    resetTarot();
    requestAnimationFrame(drawTarot);
  });

  $$(".stub-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.closest(".entry-card")?.dataset.stub;
      const labelMap = { mood: "心情", blind: "盲盒", weather: "天气", color: "色彩", occasion: "场合" };
      const fnMap = { mood: constraintFromMood, blind: constraintFromBlind, weather: constraintFromWeather, color: constraintFromColor, occasion: constraintFromOccasion };
      const fn = fnMap[kind];
      if (fn) applyConstraint(fn(), labelMap[kind] || kind);
    });
  });

  $("#btn-run").addEventListener("click", runRecommend);
  $("#btn-back-entry").addEventListener("click", () => {
    resetTarot();
    switchView("entry");
  });
}

async function init() {
  bind();
  await Promise.all([loadItems(), loadTarot()]);
}

init();
