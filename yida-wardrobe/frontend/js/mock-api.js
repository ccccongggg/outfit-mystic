(function(){
  const K='ai-wardrobe-mock-backend-v1';
  function read(){try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return{}}}
  function write(x){try{localStorage.setItem(K,JSON.stringify(x))}catch(e){}}
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function recommendation(source, wardrobeReady=true, wardrobeCount=12){
    const own=clone(window.MockDB.outfits.wardrobe);
    const ai=clone(window.MockDB.outfits.ai_reference);
    let outfits=[];
    if(!wardrobeReady) outfits=ai;
    else if(wardrobeCount<8) outfits=[own[0],...ai];
    else outfits=[...own,...ai];
    return {session_id:'mock_rec_'+Date.now(),source:clone(source),outfits};
  }
  window.MockAPI={
    async bootstrap(){return clone({user:window.MockDB.user,wardrobe:window.MockDB.wardrobe,home_games:['tarot','energy','identity','input']})},
    async getWardrobe(){return clone(window.MockDB.wardrobe)},
    async getSeasonalTrends(){return clone(window.MockDB.trends)},
    async parseIntent({text}){
      const chips=[];
      if(/客户|会议|商务|面试|汇报/.test(text))chips.push('客户 / 商务');
      if(/骑车|走路|通勤|活动/.test(text))chips.push('需要活动');
      if(/冷|降温|保暖/.test(text))chips.push('注意保暖');
      if(/不要红|不穿红/.test(text))chips.push('不要红色');
      if(/约会/.test(text))chips.push('约会');
      if(/逛展|看展/.test(text))chips.push('逛展');
      if(/绿色裙|绿裙/.test(text))chips.push('必须绿色裙子');
      if(!chips.length)chips.push('日常出行','轻松但有完整度');
      return {raw_text:text,parsed_summary:chips.slice(0,5)};
    },
    async createRecommendation(req){
      return recommendation(req.source,req.wardrobe_ready!==false,Number(req.wardrobe_count||0));
    },
    async confirmOutfit(req){
      const db=read();db.confirmed=db.confirmed||{};
      if(db.confirmed[req.target_date]&&!req.overwrite)return {status:'conflict',existing:db.confirmed[req.target_date]};
      db.confirmed[req.target_date]={target_date:req.target_date,outfit_id:req.outfit_id,source:req.source,confirmed_at:new Date().toISOString()};write(db);
      return {status:'ok',record:clone(db.confirmed[req.target_date])};
    },
    async getOutfitRecords(){const db=read();return {records:Object.values(db.confirmed||{})}},
    async updateProfile(payload){const db=read();db.profile=payload;write(db);return {status:'ok',profile:clone(payload)}},
    async updateThemePreference(payload){const db=read();db.theme=payload.theme_preference;write(db);return {status:'ok'}},
    async updateHomeGames(payload){const db=read();db.home_games=payload.home_games;write(db);return {status:'ok'}},
    async addWardrobeItems(payload){return {status:'ok',added_count:(payload.items||[]).length,items:payload.items||[]}}
  };
})();
