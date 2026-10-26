import test from 'node:test';
import assert from 'node:assert/strict';
import{newWorld,setInput,snapshot}from '../dist/core.js';
import{chassisBlueprint}from '../dist/chassis.js';
import{MISSIONS,campaignRound}from '../dist/mission-catalog.js';
import{newCampaign,campaignMission,recordSortie,cleanCampaign,profileFor}from '../dist/campaign.js';
import{FIELD_UPGRADES,FIELD_ITEMS,FIELD_RELAYS,FIELD_MODULES,fieldModifiers,fieldOffer,chooseFieldModule,rewardDefeat,interactField,stepField,awardSalvage,sortieReport,cleanSortieReport,xpForLevel}from '../dist/sortie-progression.js';

const make=(team=1,seed=42)=>newWorld(campaignRound('ashgate',seed),Array.from({length:team},(_,i)=>({id:'p'+i,name:'Pilot '+i,build:chassisBlueprint('vanguard')})));
const kill=(w,i=1,options={})=>rewardDefeat(w,{id:'enemy-'+i,type:'drone',x:1300,y:1500,lastHitBy:'p0',...options});
const place=(p,node)=>Object.assign(p,{x:node.x,y:node.y,altitude:node.z});
const node=(w,kind,id,cost=0)=>{const value={id:'test-'+w.field.nodes.length,kind,x:1300,y:1900,z:0,state:'ready',revision:0,cost,claimed:[],...(kind==='cache'?{itemId:id}:{relayId:id})};w.field.nodes.push(value);return value;};

test('54 field technologies have distinct identities, finite combat effects and complete game-facing descriptions',()=>{
 assert.equal(FIELD_MODULES,FIELD_UPGRADES);
 for(const catalogue of[FIELD_UPGRADES,FIELD_ITEMS,FIELD_RELAYS]){
  assert.equal(Object.keys(catalogue).length,18);assert.equal(new Set(Object.values(catalogue).map(e=>e.name)).size,18);
  const signatures=new Set();
  for(const[id,e]of Object.entries(catalogue)){assert.equal(e.id,id);for(const key of['name','role','detail','short','color','icon','rarity'])assert.ok(e[key],id+' missing '+key);assert.ok(e.maxStacks>=1);assert.ok(Object.values(e.effects).every(Number.isFinite));signatures.add(JSON.stringify(e.effects));}
  assert.equal(signatures.size,18,'each technology changes a different combination of mechanics');
 }
 const p={field:{modules:['power'],upgrades:['power','hull'],items:['gyro'],relays:['uplink'],buffs:[{relayId:'assault',expiresAt:60}]}};
 assert.ok(Math.abs(fieldModifiers(p).damage-.64)<1e-9);assert.equal(fieldModifiers(p).maxHull,.15);assert.equal(fieldModifiers(p).precisionDamage,.1);assert.equal(fieldModifiers(p).moveSpeed,.08);
});

test('seeded placements cover all authored arenas without cover overlap or floating deck-edge props',()=>{
 for(const spec of MISSIONS)for(const seed of[1,42,999,63872]){
  const roster=[{id:'p',build:chassisBlueprint('vanguard')}],w=newWorld(campaignRound(spec.id,seed),roster),copy=newWorld(campaignRound(spec.id,seed),roster);
  assert.deepEqual(w.field.nodes,copy.field.nodes);assert.ok(w.field.nodes.filter(n=>n.kind==='cache').length>=4);assert.ok(w.field.nodes.filter(n=>n.kind==='cache').length<=6);assert.ok(w.field.nodes.filter(n=>n.kind==='relay').length>=2);assert.ok(w.field.nodes.filter(n=>n.kind==='relay').length<=4);
  for(const n of w.field.nodes){assert.ok([n.x,n.y,n.z].every(Number.isFinite));assert.ok(!w.mission.obstacles.some(o=>n.x+62>o.x&&n.x-62<o.x+o.w&&n.y+62>o.y&&n.y-62<o.y+o.h));if(n.z)assert.ok(w.mission.platforms.some(p=>p.z===n.z&&n.x>p.x+45&&n.x<p.x+p.w-45&&n.y>p.y+45&&n.y<p.y+p.h-45));}
 }
});

test('living co-op pilots share combat XP, downed pilots do not, and defeat rewards cannot replay',()=>{
 const w=make(3);w.players[2].hp=0;const e={id:20,type:'drone',x:1000,y:1000,lastHitBy:'p0'};
 rewardDefeat(w,e);rewardDefeat(w,e);assert.equal(w.sortie.combatKills,1);assert.equal(w.players[0].field.xp,10);assert.equal(w.players[1].field.xp,10);assert.equal(w.players[2].field.xp,0);assert.equal(w.players[0].field.kills,1);
 kill(w,2,{training:true});assert.equal(w.sortie.combatKills,1);
 for(let i=0;i<3;i++)kill(w,i);assert.equal(w.players[0].field.xp,xpForLevel(2));assert.equal(w.players[0].field.pending,1);assert.equal(w.players[1].field.pending,1);
 w.status='won';kill(w,99);assert.equal(w.players[0].field.xp,40);
});

