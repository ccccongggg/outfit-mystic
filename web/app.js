// web/app.js —— 三页合一：衣橱 / 入口 / 结果
// 引擎：analyze = 选款 + 逐件匹配度 + 整套分数；recommend / itemsByIds 仍可从 engine.js 单独引入
import { analyze } from "./engine.js";
import { install as installOracle } from "./oracle.js";
import { normalizeItems } from "./vocab.js";
import { startBusy, withBusy, isBusy } from "./busy.js";

const state = {
  items: [],
  samples: [],
  tarotCards: [],
  constraint: null,
  result: null,
  pendingManualId: null,
  useServer: true,
  pendingFile: null,
  // 入柜方式：cut=本地抠底（默认） / web=联网找白底图 / auto=先联网，失败回落抠图
  ingestMode: "cut",
  // 风格选择（三种方式共用一份结果）
  styleSel: {
    tags: [],
    prefs: { formality: 3, energy: 50, brightness: 55 },
    look: null,
  },
};

// 后台地址：页面由服务提供时优先用页面自身源（换端口也不会错），否则回落到默认 8787
const API_BASE = (() => {
  const o = (typeof location !== "undefined" && location.origin) || "";
  return o && o !== "null" && !o.startsWith("file") ? o : "http://127.0.0.1:8787";
})();

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

export function switchView(name) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === name));
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  document.documentElement.dataset.view = name;
  window.__oracle?.syncTabs?.(name);
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

