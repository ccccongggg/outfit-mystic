(function(){
 'use strict';
 const AW=window.AW;
 const explain=v=>v<=20?'今天想省一点对外消耗，衣服以熟悉、轻维护为先。':v<=40?'保留体面感，减少需要一直照看的细节。':v<=60?'让表达和舒适保持平衡，层次适中。':v<=80?'可以主动一些，让造型有清楚的视觉重点。':'今天愿意承接更多目光，但天气和场合仍然优先。';
 function render(){
  const n=Math.max(1,Math.min(100,Number(AW.state.energy)||1));AW.state.energy=n;
  return `<section class="aw-page aw-energy-page aw-game-page">
   <div class="aw-cosmic-stage" aria-hidden="true"><span class="aw-page-orb"></span></div>
   <div class="aw-kicker">SOCIAL ENERGY · ${AW.escape(AW.state.targetDate)}</div>
   <h1>今天的社交电量</h1>
   <p class="aw-energy-intro">拖动到 1–100 之间的任意数值。它调整表达强度，不等同于心情或人数。</p>
   <div class="aw-energy-body aw-card">
    <div class="aw-energy-display"><span class="aw-energy-orbit" aria-hidden="true"></span><strong class="aw-energy-number" id="aw-energy-number">${n}</strong><span class="aw-energy-denom">/ 100</span></div>
    <input id="aw-energy-range" type="range" min="1" max="100" value="${n}" style="--fill:${(n-1)/99*100}%" aria-label="社交电量">
    <div class="aw-energy-scale"><span>更省力</span><span>更主动</span></div>
   </div>
   <div class="aw-energy-explain aw-card"><span class="aw-energy-spark" aria-hidden="true">✦</span><span id="aw-energy-explain-text">${explain(n)}</span></div>
   <button class="aw-button full aw-gold-cta" id="aw-energy-submit"><span>按这个电量搭一套</span><span class="aw-cta-arrow" aria-hidden="true">›</span></button>
  </section>`;
 }
 function bind(root){
  const range=root.querySelector('#aw-energy-range');
  range.oninput=()=>{
   const n=Number(range.value);AW.state.energy=n;AW.save();
   root.querySelector('#aw-energy-number').textContent=n;
   root.querySelector('#aw-energy-explain-text').textContent=explain(n);
   range.style.setProperty('--fill',`${(n-1)/99*100}%`);
  };
  root.querySelector('#aw-energy-submit').onclick=()=>window.AW_RESULTS.open({type:'social_energy',payload:{value:AW.state.energy}}).catch(e=>AW.toast(e.message));
 }
 AW.modules.energy={render,bind};
})();
