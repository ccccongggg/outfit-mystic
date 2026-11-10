// scripts/_pick_for_smoke.mjs —— DoD 冒烟 A5 专用：真调 web/engine.js 选款
// 用法: echo '{"items":[...],"constraint":{...}}' | node scripts/_pick_for_smoke.mjs
// 输出: {"ids":[...],"picks":[...],"slots":[...],"missing":[...],"outfitScore":n}
// 为什么单独一个文件: smoke_dod.py 是 Python, 必须借 Node 才能跑前端引擎;
// 之前 A5 用 Python 内联「按品类各挑一件」冒充, 不算真调引擎。
import { loadEngine } from "./_web_loader.mjs";

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
const items = input.items || [];
const constraint = input.constraint || {};

const { recommend, analyze } = loadEngine();
const ids = recommend(items, constraint);
const a = analyze(items, constraint);

process.stdout.write(
  JSON.stringify({
    ids,
    picks: (a.picks || []).map((p) => p.id),
    slots: a.slots || [],
    missing: a.missing || [],
    outfitScore: a.outfitScore,
    perItem: (a.perItem || []).map((p) => ({
      id: p.item && p.item.id,
      score: p.score,
      reasons: p.reasons,
    })),
  })
);
