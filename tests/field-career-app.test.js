import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createDeploymentGate,deploymentIntro,MIN_LOADING_SECONDS} from '../dist/cinematic.js';
import {createCampaignView} from '../dist/campaign-view.js';
import {newCampaign,profileFor} from '../dist/campaign.js';
import {chassisBlueprint} from '../dist/chassis.js';

// Exercise the real app wiring in a small VM, without WebGL, networking or a browser.
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
function fragment(name){
 const lines=app.split(/\r?\n/),start=lines.findIndex(line=>new RegExp(`^(?:async )?function ${name}\\(`).test(line));
 assert.ok(start>=0,`app defines ${name}`);
 if(lines[start].endsWith('}'))return lines[start];
 const end=lines.findIndex((line,index)=>index>start&&line==='}');
 assert.ok(end>start,`app closes ${name}`);return lines.slice(start,end+1).join('\n');
}
function harness(){
 const elements=new Map(),sent=[],inputs=[];let ticks=0,now=1000;
 const $=selector=>{if(!elements.has(selector))elements.set(selector,{hidden:false,inert:false,dataset:{},classList:{toggle(){}},focus(){},close(){},removeAttribute(name){delete this.dataset[name.replace(/^data-/,'')];}});return elements.get(selector);};
 const player={id:'host',hp:100,build:chassisBlueprint('vanguard')};
 const context=vm.createContext({$,elements,sent,inputs,world:{players:[player],time:0,status:'playing',mission:{name:'Ashgate',mode:'operation',heading:0,campaign:{id:'run'}}},
  localId:'host',playing:true,isHost:true,room:'',feedback:{isOpen:()=>false},keys:{},touch:{},mouse:{left:true},view:{yaw:0},handPress:{left:true,right:false},pressAbility:false,pressMelee:false,pressDash:false,
  movementInput:()=>({x:1,y:0}),getAim:()=>({angle:0}),sortieHud:{consumeInput:()=>({upgrade:{id:'power',revision:1},fieldAction:{id:'cache',revision:2}})},
  performance:{now:()=>now+=20},setInterval:callback=>{context.tick=callback;},mouseLook:{update(){},capture(){}},
  setInput:(_world,_id,input)=>inputs.push(input),step:world=>{ticks++;world.time+=.02;},tickHub:()=>{ticks++;},
  broadcast:packet=>sent.push(packet),safeSend:(_conn,packet)=>sent.push(packet),snapshot:world=>world,hostConn:{},lastSnapshot:0,receivedAt:0,finish(){},resetNetwork(){},
  clearTimeout(){},setTimeout:()=>1,document:{pointerLockElement:null},matchMedia:()=>({matches:false}),
  resetView(){},resetBattle(){},resetSound(){},updateBoostSound(){},updatePreviewSound(){},previewBuild:()=>player.build,clearInputs(){},playTransitionSound(){},hubView:{stop(){},close(){}},
  sceneFlow:{serial:0,cancel(){this.serial++;},begin(){return this.serial;},current(token){return token===this.serial;},stage(){},launch(){this.serial++;},intro(){},wait(){}},
  deployment:null,campaignMissionActive:true,endShown:true,createDeploymentGate,deploymentIntro,MIN_LOADING_SECONDS,impactMode:()=> 'reduced',drawBattle3D(){},console
 });
 return{context,ticks:()=>ticks};
}

test('app delivers field commands with combat input and pauses them for solo reports while co-op continues',()=>{
 const {context,ticks}=harness();
 vm.runInContext(fragment('getInput'),context);
 const interval=app.split(/\r?\n/).find(line=>line.startsWith('let lastTick=performance.now();setInterval('));
 assert.ok(interval);vm.runInContext(interval,context);
 context.feedback.isOpen=()=>true;context.tick();assert.equal(ticks(),0);assert.equal(context.inputs.length,0);
 context.room='SQUAD';context.tick();assert.equal(ticks(),1);assert.equal(context.inputs[0].fire,false);assert.equal(context.inputs[0].upgrade,undefined);
 context.feedback.isOpen=()=>false;context.tick();assert.equal(ticks(),2);assert.equal(context.inputs[1].upgrade.id,'power');assert.equal(context.inputs[1].fieldAction.id,'cache');assert.equal(context.inputs[1].left,true);
 context.elements.get('#modal').open=true;context.tick();assert.equal(context.inputs[2].upgrade,undefined,'modal controls cannot issue a field command');
});

test('cancelled preparation cannot revive an arena or activate campaign settlement',async()=>{
 const {context}=harness();let prepared;
 context.prepareBattle=()=>new Promise(resolve=>{prepared=resolve;});
 for(const name of ['cancelDeployment','startView'])vm.runInContext(fragment(name),context);
 const started=context.startView('cancelled');assert.equal(context.playing,false);assert.equal(context.campaignMissionActive,false);
 const pending=context.deployment;context.cancelDeployment();prepared(true);await started;
 assert.equal(context.deployment,null);assert.equal(pending.prepared,false);assert.equal(context.playing,false);assert.equal(context.campaignMissionActive,false);
 assert.equal(context.world.time,0);assert.equal(context.elements.get('#game').inert,false);assert.equal(context.elements.get('#hangar').inert,false);
});

test('field/career deployment waits for the matching squad ticket and activates rewards only at combat release',async()=>{
 const {context}=harness();context.room='SQUAD';context.world.players.push({id:'guest'});context.prepareBattle=async()=>true;
 for(const name of ['cancelDeployment','enterCombat','tryLaunchDeployment','startView','updateInsertion'])vm.runInContext(fragment(name),context);
 await context.startView('current');const pending=context.deployment;
 assert.equal(pending.prepared,true);assert.equal(context.campaignMissionActive,false);
 context.updateInsertion(pending.startedAt+MIN_LOADING_SECONDS*1000+1);
 context.updateInsertion(pending.insertionAt+10000);
 assert.equal(pending.localReady,true);assert.equal(context.playing,false);assert.equal(context.world.time,0);
 assert.equal(pending.gate.acknowledge('guest','stale'),false);context.tryLaunchDeployment();assert.equal(context.playing,false);
 context.enterCombat('stale');assert.equal(context.deployment,pending);
 assert.equal(pending.gate.acknowledge('guest','current'),true);context.tryLaunchDeployment();
 assert.equal(context.deployment,null);assert.equal(context.playing,true);assert.equal(context.campaignMissionActive,true);
 assert.equal(context.sent.filter(packet=>packet.type==='combat-live').length,1);assert.equal(context.sent.at(-1).ticket,'current');
});

test('Command preserves carried field stacks and routes refit tokens to Run supplies',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:null}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const root={innerHTML:'',addEventListener(){},contains(){return false;}},campaign=newCampaign(42),build=chassisBlueprint('vanguard');
 const profile=profileFor(campaign,'Ace');profile.upgrades=['hull','hull'];profile.items=['gyro'];profile.modules=['plating'];profile.credits=2;campaign.pilots.push(profile);
 createCampaignView(root,{}).render({campaign,build,saved:[],members:[{id:'host',name:'Ace',build,ready:false}],localId:'host',room:'',isHost:true,connecting:false,canChoose:true});
 assert.match(root.innerHTML,/Bulkhead lattice ×2/);assert.match(root.innerHTML,/Counterweight gyro ×1/);assert.match(root.innerHTML,/2 refit tokens available/);
 assert.match(root.innerHTML,/data-action="supply"/);assert.doesNotMatch(root.innerHTML,/data-refit="/,'Command cannot bypass the supply station');
});
