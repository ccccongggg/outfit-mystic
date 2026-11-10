
const A=n=>!n?'':(n.indexOf('/')>=0?n:'assets/items/'+n);
const CAT_LABEL={top:'上装',bottom:'下装',outer:'外套',dress:'连衣裙',shoe:'鞋履',bag:'包袋',accessory:'配饰'};
const SEASON_CN={spring:'春',summer:'夏',autumn:'秋',winter:'冬'};
const catLabel=c=>CAT_LABEL[c]||'单品';
const EDIT_K='ai-wardrobe-item-edits-v1';
let UPLOADED=[],ITEM_EDITS={};
try{ITEM_EDITS=JSON.parse(localStorage.getItem(EDIT_K)||'{}')||{}}catch(e){ITEM_EDITS={}}
function saveItemEdits(){try{localStorage.setItem(EDIT_K,JSON.stringify(ITEM_EDITS))}catch(e){}window.AW_WARDROBE?.notifyChange?.()}
function baseItems(){return (window.MockDB&&window.MockDB.wardrobe&&window.MockDB.wardrobe.items)||[]}
function wardrobeItems(){
 const map={};
 baseItems().forEach(x=>{if(x&&x.item_id)map[x.item_id]=x});
 UPLOADED.forEach(x=>{if(x&&x.item_id)map[x.item_id]=x});
 return Object.values(map).map(x=>{const e=ITEM_EDITS[x.item_id];return e?{...x,...e}:x});
}
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const K='ai-wardrobe-hifi-v13';
const today=new Date();
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fmt=d=>`${d.getMonth()+1}月${d.getDate()}日`;
const games={
 tarot:{name:'塔罗牌',desc:'抽三张牌，让随机给这一天一个方向。',art:'tarot'},
 energy:{name:'社交电量',desc:'用 1–100 表达这一天想对外投入多少。',art:'energy'},
 identity:{name:'重生之我是___',desc:'选一个角色，让衣服先进入那个状态。',art:'identity'},
 input:{name:'跃然搭配',desc:'输入一句话，把场合和需求直接交给 AI。',art:'input'}
};
const identityGroups={
 '爽剧主角':['大女主','逆袭女主'],'女配觉醒':['恶毒女二','疯批配角'],'豪门上桌':['真千金','财阀大小姐'],
 '月光氛围':['白月光','黑月光'],'高能大佬':['反派','终极 Boss'],'轻松出逃':['咸鱼女主','NPC 觉醒']
};
const identityKW={
 '大女主':'主角感 · 掌控 · 完整','逆袭女主':'变化感 · 提气 · 焕新','恶毒女二':'精致 · 锋利 · 存在感','疯批配角':'实验 · 偏轨 · 不常规',
 '真千金':'低声量 · 质感 · 底气','财阀大小姐':'资源感 · 完整 · 精致','白月光':'清透 · 轻 · 留白','黑月光':'克制 · 深 · 边界',
 '反派':'力量 · 边界 · 外显','终极 Boss':'低调 · 稳定 · 隐藏力量','咸鱼女主':'省力 · 熟悉 · 低维护','NPC 觉醒':'日常底色 · 主动变化'
};
const DECK=[
["0","愚者",["出发","自由","轻装上阵"]],["I","魔术师",["行动","表达","创造"]],["II","女祭司",["直觉","安静","分寸"]],
["III","女皇",["丰盛","照料","柔软"]],["IV","皇帝",["秩序","掌控","结构"]],["V","教皇",["传统","归属","稳妥"]],
["VI","恋人",["关系","选择","靠近"]],["VII","战车",["前进","意志","速度"]],["VIII","力量",["温柔","底气","驯服"]],
["IX","隐士",["独处","内省","简朴"]],["X","命运之轮",["转机","循环","时机"]],["XI","正义",["公平","平衡","清楚"]],
["XII","倒吊人",["停顿","换位","松弛"]],["XIII","死神",["结束","腾出","告别"]],["XIV","节制",["调和","平衡","缓慢"]],
["XV","恶魔",["欲望","坦白","挣脱"]],["XVI","塔",["推翻","松动","重建"]],["XVII","星星",["希望","疗愈","松弛"]],
["XVIII","月亮",["朦胧","直觉","慢慢来"]],["XIX","太阳",["明亮","坦荡","快乐"]],["XX","审判",["清醒","召唤","决定"]],["XXI","世界",["完成","圆满","抵达"]]
];
const stateDefault={
 route:'welcome',hist:[],onboardDone:false,wardrobeReady:false,wardrobeCount:(window.WARDROBE_ITEMS||[]).length,theme:'system',wardrobeFilter:'all',garmentId:null,
 target:'today',homeGames:['energy','identity','tarot','input'],homeSelected:2,trendSeen:false,
 uploadKind:'album',uploadPick:0,likes:{},saves:{},
 energy:62,identityGroup:'爽剧主角',identity:'大女主',inputText:'',inputChips:[],inputDone:false,inputAnimating:false,
 tarotOrder:[],tarotPicked:[],tarotRot:0,tarotReveal:false,resultIndex:0,resultKind:null,
 confirmed:{},apiOutfits:{},recordTab:'future',recordDate:null,profile:{name:'小鹿',bio:'热爱生活，也喜欢用穿搭记录更好的自己'}
};
let S={...stateDefault};
try{const x=JSON.parse(localStorage.getItem(K)||'null');if(x)S={...stateDefault,...x}}catch(e){}
if(S.homeGames.join(',')==='tarot,energy,identity,input'){S.homeGames=['energy','identity','tarot','input'];S.homeSelected=2}
if(S.identityGroup==='摆烂支线')S.identityGroup='轻松出逃';if(S.identity==='马甲大佬')S.identity='终极 Boss';if(S.identity==='NPC觉醒')S.identity='NPC 觉醒';
S.route=S.onboardDone?'home':'welcome';S.hist=[];S.inputAnimating=false;
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
function applyTheme(){
 let t=S.theme;
 if(t==='system')t=matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'space':'flow';
 document.documentElement.dataset.theme=t;document.documentElement.dataset.motionTheme=t==='space'?'darkMystic':'lightMystic';
}
applyTheme();
if(window.matchMedia){const mq=matchMedia('(prefers-color-scheme: dark)');mq.addEventListener?.('change',()=>{if(S.theme==='system'){applyTheme();render()}})}
function targetDate(){if(S.target==='today')return new Date(today.getFullYear(),today.getMonth(),today.getDate());if(S.target==='tomorrow')return addDays(today,1);if(S.target.startsWith('date:')){const[a,b,c]=S.target.slice(5).split('-').map(Number);return new Date(a,b-1,c)}return today}
function targetLabel(){const d=targetDate();if(ymd(d)===ymd(today))return'今天';if(ymd(d)===ymd(addDays(today,1)))return'明天';return fmt(d)}
function t(msg){const el=$('#toast');el.textContent=msg;el.classList.add('on');clearTimeout(t._x);t._x=setTimeout(()=>el.classList.remove('on'),1500)}
function go(route,push=true){
 // 进入塔罗 = 新的一局：清掉上次“已揭晓”残留（aw-tarot 的 init() 会重新洗牌），
 // 保证点进去直接就是选牌界面，而不是上次的揭晓页。返回键回来（back）不走这里，仍保留牌面。
 if(route==='tarot'&&window.AW&&AW.state.tarotPhase!=='draw'){AW.state.tarotOrder=[];AW.state.tarotPicked=[];AW.state.tarotPhase='draw';AW.save()}
 if(push&&S.route)S.hist=[...S.hist,S.route].slice(-20);
 if(S.route==='input'&&route!=='input'){yueRunToken++;S.inputAnimating=false} S.route=route;save();render();$('#stage').scrollTop=0;
}
function back(){const p=S.hist.pop();if(p){if(S.route==='input'){yueRunToken++;S.inputAnimating=false}S.route=p;save();render();$('#stage').scrollTop=0}else go('home',false)}
function rootOf(r){if(['wardrobe','garment','add','recognize'].includes(r))return'wardrobe';if(['me','settings','theme','profile','records','record'].includes(r))return'me';if(r==='plaza')return'plaza';return'home'}
function setChrome(title,showBack=true){$('#phone').dataset.scene=S.route;
 $('#navTitle').textContent=title||'';
 $('#backBtn').style.visibility=showBack?'visible':'hidden';
 const root=rootOf(S.route);$$('#tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.root===root));
 const hide=['welcome','why','add','recognize','done','tarot'].includes(S.route);
 $('#tabbar').style.display=hide?'none':'flex';
 $('#stage').style.height=hide?'calc(100% - 34px - 52px)':'calc(100% - 34px - 52px - 76px)';
 $('#stage').style.overflow=S.route==='tarot'?'hidden':'';
}
function iconArt(kind){
 if(kind==='tarot')return'<div class="tarot-mini">✦</div>';
 if(kind==='energy')return'<div class="battery"></div>';
 if(kind==='identity')return'<div class="orb">☾</div>';
 return'<div class="orb">⌁</div>';
}
function modal(inner){
 const m=document.createElement('div');m.className='mask';m.innerHTML=`<div class="sheet">${inner}</div>`;$('#phone').appendChild(m);
 m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))m.remove()});return m;
}
function renderWelcome(){
 setChrome('',false);
 return `<div class="screen welcome">
 <div class="kicker">AI ELECTRONIC WARDROBE</div><div class="sp10"></div>
 <h1 class="h1">把衣服放进来，<br>以后每天换一种方式<br>决定穿什么。</h1>
 <p class="sub" style="margin-top:13px">建衣柜后，玩法会优先从你真实拥有的衣服里找答案；也可以先跳过，直接体验。</p>
 <div class="welcome-art"><div class="wardrobe-door"></div><div class="wardrobe-rail"></div><div class="hanger h1"></div><div class="hanger h2"></div></div>
 <div class="flowline"><b>我的衣服</b><span>→</span><span>电子衣柜</span><span>→</span><span>玩法</span><span>→</span><b>穿搭</b></div>
 <div class="sp20"></div><button class="btn pri full" data-go="why">开始建立我的衣橱</button>
 <div class="sp8"></div><button class="btn ghost full" data-skip>先逛逛</button></div>`;
}
function renderWhy(){
 setChrome('建立电子衣柜',true);
 return `<div class="screen" style="padding-top:20px">
 <div class="kicker">STEP 01</div><div class="sp8"></div><h2 class="h2">让 AI 先认识你的衣服</h2>
 <p class="sub" style="margin-top:10px">所有玩法最后都会优先从你的真实衣柜里找答案。</p>
 <div class="sp18"></div><div class="card panel">
 <div class="between"><b>拍照 / 上传</b><span>→</span></div><div class="sp14"></div>
 <div class="between"><b>AI 自动整理</b><span>→</span></div><div class="sp14"></div>
 <div class="between"><b>以后直接帮你搭</b><span style="color:var(--accent)">✓</span></div></div>
 <div class="sp20"></div><button class="btn pri full" data-go="add">开始添加衣服</button>
 <div class="sp8"></div><button class="btn ghost full" data-skip>以后再说</button></div>`;
}
function renderAdd(){
 setChrome('添加衣服',true);
 const uploaded=UPLOADED.length;
 return `<div class="screen" style="padding-top:16px">
 <div class="kicker">ADD TO WARDROBE</div><div class="sp4"></div>
 <h2 class="h2">把你的衣服放进衣柜</h2>
 <p class="sub" style="margin-top:6px">拍一张衣服的照片，AI 会自动识别品类、颜色、材质与风格，提取穿着特征后加入衣柜。</p>
 <div class="sp16"></div>
 <div class="add-upload-zone" data-upload="album">
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:.4"><rect x="6" y="10" width="36" height="28" rx="4"/><circle cx="17" cy="21" r="4"/><path d="m6 34 11-10 7 6 5-4 13 10"/></svg>
  <b>点击上传衣服照片</b>
  <span>支持 JPG / PNG，单张或批量</span>
 </div>
 <div class="sp12"></div>
 <div class="choice3">
  ${uploadChoice('camera','拍照','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 1.5-2h5L16 6"/><circle cx="12" cy="13" r="4"/></svg>')}
  ${uploadChoice('album','从相册选择','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>')}
  ${uploadChoice('batch','批量选择','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="5" width="13" height="14" rx="2"/><path d="M3 8V5a3 3 0 0 1 3-3h10"/></svg>')}
 </div>
 ${uploaded?`<div class="sp12"></div><div class="card panel"><div class="between"><b style="font-size:12px">本次已上传</b><span class="chip">${uploaded} 件</span></div><div class="sp8"></div><button class="btn sec full" data-go="recognize">查看已上传的单品</button></div>`:''}
 <div class="sp12"></div><div class="card panel"><b style="font-size:12px">接下来会发生什么</b>
 <div class="steps"><div class="step"><i>1</i><span>一眼定焦：滤掉背景杂音，只留下衣服本来的颜色</span></div><div class="step"><i>2</i><span>看懂门面：品类、颜色、材质、风格一次认全</span></div><div class="step"><i>3</i><span>读懂性格：气场拆成 8 条光谱，写进推荐引擎</span></div></div></div>
 <div class="sp14"></div><button class="btn ghost full" data-skip>跳过，稍后再添加</button></div>`;
}
function uploadChoice(k,label,svg){return `<button class="card upload-choice" data-upload="${k}">${svg}<b>${label}</b></button>`}
const DIMS=[
 {k:'strength',label:'力量感',line:'垫肩一撑，气场先开口'},
 {k:'softness',label:'柔软度',line:'是云朵的触感，还是风衣的骨架'},
 {k:'presence',label:'存在感',line:'进门那一刻，目光先落在它身上'},
 {k:'relaxation',label:'松弛感',line:'周末的慵懒，还是周一的紧绷'},
 {k:'complexity',label:'细节密度',line:'一眼看尽，还是越看越有戏'},
 {k:'maintenance_cost',label:'娇贵指数',line:'丢进洗衣机就走，还是得小心供着'},
 {k:'mobility',label:'活动自由',line:'追公交、盘腿坐，都不掉链子'},
 {k:'statement',label:'表达欲',line:'它想替你把话说到多大声'}
];
const CAT_KW=[[/裙|dress/i,'dress'],[/裤|jeans|pants|trouser/i,'bottom'],[/外套|大衣|夹克|风衣|西装|coat|jacket/i,'outer'],[/鞋|靴|sneaker|shoe|boot/i,'shoe'],[/包|bag|tote|clutch/i,'bag'],[/帽|项链|耳环|围巾|首饰|scarf|hat|necklace/i,'accessory'],[/衬衫|上衣|针织|卫衣|毛衣|T恤|衬衣|shirt|blouse|top|sweater|tee/i,'top']];
const MATERIAL_KW=[[/牛仔|denim/i,'牛仔'],[/羊毛|wool|羊绒|cashmere/i,'羊毛'],[/针织|毛织|knit/i,'针织'],[/真丝|丝|silk|缎|satin/i,'真丝'],[/棉|cotton/i,'棉'],[/皮|leather|皮革/i,'皮革'],[/雪纺|chiffon/i,'雪纺']];
function currentSeason(d=today){const m=d.getMonth()+1;if(m<=2||m===12)return'winter';if(m<=5)return'spring';if(m<=8)return'summer';return'autumn'}
function readImage(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file)})}
function loadImg(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src})}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0));else if(mx===g)h=((b-r)/d+2);else h=((r-g)/d+4);h/=6}return{h,s,l}}
function colorName(h,s,l){
 if(l>.9&&s<.14)return{cn:'白',family:'white'};
 if(l<.16)return{cn:'黑',family:'black'};
 if(s<.12)return{cn:l>.6?'浅灰':'灰',family:'gray'};
 const deg=h*360;
 if(deg<15||deg>=345)return{cn:l<.42?'酒红':'红',family:'red'};
 if(deg<40)return{cn:l<.45?'棕':'橙',family:'orange'};
 if(deg<68)return{cn:l>.82?'奶油黄':'黄',family:'yellow'};
 if(deg<95)return{cn:l>.8?'奶油绿':'绿',family:'green'};
 if(deg<155)return{cn:'绿',family:'green'};
 if(deg<200)return{cn:'青',family:'blue'};
 if(deg<255)return{cn:l<.4?'藏蓝':'蓝',family:'blue'};
 if(deg<292)return{cn:'紫',family:'purple'};
 return{cn:l>.78?'藕粉':'粉',family:'pink'};
}
function downscale(im,max){
 const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height,s=Math.min(1,max/Math.max(w,h));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*s));c.height=Math.max(1,Math.round(h*s));
 const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,c.width,c.height);
 return c.toDataURL('image/jpeg',0.86);
}
async function analyzeImageFile(file,idx){
 const dataUrl=await readImage(file);
 const im=await loadImg(dataUrl);
 const c=document.createElement('canvas');c.width=c.height=48;const ctx=c.getContext('2d');
 ctx.drawImage(im,0,0,48,48);
 const px=ctx.getImageData(0,0,48,48).data;
 let r=0,g=0,b=0,n=0,uniq=new Set(),maxSat=0,sumBri=0;
 for(let i=0;i<px.length;i+=4){
  const R=px[i],G=px[i+1],B=px[i+2];uniq.add((R>>4)+','+(G>>4)+','+(B>>4));
  const {h,s,l}=rgb2hsl(R,G,B);sumBri+=l;
  if(l>.965&&s<.09)continue;
  if(l<.05)continue;
  r+=R;g+=G;b+=B;n++;if(s>maxSat)maxSat=s;
 }
 if(!n){r=g=b=200;n=1}
 const cr=Math.round(r/n),cg=Math.round(g/n),cb=Math.round(b/n);
 const hsl=rgb2hsl(cr,cg,cb);const col=colorName(hsl.h,hsl.s,hsl.l);
 const bri=sumBri/2304;
 const name=(file.name||'').replace(/\.[^.]+$/,'').replace(/[_\-]+/g,' ').trim();
 let category='top';for(const [re,cat] of CAT_KW){if(re.test(name)||re.test(file.name||'')){category=cat;break}}
 let material='混纺';for(const [re,mat] of MATERIAL_KW){if(re.test(name)){material=mat;break}}
 const clampv=v=>Math.max(5,Math.min(95,Math.round(v)));
 const hidden={
  strength:clampv(28+maxSat*48),softness:clampv(88-maxSat*46),presence:clampv(22+bri*26+maxSat*36),
  relaxation:clampv(82-maxSat*36),complexity:clampv(Math.min(92,uniq.size*11)),maintenance_cost:clampv(26+bri*34),
  mobility:clampv(72-maxSat*22),statement:clampv(22+maxSat*62)
 };
 const styles=[];
 if(maxSat<.18&&bri>.72)styles.push('清爽基础');else if(maxSat>.5)styles.push('高饱和度');
 if(category==='dress')styles.push('连身完整');if(category==='outer')styles.push('叠穿外搭');if(!styles.length)styles.push('日常通勤');
 const disp=downscale(im,720);
 return {
  item_id:'up_'+Date.now().toString(36)+'_'+idx,name:name||'上传单品',category,
  color_name:col.cn,material_cn:material,style_tags_cn:styles.slice(0,2),
  image_url:disp,source:'upload',
  visible_traits:{season:[currentSeason()],color_family:col.family,formality:maxSat>.4?'smart':'casual'},
  hidden_traits:hidden,stats:{wear_count:0},
  ai_meta:{engine:'local-vision-v1',bg_removed:true,confidence:.72+Math.min(.2,maxSat*.2)}
 };
}
function openFilePicker(kind){
 const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.style.display='none';
 if(kind==='camera')inp.setAttribute('capture','environment');
 if(kind==='batch')inp.multiple=true;
 document.body.appendChild(inp);
 inp.onchange=async()=>{const files=[...inp.files||[]];inp.remove();if(files.length)await ingestUploads(files,kind)};
 inp.click();
}
async function ingestUploads(files,kind){
 const max=kind==='batch'?6:1,list=files.slice(0,max);
 t('AI 正在抠底并识别 '+list.length+' 张照片…');
 const items=[];
 for(let i=0;i<list.length;i++){try{items.push(await analyzeImageFile(list[i],i))}catch(e){console.warn('analyze failed',e)}}
 if(!items.length){t('没有读到可用照片');return}
 UPLOADED=UPLOADED.concat(items);
 S.uploadKind=kind;S.uploadPick=0;save();
 window.WardrobeAPI?.addWardrobeItems({items}).catch(()=>{});
 window.AW_WARDROBE?.notifyChange?.();
 render();t('AI 已识别 '+items.length+' 件，请确认');
}
function uploadCandidates(kind){
 const up=UPLOADED.slice().reverse();
 if(up.length)return up.slice(0,8);
 return [];
}
function extractTraitsPreview(item){
 const h=item.hidden_traits||{};
 const vals=DIMS.map(d=>Object.assign({},d,{v:Math.max(6,Math.min(100,Math.round(h[d.k]!==undefined?h[d.k]:55)))}));
 const hot=vals.slice().sort((a,b)=>b.v-a.v).slice(0,2).map(x=>x.k);
 return `<div class="trait-grid">${vals.map((d,i)=>{
  const isHot=hot.indexOf(d.k)>-1;
  return `<div class="trait ${isHot?'hot':''}"><div class="trait-top"><span class="trait-name">${d.label}${isHot?'<i class="trait-star">高光</i>':''}</span><em class="trait-val">${d.v}</em></div><p class="trait-line">${d.line}</p><i class="trait-bar"><b style="width:${d.v}%;animation-delay:${(i*0.07).toFixed(2)}s"></b></i></div>`;
 }).join('')}</div>`;
}
function renderRecognize(){
 setChrome('AI 识别 / 确认',true);
 const pool=uploadCandidates(S.uploadKind);
 if(!pool.length){
  return `<div class="screen" style="padding-top:40px">
  <div class="kicker">AI RECOGNITION</div><div class="sp8"></div>
  <h2 class="h2">还没有上传照片</h2>
  <p class="sub" style="margin-top:10px">拍照或从相册选择一张衣服照片，AI 会自动识别并整理。</p>
  <div class="sp24"></div>
  <div class="card panel" style="text-align:center;padding:30px 20px">
   <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.2" style="width:64px;height:64px;opacity:.3"><rect x="8" y="14" width="48" height="36" rx="5"/><circle cx="22" cy="28" r="6"/><path d="m8 44 15-13 9 7 7-5 17 13"/></svg>
   <div class="sp16"></div>
   <b style="font-size:13px">还没有上传任何照片</b>
   <p class="sub" style="margin-top:6px">上传衣服照片后，AI 会在这里展示识别结果</p>
  </div>
  <div class="sp20"></div>
  <div class="choice3">
   ${uploadChoice('camera','拍照','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 1.5-2h5L16 6"/><circle cx="12" cy="13" r="4"/></svg>')}
   ${uploadChoice('album','从相册选择','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>')}
   ${uploadChoice('batch','批量选择','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="5" width="13" height="14" rx="2"/><path d="M3 8V5a3 3 0 0 1 3-3h10"/></svg>')}
  </div>
  <div class="sp20"></div><button class="btn ghost full" data-go="add">返回添加衣服</button></div>`;
 }
 if(S.uploadPick>=pool.length)S.uploadPick=0;
 const picked=pool[S.uploadPick]||{};
 const srcLabel=S.uploadKind==='camera'?'拍照上传':S.uploadKind==='batch'?'批量选择':'相册选择';
 const seasonCn=((picked.visible_traits&&picked.visible_traits.season)||[]).map(s=>SEASON_CN[s]).filter(Boolean).join(' ');
 const rTags=[
  {t:catLabel(picked.category),k:'cat'},
  {t:picked.color_name,k:'color'},
  ...(picked.style_tags_cn||[]).map(s=>({t:s,k:'style'})),
  {t:picked.material_cn,k:'material'},
  seasonCn?{t:seasonCn,k:'season'}:null
 ].filter(x=>x&&x.t);
 const chooser=pool.length>1?`<div class="cand-row">${pool.map((x,i)=>`<button class="cand ${i===S.uploadPick?'on':''}" data-cand="${i}" aria-label="${x.name||'单品'}"><img src="${A(x.image_url)}" alt="${x.name||''}">${x.source==='upload'?'<i class="cand-new">新</i>':''}</button>`).join('')}</div>`:'';
 return `<div class="screen" style="padding-top:17px"><div class="kicker">AI 已整理 · ${srcLabel}</div><div class="sp8"></div><h2 class="h2">确认要加入衣柜的单品</h2>
 <p class="sub" style="margin-top:6px">${pool.length>1?`共 ${pool.length} 件候选，点选缩略图切换，标签与特征会同步更新。`:'AI 从这张照片里整理出 1 件单品。'}</p>
 <div class="sp12"></div>${chooser}
 <div class="outfit-frame"><div class="ai-full ${picked.source==='upload'?'is-upload':''}"><img src="${A(picked.image_url)}" alt="${picked.name||''}"></div>
 <div class="of-head" style="margin-top:10px"><div><span class="of-source ${picked.source==='upload'?'ai':''}">${picked.source==='upload'?'刚刚上传 · AI 识别':'已有单品 · 待确认'}</span><div class="of-name">${picked.name||'单品'}</div></div></div></div>
 <div class="sp12"></div><div class="typed-tags">${rTags.map(x=>`<span class="typed-tag ${x.k}">${x.t}</span>`).join('')}</div>
 <div class="sp14"></div><div class="card panel analysis"><div class="trait-head"><b>AI 读懂了它的性格</b><span class="trait-kicker">8-DIM SPECTRUM</span></div><p class="sub" style="margin-top:5px">不止认出品类颜色——AI 把它的气场、触感与态度拆成 8 条光谱，直接喂给推荐引擎。</p><div class="sp10"></div>${extractTraitsPreview(picked)}</div>
 <div class="sp18"></div><button class="btn pri full" data-confirm-clothes>确认并加入衣柜</button><div class="sp8"></div><button class="btn sec full" data-go="add">修改 / 再选</button></div>`;
}
function renderDone(){
 setChrome('衣柜准备好了',true);
 const uploaded=UPLOADED.length;
 const total=wardrobeItems().length;
 return `<div class="screen" style="padding-top:26px"><div class="kicker">READY</div><div class="sp8"></div><h1 class="h1">AI 已经认识<br>你的衣服了。</h1>
 <p class="sub" style="margin-top:10px">现在不用再管理，直接去玩。以后每个玩法都会优先从这些衣服里找答案。</p>
 <div class="sp20"></div><div class="card panel"><div class="between"><span class="sub">${uploaded?'本次上传':'衣柜已有'}</span><b style="font:700 32px var(--serif);color:var(--accent)">${uploaded||total} 件</b></div>
 <div class="sp14"></div><div class="readchips"><span class="chip">上装</span><span class="chip">下装</span><span class="chip">外套</span><span class="chip">鞋履</span><span class="chip">包袋</span></div></div>
 <div class="sp20"></div><button class="btn pri full" data-finish>开始玩</button></div>`;
}
function homeDecor(){return `<svg class="home-decor" viewBox="0 0 430 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.1" opacity=".6"><path d="M77 0v207M94 0v210M295 0v194M312 0v196M112 0c36 41 64 32 101 0m22 0c37 32 65 41 101 0"/><path d="M102 178c-21-46-34-72-56-106M336 176c29-48 39-68 58-89"/><path d="M28 465c4-44 14-75 27-100m0 0c-8 18-11 41-7 63m7-63c4 28 16 43 26 55M398 483c-5-47-14-80-31-112m0 0c2 23-1 42-8 60m8-60c-11 25-20 36-35 48"/><path d="M0 657c30-23 53-28 88-22m-88 43c36-11 61-13 94-4m336-37c-36-18-68-18-99-10m99 50c-41-12-75-15-103-3"/></g><g class="home-stars" fill="currentColor" opacity=".65"><circle cx="61" cy="37" r="2"/><circle cx="351" cy="44" r="2"/><circle cx="388" cy="177" r="1.6"/><circle cx="24" cy="253" r="1.7"/><circle cx="300" cy="212" r="1.2"/><circle cx="43" cy="551" r="1.5"/><circle cx="380" cy="585" r="1.5"/><path d="M361 113l3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM38 185l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g><g fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"><path d="M395 133v45m-8 0h16l-4 30h-8Z"/><path d="M94 639c-29-10-47-33-52-68m31 70c-11-31-9-50-1-68m327 62c-8-39-22-58-44-76m27 76c3-25 12-44 27-57"/><path d="M53 593c-19-6-21-15-22-21 13-2 20 4 22 21Zm21-10c-5-14 0-22 6-27 8 8 8 17-6 27Zm294 7c-5-14-1-22 6-28 9 8 7 18-6 28Zm-12 13c-12-8-13-17-11-23 12 0 18 9 11 23Z"/></g></svg>`}

