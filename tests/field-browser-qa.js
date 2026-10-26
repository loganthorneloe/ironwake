// Developer-only fixture injected by preview-server.mjs --field-qa. No global test API.
import {initSortie,rewardDefeat,awardSalvage,FIELD_ITEMS,FIELD_RELAYS,FIELD_UPGRADES,FIELD_MODULES,FIELD_LIMITS} from '../dist/sortie-progression.js';
import {combatStats} from '../dist/core.js';
import {runInventoryLayoutChecks} from './field-layout-checks.js';

export function installFieldBrowserQA({getWorld,getLocalId}){
 let host=document.body,external=false;
 try{const target=parent!==window&&parent.document.querySelector('#fieldQAControls');if(target){host=target;external=true;}}catch{}
 const doc=host.ownerDocument;doc.getElementById('fieldBrowserQA')?.remove();doc.getElementById('fieldBrowserQAStyle')?.remove();
 const root=doc.createElement('details');root.id='fieldBrowserQA';root.open=true;
 root.innerHTML=`<summary>LOCAL FIELD QA · feedback submissions never leave localhost</summary>
 <p>Use the normal game controls to deploy. Safe field removes threats; range worlds receive QA sortie state. Finishing or leaving a campaign can save QA progression in this localhost origin. Use a disposable local campaign. Mock issue 0 is a placeholder, never a real issue.</p>
 <div class="qa-buttons"><button data-qa="safe">Safe field: OFF</button><button data-qa="focus">Focus game input</button><button data-qa="xp">Bank 200 base XP</button><button data-qa="cache-free">Nearby free cache</button><button data-qa="cache-paid">Nearby paid cache (18)</button><button data-qa="relay">Nearby Assault relay</button><button data-qa="fund">Add 100 salvage</button><button data-qa="stack">Seed max-stack gyro</button><button data-qa="inventory">Seed long inventory</button><button data-qa="expire">Expire relay support</button><button data-qa="inspect">Inspect state / bounds</button></div>
 <output role="status" class="qa-notice">Deploy through the normal game UI, then use these controls.</output><output role="status" class="qa-key-event">Last keyboard event: none observed.</output><pre class="qa-state"></pre>`;
 const style=doc.createElement('style');style.textContent=`#fieldBrowserQA{color:#dce5da;background:#14242a;border:1px solid #718a7d;border-top:2px solid #e9bc80;padding:9px;font:12px/1.45 Arial;box-sizing:border-box}#fieldBrowserQA summary{cursor:pointer;font-weight:bold;color:#ffe0ac}#fieldBrowserQA p{margin:8px 0;color:#b5c7bc;font-size:11px}#fieldBrowserQA .qa-buttons{display:flex;gap:5px;flex-wrap:wrap}#fieldBrowserQA button{background:#263b40;color:#e4e5ce;border:1px solid #638381;padding:6px 9px;cursor:pointer;font:11px Arial}#fieldBrowserQA button:hover{border-color:#e9bc80}#fieldBrowserQA .qa-notice{display:block;margin-top:7px;color:#cbe6b7}#fieldBrowserQA pre{white-space:pre-wrap;overflow:auto;max-height:180px;margin:8px 0 0;font:10px/1.5 monospace}#fieldBrowserQA:not([open])>*:not(summary){display:none}`;
 if(!external)style.textContent+='#fieldBrowserQA{position:fixed;z-index:40;top:6px;left:50%;transform:translateX(-50%);width:min(720px,95vw);max-height:70vh;overflow:auto}';
 style.id='fieldBrowserQAStyle';style.textContent+='#fieldBrowserQA .qa-key-event{display:block;margin-top:5px;color:#ffe0ac;font:11px/1.5 monospace;overflow-wrap:anywhere}';
 host.append(style,root);
 const notice=root.querySelector('.qa-notice'),output=root.querySelector('.qa-state');
 const keyOutput=root.querySelector('.qa-key-event');
 const observeKey=source=>event=>{keyOutput.textContent='Last keyboard event: '+JSON.stringify({key:event.key,code:event.code,targetId:event.target?.id||event.target?.tagName||null,source});};
 const gameKey=observeKey('game window'),parentKey=observeKey('parent document');
 window.addEventListener('keydown',gameKey,{capture:true,passive:true});
 if(external)doc.addEventListener('keydown',parentKey,{capture:true,passive:true});
 let safe=false,serial=0,lastWorld=null;
 // This fixture must never mutate a host or guest co-op session.
 const current=()=>{const w=getWorld();return document.body.dataset.room!=='true'&&w&&w.status==='playing'?w:null;};
 const player=w=>w.players.find(p=>p.id===getLocalId());
 const say=value=>notice.textContent=value;
 function field(w){if(!w.sortie||!w.field||!player(w)?.field)initSortie(w);return player(w);}
 function clearThreats(w){
  field(w);w.enemies=[];w.spawn=[];w.bullets=[];w.hazards=[];w.enemyHazards=[];
  if(w.operation){w.operation.nextWave=Number.MAX_SAFE_INTEGER;w.operation.nextStrike=Number.MAX_SAFE_INTEGER;w.operation.elitePhases=[0,1,2,3,4,5];delete w.operation.heavyAlert;}
  if(w.siege)w.siege.nextWave=Number.MAX_SAFE_INTEGER;
  for(const p of w.players){p.hp=combatStats(p).hp;p.recoverUntil=Number.MAX_SAFE_INTEGER;}
 }
 function nearby(w,kind,cost=0){
  const p=field(w),isRelay=kind==='relay',angle=p.angle||0;
  // One fixture at a time prevents overlapping prompts. Original authored nodes remain.
  w.field.nodes=w.field.nodes.filter(n=>!n.id.startsWith('qa-nearby-'));
  const node={id:'qa-nearby-'+(++serial),kind,x:p.x+Math.cos(angle)*75,y:p.y+Math.sin(angle)*75,z:p.altitude||0,state:'ready',revision:0,cost,claimed:[],[isRelay?'relayId':'itemId']:isRelay?'assault':'gyro'};
  w.field.nodes.push(node);say(`${isRelay?'Assault relay':cost?'Paid gyro cache':'Free gyro cache'} placed 75m ahead. Use the real field interaction button or F.`);
 }
 function inspect(){
  const w=getWorld(),p=w&&player(w),bounds={};
  for(const id of ['sortieHud','fieldOffers','fieldInventory','fieldInteraction','fieldPickup','feedbackDialog','loadoutPanel','abilityButton','dashButton']){
   const el=document.getElementById(id);if(!el)continue;const r=el.getBoundingClientRect(),css=getComputedStyle(el),visible=!el.hidden&&r.width>0&&r.height>0&&css.visibility!=='hidden';
   bounds[id]={visible,x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,maxHeight:css.maxHeight,withinViewport:!visible||r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
  }
  const inventoryLayout=p?.field?.upgrades.length===FIELD_LIMITS.upgrades&&p?.field?.items.length===FIELD_LIMITS.items?runInventoryLayoutChecks(document):{status:'not-run',reason:'Seed the long field inventory and open it before inspecting.'};
  output.textContent=JSON.stringify({fixture:'localhost-only; no issue published',viewport:{width:innerWidth,height:innerHeight},inputFocus:{activeElement:document.activeElement?.id||document.activeElement?.tagName||null,hasFocus:document.hasFocus(),pointerLockElement:document.pointerLockElement?.id||null},safe,mission:w?.mission.name,status:w?.status,time:w?Math.round(w.time*10)/10:null,hp:p?.hp,pending:p?.field?.pending,xp:p?.field?.xp,upgrades:p?.field?.upgrades,items:p?.field?.items,modules:p?.field?.modules,buffs:p?.field?.buffs,relays:p?.field?.relays,nearby:p?.field?.nearby,salvage:w?.sortie?.salvage,enemies:w?.enemies.length,spawns:w?.spawn.length,bounds,inventoryLayout},null,2);
 }
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-qa]');if(!button)return;
  const action=button.dataset.qa,w=current();
  if(action==='focus'){document.getElementById('battle')?.focus();say('Focused the real battle canvas. Subsequent keyboard input goes to the game.');inspect();return;}
  if(action==='safe'){safe=!safe;button.textContent='Safe field: '+(safe?'ON':'OFF');if(w&&safe)clearThreats(w);say(safe?'Safe field armed. Threats, future waves and strikes are suppressed; hull is protected.':'Safe field clearing stopped. Reload or redeploy to remove invulnerability and restore the original director state.');inspect();return;}
  if(action==='inspect'){inspect();return;}
  if(!w){say('Deploy a solo sortie or target range through the normal game UI first. Co-op sessions cannot be changed by this fixture.');return;}
  const p=field(w);
  if(action==='xp'){for(let i=0;i<20;i++)rewardDefeat(w,{id:'qa-xp-'+(++serial),type:'drone',lastHitBy:p.id,x:p.x+600,y:p.y+600});say('Awarded 200 base XP through rewardDefeat; installed XP modifiers apply. Choose upgrades using the real HUD.');}
  if(action==='cache-free')nearby(w,'cache');
  if(action==='cache-paid'){w.sortie.salvageUnits=0;w.sortie.salvage=0;nearby(w,'cache',18);}
  if(action==='relay')nearby(w,'relay');
  if(action==='fund'){awardSalvage(w,100);say('Awarded 100 base shared salvage; salvage modifiers apply.');}
  if(action==='stack'){p.field.items=p.field.items.filter(id=>id!=='gyro');p.field.items.push(...Array(FIELD_ITEMS.gyro.maxStacks).fill('gyro'));p.field.items=p.field.items.slice(-FIELD_LIMITS.items);say('Seeded maximum gyro stacks. Place a free gyro cache to inspect TECH FULL.');}
  if(action==='inventory'){
   p.field.upgrades=Object.values(FIELD_UPGRADES).flatMap(entry=>Array(Math.min(2,entry.maxStacks)).fill(entry.id)).slice(0,FIELD_LIMITS.upgrades);
   p.field.items=Object.values(FIELD_ITEMS).flatMap(entry=>Array(Math.min(2,entry.maxStacks)).fill(entry.id)).slice(0,FIELD_LIMITS.items);
   p.field.modules=Object.keys(FIELD_MODULES).slice(0,FIELD_LIMITS.modules);p.field.relays=['colossus','uplink'];p.field.buffs=[{relayId:'assault',expiresAt:w.time+FIELD_RELAYS.assault.duration}];p.field.relayCount=3;p.field.pending=0;p.hp=combatStats(p).hp;
   say('Seeded bounded upgrades, salvage tech, modules and relay support. Open real inventory with B or its button.');
  }
  if(action==='expire'){const expires=Math.max(w.time,...p.field.buffs.map(buff=>buff.expiresAt));w.time=expires+.1;say('Advanced authoritative world time beyond active relay expiry. The next real simulation step removes timed support.');}
  inspect();
 });
 const timer=setInterval(()=>{const w=current();if(w!==lastWorld){lastWorld=w;if(w)say(safe?'Live world detected. Safe field is armed.':'Live world detected. Enable Safe field before extended inspection.');}if(safe&&w)clearThreats(w);},50);
 window.addEventListener('pagehide',()=>{clearInterval(timer);window.removeEventListener('keydown',gameKey,true);if(external)doc.removeEventListener('keydown',parentKey,true);observer.disconnect();root.remove();style.remove();},{once:true});
 // The receipt satisfies production validation but cannot denote a published issue.
 const observer=new MutationObserver(()=>{const receipt=document.querySelector('#feedbackIssue');if(receipt?.getAttribute('href')==='https://github.com/loganthorneloe/ironwake/issues/0'&&receipt.textContent!=='LOCAL MOCK RECEIPT · nothing published'){receipt.textContent='LOCAL MOCK RECEIPT · nothing published';receipt.setAttribute('aria-label','Local mock receipt. No GitHub issue was published.');receipt.onclick=e=>e.preventDefault();}});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
}
