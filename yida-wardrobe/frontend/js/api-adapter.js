(function(){
  const C=window.AI_WARDROBE_CONFIG;
  async function http(path,{method='GET',body}={}){
    const res=await fetch((C.apiBaseUrl||'')+(C.apiPrefix||'')+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'include'});
    if(!res.ok){const err=new Error('API '+res.status);err.status=res.status;try{err.payload=await res.json()}catch(e){}throw err}
    return res.status===204?null:res.json();
  }
  const real={
    bootstrap:()=>http('/bootstrap'),
    getWardrobe:()=>http('/wardrobes/current/items'),
    getSeasonalTrends:()=>http('/trends/seasonal'),
    parseIntent:p=>http('/intent/parse',{method:'POST',body:p}),
    createRecommendation:p=>http('/recommendations',{method:'POST',body:p}),
    confirmOutfit:p=>http('/outfits/confirm',{method:'POST',body:p}),
    getOutfitRecords:()=>http('/outfit-records'),
    updateProfile:p=>http('/users/me/profile',{method:'PUT',body:p}),
    updateThemePreference:p=>http('/users/me/preferences/theme',{method:'PUT',body:p}),
    updateHomeGames:p=>http('/users/me/preferences/home-games',{method:'PUT',body:p}),
    addWardrobeItems:p=>http('/wardrobes/current/items',{method:'POST',body:p})
  };
  window.WardrobeAPI={
    mode:C.apiMode,
    setMode(mode){C.apiMode=mode;this.mode=mode},
    async call(name,payload){const impl=C.apiMode==='real'?real:window.MockAPI;if(!impl[name])throw new Error('Unknown API method: '+name);return impl[name](payload)},
    bootstrap(){return this.call('bootstrap')},getWardrobe(){return this.call('getWardrobe')},getSeasonalTrends(){return this.call('getSeasonalTrends')},
    parseIntent(p){return this.call('parseIntent',p)},createRecommendation(p){return this.call('createRecommendation',p)},confirmOutfit(p){return this.call('confirmOutfit',p)},
    getOutfitRecords(){return this.call('getOutfitRecords')},updateProfile(p){return this.call('updateProfile',p)},updateThemePreference(p){return this.call('updateThemePreference',p)},updateHomeGames(p){return this.call('updateHomeGames',p)},addWardrobeItems(p){return this.call('addWardrobeItems',p)}
  };
})();
