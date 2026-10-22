import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,testPlatform,DEFAULT_BUILD,step,setInput,snapshot} from '../dist/core.js';
import {ENEMY_ROLES,ENEMY_ATTACKS,cancelEnemyAction} from '../dist/enemy-behaviors.js';
import {enemyPose} from '../dist/enemy-motion.js';
import {makeRobot,animateRobot,createRobotBatch} from '../dist/robot-models.js';
import {createEnemyCues} from '../dist/enemy-cues.js';
import {MISSIONS,campaignRound} from '../dist/mission-catalog.js';
import * as T from '../dist/vendor/three.module.min.js';
const tick=(w,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.01)step(w,.01);};
function make(type='needle',distance=500,count=1){
 const w=newWorld(testPlatform(),Array.from({length:count},(_,i)=>({id:'p'+i,build:DEFAULT_BUILD})));w.enemies=[];w.mission.mode='station';w.mission.width=4200;w.mission.height=3000;w.mission.zones=[{x:4000,y:2900}];w.mission.exit={x:4000,y:2900};w.encounter=true;w.hazardTimer=1e6;
 w.players.forEach((p,i)=>Object.assign(p,{x:1000,y:1000+i*400,altitude:0,recoverUntil:1e6}));
 w.spawn=[{time:0,type,zone:{x:1000-distance,y:1000,exact:true,operation:true}}];step(w,.01);const e=w.enemies[0];e.cd=0;e.speed=0;return{w,e,p:w.players[0]};
}
test('all seven roles spawn finite, distinct profiles and real host actions',()=>{
 for(const role of Object.keys(ENEMY_ROLES).filter(k=>k!=='siege')){const{w,e}=make(role,role==='hunter'?110:400);step(w,.01);assert.equal(e.behavior,role);assert.equal(e.max,ENEMY_ROLES[role].hp);assert.ok(ENEMY_ATTACKS[e.attackKind]);assert.equal(e.actionPhase,'windup');assert.equal(w.bullets.length,0);assert.ok([e.x,e.y,e.altitude,e.r,e.speed,e.max].every(Number.isFinite));}
});
test('sniper commits aim and target through windup, then exposes a stationary recovery',()=>{
 const{w,e,p}=make();p.recoverUntil=0;step(w,.01);const aim={...e.attackPoint},angle=e.attackAngle,start={x:e.x,y:e.y};p.y+=250;tick(w,.97);assert.deepEqual(e.attackPoint,aim);assert.equal(e.attackAngle,angle);assert.equal(e.attackTarget,p.id);assert.ok(w.bullets.length>0);assert.equal(e.actionPhase,'recovery');assert.deepEqual({x:e.x,y:e.y},start);assert.equal(p.hp,125);tick(w,.5);assert.equal(e.actionPhase,'recovery');
});
test('wisp fires a timed three-shot burst along its committed direction',()=>{
 const{w,e,p}=make('wisp');step(w,.01);tick(w,.41);assert.equal(e.fired,1);p.y+=300;tick(w,.29);assert.equal(e.fired,3);assert.equal(e.actionPhase,'active');const shots=w.bullets.filter(b=>b.owner===e.id);assert.equal(shots.length,3);assert.ok(shots.every(b=>Math.abs(Math.atan2(b.vy,b.vx)-e.attackAngle)<1e-6));
});
test('charge travels over time and cannot hit through cover or turn toward a dodge',()=>{
 const{w,e,p}=make('rammer',300);p.recoverUntil=0;step(w,.01);const angle=e.attackAngle;p.y+=200;tick(w,.81);assert.equal(e.actionPhase,'active');assert.ok(e.x>700&&e.x<900);assert.equal(e.attackAngle,angle);assert.equal(p.hp,125);
 w.mission.obstacles=[{x:900,y:850,w:30,h:400,height:200}];tick(w,.5);assert.ok(e.x<=900-e.r);assert.equal(p.hp,125);assert.equal(e.actionPhase,'recovery');
});
test('melee only damages in its active interval and only once per pilot',()=>{
 const{w,e,p}=make('hunter',50);p.recoverUntil=0;step(w,.01);tick(w,.27);assert.equal(p.hp,125);tick(w,.07);assert.ok(p.hp<125);const hp=p.hp;p.recoverUntil=0;tick(w,.08);assert.equal(p.hp,hp);
});
test('stomp has a dodgeable windup, grounded radius and flight counterplay',()=>{
 for(const fly of[false,true]){const{w,e,p}=make('rammer',90);p.recoverUntil=0;step(w,.01);assert.equal(e.attackKind,'stomp');if(fly)p.altitude=180;for(let i=0;i<95;i++){if(fly)setInput(w,p.id,{fly:true});step(w,.01);}assert.equal(p.hp<125,!fly);}
});
test('EMP cancels windup, active bursts and recovery without delayed attacks',()=>{
 for(const when of[0,.42,.76]){const{w,e,p}=make('wisp',180);step(w,.01);tick(w,when);w.bullets=[];setInput(w,p.id,{ability:true});step(w,.01);setInput(w,p.id,{});assert.equal(e.actionPhase,'idle');assert.equal(e.attackKind,null);tick(w,1);assert.equal(w.bullets.length,0);assert.equal(e.windup,0);}
});
test('two attacker slots limit simultaneous pressure and death releases a slot',()=>{
 const{w,e}=make('needle');w.enemies=Array.from({length:6},(_,i)=>({...e,id:100+i,x:400,y:900+i*35}));step(w,.01);assert.equal(w.enemies.filter(e=>e.actionPhase==='windup').length,2);w.enemies.find(e=>e.actionPhase==='windup').hp=0;step(w,.01);assert.equal(w.enemies.filter(e=>e.actionPhase==='windup').length,2);
});
test('target hysteresis avoids jitter and committed attacks survive a closer second pilot',()=>{
 const{w,e,p}=make('needle',500,2);e.cd=5;step(w,.01);assert.equal(e.targetId,p.id);w.players[1].y=1000;w.players[1].x=990;step(w,.01);assert.equal(e.targetId,p.id);e.cd=0;step(w,.01);p.x+=1000;tick(w,.2);assert.equal(e.attackTarget,p.id);
});
test('Bellows marks a fixed elevated point, releases a delayed shell, and dies without deleting the shell',()=>{
 const{w,e,p}=make('mortar');p.recoverUntil=0;step(w,.01);const point={...e.attackPoint};tick(w,.75);assert.equal(w.enemyHazards.length,1);assert.equal(p.hp,125);e.hp=0;tick(w,.2);assert.equal(w.enemies.length,0);assert.equal(w.enemyHazards.length,1);assert.equal(w.enemyHazards[0].x,point.x);tick(w,1);assert.ok(p.hp<125);assert.equal(w.enemyHazards.length,0);
});
test('artillery respects flight, blast cover and allied/objective immunity',()=>{
 for(const mode of['flight','cover','hit']){const{w,e,p}=make('mortar');p.recoverUntil=0;e.cd=100;w.enemyHazards=[{id:999,owner:e.id,x:p.x-50,y:p.y,z:0,r:120,damage:38,time:.01,max:1}];const hp=e.hp;w.enemies.push({id:'objective',objective:true,hp:500,max:500,x:p.x,y:p.y,altitude:0,r:30});if(mode==='flight'){p.altitude=180;setInput(w,p.id,{fly:true});}if(mode==='cover')w.mission.obstacles=[{x:p.x-25,y:p.y-50,w:10,h:100,height:200}];step(w,.01);assert.equal(p.hp<125,mode==='hit');assert.equal(e.hp,hp);assert.equal(w.enemies.find(e=>e.objective).hp,500);}
});
test('mender heals only a living damaged ally within sight and uses a cooldown',()=>{
 const{w,e}=make('mender');e.hp=70;const ally={...e,id:'ally',species:'rammer',x:e.x+100,hp:40,max:100,cd:100};w.enemies.push(ally);step(w,.01);assert.equal(e.attackKind,'mend');assert.equal(e.healTarget,ally.id);tick(w,.9);assert.equal(ally.hp,72);assert.equal(e.hp,70);assert.ok(e.healReadyAt>w.time+4);tick(w,2.3);assert.equal(e.attackKind,'burst');
});
test('repair cannot revive dead enemies, heal mission objects or pass through cover',()=>{
 for(const mode of['dead','cover','objective']){const{w,e}=make('mender');const ally={...e,id:'ally',species:'scarab',x:e.x+120,hp:40,max:100,cd:100};w.enemies.push(ally);step(w,.01);if(mode==='dead')ally.hp=0;if(mode==='objective')ally.objective=true;if(mode==='cover')w.mission.obstacles=[{x:e.x+50,y:e.y-60,w:20,h:120,height:200}];tick(w,.9);assert.equal(ally.hp,mode==='dead'?0:40);}
});
test('mender can support a visible ally while the player is behind a wall',()=>{
 const{w,e,p}=make('mender');const ally={...e,id:'ally',species:'scarab',x:e.x,y:e.y+140,hp:30,max:100,cd:100};w.enemies.push(ally);w.mission.obstacles=[{x:e.x+200,y:e.y-200,w:40,h:400,height:200}];step(w,.01);assert.equal(e.attackKind,'mend');tick(w,.9);assert.equal(ally.hp,62);assert.equal(p.hp,125);
});
test('siege switches attacks by range, sequence and health without shortening telegraphs',()=>{
 const{w,e,p}=make('tank');e.elite=true;e.cd=0;step(w,.01);assert.equal(e.attackKind,'siegeFan');cancelEnemyAction(e);e.cd=0;e.actionCount=2;step(w,.01);assert.equal(e.attackKind,'siegeBarrage');cancelEnemyAction(e);e.cd=0;e.x=p.x-100;step(w,.01);assert.equal(e.attackKind,'siegeStomp');assert.equal(e.windup,.72);
});
test('snapshots retain authored pose, committed aim and shells, without host perception or hit sets',()=>{
 const{w,e}=make('needle');e.cd=1;step(w,.01);e.cd=0;step(w,.01);const remote=JSON.parse(JSON.stringify(snapshot(w)));assert.equal(remote.enemies[0].actionPhase,'windup');assert.deepEqual(remote.enemies[0].attackPoint,e.attackPoint);assert.equal(remote.enemies[0].perception,undefined);assert.equal(remote.enemies[0].actionHits,undefined);assert.deepEqual(enemyPose(remote.enemies[0]),enemyPose(e));
});
test('authored windups have distinct silhouettes and deterministic smooth settling',()=>{
 const poses=[];for(const[k,a]of Object.entries(ENEMY_ATTACKS)){const p={attackKind:k,actionPhase:'windup',actionTime:a.windup};const pose=enemyPose(p);assert.ok(Object.values(pose).every(Number.isFinite));poses.push(JSON.stringify(pose));const settled=enemyPose({...p,actionPhase:'recovery',actionTime:a.recovery});assert.ok(Object.values(settled).every(n=>Math.abs(n)<1e-8));}assert.ok(new Set(poses).size>=12);
});
test('all model poses and instanced warnings have finite transforms and bounded geometry',()=>{
 const parent=new T.Group(),models=new Map(),batch=createRobotBatch(parent),cues=createEnemyCues(parent),enemies=[];
 for(const[k,profile]of Object.entries(ENEMY_ROLES)){if(k==='siege')continue;const g=makeRobot(k);models.set(k,g);parent.add(g);for(const[attackKind,a]of Object.entries(ENEMY_ATTACKS))for(const actionPhase of['windup','active','recovery']){const p={id:k,species:k,x:0,y:0,angle:0,altitude:0,hp:100,r:20,attackKind,actionPhase,actionTime:a[actionPhase]||.2,attackAngle:0,attackPitch:0,attackPoint:{x:400,y:0,z:0}};animateRobot(g,p,.016,1);enemies.push(p);g.updateMatrixWorld(true);g.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),k));}}
 // Check every warning, including the largest buffer: three siege-barrage circles.
 for(const p of enemies)cues.update({time:1,enemies:[p],enemyHazards:[{id:1,x:0,y:0,z:0,r:135,time:.5,max:1}]});
 batch.update(models);parent.traverse(o=>{if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});assert.ok(parent.children.length<100);cues.update({time:1,enemies:[],enemyHazards:[]});cues.dispose();batch.dispose();
});
test('campaign introduces specialists progressively and all late roles occur in real waves',()=>{
 assert.ok(!MISSIONS[0].mix.some(k=>['rammer','needle','mortar','mender'].includes(k)));assert.ok(MISSIONS[1].mix.includes('rammer'));assert.ok(MISSIONS[2].mix.includes('needle'));
 const seen=new Set();for(const m of MISSIONS){const w=newWorld(campaignRound(m.id,77),[{id:'p',build:DEFAULT_BUILD}]);w.players[0].recoverUntil=1e6;for(let i=0;i<900;i++){step(w,.05);for(const e of w.enemies)seen.add(e.species);}}for(const role of['rammer','needle','mortar','mender'])assert.ok(seen.has(role),role);
});
test('four pilots and 56 mixed enemies stay deterministic and serialize for extended combat',()=>{
 const simulate=()=>{const{w,e}=make('wisp',500,4);const roles=Object.keys(ENEMY_ROLES).filter(k=>k!=='siege');w.enemies=Array.from({length:56},(_,i)=>{const role=roles[i%roles.length],p=ENEMY_ROLES[role];return{...e,id:i+100,species:role,hover:p.hover||0,altitude:p.hover||0,bodyHeight:p.height,speed:p.speed,r:p.r,hp:p.hp,max:p.hp,cd:i*.02,x:300+i%8*100,y:300+Math.floor(i/8)*200};});for(let i=0;i<1200;i++){step(w,.05);assert.ok((w.enemyHazards||[]).length<=32);}const remote=JSON.parse(JSON.stringify(snapshot(w)));assert.ok(remote.enemies.every(e=>[e.x,e.y,e.altitude,e.hp].every(Number.isFinite)));return remote;};assert.deepEqual(simulate(),simulate());
});