test('three-way upgrades remain deterministic across snapshots, reject stale requests and honor inventory caps',()=>{
 const w=make(2),p=w.players[0];for(let i=0;i<4;i++)kill(w,i);const choices=fieldOffer(w,p);assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.id)).size,3);assert.deepEqual(choices,fieldOffer(snapshot(w),JSON.parse(JSON.stringify(p))));
 kill(w,88);assert.deepEqual(fieldOffer(w,p),choices,'earning more XP cannot change an already presented choice');
 assert.equal(chooseFieldModule(w,p,{id:'__proto__',revision:0}),false);assert.equal(chooseFieldModule(w,p,{id:choices[0].id,revision:99}),false);
 const request={id:choices[0].id,revision:choices[0].revision};assert.equal(chooseFieldModule(w,p,request),true);assert.equal(chooseFieldModule(w,p,request),false);assert.equal(p.field.upgrades.length,1);assert.equal(w.players[1].field.upgrades.length,0);
 p.field.pending=1;p.field.upgrades=['power','power','power'];assert.ok(!fieldOffer(w,p).some(c=>c.id==='power'));p.hp=0;assert.deepEqual(fieldOffer(w,p),[]);
 p.hp=100;p.field.upgrades=Object.keys(FIELD_UPGRADES).slice(0,12).flatMap(id=>[id,id,id]);assert.deepEqual(fieldOffer(w,p),[]);assert.equal(chooseFieldModule(w,p,{id:'hull',revision:p.field.offerRevision}),false);
});

test('cache acquisition validates revision, living state, range, altitude, clear sightline, cost and item stacks',()=>{
 const w=make(2),p=w.players[0],n=node(w,'cache','spall',18),request={id:n.id,revision:0};place(p,n);
 assert.equal(interactField(w,p,request),false);awardSalvage(w,20);p.x+=126;assert.equal(interactField(w,p,request),false);place(p,n);p.altitude=100;assert.equal(interactField(w,p,request),false);place(p,n);
 p.hp=0;assert.equal(interactField(w,p,request),false);p.hp=p.field.maxHull;
 p.x-=100;w.mission.obstacles=[{x:p.x+30,y:p.y-100,w:10,h:200,height:150}];assert.equal(interactField(w,p,request),false);w.mission.obstacles=[];place(p,n);
 assert.equal(interactField(w,p,{...request,revision:1}),false);assert.equal(interactField(w,p,request),true);assert.equal(interactField(w,p,request),false);assert.deepEqual(p.field.items,['spall']);assert.ok(p.hp>p.field.maxHull);assert.equal(n.state,'spent');assert.equal(w.sortie.salvage,2);assert.equal(w.sortie.salvageEarned,20);assert.equal(w.sortie.salvageSpent,18);
 const capped=node(w,'cache','spall');place(p,capped);p.field.items=['spall','spall','spall'];assert.equal(interactField(w,p,{id:capped.id,revision:0}),false);assert.equal(capped.state,'ready');
});

test('relay synchronization is once per pilot and expires on authoritative mission time',()=>{
 const w=make(2),[p,q]=w.players,n=node(w,'relay','assault');place(p,n);place(q,n);w.time=5;
 assert.equal(interactField(w,p,{id:n.id,revision:0}),true);assert.equal(fieldModifiers(p).damage,.3);assert.equal(n.state,'ready');assert.equal(interactField(w,p,{id:n.id,revision:1}),false);assert.equal(interactField(w,q,{id:n.id,revision:0}),false);assert.equal(interactField(w,q,{id:n.id,revision:1}),true);assert.equal(n.state,'spent');
 w.time=64.9;stepField(w,.05);assert.equal(fieldModifiers(p).damage,.3);w.time=65;stepField(w,.1);assert.equal(fieldModifiers(p).damage,0);assert.equal(p.field.relayCount,1);
 const permanent=node(w,'relay','colossus',16);awardSalvage(w,16);place(p,permanent);const before=p.hp;assert.equal(interactField(w,p,{id:permanent.id,revision:0}),true);w.time=1000;stepField(w,900);assert.equal(fieldModifiers(p).maxHull,.12);assert.ok(p.hp>before);assert.equal(p.field.relays[0],'colossus');
});

