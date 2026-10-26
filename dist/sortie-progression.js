import{FIELD_UPGRADES,FIELD_ITEMS,FIELD_RELAYS,FIELD_MODULES,FIELD_LIMITS,cleanFieldIds,cleanFieldUpgrades,cleanFieldItems}from './field-catalog.js';
import{staticShotBlocked}from './collision.js';
export{FIELD_UPGRADES,FIELD_ITEMS,FIELD_RELAYS,FIELD_MODULES,FIELD_LIMITS,cleanFieldIds,cleanFieldUpgrades,cleanFieldItems};
export const CONTRACTS=[
 {id:'frontline',name:'Frontline',tag:'BALANCED',detail:'Standard Cinderfall patrols and siege arrivals. Learn the route and build your mech as you fight.',reward:1,wave:5.5,tanks:9,eliteTimes:[20,45]},
 {id:'overrun',name:'Overrun',tag:'RELENTLESS',detail:'Reinforcements arrive 24% sooner. Keep moving and clear groups quickly. Earn 25% more salvage.',reward:1.25,wave:4.2,tanks:9,eliteTimes:[20,45]},
 {id:'siegebreaker',name:'Siegebreaker',tag:'HEAVY CONTACT',detail:'More armored scarabs; siege mechs drop earlier. Bring armor-breaking weapons. Earn 35% more salvage.',reward:1.35,wave:5.5,tanks:4,eliteTimes:[12,25]}
];
export const contractFor=id=>CONTRACTS.find(c=>c.id===id)||CONTRACTS[0];
const EMPTY=[],count=(n,max=999999)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.round(n))):0;
const randomSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const modifierKeys=['damage','heavyDamage','damageReduction','recovery','moveSpeed','lift','dashRecharge','specialRecharge','fireRate','projectileSpeed','area','critChance','critDamage','lifesteal','killHeal','thorns','maxHull','xpGain','salvageGain','dashDamage','meleeDamage','burnDamage','chainDamage','pickupRadius','shieldPower','lowHullDamage','precisionDamage','rangedDamage','airborneDamage','stunnedDamage','executeDamage','specialPower','burnChance','chainChance'];
export function moduleLevel(p,id){let level=0;for(const value of p?.field?.modules||EMPTY)if(value===id)level++;return level;}
export function fieldModifiers(p){
 const result=Object.fromEntries(modifierKeys.map(key=>[key,0])),f=p?.field;
 const add=entry=>{if(entry?.effects)for(const[key,value]of Object.entries(entry.effects))if(Object.hasOwn(result,key))result[key]+=value;};
 for(const id of f?.modules||EMPTY)add(FIELD_UPGRADES[id]);for(const id of f?.upgrades||EMPTY)add(FIELD_UPGRADES[id]);for(const id of f?.items||EMPTY)add(FIELD_ITEMS[id]);for(const id of f?.relays||EMPTY)add(FIELD_RELAYS[id]);for(const buff of f?.buffs||EMPTY)add(FIELD_RELAYS[buff.relayId]);return result;
}
export const xpForLevel=level=>{const rank=Math.max(0,Math.min(60,Math.floor(Number(level)||1)-1));return 30*rank+10*rank*rank;};
export const xpToNext=p=>Math.max(0,xpForLevel((p?.field?.level||1)+1)-(p?.field?.xp||0));
function levelForXP(xp){let level=1;while(level<60&&xp>=xpForLevel(level+1))level++;return level;}
function addXP(w,p,amount){
 const f=p.field;if(!f||!(p.hp>0))return;f.xp=Math.min(999999,f.xp+Math.max(0,Math.round(amount*(1+fieldModifiers(p).xpGain))));
 const level=levelForXP(f.xp),earned=level-f.level;f.level=level;f.pending=Math.max(0,Math.min(FIELD_LIMITS.upgrades-f.upgrades.length,f.pending+earned));if(earned>0)f.lastPickup={name:'FIELD UPGRADE READY',color:'#ffd06a',kind:'level',until:(w.time||0)+5};
}
const inside=(p,o,padding=0)=>p.x>o.x+padding&&p.x<o.x+o.w-padding&&p.y>o.y+padding&&p.y<o.y+o.h-padding;
function safePosition(m,anchor,nodes,rng){
 const radius=62,usable=p=>p.x>=radius&&p.y>=radius&&p.x<=(m.width||8800)-radius&&p.y<=(m.height||5940)-radius&&!(m.obstacles||[]).some(o=>p.x+radius>o.x&&p.x-radius<o.x+o.w&&p.y+radius>o.y&&p.y-radius<o.y+o.h)&&!nodes.some(n=>Math.hypot(n.x-p.x,n.y-p.y)<145),start=rng()*Math.PI*2;
 for(let attempt=0;attempt<100;attempt++){
  const ring=90+Math.floor(attempt/12)*64,angle=start+attempt*2.399963229728653,p={x:anchor.x+Math.cos(angle)*ring,y:anchor.y+Math.sin(angle)*ring,z:0};if(!usable(p))continue;
  const deck=(m.platforms||[]).find(platform=>inside(p,platform,45));
  // A whole base must fit on a deck; ramps and deck edges would leave the prop floating.
  if((m.platforms||[]).some(platform=>inside(p,platform,-radius)&&platform!==deck))continue;if((m.ramps||[]).some(ramp=>inside(p,ramp,-radius)))continue;p.z=deck?.z||0;if(p.z>240)continue;return p;
 }
 if(anchor!==m.entry)return safePosition(m,m.entry,nodes,rng);return null;
}
function makeFieldNodes(w){
 const m=w.mission,rng=randomSeed((m.seed^0xb62e31a9)>>>0),nodes=[],cacheIds=Object.keys(FIELD_ITEMS),relayIds=Object.keys(FIELD_RELAYS),anchors=[m.entry,...(m.points?.length?m.points:m.zones||[])],caches=4+Math.floor(rng()*3),relays=2+Math.floor(rng()*3);
 for(let i=0;i<caches+relays;i++){
  const kind=i<caches?'cache':'relay',anchor=anchors[i%anchors.length],position=safePosition(m,anchor,nodes,rng);if(!position)continue;const ids=kind==='cache'?cacheIds:relayIds,selection=Math.floor(rng()*ids.length),id=kind==='cache'?ids[selection]:ids.splice(selection,1)[0],definition=(kind==='cache'?FIELD_ITEMS:FIELD_RELAYS)[id];
  nodes.push({id:'field-'+i,kind,...position,state:'ready',revision:0,cost:kind==='cache'?(i===0?0:18+Math.floor(rng()*4)*4):definition.cost,claimed:[],...(kind==='cache'?{itemId:id}:{relayId:id})});
 }return nodes;
}
export function initSortie(w,statsForPlayer){
 w.sortie={contract:contractFor(w.mission.contract).id,salvage:0,salvageUnits:0,salvageEarned:0,salvageEarnedUnits:0,salvageSpent:0,combatKills:0,objectives:0,teamSize:w.players.length};
 // Capture trained hardware before loading run inventory. Later field hull gains multiply this base once.
 w.players.forEach((p,i)=>{const profile=w.mission.raid?w.mission.campaign?.pilots?.find(q=>q.name===p.name):null,xp=count(profile?.xp),level=levelForXP(xp),upgrades=cleanFieldUpgrades(profile?.upgrades),baseHull=statsForPlayer?statsForPlayer(p.build,p).hp:p.hp;p.field={modules:cleanFieldIds(profile?.modules,FIELD_MODULES,FIELD_LIMITS.modules),upgrades,items:cleanFieldItems(profile?.items),damage:0,kills:0,maxHull:baseHull,seed:(w.mission.seed+i*7919)>>>0,xp,level,pending:Math.max(0,Math.min(FIELD_LIMITS.upgrades-upgrades.length,level-1-upgrades.length)),offerRevision:0,buffs:[],relays:[],relayCount:0,nearby:null,lastPickup:null};});w.field={nodes:makeFieldNodes(w),serial:100,dropCount:0};
}
export function fieldOffer(w,p){
 const f=p?.field;if(!w?.sortie||w.status!=='playing'||!f||!(p.hp>0)||!f.pending||f.upgrades.length>=FIELD_LIMITS.upgrades)return[];
 const available=Object.keys(FIELD_UPGRADES).filter(id=>f.upgrades.filter(value=>value===id).length<FIELD_UPGRADES[id].maxStacks),rng=randomSeed((f.seed^Math.imul(f.offerRevision+1,0x45d9f3b))>>>0);for(let i=available.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
 return available.slice(0,3).map(id=>({...FIELD_UPGRADES[id],revision:f.offerRevision,stacks:f.upgrades.filter(value=>value===id).length}));
}
function currentMaxHull(p){return Math.max(1,(p.field?.maxHull||p.hp||1)*(1+fieldModifiers(p).maxHull));}
function gainHull(p,before){const after=currentMaxHull(p);p.hp=Math.min(after,p.hp+Math.max(0,after-before));}
export function chooseFieldModule(w,p,request){
 const f=p?.field;if(!request||!f||request.revision!==f.offerRevision||!fieldOffer(w,p).some(entry=>entry.id===request.id))return false;const before=currentMaxHull(p);f.upgrades.push(request.id);f.pending--;f.offerRevision++;gainHull(p,before);f.lastPickup={name:FIELD_UPGRADES[request.id].name,color:FIELD_UPGRADES[request.id].color,kind:'upgrade',until:(w.time||0)+5};return true;
}
export function awardSalvage(w,amount){
 if(!w.sortie||!Number.isFinite(amount)||amount<=0)return;const alive=w.players.filter(p=>p.hp>0),bonus=alive.length?alive.reduce((sum,p)=>sum+fieldModifiers(p).salvageGain,0)/alive.length:0,earned=Math.round(amount*contractFor(w.sortie.contract).reward*(1+bonus)*100);w.sortie.salvageUnits=Math.min(99999900,w.sortie.salvageUnits+earned);w.sortie.salvage=Math.floor(w.sortie.salvageUnits/100);w.sortie.salvageEarnedUnits=Math.min(99999900,(w.sortie.salvageEarnedUnits||0)+earned);w.sortie.salvageEarned=Math.floor(w.sortie.salvageEarnedUnits/100);
}
function dropCache(w,e){
 if(!w.field||w.field.dropCount>=4)return;const rng=randomSeed(((w.mission.seed||0)^Math.imul(w.sortie.combatKills+1,2654435761))>>>0);if(!e.elite&&!e.objective&&w.sortie.combatKills%12!==0)return;const position=safePosition(w.mission,e,w.field.nodes,rng);if(!position)return;const ids=Object.keys(FIELD_ITEMS),itemId=ids[Math.floor(rng()*ids.length)];w.field.nodes.push({id:'field-drop-'+w.field.serial++,kind:'cache',...position,itemId,state:'ready',revision:0,cost:0,claimed:[],drop:true});w.field.dropCount++;
}
export function rewardDefeat(w,e){
 if(!w.sortie||w.status!=='playing'||e.training||e.fieldRewarded)return;e.fieldRewarded=true;awardSalvage(w,e.id==='cinder-warden'?100:e.elite?50:e.objective?24:e.type==='tank'?10:e.type==='gunner'?6:4);if(e.objective)w.sortie.objectives++;else w.sortie.combatKills++;
 const xp=e.id==='cinder-warden'?140:e.elite?80:e.objective?35:e.type==='tank'?22:e.type==='gunner'?14:10;for(const pilot of w.players)addXP(w,pilot,xp);const p=w.players.find(p=>p.id===e.lastHitBy);if(p?.field&&!e.objective)p.field.kills++;dropCache(w,e);
}
export function fieldDamage(p,e,damage){const f=fieldModifiers(p);return damage*(1+f.damage)*(e.objective||e.elite||e.type==='tank'?1+f.heavyDamage:1);}
export function interactField(w,p,request){
 const f=p?.field,node=w?.field?.nodes.find(node=>node.id===request?.id);if(!w?.sortie||w.status!=='playing'||!f||!(p.hp>0)||!node||node.state!=='ready'||request.revision!==node.revision||node.claimed.includes(p.id)||Math.hypot(p.x-node.x,p.y-node.y)>(node.drop?Math.max(125,42+fieldModifiers(p).pickupRadius):125)||Math.abs((p.altitude||0)-node.z)>95)return false;
 if(staticShotBlocked(w.mission,{x:p.x,y:p.y,z:(p.altitude||0)+32},{x:node.x,y:node.y,z:node.z+32}))return false;
 const definition=node.kind==='cache'?FIELD_ITEMS[node.itemId]:FIELD_RELAYS[node.relayId];if(!definition)return false;if(node.kind==='cache'&&(f.items.length>=FIELD_LIMITS.items||f.items.filter(id=>id===node.itemId).length>=definition.maxStacks))return false;
 if(node.kind==='relay'&&!definition.duration&&f.relays.includes(node.relayId))return false;
 const cost=count(node.cost,9999),units=Number.isFinite(w.sortie.salvageUnits)?w.sortie.salvageUnits:count(w.sortie.salvage)*100;if(units<cost*100)return false;const before=currentMaxHull(p);w.sortie.salvageUnits=units-cost*100;w.sortie.salvage=Math.floor(w.sortie.salvageUnits/100);w.sortie.salvageSpent=(w.sortie.salvageSpent||0)+cost;node.claimed.push(p.id);node.revision++;
 if(node.kind==='cache'){f.items.push(node.itemId);node.state='spent';}else{if(definition.duration>0){const existing=f.buffs.find(buff=>buff.relayId===node.relayId);if(existing)existing.expiresAt=(w.time||0)+definition.duration;else f.buffs.push({relayId:node.relayId,expiresAt:(w.time||0)+definition.duration});}else f.relays.push(node.relayId);f.relayCount++;if(node.relayId==='mender')p.hp=Math.min(before,p.hp+before*.35);if(w.players.every(pilot=>node.claimed.includes(pilot.id)))node.state='spent';}
 gainHull(p,before);f.lastPickup={name:definition.name,color:definition.color,kind:node.kind,until:(w.time||0)+5};f.nearby=null;return true;
}
export function stepField(w,dt){
 if(!w?.field)return;for(const p of w.players){const f=p.field;if(!f)continue;f.buffs=(f.buffs||[]).filter(buff=>buff.expiresAt>w.time);p.hp=Math.min(p.hp,currentMaxHull(p));if(f.lastPickup?.until<=w.time)f.lastPickup=null;f.nearby=null;if(!(p.hp>0))continue;let best=125;
  for(const node of w.field.nodes){if(node.state!=='ready'||node.claimed.includes(p.id)||Math.abs((p.altitude||0)-node.z)>95||node.kind==='relay'&&f.relays?.includes(node.relayId))continue;const distance=Math.hypot(p.x-node.x,p.y-node.y);if(distance<=best&&!staticShotBlocked(w.mission,{x:p.x,y:p.y,z:(p.altitude||0)+32},{x:node.x,y:node.y,z:node.z+32})){best=distance;f.nearby=node.id;}}
  // Free combat drops reward moving through the fight; authored caches retain an explicit choice.
  for(const drop of w.field.nodes){if(drop.drop&&drop.state==='ready'&&Math.hypot(p.x-drop.x,p.y-drop.y)<=42+fieldModifiers(p).pickupRadius&&Math.abs((p.altitude||0)-drop.z)<70&&interactField(w,p,{id:drop.id,revision:drop.revision}))break;}
 }
}
export function cleanSortieReport(value){
 if(!value||!['victory','defeat','withdrawal'].includes(value.outcome))return null;return{teamSize:Math.max(1,count(value.teamSize||value.pilots?.length||1,4)),missionId:typeof value.missionId==='string'?value.missionId.slice(0,32):null,missionName:typeof value.missionName==='string'?value.missionName.slice(0,40):'Cinderfall',totalObjectives:count(value.totalObjectives||5,5),round:!!value.round,outcome:value.outcome,contract:contractFor(value.contract).id,seconds:count(value.seconds),cleared:count(value.cleared,5),kills:count(value.kills),salvage:count(value.salvage),salvageEarned:count(value.salvageEarned??value.salvage),salvageSpent:count(value.salvageSpent),redeploys:count(value.redeploys,2),pilots:(Array.isArray(value.pilots)?value.pilots:[]).slice(0,4).map(p=>({name:String(p?.name||'Pilot').slice(0,24),damage:count(p?.damage,99999999),kills:count(p?.kills),modules:cleanFieldIds(p?.modules,FIELD_MODULES,FIELD_LIMITS.modules),upgrades:cleanFieldUpgrades(p?.upgrades),items:cleanFieldItems(p?.items),xp:count(p?.xp),level:levelForXP(count(p?.xp)),relays:count(p?.relays,99)}))};
}
export function sortieReport(w,outcome){
 if(!w?.sortie)return null;return cleanSortieReport({teamSize:w.sortie.teamSize,missionId:w.mission.missionId,missionName:w.mission.name,totalObjectives:w.mission.zones.length,round:w.mission.raid,outcome,contract:w.sortie.contract,seconds:w.time,cleared:w.cleared,kills:w.sortie.combatKills,salvage:w.sortie.salvage,salvageEarned:w.sortie.salvageEarned,salvageSpent:w.sortie.salvageSpent,redeploys:(w.mission.raid?1:2)-w.operation.redeploys,pilots:w.players.map(p=>({name:p.name,damage:p.field?.damage,kills:p.field?.kills,modules:p.field?.modules,upgrades:p.field?.upgrades,items:p.field?.items,xp:p.field?.xp,relays:p.field?.relayCount}))});
}
