(function(){
 'use strict';
 /* V10 模块集成层：适配 wardrobe-app 的 DOM 结构
    - 挂载点从 #aw-view 改为 #stage
    - Toast 从 #aw-toast 改为 #toast
    - 不自动初始化（由 wardrobe-app 的 render() 按需调用）
    - header/theme/fail 绑定由 wardrobe-app 管理 */
 const KEY='aw-b-modules-v1';
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const defaults={theme:'space',route:'tarot',targetDate:today(),energy:62,identity:'大女主',identityGroup:'爽剧主角',input:'',parsed:[],yuePhase:'input',yueOutfit:[],yueParseTags:[],yueReason:null,yueReasonKeys:[],yueSwapIdx:null,yueDrawer:false,tarotOrder:[],tarotPicked:[],tarotScroll:11,tarotPhase:'draw',resultSource:'wardrobe',resultIndex:0,results:[],recordView:'future',recordDate:null,records:{},wardrobeReady:true,failNext:false};
 let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){stored={}}
 const state=Object.assign({},defaults,stored);
 if(['parsing','flying'].includes(state.yuePhase))state.yuePhase='input';
 if(state.yuePhase==='result'&&(!Array.isArray(state.yueOutfit)||state.yueOutfit.length!==4))state.yuePhase='input';
 state.yueDrawer=false;state.yueSwapIdx=null;
 const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}};
 const toast=message=>{const el=document.querySelector('#toast');if(!el)return;el.textContent=message;el.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('on'),2300)};
 const modules={};
 const status=(kind,message,retry)=>`<div class="aw-status aw-status-${kind}" role="${kind==='error'?'alert':'status'}"><span class="aw-status-icon">${kind==='loading'?'✦':kind==='empty'?'☾':'!'}</span><b>${htmlEscape(message)}</b>${retry?'<button class="aw-button secondary" data-aw-retry>重试</button>':''}</div>`;
 const showStatus=(kind,message,retry)=>{const mount=document.querySelector('#stage');if(!mount)return;mount.innerHTML=status(kind,message,retry);if(retry)mount.querySelector('[data-aw-retry]').onclick=retry};
 const setBusy=(value)=>{document.documentElement.dataset.busy=value?'true':'false'};
 /* renderModule: 由 wardrobe-app 调用，将指定 V10 模块渲染到 #stage */
 function renderModule(route){
  /* theme 由 wardrobe-app 管理（applyTheme 写 documentElement.dataset.theme），这里不再覆写，
     否则会与 app 的 $$('[data-theme]') 绑定互相踩（html 元素被当成主题按钮）。 */
  if(route)state.route=route;
  const mount=document.querySelector('#stage');
  if(!mount)return;
  const mod=modules[state.route];
  mount.innerHTML=mod?mod.render():'<div class="aw-page"><h1>模块加载中…</h1></div>';
  // 给 #stage 打“当前展示的模块”标记：app 的 render() 靠它判断是“已在展示中”（防重渲染踩掉动画）
  // 还是“从别的页面刚切进来”（必须渲染，否则 chrome 切了内容没切）。
  mount.dataset.awModule=state.route||'';
  if(mod?.bind)mod.bind(mount);
  mount.querySelectorAll('[data-aw-go]').forEach(el=>el.onclick=()=>go(el.dataset.awGo));
  mount.scrollTop=0;
  save();
 }
 /* go: AW 内部导航。未知路由（如 'menu'）交给 AW.onNavigate 由 app 决定去向（menu→app 首页）；
    已知路由渲染后同样通知 app 同步 S.route，保持双路由一致。 */
 function go(route){
  if(!modules[route]){if(AW.onNavigate)AW.onNavigate(route);return}
  renderModule(route);
  if(AW.onNavigate)AW.onNavigate(route);
 }
 const randomIndex=n=>{if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n}return Math.floor(Math.random()*n)};
 const shuffled=n=>{const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=randomIndex(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
 const api={
  async run(work){await sleep(360);if(state.failNext){state.failNext=false;save();throw Error('演示接口暂时不可用')}return work()},
  async parseIntent(text){return this.run(()=>{const chips=[];if(/客户|会议|商务|面试/.test(text))chips.push('商务场合');if(/骑车|走路|通勤|运动/.test(text))chips.push('方便活动');if(/冷|降温|保暖/.test(text))chips.push('需要保暖');if(/约会/.test(text))chips.push('约会');if(/逛展|看展/.test(text))chips.push('逛展');if(/不要红|不穿红/.test(text))chips.push('避开红色');return chips.length?chips:['日常出行','轻松完整']})},
  async recommend(source){return this.run(()=>window.AW_RESULTS.make(source,state))},
  async confirm(outfit){return this.run(()=>outfit)}
 };
 const AW={state,modules,api,save,renderModule,render:renderModule,go,toast,status,showStatus,setBusy,escape:htmlEscape,sleep,shuffled,randomIndex,today};
 window.AW=AW;
 /* 不自动初始化：由 wardrobe-app 的 app.js 在需要时调用 AW.renderModule() */
})();