test('combat caches drop deterministically, are capped and collect by movement without crossing solid cover',()=>{
 const a=make(1,72),b=make(1,72);for(let i=0;i<60;i++){kill(a,i);kill(b,i);}assert.deepEqual(a.field.nodes,b.field.nodes);assert.equal(a.field.nodes.filter(n=>n.drop).length,4);
 const w=make(),p=w.players[0];w.mission.obstacles=[];w.field.nodes=[];p.x=1200;p.y=1900;p.altitude=0;p.field.items=['ferrite'];const drop={...node(w,'cache','gyro'),drop:true};w.field.nodes=[drop];
 w.mission.obstacles=[{x:1230,y:1800,w:10,h:200,height:100}];stepField(w,.05);assert.equal(drop.state,'ready');w.mission.obstacles=[];stepField(w,.05);assert.equal(drop.state,'spent');assert.ok(p.field.items.includes('gyro'));
 const far=node(w,'cache','lens');far.drop=true;far.x=p.x+190;p.field.items=['ferrite','ferrite','ferrite'];stepField(w,.05);assert.equal(far.state,'spent','stacked collection reach must remain effective beyond interaction range');
});

test('duplicate timed relay frequencies refresh one effect and permanent frequencies cannot be purchased twice',()=>{
 const w=make(),p=w.players[0];w.field.nodes=[];const first=node(w,'relay','assault'),second=node(w,'relay','assault');place(p,first);assert.equal(interactField(w,p,{id:first.id,revision:0}),true);w.time=20;assert.equal(interactField(w,p,{id:second.id,revision:0}),true);assert.equal(p.field.buffs.length,1);assert.equal(p.field.buffs[0].expiresAt,80);assert.equal(fieldModifiers(p).damage,.3);
 const a=node(w,'relay','uplink',20),b=node(w,'relay','uplink',20);awardSalvage(w,100);place(p,a);assert.equal(interactField(w,p,{id:a.id,revision:0}),true);assert.equal(interactField(w,p,{id:b.id,revision:0}),false);assert.equal(w.sortie.salvageSpent,20);stepField(w,.05);assert.notEqual(p.field.nearby,b.id);assert.deepEqual(p.field.relays,['uplink']);
});

test('fractional contract salvage survives purchases and extraction bonuses use total earnings',()=>{
 const w=make(),p=w.players[0];w.sortie.contract='overrun';awardSalvage(w,5);assert.equal(w.sortie.salvageUnits,625);const n=node(w,'cache','gyro',6);place(p,n);assert.equal(interactField(w,p,{id:n.id,revision:0}),true);assert.equal(w.sortie.salvageUnits,25);awardSalvage(w,1);assert.equal(w.sortie.salvageUnits,150);
 const report=sortieReport(w,'victory');assert.equal(report.salvage,1);assert.equal(report.salvageEarned,7);assert.equal(report.salvageSpent,6);
});

test('sanitized field inventories persist into the next campaign mission, including unspent XP choices',()=>{
 const raw={outcome:'victory',missionId:'ashgate',xp:999,pilots:[{name:'Pilot 0',xp:100,level:999,upgrades:['power','power','power','power','unknown','__proto__'],items:['gyro','gyro','gyro','gyro','constructor'],relays:999,modules:['repair']}]},clean=cleanSortieReport(raw),pilot=clean.pilots[0];
 assert.deepEqual(pilot.upgrades,['power','power','power']);assert.deepEqual(pilot.items,['gyro','gyro','gyro']);assert.equal(pilot.level,3);assert.equal(pilot.relays,99);assert.equal(cleanSortieReport({outcome:'forged'}),null);
 let c=newCampaign(33);c=recordSortie(c,'victory',{...raw,pilots:[{name:'Pilot 0',xp:100,upgrades:['hull'],items:['gyro'],modules:[]}],salvageEarned:250,salvage:1});assert.equal(profileFor(c,'Pilot 0').credits,2);assert.deepEqual(cleanCampaign(JSON.parse(JSON.stringify(c))),c);
 const w=newWorld(campaignMission(c),[{id:'p0',name:'Pilot 0',build:chassisBlueprint('vanguard')}]),p=w.players[0];assert.deepEqual(p.field.items,['gyro']);assert.deepEqual(p.field.upgrades,['hull']);assert.equal(p.field.xp,100);assert.equal(p.field.level,3);assert.equal(p.field.pending,1);assert.equal(fieldOffer(w,p).length,3);assert.deepEqual(p.field.buffs,[]);assert.deepEqual(p.field.relays,[]);
 const n=node(w,'cache','gyro');place(p,n);setInput(w,p.id,{fieldAction:{id:n.id,revision:0}});assert.deepEqual(p.field.items,['gyro','gyro']);
});
