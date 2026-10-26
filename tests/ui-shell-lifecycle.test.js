import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {newWorld,combatStats,combatRecovery,mechStats,step,WEAPONS,ABILITIES,COMBAT_MOVES,specialFor} from '../dist/core.js';
import {chassisBlueprint} from '../dist/chassis.js';
import {campaignRound} from '../dist/mission-catalog.js';
import {treeFor} from '../dist/career-progression.js';
import {interactField} from '../dist/sortie-progression.js';
import {hullStatus,ultimateStatus,taskStatus,objectiveStatus} from '../dist/hud-status.js';
import {squadStatus} from '../dist/squad-status.js';

// Execute production handlers with an inert DOM surface. These checks cover
// state/lifecycle wiring, not browser layout, real touch input or visual quality.
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const shell=await readFile(new URL('../dist/interface-ux.js',import.meta.url),'utf8');
const hub=await readFile(new URL('../dist/hub-view.js',import.meta.url),'utf8');
function fragment(source,name){
 const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,`production defines ${name}`);
 const lineEnd=source.indexOf('\n',start),first=source.slice(start,lineEnd<0?undefined:lineEnd).trimEnd();
 if(first.endsWith('}'))return first;
 const end=source.indexOf('\n}',start);assert.ok(end>start,`production closes ${name}`);return source.slice(start,end+2);
}
class Element{
 constructor(){this.open=false;this.hidden=false;this.textContent='';this.innerHTML='';this.dataset={};this.attributes={};this.focused=0;this.disabled=false;this.properties={};this.style={setProperty:(key,value)=>this.properties[key]=value};this.classes=new Set();this.classList={toggle:(key,on)=>{if(on)this.classes.add(key);else this.classes.delete(key);}};}
 setAttribute(key,value){this.attributes[key]=String(value);}
 removeAttribute(key){delete this.attributes[key];}
 focus(){this.focused++;}
}
function surface(){const elements=new Map();return{elements,$:selector=>{if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);}};}

test('combat menu opens field inventory independently of the closed objective disclosure and respects input guards',()=>{
 const {$}=surface();let keys=0,clears=0,releases=0,allowed=true;
 const context=vm.createContext({$,playing:true,feedback:{isOpen:()=>false},sortieHud:{inventoryOpen:false,key(code){assert.equal(code,'KeyB');keys++;if(!allowed)return false;this.inventoryOpen=!this.inventoryOpen;return true;}},document:{pointerLockElement:{},exitPointerLock(){releases++;this.pointerLockElement=null;}},clearInputs(){clears++;}});
 vm.runInContext(fragment(app,'toggleFieldInventory'),context);
 $('#objectivesPanel').open=false;$('#combatMenu').open=true;
 assert.equal(context.toggleFieldInventory(),true);
 assert.equal(context.sortieHud.inventoryOpen,true);assert.equal($('#objectivesPanel').open,false);
 assert.equal($('#combatMenu').open,false);assert.equal($('#gameFieldInventory').attributes['aria-expanded'],'true');
 assert.equal($('#battle').focused,1);assert.equal(keys,1);assert.equal(clears,1);assert.equal(releases,1);
 for(const guard of['stopped','modal','report']){
  context.playing=guard!=='stopped';$('#modal').open=guard==='modal';context.feedback.isOpen=()=>guard==='report';
  assert.equal(context.toggleFieldInventory(),false,guard+' prevents field input');
 }
 assert.equal(keys,1);assert.equal(clears,1);
 context.playing=true;$('#modal').open=false;context.feedback.isOpen=()=>false;allowed=false;
 assert.equal(context.toggleFieldInventory(),false,'a sortie without a field inventory stays closed');assert.equal(clears,1);
});

