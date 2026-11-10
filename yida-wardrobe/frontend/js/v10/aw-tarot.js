(function(){
 'use strict';
 const AW=window.AW,D=window.AW_DATA,back='assets/v10/tarot/tarot-back.png';
 const S=AW.state;
 let pendingReveal=false;
 const faceSrc=card=>window.AW_TAROT_FRONT_FILES?.[card.index];
 const slotContent=pick=>pick?`<img src="${faceSrc(pick.card)||back}" alt="${AW.escape(pick.card.name)}牌面">`:'';
 const slots=()=>Array.from({length:3},(_,i)=>`<div class="aw-tarot-slot ${S.tarotPicked[i]?'filled':''}" id="aw-tarot-slot-${i}" aria-label="${S.tarotPicked[i]?`第${i+1}张：${AW.escape(S.tarotPicked[i].card.name)}，已翻开`:`第${i+1}张待抽`}">${slotContent(S.tarotPicked[i])}</div>`).join('');
 function front(card){
  const path=faceSrc(card);
  if(path)return `<div class="aw-tarot-front supplied"><img src="${path}" alt="${AW.escape(card.name)}牌面"></div>`;
  return `<div class="aw-tarot-front"><div class="aw-tarot-front-art"><span class="aw-tarot-front-fallback" aria-hidden="true">✦</span></div><span class="aw-tarot-front-name">${AW.escape(card.name)}</span><small>${AW.escape(card.keywords.join(' · '))}</small></div>`;
 }
 const frontLoads=new Map();
 function readyFront(card){
  const src=faceSrc(card);
  if(!src)return Promise.resolve();
  if(!frontLoads.has(card.index)){
   const image=new Image();image.src=src;
   frontLoads.set(card.index,image.decode?image.decode().catch(()=>{}):new Promise(resolve=>{image.onload=resolve;image.onerror=resolve}));
  }
  return frontLoads.get(card.index);
 }
 function init(){if(!Array.isArray(S.tarotOrder)||S.tarotOrder.length!==D.tarot.length){S.tarotOrder=AW.shuffled(D.tarot.length);S.tarotPicked=[];S.tarotScroll=11;S.tarotPhase='draw';AW.save()}}
 function reset(){pendingReveal=false;S.tarotOrder=AW.shuffled(D.tarot.length);S.tarotPicked=[];S.tarotScroll=11;S.tarotPhase='draw';AW.render()}
 function render(){
  init();if(!D.tarot?.length)return AW.status('empty','没有可抽取的塔罗牌',true);
  const n=S.tarotPicked.length;
  const reading=S.tarotPicked.map((pick,i)=>`${D.positions[i]}：${pick.reversed?pick.card.rev:pick.card.up}`).join(' ');
  const summary=D.summaries[(S.tarotOrder[0]||0)%D.summaries.length];
  return `<section class="aw-tarot-page aw-game-page"><div class="aw-tarot-stars" aria-hidden="true"></div><div class="aw-tarot-heading"><div class="aw-kicker">TAROT · ${AW.escape(S.targetDate)}</div><h1>${S.tarotPhase==='draw'?`抽第${n+1}张牌`:'三张牌已揭晓'}</h1><div class="aw-tarot-progress"><i></i><span>${n} / 3</span><i></i></div><p>${S.tarotPhase==='draw'?'滑动牌轮 · 点击高亮牌选取':'现在的你 · 变化 · 提醒'}</p></div>${S.tarotPhase==='draw'||pendingReveal?`<div class="aw-tarot-slots" id="aw-tarot-slots">${slots()}</div>`:''}${S.tarotPhase==='draw'?'<div class="aw-tarot-wheel" id="aw-tarot-wheel" aria-label="右侧弧形塔罗牌轮"></div>':`<div class="aw-tarot-reveal"><div class="aw-tarot-reveal-row">${S.tarotPicked.map((pick,i)=>`<article class="aw-flipcard"><div class="aw-flip-inner"><div class="aw-flip-face aw-flip-back"><img src="${back}" alt=""></div><div class="aw-flip-face aw-flip-front">${front(pick.card)}</div></div><div class="aw-flip-caption"><b>${D.positions[i]}</b><span>${pick.reversed?'逆位 · 能量向内':'正位'}</span></div></article>`).join('')}</div><div class="aw-tarot-reading aw-card"><b>给今天的提醒</b><p>${AW.escape(reading+' '+summary)}</p></div><div class="aw-button-row"><button class="aw-button secondary" data-aw-tarot-reset>重新洗牌</button><button class="aw-button" data-aw-tarot-result>去看穿搭</button></div></div>`}</section>`;
 }
 let wheelCleanup=null;
 function bind(root){
  root.querySelector('[data-aw-retry]')?.addEventListener('click',reset);
  root.querySelector('[data-aw-tarot-reset]')?.addEventListener('click',reset);
  root.querySelector('[data-aw-tarot-result]')?.addEventListener('click',()=>{
   const payload={cards:S.tarotPicked.map((p,i)=>({no:p.card.no,cn:p.card.name,reversed:p.reversed,position:D.positions[i],keywords:p.card.keywords}))};
   window.AW_RESULTS.open({type:'tarot',payload}).catch(e=>AW.toast(e.message));
  });
  if(S.tarotPhase!=='draw'){
   if(wheelCleanup)wheelCleanup();
   if(pendingReveal){pendingReveal=false;promoteSlots(root)}
   return;
  }
  if(wheelCleanup)wheelCleanup();
  mountWheel(root.querySelector('#aw-tarot-wheel'));
 }
 async function promoteSlots(root){
  const tray=root.querySelector('#aw-tarot-slots'),reveal=root.querySelector('.aw-tarot-reveal');
  const small=[...tray?.querySelectorAll('.aw-tarot-slot')||[]],large=[...reveal?.querySelectorAll('.aw-flip-inner')||[]];
  if(!tray||!reveal||small.length!==3||large.length!==3)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||small.some(el=>!el.animate)){
   tray.remove();return;
  }
  tray.classList.add('is-promoting');reveal.classList.add('is-opening');
  try{
   const flights=small.map((el,i)=>{
    const a=el.getBoundingClientRect(),b=large[i].getBoundingClientRect();
    const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2;
    return el.animate([
     {offset:0,transform:'translate(0,0) scale(1,1)'},
     {offset:.24,transform:'translate(0,-17px) scale(1.13,1.13)'},
     {offset:1,transform:`translate(${dx}px,${dy}px) scale(${b.width/a.width},${b.height/a.height})`}
    ],{duration:720,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'}).finished;
   });
   await Promise.allSettled(flights);
  }finally{
   tray.remove();reveal.classList.remove('is-opening');
  }
 }
 function mountWheel(wheel){
  if(!wheel)return;
  wheel.innerHTML=S.tarotOrder.map((deckIndex,i)=>`<button type="button" class="aw-tarot-card" data-tarot-slot="${i}" aria-label="牌轮第${i+1}张牌"><img src="${back}" alt="" draggable="false"></button>`).join('');
  const cards=[...wheel.querySelectorAll('.aw-tarot-card')];
  let drag=null,drawing=false;
  const used=i=>S.tarotPicked.some(p=>p.slot===i);
  const wrap=v=>((v%cards.length)+cards.length)%cards.length;
  const candidate=()=>{const i=wrap(Math.round(S.tarotScroll));if(!used(i))return i;for(let d=1;d<cards.length;d++){const before=wrap(i-d),after=wrap(i+d);if(!used(before))return before;if(!used(after))return after}return i};
  function layout(){
   const width=wheel.clientWidth||390,height=wheel.clientHeight||560;
   // The wheel's center sits just beyond the right edge. Its left edge stays about
   // one card margin from the screen edge, matching the reference's dense C shape.
   // Keep the seam where the last card wraps to the first fully beyond the
   // viewport. The visible left arc remains dense while dragging indefinitely.
   const radius=Math.min(width*.89,height*.58,360),cx=width+Math.min(82,width*.22),cy=Math.min(height*.55,radius+10);
   const active=candidate();
   cards.forEach((el,i)=>{
    const delta=wrap(i-S.tarotScroll+cards.length/2)-cards.length/2;
    const angleDeg=180-delta*7.8,angle=angleDeg*Math.PI/180;
    const x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle),rotation=angleDeg-90;
    el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${rotation}deg)`;
    el.dataset.rotation=String(rotation);
    el.style.zIndex=i===active?'80':String(Math.max(1,55-Math.round(Math.abs(delta))));
    el.classList.toggle('active',i===active&&!used(i));el.classList.toggle('taken',used(i));
    el.setAttribute('aria-current',i===active?'true':'false');
   });
  }
  const snap=()=>{S.tarotScroll=wrap(Math.round(S.tarotScroll));S.tarotScroll=candidate();AW.save();layout()};
  const onDown=e=>{
   if(drawing)return;
   e.preventDefault?.();
   drag={x:e.clientX,y:e.clientY,scroll:S.tarotScroll,moved:0,slot:e.target.closest('[data-tarot-slot]')?.dataset.tarotSlot};
   if(drag.slot!==undefined)readyFront(D.tarot[S.tarotOrder[Number(drag.slot)]]);
   try{wheel.setPointerCapture(e.pointerId)}catch(_){}
  };
  const onMove=e=>{
   if(!drag)return;
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));
   if(drag.moved<6)return;
   S.tarotScroll=drag.scroll+(dy-dx*.55)/25;
   layout();
  };
  const onUp=async e=>{
   if(!drag)return;
   const gesture=drag;drag=null;
   if(gesture.moved>=8){snap();return}
   const i=Number(gesture.slot);
   if(gesture.slot===undefined||!Number.isInteger(i)||used(i)||drawing)return;
   S.tarotScroll=i;layout();
   drawing=true;
   try{await draw(i,cards[i]);if(S.tarotPhase==='draw')layout()}finally{drawing=false}
  };
  let wheelTimer=null;
  const onWheel=e=>{e.preventDefault();S.tarotScroll+=e.deltaY/73;layout();clearTimeout(wheelTimer);wheelTimer=setTimeout(snap,130)};
  const onClick=async e=>{
   // Pointer capture retargets a pointer-generated click to the wheel. Handle taps on pointerup;
   // this path serves keyboard and assistive activation only.
   if(e.detail!==0||drawing)return;
   const el=e.target.closest('[data-tarot-slot]');if(!el)return;
   const i=Number(el.dataset.tarotSlot);if(used(i))return;
   S.tarotScroll=i;layout();drawing=true;
   try{await draw(i,el);if(S.tarotPhase==='draw')layout()}finally{drawing=false}
  };
  wheel.addEventListener('pointerdown',onDown);wheel.addEventListener('pointermove',onMove);wheel.addEventListener('pointerup',onUp);wheel.addEventListener('pointercancel',()=>{drag=null;snap()});wheel.addEventListener('wheel',onWheel,{passive:false});wheel.addEventListener('click',onClick);
  wheel.addEventListener('dragstart',e=>e.preventDefault());
  const onResize=()=>layout();window.addEventListener('resize',onResize);
  wheelCleanup=()=>{window.removeEventListener('resize',onResize);clearTimeout(wheelTimer);wheelCleanup=null};
  layout();
 }
 async function draw(i,el){
  if(S.tarotPicked.length>=3||S.tarotPhase!=='draw')return;
  const card=D.tarot[S.tarotOrder[i]],reversed=AW.randomIndex(1000)<380;
  const slot=document.querySelector(`#aw-tarot-slot-${S.tarotPicked.length}`);
  const wheel=el?.closest('#aw-tarot-wheel');
  await readyFront(card);
  if(!slot||!wheel?.isConnected||S.route!=='tarot')return;
  const shouldAnimate=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!!el.animate;
  if(shouldAnimate){
   const r=el.getBoundingClientRect(),target=slot.getBoundingClientRect();
   const width=el.offsetWidth,height=el.offsetHeight;
   const startX=r.left+r.width/2,startY=r.top+r.height/2;
   const dx=target.left+target.width/2-startX,dy=target.top+target.height/2-startY;
   const liftX=window.innerWidth*.53-startX,liftY=Math.min(window.innerHeight*.48,Math.max(target.top+target.height+135,window.innerHeight*.4))-startY;
   const scale=Math.min(target.width/width,target.height/height);
   const ghost=document.createElement('div');ghost.className='aw-draw-ghost';
   ghost.style.cssText=`left:${startX-width/2}px;top:${startY-height/2}px;width:${width}px;height:${height}px`;
   ghost.innerHTML=`<div class="aw-draw-ghost-inner"><div class="aw-draw-ghost-face"><img src="${back}" alt=""></div><div class="aw-draw-ghost-face aw-draw-ghost-front"><img src="${faceSrc(card)||back}" alt=""></div></div>`;
   document.body.appendChild(ghost);el.style.visibility='hidden';
   const rotation=Number(el.dataset.rotation)||0;
   try{
    const flight=ghost.animate([
     {offset:0,transform:`rotate(${rotation}deg) scale(1)`,easing:'cubic-bezier(.22,.7,.25,1)'},
     {offset:.2,transform:`translate(${liftX}px,${liftY}px) rotate(0deg) scale(1.04)`,easing:'cubic-bezier(.25,.15,.2,1)'},
     {offset:.52,transform:`translate(${liftX}px,${liftY}px) rotate(0deg) scale(1.38)`,easing:'linear'},
     {offset:.64,transform:`translate(${liftX}px,${liftY}px) rotate(0deg) scale(1.38)`,easing:'cubic-bezier(.25,.7,.2,1)'},
     {offset:1,transform:`translate(${dx}px,${dy}px) rotate(0deg) scale(${scale})`}
    ],{duration:1100,easing:'linear',fill:'forwards'});
    const flip=ghost.firstElementChild.animate([
     {transform:'rotateY(0deg)'},{transform:'rotateY(180deg)'}
    ],{duration:380,delay:230,easing:'cubic-bezier(.34,.1,.22,1)',fill:'forwards'});
    await Promise.allSettled([flight.finished,flip.finished]);
   }finally{
    if(wheel.isConnected&&S.route==='tarot'){
     const pick={slot:i,card,reversed};slot.classList.add('filled');slot.innerHTML=slotContent(pick);
     slot.setAttribute('aria-label',`第${S.tarotPicked.length+1}张：${card.name}，已翻开`);
    }
    ghost.remove();el.style.visibility='';
   }
  }
  if(!wheel.isConnected||S.route!=='tarot')return;
  const pick={slot:i,card,reversed};
  if(!shouldAnimate){slot.classList.add('filled');slot.innerHTML=slotContent(pick)}
  S.tarotPicked.push(pick);AW.save();
  if(S.tarotPicked.length===3){S.tarotPhase='reveal';pendingReveal=true;AW.render();return}
  S.tarotScroll=(i+1)%D.tarot.length;
  const page=wheel.closest('.aw-tarot-page');
  page.querySelector('.aw-tarot-heading h1').textContent=`抽第${S.tarotPicked.length+1}张牌`;
  page.querySelector('.aw-tarot-progress span').textContent=`${S.tarotPicked.length} / 3`;
  AW.save();
 }
 AW.modules.tarot={render,bind,reset};
})();
