import test from 'node:test';
import assert from 'node:assert/strict';
import {createSortieHud,debriefMarkup} from '../dist/sortie-view.js';
import {newWorld,setInput,step} from '../dist/core.js';
import {campaignRound} from '../dist/mission-catalog.js';
import {chassisBlueprint} from '../dist/chassis.js';
import {rewardDefeat,fieldOffer,sortieReport} from '../dist/sortie-progression.js';

// A small DOM surface verifies HUD state and command wiring without running a browser.
class Element{
 constructor(){this.hidden=false;this.innerHTML='';this.attributes={};this.children=[];this.elements={};this.handlers={};this.style={setProperty(){}};}
 setAttribute(key,value){this.attributes[key]=value;}
 querySelector(selector){return this.elements[selector]??=new Element();}
 append(...children){this.children.push(...children);}
 addEventListener(name,handler){this.handlers[name]=handler;}
}
const setup=()=>{
 const doc={createElement:()=>new Element(),pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;this.released=true;}};
 globalThis.document=doc;const parent=new Element(),hud=createSortieHud(parent),w=newWorld(campaignRound('ashgate',42),[{id:'p',name:'Pilot',build:chassisBlueprint('vanguard')}]),p=w.players[0];
 w.time=1;for(let i=0;i<4;i++)rewardDefeat(w,{id:'e'+i,type:'drone',lastHitBy:'p',x:1000,y:1000});hud.update(w,p);return{doc,parent,hud,w,p,panel:parent.children[0],offers:parent.children[1],nearby:parent.children[2],pickup:parent.children[3]};
};

test('HUD keyboard upgrade commands preserve the live simulation and reject duplicate local submissions',()=>{
 const {hud,w,p,offers}=setup(),choice=fieldOffer(w,p)[1];assert.equal(offers.hidden,false);assert.match(offers.innerHTML,/Combat continues/);assert.match(offers.innerHTML,/data-field-upgrade/);
 assert.equal(hud.key('Digit2'),true);const command=hud.consumeInput();assert.deepEqual(command,{upgrade:{id:choice.id,revision:choice.revision}});assert.deepEqual(hud.consumeInput(),{});assert.equal(hud.key('Digit2'),true);assert.deepEqual(hud.consumeInput(),{});
 const start=p.x;setInput(w,'p',{x:1,angle:0,...command});step(w,.05);assert.equal(w.status,'playing');assert.ok(p.x>start,'selection does not stop movement');assert.ok(p.field.upgrades.includes(choice.id));hud.update(w,p);assert.equal(offers.hidden,true);
});

test('field controls support touch clicks, explicit cursor release and retries after rejected commands',()=>{
 const {hud,w,p,offers,nearby,doc}=setup();const choice=fieldOffer(w,p)[0];offers.handlers.click({target:{closest:()=>({dataset:{fieldUpgrade:choice.id}})}});assert.equal(hud.consumeInput().upgrade.id,choice.id);
 // A request rejected by the host must not leave the upgrade deck disabled forever.
 w.time+=1.3;hud.update(w,p);assert.equal(hud.key('Digit1'),true);assert.ok(hud.consumeInput().upgrade);doc.pointerLockElement={};assert.equal(hud.key('KeyU'),true);assert.equal(doc.released,true);
 const node={id:'fixture-cache',kind:'cache',itemId:'gyro',x:p.x,y:p.y,z:p.altitude,state:'ready',claimed:[],revision:2,cost:18};w.field.nodes=[node];p.field.nearby=node.id;w.sortie.salvage=10;hud.update(w,p);assert.match(nearby.innerHTML,/NEED 18/);assert.equal(hud.key('KeyF'),false);assert.deepEqual(hud.consumeInput(),{});
 w.sortie.salvage=20;hud.update(w,p);assert.equal(hud.key('KeyF'),true);assert.deepEqual(hud.consumeInput(),{fieldAction:{id:node.id,revision:2}});assert.equal(hud.key('KeyF'),true);assert.deepEqual(hud.consumeInput(),{});w.time+=.6;hud.update(w,p);assert.equal(hud.key('KeyF'),true);assert.ok(hud.consumeInput().fieldAction);p.field.items=['gyro','gyro','gyro'];hud.update(w,p);assert.match(nearby.innerHTML,/TECH FULL/);assert.equal(hud.key('KeyF'),false);assert.deepEqual(hud.consumeInput(),{});
});

test('inventory shows stack effects and relay timers, level feedback uses the right label, and disabled pilots cannot choose',()=>{
 const {hud,w,p,panel,pickup,offers}=setup();assert.match(pickup.innerHTML,/FIELD LEVEL GAINED/);p.field.upgrades=['power','power'];p.field.items=['gyro'];p.field.buffs=[{relayId:'assault',expiresAt:w.time+12}];p.field.relayCount=1;
 assert.equal(hud.key('KeyB'),true);hud.update(w,p);const inventory=panel.querySelector('#fieldInventory');assert.equal(inventory.hidden,false);assert.match(inventory.innerHTML,/Weapon overdrive/);assert.match(inventory.innerHTML,/×2/);assert.match(inventory.innerHTML,/Counterweight gyro/);assert.match(inventory.innerHTML,/Assault relay/);assert.match(panel.querySelector('#fieldSummary').innerHTML,/12s/);
 p.hp=0;hud.update(w,p);assert.equal(offers.hidden,true);assert.equal(hud.key('Digit1'),false);assert.deepEqual(hud.consumeInput(),{});w.time+=13;hud.update(w,p);assert.equal(pickup.hidden,true);
});

test('debrief displays recovered field build and escapes pilot text',()=>{
 const {w,p}=setup();p.name='<script>pilot</script>';p.field.upgrades=['hull','hull'];p.field.items=['aegis'];p.field.relayCount=2;const html=debriefMarkup(sortieReport(w,'victory'));
 assert.match(html,/Bulkhead lattice ×2/);assert.match(html,/Aegis inverter ×1/);assert.match(html,/2 relays linked/);assert.match(html,/&lt;script&gt;pilot&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/carry through the campaign/);
});
