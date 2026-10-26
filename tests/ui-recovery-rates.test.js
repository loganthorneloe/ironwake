import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,testPlatform,setInput,step,snapshot,combatRecovery,ABILITIES,RANGED} from '../dist/core.js';
import {chassisBlueprint} from '../dist/chassis.js';
import {newCampaign,campaignMission} from '../dist/campaign.js';
import {treeFor,progressionModifiers} from '../dist/career-progression.js';
import {fieldModifiers} from '../dist/sortie-progression.js';
import {ultimateStatus} from '../dist/hud-status.js';

const trained={mech:treeFor('mech','vanguard').branches.flatMap(b=>b.nodes.map(n=>n.id)),pilot:treeFor('pilot','Pilot').branches.flatMap(b=>b.nodes.map(n=>n.id))};
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
function make(profile={},equipment){
 const campaign={...newCampaign(83),pilots:[{name:'Pilot',modules:[],upgrades:[],items:[],xp:0,credits:0,...profile}]};
 const build=chassisBlueprint('vanguard');if(equipment)build.equipment=equipment;
 const w=newWorld(campaignMission(campaign),[{id:'p',name:'Pilot',build,progression:trained}]),p=w.players[0];
 w.operation.nextWave=w.operation.nextStrike=1e9;w.mission.obstacles=[];w.mission.platforms=[];w.mission.ramps=[];w.enemies=[];w.spawn=[];w.field.nodes=[];
 Object.assign(p,{x:1000,y:1000,altitude:0,recoverUntil:0});return{w,p};
}
function tick(w,dt=.01,input={}){setInput(w,'p',input);step(w,dt);}
function until(w,done){let elapsed=0;while(!done()&&elapsed<10){tick(w);elapsed+=.01;}assert.ok(done(),'recovery completes within the fixture limit');return elapsed;}

test('live cooldown seconds follow career and field recovery while fill remains based on cooldown units',()=>{
 const {w,p}=make({modules:['thrusters','capacitor','servo'],upgrades:['thrusters','capacitor','servo'],items:['razor','reactor','redline']});
 p.field.buffs=[{relayId:'velocity',expiresAt:60},{relayId:'capacitor',expiresAt:60},{relayId:'barrage',expiresAt:60}];
 const career=progressionModifiers(p.progression,p.build.chassis),rates=combatRecovery(p);
 close(rates.weaponRate,1.62,'hand rate');close(rates.dashRate,career.dashRecharge*1.72,'dash rate');close(rates.specialRate,career.specialRecharge*2.35,'special rate');
 p.abilityCd=4.8;p.dashCd=2.4;p.active=0;p.hands[0].meleeTime=.8;p.hands[1].shot=.6;
 const before=ultimateStatus(p,ABILITIES.emp,rates.specialRate);
 assert.equal(before.counter,(4.8/rates.specialRate).toFixed(1)+'s');assert.notEqual(before.counter,'4.8s');
 assert.equal(before.percent,ultimateStatus(p,ABILITIES.emp).percent,'the recovery fill uses the original cooldown interval');
 tick(w,.05);
 close(p.abilityCd,4.8-.05*rates.specialRate,'special simulation');close(p.dashCd,2.4-.05*rates.dashRate,'dash simulation');
 close(p.hands[0].meleeTime,.8-.05*rates.weaponRate,'melee simulation');close(p.hands[1].shot,.6-.05*rates.weaponRate,'gun simulation');
 const seconds=p.abilityCd/rates.specialRate,elapsed=until(w,()=>p.abilityCd===0);
 assert.ok(Math.abs(elapsed-seconds)<=.010001,'reported special time agrees with actual simulation completion');
 assert.equal(ultimateStatus(p,ABILITIES.emp,rates.specialRate).state,'ready');
 const remote=JSON.parse(JSON.stringify(snapshot(w))).players[0];assert.deepEqual(combatRecovery(remote),combatRecovery(p));
});

test('rail charge and recovery share the live hand rate used to show seconds',()=>{
 const {w,p}=make({modules:['servo','servo','servo'],upgrades:['servo','servo','servo'],items:['redline','redline','redline']},['rail','carbine','emp']);
 p.field.buffs=[{relayId:'barrage',expiresAt:60}];const rate=combatRecovery(p).weaponRate;
 tick(w,.01,{leftPressed:true});const h=p.hands[0];assert.equal(h.railCharging,true);close(h.railCharge,.01*rate/RANGED.rail.charge,'initial rail charge');
 const chargeSeconds=(1-h.railCharge)*RANGED.rail.charge/rate,chargeElapsed=until(w,()=>h.shotCount===1);
 assert.ok(Math.abs(chargeElapsed-chargeSeconds)<=.010001,'rail completes within one simulation tick of its displayed charge time');
 close(h.shot,RANGED.rail.rate,'shot starts the full recovery interval');const recoverySeconds=h.shot/rate;
 const recoveryElapsed=until(w,()=>h.shot<=1e-6);assert.ok(Math.abs(recoveryElapsed-recoverySeconds)<=.010001,'rail recovery seconds match real recovery');
 assert.equal(h.shotCount,1,'recovery does not queue an unrequested shot');
});

test('special recovery caps before career training and updates when a relay expires',()=>{
 const {w,p}=make({modules:['capacitor','capacitor','capacitor'],upgrades:['capacitor','capacitor','capacitor'],items:['reactor','reactor','reactor','medic','medic','medic']});
 const career=progressionModifiers(p.progression,p.build.chassis);p.field.buffs=[{relayId:'capacitor',expiresAt:.04}];
 assert.ok(fieldModifiers(p).specialRecharge>2);close(combatRecovery(p).specialRate,career.specialRecharge*3,'capped rate');
 p.abilityCd=8;tick(w,.01);close(p.abilityCd,8-.01*career.specialRecharge*3,'capped simulation');
 p.field.items=[];close(combatRecovery(p).specialRate,career.specialRecharge*3,'relay still reaches the cap after a hardware change');
 const previous=p.abilityCd;tick(w,.05);assert.deepEqual(p.field.buffs,[]);const rate=combatRecovery(p).specialRate;
 close(rate,career.specialRecharge*2.5,'relay expiry changes the live rate');close(p.abilityCd,previous-.05*rate,'expired relay tick');
 const status=ultimateStatus(p,ABILITIES.emp,rate);assert.equal(status.counter,(p.abilityCd/rate).toFixed(1)+'s');
});

test('unmodified recovery and the optional ultimate rate preserve existing callers',()=>{
 const w=newWorld(testPlatform(),[{id:'p',build:chassisBlueprint('vanguard')}]),p=w.players[0];
 assert.deepEqual(combatRecovery(p),{weaponRate:1,dashRate:1,specialRate:1});p.abilityCd=6;p.active=2;
 assert.equal(ultimateStatus(p,ABILITIES.emp).counter,'6.0s');assert.equal(ultimateStatus(p,ABILITIES.emp,2).counter,'3.0s');
 assert.equal(ultimateStatus(p,ABILITIES.emp,2).detail,'ACTIVE · 2.0s','active duration already uses real seconds');
 for(const invalid of[0,-1,NaN,Infinity])assert.equal(ultimateStatus(p,ABILITIES.emp,invalid).counter,'6.0s');
});