/** JSON POST 小助手 */
function postJSON(url, body) {
  return fetchJSON(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

/** HTML 转义（候选图 reason 来自网络，必须转义后再拼进 innerHTML） */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 取 URL 主机名（候选图来源站点，展示用） */
function hostOf(u) {
  if (!u) return "";
  try {
    return new URL(u, API_BASE).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 服务端返回的路径（如 /api/findimg/...）拼成可请求地址 */
function absUrl(u) {
  if (!u) return "";
  return u.startsWith("http") ? u : API_BASE + (u.startsWith("/") ? u : "/" + u);
}

// ---------- 衣橱 ----------
function renderItems() {
  // 入柜后补一次口径归一：新入的单品也要进受控词表，否则「雾蓝」永远配不上「浅蓝」
  state.items = normalizeItems(state.items);
  const grid = $("#item-grid");
  grid.innerHTML = "";
  for (const it of state.items) {
    const card = document.createElement("article");
    card.className = "item-card";
    const season = (it.season || []).join("·") || "四季";
    const styles = (it.style_tags || []).map((t) => `<span class="tag">${t}</span>`).join("");
    const occ = (it.occasions || []).map((t) => `<span class="tag occ">${t}</span>`).join("");
    const sw = it.color_hex || "#ccc";
    // 结构化风格档案（schema v2：含材质 / 场合；老数据缺失时留空）
    const profile = [
      ["品类", it.category || "-"],
      ["类型", it.type || "-"],
      ["颜色", `${it.color_name || "-"}${it.color_hex ? " " + it.color_hex : ""}`],
      ["版型", it.fit || "-"],
      ["材质", it.material || "-"],
      ["图案", it.pattern || "-"],
      ["季节", season],
      ["场合", (it.occasions || []).join("、") || "-"],
      ["风格", (it.style_tags || []).join("、") || "-"],
      ["正式度", typeof it.formality === "number" ? it.formality : "-"],
    ]
      .map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`)
      .join("");
    card.innerHTML = `
      <img src="${imgSrc(it.image)}" alt="${it.type || "单品"}" onerror="this.style.opacity=0.15;this.alt='图缺失'" />
      <div class="item-meta">
        <div class="item-title">${it.color_name || "未命名"} · ${it.type || it.category || "单品"}</div>
        <div class="item-tags">
          <span class="tag swatch color" style="--sw:${sw}">${it.color_hex || ""}</span>
          <span class="tag">${it.fit || ""}</span>
          ${it.material ? `<span class="tag">${it.material}</span>` : ""}
          <span class="tag">${season}</span>
          ${styles}
          ${occ}
        </div>
        <details class="item-profile"><summary>风格档案</summary><div class="profile-grid">${profile}</div></details>
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
    state.items = normalizeItems(data.items || []);
    state.useServer = true;
    setServiceStatus(true, "已连接本地服务 · 抠底/打标/写入衣橱可用");
  } catch {
    state.useServer = false;
    try {
      const res = await fetch("data/items.json");
      state.items = normalizeItems(await res.json());
    } catch {
      state.items = [];
    }
    try {
      const local = JSON.parse(localStorage.getItem("outfit-mystic-local-items") || "[]");
      for (const it of local) {
        if (!state.items.some((x) => x.id === it.id)) state.items.push(it);
      }
      // 统一口径：所有单品都过一遍受控词表（8 风格 / 24 色 / 7 品类）
      state.items = normalizeItems(state.items);
    } catch {
      /* ignore */
    }
    setServiceStatus(false, "未连接到后台（python server/app.py）· 已切换本地入柜，刷新可能丢失");
  }
  renderItems();
  renderStyleControls(); // 示例图点选要用最新衣橱
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
    material: "其他",
    season: [],
    style_tags: [],
    occasions: [],
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

function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

/**
 * 录入端预检：识别「难以干净抠底」的图片（如人物上身照、杂乱背景）。
 * 原理：干净商品图四边应基本是纯白/纯色；若边界白像素占比过低，则自动抠底
 * 大概率残留背景或切不干净，提前告知用户改用「单件平铺、白底」图。
 */
async function analyzeCutDifficulty(file) {
  try {
    const img = await loadImageEl(file);
    const W = 64;
    const H = Math.max(1, Math.round((64 * img.naturalHeight) / img.naturalWidth));
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const isWhite = (r, g, b) => r > 240 && g > 240 && b > 240;
    let total = 0;
    let white = 0;
    for (let x = 0; x < W; x++) {
      for (const y of [0, H - 1]) {
        const i = (y * W + x) * 4;
        total++;
        if (isWhite(data[i], data[i + 1], data[i + 2])) white++;
      }
    }
    for (let y = 0; y < H; y++) {
      for (const x of [0, W - 1]) {
        const i = (y * W + x) * 4;
        total++;
        if (isWhite(data[i], data[i + 1], data[i + 2])) white++;
      }
    }
    const ratio = white / total;
    const hardToCut = ratio < 0.6;
    return {
      hardToCut,
      ratio,
      reason: hardToCut
        ? "背景不是纯白/纯色，自动抠底大概率残留背景或切不干净"
        : "",
    };
  } catch {
    return { hardToCut: false, ratio: 1, reason: "" };
  }
}

function hidePreview() {
  $("#preview-panel").classList.add("hidden");
  $("#preview-img").src = "";
  state.pendingFile = null;
}

/** 选图后先预览 + 规范检查，确认后才入柜 */
async function stageFile(file) {
  if (isBusy()) return; // 上一张还在处理，别把它的指示器抢走
  showUploadError("");
  hidePreview();
  showStatus(false);

  if (!rulesAcknowledged()) {
    showUploadError("请先勾选「我已按拍摄规范拍摄 / 选图」");
    return;
  }

  // 读图 + 预判抠底难度要过一遍像素，大图能到几百毫秒。
  // 这一段以前是完全静默的，看起来就像点了没反应。
  const b = startBusy($("#upload-busy"), {
    title: "正在检查这张图…",
    hints: ["看格式和分辨率够不够…", "预判一下背景好不好抠…"],
    showBar: false,
  });
  let check;
  let cut;
  try {
    check = await validateFile(file);
    if (check.ok) cut = await analyzeCutDifficulty(file);
  } finally {
    if (b) b.stop();
  }

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
  if (cut.hardToCut) {
    rows.push(
      `<div class="warn strong">⚠ 这张图${cut.reason}。建议改用「单件平铺、白底/纯色背景」的商品图；若坚持上传，将以原图入柜、由你手动补标签。</div>`
    );
  }
  $("#preview-checks").innerHTML = rows.join("");

  $("#dropzone").classList.add("disabled");
}

// ---------- 入柜方式：本地抠底 / 联网找白底图（两条路互补） ----------
const MODE_HINT = {
  cut: "用本地算法把你这张照片的背景去掉（离线可用，永远能跑通）。",
  web: "先识别你这件衣服，再去全网找它的白底商品图 —— 找到后由你挑一张入柜，找不到就回落抠图。",
  auto: "优先联网找白底图，找不到（或断网）自动回落到本地抠底，两条路都不耽误。",
};

function setIngestMode(mode) {
  state.ingestMode = mode;
  $$("#ingest-mode .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  $("#mode-hint").textContent = MODE_HINT[mode] || MODE_HINT.cut;
}

/** 联网搜到的白底图不替用户拍板：弹出来让人选。
 *  返回：候选 path（用它入柜）/ ""（改用自己那张的抠图）/ null（取消） */
function openFoundModal(found) {
  return new Promise((resolve) => {
    const modal = $("#found-modal");
    const grid = $("#found-grid");
    const cands = (found.candidates || []).slice(0, 5);

    $("#found-sub").textContent = found.verified
      ? `AI 已复核品类与颜色（检索词来自你这张图的结构化标签）· 共 ${cands.length} 个候选，点一张入柜`
      : `AI 复核不可用：${found.message || "VLM 无响应"} · 请目视确认后再入柜`;

    grid.innerHTML = cands
      .map(
        (c, i) => `
        <button type="button" class="found-item" data-path="${esc(c.path || "")}" data-i="${i}">
          <img src="${esc(absUrl(c.url || ""))}" alt="候选 ${i + 1}" loading="lazy" />
          <div class="found-meta">
            <span class="badge ${c.vlm && c.vlm.ok ? "ok" : "no"}">${c.vlm && c.vlm.ok ? "已复核" : "未通过"}</span>
            ${c.width || "?"}×${c.height || "?"} · 白底 ${Math.round((c.white_ratio || 0) * 100)}%
            <div class="found-src">${esc(hostOf(c.page_url) || "全网检索")}</div>
            <div>${esc((c.vlm && c.vlm.reason) || "")}</div>
          </div>
        </button>`
      )
      .join("");

    const close = (val) => {
      modal.classList.add("hidden");
      $("#btn-found-mine").onclick = null;
      $("#btn-found-cancel").onclick = null;
      modal.onclick = null;
      resolve(val);
    };

    $$(".found-item", grid).forEach((el) => {
      el.onclick = () => close(el.dataset.path || "");
    });
    $("#btn-found-mine").onclick = () => close("");
    $("#btn-found-cancel").onclick = () => close(null);
    modal.onclick = (e) => {
      if (e.target === modal) close(null);
    };

    modal.classList.remove("hidden");
  });
}

/** 一步：打标 → 联网搜图 → 人工挑 → 入柜。返回 {result} 或 {cancelled:true} */
async function runWebSearchPath(prepared, b) {
  setStep("cut", "done");
  setStep("tag", "done");

  // 没识别出品类/类型/颜色，搜出来的必然是噪声 —— 直接跳过，回落抠图
  const t = prepared.tags || {};
  if (!t.type && !t.category && !t.color_name) {
    return { failed: true, message: "这张图没识别出足够标签，无法联网搜同款" };
  }

  // 这一步是「全网检索 + AI 复核」，两个慢活叠在一起，必须让人看见在动
  b?.title("AI 正在全网找白底同款图…").hint("搜到候选后还要一张张复核，稍等");
  setStatusMsg("正在全网找白底同款图…");

  let found = null;
  try {
    found = await postJSON("/api/find_image", { tags: prepared.tags });
  } catch (err) {
    return { failed: true, message: err.message };
  }
  if (!found || !found.ok || !(found.candidates || []).length) {
    return { failed: true, message: (found && found.message) || "没找到候选" };
  }

  // 接下来是人在挑，不是 AI 在算 —— 停表停圈，别装作还在跑
  b?.pause("等你挑一张 · 这些是全网找到的白底图");
  const choice = await openFoundModal(found);
  if (choice === null) {
    showStatus(false);
    return { cancelled: true };
  }
  b?.resume("正在入柜…");
  b?.hint(choice ? "用你选中的白底图写入衣橱…" : "用你这张的抠图结果写入衣橱…");

  setStatusMsg(choice ? "用选中的白底图入柜…" : "用你这张的抠图结果入柜…");
  const body = { pending: prepared.pending };
  if (choice) body.found_path = choice;
  try {
    const result = await postJSON("/api/commit", body);
    return { result };
  } catch (err) {
    showStatus(false);
    showUploadError(`入柜失败：${err.message}`);
    return { cancelled: true };
  }
}

async function handleUpload(file) {
  if (!file || isBusy()) return;

  showStatus(true);
  setStep("cut", "on");
  setStep("tag", "");
  setStep("done", "");
  showUploadError("");

  const dropzone = $("#dropzone");
  dropzone.classList.add("disabled");

  await withBusy(
    $("#upload-busy"),
    {
      title: "AI 正在处理这件衣服…",
      hints: [
        "先去掉背景，把衣服单独抠出来…",
        "再看版型：宽松还是合身…",
        "接着判断主色和材质…",
        "最后把标签写进衣橱…",
      ],
      disable: [$("#btn-confirm"), $("#btn-pick"), $("#btn-camera")],
    },
    async (b) => {
      const mode = state.ingestMode;

      // 联网找白底图 / 自动：先打标拿结构化标签 → 全网搜同款 → 人挑 → 入柜
      if ((mode === "web" || mode === "auto") && state.useServer) {
        b.title("AI 正在看你这件衣服…").hint("先读出品类、颜色和版型，才好去全网找同款");
        setStatusMsg("正在识别这件衣服…");

        let prepared = null;
        try {
          const form = new FormData();
          form.append("file", file);
          prepared = await fetchJSON("/api/prepare", { method: "POST", body: form });
        } catch (err) {
          prepared = null; // 后台版本旧或不可达 → 走原来的抠图路径
        }

        if (prepared && prepared.pending) {
          const r = await runWebSearchPath(prepared, b);
          if (r.result) {
            await finishIngest(r.result, false);
            return;
          }
          if (r.cancelled) return;
          // 搜图没找到：直接把刚打完标的那张入柜（等价于抠底路径），不重复传文件
          b.title("正在入柜…").hint("联网没找到可信的白底图，改用你这张的抠图结果");
          setStatusMsg(`联网没找到可信的白底图（${r.message}）· 改用你这张的抠图结果…`);
          try {
            const res = await postJSON("/api/commit", { pending: prepared.pending });
            await finishIngest(res, false);
            return;
          } catch {
            /* commit 失败 → 落到下面的 /ingest 原路径 */
          }
        }
        b.hint("联网搜图不可用，回落 AI 抠图…");
        setStatusMsg("联网搜图不可用，回落 AI 抠图…");
      }

      b.title("AI 正在抠底…").hint("把背景去掉，只留下这件衣服");
      setStatusMsg("正在抠底…");

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
        b.title("后台连不上，改本地入柜…").hint("不调模型，直接入柜，标签由你手动补");
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

      await finishIngest(result, result.local);
    }
  );

  dropzone.classList.remove("disabled");
}

/** 入柜收尾：刷新列表 → 更新步骤条 → 需要时开手动补标 */
async function finishIngest(result, local) {
  // 列表刷新（服务端路径会重拉；本地路径已 push）
  if (!local) {
    await loadItems();
  }
  setStep("cut", result.item?.cut_ok ? "done" : "");
  setStep("tag", result.tag_ok ? "done" : "");
  setStep("done", "done");
  const fromWeb = result.item?.from_web_search;
  setStatusMsg(
    result.tag_ok
      ? fromWeb ? "已用联网白底图入柜 ✓" : "已入柜 ✓"
      : local
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
  // scrollIntoView 在 jsdom / 老 WebView 里可能不存在，别让它把入柜成功的结果一起带走
  if (grid && typeof grid.scrollIntoView === "function") {
    grid.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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
  // schema v2：手动补标也写入材质 / 场合，保证老数据补齐后能参与匹配
  const occasions = [...($("#m-occasion")?.selectedOptions || [])].map((o) => o.value);
  const payload = {
    id,
    category: $("#m-category").value,
    type: $("#m-type").value,
    color_name: $("#m-color-name").value || "未知",
    fit: $("#m-fit").value,
    material: $("#m-material")?.value || "其他",
    season,
    style_tags,
    occasions,
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

// ===== 内置示例衣物图：无素材也能跑通「抠底 → 打标 → 入柜」=====
async function loadSamples() {
  state.samples = [];
  if (state.useServer) {
    try {
      const data = await fetchJSON("/api/samples");
      state.samples = data.samples || [];
    } catch {
      state.samples = [];
    }
  }
  if (!state.samples.length) {
    try {
      const res = await fetch("data/samples.json");
      const j = await res.json();
      state.samples = (j.samples || []).map((s) => ({
        id: s.id,
        title: s.title,
        desc: s.desc,
        url: s.file,
        tags: s.tags || {},
      }));
    } catch {
      state.samples = [];
    }
  }
  renderSampleRow();
}

function renderSampleRow() {
  const row = $("#sample-row");
  if (!row) return;
  row.innerHTML = "";
  if (!state.samples.length) {
    row.innerHTML = '<div class="muted">示例素材未加载（web/data/samples.json）</div>';
    return;
  }
  for (const s of state.samples) {
    const card = document.createElement("div");
    card.className = "sample-card";
    const tags = [
      ...((s.tags && s.tags.style_tags) || []).map((t) => `<span class="tag">${t}</span>`),
      s.tags && s.tags.material ? `<span class="tag">${s.tags.material}</span>` : "",
      ...((s.tags && s.tags.occasions) || []).map((t) => `<span class="tag occ">${t}</span>`),
    ].join("");
    card.innerHTML = `
      <img src="${imgSrc(s.url)}" alt="${s.title}" />
      <div class="sc-body">
        <div class="sc-title">${s.title}</div>
        <div class="sc-desc">${s.desc || ""}</div>
        <div class="sc-tags">${tags}</div>
        <button class="btn small primary" data-sample="${s.id}">一键入柜</button>
      </div>`;
    row.appendChild(card);
  }
}

async function ingestSample(id) {
  const s = state.samples.find((x) => x.id === id);
  if (!s) return;
  showUploadError("");

  if (state.useServer) {
    if (isBusy()) return;
    showStatus(true);
    setStep("cut", "on");
    setStep("tag", "");
    setStep("done", "");
    setStatusMsg("示例图正在抠底…");

    const row = $("#sample-row");
    row?.classList.add("busy-lock");

    await withBusy(
      $("#upload-busy"),
      {
        title: "AI 正在处理这张示例图…",
        hints: ["先去掉背景…", "再识别品类、颜色和版型…", "写入衣橱…"],
      },
      async () => {
        try {
          const r = await fetchJSON("/api/ingest_sample", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          setStep("cut", r.item?.cut_ok ? "done" : "on");
          setStep("tag", "on");
          await loadItems();
          setStep("tag", r.tag_ok ? "done" : "");
          setStep("done", "done");
          setStatusMsg(
            `已入柜 ✓ ${r.item?.color_name || ""}${r.item?.type || ""}（${r.tag_ok ? "AI 打标" : "预置标签"}）`
          );
        } catch (err) {
          showStatus(false);
          showUploadError(`示例入柜失败：${err.message}`);
          return;
        }
        setTimeout(() => showStatus(false), 2200);
      }
    );

    row?.classList.remove("busy-lock");
    return;
  }

  // 无后台：用 samples.json 里预置的标签直接本地入柜（流程照样跑通）
  const newId = "w" + String(Date.now() % 10000).padStart(4, "0");
  const item = {
    id: newId,
    image: imgSrc(s.url),
    ...(s.tags || {}),
    palette: (s.tags && s.tags.palette) || [],
    source: "sample-preset",
    manual_override: false,
    cut_ok: false,
    _local: true,
  };
  state.items.push(item);
  saveLocalItem(item);
  renderItems();
  showUploadError(`已本地入柜：${s.title}（无后台，使用内置预置标签）`);
}

// ===== 风格选择：三种方式（标签勾选 / 滑动评分 / 示例图点选）=====
const STYLE_TAGS = ["温柔", "简约", "通勤", "街头", "运动", "甜美", "极简", "复古"];
const FORMALITY_LABEL = { 1: "很随意", 2: "休闲", 3: "日常", 4: "偏正式", 5: "很正式" };
const LOOKS = [
  {
    id: "neat",
    title: "通勤利落",
    style_tags: ["通勤", "简约"],
    occasion: "通勤",
    ids: ["w0003", "w0006", "w0012"],
    pref: { formality: 4, energy: 40, brightness: 60 },
  },
  {
    id: "cozy",
    title: "周末松弛",
    style_tags: ["简约", "温柔"],
    occasion: "休闲",
    ids: ["w0001", "w0006", "w0009"],
    pref: { formality: 2, energy: 35, brightness: 80 },
  },
  {
    id: "street",
    title: "街头有劲",
    style_tags: ["街头", "运动"],
    occasion: "休闲",
    ids: ["w0002", "w0008", "w0010"],
    pref: { formality: 2, energy: 85, brightness: 45 },
  },
];

function renderStyleControls() {
  const tp = $("#tag-picker");
  if (tp) {
    tp.innerHTML = STYLE_TAGS.map(
      (t) => `<button type="button" class="chip ${state.styleSel.tags.includes(t) ? "on" : ""}" data-tag="${t}">${t}</button>`
    ).join("");
  }

  const lp = $("#look-picker");
  if (lp) {
    lp.innerHTML = LOOKS.map((l) => {
      const thumbs = l.ids
        .map((id) => {
          const it = state.items.find((x) => x.id === id);
          return it ? `<img src="${imgSrc(it.image)}" alt="${it.color_name || it.type || ""}" />` : "";
        })
        .join("");
      return `
        <div class="look-card ${state.styleSel.look === l.id ? "on" : ""}" data-look="${l.id}" role="button" tabindex="0">
          <div class="look-thumbs">${thumbs}</div>
          <div class="look-title">${l.title}</div>
          <div class="look-tags">${l.style_tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
        </div>`;
    }).join("");
  }

  syncSliderLabels();
  renderStyleSummary();
}

function syncSliderLabels() {
  const p = state.styleSel.prefs;
  const f = $("#s-formality");
  if (f) {
    f.value = p.formality;
    $("#v-formality").textContent = `${p.formality}（${FORMALITY_LABEL[p.formality]}）`;
  }
  const e = $("#s-energy");
  if (e) {
    e.value = p.energy;
    $("#v-energy").textContent = String(p.energy);
  }
  const b = $("#s-brightness");
  if (b) {
    b.value = p.brightness;
    $("#v-brightness").textContent = String(p.brightness);
  }
}

function renderStyleSummary() {
  const s = state.styleSel;
  const look = s.look ? LOOKS.find((l) => l.id === s.look) : null;
  const parts = [
    `风格词：${s.tags.length ? s.tags.join("、") : "未选"}`,
    `正式度 ${s.prefs.formality} · 活力 ${s.prefs.energy} · 明度 ${s.prefs.brightness}`,
    `示例图：${look ? look.title : "未选"}`,
  ];
  const el = $("#style-summary");
  if (el) el.textContent = parts.join(" ｜ ");
}

function styleStory() {
  const s = state.styleSel;
  const bits = [];
  if (s.tags.length) bits.push("想要" + s.tags.join("、"));
  bits.push(`正式度${s.prefs.formality}（${FORMALITY_LABEL[s.prefs.formality]}）`);
  bits.push(s.prefs.energy >= 60 ? "有活力一点" : s.prefs.energy <= 40 ? "安静一点" : "活力适中");
  bits.push(s.prefs.brightness >= 70 ? "偏亮" : s.prefs.brightness <= 35 ? "偏暗" : "明暗适中");
  return "你自己定的风格：" + bits.join("，") + "。";
}

/** 三种选择方式 → 合成一份风格约束（schema 与塔罗同构，只是 source 不同） */
function buildStyleConstraint() {
  const s = state.styleSel;
  const look = s.look ? LOOKS.find((l) => l.id === s.look) : null;
  const tags = [...new Set([...(look ? look.style_tags : []), ...s.tags])];
  return {
    source: "style",
    occasion: (look && look.occasion) || null,
    occasions: look && look.occasion ? [look.occasion] : [],
    mood: null,
    must_colors: [],
    avoid_colors: [],
    must_categories: ["top", "bottom", "shoes"],
    weather: null,
    season: [],
    vibe: tags.join("/") || "自定义风格",
    style_tags: tags,
    story: styleStory(),
    formality: s.prefs.formality,
    prefs: { ...s.prefs },
    extra: { look: s.look || null },
  };
}

async function generateFromStyle() {
  const c = buildStyleConstraint();
  syncResultSource(c, "自定义风格");
  state.constraint = c;
  const dbg = $("#constraint-debug");
  if (dbg) dbg.textContent = JSON.stringify(c, null, 2);
  await runRecommend();
}

// ---------- 塔罗约束 ----------
function constraintFromTarot(card) {
  // 走「拿主意」那一层的同一份协议（带来源徽章 + 天气厚薄），引擎零改动
  const o = window.__oracle;
  if (o && o.constraintFromTarot) return o.constraintFromTarot(card);
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

/** 把当前约束来源同步到入口页 / 结果页（塔罗与非塔罗入口共用） */
function syncResultSource(c, label) {
  // 入口页：塔罗卡归位（避免与当前约束来源不一致——修「卡片不同步」）
  $("#tarot-deck")?.classList.remove("hidden");
  $("#tarot-flip")?.classList.add("hidden");

  // 调试区可见 constraint（验收 A4）
  $("#constraint-debug").textContent = JSON.stringify(c, null, 2);

  // 结果页：卡片区反映当前来源，不再固定显示「尚未抽牌」
  $("#result-tarot-img").classList.add("hidden");
  const ph = $(".story-card-placeholder");
  if (ph) {
    ph.textContent = `${label} · 已生成约束`;
    ph.classList.remove("hidden");
  }
  $("#result-story").textContent = c.story;
  $("#result-reason").textContent = "点「生成今日穿搭」，规则会从衣橱里选一套。";
  $("#result-meta").textContent = "";
  const ms = $("#match-summary");
  if (ms) ms.classList.add("hidden");
}

// 非塔罗入口：生成约束后复用现有展示区（不动 HTML/CSS），提示去结果页生成
function applyConstraint(c, label) {
  state.constraint = c;
  syncResultSource(c, label);
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
  $("#btn-tarot-ok")?.classList.remove("hidden");
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

/** 匹配度面板：整套分数 + 每件单品的分数条与命中理由 */
function renderMatchPanel(a) {
  const panel = $("#match-panel");
  if (!panel) return;

  const bars = a.perItem
    .map((p) => {
      const it = p.item;
      return `
        <div class="match-item">
          <img src="${imgSrc(it.image)}" alt="${it.type || ""}" onerror="this.style.opacity=0.2" />
          <div class="mi-main">
            <div class="mi-head">
              <b>${it.color_name || "单品"} · ${it.type || it.category || ""}</b>
              <span class="mi-score">${p.score}%</span>
            </div>
            <div class="mi-bar"><i style="width:${p.score}%"></i></div>
            <div class="mi-reasons">${p.reasons.join("；")}</div>
          </div>
        </div>`;
    })
    .join("");

  panel.innerHTML = `
    <div class="match-head">
      <h2>风格匹配度</h2>
      <div class="mh-score">${a.outfitScore}<small>%</small></div>
    </div>
    <div class="match-bar"><i style="width:${a.outfitScore}%"></i></div>
    <div class="match-note">${
      a.missing.length
        ? `衣橱里缺 ${a.missing.map(catName).join(" / ")}，整套不完整（已扣分）`
        : "三件套齐全 · 全部来自你衣橱里的真实单品"
    }${a.harmony.length ? " ｜ " + a.harmony.join("；") : ""}</div>
    <div class="match-list">${bars || '<div class="muted">没有可匹配的单品</div>'}</div>`;
}

function catName(cat) {
  return { top: "上装", bottom: "下装", shoes: "鞋履", outer: "外套", bag: "包" }[cat] || cat;
}

/** 搭配逻辑：把「为什么是这三件」拆成可核对的几条 */
function renderLogic(a, reason) {
  const panel = $("#logic-panel");
  if (!panel) return;
  const SLOT_LABEL = { top: "上装", bottom: "下装", shoes: "鞋", outer: "外套", dress: "连衣裙" };
  const catOf = (p) => p.category_std || p.category;
  const bySlot = (c) => a.picks.find((p) => catOf(p) === c);
  const onepiece = a.picks.some((p) => catOf(p) === "dress");
  const slotLine = ["top", "bottom", "shoes", "outer"]
    .map((c) => {
      if (onepiece && c === "bottom") return null;
      const p = bySlot(c);
      return `${SLOT_LABEL[c]} ${p ? `${p.color_name}·${p.type}` : "—"}`;
    })
    .filter(Boolean)
    .join(" ／ ");
  const lines = [];
  lines.push(
    `<li><b>槽位</b>：${slotLine}（取自衣橱真实 id：${a.picks.map((p) => p.id).join(", ")}）</li>`
  );
  // 注意 analyze() 的 picks 是单品本身，perItem 才是 { item, score, reasons }
  const styles = [...new Set(a.picks.flatMap((p) => p.style_tags || []))];
  lines.push(`<li><b>风格</b>：单品自带标签 ${styles.join("、") || "—"}；目标风格 ${
    (state.constraint?.style_tags || []).join("、") || "不限"
  }</li>`);
  lines.push(`<li><b>配色</b>：${a.harmony.join("；") || "上下明暗接近，走稳妥路线"}</li>`);
  lines.push(`<li><b>场合</b>：${state.constraint?.occasion || "日常"}（材质：${a.picks
    .map((p) => p.material || "—")
    .join(" / ")}）</li>`);
  lines.push(`<li><b>结论</b>：${reason}</li>`);
  panel.innerHTML = `<h2>搭配逻辑</h2><ol class="logic-list">${lines.join("")}</ol>`;
}

function renderResult(a, reason) {
  const picked = a.picks;
  const pickedIds = picked.map((p) => p.id);
  const byCat = {};
  for (const it of picked) byCat[it.category_std || it.category] = it;

  // 参考稿口径：上装 + 下装 + 鞋 + 外套，固定出 4 件
  const slots = [
    ["top", ".slot-top"],
    ["bottom", ".slot-bottom"],
    ["shoes", ".slot-shoes"],
    ["outer", ".slot-outer"],
  ];
  const onepiece = picked.some((p) => (p.category_std || p.category) === "dress");

  let filled = 0;
  for (const [cat, sel] of slots) {
    const root = $(sel);
    if (!root) continue;
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
      empty.textContent = onepiece && cat === "bottom" ? "连衣裙自带下装" : "待选";
    }
  }

  // 来源徽章：这一套是从哪个入口来的
  const badge = $("#result-source");
  const src = state.constraint && state.constraint.src;
  if (badge) {
    if (src) {
      badge.classList.remove("hidden");
      badge.innerHTML = `<i style="background:${esc(src.color || "#888780")}"></i>来自「<b>${esc(src.label)}</b>」· ${esc(src.board || "")}`;
    } else {
      badge.classList.add("hidden");
    }
  }

  const missing = slots.length - filled;
  const meta = [];
  meta.push(`选中 ${picked.length} 件 · 全部来自衣橱真实 id`);
  if (missing > 0) meta.push(`缺 ${missing} 件槽位，允许成套不完整`);
  meta.push(picked.map((i) => `${i.color_name || ""}${i.type || ""}(${i.id})`).join(" · "));

  $("#result-reason").textContent = reason;
  $("#result-meta").textContent = meta.join("\n");

  // 匹配度 + 搭配逻辑
  renderMatchPanel(a);
  renderLogic(a, reason);
  const ms = $("#match-summary");
  if (ms) {
    ms.classList.remove("hidden");
    ms.innerHTML = `<span>整套匹配度</span><b>${a.outfitScore}%</b>`;
  }

  state.result = {
    items: pickedIds,
    reason,
    constraint: state.constraint,
    score: a.outfitScore,
  };
  console.log("[result]", state.result);
  console.log("[constraint]", state.constraint);
}

async function runRecommend() {
  if (!state.constraint) {
    alert("先去「拿主意」挑一种定今天的方式：抽牌 / 拖电量 / 选人设 / 说一句话。");
    window.__oracle?.go("home");
    switchView("home");
    return;
  }
  if (isBusy()) return;

  // 规则选款是同步的、很快；慢的是后面那句 AI 文案
  const a = analyze(state.items, state.constraint);

  // 先切到结果页再等，否则用户点了按钮原地没反应，还以为没点上
  switchView("result");
  $("#match-summary")?.classList.add("hidden");
  $("#result-reason").textContent = "AI 正在写今天这句理由…";

  const reason = await withBusy(
    $("#result-busy"),
    {
      title: "AI 正在写今天这句理由…",
      hints: ["把牌义和这套衣服对上…", "挑一个能说出口的说法…"],
      disable: [$("#btn-run"), $("#btn-reroll")],
      busyText: "AI 正在写…",
      // 没接后台时理由是本地模板拼的，瞬间就完事 —— 那就别假装等过
      minVisible: state.useServer ? 420 : 0,
    },
    () =>
      writeReason(
        state.constraint.story || "今天适合温柔地对待自己",
        a.picks,
        state.constraint.vibe || ""
      )
  );

  renderResult(a, reason);
}

/**
 * 换一套（参考稿第 6 节）：把当前这套里随机一件记进「排除名单」再重算一次，
 * 保证换出来的不一样。
 */
export async function reroll() {
  const c = state.constraint;
  if (!c) return runRecommend();
  const a = analyze(state.items, c);
  if (a.picks.length) {
    const drop = a.picks[Math.floor(Math.random() * a.picks.length)].id;
    c.exclude_ids = [...new Set([...(c.exclude_ids || []), drop])];
  }
  await runRecommend();
}

// ---------- 启动 ----------
function bind() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // 入柜方式切换（AI 抠图 / 联网找白底图 / 自动）
  $$("#ingest-mode .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setIngestMode(btn.dataset.mode));
  });
  setIngestMode(state.ingestMode);

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

  // 内置示例图：一键入柜
  $("#sample-row")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sample]");
    if (btn) ingestSample(btn.dataset.sample);
  });

  // 风格选择 ①：标签勾选
  $("#tag-picker")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    const t = b.dataset.tag;
    const arr = state.styleSel.tags;
    const i = arr.indexOf(t);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(t);
    renderStyleControls();
  });

  // 风格选择 ②：滑动评分
  for (const [sel, key] of [
    ["#s-formality", "formality"],
    ["#s-energy", "energy"],
    ["#s-brightness", "brightness"],
  ]) {
    $(sel)?.addEventListener("input", (e) => {
      state.styleSel.prefs[key] = Number(e.target.value);
      syncSliderLabels();
      renderStyleSummary();
    });
  }

  // 风格选择 ③：示例图点选（选中会同步带动风格词与滑动条）
  const pickLook = (id) => {
    state.styleSel.look = state.styleSel.look === id ? null : id;
    const l = LOOKS.find((x) => x.id === id);
    if (state.styleSel.look && l) {
      state.styleSel.prefs = { ...l.pref };
      state.styleSel.tags = [...new Set([...state.styleSel.tags, ...l.style_tags])];
    }
    renderStyleControls();
  };
  $("#look-picker")?.addEventListener("click", (e) => {
    const c = e.target.closest("[data-look]");
    if (c) pickLook(c.dataset.look);
  });
  $("#look-picker")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const c = e.target.closest("[data-look]");
    if (c) {
      e.preventDefault();
      pickLook(c.dataset.look);
    }
  });

  $("#btn-gen-style")?.addEventListener("click", generateFromStyle);
  $("#btn-style-reset")?.addEventListener("click", () => {
    state.styleSel = { tags: [], prefs: { formality: 3, energy: 50, brightness: 55 }, look: null };
    renderStyleControls();
  });

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
  $("#btn-tarot-ok")?.addEventListener("click", runRecommend);
  $("#btn-reroll")?.addEventListener("click", reroll);
  $("#btn-back-entry").addEventListener("click", () => {
    resetTarot();
    // 换个板块：回到挂衣杆重新挑一种定今天的方式
    if (window.__oracle) window.__oracle.go("home");
    else switchView("home");
  });
}

// 测试钩子：jsdom 冒烟测试（scripts/test_intake.mjs）需要直接拿到这些内部函数。
// 只读引用，不改变任何业务行为。
if (typeof window !== "undefined") {
  window.__outfitApp = { state, setIngestMode, openFoundModal, esc, hostOf, absUrl, handleUpload, finishIngest };
}

async function init() {
  bind();
  await Promise.all([loadItems(), loadTarot()]);
  await loadSamples();      // 无素材时的内置示例图
  renderStyleControls();    // 风格选择的三种方式

  // 装「拿主意」这一层：抽屉 → 挂衣杆四板块 → 入口 → 统一约束
  // 传进去的能力就三个，引擎与结果页保持原样
  installOracle({
    state,
    switchView,
    runRecommend,
    imgSrc,
    onConstraint: (c) => {
      const dbg = $("#constraint-debug");
      if (dbg) dbg.textContent = JSON.stringify(c, null, 2);
    },
  });
}

init();
