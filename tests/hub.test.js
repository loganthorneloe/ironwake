import test from 'node:test';
import assert from 'node:assert/strict';
import {HUB_STATIONS,HUB_CATALOG,HUB_STORIES,HUB_SPEED,newHubSave,cleanHubSave,inheritArmory,ownsLicense,missingLicenses,purchaseLicense,purchaseAtStation,rewardHub,syncHubPlayers,setHubInput,stepHub,nearStation,hubSnapshot} from '../dist/hub-state.js';
import {chassisBlueprint} from '../dist/chassis.js';
import {newCampaign,registerPilot,recordSortie} from '../dist/campaign.js';

test('fresh armory supports a valid starter mech, all five sockets, both hands and specials',()=>{
  const save=newHubSave();assert.equal(save.credits,360);assert.deepEqual(missingLicenses(save,chassisBlueprint('vanguard')),[]);
  assert.equal(new Set(HUB_CATALOG.map(item=>item.id)).size,HUB_CATALOG.length);
  for(const slot of['torso','head','arms','legs','booster'])assert.equal(HUB_CATALOG.filter(item=>item.slot===slot).length,9);
  assert.equal(HUB_CATALOG.filter(item=>item.vendor==='weapons').length,18);
  assert.equal(HUB_STATIONS.length,5);assert.equal(HUB_STORIES.filter(item=>item.level===0).length,1);
});

test('shared license purchases check revision, funds, unlock threshold and duplicates',()=>{
  const save=newHubSave(),item=HUB_CATALOG.find(item=>item.price>0&&item.level===0),request={id:item.id,revision:save.revision};
  const next=purchaseLicense(save,request);assert.notEqual(next,save);assert.equal(next.credits,save.credits-item.price);assert.ok(ownsLicense(next,item.id));
  assert.equal(purchaseLicense(next,request),next);assert.equal(purchaseLicense(next,{...request,revision:next.revision}),next);
  assert.equal(purchaseLicense({...save,credits:0},request).credits,0);
  const locked=HUB_CATALOG.find(item=>item.level===2);assert.equal(purchaseLicense(save,{id:locked.id,revision:0}),save);
  for(const id of['__proto__','constructor','unknown',undefined])assert.equal(purchaseLicense(save,{id,revision:0}),save);
  assert.equal(save.unlocks.length,0,'transactions must not mutate the prior snapshot');
});

test('existing active and saved loadouts retain their licenses after migration and serialization',()=>{
  const builds=['colossus','warden','needle'].map(chassisBlueprint),save=inheritArmory(newHubSave(),builds);
  for(const build of builds)assert.deepEqual(missingLicenses(save,build),[]);
  assert.equal(save.credits,360);assert.deepEqual(cleanHubSave(JSON.parse(JSON.stringify(save))),save);
  const dirty=cleanHubSave({version:1,revision:-1,credits:Infinity,bestLevel:100,unlocks:['weapon:rail','weapon:rail','__proto__'],rewarded:[{},'ok']});
  assert.equal(dirty.credits,0);assert.equal(dirty.revision,0);assert.equal(dirty.bestLevel,9);assert.deepEqual(dirty.unlocks,['weapon:rail']);assert.deepEqual(dirty.rewarded,['ok']);
});

test('host transactions reject remote, unknown and combat-time purchases before charging the bank',()=>{
  const save=newHubSave(),state=syncHubPlayers(null,[{id:'accepted-connection'}]),item=HUB_CATALOG.find(item=>item.vendor==='parts'&&item.price>0&&item.level===0),request={id:item.id,revision:0};
  assert.equal(purchaseAtStation(save,state,'accepted-connection',request),save,'spawn is too far from the foundry');
  const station=HUB_STATIONS.find(s=>s.id==='parts');Object.assign(state.players[0],{x:station.x,z:station.z});
  assert.equal(purchaseAtStation(save,state,'spoofed-connection',request),save);
  assert.equal(purchaseAtStation(save,state,'accepted-connection',request,true),save);
  const next=purchaseAtStation(save,state,'accepted-connection',request);assert.ok(ownsLicense(next,item.id));assert.equal(next.credits,save.credits-item.price);
});

test('extraction earns permanent currency once and new runs preserve the armory separately from modules',()=>{
  let c=registerPilot(newCampaign(2),'PILOT-TEST');
  c=recordSortie(c,'victory',{outcome:'victory',missionId:'ashgate',salvage:240,seconds:120,pilots:[{name:'PILOT-TEST'}]});
  const save=rewardHub(newHubSave(),c);assert.equal(save.credits,600);assert.equal(save.bestLevel,1);assert.equal(rewardHub(save,c),save);
  const failed=recordSortie(c,'defeat',{outcome:'defeat',missionId:'glasswater',pilots:[{name:'PILOT-TEST'}]});assert.equal(rewardHub(save,failed),save);
  const nextRun=newCampaign(3);assert.equal(nextRun.pilots.length,0);assert.equal(save.credits,600);assert.ok(HUB_STORIES.some(entry=>entry.level===save.bestLevel));
});

test('four pilots move independently, speed is normalized and snapshots contain only poses',()=>{
  const members=Array.from({length:4},(_,i)=>({id:'p'+i})),state=syncHubPlayers(null,members),before=structuredClone(state);
  setHubInput(state,'p0',{x:1,z:1});setHubInput(state,'p1',{x:-1,z:0});setHubInput(state,'p2',{x:NaN,z:Infinity});setHubInput(state,'spoof',{x:1,z:1});
  stepHub(state,.05);assert.ok(Math.abs(Math.hypot(state.players[0].x-before.players[0].x,state.players[0].z-before.players[0].z)-HUB_SPEED*.05)<1e-8);
  assert.ok(state.players[1].x<before.players[1].x);assert.deepEqual(state.players[2],before.players[2]);assert.deepEqual(state.players[3],before.players[3]);
  const packet=JSON.parse(JSON.stringify(hubSnapshot(state)));assert.deepEqual(Object.keys(packet.players[0]).sort(),['angle','id','x','z']);
  assert.equal(packet.players.length,4);assert.ok(!('input' in packet.players[0]));
  const retained=syncHubPlayers(state,[members[0],{id:'late'}]);assert.equal(retained.players[0],state.players[0]);assert.equal(retained.players.length,2);assert.ok(!retained.players.some(p=>p.id==='p1'));
});

test('hub boundaries and counters block movement; every vendor is reachable through the central aisle',()=>{
  const state=syncHubPlayers(null,[{id:'p'}]),p=state.players[0];
  setHubInput(state,'p',{x:0,z:-1});for(let i=0;i<200;i++)stepHub(state,.05);assert.ok(p.z>=-7.2,'mission table blocks the central path');
  for(const station of HUB_STATIONS){
    p.x=0;p.z=19;
    for(const point of[{x:0,z:station.z},station])for(let i=0;i<300&&Math.hypot(p.x-point.x,p.z-point.z)>.7;i++){
      const dx=point.x-p.x,dz=point.z-p.z,length=Math.hypot(dx,dz);setHubInput(state,'p',{x:dx/length,z:dz/length});stepHub(state,.05);
    }
    assert.ok(nearStation(state,'p',station.id),station.id+' must be reachable');assert.ok(!nearStation(state,'unknown',station.id));
  }
  p.x=39;p.z=27;setHubInput(state,'p',{x:100,z:100});for(let i=0;i<100;i++)stepHub(state,10);assert.ok(p.x<=40&&p.z<=27);
});
