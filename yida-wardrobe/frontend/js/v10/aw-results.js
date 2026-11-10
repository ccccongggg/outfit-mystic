(function(){
 'use strict';
 const AW=window.AW,W=window.AW_WARDROBE;
 const AI_IMG='assets/demo-clothes/ai_outfit_model.png';
 const AI_PIECES=[['上装','0% 0%'],['下装','0% 100%'],['包袋','100% 0%'],['鞋履','100% 100%']];
 /* 旧版卡通槽位 id → 真实衣橱品类（只为兼容改动前已持久化的搭配记录） */
 const LEGACY={'purple-top':'top','cream-top':'top','blue-top':'top','navy-skirt':'bottom','blue-jeans':'bottom','white-shoes':'shoe','beige-bag':'bag','black-bag':'bag'};
 const aiSet=reason=>({id:'ai-1',name:'AI 参考｜完整穿搭灵感',source:'ai_reference',items:AI_PIECES.map(pair=>({id:'ai-'+pair[0],kind:pair[0],name:pair[0],image:AI_IMG,bgPos:pair[1]})),reason});
 const resolve=item=>{
  if(!item||item.source==='ai_reference')return item;
  const live=W&&(W.byId(item.ref||item.id)||(LEGACY[item.id]?W.ofCategory(LEGACY[item.id])[0]:null));
  return live||item;
 };
 const sourceLabel=x=>x.source==='wardrobe'?'来自我的衣柜':'AI 推荐参考｜不是你衣柜里的衣服';
 const sourceName=s=>({tarot:'塔罗牌',social_energy:'社交电量',identity:'身份扮演',input:'跃然搭配'})[s.type]||'玩法';
 function reason(source,index){
  const lead={tarot:'参考三张牌的关键词，先满足天气和活动需求，再调整整套的轮廓与层次。',social_energy:`社交电量 ${source.payload.value} / 100：把存在感和维护负担调到这一天愿意投入的程度。`,identity:`「${source.payload.identity}」只是表达方向，衣服仍需适合今天的场合与体感。`,input:`根据「${source.payload.raw_text}」提取场合、活动和明确偏好，再从衣柜找完整搭配。`}[source.type]||'先满足真实穿着需求，再做整体搭配。';
  return index===0?lead:`同一需求下的第 ${index+1} 套方案：保留适合场合的主线，改变视觉重点。`;
 }
 const SLOTS=[{cat:'top',kind:'上装'},{cat:'bottom',kind:'下装'},{cat:'bag',kind:'包袋'},{cat:'shoe',kind:'鞋履'}];
 /* TONES.styles 必须用受控 8 风格（简约/通勤/文艺/甜美/运动/复古/明艳/慵懒），
    否则 data 归一化后（如 温柔→文艺、精致→简约）这里会一个都匹配不上、推荐静默降级。
    校验：normalize_vocab.py 报告 style⊄8 = 0。 */
 const TONES=[
  {tail:'轻盈层次',like:['白','米','柔','浅','奶油','杏'],styles:['文艺','简约','甜美']},
  {tail:'自在通勤',like:['蓝','黑','灰','卡其','藏','白'],styles:['通勤','简约']},
  {tail:'沉静层次',like:['黑','棕','咖','灰','砖','深'],styles:['复古','简约']}
 ];
 function pickSlot(slot,tone,used){
  const score=it=>{let s=0;const cn=(it.colorName||'')+(it.name||'');for(const k of tone.like)if(cn.includes(k))s+=2.2;for(const st of tone.styles)if((it.styles||[]).includes(st))s+=1.6;return s+1.4-Math.abs((it.formal||2)-2)*.7+Math.random()*.85};
  let pool=W.ofCategory(slot.cat).filter(x=>!used.includes(x.id));
  if(!pool.length)pool=W.items().filter(x=>!used.includes(x.id));
  if(!pool.length)return null;
  const ranked=pool.map(it=>({it,s:score(it)})).sort((a,b)=>b.s-a.s).slice(0,3);
  return ranked[AW.randomIndex(ranked.length)].it;
 }
 function make(source,state){
  const all=W?W.items():[];
  if(!state.wardrobeReady||!all.length)return[aiSet('这是一套参考灵感，图中单品不属于你的衣柜。')];
  const sets=TONES.map((tone,i)=>{
   const used=[],items=[];
   for(const slot of SLOTS){const it=pickSlot(slot,tone,used);if(!it)break;used.push(it.id);items.push(Object.assign({},it,{kind:slot.kind}))}
   return {id:`wardrobe-${i+1}`,name:`${items[0]?items[0].colorName:''}${tone.tail}`,source:'wardrobe',items,reason:reason(source,i)};
  }).filter(x=>x.items.length===SLOTS.length);
  if(!sets.length)return[aiSet('衣柜数据还没读到，先给一套参考灵感。')];
  if(source.type==='input'&&source.payload?.selected_items?.length===4){
   sets[0]={id:'wardrobe-yueran',name:'从衣柜跃出的这一套',source:'wardrobe',items:source.payload.selected_items,reason:source.payload.selected_reason||reason(source,0)};
  }
  sets.push(aiSet('这是系统提供的参考方向，展示单品不属于你的衣柜。'));
  return sets;
 }
 async function open(source,inline=false){
  AW.state.resultSource=source.type;AW.state.resultIndex=0;AW.state.resultContext=source;AW.setBusy(true);
  if(!inline){AW.go('results');AW.showStatus('loading','正在生成整套穿搭')}
  try{if(W&&W.refresh)await W.refresh().catch(()=>{});AW.state.results=await AW.api.recommend(source);AW.state.resultError=null;AW.save();if(!inline)AW.render();return AW.state.results}
  catch(e){AW.state.resultError=e.message;AW.save();if(!inline)AW.showStatus('error',e.message,()=>open(source,false));throw e}
  finally{AW.setBusy(false)}
 }
 function board(set){
  return `<div class="aw-outfit-board">${set.items.map((item,i)=>{
   const kind=item.kind||['上装','下装','包袋','鞋履'][i];
   if(item.bgPos||item.source==='ai_reference')return `<div class="aw-outfit-piece" style="background-image:url('${item.image}');background-size:200% 200%;background-position:${item.bgPos||'50% 50%'};background-repeat:no-repeat"><small>${AW.escape(kind)}</small></div>`;
   const live=resolve(item);
   return `<div class="aw-outfit-piece"><img src="${AW.escape(live.image||item.image||'')}" alt="${AW.escape(live.name||item.name||'')}"><small>${AW.escape(kind)}</small></div>`;
  }).join('')}</div>`;
 }
 function compact(set){return `<div class="aw-inline-result aw-card"><div class="aw-source ${set.source==='ai_reference'?'ai':''}">${sourceLabel(set)}</div><h3>${AW.escape(set.name)}</h3>${board(set)}<p>${AW.escape(set.reason)}</p><div class="aw-button-row"><button class="aw-button secondary" data-aw-go="results">查看整套与操作</button></div></div>`}
 function render(){
  const s=AW.state,list=s.results||[];
  if(s.resultError)return AW.status('error',s.resultError,true);
  if(!list.length)return `<section class="aw-page aw-result-page"><div class="aw-kicker">RESULT</div><h1>推荐结果</h1>${AW.status('empty','还没有推荐。先完成一个玩法，再来看这里。')}<button class="aw-button secondary full" data-aw-go="menu">选择玩法</button></section>`;
  const i=Math.min(s.resultIndex,list.length-1),set=list[i];s.resultIndex=i;
  return `<section class="aw-page aw-result-page"><div class="aw-kicker">${sourceName(s.resultContext||{type:s.resultSource})}</div><h1>给今天的一套答案</h1><label class="aw-date-field">穿搭日期 <input type="date" id="aw-result-date" value="${AW.escape(s.targetDate||AW.today())}"></label><div class="aw-result-carousel" id="aw-result-carousel"><div class="aw-result-frame aw-card"><div class="aw-result-head"><div><span class="aw-source ${set.source==='ai_reference'?'ai':''}">${sourceLabel(set)}</span><h2>${AW.escape(set.name)}</h2></div><span class="aw-page-count">${i+1} / ${list.length}</span></div>${board(set)}</div></div><div class="aw-carousel-nav"><button data-aw-prev aria-label="上一套">‹</button><span>${i+1} / ${list.length}</span><button data-aw-next aria-label="下一套">›</button></div><div class="aw-card aw-reason"><b>为什么推荐这套</b><p>${AW.escape(set.reason)}</p></div><div class="aw-button-row aw-result-ops"><button class="aw-button secondary" data-aw-piece ${set.source==='ai_reference'?'disabled':''}>换一件</button><button class="aw-button secondary" data-aw-set>换一套</button></div><button class="aw-button full" data-aw-confirm ${set.source==='ai_reference'?'disabled':''}>就穿这套</button>${set.source==='ai_reference'?'<p class="aw-ai-warning">参考穿搭不能记为已穿；建好衣柜后可获取自己的方案。</p>':''}<div class="aw-modal-host" id="aw-modal-host"></div></section>`;
 }
 function bind(root){
  const s=AW.state,list=s.results||[];
  root.querySelector('[data-aw-retry]')?.addEventListener('click',()=>s.resultContext?open(s.resultContext,false):AW.go('menu'));
  if(!list.length||s.resultError)return;
  root.querySelector('#aw-result-date')?.addEventListener('change',e=>{s.targetDate=e.target.value||AW.today();AW.save()});
  const turn=delta=>{s.resultIndex=(s.resultIndex+delta+list.length)%list.length;AW.render()};
  root.querySelector('[data-aw-prev]')?.addEventListener('click',()=>turn(-1));root.querySelector('[data-aw-next]')?.addEventListener('click',()=>turn(1));
  let start=0;root.querySelector('#aw-result-carousel')?.addEventListener('pointerdown',e=>start=e.clientX);
  root.querySelector('#aw-result-carousel')?.addEventListener('pointerup',e=>{const dx=e.clientX-start;if(Math.abs(dx)>45)turn(dx<0?1:-1)});
  root.querySelector('[data-aw-piece]')?.addEventListener('click',()=>{
   const set=list[s.resultIndex];if(set.source!=='wardrobe')return;
   if(set.id==='wardrobe-yueran'){
    const next=AW.modules.yueran?.replacement(set.items[0],set.items.map(x=>x.id),s.input);
    if(!next){AW.toast('暂时没有同类替换');return}
    set.items[0]=next;set.name='从衣柜跃出的这一套 · 微调';set.reason='保留原来的场合与体感方向，只更换第一件，并重新检查整套的颜色关系。';
   }else{
    const old=set.items[0],cat=old.category||LEGACY[old.id]||'top';
    const alt=W&&W.pick(cat,set.items.map(x=>x.id));
    if(!alt){AW.toast('暂时没有同类替换');return}
    set.items[0]=Object.assign({},alt,{kind:old.kind||'上装'});set.name+=' · 微调';set.reason='只更换上装，整套的场合适配和颜色关系保持一致。';
   }
   AW.save();AW.toast('已换一件');AW.render();
  });
  root.querySelector('[data-aw-set]')?.addEventListener('click',()=>turn(1));
  root.querySelector('[data-aw-confirm]')?.addEventListener('click',()=>confirmCurrent(root));
 }
 function confirmCurrent(root){
  const s=AW.state,set=s.results[s.resultIndex];if(!set||set.source!=='wardrobe'){AW.toast('AI 参考不能记为已穿');return}
  const date=s.targetDate||AW.today(),existing=s.records[date];
  const host=root.querySelector('#aw-modal-host');
  const submit=async()=>{host.innerHTML='';AW.setBusy(true);try{await AW.api.confirm(set);s.records[date]={date,source:'wardrobe',name:set.name,items:set.items,reason:set.reason,game:s.resultSource};AW.save();AW.toast(existing?'已覆盖当天穿搭':'已记录这套穿搭');AW.go('records')}catch(e){AW.toast('保存失败：'+e.message)}finally{AW.setBusy(false)}};
  if(!existing){submit();return}
  host.innerHTML=`<div class="aw-modal-shade"><div class="aw-modal aw-card" role="dialog" aria-modal="true"><h3>覆盖 ${date} 的穿搭？</h3><p>这天已经记录「${AW.escape(existing.name)}」。确认后将以当前方案替换。</p><div class="aw-button-row"><button class="aw-button secondary" data-aw-cancel>取消</button><button class="aw-button" data-aw-accept>确认覆盖</button></div></div></div>`;
  host.querySelector('[data-aw-cancel]').onclick=()=>host.innerHTML='';host.querySelector('[data-aw-accept]').onclick=submit;
 }
 window.AW_RESULTS={make,open,compact,board,sourceLabel};
 AW.modules.results={render,bind};
})();
