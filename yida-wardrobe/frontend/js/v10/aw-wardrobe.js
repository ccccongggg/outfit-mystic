(function(){
 'use strict';
 /* 真实电子衣橱接入层（V10 搭配模块共用）
    - 数据源优先级：app.js wardrobeItems()（基础衣橱 + 上传件 + 本地编辑，实时合并）
      → MockDB.wardrobe.items → window.WARDROBE_ITEMS（file:// 脚本变量兜底）
    - http 下 refresh() 以 no-store 拉取 data/wardrobe-items.json，有变化就写回数据源并派发 wardrobe:updated
    - app.js 上传 / 编辑入库后调 notifyChange()，同样派发 wardrobe:updated，搭配页即时重渲染 */
 const CAT={top:'top',outer:'outer',bottom:'bottom',dress:'dress',shoe:'shoe',bag:'bag',accessory:'acc'};
 const SUBCAT={shirt:'top',blouse:'top',tee:'top',camisole:'top',tank:'top',turtleneck:'top',sweater:'top',cardigan:'top',hoodie:'top',vest:'top',top:'top',
  coat:'outer',trench:'outer',blazer:'outer',jacket:'outer',leather:'outer',down:'outer',outer:'outer',
  jeans:'bottom',trousers:'bottom',chino:'bottom',jogger:'bottom',skirt:'bottom',cargo:'bottom',shorts:'bottom',bottom:'bottom',
  dress:'dress',gown:'dress',
  shoes:'shoe',sneaker:'shoe',flat:'shoe',loafer:'shoe',boot:'shoe',running:'shoe',heel:'shoe',mary:'shoe',oxford:'shoe',sandal:'shoe',
  bag:'bag',tote:'bag',canvas:'bag',backpack:'bag',handbag:'bag',
  accessory:'acc',acc:'acc',scarf:'acc',hat:'acc',belt:'acc',jewelry:'acc',glasses:'acc'};
 /* 品类中文名统一取自权威词表 window.OutfitVocab（8风格/24色/7品类），
    避免衣橱页/筛选/结果页各写一份。词表缺失时回落到下面这份兜底，
    保证 vocab.js 没加载上也只是文案退回旧值，不会整页报错。 */
 const LABELS=(function(){
  const base={top:'上装',outer:'外套',bottom:'下装',dress:'连衣裙',shoe:'鞋',bag:'包',acc:'配饰',accessory:'配饰'};
  const v=window.OutfitVocab;
  if(v&&Array.isArray(v.categories))for(const c of v.categories){if(c&&c.k&&c.name)base[c.k]=c.name;}
  return base;
 })();
 const img=n=>!n?'':(String(n).indexOf('/')>=0||String(n).indexOf('data:')===0||String(n).indexOf('blob:')===0?String(n):'assets/items/'+n);
 const hex=h=>/^#[0-9a-fA-F]{6}$/.test(h||'')?h:'#8a8a8a';
 const seasonOf=v=>{
  const s=Array.isArray(v)?v:String(v||'').split(/[,，\s]+/).filter(Boolean);
  if(s.includes('winter')||s.includes('cold'))return 'cold';
  if(s.includes('summer')||s.includes('hot'))return 'hot';
  return 'all';
 };
 function normalize(x){
  if(!x||!x.item_id)return null;
  const vt=x.visible_traits||{};
  const cat=CAT[x.category]||SUBCAT[x.subcategory]||'acc';
  return {
   id:x.item_id,ref:x.item_id,name:x.name||x.item_id,
   category:cat,type:x.subcategory||cat,
   color:hex(x.color_hex),colorName:x.color_name||'',
   season:seasonOf(vt.season),formal:Number(x.formality)||2,
   styles:Array.isArray(x.style_tags_cn)?x.style_tags_cn.slice():[],
   kind:LABELS[cat],image:img(x.image_url),raw:x
  };
 }
 function sourceItems(){
  let base=null;
  try{if(typeof window.wardrobeItems==='function')base=window.wardrobeItems()}catch(e){base=null}
  if(!base||!base.length)base=(window.MockDB&&window.MockDB.wardrobe&&window.MockDB.wardrobe.items)||window.WARDROBE_ITEMS||[];
  return base;
 }
 let cache=null,cacheKey='';
 const signature=()=>sourceItems().map(x=>x?(x.item_id+'|'+(x.name||'')+'|'+(x.image_url||'')):'').join(';');
 function items(){
  const k=signature();
  if(!cache||k!==cacheKey){cache=sourceItems().map(normalize).filter(Boolean);cacheKey=k}
  return cache;
 }
 const byId=id=>{
  const s=String(id==null?'':id).replace(/^yr-/,'');
  return items().find(x=>x.id===s)||null;
 };
 const ofCategory=c=>items().filter(x=>x.category===c);
 function pick(category,exclude){
  const ban=(exclude||[]).map(x=>typeof x==='string'?x:(x&&x.id)).filter(Boolean);
  let pool=ofCategory(category).filter(x=>!ban.includes(x.id));
  if(!pool.length)return null;
  const rand=window.AW&&AW.randomIndex?AW.randomIndex(pool.length):Math.floor(Math.random()*pool.length);
  return pool[rand];
 }
 function notifyChange(){
  cache=null;
  try{window.dispatchEvent(new Event('wardrobe:updated'))}catch(e){}
 }
 let refreshing=null;
 function refresh(){
  if(typeof location!=='undefined'&&location.protocol==='file:')return Promise.resolve(false);
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   try{
    const res=await fetch('data/wardrobe-items.json',{cache:'no-store'});
    const data=await res.json();
    const list=Array.isArray(data)?data:(data&&data.items)||[];
    if(!list.length)return false;
    const fp=x=>x?(x.item_id+'|'+(x.name||'')+'|'+(x.image_url||'')):'';
    if(list.map(fp).join(';')===(window.WARDROBE_ITEMS||[]).map(fp).join(';'))return false;
    window.WARDROBE_ITEMS=list;
    if(window.MockDB&&window.MockDB.wardrobe)window.MockDB.wardrobe.items=list;
    notifyChange();
    return true;
   }catch(e){return false}
   finally{refreshing=null}
  })();
  return refreshing;
 }
 /* 衣橱变化 → 当前展示中的搭配页即时重渲染（图片与名称按 id 重新解析） */
 addEventListener('wardrobe:updated',()=>{
  const AW=window.AW,stage=document.querySelector('#stage');
  if(!AW||!stage||!stage.querySelector('.aw-page'))return;
  const r=AW.state.route;
  if(r==='yueran'&&(AW.state.yuePhase==='flying'||AW.state.yuePhase==='parsing'))return;
  if(r==='yueran'&&(AW.state.yueSwapIdx!==null&&AW.state.yueSwapIdx!==undefined))return;
  try{AW.renderModule(r)}catch(e){}
 });
 addEventListener('focus',()=>{refresh()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.AW_WARDROBE={items,byId,ofCategory,pick,refresh,notifyChange,LABELS};
})();
