import {contractFor,FIELD_MODULES,fieldOffer,xpForLevel} from './sortie-progression.js';
import {FIELD_UPGRADES,FIELD_ITEMS,FIELD_RELAYS,FIELD_LIMITS} from './field-catalog.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stacks=(values,id)=>(values||[]).filter(value=>value===id).length;
const unique=values=>[...new Set(values||[])];
const definition=(catalog,id)=>catalog[id]||{name:id,short:'',detail:'',icon:'SYS',color:'#b5e577'};
const sigil=entry=>`<span class="field-sigil" aria-hidden="true" style="--field-color:${escape(entry.color||'#b5e577')}">${escape(entry.icon||entry.role?.slice(0,3)||'SYS')}</span>`;
export const formatTime=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
function inventoryMarkup(values,catalog,empty){
 return values?.length?unique(values).map(id=>{const entry=definition(catalog,id);return `<div class="field-inventory-row" title="${escape(entry.detail)}">${sigil(entry)}<span><strong>${escape(entry.name)}</strong><small>${escape(entry.short||entry.detail)}</small></span><b>×${stacks(values,id)}</b></div>`;}).join(''):`<p class="field-empty">${escape(empty)}</p>`;
}
function debriefCollection(values,catalog){
 return unique(values).map(id=>`<span class="module-chip" title="${escape(definition(catalog,id).detail)}">${escape(definition(catalog,id).name)} ×${stacks(values,id)}</span>`).join('');
}
export function debriefMarkup(report,compact=false){
 if(!report)return '';
 const outcome={victory:'EXTRACTION COMPLETE',defeat:'SQUAD LOST',withdrawal:'SQUAD WITHDRAWN'}[report.outcome];
 return `<section class="sortie-debrief${compact?' compact':''}" aria-label="Sortie debrief"><div class="sortie-section-heading"><div><p class="overline">${compact?'LAST SORTIE':'SORTIE DEBRIEF'} / ${escape(report.missionName)} / ${contractFor(report.contract).name.toUpperCase()}</p><h2>${outcome}</h2></div><span>${formatTime(report.seconds)} / ${report.cleared} OF ${report.totalObjectives||5} OBJECTIVES</span></div><div class="debrief-totals"><span><b>${report.kills}</b> HOSTILES</span><span><b>${report.salvageEarned??report.salvage}</b> SALVAGE RECOVERED</span><span><b>${report.redeploys}</b> REDEPLOYS USED</span></div><div class="debrief-pilots">${report.pilots.map(p=>`<article><strong>${escape(p.name)} <em>LV ${p.level||1}</em></strong><span>${p.kills} eliminations · ${p.damage.toLocaleString('en-US')} damage${p.relays?' · '+p.relays+' relays linked':''}</span><h3>FIELD UPGRADES</h3><p>${debriefCollection(p.upgrades,FIELD_UPGRADES)||'No field upgrades installed'}</p><h3>SALVAGE TECH</h3><p>${debriefCollection(p.items,FIELD_ITEMS)||'No salvage tech recovered'}</p>${p.modules?.length?`<h3>RUN MODULES</h3><p>${debriefCollection(p.modules,FIELD_MODULES)}</p>`:''}</article>`).join('')}</div><p class="sortie-footnote">Field upgrades, salvage tech and XP carry through the campaign after extraction. Resonance relays provide support for the current sortie. Install earned run modules at campaign refit before the next drop.</p></section>`;
}
export function createSortieHud(parent){
 const hud=document.createElement('section');hud.id='sortieHud';hud.hidden=true;hud.setAttribute('aria-label','Field progression');
 hud.innerHTML='<div id="fieldSummary"></div>';
 const inventoryPanel=document.createElement('section');inventoryPanel.id='fieldInventoryPanel';inventoryPanel.hidden=true;inventoryPanel.setAttribute('aria-label','Field inventory');
 inventoryPanel.innerHTML='<button id="fieldInventoryToggle" type="button" aria-expanded="false" aria-controls="fieldInventory">Close inventory <span>[B] ×</span></button><div id="fieldInventory" hidden></div>';
 const offers=document.createElement('section');offers.id='fieldOffers';offers.hidden=true;offers.setAttribute('aria-label','Choose a field upgrade');
 const nearby=document.createElement('section');nearby.id='fieldInteraction';nearby.hidden=true;nearby.setAttribute('aria-label','Nearby field equipment');
 const pickup=document.createElement('div');pickup.id='fieldPickup';pickup.hidden=true;pickup.setAttribute('role','status');pickup.setAttribute('aria-live','polite');
 // Routine run data stays behind the mission disclosure. Inventory, choices and
 // interactions remain independent so B, touch and field commands work when it is shut.
 const details=parent.querySelector('#objectivesPanel .objective-details');
 (details||parent).append(hud);parent.append(offers,nearby,pickup,inventoryPanel);
 const summary=hud.querySelector('#fieldSummary'),inventory=inventoryPanel.querySelector('#fieldInventory'),toggle=inventoryPanel.querySelector('#fieldInventoryToggle');
 let world=null,player=null,choices=[],near=null,queue={},inventoryOpen=false,lastTime=Infinity,missionKey='',sentUpgrade=null,sentUpgradeAt=0,sentAction='',sentActionAt=0,keys={};
 const render=(key,element,html)=>{if(keys[key]!==html){keys[key]=html;element.innerHTML=html;}};
 function releaseCursor(){if(document.pointerLockElement)document.exitPointerLock();}
 function renderInventory(){
  if(!inventoryOpen||!player?.field)return;
  const field=player.field,active=(field.buffs||[]).filter(buff=>buff.expiresAt>world.time);
  render('inventory',inventory,`<h3>Field upgrades <span>${field.upgrades?.length||0}</span></h3>${inventoryMarkup(field.upgrades,FIELD_UPGRADES,'Earn XP from combat and objectives to choose upgrades.')}<h3>Salvage tech <span>${field.items?.length||0}</span></h3>${inventoryMarkup(field.items,FIELD_ITEMS,'Open field caches with shared salvage.')}<h3>Relay support <span>${field.relayCount||0}</span></h3>${inventoryMarkup([...(field.relays||[]),...active.map(buff=>buff.relayId)],FIELD_RELAYS,'Find a resonance relay and press F to link.')}<h3>Run modules <span>${field.modules?.length||0}</span></h3>${inventoryMarkup(field.modules,FIELD_MODULES,'Extract and install modules at campaign refit.')}`);
 }
 function showInventory(){inventoryOpen=!inventoryOpen;inventoryPanel.hidden=inventory.hidden=!inventoryOpen;toggle.setAttribute('aria-expanded',String(inventoryOpen));renderInventory();}
 function choose(id){const entry=choices.find(entry=>entry.id===id);if(!entry||player?.hp<=0||sentUpgrade===player?.field?.offerRevision)return false;sentUpgrade=player.field.offerRevision;sentUpgradeAt=world.time;queue.upgrade={id,revision:entry.revision??player.field.offerRevision};updateOffers();return true;}
 function cacheBlocked(){return near?.kind==='cache'&&((player?.field?.items?.length||0)>=FIELD_LIMITS.items||stacks(player?.field?.items,near.itemId)>=(FIELD_ITEMS[near.itemId]?.maxStacks||3));}
 function interact(){if(!near||player?.hp<=0||cacheBlocked()||(world?.sortie?.salvage||0)<(near.cost||0))return false;const signature=near.id+':'+near.revision+':'+world.sortie.salvage;if(sentAction===signature&&world.time-sentActionAt<.5)return true;sentAction=signature;sentActionAt=world.time;queue.fieldAction={id:near.id,revision:near.revision};return true;}
 function updateOffers(){
  offers.hidden=!choices.length||world?.status!=='playing';if(offers.hidden)return;
  const waiting=sentUpgrade===player.field.offerRevision;
  render('offers',offers,`<div class="field-offer-heading"><div><strong>LEVEL ${player.field.level} / UPGRADE READY</strong><span>${waiting?'Installing upgrade…':`Choose 1 of 3${player.field.pending>1?' · '+player.field.pending+' choices banked':''} · Combat continues`}</span></div><button type="button" data-field-cursor aria-label="Release mouse to select an upgrade">CURSOR [U] ↗</button></div><div class="field-cards">${choices.map((entry,index)=>{const count=stacks(player.field.upgrades,entry.id);return `<button type="button" data-field-upgrade="${escape(entry.id)}" ${waiting?'disabled':''} style="--field-color:${escape(entry.color||'#b5e577')}" aria-label="Option ${index+1}, ${escape(entry.name)}. ${escape(entry.detail)}. ${count} stacks installed."><div class="field-card-top">${sigil(entry)}<kbd>${index+1}</kbd></div><small>${escape(entry.role||'FIELD UPGRADE')}</small><strong>${escape(entry.name)}</strong><span>${escape(entry.detail)}</span><b>${count?'STACK '+(count+1)+' / '+(entry.maxStacks||3):'INSTALL UPGRADE'}</b></button>`;}).join('')}</div>`);
 }
 toggle.addEventListener('click',showInventory);
 for(const element of[hud,inventoryPanel,offers,nearby]){
  // These controls share the live battlefield; a click must never fire a hand weapon.
  element.addEventListener('pointerdown',event=>{event.stopPropagation();if(event.target.closest('button'))event.preventDefault();});
  element.addEventListener('contextmenu',event=>event.preventDefault());
 }
 offers.addEventListener('click',event=>{const button=event.target.closest('button');if(button?.dataset.fieldUpgrade)choose(button.dataset.fieldUpgrade);else if(button?.hasAttribute('data-field-cursor'))releaseCursor();});
 nearby.addEventListener('click',event=>{if(event.target.closest('button'))interact();});
 return{
  update(w,p){
   world=w;player=p;hud.hidden=!w?.sortie||!p?.field;if(hud.hidden){offers.hidden=nearby.hidden=pickup.hidden=inventoryPanel.hidden=true;return;}
   const nextMission=w.mission.seed+'|'+p.id;
   if(missionKey!==nextMission||w.time<lastTime){missionKey=nextMission;sentUpgrade=null;sentAction='';queue={};keys={};inventoryOpen=false;inventoryPanel.hidden=inventory.hidden=true;toggle.setAttribute('aria-expanded','false');}
   lastTime=w.time;const field=p.field,level=field.level||1,floor=xpForLevel(level),ceiling=xpForLevel(level+1),progress=Math.max(0,Math.min(100,100*((field.xp||0)-floor)/Math.max(1,ceiling-floor))),active=(field.buffs||[]).filter(buff=>buff.expiresAt>w.time);
   render('summary',summary,`<div class="field-heading"><span>FIELD SYSTEMS</span><b>LV ${level}</b></div><div class="field-xp-heading"><strong>${Math.max(0,(field.xp||0)-floor)} <small>/ ${ceiling-floor} XP</small></strong><span>${w.sortie.salvage} SALVAGE</span></div><div class="field-xp" role="progressbar" aria-label="Field experience to next level" aria-valuemin="0" aria-valuemax="${ceiling-floor}" aria-valuenow="${Math.max(0,(field.xp||0)-floor)}"><i style="width:${progress}%"></i></div><p class="field-loadout-count">${field.upgrades?.length||0} UPGRADES <span>/</span> ${field.items?.length||0} TECH</p>${active.length?`<div class="field-active-buffs">${active.map(buff=>`<span title="${escape(definition(FIELD_RELAYS,buff.relayId).detail)}">${escape(definition(FIELD_RELAYS,buff.relayId).name)} <b>${Math.ceil(buff.expiresAt-w.time)}s</b></span>`).join('')}</div>`:''}`);
   renderInventory();
   if(sentUpgrade===field.offerRevision&&w.time-sentUpgradeAt>1.2)sentUpgrade=null;choices=fieldOffer(w,p);updateOffers();
   near=w.field?.nodes?.find(node=>node.id===field.nearby)||null;nearby.hidden=!near||p.hp<=0||w.status!=='playing';
   if(!nearby.hidden){const entry=definition(near.kind==='relay'?FIELD_RELAYS:FIELD_ITEMS,near.kind==='relay'?near.relayId:near.itemId),affordable=w.sortie.salvage>=(near.cost||0),blocked=cacheBlocked();render('nearby',nearby,`${sigil(entry)}<div><small>${near.kind==='relay'?'RESONANCE RELAY':'SALVAGE CACHE'}${near.cost?' / '+near.cost+' SALVAGE':' / FREE'}</small><strong>${escape(entry.name)}</strong><p>${escape(entry.detail||entry.short)}</p></div><button type="button" ${affordable&&!blocked?'':'disabled'} aria-label="${near.kind==='relay'?'Link':'Open'} ${escape(entry.name)}${near.cost?', '+near.cost+' shared salvage':''}"><kbd>F</kbd> ${blocked?'TECH FULL':affordable?(near.kind==='relay'?'LINK':'OPEN'):'NEED '+near.cost}</button>`);}
   const notice=field.lastPickup;pickup.hidden=!notice||notice.until<=w.time;
   if(!pickup.hidden){pickup.style.setProperty('--field-color',notice.color||'#b5e577');render('pickup',pickup,`<small>${notice.kind==='level'?'FIELD LEVEL GAINED':notice.kind==='upgrade'?'UPGRADE INSTALLED':notice.kind==='relay'?'RELAY LINKED':'SALVAGE TECH RECOVERED'}</small><strong>${escape(notice.name)}</strong>`);}
  },
  key(code){
   if(hud.hidden||world?.status!=='playing')return false;
   if(['Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].includes(code)&&choices.length){choose(choices[Number(code.at(-1))-1]?.id);return true;}
   if(code==='KeyF')return interact();
   if(code==='KeyB'){showInventory();return true;}
   if(code==='KeyU'&&choices.length){releaseCursor();return true;}
   return false;
  },
  consumeInput(){const input=queue;queue={};return input;},
  get inventoryOpen(){return inventoryOpen&&!inventoryPanel.hidden;}
 };
}
