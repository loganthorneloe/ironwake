import{coordinateEnemies}from './enemy-coordination.js';
import{recordTeamHit,stepTeamCombos}from './team-combos.js';
import{ENEMY_ROLES,stepEnemy,stepEnemyHazards,cancelEnemyAction}from './enemy-behaviors.js';
import {obstacleSolid,structureBoxes,structureIntersects,damageStructureAt,damageStructureArea} from './destruction.js';
import {initDestructionMission,stepDestructionMission} from './destruction-mission.js';
import{missionTuning}from './mission-catalog.js';
import{chassisIdFor,chassisFor,chassisBounds,applyChassisStats}from './chassis.js';
import{installPartDesigns}from './part-designs.js';
import{nearbyObstacles,staticShotBlocked}from './collision.js?v=41';
import{initSortie,chooseFieldModule,moduleLevel,fieldDamage,rewardDefeat}from './sortie-progression.js';
import{cleanDeploymentProgression,progressionModifiers,applyProgressionStats}from './career-progression.js';
import{planetMission,initOperation,stepOperation}from './planet-mission.js?v=41';
export{planetMission}from './planet-mission.js?v=41';
import{blocksBullet,BULWARK}from './bulwark.js?v=41';
export{blocksBullet}from './bulwark.js?v=41';
import{muzzleOrigin,firingDirection}from './weapon-origin.js?v=41';
import{STRIKES}from './combat-motion.js?v=41';
export const FRAMES={scout:{name:'SCOUT',role:'FLANKER',hp:90,speed:360,cost:2,boost:1.85,lift:185,flightCost:18,dodge:3.6,desc:'Light interceptor. Fast lift, long boosts, minimal armor.'},striker:{name:'STRIKER',role:'VERSATILE',hp:125,speed:300,cost:3,boost:1.7,lift:155,flightCost:20,dodge:3.4,desc:'Balanced assault frame. Responsive on deck and in flight.'},bulwark:{name:'BULWARK',role:'ANCHOR',hp:175,speed:240,cost:4,boost:1.5,lift:125,flightCost:24,dodge:3.05,desc:'Heavy siege frame. Broad armor, weighty strides, shorter flights.'}};
// Body-hit sustained baseline: roughly 190–280 DPS. Precision, positioning and groups reward different tools.
export const WEAPONS={
 dynamo:{name:'DC-5 / Dynamo cannon',weight:11,cost:4,damage:280,rate:.35,moveRecharge:500,range:900,speed:1900,pellets:1,pierce:2,role:'RANGED · MOBILE / PIERCING',desc:'280 damage through 2 enemies · Move 500m to reload · Dash to charge, then line up a shot · 900m'},
 carbine:{name:'AR-18 / Pulse carbine',weight:6,cost:3,damage:24,rate:.1,range:1050,speed:1800,pellets:1,precision:1.25,role:'RANGED · ALL-ROUND / PRECISION',desc:'240 body DPS · Upper-chassis hits deal +25% · Accurate while moving · 1050m'},
 scatter:{name:'SG-6 / Prism shotgun',weight:10,cost:4,damage:20,rate:.68,range:460,speed:1550,pellets:9,role:'RANGED · BURST / SPACE MAKER',desc:'265 close DPS · 5 tight shards + 4 wide shards · Close blasts push back and interrupt · 460m'},
 rail:{name:'LR-9 / Railgun',weight:11,cost:4,damage:320,rate:.5,charge:.66,range:1500,speed:3000,pellets:1,pierce:3,precision:1.15,role:'RANGED · PRECISION / PIERCING',desc:'320 damage · +15% upper-chassis hits · Pierces 3 and interrupts · Click or hold · 0.66s charge + 0.5s recovery · 1500m'},
 launcher:{name:'RX-4 / Rocket launcher',weight:14,cost:4,damage:225,rate:1.05,range:1000,speed:850,pellets:1,splash:125,seeker:true,role:'RANGED · GUIDED / AREA BURST',desc:'214 direct DPS · Aim near a target for light guidance · 125m blast catches groups · 1000m'},
 plasma:{name:'PX-7 / Plasma launcher',weight:12,cost:4,damage:70,rate:.3,range:900,speed:1250,pellets:1,splash:0,stun:.3,role:'RANGED · OVERLOAD / CROWD CONTROL',desc:'263 DPS with overloads · 4 hits trigger a 150m plasma burst + interrupt · Team hits combine · 900m'},
 rotary:{name:'MG-8 / Gatling laser',weight:12,cost:4,damage:12,rate:.0425,range:800,speed:1650,pellets:1,spread:.055,role:'RANGED · SUSTAINED / SUPPRESSION',desc:'282 full-speed DPS · Hold for 0.6s to spin up and tighten spread · Tracks targets while moving · 800m'},
 phaser:{name:'PH-4 / Phaser',weight:10,cost:4,damage:16,rate:.085,range:650,pellets:0,beam:true,leech:.125,role:'RANGED · TRACKING / REPAIR',desc:'188 DPS · Instant beam for moving targets · Actual damage repairs your mech, up to 24 armor/sec · 650m'},
 flamer:{name:'FT-9 / Flamethrower',weight:16,cost:4,damage:20,rate:.085,range:180,pellets:0,flame:true,role:'RANGED · SWEEP / AFTERBURN',desc:'259 close DPS with burn · Sweeps groups · 24 burn DPS lingers for 1.25s: ignite, then use your other hand · 180m'},
 blade:{name:'VB-2 / Laser sword',weight:5,cost:3,damage:180,rate:.8,range:115,pellets:1,melee:true,arc:1.15,role:'MELEE · WAVE',desc:'225 contact DPS · 180 per slash · Wide 90-damage wave reaches 500m'},
 lance:{name:'PL-9 / Pile lance',weight:9,cost:4,damage:288,rate:1.2,range:200,pellets:1,melee:true,arc:.28,role:'MELEE · PRECISION',desc:'240 DPS · 288 piercing thrust · 200m reach · Interrupts + 0.4s stagger'},
 hammer:{name:'IH-7 / Plasma sledgehammer',weight:13,cost:4,damage:300,rate:1.35,range:135,pellets:1,melee:true,arc:1.35,role:'MELEE · AREA SLAM',desc:'222 contact DPS · 300 direct / up to 160 radial · 220m blast · Aerial dive'},
 claws:{name:'FC-3 / Shock claws',weight:5,cost:3,damage:54,rate:.24,range:110,pellets:1,melee:true,arc:.65,role:'MELEE · SUSTAIN',desc:'225 DPS · Rapid cleaving strikes · 110m reach · Heals 3 armor per connected swing'},
 scythe:{name:'CS-6 / Crescent scythe',weight:10,cost:4,damage:200,rate:.95,range:190,pellets:1,melee:true,arc:Math.PI,role:'MELEE · CROWD CONTROL',desc:'211 DPS per target · 190m circular sweep · Pulls enemies 70m inward'},
 guard:{name:'BS-4 / Bulwark shield',weight:12,cost:4,damage:0,rate:.2,range:0,pellets:0,melee:true,guard:true,role:'DEFENSIVE · HOLD',desc:'Hold its hand button to raise · Covers 54% frontal height · Blocks 80% of covered bullet damage'}
};
export const RANGED=Object.fromEntries(Object.entries(WEAPONS).filter(([,w])=>!w.melee));
export const MELEE=Object.fromEntries(Object.entries(WEAPONS).filter(([,w])=>w.melee));
export const COMBAT_MOVES={dash:{name:'Dash',cd:3,duration:.32,speed:1250,damage:160}};
export const AI_ARM_TIME=.65;
export const ABILITIES={emp:{role:'SPECIAL · CROWD CONTROL',name:'EMP shockwave',cost:3,cd:14,duration:4,radius:320,desc:'320m shockwave · 45 damage + 4s stun · 14s cooldown'},shield:{role:'SPECIAL · DEFENSIVE',name:'Aegis dome',cost:2,cd:18,duration:8,radius:220,desc:'220m moving dome · 60% damage reduction for 8s · 18s cooldown'},repair:{role:'SPECIAL · SUPPORT',name:'Repair field',cost:3,cd:20,duration:8,radius:240,desc:'240m field · Restore 12 armor/sec for 8s · 20s cooldown'}};
export const TRAIL_COLORS=[['#56bfff','ION BLUE'],['#7dffe0','MINT'],['#c596ff','VIOLET'],['#ff785e','EMBER'],['#ffd06a','GOLD'],['#edfaff','WHITE']];
export const COLORS=[['#ee7950','RESCUE ORANGE'],['#b3c9bd','FIELD SAGE'],['#e2d6b4','DESERT BONE'],['#74adca','ION BLUE'],['#b698c1','NEBULA'],['#d3dadd','ARCTIC']];
// Legacy frame IDs are read only when migrating older saves. New builds use five independently painted frame parts.
export const PART_LABELS={torso:'Torso',head:'Head',arms:'Arms',legs:'Legs',booster:'Boosters'};
export const PARTS={
 torso:{light:{name:'Kestrel shell',weight:14,hp:50,desc:'50 armor · 14t'},standard:{name:'Atlas core',weight:24,hp:80,desc:'80 armor · 24t'},heavy:{name:'Bastion hull',weight:38,hp:125,desc:'125 armor · 38t'}},
 head:{light:{name:'Needle visor',weight:3,hp:6,desc:'6 armor · 3t'},standard:{name:'Vector helm',weight:5,hp:10,desc:'10 armor · 5t'},heavy:{name:'Bastion crown',weight:9,hp:18,desc:'18 armor · 9t'}},
 arms:{light:{name:'Needle manipulators',weight:4,hp:8,desc:'8 armor · 4t'},standard:{name:'Vector arms',weight:7,hp:13,desc:'13 armor · 7t'},heavy:{name:'Forge gauntlets',weight:11,hp:20,desc:'20 armor · 11t'}},
 legs:{light:{name:'Springstep',weight:7,hp:15,drive:0,desc:'15 armor · 7t'},standard:{name:'Stride biped',weight:12,hp:22,drive:10,desc:'22 armor · 12t'},heavy:{name:'Siege struts',weight:19,hp:30,drive:20,desc:'30 armor · 19t'}},
 booster:{light:{name:'Wisp jets',weight:4,capacity:58,force:330,draw:10,energy:90,recharge:36,desc:'Fastest lift · Powers up to 58t · 4t'},standard:{name:'Ion drive',weight:7,capacity:88,force:300,draw:12,energy:100,recharge:32,desc:'Balanced lift · Powers up to 88t · 7t'},heavy:{name:'Nova thrusters',weight:11,capacity:110,force:270,draw:14,energy:125,recharge:28,desc:'Slower lift · Powers up to 110t · 11t'}}
};
installPartDesigns(PARTS);
for(const[id,weight]of Object.entries({emp:5,shield:4,repair:6}))ABILITIES[id].weight=weight;
export const EQUIPMENT={...WEAPONS,...ABILITIES};
export const RACK_SIZE=3;
// v22: left hand, right hand, special. Older four-slot saves retain melee + primary gun.
export function equipmentFor(b={}){const a=Array.isArray(b.equipment)?b.equipment:!b.weapon&&!b.melee&&!b.ability?(chassisFor(b).equipment||[]):[],ok=id=>Object.hasOwn(WEAPONS,id),ability=a.find(id=>Object.hasOwn(ABILITIES,id))||(Object.hasOwn(ABILITIES,b.ability)?b.ability:'emp');
 if(a.length===3&&ok(a[0])&&ok(a[1]))return[a[0],a[1],ability];
 if(a.length===2&&ok(a[0])&&ok(a[1]))return[a[0],a[1],ability];
 const gun=a.find(id=>Object.hasOwn(RANGED,id))||(Object.hasOwn(RANGED,b.weapon)?b.weapon:'carbine'),melee=a.find(id=>Object.hasOwn(MELEE,id))||(Object.hasOwn(MELEE,b.melee)?b.melee:Object.hasOwn(MELEE,b.weapon)?b.weapon:'blade');
 return[melee,gun,ability];}
