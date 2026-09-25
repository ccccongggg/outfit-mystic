/* web/safe-storage.js —— 碰 localStorage 之前一律先过这里
 *
 * 为什么需要：用 file:// 打开页面时，部分浏览器把文档当成「不透明来源」
 * （opaque origin，Chrome/Edge/Safari 都出现过），读写 localStorage 会直接抛
 * SecurityError: Access is denied for this document。
 * 而「双击 index.html 看手机模拟」恰好是我们最想支持的场景 ——
 * 一个存偏好失败，不该让外壳、导航形态、城市记忆整个炸掉。
 *
 * 语义：读不到就当作没存过（返回 fallback）；写不进就返回 false 静默放弃。
 * 代价只是「下次打开不记得上次的选择」，不影响任何主链路能力。
 * 页面里第一个加载，后面谁都可以用 window.SafeStore。
 */
window.SafeStore = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null || v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  getJSON(key, fallback = null) {
    const raw = window.SafeStore.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJSON(key, value) {
    try {
      return window.SafeStore.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },
};
