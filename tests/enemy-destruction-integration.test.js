import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,testPlatform,DEFAULT_BUILD,step,snapshot} from '../dist/core.js';
import {fractureLayout,bindDestruction,structureIntersects} from '../dist/destruction.js';
import {destructionMission} from '../dist/destruction-mission.js';

const tick=(w,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.01)step(w,.01);};

test('committed charges respect solid fragments and traverse partial or complete breaches',()=>{
 for(const opening of ['intact','partial','destroyed']){
  const wall={x:650,y:850,w:30,h:300,height:150,breakable:0,material:'concrete'};
  const m={...testPlatform(),mode:'destruction',destructible:true,variant:'yard',panelCount:1,obstacles:[wall]};
  const w=newWorld(m,[{id:'p',build:DEFAULT_BUILD}]);
  Object.assign(w.players[0],{x:1100,y:1000,recoverUntil:1e6});
  if(opening==='destroyed')w.destruction.hp[0]=0;
  if(opening==='partial')w.destruction.cells[0]=fractureLayout(m,0).cells.map(c=>c.baseZ>=75?32:0);
  w.destruction.revision++;
  const e={id:99,type:'tank',species:'rammer',x:500,y:1000,altitude:0,hp:230,max:230,r:27,speed:155,bodyHeight:48,stun:0,cd:0,actionPhase:'active',actionTime:0,attackKind:'charge',attackAngle:0,actionHits:[],fired:0};
  w.enemies=[e];tick(w,.5);
  assert.equal(e.actionPhase,'active');
  if(opening==='intact')assert.ok(e.x<=wall.x-e.r);
  else assert.ok(e.x>wall.x+wall.w+e.r,opening);
  if(opening==='partial')assert.ok(structureIntersects(m,wall,665,1000,100,2,10),'overhead wall remains solid');
 }
});

test('Breakwater waves use authored enemy actions and keep siege progression authoritative',()=>{
 const w=newWorld(destructionMission('level'),[{id:'p',build:DEFAULT_BUILD}]);
 w.players[0].recoverUntil=1e6;tick(w,5);
 assert.ok(w.enemies.length>0);
 assert.ok(w.enemies.every(e=>['hunter','wisp'].includes(e.behavior)));
 assert.ok(w.enemies.some(e=>e.actionPhase==='windup'||e.actionPhase==='active'||e.actionPhase==='recovery'));
 w.enemies=[];w.siege.nextWave=1e6;tick(w,.1);
 assert.equal(w.siege.phase,0);assert.equal(w.zoneIndex,0);assert.equal(w.status,'playing');
 w.players[0].hp=0;tick(w,4.1);
 assert.equal(w.siege.redeploys,1);assert.ok(w.players[0].hp>0);assert.equal(w.status,'playing');
});

test('co-op snapshots preserve destruction and committed attacks while omitting host hit tracking',()=>{
 const w=newWorld(destructionMission('yard'),[{id:'p',build:DEFAULT_BUILD},{id:'ally',build:DEFAULT_BUILD}]);
 w.enemies=[{id:99,type:'gunner',species:'needle',hp:85,x:500,y:500,altitude:0,actionPhase:'windup',attackKind:'snipe',attackPoint:{x:900,y:500,z:32},perception:{id:'p'},actionHits:[],teamHits:{p:{at:0}},comboReadyAt:1,comboFinished:false}];
 w.teamCombos=[{id:100,label:'CROSS BREAK',at:0}];
 const remote=JSON.parse(JSON.stringify(snapshot(w)));
 assert.deepEqual(remote.destruction,w.destruction);assert.deepEqual(remote.siege,w.siege);
 assert.deepEqual(remote.teamCombos,w.teamCombos);assert.deepEqual(remote.enemies[0].attackPoint,w.enemies[0].attackPoint);
 assert.equal(remote.enemies[0].actionPhase,'windup');
 for(const key of ['perception','actionHits','teamHits','comboReadyAt','comboFinished'])assert.equal(remote.enemies[0][key],undefined);
 bindDestruction(remote.mission,remote.destruction);
 const wall=remote.mission.obstacles.find(o=>o.breakable!==undefined);
 assert.ok(structureIntersects(remote.mission,wall,wall.x+wall.w/2,wall.y+wall.h/2,(wall.baseZ||0)+1));
});