export function activeItem(p){return equipmentFor(p.build).find(id=>Object.hasOwn(RANGED,id))||equipmentFor(p.build)[0];}
export function specialFor(p){return equipmentFor(p.build)[2];}
export function partsFor(b={}){const preset=b.frame==='scout'?'light':b.frame==='bulwark'?'heavy':'standard';return Object.fromEntries(Object.keys(PARTS).map(slot=>[slot,Object.hasOwn(PARTS[slot],b.parts?.[slot])?b.parts[slot]:(chassisFor(b).parts?.[slot]||preset)]));}
export function mechStats(b={}){
 const parts=partsFor(b),p=Object.fromEntries(Object.keys(parts).map(slot=>[slot,PARTS[slot][parts[slot]]]));
 const frameWeight=Object.values(p).reduce((n,v)=>n+v.weight,0),equipmentWeight=equipmentFor(b).reduce((n,id)=>n+(EQUIPMENT[id]?.weight||0),0),weight=frameWeight+equipmentWeight,capacity=p.booster.capacity;
 const hp=Object.values(p).reduce((n,v)=>n+(v.hp||0),0),speed=Math.round(Math.max(200,Math.min(370,390+p.legs.drive-weight*1.8))),lift=Math.round(Math.max(100,p.booster.force-weight*1.65));
 return applyChassisStats({hp,speed,walkSpeed:Math.round(speed*.24),lift,weight,frameWeight,equipmentWeight,power:weight,capacity,output:capacity,energy:p.booster.energy,recharge:p.booster.recharge,boost:1.45+p.booster.force/1000,flightCost:0,boostCost:0,dodge:Math.max(2.8,3.8-weight/120),weightClass:weight<=42?'LIGHT':weight<=70?'MEDIUM':'HEAVY',valid:weight<=capacity},b,equipmentFor(b));
}
const careerModifierCache=new WeakMap();
function freezeDeploymentProgression(value,chassisId){const clean=cleanDeploymentProgression(value,chassisId);Object.freeze(clean.mech);Object.freeze(clean.pilot);return Object.freeze(clean);}
function careerModifiers(p){
 const progression=p?.progression,chassis=chassisIdFor(p?.build);
 // Only immutable host-sanitized ranks can be cached; mutable snapshots are validated again.
 if(progression&&Object.isFrozen(progression)&&Object.isFrozen(progression.mech)&&Object.isFrozen(progression.pilot)){
  const cached=careerModifierCache.get(progression);if(cached?.chassis===chassis)return cached.modifiers;
  const modifiers=Object.freeze(progressionModifiers(progression,chassis));careerModifierCache.set(progression,{chassis,modifiers});return modifiers;
 }
 return progressionModifiers(progression,chassis);
}
// Career training modifies base hardware before temporary run effects. Workshop fit stays pure.
export function combatStats(p){const base=applyProgressionStats(mechStats(p.build),careerModifiers(p)),thrust=1+.1*moduleLevel(p,'thrusters');return{...base,speed:base.speed*thrust,walkSpeed:base.walkSpeed*thrust,lift:base.lift*thrust};}
// Directors retain their build callback contract and may also supply the deployed player.
export const statsForPlayer=(build,p)=>p?combatStats(p):mechStats(build);
export function mechName(b={}){const [left,right,special]=equipmentFor(b),names={dynamo:'Dynamo',carbine:'Pulse',scatter:'Prism',rail:'Volt',launcher:'Inferno',plasma:'Nova',rotary:'Tempest',phaser:'Revenant',flamer:'Cinder',blade:'Ronin',lance:'Lancer',hammer:'Titan',claws:'Raptor',scythe:'Reaper',guard:'Bastion'};return `${names[left]} ${names[right]} / ${{emp:'E',shield:'A',repair:'R'}[special]}`.toUpperCase();}
export function buildKey(b){const c=cleanBuild(b);return JSON.stringify([c.chassis,c.parts,c.equipment,c.partColors,c.trailColor]);}
export const DEFAULT_BUILD={name:'VANGUARD-01',frame:'striker',weapon:'carbine',melee:'blade',ability:'emp',color:COLORS[0][0]};
export const cost=b=>mechStats(b).power;
export const validBuild=b=>mechStats(b).valid;
export function cleanBuild(b={}){if(!b||typeof b!=='object')b={};const parts=partsFor(b),equipment=equipmentFor(b),color=COLORS.some(c=>c[0]===b.color)?b.color:COLORS[0][0],partColors=Object.fromEntries(Object.keys(PARTS).map(slot=>[slot,COLORS.some(c=>c[0]===b.partColors?.[slot])?b.partColors[slot]:color]));return{chassis:chassisIdFor(b),trailColor:TRAIL_COLORS.some(c=>c[0]===b.trailColor)?b.trailColor:TRAIL_COLORS[0][0],name:chassisFor(b).id?`${chassisFor(b).name.toUpperCase()} / ${mechName({equipment})}`:mechName({equipment}),parts,equipment,partColors,weapon:equipment.find(id=>Object.hasOwn(RANGED,id))||'carbine',melee:equipment.find(id=>Object.hasOwn(MELEE,id))||'blade',ability:equipment.find(id=>Object.hasOwn(ABILITIES,id))||'emp',color:partColors.torso};}

export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function testPlatform(){return{mode:'sandbox',seed:84901,name:'TEST PLATFORM',sector:0,terrain:'OPEN DECK',biome:0,heading:-Math.PI/2,width:4200,height:3000,entry:{x:0,y:0},exit:{x:0,y:0},rooms:[{x:0,y:0,w:480,h:480}],paths:[],zones:[],obstacles:[],platforms:[],ramps:[],boundaries:[]};}
export function combatTrial(){return{...testPlatform(),mode:'trial',seed:84902,name:'COMBAT TRIAL'};}
function trialOpponent(count){const hp=900*(1+.55*(count-1));return{id:'rival',type:'rival',x:0,y:-520,altitude:0,hp,max:hp,angle:Math.PI/2,stun:0,windup:0,cd:AI_ARM_TIME,shot:0,shotCount:0,meleeTime:0,meleeCount:0,burst:0,burstTimer:0,r:21,speed:430,weapon:'carbine',melee:'blade'};}