test('an open combat menu sends neutral input without consuming queued field choices',()=>{
 const {$}=surface();let consumed=0;
 const context=vm.createContext({$,world:{players:[{id:'self'}]},localId:'self',feedback:{isOpen:()=>false},view:{yaw:0},keys:{},touch:{left:false,right:false},mouse:{left:true,right:false},handPress:{left:true,right:false},pressAbility:true,pressMelee:false,pressDash:true,movementInput:()=>({x:1,y:0}),getAim:()=>({angle:0}),sortieHud:{consumeInput(){consumed++;return{upgrade:{id:'hull',revision:3},fieldAction:{id:'cache',revision:2}};}}});
 vm.runInContext(fragment(app,'getInput'),context);
 $('#combatMenu').open=true;
 const neutral=context.getInput();assert.equal(neutral.x,0);assert.equal(neutral.y,0);assert.equal(neutral.fire,false);assert.equal(neutral.upgrade,undefined);assert.equal(consumed,0);
 $('#combatMenu').open=false;
 const active=context.getInput();assert.equal(active.x,1);assert.equal(active.left,true);assert.equal(active.upgrade.id,'hull');assert.equal(active.fieldAction.id,'cache');assert.equal(consumed,1);
 assert.equal(context.pressAbility,false);assert.equal(context.pressDash,false);assert.equal(context.handPress.left,false);
});

function sortie(){
 const build=chassisBlueprint('vanguard');build.equipment[1]='rail';
 const progression={mech:treeFor('mech','vanguard').branches.flatMap(branch=>branch.nodes.map(node=>node.id)),pilot:treeFor('pilot','Pilot').branches.flatMap(branch=>branch.nodes.map(node=>node.id))};
 const w=newWorld(campaignRound('ashgate',42),[{id:'self',name:'Pilot',build,progression}]),p=w.players[0];
 w.enemies=[];w.spawn=[];w.field.nodes=[];w.operation.nextWave=w.operation.nextStrike=1e9;return{w,p};
}
function acquire(w,p,kind,id){
 const node={id:'shell-fixture-'+w.field.nodes.length,kind,x:p.x,y:p.y,z:p.altitude,state:'ready',revision:0,cost:0,claimed:[],[kind==='cache'?'itemId':'relayId']:id};
 w.field.nodes.push(node);assert.equal(interactField(w,p,{id:node.id,revision:0}),true);
}
function cockpit(w){
 const {$,elements}=surface();
 const context=vm.createContext({$,world:w,localId:'self',view:{yaw:0},destructionLab:{update(){}},sortieHud:{inventoryOpen:false,update(){}},mouseLook:{paused:false},combatStats,combatRecovery,hullStatus,ultimateStatus,taskStatus,objectiveStatus,squadStatus,WEAPONS,ABILITIES,COMBAT_MOVES,specialFor,itemIcon:()=>'<svg></svg>',escape:String,updateMotionReticle(){}});
 vm.runInContext(fragment(app,'updateWeaponHud')+'\n'+fragment(app,'updateHud'),context);
 return{$,elements,update:()=>context.updateHud()};
}

test('the primary hull display follows trained and changing field maximums without a workshop build replacement',()=>{
 const {w,p}=sortie(),hud=cockpit(w),build=p.build,trained=combatStats(p).hp;
 assert.ok(trained>mechStats(build).hp);
 for(const [label,install] of[['trained base',()=>{}],['Spall liner',()=>acquire(w,p,'cache','spall')],['Redline governor',()=>acquire(w,p,'cache','redline')]]){
  install();const max=combatStats(p).hp;p.hp=max*.48;hud.update();
  assert.equal(hud.$('#hullValue').textContent,String(Math.ceil(p.hp)),label+' keeps the actual current value');
  assert.equal(hud.$('#hullMeter').attributes['aria-valuetext'],`${Math.ceil(p.hp)} of ${Math.ceil(max)} hull health, damaged`,label+' uses the current deployed maximum');
  assert.equal(hud.$('#hullMeter').attributes['aria-valuenow'],'48');assert.equal(hud.$('#hullFill').style.width,'48%');assert.equal(hud.$('#hullHealth').dataset.state,'damaged');
  assert.equal(p.build,build,'field acquisitions preserve the workshop build identity');
 }
});

