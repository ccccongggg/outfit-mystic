(function(){
 'use strict';
 const AW=window.AW, W=window.AW_WARDROBE;
 const labels={top:'上装',outer:'外套',bottom:'下装',dress:'连衣裙',shoe:'鞋',bag:'包',acc:'配饰'};
 /* 真实电子衣橱目录：aw-wardrobe.js 归一化后的单品（id/name/image/category/color/styles…） */
 const all=()=>W?W.items():[];
 const byId=id=>W?W.byId(id):null;
 const examples=['陪客户吃饭，但下午要骑车过去','降温了，想穿得暖但不臃肿','周末逛展，想安静一点','第一次约会，别太用力'];
 const occasions=[[/客户|面试|汇报|正式|会议|开会|婚礼|宴会|酒会|签约|答辩|谈判/,5,'正式'],[/通勤|上班|加班|职场|工作|提案/,4,'通勤'],[/约会|见人|拍照|下午茶|朋友|生日|聚会|看展|逛展/,3,'半正式'],[/逛街|咖啡|书店|散步|旅行|出游|周末/,2,'休闲'],[/运动|健身|跑步|骑车|爬山|徒步|打球|接送/,1,'运动']];
 const seasons=[[/冷|凉|降温|风大|深秋|入冬|下雪|雪|寒|冻/,'cold','偏凉'],[/热|晒|闷|高温|出汗|炎夏|暖|初夏/,'hot','偏热']];
 /* 风格识别词：受控 8 风格优先；其余是「意图捕获」口语词（用户会打出来但不在 8 内）。
    识别到后统一经 normStyle 归一到受控 8，再与单品 style_tags_cn 比对——否则数据
    归一化后（如 温柔→文艺）这里会一个都匹配不上、推荐静默降级。 */
 const STY_SYN=(window.OutfitVocab&&window.OutfitVocab.style_synonyms)||{};
 const normStyle=t=>STY_SYN[t]||t;
 const styles=['简约','通勤','文艺','甜美','运动','复古','明艳','慵懒','正式','职场','温柔','日系','帅气','街头','休闲','学院','高级','约会','极简','户外','基础'];
 const colors=['黑','白','灰','米','驼','卡其','蓝','藏青','棕','酒红','红','绿','粉','金','咖'];
 let token=0;
 const picOf=it=>`<img class="aw-yue-pic" src="${AW.escape(it.image||'')}" alt="${AW.escape(it.name)}">`;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function parse(text){
  let formal=null,occasion='',occasionWord='',activity='';
  for(const [re,value,label] of occasions){const m=text.match(re);if(!m)continue;if(formal===null||value>formal){formal=value;occasion=label;occasionWord=m[0]}if(value<=2&&!activity)activity=m[0]}
  if(formal!==null&&activity&&formal>=4){formal--;occasion='偏正式但要好动'}
  let season=null,seasonLabel='',seasonWord='';
  for(const [re,value,label] of seasons){const m=text.match(re);if(m&&!season){season=value;seasonLabel=label;seasonWord=m[0]}}
  return {text,formal,occasion,occasionWord,activity,season,seasonLabel,seasonWord,styles:styles.filter(x=>text.includes(x)),colors:colors.filter(x=>text.includes(x))};
 }
 function tags(p){const out=[];if(p.occasion)out.push(['场合',p.occasion]);if(p.seasonLabel)out.push(['体感',p.seasonLabel]);if(p.styles.length)out.push(['风格',p.styles.join(' / ')]);if(p.colors.length)out.push(['色彩',p.colors.join(' / ')]);return out.length?out:[['提示','没读到硬约束，按日常通勤处理']]}
 function luminance(hex){const c=hex.slice(1);return (parseInt(c.slice(0,2),16)*.2126+parseInt(c.slice(2,4),16)*.7152+parseInt(c.slice(4,6),16)*.0722)/255}
 function pick(categoryName,p,exclude,darkCount){
  let pool=all().filter(it=>it.category===categoryName&&!exclude.includes(it.id));
  if(p.season)pool=pool.filter(it=>it.season===p.season||it.season==='all');
  const ranked=pool.map(it=>{
   let score=0;if(p.season)score+=it.season===p.season?3:1.4;
   if(p.formal!==null)score+=3.2-Math.abs(it.formal-p.formal)*1.35;
   for(const style of p.styles){const ns=normStyle(style);if((it.styles||[]).some(x=>normStyle(x)===ns))score+=2.6;}
   for(const color of p.colors)if((it.colorName||'').includes(color)||it.name.includes(color))score+=3;
   if(darkCount>=2)score+=luminance(it.color)>=.55?4.2:-1.8;
   return {it,score:score+Math.random()*.85};
  }).sort((a,b)=>b.score-a.score).slice(0,3);
  return ranked.length?ranked[AW.randomIndex(ranked.length)].it:null;
 }
 function buildOutfit(p,exclude=[]){
  const useDress=p.formal!==null&&p.formal>=3&&AW.randomIndex(10)<4;
  const plan=useDress?['dress','shoe','bag','acc']:p.season==='cold'?['top','outer','bottom','shoe']:['top','bottom','shoe',p.formal!==null&&p.formal>=3?'bag':'outer'];
  const out=[];
  for(const kind of plan){const it=pick(kind,p,exclude.concat(out.map(x=>x.id)),out.filter(x=>luminance(x.color)<.34).length);if(it)out.push(it)}
  for(const kind of ['shoe','bag','acc','top','outer']){if(out.length>=4)break;const it=pick(kind,p,exclude.concat(out.map(x=>x.id)),out.filter(x=>luminance(x.color)<.34).length);if(it)out.push(it)}
  return out.slice(0,4);
 }
 function reasonFor(p,out){
  const values=out.map(it=>it.formal),average=(values.reduce((sum,n)=>sum+n,0)/values.length).toFixed(1);
  const high=out[values.indexOf(Math.max(...values))],low=out[values.indexOf(Math.min(...values))],span=Math.max(...values)-Math.min(...values);
  const dark=out.filter(it=>luminance(it.color)<.34).length,light=out.length-dark;
  const needFormal=p.formal>=4?'体面':p.formal===3?'拿得出手':'松快';
  const needSeason=p.season==='cold'?'保暖':p.season==='hot'?'透气':'好动';
  const other=p.seasonWord||p.activity;
  const first=p.occasionWord&&other?`你这句里的「${p.occasionWord}」和「${other}」其实是两件事——一个要${needFormal}，一个要${p.seasonWord?needSeason:'好动'}。所以这套没往任何一头走极端，正式度压在 ${average} 这一档。`:p.occasionWord?`你要的是「${p.occasionWord}」，整套的正式度就压在 ${average} 这一档——${p.formal>=4?'站得住，但不至于端着':'不用力，但见人也不虚'}。`:p.seasonWord?`你提到「${p.seasonWord}」，所以整套先照顾${needSeason}，别的往后排。`:`没读到硬约束，这套按日常的稳妥来：正式度 ${average}，不出错优先。`;
  const order=['top','outer','dress','bottom','shoe','bag','acc'];
  const role=it=>{const bright=luminance(it.color)>=.34;return {top:bright?'定个干净的调子':'把调子压住',outer:'罩在外面压住整体',dress:'一件定全套',bottom:bright?'把下身提亮':'收住下身',shoe:'兜住要走的那段路',bag:bright?'把亮度提上来一档':'收住不让它飘',acc:bright?'补一点亮':'压个边'}[it.category]||'补位'};
  const chain=order.map(kind=>out.find(it=>it.category===kind)).filter(Boolean).map(it=>`${it.name}${role(it)}`);
  const second=`${chain.join('，')}。这几件是一条线，谁都不是单独最好看的那件，凑一起才是这套。`;
  const balance=dark===0?'四件全浅，整套是清透的':light===0?'四件全深，靠版型和材质分层次':dark>light?`深浅 ${light} : ${dark}，深多浅少，亮的那几件是特意留的`:`深浅 ${light} : ${dark}，远看有层次、不糊成一团`;
  const third=span>0?`${balance}；最正式的${high.name}和最松的${low.name}差 ${span} 档，中间这几件就是用来把这个差拉平的。`:`${balance}；这几件正式度齐平在 ${high.formal}，整套不抢戏。`;
  return[first,second,third];
 }
 function toResultItem(it){return{id:it.id,ref:it.id,name:it.name,kind:labels[it.category],image:it.image}}
 const selected=()=>Array.isArray(AW.state.yueOutfit)?AW.state.yueOutfit.map(byId).filter(Boolean):[];
 function slotMarkup(it,i,show){return `<div class="aw-yue-slot ${show?'on':''}" data-aw-slot="${i}">${show&&it?`<button class="aw-yue-swap" data-aw-swap="${i}" aria-label="换掉${AW.escape(it.name)}">换</button><div class="aw-yue-slot-pic">${picOf(it)}</div><div class="aw-yue-slot-meta"><b>${AW.escape(it.name)}</b><em>${labels[it.category]}</em></div>`:''}</div>`}
 function render(){
  const s=AW.state,phase=s.yuePhase||'input',out=selected(),showSlots=phase==='flying'||phase==='result';
  const live=all();
  const display=out.length?out.concat(live.filter(x=>!out.some(y=>y.id===x.id))):live;
  const chips=(s.yueParseTags||[]).map(pair=>`<span class="aw-yue-chip"><i>${AW.escape(pair[0])}</i>${AW.escape(pair[1])}</span>`).join('');
  const body=phase==='parsing'?`<div class="aw-yue-loading"><span></span><span></span><span></span><b>正在从衣柜里翻…</b></div>`:showSlots?`<div class="aw-yue-slots">${Array.from({length:4},(_,i)=>slotMarkup(out[i],i,phase==='result'&&s.yueSwapIdx!==i)).join('')}</div>`:'';
  const explanation=phase==='result'&&s.yueReason?`<div class="aw-yue-reason"><div class="aw-yue-reason-head"><b>为什么是这一套</b>${(s.yueReasonKeys?.length?s.yueReasonKeys:['日常']).map(x=>`<span>${AW.escape(x)}</span>`).join('')}</div>${s.yueReason.map(x=>`<p>${AW.escape(x)}</p>`).join('')}</div>`:'';
  const actions=phase==='result'?`<div class="aw-yue-actions"><button class="aw-button" data-aw-yue-again>换一套</button><button class="aw-button secondary" data-aw-yue-reset>重新说</button><button class="aw-yue-full" data-aw-go="results">查看完整结果与操作 ›</button></div>`:'';
  const error=phase==='error'?`<div class="aw-yue-error">${AW.status('error',s.yueError||'搭配失败，请重试',true)}</div>`:'';
  const drawer=`<div class="aw-yue-mask${s.yueDrawer?' on':''}" data-aw-drawer-close></div><div class="aw-yue-drawer${s.yueDrawer?' on':''}" role="dialog" aria-modal="true" aria-label="我的电子衣柜"><button class="aw-yue-drawer-close" data-aw-drawer-close aria-label="关闭">×</button><h3>我的电子衣柜</h3><p>全部 ${live.length} 件真实单品</p><div class="aw-yue-drawer-grid">${live.map(it=>`<div class="aw-yue-drawer-item"><div>${picOf(it)}</div><span>${AW.escape(it.name)}</span></div>`).join('')}</div></div>`;
  return `<section class="aw-page aw-yue-page aw-game-page"><div class="aw-yue-brand"><b>跃然搭配</b><span>一句话，从衣柜里跳出一套</span><small>${live.length} 件单品</small></div><div class="aw-yue-ask"><h1>今天，想穿什么？</h1><div class="aw-yue-field aw-card"><span class="aw-yue-mag" aria-hidden="true">⌕</span><input id="aw-yue-input" value="${AW.escape(s.input||'')}" placeholder="说说今天的场合、天气，或者想要的感觉…" ${phase==='parsing'||phase==='flying'?'disabled':''}><button class="aw-yue-clear" data-aw-yue-clear aria-label="清空输入" ${s.input?'':'hidden'}>×</button><button class="aw-yue-go" data-aw-yue-start ${phase==='parsing'||phase==='flying'?'disabled':''}>搭配</button></div><div class="aw-yue-examples">${examples.map(x=>`<button data-aw-example="${AW.escape(x)}">${AW.escape(x)}</button>`).join('')}</div><div class="aw-yue-chips">${chips}</div></div>${error}<div class="aw-yue-result">${body}${explanation}${actions}</div><div class="aw-yue-band-wrap ${phase==='input'?'aw-yue-enter':''}"><div class="aw-yue-band" id="aw-yue-band">${display.map(it=>`<div class="aw-yue-bead" data-aw-bead="${AW.escape(it.id)}" title="${AW.escape(it.name)}">${picOf(it)}</div>`).join('')}</div><div class="aw-yue-band-tag"><span>电子衣柜 · <b>${live.length}</b> 件单品</span><button data-aw-drawer-open>进入衣柜 →</button></div></div>${drawer}</section>`;
 }
 function layoutBand(root){
  const band=root.querySelector('#aw-yue-band');if(!band)return;
  const beads=[...band.querySelectorAll('[data-aw-bead]')],width=band.clientWidth||390;
  const cols=width>=600?22:19,cell=width/cols,gap=Math.max(2,cell*.085),diameter=cell-gap;
  const rows=Math.ceil(beads.length/cols);band.style.height=(rows*cell+cell*.7)+'px';
  beads.forEach((el,i)=>{const row=Math.floor(i/cols),col=i%cols,stackRow=rows-1-row,offset=stackRow%2?cell*.5:0;
   const n=(i*37)%19,jitterX=(n-9)*gap*.018,jitterY=(((i*23)%17)-8)*gap*.018;
   const x=col*cell+offset+gap/2+jitterX,y=stackRow*cell+cell*.3+gap/2+jitterY;
   el.style.left=x+'px';el.style.top=y+'px';el.style.width=diameter+'px';el.style.height=diameter+'px';
   el.style.setProperty('--fall',`${Math.min(190,85+stackRow*11)}px`);el.style.setProperty('--settle-delay',`${Math.min(320,row*38+col*4)}ms`);
   el._cx=x+diameter/2;el._cy=y+diameter/2;el._d=diameter;
  });
 }
 function bind(root){
  if(root._escHandler)removeEventListener('keydown',root._escHandler);
  layoutBand(root);
  const input=root.querySelector('#aw-yue-input');
  input?.addEventListener('input',e=>{AW.state.input=e.target.value;root.querySelector('[data-aw-yue-clear]').hidden=!e.target.value;AW.save()});
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();start(input.value)}});
  root.querySelector('[data-aw-yue-clear]')?.addEventListener('click',()=>{AW.state.input='';input.value='';root.querySelector('[data-aw-yue-clear]').hidden=true;AW.save();input.focus()});
  root.querySelector('[data-aw-yue-start]')?.addEventListener('click',()=>start(input.value));
  root.querySelectorAll('[data-aw-example]').forEach(el=>el.addEventListener('click',()=>{AW.state.input=el.dataset.awExample;start(el.dataset.awExample)}));
  root.querySelector('[data-aw-retry]')?.addEventListener('click',()=>start(AW.state.input));
  root.querySelector('[data-aw-yue-again]')?.addEventListener('click',()=>start(AW.state.input,true));
  root.querySelector('[data-aw-yue-reset]')?.addEventListener('click',()=>{token++;AW.state.input='';AW.state.yuePhase='input';AW.state.yueOutfit=[];AW.state.yueParseTags=[];AW.state.yueReason=null;AW.state.yueReasonKeys=[];AW.render();document.querySelector('#aw-yue-input')?.focus()});
  root.querySelectorAll('[data-aw-swap]').forEach(el=>el.addEventListener('click',()=>swapOne(Number(el.dataset.awSwap))));
  root.querySelector('[data-aw-drawer-open]')?.addEventListener('click',()=>{AW.state.yueDrawer=true;AW.render()});
  root.querySelectorAll('[data-aw-drawer-close]').forEach(el=>el.addEventListener('click',()=>{AW.state.yueDrawer=false;
   root.querySelector('.aw-yue-mask')?.classList.remove('on');root.querySelector('.aw-yue-drawer')?.classList.remove('on');
   setTimeout(()=>AW.render(),340)}));
  if(AW.state.yueDrawer){requestAnimationFrame(()=>{root.querySelector('.aw-yue-mask')?.classList.add('on');root.querySelector('.aw-yue-drawer')?.classList.add('on')})}
  const escHandler=e=>{if(e.key==='Escape'&&AW.state.yueDrawer){AW.state.yueDrawer=false;root.querySelector('.aw-yue-mask')?.classList.remove('on');root.querySelector('.aw-yue-drawer')?.classList.remove('on');setTimeout(()=>AW.render(),340)}};
  root._escHandler=escHandler;addEventListener('keydown',escHandler);
 }
 function ripple(root,source){
  if(reduced())return;
  const band=root.querySelector('#aw-yue-band');if(!band||!source)return;
  const range=330;
  const neighbors=[...band.querySelectorAll('[data-aw-bead]')].filter(el=>el!==source&&el._cx).map(el=>({el,distance:Math.hypot(el._cx-source._cx,el._cy-source._cy)})).filter(x=>x.distance<range&&x.distance>1).sort((a,b)=>a.distance-b.distance).slice(0,42);
  for(const {el,distance} of neighbors){
   const dx=el._cx-source._cx,dy=el._cy-source._cy;
   const t=distance/range,amp=(1-t)*(1-t)*30,ux=dx/distance,uy=dy/distance;
   el.animate?.([
    {transform:'translate(0,0) scale(1)',offset:0,easing:'cubic-bezier(.16,1,.3,1)'},
    {transform:`translate(${(ux*amp).toFixed(2)}px,${(uy*amp).toFixed(2)}px) scale(${(1+(1-t)*.11).toFixed(3)})`,offset:.30,easing:'cubic-bezier(.45,0,.55,1)'},
    {transform:`translate(${(-ux*amp*.34).toFixed(2)}px,${(-uy*amp*.34).toFixed(2)}px) scale(.994)`,offset:.64,easing:'cubic-bezier(.2,.85,.35,1)'},
    {transform:'translate(0,0) scale(1)',offset:1}
   ],{duration:700,delay:t*260,easing:'linear',fill:'none'});
  }
  const D=source._d||40;
  for(const [delay,dur,a0] of [[0,860,.62],[140,780,.34]]){
   const ring=document.createElement('div');ring.className='aw-yue-ring';ring.style.left=source._cx+'px';ring.style.top=source._cy+'px';band.appendChild(ring);
   const size=k=>(D*k).toFixed(1)+'px';
   ring.animate?.([
    {width:size(1),height:size(1),opacity:0,offset:0},
    {width:size(1.6),height:size(1.6),opacity:a0,offset:.12},
    {width:size(4.2),height:size(4.2),opacity:a0*.88,offset:.55},
    {width:size(6.6),height:size(6.6),opacity:a0*.34,offset:.84},
    {width:size(range*2/D),height:size(range*2/D),opacity:0,offset:1}
   ],{duration:dur,delay,easing:'cubic-bezier(.22,.62,.4,1)',fill:'both'});
   setTimeout(()=>ring.remove(),delay+dur+60);
  }
 }
 async function flyOne(it,index,own){
  const root=document.querySelector('#stage')||document.querySelector('#aw-view');if(!root)return;
  const from=root.querySelector(`[data-aw-bead="${it.id}"]`),to=root.querySelector(`[data-aw-slot="${index}"]`);
  if(!from||!to)return;
  const show=()=>{if(own!==token)return;to.innerHTML=slotMarkup(it,index,true).replace(/^<div[^>]*>|<\/div>$/g,'');to.classList.add('on');from.classList.remove('lift');from.classList.add('taken');to.animate?.([{transform:'scale(1.035) translateY(-3px)'},{transform:'scale(.992) translateY(1px)',offset:.55},{transform:'scale(1) translateY(0)'}],{duration:460,easing:'cubic-bezier(.34,1.4,.64,1)',fill:'none'})};
  if(reduced()){show();return}
  from.classList.add('lift');ripple(root,from);await AW.sleep(240);if(own!==token)return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  const ghost=document.createElement('div');ghost.className='aw-yue-ghost';ghost.innerHTML=picOf(it);ghost.style.cssText=`left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;document.body.appendChild(ghost);from.style.visibility='hidden';
  const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2,scale=b.width/Math.max(a.width,1);
  const apex=Math.min(dy-74,-125),overshoot=Math.max(7,b.height*.11),rebound=Math.max(3,b.height*.045);
  const frames=[
   {offset:0,transform:'translate(0,0) scale(1) rotate(0deg)',borderRadius:'50%',easing:'cubic-bezier(.25,.1,.25,1)'},
   {offset:.11,transform:'translate(0,5px) scale(.87) rotate(0deg)',borderRadius:'50%',easing:'cubic-bezier(.12,.45,.2,1)'},
   {offset:.45,transform:`translate(${dx*.48}px,${apex*.88}px) scale(${1+(scale-1)*.66}) rotate(-6deg)`,borderRadius:'32%',easing:'cubic-bezier(.2,.4,.3,1)'},
   {offset:.57,transform:`translate(${dx*.72}px,${apex}px) scale(${scale*.9}) rotate(-3deg)`,borderRadius:'20%',easing:'cubic-bezier(.35,.02,.55,1)'},
   {offset:.83,transform:`translate(${(dx*1.07).toFixed(1)}px,${(dy+overshoot).toFixed(1)}px) scale(${(scale*1.06).toFixed(3)}) rotate(2deg)`,borderRadius:'15px',easing:'cubic-bezier(.22,.75,.28,1)'},
   {offset:.93,transform:`translate(${(dx*.975).toFixed(1)}px,${(dy-rebound).toFixed(1)}px) scale(${(scale*.985).toFixed(3)}) rotate(-.8deg)`,borderRadius:'15px',easing:'cubic-bezier(.28,.7,.3,1)'},
   {offset:1,transform:`translate(${dx}px,${dy}px) scale(${scale}) rotate(0deg)`,borderRadius:'15px'}
  ];
  try{
   const animation=ghost.animate?.(frames,{duration:1030,easing:'linear',fill:'forwards'});
   if(animation?.finished)await animation.finished.catch(()=>{});else await AW.sleep(1030);
  }finally{show();ghost.remove();from.style.visibility=''}
 }
 async function flyOutfit(out,own){await Promise.all(out.map(async(it,index)=>{await AW.sleep(index*300);if(own===token)await flyOne(it,index,own)}))}
 async function generateResults(text,p,out,own){
  const selectedItems=out.map(toResultItem),reason=reasonFor(p,out);
  await window.AW_RESULTS.open({type:'input',payload:{raw_text:text,parsed_summary:tags(p).map(x=>x.join('：')),selected_items:selectedItems,selected_reason:reason.join(' ')}},true);
  if(own!==token||AW.state.route!=='yueran')return;
  AW.state.yueReason=reason;AW.state.yueReasonKeys=[p.occasionWord,p.seasonWord,p.activity,...p.styles,...p.colors].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);AW.state.yuePhase='result';AW.state.yueSwapIdx=null;AW.state.resultIndex=0;AW.save();AW.render();AW.toast('已从衣柜里搭出一套');
 }
 async function start(raw,reroll=false){
  const text=String(raw||'').trim();if(!text){AW.toast('先输入一句话');document.querySelector('#aw-yue-input')?.focus();return}
  const own=++token,s=AW.state,previous=reroll?selected().map(x=>x.id):[];
  s.input=text;s.yueError=null;s.yueDrawer=false;s.yueSwapIdx=null;
  const p=parse(text);
  if(!reroll){s.yuePhase='parsing';s.yueParseTags=[];AW.render()}
  AW.setBusy(true);
  try{
   if(W&&W.refresh)await W.refresh().catch(()=>{});
   if(!reroll)await AW.api.parseIntent(text);if(own!==token||s.route!=='yueran')return;
   const out=buildOutfit(p,previous);if(out.length!==4)throw Error('衣柜里找不到完整的四件搭配');
   s.yueParseTags=tags(p);s.yueOutfit=out.map(x=>x.id);s.yuePhase='flying';AW.render();await AW.sleep(80);
   await flyOutfit(out,own);if(own!==token||s.route!=='yueran')return;
   await generateResults(text,p,out,own);
  }catch(e){if(own!==token||s.route!=='yueran')return;s.yueError=e.message;s.yuePhase='error';AW.render()}
  finally{AW.setBusy(false)}
 }
 async function swapOne(index){
  const s=AW.state,out=selected(),old=out[index];if(!old||s.yueSwapIdx!==null&&s.yueSwapIdx!==undefined)return;
  const p=parse(s.input),next=pick(old.category,p,out.map(x=>x.id),out.filter(x=>luminance(x.color)<.34).length);
  if(!next){AW.toast('暂时没有同类替换');return}
  const own=++token;s.yueOutfit[index]=next.id;s.yueSwapIdx=index;AW.render();AW.setBusy(true);
  try{await AW.sleep(80);await flyOne(next,index,own);if(own!==token||s.route!=='yueran')return;await generateResults(s.input,p,selected(),own)}
  catch(e){if(own!==token)return;s.yueError=e.message;s.yuePhase='error';AW.render()}
  finally{AW.setBusy(false)}
 }
 function replacement(current,usedIds,text){
  const original=byId(current&&current.id)||byId(current&&current.ref);
  if(!original)return null;
  const excluded=(usedIds||[]).map(x=>byId(x)).filter(Boolean).map(x=>x.id);
  const next=pick(original.category,parse(text),excluded,0);
  return next?toResultItem(next):null;
 }
 AW.modules.yueran={render,bind,start,items:all,parse,buildOutfit,replacement};
})();