export function mission(seed){
 const r=rng(seed),biome=Math.floor(r()*3),names=[['CINDER','EMBER','ASHEN'],['SILENT','FROZEN','PALE'],['DUST','RUST','HOLLOW']],suffix=['FALL','REACH','RIFT','HORIZON','WATCH'];
 const width=4200,height=3000,cell=60,cols=width/cell,rows=height/cell,tiles=Array(cols*rows).fill(0),rooms=[],paths=[];
 const carve=(x,y,w,h)=>{for(let j=Math.max(0,Math.floor(y/cell));j<Math.min(rows,Math.ceil((y+h)/cell));j++)for(let i=Math.max(0,Math.floor(x/cell));i<Math.min(cols,Math.ceil((x+w)/cell));i++)tiles[j*cols+i]=1;};
 let row=1+Math.floor(r()*3);for(let i=0;i<7;i++){if(i)row=clamp(row+(r()<.5?-1:1),0,4);const room={x:300+i*600,y:300+row*600,w:480,h:480};rooms.push(room);carve(room.x-240,room.y-240,480,480);if(i){const prev=rooms[i-1],bend=r()<.5?{x:room.x,y:prev.y}:{x:prev.x,y:room.y};const path=[{x:prev.x,y:prev.y},bend,{x:room.x,y:room.y}];paths.push(path);for(let j=1;j<path.length;j++){const a=path[j-1],b=path[j];carve(Math.min(a.x,b.x)-120,Math.min(a.y,b.y)-120,Math.abs(a.x-b.x)+240,Math.abs(a.y-b.y)+240);}}}
 // Merge solid cells into large wall rectangles; routes are at least 240 units wide.
 const obstacles=[],used=new Set();for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const id=y*cols+x;if(tiles[id]||used.has(id))continue;let w=1;while(x+w<cols&&!tiles[id+w]&&!used.has(id+w))w++;let h=1;outer:while(y+h<rows){for(let i=0;i<w;i++)if(tiles[(y+h)*cols+x+i]||used.has((y+h)*cols+x+i))break outer;h++;}for(let j=0;j<h;j++)for(let i=0;i<w;i++)used.add((y+j)*cols+x+i);obstacles.push({x:x*cell,y:y*cell,w:w*cell,h:h*cell,height:360,wall:true});}
 // Offset cover leaves room centers and corridor entrances clear.
 for(const room of rooms.slice(1,-1))for(const dx of[-1,1]){const dy=r()<.5?-1:1;obstacles.push({x:room.x+dx*155-35,y:room.y+dy*155-35,w:70,h:70,height:50+Math.floor(r()*45)});}
 const boundaries=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(tiles[y*cols+x])for(const[nx,ny]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+nx,yy=y+ny;if(xx>=0&&yy>=0&&xx<cols&&yy<rows&&!tiles[yy*cols+xx])boundaries.push({x:x*cell+30+nx*29,y:y*cell+30+ny*29,nx,ny});}
 const zones=rooms.slice(1,-1).map((p,i)=>({...p,id:i,name:i===4?'WARDEN DECK':['DOCKING ARRAY','REACTOR SPINE','TRANSIT BRIDGE','ORBITAL FOUNDRY'][i],boss:i===4,variant:Math.floor(r()*3)}));
 const platforms=[],ramps=[];for(const zone of zones){const sign=zone.variant%2?1:-1,z=90+(zone.id%2)*15;platforms.push({x:zone.x-210,y:zone.y+(sign>0?95:-215),w:420,h:120,z,zone:zone.id,kind:'deck'});platforms.push({x:zone.x+70,y:zone.y+(sign>0?-205:105),w:115,h:100,z:z+65,zone:zone.id,kind:'perch'});ramps.push({x:zone.x-205,y:zone.y+(sign>0?-175:-95),w:100,h:270,z,axis:'y',sign,zone:zone.id});}
 for(let i=obstacles.length-1;i>=0;i--)if(!obstacles[i].wall&&ramps.some(r=>obstacles[i].x<r.x+r.w+25&&obstacles[i].x+obstacles[i].w>r.x-25&&obstacles[i].y<r.y+r.h+25&&obstacles[i].y+obstacles[i].h>r.y-25))obstacles.splice(i,1);
 return{seed,biome,name:names[biome][Math.floor(r()*3)]+' '+suffix[Math.floor(r()*suffix.length)],sector:Math.floor(r()*88)+10,terrain:['HELIOS SHIPYARD','EUROPA ARRAY','VESPER RING'][biome],obstacles,width,height,rooms,paths,zones,boundaries,platforms,ramps,entry:rooms[0],exit:rooms[6],heading:Math.atan2(paths[0][1].y-rooms[0].y,paths[0][1].x-rooms[0].x)};
}
export function newWorld(m,roster){const spacing=Math.max(50,...roster.map(p=>chassisBounds(p.build).radius*2+8));const w={mission:m,players:roster.map((p,i)=>{const b=cleanBuild(p.build);if(!validBuild(b))throw new Error("Mech cannot deploy: "+mechStats(b).issues.join(" "));const progression=freezeDeploymentProgression(p.progression,b.chassis),stats=applyProgressionStats(mechStats(b),progressionModifiers(progression,b.chassis));return{id:p.id,name:String(p.name||'Pilot').slice(0,16),build:b,progression,activeSlot:0,hands:b.equipment.slice(0,2).map(handState),weapon:b.weapon,melee:b.melee,activeAbility:null,x:m.entry.x+(i%2)*spacing-spacing/2,y:m.entry.y+Math.floor(i/2)*spacing-spacing/2,altitude:0,hp:stats.hp,angle:m.heading,pitch:0,shot:0,railCharge:0,chargeSlot:null,meleeTime:0,meleeCount:0,energy:stats.energy,dashCd:0,moveTime:0,moveKind:null,moveCount:0,dashHits:[],boosting:false,boostX:0,boostY:0,shotCount:0,hits:0,hitTime:-10,abilityCd:0,active:0,revive:0,input:{},lastInput:0};}),enemies:m.mode==='sandbox'?trainingTargets():m.mode==='trial'?[trialOpponent(roster.length)]:[],damageEvents:[],bullets:[],effects:[],hazards:[],time:0,zoneIndex:0,encounter:false,encounterStarted:-100,cleared:0,extractTime:0,kills:0,status:'playing',id:1,spawn:[],hazardTimer:10,seed:m.seed,hadBoss:false};if(m.mode==='operation'){initOperation(w);initSortie(w);};if(m.destructible)initDestructionMission(w);return w;}
function trainingTargets(){return[[-25,-140,'MELEE'],[0,-550,'RANGED'],[230,-650,'RANGED'],[-230,-480,'SPLASH'],[-295,-500,'SPLASH'],[-260,-565,'SPLASH']].map(([x,y,label],i)=>({id:'target-'+i,type:'target',training:true,label,x,y,altitude:0,hp:2000,max:2000,angle:Math.PI/2,stun:0,windup:0,cd:99,speed:0,r:22}));}
// Shared across both hands and allies: weapon stagger cannot permanently lock a target.
function staggerEnemy(w,e,duration){if(w.time<(e.staggerReadyAt||0))return;e.stun=Math.max(e.stun,duration);if(e.behavior)cancelEnemyAction(e);e.windup=0;e.staggerReadyAt=w.time+duration+.9;}
function damageEnemy(w,e,amount,owner,kind='hit'){if(e.hp<=0||e.locked)return 0;const attacker=w.players.find(p=>p.id===owner);if(attacker){const mods=careerModifiers(attacker);amount=fieldDamage(attacker,e,amount)*mods.damage*(e.objective||e.elite||e.type==='tank'?mods.heavyDamage:1);e.lastHitBy=owner;}const applied=Math.min(e.hp,amount);e.hp-=applied;const combo=recordTeamHit(w,e,applied,owner,kind);if(combo?.kind==='break')staggerEnemy(w,e,.28);if(attacker?.field)attacker.field.damage+=applied;if(e.type==='rival'){e.lastAttacker=owner;e.lastDamaged=w.time;}w.damageEvents??=[];w.damageEvents.push({id:w.id++,x:e.x,y:e.y,z:(e.altitude||0)+65,amount:Math.round(applied),owner,kind,life:1});if(w.damageEvents.length>64)w.damageEvents.shift();return applied;}
function random(w){w.seed=(Math.imul(w.seed,1664525)+1013904223)>>>0;return w.seed/4294967296;}
function effect(w,x,y,r,color,life=.5,kind='impact'){w.effects.push({x,y,r,color,life,max:life,kind});}
const inside=(o,x,y,r=0)=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h;
export function rampHeight(r,x,y){const t=clamp((r.axis==='x'?x-r.x:y-r.y)/(r.axis==='x'?r.w:r.h),0,1);return r.z*(r.sign>0?t:1-t);}
export function surfaceAt(m,x,y,altitude=Infinity){let z=0;for(const original of m.obstacles)if(obstacleSolid(m,original))for(const o of structureBoxes(m,original))if(inside(o,x,y,20)&&(o.height||100)<=altitude+.1)z=Math.max(z,o.height||100);for(const p of m.platforms||[])if(inside(p,x,y)&&p.z<=altitude+12)z=Math.max(z,p.z);for(const r of m.ramps||[])if(inside(r,x,y)){const h=rampHeight(r,x,y);if(h<=altitude+12)z=Math.max(z,h);}return z;}
function blocked(w,x,y,r=20,z=0,height=58,foot=12){return nearbyObstacles(w.mission,x,y,r).some(o=>structureIntersects(w.mission,o,x,y,z,r,height))||(w.mission.platforms||[]).some(p=>inside(p,x,y,r)&&z+foot<p.z&&z+height>p.z-8)||(w.mission.ramps||[]).some(p=>inside(p,x,y)&&z+12<rampHeight(p,x,y));}
function shotBlocked(m,x,y,z,r=2){return nearbyObstacles(m,x,y,r).some(o=>structureIntersects(m,o,x,y,z,r))||(m.platforms||[]).some(p=>inside(p,x,y,r)&&z>p.z-8&&z<p.z)||(m.ramps||[]).some(p=>inside(p,x,y,r)&&z<rampHeight(p,x,y));}
function launchPoint(w,p){const end=muzzleOrigin(p),start={x:p.x,y:p.y,z:chassisBounds(p.build).muzzleHeight+(p.altitude||0)},steps=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y,end.z-start.z)/2));for(let i=0;i<=steps;i++){const q={x:start.x+(end.x-start.x)*i/steps,y:start.y+(end.y-start.y)*i/steps,z:start.z+(end.z-start.z)*i/steps};if(shotBlocked(w.mission,q.x,q.y,q.z))return{...q,blocked:true};}return end;}
function clearPath(w,a,b,r=2){
 const m=w.mission,az=r<=3?(a.z??((a.altitude||0)+32)):(a.altitude||0),bz=r<=3?(b.z??((b.altitude||0)+32)):(b.altitude||0);
 if(r<=3){if(staticShotBlocked(m,{...a,z:az},{...b,z:bz},r))return false;if(!m.ramps?.length)return true;}
 const n=Math.max(1,Math.ceil(dist(a,b)/(r<=3?4:22)));for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n,z=az+(bz-az)*i/n;
 if(r<=3?(m.ramps||[]).some(p=>inside(p,x,y,r)&&z<rampHeight(p,x,y)):blocked(w,x,y,r,z))return false;}return true;
}
function routeWaypoint(m,e,target){
 const spine=m.spine;if(!spine)return target;
 const project=p=>{let best=Infinity,index=0;for(let i=1;i<spine.length;i++){const a=spine[i-1],b=spine[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1),d=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);if(d<best){best=d;index=i-1;}}return index;};
 const from=project(e),to=project(target);if(from===to)return target;return spine[from+(to>from?1:0)];
}
function waypoint(w,e,target){if(w.mission.mode==='operation'){if(clearPath(w,e,target,e.r+2))return target;const route=routeWaypoint(w.mission,e,target);if(dist(e,route)>70&&clearPath(w,e,route,e.r+2))return route;const a=Math.atan2(target.y-e.y,target.x-e.x);for(const sign of[1,-1]){const p={x:e.x+Math.cos(a+sign*1.2)*140,y:e.y+Math.sin(a+sign*1.2)*140,altitude:e.altitude};if(clearPath(w,e,p,e.r+2))return p;}return{x:e.x,y:e.y};}if(clearPath(w,e,target,e.r+2))return target;if(e.routeUntil>w.time&&e.route?.length){while(e.route.length>1&&dist(e,e.route[0])<20)e.route.shift();return e.route[0];}e.routeUntil=w.time+1;const size=60,cols=Math.ceil(w.mission.width/size),rows=Math.ceil(w.mission.height/size),sx=clamp(Math.floor(e.x/size),0,cols-1),sy=clamp(Math.floor(e.y/size),0,rows-1),goal={x:clamp(Math.floor(target.x/size),0,cols-1),y:clamp(Math.floor(target.y/size),0,rows-1)},start=sy*cols+sx,open=[{x:sx,y:sy,g:0,f:0,id:start}],seen=new Map([[start,{g:0,parent:-1}]]);let end=-1,tries=0;while(open.length&&tries++<cols*rows){open.sort((a,b)=>b.f-a.f);const a=open.pop();if(a.x===goal.x&&a.y===goal.y){end=a.id;break;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=a.x+dx,y=a.y+dy,id=y*cols+x;if(x<0||y<0||x>=cols||y>=rows)continue;const pt={x:x*size+30,y:y*size+30},from={x:a.x*size+30,y:a.y*size+30};if(blocked(w,pt.x,pt.y,e.r+3)||!clearPath(w,from,pt,e.r+3))continue;const g=a.g+Math.hypot(dx,dy);if(seen.has(id)&&seen.get(id).g<=g)continue;seen.set(id,{g,parent:a.id});open.push({x,y,id,g,f:g+Math.hypot(goal.x-x,goal.y-y)});}}if(end>=0){const route=[];let id=end;while(id!==start&&id>=0){route.unshift({x:(id%cols)*size+30,y:Math.floor(id/cols)*size+30});id=seen.get(id).parent;}while(route.length>1&&clearPath(w,e,route[1],e.r+3))route.shift();e.route=route;return route[0]||target;}e.route=null;return target;}
function move(w,p,vx,vy,dt,r){const bounds=chassisBounds(p.build);if(['sandbox','trial'].includes(w.mission.mode)){p.x+=vx*dt;p.y+=vy*dt;return;}const grounded=(p.altitude||0)<=surfaceAt(w.mission,p.x,p.y,p.altitude||0)+.5;const attempt=(x,y)=>{const current=p.altitude||0,surface=surfaceAt(w.mission,x,y,current),z=grounded&&Math.abs(surface-current)<=14?surface:current;if(!blocked(w,x,y,r,z,bounds.clearance,12*bounds.scale)){p.x=x;p.y=y;p.altitude=z;}};attempt(clamp(p.x+vx*dt,r,w.mission.width-r),p.y);attempt(p.x,clamp(p.y+vy*dt,r,w.mission.height-r));}
const spatialDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.altitude||0)-(b.altitude||0));
function shielded(w,t){return w.players.some(p=>p.hp>0&&(p.activeAbility||p.build.ability)==='shield'&&p.active>0&&spatialDist(p,t)<ABILITIES.shield.radius);}
function hurt(w,t,d,source=t,weapon='hit'){if(w.mission.raid)d*=missionTuning(w.mission.sector-1,w.players.length).damage;
 if(w.time<(t.recoverUntil||0))return;
 const before=t.hp;t.hp=Math.max(0,t.hp-d*.6*(shielded(w,t)?.4:1)*Math.pow(.9,moduleLevel(t,'plating'))*careerModifiers(t).damageReduction);t.recoverUntil=w.time+.3;t.lastHurt=w.time;
 // Replicated presentation event: no changes to damage, shielding or recovery.
 if(before>t.hp){
  w.damageEvents??=[];
  w.damageEvents.push({id:w.id++,x:t.x,y:t.y,z:Math.max((t.altitude||0)+12,Math.min((t.altitude||0)+54,source.z??(t.altitude||0)+35)),amount:Math.round((before-t.hp)*10)/10,target:t.id,kind:'incoming',weapon,sourceX:source.x-(source.vx||0)*.08,sourceY:source.y-(source.vy||0)*.08,life:1});
  if(w.damageEvents.length>64)w.damageEvents.shift();
 }
}