test('primary weapon, dash and special countdowns show actual recharge seconds while fills retain nominal progress',()=>{
 const {w,p}=sortie();
 for(const [kind,id]of[['cache','redline'],['relay','barrage'],['relay','velocity'],['relay','capacitor']])acquire(w,p,kind,id);
 const hud=cockpit(w),rates=combatRecovery(p);assert.ok(rates.weaponRate>1&&rates.dashRate>1&&rates.specialRate>1);
 p.dashCd=2;p.abilityCd=10;p.active=0;
 const right=p.hands[1],interval=WEAPONS[right.item].rate;right.shot=interval;right.triggerHeld=false;
 hud.update();
 assert.equal(hud.$('#rightHandCooldown').textContent,(interval/rates.weaponRate).toFixed(1)+'s');
 assert.notEqual(hud.$('#rightHandCooldown').textContent,interval.toFixed(1)+'s');
 assert.equal(hud.$('#dashCd').textContent,(2/rates.dashRate).toFixed(1)+'s');assert.notEqual(hud.$('#dashCd').textContent,'2.0s');
 assert.equal(hud.$('#abilityCd').textContent,(10/rates.specialRate).toFixed(1)+'s');assert.notEqual(hud.$('#abilityCd').textContent,'10.0s');
 assert.equal(hud.$('#rightHandButton').properties['--recovery'],'0%');
 const dashFill=parseFloat(hud.$('#dashButton').properties['--charge']);assert.ok(Math.abs(dashFill-(1-2/COMBAT_MOVES.dash.cd)*100)<1e-8,'progress is not divided by the recharge factor a second time');
 const beforeDash=p.dashCd/rates.dashRate,beforeSpecial=p.abilityCd/rates.specialRate;
 step(w,.05);hud.update();
 assert.ok(Math.abs(p.dashCd/rates.dashRate-(beforeDash-.05))<1e-8);assert.ok(Math.abs(p.abilityCd/rates.specialRate-(beforeSpecial-.05))<1e-8);
 assert.equal(hud.$('#dashCd').textContent,(p.dashCd/rates.dashRate).toFixed(1)+'s');assert.equal(hud.$('#abilityCd').textContent,(p.abilityCd/rates.specialRate).toFixed(1)+'s');
});

test('the shell identifies Anchorage as the active destination and clears the previous selection on navigation',()=>{
 const rails=['railHome','campaignNav','garageNav'].map(id=>Object.assign(new Element(),{id}));
 const context=vm.createContext({document:{body:{dataset:{screen:'hub'}},querySelectorAll:()=>rails},matchMedia:()=>({matches:true})});
 vm.runInContext(fragment(shell,'syncShell'),context);context.syncShell();
 assert.equal(rails[1].attributes['aria-current'],'page');assert.equal(rails[0].attributes['aria-current'],undefined);
 context.document.body.dataset.screen='garage';context.syncShell();assert.equal(rails[1].attributes['aria-current'],undefined);assert.equal(rails[2].attributes['aria-current'],'page');
});

test('the production System-menu guard neutralizes hub movement while a utility or report is open',()=>{
 const {$}=surface(),blocked=app.match(/^\s*inputBlocked:(.*),\r?$/m);assert.ok(blocked);
 const input=hub.match(/    input\(\)\{([\s\S]*?)\n    \},/);assert.ok(input);
 const active=hub.split(/\r?\n/).find(line=>line.trimStart().startsWith('const active='));assert.ok(active);
 const context=vm.createContext({$,feedback:{isOpen:()=>false},document:{querySelector:$},visible:()=>true,station:null,route:[],touch:{x:1,z:0},pressed:new Set(),actions:{}});
 context.actions.inputBlocked=vm.runInContext('('+blocked[1]+')',context);
 vm.runInContext(active+'\nfunction hubInput(){'+input[1]+'\n}',context);
 assert.equal(context.hubInput().x,1);
 $('#interfaceMenu').open=true;assert.equal(context.hubInput().x,0);assert.equal(context.hubInput().z,0);
 $('#interfaceMenu').open=false;context.feedback.isOpen=()=>true;assert.equal(context.hubInput().x,0);
 context.feedback.isOpen=()=>false;assert.equal(context.hubInput().x,1);
});