// 悬挂卡片流数据（与参考包 aw-home.js 完全一致：bc/bs 为卡片数据色，more 为扩展位）
const BOARDS = [
  {k:'tarot',    t:'塔罗牌',    s:'神谕指引',        bc:'#9b7fc4', bs:'rgba(155,127,196,.14)', img:'tarot'},
  {k:'social',   t:'社交能量条', s:'说说你今天的状态', bc:'#1D9E75', bs:'rgba(29,158,117,.12)', img:'social'},
  {k:'identity', t:'身份扮演',  s:'今天你想成为谁',   bc:'#D4537E', bs:'rgba(212,83,126,.12)', img:'identity'},
  {k:'style',    t:'跃然搭配',  s:'直接写下今天的搭配', bc:'#BA7517', bs:'rgba(186,117,23,.12)', img:'style'},
  {k:'more',     t:'更多玩法',  s:'自定义',           bc:'#9d95b3', bs:'rgba(157,149,179,.12)', img:'more', ext:true}
];
let stackThemeObserved = false;

function currentCardTheme(){return document.documentElement.getAttribute('data-theme')==='space'?'dark':'light'}

// 渲染悬挂卡片流（DOM 结构与参考包 renderStack 完全一致）
function renderStack() {
  const theme = currentCardTheme();
  let html = '';
  BOARDS.forEach((b, i) => {
    const ext = b.ext ? ' stack-ext' : '';
    const delay = (i * 0.7) + 's';
    html += `<button type="button" class="stack-card${ext}" data-board="${b.k}" style="--bc:${b.bc};--bs:${b.bs}">` +
      `<span class="stack-card-inner" style="--delay:${delay}">` +
      `<img class="stack-card-img" src="${A('assets/cards/' + theme + '_' + b.img + '.png')}" alt="${b.t}" />` +
      `<span class="stack-t">${b.t}</span>` +
      `<span class="stack-tag">${b.s}</span>` +
      `</span></button>`;
  });
  return html;
}