export function setInput(w,id,data){const p=w.players.find(p=>p.id===id);if(!p||!data||typeof data!=='object')return;if(data.upgrade)chooseFieldModule(w,p,data.upgrade);p.input={x:Number.isFinite(data.x)?clamp(data.x,-1,1):0,y:Number.isFinite(data.y)?clamp(data.y,-1,1):0,angle:Number.isFinite(data.angle)?data.angle:0,pitch:Number.isFinite(data.pitch)?clamp(data.pitch,-1.2,1.2):0,leftPressed:!!data.leftPressed||!!p.input?.leftPressed,rightPressed:!!data.rightPressed||!!p.input?.rightPressed,left:data.left===undefined&&data.right===undefined?!!(RANGED[p.build.equipment[0]]?data.fire:data.melee):!!data.left,right:data.left===undefined&&data.right===undefined?!!(RANGED[p.build.equipment[1]]?data.fire:data.melee):!!data.right,dash:!!data.dash,sprint:!!data.sprint,aiming:!!data.aiming,fly:!!data.fly,fire:!!data.fire,melee:!!data.melee,ability:!!data.ability,auto:!!data.auto,aimPoint:data.aimPoint&&['x','y','z'].every(k=>Number.isFinite(data.aimPoint[k]))?{x:clamp(data.aimPoint.x,p.x-3000,p.x+3000),y:clamp(data.aimPoint.y,p.y-3000,p.y+3000),z:clamp(data.aimPoint.z,-3000,3000)}:null,slot:Number.isInteger(data.slot)&&data.slot>=0&&data.slot<RACK_SIZE?data.slot:undefined};p.lastInput=w.time;}
function beginEncounter(w){const zone=w.mission.zones[w.zoneIndex];w.encounter=true;w.encounterStarted=w.time;const count=4+w.zoneIndex+Math.round((w.players.length-1)*2);for(let i=0;i<count;i++){const type=i%5===0&&w.zoneIndex>0?'tank':(i+zone.variant)%3===0?'gunner':'drone';w.spawn.push({time:w.time+i*.35,type,zone});}if(zone.boss)w.spawn.push({time:w.time+2.5,type:'boss',zone});}
function spawnEnemy(w,type,zone){
 const profile=ENEMY_ROLES[type],ordinary=profile&&type!=='siege',legacy={hunter:'drone',wisp:'gunner',scarab:'tank',rammer:'tank',needle:'gunner',mortar:'tank',mender:'gunner'},physical=ordinary?legacy[type]:type;
 const slots=[[-70,-70],[70,70],[-70,70],[70,-70],[0,-140],[0,140],[-140,0],[140,0]],slot=slots[Math.floor(random(w)*slots.length)];let x=zone.x+(zone.exact?0:slot[0]),y=zone.y+(zone.exact?0:slot[1]);
 const species=zone.elite||type==='boss'?null:ordinary?type:zone.operation?({drone:'hunter',gunner:'wisp',tank:'scarab'}[type]):null,role=species&&ENEMY_ROLES[species],deck=w.mission.platforms?.find(p=>p.zone===zone.id&&p.kind==='deck');
 if(physical==='gunner'&&deck&&!ordinary){x=deck.x+deck.w*.72;y=deck.y+deck.h*.55;}
 const altitude=role?.hover||(!zone.operation&&physical==='gunner'&&deck?deck.z:0),scale=1+(zone.operation?.15:.28)*(w.players.length-1);
 const baseHp=zone.warden?16000*(1+.9*(w.players.length-1)):zone.elite?3600*(1+.65*(w.players.length-1)):(role?.hp||(zone.operation?{drone:90,gunner:65,tank:160,boss:16000}:{drone:70,gunner:110,tank:260,boss:1500})[physical])*scale;
 const hp=(zone.health?zone.health*(1+.65*(w.players.length-1)):baseHp)*(zone.difficulty?.health||1);
 w.enemies.push({raidTarget:zone.raidTarget,id:zone.warden?'cinder-warden':w.id++,type:physical,x,y,altitude:zone.elite?600:altitude,elite:!!zone.elite,landing:!!zone.elite,species,bodyHeight:role?.height,hover:role?.hover||0,hp,max:hp,angle:0,stun:0,windup:0,attackAngle:0,attackPitch:0,attackTarget:null,actionPhase:'idle',actionTime:0,cd:.9+random(w),speed:(zone.elite?175:role?.speed||{drone:265,gunner:175,tank:110,boss:110}[physical])*(zone.difficulty?.speed||1),r:role?.r||(physical==='boss'?46:physical==='tank'?28:18)});
}
function handState(item){return{item,motionCharge:item==='dynamo'?1:0,spin:0,shot:0,shotCount:0,railCharge:0,railCharging:false,triggerHeld:false,meleeTime:0,meleeCount:0,meleeImpactCount:0,meleePending:false,guarding:false,beam:null,flame:null};}
function stepHand(w,owner,index,held,dt){
 let h=owner.hands[index];const item=owner.build.equipment[index];if(h.item!==item)h=owner.hands[index]=handState(item);
 const blocked=owner.moveKind==='dash'&&owner.moveTime>0,pressed=!!owner.input?.[index?'rightPressed':'leftPressed']||(held&&!h.triggerHeld);
 const p={...owner,...h,weapon:item,melee:item,hand:index,triggerHeld:held},selected=item,input={fire:!blocked&&(held||pressed),melee:!blocked&&(held||pressed)},f=combatStats(owner);
 p.shot=p.shot>0?p.shot-dt:0;p.meleeTime=p.meleeTime>0?p.meleeTime-dt:0;p.guarding=item==='guard'&&held&&!blocked;p.beam=p.flame=null;
p.spin=selected==='rotary'?clamp((p.spin||0)+(input.fire?dt/.6:-dt/.25),0,1):0;
// Click commits one charge; holding repeats after recovery. Dash/death cancel a charge.
if(selected!=='rail'||blocked){p.railCharge=0;p.railCharging=false;}
let railReady=false;
if(selected==='rail'&&!blocked){
 if((pressed||held)&&p.shot<=1e-6&&!p.railCharging){p.railCharging=true;p.railCharge=0;}
 if(p.railCharging){p.railCharge=Math.min(1,p.railCharge+dt/RANGED.rail.charge);railReady=p.railCharge>=1-1e-9;}
}
while((selected==='rail'?railReady:input.fire)&&RANGED[selected]&&selected!=='phaser'&&selected!=='flamer'&&p.shot<=1e-6&&(!RANGED[selected].moveRecharge||p.motionCharge>=1-1e-9)){if(RANGED[selected].moveRecharge)p.motionCharge=0;p.railCharge=0;p.railCharging=false;const g=RANGED[p.weapon],origin=launchPoint(w,p),direction=firingDirection(p,origin),baseAngle=Math.atan2(direction.y,direction.x),basePitch=Math.asin(direction.z),salvo=w.id,seekTarget=g.seeker?rocketTarget(w,origin,direction,g.range):null;p.shot=(selected==='rail'?0:p.shot)+g.rate*(selected==='rotary'?1+(1-p.spin)*.5:1);p.shotCount=(p.shotCount||0)+1;for(let j=0;j<g.pellets;j++){const angle=baseAngle+(g.pellets>1?[-.014,-.007,0,.007,.014,-.18,-.09,.09,.18][j]:Math.sin(p.shotCount*2.4)*(g.spread||0)*(selected==='rotary'?1-.78*p.spin:1)),pitch=basePitch+(g.pellets>1?(j<5?0:(j%2?-.04:.04)):0),horizontal=g.speed*Math.cos(pitch);w.bullets.push({id:w.id++,owner:p.id,hand:index,kind:p.weapon,salvo,seekTarget,x:origin.x,y:origin.y,z:origin.z,origin:{x:origin.x,y:origin.y,z:origin.z},born:w.time,blockedAtLaunch:!!origin.blocked,splash:g.splash||0,stun:g.stun||0,vx:Math.cos(angle)*horizontal,vy:Math.sin(angle)*horizontal,vz:Math.sin(pitch)*g.speed,life:g.range/g.speed,damage:g.damage,enemy:false,rail:p.weapon==='rail',pierce:g.pierce||1,hit:[]});}}
p.beam=null;if(selected==='phaser'&&input.fire){const weapon=RANGED.phaser,origin=launchPoint(w,p),direction=firingDirection(p,origin),dx=direction.x,dy=direction.y,dz=direction.z;let target=null,end={...origin};for(let d=0;d<=weapon.range;d+=5){end={x:origin.x+dx*d,y:origin.y+dy*d,z:origin.z+dz*d};if(origin.blocked||end.z<0||shotBlocked(w.mission,end.x,end.y,end.z))break;target=w.enemies.find(e=>e.hp>0&&Math.hypot(e.x-end.x,e.y-end.y)<e.r+2&&end.z>=(e.altitude||0)&&end.z<(e.altitude||0)+(e.bodyHeight??(e.type==='boss'?108:e.type==='tank'?75:58)));if(target)break;}p.beam={...end,origin:{x:origin.x,y:origin.y,z:origin.z},blocked:!!origin.blocked,hit:!!target};if(p.shot<=1e-6){p.shot+=weapon.rate;p.shotCount++;if(!target&&!origin.blocked)damageStructureAt(w,end,weapon.damage,'phaser');if(target){const dealt=damageEnemy(w,target,weapon.damage,p.id,'phaser');p.hp=Math.min(f.hp,p.hp+dealt*weapon.leech);p.hits++;p.hitTime=w.time;}}}
p.flame=null;if(selected==='flamer'&&input.fire){const g=RANGED.flamer,origin=launchPoint(w,p),direction=firingDirection(p,origin);let length=g.range;for(let d=0;d<=g.range;d+=4){if(origin.blocked||origin.z+direction.z*d<0||shotBlocked(w.mission,origin.x+direction.x*d,origin.y+direction.y*d,origin.z+direction.z*d)){length=d;break;}}p.flame={origin,direction,length,hit:false};if(p.shot<=1e-6){p.shot=(selected==='rail'?0:p.shot)+g.rate;p.shotCount++;if(!origin.blocked)damageStructureArea(w,{...origin,z:origin.z},length,g.damage,'flamer',p.angle,.3);if(!origin.blocked)for(const e of w.enemies){const dx=e.x-origin.x,dy=e.y-origin.y,dz=(e.altitude||0)+30-origin.z,along=dx*direction.x+dy*direction.y+dz*direction.z,radial=Math.sqrt(Math.max(0,dx*dx+dy*dy+dz*dz-along*along));if(e.hp>0&&along>0&&along<=g.range&&radial<8+along*.22+e.r&&clearPath(w,origin,e)){damageEnemy(w,e,g.damage*(1-.45*Math.max(0,(along-80)/100)),p.id,'flamer');if(e.hp>0){e.burnUntil=w.time+1.25;e.burnOwner=p.id;e.burnNext??=w.time+.25;}p.hits++;p.hitTime=w.time;p.flame.hit=true;}}}}

if(input.melee&&MELEE[item]&&item!=='guard'&&p.meleeTime<=1e-6){p.meleeTime+=MELEE[item].rate;p.meleeCount++;p.meleePending=true;}
const g=MELEE[item];if(g&&p.meleePending&&p.meleeTime<=g.rate*(1-STRIKES[item])){
 const floor=surfaceAt(w.mission,p.x,p.y,p.altitude||0);
 if(item==='hammer'&&(p.altitude||0)>floor+8){p.slamDiving=true;p.meleeTime=g.rate*(1-STRIKES[item]);}
 else{p.slamDiving=false;p.meleePending=false;p.meleeImpactCount++;const direct=[];
 if(w.destruction)damageStructureArea(w,{x:p.x,y:p.y,z:(p.altitude||0)+32},item==='hammer'?220:g.range,g.damage,item,p.angle,item==='hammer'?Math.PI:g.arc);
 for(const e of w.enemies){const angle=Math.atan2(e.y-p.y,e.x-p.x)-p.angle,delta=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));if(e.hp>0&&dist(p,e)<g.range*chassisFor(p.build).scale+e.r&&delta<=g.arc&&Math.abs((p.altitude||0)-(e.altitude||0))<Math.max(e.type==='boss'?108:65,65*chassisFor(p.build).scale)&&clearPath(w,p,e)){damageEnemy(w,e,g.damage,p.id,'melee');direct.push(e.id);p.hits++;p.hitTime=w.time;if(item==='lance')staggerEnemy(w,e,.4);if(item==='scythe'&&!e.training&&!e.objective){const d=dist(p,e),pull=Math.min(70,Math.max(0,d-45));move(w,e,(p.x-e.x)/d*pull,(p.y-e.y)/d*pull,1,e.r);}}}
 if(item==='claws'&&direct.length)p.hp=Math.min(f.hp,p.hp+3);
 if(item==='blade'){const origin={x:p.x+Math.cos(p.angle)*35,y:p.y+Math.sin(p.angle)*35,z:(p.altitude||0)+32},direction=firingDirection(p,origin);w.bullets.push({id:w.id++,owner:p.id,hand:index,kind:'bladeWave',...origin,origin:{...origin},vx:direction.x*1000,vy:direction.y*1000,vz:direction.z*1000,life:.5,damage:90,enemy:false,pierce:12,width:80,hit:direct});}
 if(item==='hammer'){w.effects.push({id:w.id++,x:p.x,y:p.y,z:floor+3,r:220,kind:'plasmaSlam',life:.65,max:.65});for(const e of w.enemies){const distance=dist(p,e);if(e.hp>0&&distance<220&&Math.abs((e.altitude||0)-floor)<60&&clearPath(w,p,e)){if(!direct.includes(e.id))damageEnemy(w,e,160*(1-.35*distance/220),p.id,'hammer');staggerEnemy(w,e,.55);p.hits++;p.hitTime=w.time;}}}
 }
}
owner.hp=p.hp;owner.hits=p.hits;owner.hitTime=p.hitTime;for(const key of['shot','shotCount','spin','motionCharge','railCharge','railCharging','triggerHeld','meleeTime','meleeCount','meleeImpactCount','meleePending','slamDiving','guarding','beam','flame'])h[key]=p[key];
}
function rocketTarget(w,origin,dir,range){let target=null,best=.975;for(const e of w.enemies){const dx=e.x-origin.x,dy=e.y-origin.y,dz=(e.altitude||0)+32-origin.z,d=Math.hypot(dx,dy,dz),dot=(dx*dir.x+dy*dir.y+dz*dir.z)/(d||1);if(e.hp>0&&d<range&&dot>best&&clearPath(w,origin,e)){target=e.id;best=dot;}}return target;}
function guideRocket(w,b,dt){if(b.seekTarget==null)return;const e=w.enemies.find(e=>e.id===b.seekTarget&&e.hp>0);if(!e||!clearPath(w,b,e)){b.seekTarget=null;return;}const speed=Math.hypot(b.vx,b.vy,b.vz||0),dx=e.x-b.x,dy=e.y-b.y,dz=(e.altitude||0)+32-b.z,d=Math.hypot(dx,dy,dz),dot=(dx*b.vx+dy*b.vy+dz*(b.vz||0))/(d*speed||1);if(dot<.5){b.seekTarget=null;return;}const angle=Math.acos(clamp(dot,-1,1)),mix=Math.min(1,dt*1.2/Math.max(angle,.0001)),vx=b.vx/speed*(1-mix)+dx/d*mix,vy=b.vy/speed*(1-mix)+dy/d*mix,vz=(b.vz||0)/speed*(1-mix)+dz/d*mix,n=Math.hypot(vx,vy,vz);b.vx=vx/n*speed;b.vy=vy/n*speed;b.vz=vz/n*speed;}
function weaponHit(w,b,e){
 const gun=WEAPONS[b.kind],height=e.bodyHeight??(e.type==='boss'?108:e.type==='tank'?75:58),critical=gun?.precision&&b.z>=(e.altitude||0)+height*.78;
 damageEnemy(w,e,b.damage*(critical?gun.precision:1),b.owner,critical?'precision':b.kind||'hit');
 if(b.kind==='rail')staggerEnemy(w,e,.22);
 if(b.kind==='scatter'&&dist(b.origin||b,e)<180&&e.scatterSalvo!==b.salvo){e.scatterSalvo=b.salvo;staggerEnemy(w,e,.2);if(!e.training&&!e.objective){const d=Math.hypot(b.vx,b.vy)||1;move(w,e,b.vx/d*28,b.vy/d*28,1,e.r);}}
 if(b.kind==='plasma'){
  e.plasmaHits=(w.time<(e.plasmaUntil||0)?e.plasmaHits||0:0)+1;e.plasmaUntil=w.time+1.5;
  if(e.plasmaHits>=4){e.plasmaHits=0;const at={x:e.x,y:e.y,z:(e.altitude||0)+32};w.effects.push({id:w.id++,...at,r:150,kind:'explosion',weapon:'plasma',life:.65,max:.65});for(const other of w.enemies)if(other.hp>0&&Math.hypot(other.x-at.x,other.y-at.y,(other.altitude||0)+32-at.z)<150&&clearPath(w,at,other)){damageEnemy(w,other,36,b.owner,'overload');staggerEnemy(w,other,.3);}}
 }
}
function stepWeaponStatus(w,e){
 if(e.hp<=0){e.burnUntil=0;e.burnNext=null;e.plasmaHits=0;return;}
 if(w.time>=(e.plasmaUntil||0))e.plasmaHits=0;
 while(e.burnNext!=null&&e.burnNext<=w.time+1e-9&&e.burnNext<=(e.burnUntil||0)+1e-9&&e.hp>0){damageEnemy(w,e,6,e.burnOwner,'burn');e.burnNext+=.25;}
 if(w.time>=(e.burnUntil||0)){e.burnUntil=0;e.burnNext=null;}
}
function bulletTouches(w,b,e){if(b.kind!=='bladeWave')return dist(e,b)<e.r+4;const length=Math.hypot(b.vx,b.vy)||1,dx=e.x-b.x,dy=e.y-b.y;return Math.abs((dx*b.vx+dy*b.vy)/length)<e.r+8&&Math.abs((-dx*b.vy+dy*b.vx)/length)<e.r+b.width&&clearPath(w,b.origin,e);}
// Host-only perception is sampled rather than reading future player input.
function rivalObserve(w,e){
 const alive=w.players.filter(p=>p.hp>0);e.observations??=[];
 if(w.time>=(e.observeAt||0)){
  e.observeAt=w.time+.16;
  e.observations=alive.map(p=>{const old=e.observations.find(q=>q.id===p.id),elapsed=old?w.time-old.at:0;
   return{id:p.id,x:p.x,y:p.y,z:p.altitude+30,at:w.time,vx:elapsed?clamp((p.x-old.x)/elapsed,-750,750):0,vy:elapsed?clamp((p.y-old.y)/elapsed,-750,750):0,vz:elapsed?clamp((p.altitude+30-old.z)/elapsed,-210,220):0};});
  const score=p=>spatialDist(p,e)*(p.guarding?1.2:1)*(p.id===e.targetId?.72:1)*(p.id===e.lastAttacker&&w.time-e.lastDamaged<2?.7:1);
  const committed=(e.windup>0||e.burst>0)&&alive.find(p=>p.id===e.targetId);const selected=committed||alive.sort((a,b)=>score(a)-score(b))[0];e.targetId=selected?.id;
 }
 return alive.find(p=>p.id===e.targetId)||alive[0];
}
function rivalAim(w,e,target){
 const seen=e.observations.find(q=>q.id===target.id)||{x:target.x,y:target.y,z:target.altitude+30,vx:0,vy:0,vz:0,at:w.time},age=Math.min(.2,w.time-seen.at);
 const dx=seen.x+seen.vx*age-e.x,dy=seen.y+seen.vy*age-e.y,dz=seen.z+seen.vz*age-e.altitude-38,a=seen.vx**2+seen.vy**2+seen.vz**2-1100**2,b=2*(dx*seen.vx+dy*seen.vy+dz*seen.vz),c=dx*dx+dy*dy+dz*dz,disc=b*b-4*a*c;
 const intercept=Math.abs(a)>1&&disc>=0?(-b-Math.sqrt(disc))/(2*a):Math.sqrt(c)/1100,travel=clamp(intercept,0,.9),lead=age+travel*.97;
 return{x:seen.x+seen.vx*lead,y:seen.y+seen.vy*lead,z:clamp(seen.z+seen.vz*lead,20,275)};
}
function stepRival(w,e,dt){
 e.shot=Math.max(0,e.shot-dt);e.meleeTime=Math.max(0,e.meleeTime-dt);e.stun=Math.max(0,e.stun-dt);
 e.dashTime=Math.max(0,(e.dashTime||0)-dt);e.dashCd=Math.max(0,(e.dashCd||0)-dt);
 if(e.hp<=0||e.stun>0){e.windup=0;e.burst=0;e.dashTime=0;e.dodgeAt=0;e.boosting=e.airborne=false;e.altitude=Math.max(0,e.altitude-160*dt);return;}
 const target=rivalObserve(w,e);if(!target)return;
 const d=dist(e,target),angle=Math.atan2(target.y-e.y,target.x-e.x);e.cd-=dt;e.boosting=false;

 if(w.time>=(e.tacticAt||0)){e.tacticAt=w.time+.8+random(w)*.6;e.strafeSign=random(w)<.5?-1:1;}
 const shortRange=target.build.equipment.slice(0,2).every(id=>MELEE[id]||id==='flamer'||id==='scatter');
 const opening=target.hands.some(h=>h.shot>.45||h.railCharge>.3),rush=!shortRange&&!target.guarding&&(opening||e.hp/e.max>.45&&d<190);
 e.intent=target.guarding?'FLANKING':shortRange?'KEEPING RANGE':rush?'PRESSING':'STRAFING';
 // React to a visible, approaching shot after 140ms; never dodge continuously.
 if(!e.dashCd&&!e.dodgeAt&&e.attackKind!=='melee'){
  const threat=w.bullets.find(b=>{if(b.enemy||dist(b,e)>750)return false;const vx=b.vx-(e.boostX||0)*e.speed,vy=b.vy-(e.boostY||0)*e.speed,vz=b.vz||0,dx=e.x-b.x,dy=e.y-b.y,dz=e.altitude+30-(b.z||0),t=(dx*vx+dy*vy+dz*vz)/(vx*vx+vy*vy+vz*vz||1);return t>.12&&t<.65&&Math.hypot(dx-vx*t,dy-vy*t,dz-vz*t)<50+(b.splash||0)*.5;});
  if(threat){e.dodgeAt=w.time+.14;e.dodgeAngle=Math.atan2(threat.vy,threat.vx)+e.strafeSign*Math.PI/2;}
 }
 if(e.dodgeAt&&w.time>=e.dodgeAt){e.dodgeAt=0;e.dashTime=.28;e.dashCd=1.65;e.dashAngle=e.dodgeAngle;}
 const preferred=target.guarding?190:shortRange?360:rush?65:260,radial=clamp((d-preferred)/110,-1,1),side=e.strafeSign*(d<100&&!target.guarding?.15:target.guarding?1.2:.72),length=Math.max(1,Math.hypot(radial,side));
 let vx=(Math.cos(angle)*radial-Math.sin(angle)*side)/length,vy=(Math.sin(angle)*radial+Math.cos(angle)*side)/length,speed=e.speed;
 if(d>600&&!e.dashCd&&!e.windup&&!e.burst){e.dashTime=.38;e.dashCd=1.65;e.dashAngle=angle;}
 if(e.dashTime>0){vx=Math.cos(e.dashAngle);vy=Math.sin(e.dashAngle);speed*=1.65;e.intent='EVADING';}
 if(e.windup>0&&e.attackKind==='melee'){vx=Math.cos(e.attackAngle);vy=Math.sin(e.attackAngle);speed*=e.windup>.2&&d>65?1.35:0;}
 else if(e.meleeTime>0){speed*=.35;e.intent='RECOVERING';}
 e.boostX=vx;e.boostY=vy;e.boosting=speed*Math.hypot(vx,vy)>10;move(w,e,vx*speed,vy*speed,dt,e.r);
 const desiredAltitude=clamp(target.altitude+(shortRange&&d<400?60:target.guarding?45:0),0,240);
 e.altitude=clamp(e.altitude+clamp(desiredAltitude-e.altitude,-190*dt,190*dt),0,240);e.airborne=e.altitude>1||desiredAltitude>1;
 if(!e.windup&&!e.burst&&w.time>=AI_ARM_TIME&&e.cd<=0&&d<1000){e.attackTarget=target.id;e.attackAngle=angle;e.attackKind=d<145&&Math.abs(target.altitude-e.altitude)<55?'melee':'ranged';e.windup=e.attackKind==='melee'?.46:.44;e.attackPoint=rivalAim(w,e,target);if(e.attackKind==='melee'){e.meleeTime=.8;e.meleeCount++;}}
 if(e.windup>0){
  if(e.attackKind==='ranged'&&e.windup>.16)e.attackPoint=rivalAim(w,e,target);
  e.windup=Math.max(0,e.windup-dt);
  if(e.windup===0){if(e.attackKind==='melee'){
   const t=w.players.find(p=>p.id===e.attackTarget),delta=t?Math.atan2(t.y-e.y,t.x-e.x)-e.attackAngle:Math.PI;
   if(t?.hp>0&&dist(e,t)<145&&Math.abs(t.altitude-e.altitude)<60&&Math.cos(delta)>.45&&clearPath(w,e,t))hurt(w,t,e.species?18:32,e,'melee');
   e.cd=.85;e.attackKind=null;
  }else{e.burst=4;e.burstTimer=0;e.cd=1.15;}}
 }
 if(e.burst){e.burstTimer-=dt;if(e.burstTimer<=0){e.burst--;e.burstTimer=.18;e.shot=.12;e.shotCount++;e.attackPoint=rivalAim(w,e,target);
  e.angle=Math.atan2(e.attackPoint.y-e.y,e.attackPoint.x-e.x);e.pitch=Math.atan2(e.attackPoint.z-e.altitude-38,Math.hypot(e.attackPoint.x-e.x,e.attackPoint.y-e.y));
  const origin=muzzleOrigin({...e,hand:1}),direction=firingDirection({...e,aimPoint:e.attackPoint},origin);
  w.bullets.push({id:w.id++,owner:e.id,hand:1,kind:'carbine',origin,...origin,vx:direction.x*1100,vy:direction.y*1100,vz:direction.z*1100,life:1.25,enemy:true,damage:18});
 }}
 const aim=e.attackKind==='melee'&&e.windup>0?{x:e.x+Math.cos(e.attackAngle)*100,y:e.y+Math.sin(e.attackAngle)*100,z:target.altitude+30}:e.windup>0||e.burst?e.attackPoint:rivalAim(w,e,target);
 e.angle=Math.atan2(aim.y-e.y,aim.x-e.x);e.pitch=Math.atan2(aim.z-e.altitude-38,Math.hypot(aim.x-e.x,aim.y-e.y));e.attackAngle=e.attackKind==='melee'&&e.windup>0?e.attackAngle:e.angle;e.attackPitch=e.pitch;
}
// Ground robots cannot step sideways from a raised deck into the footprint of cargo.
// Flyers retain altitude-aware collision; existing ground collision still resolves slabs/ramps.
// Destructible maps use move's live fragment collision so breached openings remain traversable.
function moveEnemy(w,e,vx,vy,dt,r){
 const crosses=(x,y)=>!e.hover&&!w.mission.destructible&&nearbyObstacles(w.mission,x,y,r).some(o=>inside(o,x,y,r)&&!inside(o,e.x,e.y,r));
 if(!crosses(e.x+vx*dt,e.y))move(w,e,vx,0,dt,r);
 if(!crosses(e.x,e.y+vy*dt))move(w,e,0,vy,dt,r);
}
const enemyAPI={move:moveEnemy,waypoint,clear:clearPath,hurt,floor:(w,x,y,z)=>surfaceAt(w.mission,x,y,z),aimHeight:p=>chassisBounds(p.build).aimHeight};
export function step(w,dt){if(w.status!=='playing')return;dt=clamp(dt,0,.05);w.time+=dt;stepTeamCombos(w);w.damageEvents=(w.damageEvents||[]).filter(e=>(e.life-=dt)>0);w.effects=w.effects.filter(e=>(e.life-=dt)>0);if(w.operation)stepOperation(w,dt,statsForPlayer);if(w.siege)stepDestructionMission(w,dt,statsForPlayer,event=>{
 for(const e of w.enemies){const d=Math.hypot(e.x-event.x,e.y-event.y,(e.altitude||0)+32-event.z);if(e.hp>0&&d<event.r&&clearPath(w,event,e))damageEnemy(w,e,180*(1-d/event.r),null,'fuel');}
 if(w.mission.variant==='level')for(const p of w.players){const d=Math.hypot(p.x-event.x,p.y-event.y,(p.altitude||0)+32-event.z);if(p.hp>0&&d<event.r&&clearPath(w,event,p))hurt(w,p,65*(1-d/event.r));}
});if(w.status!=='playing')return;if(!w.operation&&!w.siege&&!w.encounter&&w.zoneIndex<w.mission.zones.length&&w.players.some(p=>p.hp>0&&dist(p,w.mission.zones[w.zoneIndex])<290))beginEncounter(w);if(w.spawn.length){const due=w.spawn.filter(s=>s.time<=w.time);w.spawn=w.spawn.filter(s=>s.time>w.time);for(const s of due)spawnEnemy(w,s.type,s.zone);}
for(const p of w.players){const career=careerModifiers(p);p.shot=Math.max(0,p.shot-dt);p.meleeTime=Math.max(0,(p.meleeTime||0)-dt);p.abilityCd=Math.max(0,p.abilityCd-dt*career.specialRecharge*(1+.25*moduleLevel(p,'capacitor')));p.dashCd=Math.max(0,(p.dashCd||0)-dt*career.dashRecharge*(1+.1*moduleLevel(p,'thrusters')));p.active=Math.max(0,p.active-dt);p.energy=p.energy??100;if(w.time-p.lastInput>.7)p.input={};if(p.hp<=0){p.moveTime=0;p.moveKind=null;p.guarding=false;for(const h of p.hands||[]){h.guarding=false;h.flame=h.beam=null;h.spin=0;h.railCharge=0;h.railCharging=false;h.triggerHeld=false;h.meleePending=h.slamDiving=false;h.meleeTime=0;}p.flame=null;p.railCharge=0;p.beam=null;const floor=surfaceAt(w.mission,p.x,p.y,p.altitude||0);p.altitude=Math.max(floor,(p.altitude||0)-210*dt);p.airborne=false;p.boosting=false;p.boostX=p.boostY=0;const ally=w.players.some(a=>a!==p&&a.hp>0&&spatialDist(a,p)<95);p.revive=ally?p.revive+dt:Math.max(0,p.revive-dt);if(p.revive>=3){p.hp=combatStats(p).hp*.4;p.revive=0;effect(w,p.x,p.y,90,'#a7cbbd');}continue;}const input=p.input||{},f=combatStats(p),bounds=chassisBounds(p.build),motionStart={x:p.x,y:p.y,z:p.altitude||0};
if(w.time-(p.lastHurt??-10)>7)p.hp=Math.min(f.hp,p.hp+((w.operation?4+2*moduleLevel(p,'repair'):0)+career.repair)*dt);if(!(p.moveTime>0)){p.moveKind=null;const kind=input.dash&&p.dashCd<=0?'dash':null;if(kind){const action=COMBAT_MOVES[kind],moving=Math.hypot(input.x||0,input.y||0)>.1,direction=moving?Math.atan2(input.y,input.x):input.angle||0;p.moveKind=kind;p.moveTime=action.duration;p[kind+'Cd']=action.cd;p.moveAngle=direction;p.movePitch=moving?0:input.pitch||0;p.moveCount=(p.moveCount||0)+1;p.dashHits=[];}}
const special=specialFor(p),a=ABILITIES[special];p.hands??=p.build.equipment.slice(0,2).map(handState);p.guarding=false;let ix=input.x||0,iy=input.y||0;const l=Math.hypot(ix,iy);if(l>1){ix/=l;iy/=l;}p.boosting=l>0;p.boostX=p.boosting?ix:0;p.boostY=p.boosting?iy:0;p.energy=clamp(p.energy+((p.altitude||0)>surfaceAt(w.mission,p.x,p.y,p.altitude||0)+.5||input.fly?0:f.recharge)*dt,0,f.energy);const flying=!!input.fly;p.airborne=flying;p.altitude=p.altitude||0;const surface=surfaceAt(w.mission,p.x,p.y,p.altitude);if(p.moveTime>0){p.airborne=p.altitude>1;}else if(flying){let next=Math.min(240,p.altitude+f.lift*dt);for(const originalRoof of nearbyObstacles(w.mission,p.x,p.y,bounds.radius))for(const roof of structureBoxes(w.mission,originalRoof))if(roof.baseZ&&inside(roof,p.x,p.y,bounds.radius)&&p.altitude+bounds.clearance<=roof.baseZ+.1&&next+bounds.clearance>roof.baseZ)next=Math.min(next,roof.baseZ-bounds.clearance);for(const deck of w.mission.platforms||[])if(inside(deck,p.x,p.y,bounds.radius)&&p.altitude+bounds.clearance<=deck.z-8+.1&&next+bounds.clearance>deck.z-8)next=Math.min(next,deck.z-8-bounds.clearance);p.altitude=Math.max(p.altitude,next);}else p.altitude=Math.max(surface,p.altitude-210*dt);if(p.hands.some(h=>h.slamDiving)){p.altitude=Math.max(surface,p.altitude-650*dt);p.airborne=false;}const speed=(p.boosting?f.speed*f.boost:f.walkSpeed);if(p.moveTime>0){
 const action=COMBAT_MOVES[p.moveKind],travel=action.speed*Math.min(dt,p.moveTime),steps=Math.max(1,Math.ceil(travel/6)),dx=Math.cos(p.moveAngle)*Math.cos(p.movePitch||0),dy=Math.sin(p.moveAngle)*Math.cos(p.movePitch||0),dz=Math.sin(p.movePitch||0);
 p.boosting=true;p.boostX=dx;p.boostY=dy;
 for(let i=0;i<steps;i++){move(w,p,dx*travel/steps,dy*travel/steps,1,bounds.radius);const next=clamp(p.altitude+dz*travel/steps,0,240);if(!blocked(w,p.x,p.y,bounds.radius,next,bounds.clearance,12*bounds.scale))p.altitude=Math.max(surfaceAt(w.mission,p.x,p.y,p.altitude),next);
  if(p.moveKind==='dash')for(const e of w.enemies)if(e.hp>0&&!p.dashHits.includes(e.id)&&dist(p,e)<e.r+32*bounds.scale&&Math.abs(p.altitude-(e.altitude||0))<bounds.clearance&&clearPath(w,p,e)){p.dashHits.push(e.id);damageEnemy(w,e,action.damage,p.id,'dash');staggerEnemy(w,e,.45);p.hits++;p.hitTime=w.time;}
 }
 p.moveTime=Math.max(0,p.moveTime-dt);
}else move(w,p,ix*speed,iy*speed,dt,bounds.radius);p.angle=input.angle||0;p.pitch=input.pitch||0;p.aimPoint=input.aimPoint||null;if(a&&input.ability&&p.abilityCd<=0){p.activeAbility=special;p.abilityCd=a.cd;p.active=a.duration;effect(w,p.x,p.y,a.radius,p.activeAbility==='emp'?'#8bcde6':'#b5e2be',1.1,'system');if(p.activeAbility==='emp')for(const e of w.enemies)if(spatialDist(p,e)<a.radius){e.stun=4;if(e.behavior)cancelEnemyAction(e);damageEnemy(w,e,45,p.id,'emp');e.windup=0;}}
if(p.active>0&&(p.activeAbility||p.build.ability)==='repair'){for(const target of w.players)if(target.hp>0&&spatialDist(p,target)<ABILITIES.repair.radius){const max=combatStats(target).hp;const overlaps=w.players.filter(q=>q.hp>0&&q.active>0&&(q.activeAbility||q.build.ability)==='repair'&&spatialDist(q,target)<ABILITIES.repair.radius).length;target.hp=Math.min(max,target.hp+dt*12/Math.max(1,overlaps));}}
const poweredVertical=p.moveKind==='dash'?Math.abs((p.altitude||0)-motionStart.z):input.fly?Math.max(0,(p.altitude||0)-motionStart.z):0,travelled=Math.hypot(p.x-motionStart.x,p.y-motionStart.y,poweredVertical);
for(const h of p.hands)if(WEAPONS[h.item]?.moveRecharge)h.motionCharge=Math.min(1,(h.motionCharge||0)+travelled/WEAPONS[h.item].moveRecharge);
for(let index=0;index<2;index++)stepHand(w,p,index,index===0?input.left:input.right,dt);
input.leftPressed=input.rightPressed=false;
p.guarding=p.hands.some(h=>h.guarding);const gun=p.hands.find(h=>RANGED[h.item]),melee=p.hands.find(h=>MELEE[h.item]);p.weapon=gun?.item||p.build.weapon;p.melee=melee?.item||p.build.melee;p.shot=gun?.shot||0;p.railCharge=Math.max(...p.hands.map(h=>h.railCharge||0));p.flame=p.hands.find(h=>h.flame)?.flame||null;p.beam=p.hands.find(h=>h.beam)?.beam||null;p.meleeTime=melee?.meleeTime||0;p.shotCount=p.hands.reduce((n,h)=>n+h.shotCount,0);p.meleeCount=p.hands.reduce((n,h)=>n+h.meleeCount,0);p.meleeImpactCount=p.hands.reduce((n,h)=>n+(h.meleeImpactCount||0),0);
}


coordinateEnemies(w);
for(const e of w.enemies){stepWeaponStatus(w,e);if(e.objective)continue;if(e.landing){e.altitude=Math.max(surfaceAt(w.mission,e.x,e.y,e.altitude),e.altitude-340*dt);if(e.altitude<=surfaceAt(w.mission,e.x,e.y,e.altitude)+.1){e.landing=false;e.landedAt=w.time;e.cd=1.4;w.effects.push({id:w.id++,kind:'explosion',weapon:'landing',x:e.x,y:e.y,z:e.altitude+3,r:200,life:1.2,max:1.2});for(const p of w.players)if(p.hp>0&&dist(p,e)<170&&Math.abs((p.altitude||0)-e.altitude)<70)hurt(w,p,70,e,'blast');}continue;}if(e.type==='rival'){stepRival(w,e,dt);continue;}if(e.training){e.stun=Math.max(0,e.stun-dt);if(e.hp<=0&&e.respawn!=null){e.respawn=Math.max(0,e.respawn-dt);if(e.respawn===0){e.hp=e.max;e.respawn=null;}}continue;}stepEnemy(w,e,dt,enemyAPI);}
stepEnemyHazards(w,dt,enemyAPI);

for(const b of w.bullets){if(b.kind==='launcher')guideRocket(w,b,dt);if(b.blockedAtLaunch){b.life=0;continue;}const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy,b.vz||0)*dt/6));for(let i=0;i<steps&&b.life>0;i++){b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;b.z=(b.z??38)+(b.vz||0)*dt/steps;b.life-=dt/steps;if(b.z<0||shotBlocked(w.mission,b.x,b.y,b.z)){if(!b.splash&&b.z>=0)damageStructureAt(w,b,b.damage,b.kind||'bullet');b.life=0;effect(w,b.x,b.y,12,'#a7cbbd',.13);break;}if(b.enemy){for(const p of w.players)if(p.hp>0&&b.z>=(p.altitude||0)&&b.z<(p.altitude||0)+chassisBounds(p.build).height&&(dist(p,b)<chassisBounds(p.build).radius||blocksBullet(p,b))){const blocked=p.guarding&&blocksBullet(p,b);hurt(w,p,b.damage*(blocked?1-BULWARK.reduction:1),b,blocked?'guard':'bullet');if(blocked)p.guardHitTime=w.time;b.life=0;effect(w,b.x,b.y,18,'#ee7950',.2);break;}}else{for(const e of w.enemies)if(e.hp>0&&b.z>=(e.altitude||0)&&b.z<(e.altitude||0)+(e.bodyHeight??(e.type==='boss'?108:e.type==='tank'?75:58))&&!b.hit.includes(e.id)&&bulletTouches(w,b,e)){if(!b.splash)weaponHit(w,b,e);const owner=w.players.find(p=>p.id===b.owner);if(owner){owner.hits=(owner.hits||0)+1;owner.hitTime=w.time;}b.hit.push(e.id);b.pierce--;effect(w,b.x,b.y,18,e.stun>0?'#90d8ed':'#ffad7b',.2);if(b.pierce<=0){b.life=0;break;}}}}}
for(const b of w.bullets)if(b.splash&&b.life<=0){damageStructureArea(w,b,b.splash,b.damage,b.kind||'blast');w.effects.push({id:w.id++,x:b.x,y:b.y,z:b.z,r:b.splash,color:b.kind==='plasma'?'#b38aff':'#ffc46b',kind:'explosion',weapon:b.kind,life:b.kind==='plasma'?.95:.8,max:b.kind==='plasma'?.95:.8});for(const e of w.enemies){const d=Math.hypot(e.x-b.x,e.y-b.y,(e.altitude||0)+32-b.z);if(e.hp>0&&d<b.splash&&clearPath(w,b,e)){damageEnemy(w,e,b.damage*(b.hit?.includes(e.id)?1:1-.65*d/b.splash),b.owner,b.kind||'blast');if(b.stun)staggerEnemy(w,e,b.stun);const p=w.players.find(p=>p.id===b.owner);if(p){p.hits++;p.hitTime=w.time;}}}}
w.bullets=w.bullets.filter(b=>b.life>0);for(const e of w.enemies)if(e.hp<=0&&(!e.training||e.respawn==null)){w.kills++;rewardDefeat(w,e);effect(w,e.x,e.y,e.type==='boss'?150:48,'#ff784b',.7);if(e.training)e.respawn=2;}w.enemies=w.enemies.filter(e=>e.hp>0||e.training);
if(w.encounter&&!w.operation&&!w.siege)w.hazardTimer-=dt;if(w.hazardTimer<=0&&w.encounter&&!w.operation&&!w.siege){w.hazardTimer=10;const p=w.players[Math.floor(random(w)*w.players.length)];w.hazards.push({x:p.x,y:p.y,r:110,time:1.6});}for(const h of w.hazards){h.time-=dt;if(h.time<=0){for(const p of w.players)if(p.hp>0&&(p.altitude||0)<90&&dist(p,h)<h.r)hurt(w,p,75,h,'blast');for(const e of w.enemies)if(!e.objective&&(e.altitude||0)<90&&dist(e,h)<h.r)e.hp-=200;effect(w,h.x,h.y,h.r,'#ff9166',.8);}}w.hazards=w.hazards.filter(h=>h.time>0);
if(!w.operation&&!w.siege&&w.encounter&&w.enemies.length===0&&w.spawn.length===0){w.encounter=false;w.zoneIndex++;w.cleared=w.zoneIndex;for(const p of w.players)if(p.hp>0){const f=combatStats(p);p.hp=Math.min(f.hp,p.hp+f.hp*.2);p.energy=Math.min(f.energy,p.energy+35);}w.hazards=[];w.hazardTimer=10;}
const survivors=w.players.filter(p=>p.hp>0);if(!w.operation&&!w.siege&&!['sandbox','trial'].includes(w.mission.mode)&&w.cleared===w.mission.zones.length&&survivors.length&&survivors.every(p=>dist(p,w.mission.exit)<160&&(p.altitude||0)<20))w.extractTime+=dt;else if(!w.operation&&!w.siege)w.extractTime=0;
if(!w.operation&&!w.siege&&w.extractTime>=2||w.mission.mode==='trial'&&!w.enemies.length)w.status='won';if(!w.operation&&!w.siege&&!survivors.length)w.status='lost';}
export function snapshot(w,includeMission=true){return{...w,mission:includeMission?w.mission:undefined,players:w.players.map(({input,lastInput,...p})=>p),pendingSpawns:w.spawn.length,pendingDrops:w.operation?w.spawn.map(s=>({time:s.time,zone:s.zone})):[],spawn:[],enemies:w.enemies.map(({route,routeUntil,observations,observeAt,tacticAt,perception,actionHits,teamHits,comboReadyAt,comboFinished,...e})=>e),bullets:w.bullets.map(({hit,...b})=>b)};}
