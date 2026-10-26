import test from 'node:test';
import assert from 'node:assert/strict';
import {createSortieHud} from '../dist/sortie-view.js';
import {newWorld,setInput,step} from '../dist/core.js';
import {campaignRound} from '../dist/mission-catalog.js';
import {chassisBlueprint} from '../dist/chassis.js';
import {rewardDefeat,fieldOffer} from '../dist/sortie-progression.js';

// A nullable, parent-aware DOM surface exercises placement and command behavior.
// It intentionally provides no geometry and makes no browser/layout assertions.
class Element{
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.className='';this.hidden=false;this.open=false;this.children=[];this.attributes={};this.handlers={};this.parentElement=null;this.style={setProperty(){}};this._html='';}
 set innerHTML(html){this._html=html;this.children=[];for(const match of html.matchAll(/id="([^"]+)"/g))this.append(new Element('div',match[1]));}
 get innerHTML(){return this._html;}
 append(...children){for(const child of children){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(value=>value!==child);child.parentElement=this;this.children.push(child);}}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 matches(selector){return selector[0]==='#'?this.id===selector.slice(1):selector[0]==='.'?this.className.split(/\s+/).includes(selector.slice(1)):this.tagName.toLowerCase()===selector;}
 querySelector(selector){const parts=selector.split(/\s+/);for(const child of this.children){if(child.matches(parts[0])){if(parts.length===1)return child;const nested=child.querySelector(parts.slice(1).join(' '));if(nested)return nested;}const nested=child.querySelector(selector);if(nested)return nested;}return null;}
 contains(other){return other===this||this.children.some(child=>child.contains(other));}
}
function setup(t){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),root=new Element('section','game'),objectives=new Element('details','objectivesPanel'),details=new Element();details.className='objective-details';objectives.append(details);root.append(objectives);
 const doc={createElement:tag=>new Element(tag),pointerLockElement:null,activeElement:null,exitPointerLock(){this.pointerLockElement=null;}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:doc});t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const hud=createSortieHud(root),world=newWorld(campaignRound('ashgate',42),[{id:'pilot',name:'Pilot',build:chassisBlueprint('vanguard')}]),player=world.players[0];
 world.time=1;for(let index=0;index<4;index++)rewardDefeat(world,{id:'enemy'+index,type:'drone',lastHitBy:player.id,x:1000,y:1000});hud.update(world,player);
 return{root,objectives,details,hud,world,player,doc,inventory:root.querySelector('#fieldInventory'),drawer:root.querySelector('#fieldInventoryPanel'),toggle:root.querySelector('#fieldInventoryToggle'),offers:root.querySelector('#fieldOffers'),nearby:root.querySelector('#fieldInteraction')};
}
const click=button=>({target:{closest:()=>button}});

test('closed objectives keep run summary disclosed while B and the external menu path open independent inventory',t=>{
 const {root,objectives,details,hud,world,player,inventory,drawer,toggle}=setup(t);
 player.field.upgrades=['power','power'];player.field.items=['gyro'];hud.update(world,player);
 assert.equal(objectives.open,false);assert.equal(details.contains(root.querySelector('#sortieHud')),true);assert.equal(details.contains(drawer),false);assert.equal(drawer.parentElement,root);assert.equal(drawer.hidden,true);
 // The combat menu invokes this same public key path, without touching objectives.
 assert.equal(hud.key('KeyB'),true);assert.equal(objectives.open,false);assert.equal(drawer.hidden,false);assert.equal(inventory.hidden,false);assert.equal(hud.inventoryOpen,true);
 assert.match(inventory.innerHTML,/Weapon overdrive/);assert.match(inventory.innerHTML,/×2/);assert.match(inventory.innerHTML,/Counterweight gyro/);assert.equal(toggle.getAttribute('aria-expanded'),'true');
 toggle.handlers.click();assert.equal(drawer.hidden,true);assert.equal(hud.inventoryOpen,false);assert.equal(objectives.open,false);
 assert.equal(hud.key('KeyB'),true);assert.equal(drawer.hidden,false);assert.equal(objectives.open,false);
});

test('touch and number choices remain outside closed objectives and deliver one live upgrade command',t=>{
 const {root,objectives,hud,world,player,offers}=setup(t),choice=fieldOffer(world,player)[0];
 assert.equal(offers.parentElement,root);assert.equal(offers.hidden,false);assert.equal(objectives.open,false);
 let stopped=false,prevented=false;offers.handlers.pointerdown({stopPropagation(){stopped=true;},preventDefault(){prevented=true;},target:{closest:()=>({})}});assert.equal(stopped,true);assert.equal(prevented,true);
 offers.handlers.click(click({dataset:{fieldUpgrade:choice.id}}));const command=hud.consumeInput();assert.deepEqual(command,{upgrade:{id:choice.id,revision:choice.revision}});assert.deepEqual(hud.consumeInput(),{});
 assert.equal(hud.key('Digit1'),true);assert.deepEqual(hud.consumeInput(),{},'click/key duplicates do not install twice');
 const before=player.x;setInput(world,player.id,{x:1,angle:0,...command});step(world,.05);hud.update(world,player);
 assert.equal(world.status,'playing');assert.ok(player.x>before);assert.ok(player.field.upgrades.includes(choice.id));assert.equal(offers.hidden,true);assert.equal(objectives.open,false);
});

test('closed objectives do not block touch cache actions, affordability or duplicate-command guards',t=>{
 const {root,objectives,hud,world,player,nearby}=setup(t),node={id:'cache',kind:'cache',itemId:'gyro',revision:4,cost:18,state:'ready',claimed:[],x:player.x,y:player.y,z:player.altitude};
 world.field.nodes=[node];player.field.nearby=node.id;world.sortie.salvage=10;hud.update(world,player);
 assert.equal(nearby.parentElement,root);assert.equal(nearby.hidden,false);assert.equal(objectives.open,false);assert.match(nearby.innerHTML,/NEED 18/);
 nearby.handlers.click(click({}));assert.deepEqual(hud.consumeInput(),{});
 world.sortie.salvage=20;hud.update(world,player);nearby.handlers.click(click({}));assert.deepEqual(hud.consumeInput(),{fieldAction:{id:'cache',revision:4}});assert.equal(hud.key('KeyF'),true);assert.deepEqual(hud.consumeInput(),{});
 player.field.items=['gyro','gyro','gyro'];hud.update(world,player);assert.match(nearby.innerHTML,/TECH FULL/);assert.equal(hud.key('KeyF'),false);assert.equal(objectives.open,false);
});

test('mission replacement closes independent inventory and drops queued field requests',t=>{
 const {objectives,hud,world,player,drawer}=setup(t);
 hud.key('KeyB');hud.key('Digit1');assert.equal(drawer.hidden,false);
 world.mission.seed++;hud.update(world,player);assert.equal(drawer.hidden,true);assert.equal(hud.inventoryOpen,false);assert.deepEqual(hud.consumeInput(),{});assert.equal(objectives.open,false);
 assert.equal(hud.key('KeyB'),true);assert.equal(drawer.hidden,false);assert.equal(objectives.open,false);
});