// 主题切换后原地刷新卡片图（与参考包 refreshCardImgs 完全一致）
function refreshCardImgs() {
  const theme = currentCardTheme();
  BOARDS.forEach(b => {
    const card = document.querySelector(`.stack-card[data-board="${b.k}"] img`);
    if (card) card.src = A('assets/cards/' + theme + '_' + b.img + '.png');
  });
}

// 绑定横滑拖拽 + 惯性 + 吸附（按规格文档实现）
function bindStackDrag() {
  const vp = document.getElementById('stack-viewport');
  if (!vp) return;
  const cards = [...vp.querySelectorAll('.stack-card')];
  const centerOf = c => c.offsetLeft + c.offsetWidth / 2;

  function nearestIndex() {
    const cx = vp.scrollLeft + vp.clientWidth / 2;
    let bi = 0, bd = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(centerOf(c) - cx);
      if (d < bd) { bd = d; bi = i; }
    });
    return bi;
  }

  function scrollToCard(i) {
    const idx = Math.max(0, Math.min(i, cards.length - 1));
    vp.scrollTo({ left: centerOf(cards[idx]) - vp.clientWidth / 2, behavior: 'smooth' });
  }

  function setSnap(on) {
    vp.style.scrollSnapType = on ? 'x mandatory' : 'none';
    vp.style.scrollBehavior = on ? '' : 'auto';
  }

  let dragging = false, moved = false, downCard = null;
  let startX = 0, startScroll = 0, lastX = 0, lastT = 0, vx = 0, raf = null;
  let lastTapAt = 0, lastDragAt = 0;

  // 选中卡片并进入对应玩法
  function activateCard(c) {
    if (!c) return;
    cards.forEach(function (x) { x.classList.remove('active'); });
    c.classList.add('active');
    var route = { tarot: 'tarot', social: 'energy', identity: 'identity', style: 'input' }[c.dataset.board];
    if (route) go(route);
    else t('更多玩法即将上线');
  }

  vp.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging = true; moved = false;
    downCard = e.target && e.target.closest ? e.target.closest('.stack-card') : null;
    startX = lastX = e.clientX;
    startScroll = vp.scrollLeft;
    lastT = performance.now(); vx = 0;
    setSnap(false);
    try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    vp.style.cursor = 'grabbing';
    vp.style.userSelect = 'none';
  });

  vp.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = startX - e.clientX;
    if (Math.abs(dx) > 3) moved = true;
    vp.scrollLeft = startScroll + dx;
    var now = performance.now();
    vx = (lastX - e.clientX) * (16 / Math.max(now - lastT, 1));
    lastX = e.clientX; lastT = now;
  });

  function endDrag(allowTap) {
    if (!dragging) return;
    dragging = false;
    try { vp.releasePointerCapture(); } catch (_) {}
    vp.style.cursor = ''; vp.style.userSelect = '';
    // tap（无位移）：直接进入玩法。不能只依赖 click——pointer capture 会把 click 重定向到视口，卡片收不到
    if (!moved) {
      setSnap(true);
      if (allowTap) { lastTapAt = Date.now(); activateCard(downCard); }
      return;
    }
    lastDragAt = Date.now();
    var step = function () {
      vx *= 0.93;
      if (Math.abs(vx) < 0.6) { setSnap(true); scrollToCard(nearestIndex()); raf = null; return; }
      vp.scrollLeft += vx;
      raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }

  vp.addEventListener('pointerup', function () { endDrag(true); });
  vp.addEventListener('pointercancel', function () { endDrag(false); });

  // click：兜底键盘 / 无指针事件环境；与 tap / 拖拽去重（click 可能被 pointer capture 重定向到视口，故绑在 vp 上）
  vp.addEventListener('click', function (e) {
    var now = Date.now();
    if (now - lastTapAt < 700) return;   // 指针 tap 已处理
    if (now - lastDragAt < 700) return;  // 拖拽后的残留 click 不触发
    var c = e.target && e.target.closest ? e.target.closest('.stack-card') : null;
    activateCard(c || downCard);
  });

  // scroll：追踪活跃卡片
  vp.addEventListener('scroll', function () {
    if (dragging) return;
    var ni = nearestIndex();
    cards.forEach(function (x, i) { x.classList.toggle('active', i === ni); });
  });

  if (cards[0]) cards[0].classList.add('active');

  // 初始居中第一张卡
  var first = vp.querySelector('.stack-card');
  if (first) vp.scrollLeft = first.offsetLeft + first.offsetWidth / 2 - vp.clientWidth / 2;

  // 主题切换后刷新卡片图（只注册一次）
  if (!stackThemeObserved) {
    stackThemeObserved = true;
    new MutationObserver(() => refreshCardImgs())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
}
const FEED=[
 {id:'p1',user:'林小满',handle:'@manman',avatar:'assets/demo-clothes/avatar1.png',img:'assets/demo-clothes/post1.png',time:'2 小时前',place:'西安 · 大雁塔',
  title:'雾紫 + 奶油白，通勤也能很轻',body:'今天降温，把薄针织叠在衬衫外面，配一条米白直筒裤。整体颜色压低，但领口的雾紫是唯一视觉中心，安静又有分寸。',tags:['通勤','叠穿','雾紫'],likes:128,comments:14,saved:22},
 {id:'p2',user:'Aster',handle:'@aster.style',avatar:'assets/demo-clothes/avatar2.png',img:'assets/demo-clothes/post2.png',time:'5 小时前',place:'成都 · 东郊记忆',
  title:'一件外套，撑起整周的松弛感',body:'廓形外套 + 内搭同色系，鞋包都选了低饱和。外出逛展一整天，走累了也不显邋遢，这是我今年最常复用的公式。',tags:['松弛感','廓形','逛展'],likes:342,comments:39,saved:88},
 {id:'p3',user:'苏黎',handle:'@suli',avatar:'assets/demo-clothes/avatar3.png',img:'assets/demo-clothes/post3.png',time:'昨天',place:'杭州 · 天目里',
  title:'第一次约会，别太用力',body:'不用把存在感拉满。柔软的针织裙配低跟，锁骨留白，剩下交给干净的发型。被夸的是“很舒服”，这就够了。',tags:['约会','柔软','留白'],likes:521,comments:63,saved:140},
 {id:'p4',user:'南枝',handle:'@nanzhi',avatar:'assets/demo-clothes/avatar4.png',img:'assets/demo-clothes/post4.png',time:'2 天前',place:'南京 · 先锋书店',
  title:'雨天也要有的层次感',body:'阴天就穿深一点。藏蓝大衣里露一截浅色领口，鞋选防水的皮质。报童帽是最后的点睛，雨天氛围直接拉满。',tags:['雨天','深色','层次'],likes:204,comments:27,saved:51},
 {id:'p5',user:'林小满',handle:'@manman',avatar:'assets/demo-clothes/avatar1.png',img:'assets/demo-clothes/post5.png',time:'3 天前',place:'西安 · 老城根',
  title:'周末的松弛，从一双鞋开始',body:'整套只有两个颜色，靠材质区分。上身亚麻的颗粒感对上光面皮质鞋，简单但不单调，拍照很出片。',tags:['周末','亚麻','极简'],likes:176,comments:18,saved:44},
 {id:'p6',user:'苏黎',handle:'@suli',avatar:'assets/demo-clothes/avatar3.png',img:'assets/demo-clothes/post6.png',time:'4 天前',place:'上海 · 武康路',
  title:'当季新品里最值得抄的一套',body:'秀场把长裙配上了硬朗外套，我照着试了一次，意外好穿。柔软的裙摆和挺阔的肩线互相拉扯，非常有故事感。',tags:['当季趋势','硬柔对比','秀场'],likes:733,comments:92,saved:210}
];
function fmtCount(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n)}
function feedCard(p,{compact=false}={}){
 const liked=!!S.likes?.[p.id];
 return `<article class="feed-post" data-post="${p.id}">
 <header class="feed-head"><span class="feed-avatar"><img src="${A(p.avatar)}" alt="${p.user}"></span><span class="feed-user"><b>${p.user}</b><i>${p.handle}${p.place?' · '+p.place:''}</i></span><span class="feed-time">${p.time}</span></header>
 <h3 class="feed-title">${p.title}</h3>
 <div class="feed-media"><img src="${A(p.img)}" alt="${p.title}"></div>
 <p class="feed-body">${p.body}</p>
 <div class="feed-tags">${p.tags.map(x=>`<span class="chip">#${x}</span>`).join('')}</div>
 <footer class="feed-foot"><button class="feed-act ${liked?'on':''}" data-like="${p.id}"><svg viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.7C19 15.6 12 20 12 20Z"/></svg>${fmtCount(p.likes+(liked?1:0))}</button><button class="feed-act"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12Z"/></svg>${fmtCount(p.comments)}</button><button class="feed-act" data-save="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h12v18l-6-4.5L6 21Z"/></svg>${fmtCount(p.saved)}</button></footer></article>`;
}
function renderHome(){
 setChrome('',false);
 const title=S.target==='today'?'今天穿什么？':S.target==='tomorrow'?'明天穿什么？':targetLabel()+'穿什么？';
 const shortDate=S.target==='today'?'今日':S.target==='tomorrow'?'明日':targetLabel();
 const night=document.documentElement.dataset.theme==='space';
 const feed=FEED.slice(0,3).map(p=>feedCard(p)).join('');
 const stackHtml=renderStack();
 return `<div class="screen home-screen"><div class="home-quick-actions"><button data-go="me" aria-label="打开我的页面"><span aria-hidden="true">☺</span>我的</button><button data-toggle-theme aria-label="切换流光和深空主题"><span aria-hidden="true">${night?'☀':'☾'}</span>${night?'流光':'深空'}</button></div><section class="home-sky"><span class="home-spark">✦</span><h1 class="home-title">${title}<span style="font-size:.53em;color:var(--accent);vertical-align:top"> ✦</span></h1><div class="home-sub">让神谕为你选出${shortDate}穿搭</div><button class="weather-pill" data-home-date aria-label="选择穿搭日期"><span class="sun-dot">🌤</span><span>西安 18°C 阴 · 适合叠穿</span><span>›</span></button></section><section class="card-stack"><div class="stack-viewport" id="stack-viewport">${stackHtml}</div></section><section class="home-feed"><div class="feed-section-head"><b>穿搭灵感</b><button class="linkbtn" data-go="plaza">去广场 →</button></div>${feed}</section></div>`;
}

function renderGames(){
 setChrome('更多玩法',true);
 const rows=Object.keys(games).map(id=>`<div class="game-row"><div class="game-icon">${games[id].art==='tarot'?'✦':games[id].art==='energy'?'▣':games[id].art==='identity'?'☾':'⌁'}</div>
 <div><div class="game-name">${games[id].name}</div><div class="game-desc">${games[id].desc}</div></div>
 <button class="chip ${S.homeGames.includes(id)?'on':''}" data-toggle-game="${id}">${S.homeGames.includes(id)?'已添加':'＋ 添加'}</button></div>`).join('');
 return `<div class="screen" style="padding-top:18px"><div class="kicker">PLAYGROUND</div><div class="sp6"></div><h2 class="h2">选择玩法</h2><p class="sub" style="margin-top:6px">每个玩法都只有一句话说明；首页只放你真正想留的。</p><div class="sp14"></div><div class="game-list">${rows}</div>
 <div class="sp18"></div><div class="card panel"><b style="font-size:12px">即将支持</b><div class="readchips" style="margin-top:9px"><span class="chip">生肖幸运色</span><span class="chip">星座</span><span class="chip">盲盒</span><span class="chip">抽签</span></div></div></div>`;
}
function tarotBack(){return `<svg viewBox="0 0 158 225" aria-hidden="true"><defs><linearGradient id="ivory" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#f1e3d0"/></linearGradient><linearGradient id="gold" x1="0" x2="1"><stop stop-color="#c89d63"/><stop offset=".5" stop-color="#e2c492"/><stop offset="1" stop-color="#b98648"/></linearGradient></defs><rect x="1" y="1" width="156" height="223" rx="11" fill="url(#ivory)"/><rect x="8" y="8" width="142" height="209" rx="7" fill="none" stroke="url(#gold)" stroke-width="1.2"/><rect x="13" y="13" width="132" height="199" rx="5" fill="none" stroke="#d9bb8e" stroke-width=".6"/><g fill="none" stroke="#d2af7e" opacity=".8" stroke-width=".7"><path d="M22 26h114M22 199h114M25 33l105 159M132 33 27 192M20 68h118M20 158h118"/><circle cx="79" cy="112" r="42"/><circle cx="79" cy="112" r="32"/><circle cx="79" cy="112" r="23"/></g><g fill="url(#gold)"><path d="M79 72l7 32 32 8-32 7-7 33-8-33-31-7 31-8Z"/><path d="M79 86l4 22 22 4-22 4-4 22-4-22-22-4 22-4Z" fill="#f7f0e6"/><circle cx="79" cy="112" r="4"/><path d="M79 34l2 7 7 2-7 2-2 7-2-7-7-2 7-2ZM79 174l2 7 7 2-7 2-2 7-2-7-7-2 7-2ZM31 111l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g><g fill="none" stroke="#bd8c50" stroke-width="1.5"><path d="M35 27a8 8 0 1 0 8 13 8 8 0 1 1-8-13ZM121 27a8 8 0 1 0 8 13 8 8 0 1 1-8-13ZM35 184a8 8 0 1 0 8 13 8 8 0 1 1-8-13ZM121 184a8 8 0 1 0 8 13 8 8 0 1 1-8-13Z"/></g><g fill="#c9a16d" opacity=".75"><circle cx="30" cy="63" r="1.3"/><circle cx="128" cy="63" r="1.3"/><circle cx="42" cy="165" r="1.2"/><circle cx="117" cy="165" r="1.2"/><circle cx="20" cy="112" r="1.1"/><circle cx="138" cy="112" r="1.1"/></g></svg>`}
function initTarot(){
 S.tarotOrder=[...Array(DECK.length).keys()].sort(()=>Math.random()-.5);
 S.tarotPicked=[];S.tarotRot=-11*12;S.tarotReveal=false;save();
}
function renderTarot(){
 setChrome('',true);
 if(!S.tarotOrder.length)initTarot();
 const slots=S.tarotPicked.map((p,i)=>`<div class="pickslot filled" aria-label="已抽第${i+1}张">${tarotBack()}</div>`).join('');
 return `<div class="screen tarot-screen"><span class="tarot-crescent" aria-hidden="true"></span><div class="tarot-center"><h2>${S.tarotPicked.length<3?'抽第'+(S.tarotPicked.length+1)+'张牌':'三张牌已选'}</h2><div class="tarot-progress"><span>${S.tarotPicked.length} / 3</span></div><div class="tarot-instruction">${S.tarotPicked.length<3?'滑动牌轮 · 点击选牌':'准备一起揭晓'}</div><div class="tarot-slots">${slots}</div></div><div class="twheel" id="twheel"><div class="tmid" id="tmid"></div></div>${S.tarotPicked.length===3?revealOverlay():''}</div>`;
}
function revealOverlay(){
 const cards=S.tarotPicked.map(p=>`<div class="flipcard ${S.tarotReveal?'on':''}"><div class="flipinner"><div class="flipface flipback">${tarotBack()}</div><div class="flipface flipfront"><b>${p.card[1]}${p.rev?' · 逆':''}</b><span>${p.card[2].join(' · ')}</span></div></div></div>`).join('');
 return `<div class="reveal-overlay"><div class="kicker">三张一起揭晓</div><div class="sp14"></div><div class="reveal-row">${cards}</div><div class="sp18"></div><div class="sub">${S.tarotReveal?'正在进入穿搭结果…':'三张牌正在翻开'}</div></div>`;
}
let tw={drag:false,y0:0,r0:0,moved:0};
function mountTarotWheel(){
 const w=$('#twheel');if(!w||S.tarotPicked.length>=3)return;
 const N=DECK.length,STEP=12,R=350;
 const taken=i=>S.tarotPicked.some(p=>p.slot===i);
 const cand=()=>{let b=0,v=1e9;for(let i=0;i<N;i++){const d=Math.abs(i*STEP+S.tarotRot);if(d<v){v=d;b=i}}return b};
 function layout(){
  const c=cand(),cx=(w.clientWidth||430)+70;
  $$('.tcard',w).forEach((el,i)=>{
   const delta=(i*STEP+S.tarotRot)/STEP;
   const a=(-145+delta*10)*Math.PI/180;
   const x=cx+R*Math.cos(a),y=445+R*Math.sin(a),rot=-20+delta*6.5;
   el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${rot}deg)`;
   el.style.zIndex=String(i===c?60:Math.max(1,45-Math.abs(delta)));
   el.classList.toggle('pick',i===c&&!taken(i));el.classList.toggle('taken',taken(i));
  });
 }
 S.tarotOrder.forEach((ci,i)=>{const el=document.createElement('div');el.className='tcard';el.dataset.i=i;el.innerHTML=tarotBack();w.appendChild(el)});
 layout();
 const snap=()=>{S.tarotRot=Math.round(S.tarotRot/STEP)*STEP;let c=cand();if(taken(c)){for(let k=1;k<N;k++){const l=c-k,r=c+k;if(l>=0&&!taken(l)){S.tarotRot=-l*STEP;break}if(r<N&&!taken(r)){S.tarotRot=-r*STEP;break}}}save();layout()};
 w.addEventListener('pointerdown',e=>{tw={drag:true,y0:e.clientY,r0:S.tarotRot,moved:0};w.classList.add('drag');try{w.setPointerCapture(e.pointerId)}catch(_){}});
 w.addEventListener('pointermove',e=>{if(!tw.drag)return;const dy=e.clientY-tw.y0;tw.moved=Math.max(tw.moved,Math.abs(dy));S.tarotRot=Math.max(-(N-1)*STEP,Math.min(0,tw.r0+dy*.2));layout()});
 const end=()=>{if(!tw.drag)return;tw.drag=false;w.classList.remove('drag');snap()};w.addEventListener('pointerup',end);w.addEventListener('pointercancel',end);
 w.addEventListener('wheel',e=>{e.preventDefault();S.tarotRot=Math.max(-(N-1)*STEP,Math.min(0,S.tarotRot-e.deltaY*.05));snap()},{passive:false});
 w.addEventListener('click',()=>{if(tw.moved>8){tw.moved=0;return}const i=cand();if(taken(i))return;const card=DECK[S.tarotOrder[i]];S.tarotPicked.push({slot:i,card,rev:Math.random()<.38});save();render();if(S.tarotPicked.length===3){setTimeout(()=>{S.tarotReveal=true;save();render();setTimeout(()=>{requestRecommendation('tarot')},1900)},500)}});
}

function energyCopy(v){const t=(v-1)/99;if(v<25)return'今天更想省一点外界消耗：熟悉、轻维护、少一点视觉中心。';if(v<50)return'保留体面，但不让衣服一直“在线”。';if(v<75)return'可以多一点回应和层次，但不用把存在感拉满。';return'愿意承担更多目光，造型可以更主动，但场合和天气仍然优先。'}
function renderEnergy(){
 setChrome('社交电量',true);
 return `<div class="screen energy-wrap"><div class="kicker">${targetLabel()}</div><div class="sp8"></div><h2 class="h2">今天愿意把多少自己交给外界？</h2><p class="sub" style="margin-top:7px">只调表达强度，不等于心情、人数、颜色或正式度。</p>
 <div class="sp24"></div><div class="energy-number"><span id="enum">${S.energy}</span></div><div class="sub">/ 100</div>
 <div class="energy-range"><input id="erange" type="range" min="1" max="100" value="${S.energy}"><div class="energy-track-labels"><span>更省力</span><span>更主动</span></div></div>
 <div class="energy-echo" id="ecopy">${energyCopy(S.energy)}</div><div class="sp24"></div><button class="btn pri full" data-energy-result>按这个电量搭一套</button></div>`;
}
function renderIdentity(){
 setChrome('身份扮演',true);
 const groups=Object.entries(identityGroups).map(([group,names])=>{
  const selected=names.includes(S.identity);
  const options=names.map(name=>`<button class="identity-option ${S.identity===name?'on':''}" data-role="${name}" data-group="${group}" aria-pressed="${S.identity===name}"><span class="identity-option-name">${name}</span><span class="identity-option-desc">${identityKW[name]}</span></button>`).join('');
  return `<section class="identity-group ${selected?'selected':''}" aria-label="${group}"><div class="identity-group-head"><span>${group}</span><i aria-hidden="true"></i></div><div class="identity-options">${options}</div></section>`;
 }).join('');
 return `<div class="screen identity-screen"><div class="identity-kicker">${targetLabel()}</div><h2 class="identity-title">想拿什么剧本？</h2><p class="identity-lead">六个频道都在这里。选一个身份，让它成为今天的穿搭方向。</p><div class="identity-grid">${groups}</div><div class="identity-cta"><button class="btn pri full" data-identity-result>就用这个身份</button><p class="identity-current">当前选择 · ${S.identity}</p></div></div>`;
}
function parseInput(s){
 const a=[];if(/客户|会议|商务|面试|汇报/.test(s))a.push('客户 / 商务');if(/骑车|走路|通勤|活动/.test(s))a.push('需要活动');if(/冷|降温|保暖/.test(s))a.push('注意保暖');if(/不要红|不穿红/.test(s))a.push('不要红色');if(/约会/.test(s))a.push('约会');if(/逛展|看展/.test(s))a.push('逛展');if(/绿色裙|绿裙/.test(s))a.push('必须绿色裙子');if(!a.length)a.push('日常出行','轻松但有完整度');return a.slice(0,5)
}
const YUE_PICKED_SETS=[[15,42,70,98],[23,49,76,92]];
const YUE_DEFAULT_LABELS=['上装','下装','鞋履','包袋'];
let yueRunToken=0,yueVariant=0;
function yuePicked(){return YUE_PICKED_SETS[yueVariant%YUE_PICKED_SETS.length]}
function yueSet(){const sets=resultSets('input');return sets[S.resultIndex]||sets[0]||null}
function yueCloth(){
 const s=yueSet();let imgs=(s&&s.source==='own'&&s.imgs)?s.imgs.slice(0,4):[];
 const pool=wardrobeItems().slice(0,4).map(x=>x.image_url);
 for(let i=0;imgs.length<4;i++)imgs.push(pool[i%Math.max(1,pool.length)]||'');
 return imgs;
}
function yueLabels(){
 const s=yueSet();let labels=[];
 if(s&&s.source==='own'&&s.item_ids){const map={};wardrobeItems().forEach(x=>map[x.item_id]=x);labels=s.item_ids.map(id=>catLabel((map[id]||{}).category))}
 labels=labels.filter(Boolean).slice(0,4);
 for(let i=labels.length;i<4;i++)labels.push(YUE_DEFAULT_LABELS[i]);
 return labels;
}
function yueEscape(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function yueBeadArt(i){
 const palette=['#e8ddd9','#b7c8d7','#897fa4','#cdb9a0','#27282f','#dcb9bc','#aeb4a5','#e9e4d8','#7e8ea1','#aa876f','#ddd2ed','#c8ced9'];
 const shapes=[
  'M28 24 18 33 10 30 3 46 16 53 20 47 20 82 80 82 80 47 84 53 97 46 90 30 82 33 72 24Z',
  'M29 21 71 21 82 80 18 80Z',
  'M39 23 61 23 78 43 70 51 64 45 64 82 36 82 36 45 30 51 22 43Z',
  'M26 43 74 43 80 79 20 79Z M34 43 C34 21 66 21 66 43',
  'M13 58 C30 50 52 61 69 51 L91 68 89 79 14 79Z',
  'M28 25 72 25 78 76 22 76Z'
 ];
 const color=palette[i%palette.length],p=shapes[i%shapes.length];
 return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${p}" fill="${color}" stroke="rgba(48,38,47,.22)" stroke-width="2" stroke-linejoin="round" fill-rule="evenodd"/></svg>`;
}
function renderInput(){
 setChrome('跃然搭配',true);
 if(S.inputDone)yueVariant=S.yueVariant||0;
 const active=!!(S.inputAnimating||S.inputDone);
 const images=yueCloth();
 const slots=yueLabels().map((label,i)=>`<div class="yue-slot ${S.inputDone?'on':''}" data-yue-slot="${i}">${S.inputDone?`<img src="${A(images[i]||yueCloth()[i])}" alt="${label}"><span>${label}</span>`:''}</div>`).join('');
 const examples=['陪客户吃饭，但下午要骑车过去','降温了，想穿得暖但不臃肿','周末逛展，想安静一点','第一次约会，别太用力'];
 const wc=wardrobeItems().length;
 return `<div class="screen yue-screen"><div class="yue-topline">${targetLabel()} · 跃然搭配</div><h2 class="yue-title">输入一句话，开始推荐</h2><p class="yue-intro">说出场合或感觉，让衣服从衣柜里跃出来。</p><div class="yue-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.7"/><path d="m16 16 4.5 4.5"/></svg><input id="prompt" value="${yueEscape(S.inputText)}" placeholder="今天想穿什么？" autocomplete="off"><button data-yue-start ${S.inputAnimating?'disabled':''}>开始搭配</button></div><div class="yue-examples">${examples.map(x=>`<button data-yue-example="${yueEscape(x)}">${x}</button>`).join('')}</div><div class="yue-readout">${S.inputChips.map(c=>`<span class="chip on">${yueEscape(c)}</span>`).join('')}</div><section class="yue-result ${active?'show':''}" id="yueResult"><div class="yue-result-heading">${wc?'从衣柜里挑出这一套':'AI 参考演示单品'}<span>四件依次跃出</span></div><div class="yue-slots">${slots}</div>${S.inputAnimating?'<div class="yue-loading"><i></i><i></i><i></i><span>正在从衣柜里翻…</span></div>':''}${S.inputDone?inputResultBlock():''}</section><div class="yue-bandwrap"><div class="yue-band" id="yueBand"></div><div class="yue-bandtag"><span>${wc?'我的电子衣柜 · '+wc+' 件':'示例单品库 · 可先体验'}</span><button data-go="wardrobe">进入衣柜 →</button></div></div></div>`;
}
function inputResultBlock(){return `<div class="yue-finish">${outfitBlock('input')}<div class="sp10"></div><div class="row"><button class="btn sec" style="flex:1" data-yue-again>再搭一套</button><button class="btn sec" style="flex:1" data-yue-reset>重新说</button></div></div>`}
function mountYueBand(){
 const band=$('#yueBand');if(!band)return;
 const n=104,w=band.clientWidth||398,cols=Math.max(11,Math.round(w/29)),cell=w/cols,rows=Math.ceil(n/cols),gap=Math.max(3,cell*.11),d=cell-gap;
 band.style.height=(rows*cell+16)+'px';band.innerHTML='';
 for(let i=0;i<n;i++){
  const r=Math.floor(i/cols),c=i%cols,x=c*cell+(r%2?cell*.45:0)+gap/2,y=r*cell+7;
  const el=document.createElement('div');el.className='yue-bead'+(S.inputDone&&yuePicked().includes(i)?' taken':'');
  el.style.cssText=`left:${x}px;top:${y}px;width:${d}px;height:${d}px`;
  const pick=yuePicked().indexOf(i);el.innerHTML=pick>=0?`<img src="${A(yueCloth()[pick])}" alt="">`:yueBeadArt(i);
  el.dataset.yueBead=i;el._cx=x+d/2;el._cy=y+d/2;el._d=d;band.appendChild(el);
 }
}
function yueRing(band,src){
 const size=src._d||27;
 [0,130].forEach((delay,k)=>{const ring=document.createElement('div');ring.className='yue-ring';ring.style.left=src._cx+'px';ring.style.top=src._cy+'px';band.appendChild(ring);
  ring.animate([{width:size+'px',height:size+'px',opacity:0},{width:size*1.6+'px',height:size*1.6+'px',opacity:k? .31:.6,offset:.14},{width:size*4.5+'px',height:size*4.5+'px',opacity:k?.15:.32,offset:.68},{width:size*7+'px',height:size*7+'px',opacity:0}],{duration:780,delay,fill:'both',easing:'cubic-bezier(.22,.62,.4,1)'});
  setTimeout(()=>ring.remove(),delay+860);
 });
}
function yueRipple(band,src){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const radius=155;
 $$('[data-yue-bead]',band).forEach(el=>{if(el===src)return;const dx=el._cx-src._cx,dy=el._cy-src._cy,dist=Math.hypot(dx,dy);if(dist>radius||dist<.01)return;const t=dist/radius,amp=(1-t)*(1-t)*23,ux=dx/dist,uy=dy/dist;
  el.animate([{transform:'translate(0,0) scale(1)',offset:0},{transform:`translate(${(ux*amp).toFixed(1)}px,${(uy*amp).toFixed(1)}px) scale(${(1+(1-t)*.1).toFixed(2)})`,offset:.3},{transform:`translate(${(-ux*amp*.3).toFixed(1)}px,${(-uy*amp*.3).toFixed(1)}px) scale(.99)`,offset:.64},{transform:'translate(0,0) scale(1)',offset:1}],{duration:680,delay:t*230,fill:'none'});
 });
 yueRing(band,src);
}
function yueFly(from,to,img,cb){
 const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();if(!a.width||!b.width){cb();return}
 const ghost=document.createElement('div');ghost.className='yue-ghost';ghost.style.cssText=`left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;ghost.innerHTML=`<img src="${A(img)}" alt="">`;document.body.appendChild(ghost);
 const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2,s=b.width/a.width,lift=-Math.min(130,Math.abs(dy)*.3+45);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)ghost.animate([
  {transform:'translate(0,0) scale(1) rotate(0deg)',borderRadius:'50%',offset:0},
  {transform:`translate(${dx*.1}px,${lift}px) scale(${1+(s-1)*.4}) rotate(-5deg)`,borderRadius:'44%',offset:.26},
  {transform:`translate(${dx*.55}px,${dy*.3+lift*.35}px) scale(${s*.8}) rotate(-2deg)`,borderRadius:'28%',offset:.56},
  {transform:`translate(${dx*1.06}px,${dy*1.07}px) scale(${s*1.05}) rotate(2deg)`,borderRadius:'14px',offset:.85},
  {transform:`translate(${dx}px,${dy}px) scale(${s}) rotate(0deg)`,borderRadius:'13px',offset:1}
 ],{duration:920,fill:'both',easing:'cubic-bezier(.38,0,.52,1)'});
 setTimeout(()=>{ghost.remove();cb()},matchMedia('(prefers-reduced-motion: reduce)').matches?40:1010);
}
async function yueStart(raw,again=false){
 const q=String(raw||'').trim();if(!q){$('#prompt')?.focus();return}
 if(again)yueVariant=(yueVariant+1)%YUE_PICKED_SETS.length;
 S.yueVariant=yueVariant;
 const token=++yueRunToken;S.inputText=q;S.inputChips=[];S.inputDone=false;S.inputAnimating=true;S.resultIndex=0;save();render();$('#stage').scrollTop=0;
 try{if(window.WardrobeAPI?.parseIntent){const r=await window.WardrobeAPI.parseIntent({text:q,target_date:ymd(targetDate())});S.inputChips=r.parsed_summary||parseInput(q)}else S.inputChips=parseInput(q)}catch(e){S.inputChips=parseInput(q)}
 if(token!==yueRunToken||S.route!=='input')return;save();render();$('#stage').scrollTop=0;setTimeout(()=>runInputFly(token),220);
}
function runInputFly(token=yueRunToken){
 if(token!==yueRunToken||S.route!=='input')return;
 const band=$('#yueBand'),slots=$$('[data-yue-slot]');if(!band||slots.length!==4)return;
 yuePicked().forEach((idx,k)=>{const start=k*270;setTimeout(()=>{if(token!==yueRunToken||S.route!=='input')return;const bead=$(`[data-yue-bead="${idx}"]`,band),slot=slots[k];if(!bead||!slot)return;bead.classList.add('lift');yueRipple(band,bead);setTimeout(()=>{if(token!==yueRunToken||S.route!=='input')return;yueFly(bead,slot,yueCloth()[k],()=>{if(token!==yueRunToken||S.route!=='input')return;slot.innerHTML=`<img src="${A(yueCloth()[k])}" alt="${yueLabels()[k]}"><span>${yueLabels()[k]}</span>`;slot.classList.add('on');bead.classList.remove('lift');bead.classList.add('taken');slot.animate([{transform:'scale(1.04) translateY(-2px)'},{transform:'scale(.99) translateY(1px)',offset:.6},{transform:'scale(1)'}],{duration:390,easing:'cubic-bezier(.34,1.4,.64,1)'})})},280)},start)});
 setTimeout(async()=>{if(token!==yueRunToken||S.route!=='input')return;S.inputAnimating=false;save();if(typeof requestRecommendation==='function')await requestRecommendation('input',{inline:true});else{S.inputDone=true;S.resultKind='input';save()}if(token!==yueRunToken||S.route!=='input')return;S.resultIndex=Math.min(yueVariant,resultSets('input').length-1);save();render()},2450);
}

function aiSet(){return {name:'AI 参考｜当季完整穿搭',source:'ai',full:(document.documentElement.dataset.theme==='space'?'assets/demo-clothes/ai_outfit_dark.png':'assets/demo-clothes/ai_outfit_model.png')}}
function normalizeApiOutfit(x){
 if(x.source==='ai_reference'||x.is_reference)return {name:x.name||'AI 参考穿搭',source:'ai',full:(document.documentElement.dataset.theme==='space'?(x.full_image_space||x.full_image):(x.full_image||x.full_image_space))};
 return {name:x.name||'我的衣柜方案',source:'own',item_ids:x.item_ids||[],imgs:(x.images||[]).slice(0,4)};
}
function resultSets(kind=S.resultKind||'energy'){
 const api=(S.apiOutfits&&S.apiOutfits[kind])||null;if(api&&api.length)return api.map(normalizeApiOutfit);
 return[aiSet()];
}
function sourcePayload(kind){
 if(kind==='energy')return {type:'social_energy',payload:{value:S.energy}};
 if(kind==='identity')return {type:'identity',payload:{identity:S.identity,channel:S.identityGroup}};
 if(kind==='tarot')return {type:'tarot',payload:{cards:S.tarotPicked.map(p=>({no:p.card[0],cn:p.card[1],kw:p.card[2],reversed:p.rev}))}};
 return {type:'input',payload:{raw_text:S.inputText,parsed_summary:S.inputChips}};
}
async function requestRecommendation(kind,{inline=false}={}){
 S.resultKind=kind;S.resultIndex=0;
 // 优先委托给 V10 AW_RENDER.open()，统一走 AW.state.results
 if(window.AW&&window.AW_RESULTS){
  // 塔罗：旧 S.tarotPicked → 同步到 V10 AW.state
  if(kind==='tarot'&&S.tarotPicked.length){
   const POS=['现在的你','正在发生的变化','今天给你的提醒'];
   AW.state.tarotPicked=S.tarotPicked.map((p,i)=>({slot:p.slot,card:{no:p.card[0],name:p.card[1],keywords:p.card[2]},reversed:!!p.rev,position:POS[i]||POS[0]}));
   AW.state.tarotPhase='reveal';AW.save();
  }
  // 能量/身份：同步到 V10 AW.state
  if(kind==='energy')AW.state.energy=S.energy;
  if(kind==='identity'){AW.state.identity=S.identity;AW.state.identityGroup=S.identityGroup}
  if(kind==='input')AW.state.input=S.inputText;
  const source={type:kind==='energy'?'social_energy':kind,
   payload:kind==='energy'?{value:S.energy}:kind==='identity'?{identity:S.identity,channel:S.identityGroup}:kind==='tarot'?{cards:S.tarotPicked.map(p=>({no:p.card[0],cn:p.card[1],kw:p.card[2],reversed:p.rev}))}:{raw_text:S.inputText,parsed_summary:S.inputChips}};
  try{await AW_RENDER.open(source,inline)}catch(e){console.warn('V10 recommend fallback',e)}
  return;
 }
 // V10 不可用时的兜底（保留旧路径）
 try{
   const res=await window.WardrobeAPI.createRecommendation({wardrobe_id:'wardrobe_me',target_date:ymd(targetDate()),created_at:new Date().toISOString(),source:sourcePayload(kind),wardrobe_ready:S.wardrobeReady,wardrobe_count:S.wardrobeCount});
   S.apiOutfits=S.apiOutfits||{};S.apiOutfits[kind]=res.outfits||[];save();
 }catch(e){console.warn('Recommendation API fallback',e)}
 if(inline){S.inputDone=true;save();render()}else go('result',true)
}
function resultStrip(kind){if(kind==='energy')return`社交电量 ${S.energy} / 100`;if(kind==='identity')return`${S.identity} · ${identityKW[S.identity]}`;if(kind==='tarot')return'塔罗 · 三张牌已揭晓';return`跃然 · ${S.inputChips.join(' · ')}`}
function reasonText(kind){if(kind==='energy')return`电量是 ${S.energy}。这套不改变场合本身，只把存在感、层次、维护负担和熟悉度调到更适合这个数值的位置。`;if(kind==='identity')return`你选的是「${S.identity}」。真实天气和场合先守住，再把「${identityKW[S.identity]}」翻成整套的轮廓、层次和视觉中心。`;if(kind==='tarot')return`三张牌给方向，不替现实做决定。天气和可穿性先过关，再把牌面的关键词翻译成轮廓、层次和存在感。`;return`系统先把你一句话里的场合、活动、体感和明确偏好拆出来，再从衣柜里找能同时满足这些条件的一整套。`}
function outfitBlock(kind){
 const sets=resultSets(kind);if(S.resultIndex>=sets.length)S.resultIndex=0;const set=sets[S.resultIndex];
 let board='';
 if(set.source==='ai'){board=`<div class="ai-full"><img src="${A(set.full)}" alt="AI 参考穿搭"></div>`}
 else board=`<div class="outfit-board"><div class="outfit-main"><img src="${A(set.imgs[0])}" alt=""></div><div class="outfit-small"><img src="${A(set.imgs[1])}" alt=""></div><div class="outfit-small"><img src="${A(set.imgs[2])}" alt=""></div></div>`;
 return `<div class="outfit-carousel" data-kind="${kind}"><div class="outfit-frame"><div class="of-head"><div><span class="of-source ${set.source==='ai'?'ai':''}">${set.source==='ai'?'AI 推荐参考｜不是你衣柜里的衣服':'来自我的衣柜'}</span><div class="of-name">${set.name}</div></div><span style="font-size:9px;color:#746d79">${S.resultIndex+1}/${sets.length}</span></div>${board}</div>
 ${sets.length>1?`<div class="dots-below"><div class="dots">${sets.map((_,i)=>`<i class="dot ${i===S.resultIndex?'on':''}"></i>`).join('')}</div><span class="swipe-hint">左右滑动切换 ${S.resultIndex+1}/${sets.length} 套</span></div>`:''}
 <div class="card reason"><h3 class="h3">为什么是这一套</h3><div class="sp8"></div><p>${reasonText(kind)}</p>${set.source==='ai'?`<div class="sp10"></div><div class="sub">这套只提供完整搭配参考，不假装你已经拥有这些单品。</div>`:''}</div>
 <div class="sp14"></div>${set.source==='ai'?`<button class="btn pri full" data-reference>参考这套</button>`:`<button class="btn pri full" data-confirm="${kind}">就穿这套</button>`}</div>`;
}
function renderResult(){
 const kind=S.resultKind||'energy';setChrome(kind==='tarot'?'塔罗结果':kind==='energy'?'社交电量结果':'身份结果',true);
 const extra=kind==='tarot'?tarotExplain():'';
 return `<div class="screen" style="padding-top:12px"><div class="source-strip"><i></i>${resultStrip(kind)}</div>${outfitBlock(kind)}${extra}</div>`;
}
function tarotExplain(){
 return `<div class="tarot-explain"><div class="sp16"></div><h3 class="h3">塔罗 + 穿搭解读</h3><div class="sp10"></div><div class="fanmini">${S.tarotPicked.map(p=>`<div class="mini"><b>${p.card[1]}${p.rev?' · 逆':''}</b><span>${p.card[2].slice(0,2).join(' · ')}</span></div>`).join('')}</div><div class="card reason"><p>牌给你的方向是：${S.tarotPicked.map(p=>p.card[2][0]).join('、')}。所以穿搭先保持整体美观与可穿，再把这些关键词放进视觉强弱和结构关系里。</p></div></div>`;
}
function renderWardrobe(){
 setChrome('我的衣柜',false);
 const all=wardrobeItems();
 const filters=[['all','全部'],['top','上装'],['bottom','下装'],['outer','外套'],['dress','连衣裙'],['shoe','鞋履'],['bag','包袋']];
 const list=S.wardrobeFilter==='all'?all:all.filter(x=>x.category===S.wardrobeFilter);
 const bar=filters.map(([k,label])=>`<button class="chip ${S.wardrobeFilter===k?'on':''}" data-wardrobe-filter="${k}">${label}</button>`).join('');
 const grid=list.map(x=>{
  const tags=[];
  tags.push({t:catLabel(x.category),k:'cat'});
  (x.style_tags_cn||[]).slice(0,2).forEach(s=>tags.push({t:s,k:'style'}));
  if(x.color_name)tags.push({t:x.color_name,k:'color'});
  if(x.material_cn)tags.push({t:x.material_cn,k:'material'});
  /* loading=lazy：85 件衣橱一次性建 DOM 时，视口外的图不再抢带宽与解码，
     配合 mobile-perf.css 的 content-visibility 是真机滚动最明显的优化。
     decoding=async：解码不阻塞主线程，避免滚动时的掉帧尖刺。 */
  return `<button class="warditem" data-garment="${x.item_id}"><div class="wardimg"><img src="${A(x.image_url)}" alt="${x.name}" loading="lazy" decoding="async"></div><div class="wardmeta"><b>${x.name}</b><div class="ward-tags">${tags.slice(0,4).map(g=>`<span class="ward-tag ${g.k}">${g.t}</span>`).join('')}</div></div></button>`;
 }).join('');
 return `<div class="screen" style="padding-top:14px"><div class="between"><div><div class="kicker">MY WARDROBE</div><div class="sp5"></div><h2 class="h2">我的衣柜</h2></div><button class="iconbtn" data-go="add">＋</button></div>
 <div class="filterbar">${bar}</div>
 ${all.length?`<div class="wardgrid">${grid}</div>`:`<div class="sp18"></div><div class="card panel"><b style="font-size:12px">你的衣柜还是空的</b><p class="sub" style="margin-top:6px">玩法仍然能跑，但只会给 AI 参考穿搭。</p><div class="sp12"></div><button class="btn pri full" data-go="add">添加第一件衣服</button></div>`}
 </div>`;
}
function renderGarment(){
 setChrome('单品详情',true);
 const it=wardrobeItems().find(x=>x.item_id===S.garmentId)||wardrobeItems()[0]||{};
 const seasonCn=((it.visible_traits&&it.visible_traits.season)||[]).map(s=>SEASON_CN[s]).filter(Boolean).join(' ');
 const src=it.source==='upload'?'我上传的单品 · AI 识别':'预置单品库';
 const typedTags=[
  {t:catLabel(it.category),k:'cat'},
  {t:it.color_name,k:'color'},
  ...(it.style_tags_cn||[]).map(s=>({t:s,k:'style'})),
  {t:it.material_cn,k:'material'},
  seasonCn?{t:seasonCn,k:'season'}:null
 ].filter(x=>x&&x.t);
 return `<div class="screen" style="padding-top:15px"><div class="outfit-frame"><div class="ai-full" style="height:360px"><img src="${A(it.image_url)}" style="object-fit:cover" alt="${it.name||''}"></div></div><div class="sp14"></div><h2 class="h2">${it.name||'单品'}</h2><p class="sub" style="margin-top:4px">${src}${it.stats?` · 已穿 ${it.stats.wear_count||0} 次`:''}</p><div class="sp10"></div><div class="typed-tags">${typedTags.map(x=>`<span class="typed-tag ${x.k}">${x.t}</span>`).join('')}</div><div class="sp16"></div><div class="card panel analysis"><div class="trait-head"><b>AI 读懂了它的性格</b><span class="trait-kicker">8-DIM SPECTRUM</span></div><p class="sub" style="margin-top:5px">这 8 条光谱，就是这件衣服的性格说明书——也是推荐引擎认识它的方式。</p><div class="sp10"></div>${extractTraitsPreview(it)}</div><div class="sp18"></div><button class="btn sec full" data-edit-garment>编辑基础信息</button></div>`;
}
function openGarmentEdit(){
 const it=wardrobeItems().find(x=>x.item_id===S.garmentId);if(!it)return;
 const cats=[['top','上装'],['bottom','下装'],['outer','外套'],['dress','连衣裙'],['shoe','鞋履'],['bag','包袋'],['accessory','配饰']];
 const m=modal(`<div class="between"><h3 class="h3">编辑基础信息</h3><button class="iconbtn" data-close>×</button></div><div class="sp12"></div>
 <label class="sub">名称</label><div class="sp6"></div><input id="gname" value="${yueEscape(it.name||'')}" style="width:100%;height:44px;border:1px solid var(--line);border-radius:12px;background:var(--elev);color:var(--text);padding:0 12px;font:inherit">
 <div class="sp12"></div><label class="sub">品类</label><div class="sp6"></div><div class="readchips">${cats.map(([k,l])=>`<button class="chip ${it.category===k?'on':''}" data-edit-cat="${k}">${l}</button>`).join('')}</div>
 <div class="sp12"></div><label class="sub">颜色</label><div class="sp6"></div><input id="gcolor" value="${yueEscape(it.color_name||'')}" style="width:100%;height:44px;border:1px solid var(--line);border-radius:12px;background:var(--elev);color:var(--text);padding:0 12px;font:inherit">
 <div class="sp16"></div><button class="btn pri full" data-save-garment>保存</button>`);
 let cat=it.category;
 $$('[data-edit-cat]',m).forEach(b=>b.onclick=()=>{cat=b.dataset.editCat;$$('[data-edit-cat]',m).forEach(x=>x.classList.toggle('on',x.dataset.editCat===cat))});
 $('[data-save-garment]',m).onclick=()=>{
   const name=$('#gname',m).value.trim()||it.name,color=$('#gcolor',m).value.trim()||it.color_name;
   ITEM_EDITS[it.item_id]={...ITEM_EDITS[it.item_id],name,category:cat,color_name:color};saveItemEdits();
   m.remove();render();t('已更新单品信息 ✓');
 };
}
function todayOutfit(){return S.confirmed[ymd(today)]}
function renderPlaza(){
 setChrome('',false);
 const head=`<div class="plaza-me-strip"><div class="pm-avatar"><img src="${A('assets/demo-clothes/avatar1.png')}" alt="${S.profile.name}"></div><div class="pm-copy"><b>${S.profile.name}</b><span>分享你的今日穿搭，让灵感流动起来</span></div><button class="btn pri pm-post" data-go="add">＋ 发帖</button></div>`;
 const feed=FEED.map(p=>feedCard(p)).join('');
 return `<div class="screen plaza-screen"><div class="plaza-head"><h1>广场</h1><button class="plaza-me" data-go="me" aria-label="进入我的主页">☺</button></div><p class="plaza-lead">看看大家今天怎么穿，也分享自己的灵感。</p>${head}<div class="plaza-feed">${feed}</div></div>`;
}

function renderMe(){
 setChrome('',false);const has=!!todayOutfit();const bg=has?A('assets/demo-clothes/ai_outfit_model.png'):null;
 const mine=FEED.filter(p=>p.user===S.profile.name);
 const mineFeed=mine.length?mine.map(p=>feedCard(p)).join(''):`<div class="card panel"><b style="font-size:12px">你还没有发布过帖子</b><p class="sub" style="margin-top:6px">去广场分享一套今天的穿搭，灵感会认识更多同好。</p><div class="sp12"></div><button class="btn sec full" data-go="plaza">去广场看看</button></div>`;
 return `<div class="screen"><div class="cover">${bg?`<img src="${bg}" alt="">`:''}<button class="iconbtn gear" data-go="settings">⚙</button><div class="profile"><div class="avatar"><img src="${A('assets/demo-clothes/avatar1.png')}" alt="${S.profile.name}"></div><div><b>${S.profile.name}</b><p>${S.profile.bio}</p></div></div></div>
 <div class="quick2"><button class="card quick" data-go="wardrobe"><b>我的衣橱</b><span>${wardrobeItems().length} 件单品</span></button><button class="card quick" data-go="records"><b>穿搭记录</b><span>历史 / 未来</span></button></div>
 <div class="between"><h3 class="h3">我发布过的帖子</h3><span class="sub">${mine.length} 条 · 广场</span></div><div class="me-feed">${mineFeed}</div></div>`;
}
function renderSettings(){
 setChrome('设置',true);
 return `<div class="screen" style="padding-top:12px"><div class="settings-list"><button class="setrow" data-go="profile"><span>个人信息</span><span>›</span></button><button class="setrow" data-go="theme"><span>主题设置</span><span>›</span></button><button class="setrow"><span>账号与隐私</span><span class="sub">Demo</span></button><button class="setrow"><span>关于</span><span class="sub">V1.3</span></button></div><div class="sp20"></div><button class="btn ghost full" data-reset>重置 Demo</button></div>`;
}
function renderTheme(){
 setChrome('主题设置',true);
 return `<div class="screen" style="padding-top:15px"><h2 class="h2">选择界面主题</h2><p class="sub" style="margin-top:6px">主题只改变 UI，不改变穿搭推荐。</p><div class="settings-list"><button class="setrow" data-theme="system"><span>跟随系统</span><b>${S.theme==='system'?'✓':''}</b></button><button class="setrow" data-theme="flow"><span>流光 · 雾紫</span><b>${S.theme==='flow'?'✓':''}</b></button><button class="setrow" data-theme="space"><span>深空 · 黑金</span><b>${S.theme==='space'?'✓':''}</b></button></div></div>`;
}
function renderProfile(){
 setChrome('个人信息',true);
 return `<div class="screen" style="padding-top:14px"><label class="sub">昵称</label><div class="sp6"></div><input id="pname" value="${S.profile.name}" style="width:100%;height:46px;border:1px solid var(--line);border-radius:14px;background:var(--elev);color:var(--text);padding:0 12px;font:inherit"><div class="sp14"></div><label class="sub">个人介绍</label><div class="sp6"></div><textarea id="pbio" style="width:100%;min-height:120px;border:1px solid var(--line);border-radius:14px;background:var(--elev);color:var(--text);padding:12px;font:inherit">${S.profile.bio}</textarea><div class="sp18"></div><button class="btn pri full" data-save-profile>保存</button></div>`;
}
function renderRecords(){
 setChrome('穿搭记录',true);const now=ymd(today);const arr=Object.entries(S.confirmed).map(([date,v])=>({date,...v})).sort((a,b)=>a.date.localeCompare(b.date)).filter(x=>S.recordTab==='history'?x.date<now:x.date>=now);
 return `<div class="screen" style="padding-top:10px"><div class="tabs"><button data-tab="history" class="${S.recordTab==='history'?'on':''}">历史记录</button><button data-tab="future" class="${S.recordTab==='future'?'on':''}">未来穿搭</button></div>${arr.length?arr.map(x=>`<div class="record" data-record="${x.date}"><div class="between"><b style="font-size:12px">${x.date===now?'今天':x.date}</b><span class="chip">${x.kind}</span></div><div class="sub" style="margin-top:5px">${x.name}</div></div>`).join(''):`<div class="card panel"><b style="font-size:12px">这里还没有记录</b><p class="sub" style="margin-top:6px">在玩法结果里点击“就穿这套”，会自动进入对应日期。</p></div>`}</div>`;
}
function renderRecord(){
 const x=S.confirmed[S.recordDate];if(!x)return renderRecords();setChrome('穿搭详情',true);return `<div class="screen" style="padding-top:10px"><div class="source-strip"><i></i>${S.recordDate} · ${x.kind}</div><div class="outfit-frame"><div class="ai-full"><img src="${A('assets/demo-clothes/ai_outfit_model.png')}"></div></div><div class="card reason"><h3 class="h3">为什么是这一套</h3><div class="sp8"></div><p>${x.reason}</p></div></div>`;
}
function render(){
 applyTheme();
 // V10 玩法模块路由：tarot/energy/identity/input/result 交给 V10 渲染
 const V10_ROUTES={tarot:'tarot',energy:'energy',identity:'identity',input:'yueran',result:'results',records:'records',record:'records'};
 const v10mod=V10_ROUTES[S.route];
 if(v10mod&&window.AW){
  const titles={tarot:'塔罗牌',energy:'社交电量',identity:'身份扮演',input:'跃然搭配',result:'推荐结果',records:'穿搭记录',record:'穿搭记录'};
  setChrome(titles[S.route]||'',true);
  $('#tabbar').style.display='none';
  $('#stage').style.height='calc(100% - 34px - 52px)';
  AW.state.theme=document.documentElement.dataset.theme||'flow';
  // 防踩：AW 内部导航（go→onNavigate）已同步 S.route，此时模块正在展示中（如结果页 loading/动画），
  // 不要重渲染把 AW.state.route 和进行中的交互打掉；只有 #stage 确实没在展示该模块时才渲染。
  // （不能只看 AW.state.route——它有默认值/持久化残留，会把“从首页进入”误判成“展示中”，
  //   出现 chrome 已是「塔罗牌」、内容还是首页的中间态。）
  if($('#stage').dataset.awModule!==v10mod)AW.renderModule(v10mod);
  bind(); // 仍绑定返回键等通用事件
  return;
 }
 let out='';
 if(S.route==='welcome')out=renderWelcome();else if(S.route==='why')out=renderWhy();else if(S.route==='add')out=renderAdd();else if(S.route==='recognize')out=renderRecognize();else if(S.route==='done')out=renderDone();else if(S.route==='home')out=renderHome();else if(S.route==='games')out=renderGames();
 else if(S.route==='wardrobe')out=renderWardrobe();else if(S.route==='garment')out=renderGarment();else if(S.route==='plaza')out=renderPlaza();else if(S.route==='me')out=renderMe();else if(S.route==='settings')out=renderSettings();else if(S.route==='theme')out=renderTheme();else if(S.route==='profile')out=renderProfile();else{S.route='home';out=renderHome()}
 $('#stage').dataset.awModule=''; // 离开 V10 模块渲染 app 页面，清掉模块标记
 $('#stage').innerHTML=out;bind();
 const scr=$('.screen',$('#stage'));
 if(scr&&!matchMedia('(prefers-reduced-motion: reduce)').matches)scr.classList.add('route-anim');
 if(S.route==='home')setTimeout(bindStackDrag,40);
}
function moreSheet(){
 const m=modal(`<div class="between"><div><div class="kicker">MORE</div><h3 class="h3">更多</h3></div><button class="iconbtn" data-close>×</button></div><div class="sp12"></div><div class="settings-list"><button class="setrow" data-more-go="me"><span>我的主页</span><span>›</span></button><button class="setrow" data-more-go="wardrobe"><span>我的衣柜</span><span>›</span></button><button class="setrow" data-more-go="records"><span>穿搭记录</span><span>›</span></button><button class="setrow" data-more-go="settings"><span>设置</span><span>›</span></button></div><div class="sp14"></div><button class="btn sec full" data-close>关闭</button>`);
 $$('[data-more-go]',m).forEach(b=>b.onclick=()=>{const r=b.dataset.moreGo;m.remove();go(r)});
}
function bind(){
 $('#backBtn').onclick=back;
 $('#navRight').onclick=()=>{if(S.route==='home')go('games');else if(S.route==='garment')openGarmentEdit();else moreSheet()};
 $$('#tabbar button').forEach(b=>b.onclick=()=>go(b.dataset.root,false));
 $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
 $$('[data-skip]').forEach(b=>b.onclick=()=>{S.onboardDone=true;save();go('home')});
 $$('[data-upload]').forEach(b=>b.onclick=()=>{S.uploadKind=b.dataset.upload;S.uploadPick=0;save();openFilePicker(b.dataset.upload);go('recognize')});
 $$('[data-cand]').forEach(b=>b.onclick=()=>{S.uploadPick=+b.dataset.cand;save();render()});
 $$('[data-garment]').forEach(b=>b.onclick=()=>{S.garmentId=b.dataset.garment;go('garment')});
 $$('[data-wardrobe-filter]').forEach(b=>b.onclick=()=>{S.wardrobeFilter=b.dataset.wardrobeFilter;save();render()});
 $('[data-edit-garment]')?.addEventListener('click',openGarmentEdit);
 $('[data-confirm-clothes]')?.addEventListener('click',()=>{
   const pool=uploadCandidates(S.uploadKind),pick=pool[S.uploadPick];
   if(pick){ITEM_EDITS[pick.item_id]={...ITEM_EDITS[pick.item_id],confirmed:true};saveItemEdits()}
   S.wardrobeReady=true;S.wardrobeCount=wardrobeItems().length;save();
   go('done');t('已加入衣柜：'+(pick?.name||'单品'));
 });
 $('[data-finish]')?.addEventListener('click',()=>{S.onboardDone=true;save();go('home')});
 $$('[data-target]').forEach(b=>b.onclick=()=>{S.target=b.dataset.target;S.resultIndex=0;save();render()});
 $('[data-pick-date]')?.addEventListener('click',()=>{const d=addDays(today,3);S.target='date:'+ymd(d);save();render();t('已选 '+fmt(d))});
 $('[data-home-date]')?.addEventListener('click',()=>{const m=modal('<h3 class="h3">选择穿搭日期</h3><div class="sp14"></div><div class="row"><button class="btn sec" style="flex:1" data-date-choice="today">今天</button><button class="btn sec" style="flex:1" data-date-choice="tomorrow">明天</button><button class="btn sec" style="flex:1" data-date-choice="next">选日期</button></div>');$$('[data-date-choice]',m).forEach(b=>b.onclick=()=>{S.target=b.dataset.dateChoice==='next'?'date:'+ymd(addDays(today,3)):b.dataset.dateChoice;save();m.remove();render()})});
 $('[data-toggle-theme]')?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='space'?'flow':'space';switchTheme(next);window.WardrobeAPI.updateThemePreference({theme_preference:S.theme}).catch(()=>{})});
 $('[data-yue-start]')?.addEventListener('click',()=>yueStart($('#prompt')?.value));
 $('#prompt')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();yueStart(e.currentTarget.value)}});
 $$('[data-yue-example]').forEach(b=>b.onclick=()=>yueStart(b.dataset.yueExample));
 $('[data-yue-again]')?.addEventListener('click',()=>yueStart(S.inputText,true));
 $('[data-yue-reset]')?.addEventListener('click',()=>{yueRunToken++;yueVariant=0;S.yueVariant=0;S.inputText='';S.inputChips=[];S.inputDone=false;S.inputAnimating=false;save();render();$('#prompt')?.focus()});
 $$('[data-toggle-game]').forEach(b=>b.onclick=()=>{const id=b.dataset.toggleGame;if(S.homeGames.includes(id))S.homeGames=S.homeGames.filter(x=>x!==id);else S.homeGames.push(id);save();window.WardrobeAPI.updateHomeGames({home_games:S.homeGames}).catch(()=>{});render()});
 const er=$('#erange');if(er)er.oninput=e=>{S.energy=+e.target.value;$('#enum').textContent=S.energy;$('#ecopy').textContent=energyCopy(S.energy);save()};
 $('[data-energy-result]')?.addEventListener('click',()=>requestRecommendation('energy'));
 $$('[data-cat]').forEach(b=>b.onclick=()=>{S.identityGroup=b.dataset.cat;S.identity=identityGroups[S.identityGroup][0];save();render()});
 $$('[data-role]').forEach(b=>b.onclick=()=>{S.identityGroup=b.dataset.group;S.identity=b.dataset.role;save();render()});
 $('[data-identity-result]')?.addEventListener('click',()=>requestRecommendation('identity'));
 $$('[data-example]').forEach(b=>b.onclick=()=>{S.inputText=b.dataset.example;S.inputChips=[];S.inputDone=false;save();render()});
 $('[data-parse]')?.addEventListener('click',async()=>{const q=$('#prompt').value.trim();if(!q){t('先输入一句话');return}S.inputText=q;try{const r=await window.WardrobeAPI.parseIntent({text:q,target_date:ymd(targetDate())});S.inputChips=r.parsed_summary||parseInput(q)}catch(e){S.inputChips=parseInput(q)}S.inputDone=false;save();render()});
 $('[data-clear-input]')?.addEventListener('click',()=>{S.inputChips=[];S.inputDone=false;save();render()});
 $('[data-run-input]')?.addEventListener('click',()=>{runInputFly()});
 $('[data-redo-input]')?.addEventListener('click',()=>{S.inputDone=false;S.inputChips=[];save();render()});
 $$('[data-like]').forEach(b=>b.onclick=()=>{const id=b.dataset.like;S.likes=S.likes||{};S.likes[id]=!S.likes[id];save();render()});
 $$('[data-save]').forEach(b=>b.onclick=()=>{const id=b.dataset.save;S.saves=S.saves||{};S.saves[id]=!S.saves[id];save();render();t(S.saves[id]?'已收藏这条灵感 ✓':'已取消收藏')});
 $$('.outfit-carousel').forEach(el=>{let sx=0,down=false;el.addEventListener('pointerdown',e=>{down=true;sx=e.clientX});el.addEventListener('pointerup',e=>{if(!down)return;down=false;const dx=e.clientX-sx;if(Math.abs(dx)<42)return;const sets=resultSets();S.resultIndex=(S.resultIndex+(dx<0?1:-1)+sets.length)%sets.length;save();render()})});
 $$('[data-confirm]').forEach(b=>b.onclick=()=>confirmOutfit(b.dataset.confirm));
 $$('[data-reference]').forEach(b=>b.onclick=()=>t('已记下这套参考思路'));

 // 注意排除 <html>：applyTheme 往 documentElement 写 data-theme，querySelectorAll 会把它当按钮选中，
 // 导致任何点击冒泡到 html 都触发 switchTheme→render()，中途踩掉 V10 模块的内部路由。
 $$('[data-theme]:not(html)').forEach(b=>b.onclick=()=>{switchTheme(b.dataset.theme);window.WardrobeAPI?.updateThemePreference({theme_preference:S.theme}).catch(()=>{})});
 $('[data-save-profile]')?.addEventListener('click',()=>{S.profile.name=$('#pname').value.trim()||'小鹿';S.profile.bio=$('#pbio').value.trim();save();window.WardrobeAPI.updateProfile(S.profile).catch(()=>{});go('me')});
 $('[data-reset]')?.addEventListener('click',()=>{
 const m=modal(`<h3 class="h3">重置 Demo？</h3><p class="sub" style="margin-top:8px">会清空衣柜、穿搭记录和首页玩法设置。</p><div class="sp14"></div><div class="row"><button class="btn sec" style="flex:1" data-close>取消</button><button class="btn pri" style="flex:1" id="doReset">重置</button></div>`);
 $('#doReset',m).onclick=()=>{S={...stateDefault};save();m.remove();render()};
});
 $$('[data-tab]').forEach(b=>b.onclick=()=>{S.recordTab=b.dataset.tab;save();render()});
 $$('[data-record]').forEach(b=>b.onclick=()=>{S.recordDate=b.dataset.record;go('record')});
}
async function confirmOutfit(kind){
 const sets=resultSets(kind),set=sets[S.resultIndex];if(set.source==='ai'){t('AI 参考不能直接记为“已穿”');return}
 const d=ymd(targetDate());
 const doCommit=async(overwrite=false)=>{
   try{const res=await window.WardrobeAPI.confirmOutfit({target_date:d,outfit_id:(set.outfit_id||set.name),source:sourcePayload(kind),overwrite});if(res&&res.status==='conflict'&&!overwrite)return 'conflict'}catch(e){console.warn('Confirm API fallback',e)}
   S.confirmed[d]={kind:kind==='tarot'?'塔罗':kind==='energy'?'社交电量':kind==='identity'?'身份':'跃然搭配',name:set.name,reason:reasonText(kind)};save();t('已安排到 '+targetLabel()+' ✓');render();return 'ok'
 };
 if(S.confirmed[d]){const m=modal(`<h3 class="h3">这一天已经有一套穿搭</h3><p class="sub" style="margin-top:8px">按日期一天只保留一套正式确定穿搭。要覆盖吗？</p><div class="sp14"></div><div class="row"><button class="btn sec" style="flex:1" data-close>取消</button><button class="btn pri" style="flex:1" id="overwrite">覆盖</button></div>`);$('#overwrite',m).onclick=async()=>{m.remove();await doCommit(true)}}else{const status=await doCommit(false);if(status==='conflict'){t('后端提示：该日期已有穿搭')}}
}
let themeTransitionTimer;
function switchTheme(next){
 document.documentElement.classList.add('theme-changing');
 S.theme=next;save();applyTheme();render();
 clearTimeout(themeTransitionTimer);themeTransitionTimer=setTimeout(()=>document.documentElement.classList.remove('theme-changing'),820);
}
function emitInteractionEffect(x,y,kind='tap'){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const root=$('#interactionEffectLayer'),phone=$('#phone');if(!root||!phone)return;
 const r=phone.getBoundingClientRect(),el=document.createElement('span');el.className='ix-burst ix-'+kind;
 el.style.left=(x-r.left)+'px';el.style.top=(y-r.top)+'px';
 for(let i=0;i<6;i++){const dot=document.createElement('i');dot.style.setProperty('--a',i*60+'deg');el.appendChild(dot)}
 root.appendChild(el);setTimeout(()=>el.remove(),850);
}
$('#appContentLayer').addEventListener('click',e=>{
 const el=e.target.closest('button,[data-home-game],#twheel');if(!el)return;
 const kind=el.closest('[data-theme]:not(html)')?'theme':el.closest('#twheel')?'tarot':el.closest('[data-yue-start],[data-yue-again]')?'outfit':el.closest('[data-home-game]')?'card':'tap';
 emitInteractionEffect(e.clientX,e.clientY,kind);
},true);
async function hydrate(){
 const cfg=window.AI_WARDROBE_CONFIG||{};
 if((cfg.apiMode||'mock')!=='real')return false;
 try{
  const res=await window.WardrobeAPI.bootstrap();if(!res)return false;
  if(res.user&&res.user.name){S.profile={...S.profile,...res.user};save()}
  if(Array.isArray(res.home_games)&&res.home_games.length){S.homeGames=res.home_games.slice(0,8);save()}
  const items=(res.wardrobe&&res.wardrobe.items)||[];
  if(items.length){window.MockDB=window.MockDB||{};window.MockDB.wardrobe=window.MockDB.wardrobe||{};window.MockDB.wardrobe.items=items}
  return true;
 }catch(e){console.warn('bootstrap hydrate fallback',e);return false}
}
/* V10 模块内部导航 → app 路由同步钩子（aw-core 的 go() 会回调）。
   双路由必须一致：AW.state.route（模块内导航）与 S.route（app 导航）任一不同步，
   app 的 render() 就会把对方的页面踩掉。menu 在 AW 里没有模块，映射回 app 首页（= 玩法入口）。 */
if(window.AW){
 AW.onNavigate=route=>{
  if(route==='menu'){S.route='home';save();go('home');return}
  const map={tarot:'tarot',energy:'energy',identity:'identity',yueran:'input',results:'result',records:'records'};
  const r=map[route];if(!r)return;
  if(S.route!==r){S.route=r;save()}
  const titles={tarot:'塔罗牌',energy:'社交电量',identity:'身份扮演',input:'跃然搭配',result:'推荐结果',records:'穿搭记录'};
  setChrome(titles[r]||'',true); // 只同步 chrome，不 render()，避免打断模块内动画/加载态
 };
}
(async()=>{await hydrate();render()})();
