(function(){
 'use strict';
 const AW=window.AW,D=window.AW_DATA;
 const icons=[
  '<path d="m2 16 2-10 5 5 3-7 3 7 5-5 2 10H2Zm0 3h20"/>',
  '<path d="M20 4C11 3 5 8 4 20c7-2 13-8 16-16ZM4 20c4-5 7-8 12-11"/>',
  '<path d="M5 5h14l3 5-10 11L2 10l3-5Zm-3 5h20M9 5l-2 5 5 11 5-11-2-5"/>',
  '<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/>',
  '<path d="m13 2-8 11h7l-1 9 8-12h-7l1-8Z"/>',
  '<path d="M3 13a9 9 0 1 1 16 4M5 18c6 2 12 0 16-5M2 19c5 3 12 2 18-2"/>'
 ];
 const icon=i=>`<svg class="aw-identity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg>`;
 function render(){
  const groups=D.identities.map(([group,roles],i)=>`<section class="aw-identity-group ${AW.state.identityGroup===group?'selected':''}" aria-label="${AW.escape(group)}"><h2><span>${AW.escape(group)}</span>${icon(i)}</h2>${roles.map(([name,desc])=>`<button type="button" class="aw-identity-option ${AW.state.identity===name?'selected':''}" data-aw-role="${AW.escape(name)}" data-aw-group="${AW.escape(group)}" aria-pressed="${AW.state.identity===name}"><span class="aw-identity-copy"><b>${AW.escape(name)}</b><small>${AW.escape(desc)}</small></span><span class="aw-identity-mark" aria-hidden="true">${AW.state.identity===name?'✓':'›'}</span></button>`).join('')}</section>`).join('');
  return `<section class="aw-page aw-identity-page aw-game-page"><div class="aw-cosmic-stage" aria-hidden="true"><span class="aw-page-orb"></span></div><div class="aw-kicker">IDENTITY · ${AW.escape(AW.state.targetDate)}</div><h1>重生之我是</h1><p>六个频道，选一个身份。真实天气和场合仍然优先。</p><div class="aw-identity-grid">${groups}</div><div class="aw-identity-footer"><button class="aw-button full aw-gold-cta" id="aw-identity-submit"><span>就用这个身份</span><span class="aw-cta-arrow" aria-hidden="true">›</span></button><small>当前选择 · <span id="aw-identity-current">${AW.escape(AW.state.identity)}</span></small></div></section>`;
 }
 function bind(root){
  root.querySelectorAll('[data-aw-role]').forEach(el=>el.onclick=()=>{
   AW.state.identity=el.dataset.awRole;AW.state.identityGroup=el.dataset.awGroup;AW.save();
   root.querySelectorAll('[data-aw-role]').forEach(button=>{
    const selected=button===el;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    button.querySelector('.aw-identity-mark').textContent=selected?'✓':'›';
   });
   root.querySelectorAll('.aw-identity-group').forEach(group=>group.classList.toggle('selected',group===el.closest('.aw-identity-group')));
   root.querySelector('#aw-identity-current').textContent=AW.state.identity;
  });
  root.querySelector('#aw-identity-submit').onclick=()=>window.AW_RESULTS.open({type:'identity',payload:{identity:AW.state.identity,channel:AW.state.identityGroup}}).catch(e=>AW.toast(e.message));
 }
 AW.modules.identity={render,bind};
})();
