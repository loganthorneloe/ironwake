import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignView} from '../dist/campaign-view.js';
import {newCampaign,profileFor} from '../dist/campaign.js';
import {chassisBlueprint} from '../dist/chassis.js';

// Serialized-view checks exercise the actual tab/action handlers. They do not
// establish browser layout or touch correctness for the combined candidate.
function command(t,actions={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:null}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const handlers={},root={innerHTML:'',addEventListener(type,handler){handlers[type]=handler;},contains(){return false;},querySelectorAll(){return[];},querySelector(){return null;}};
 const view=createCampaignView(root,actions),campaign=newCampaign(42),build=chassisBlueprint('vanguard');
 const state={campaign,build,saved:[],members:[{id:'local',name:'Ace',build,ready:false}],localId:'local',room:'',isHost:true,connecting:false,canChoose:true,licensed:true};
 const click=dataset=>{const target={dataset,closest(){return this;}};handlers.click({target});};
 return{root,view,state,click};
}

test('redesigned Command keeps carried hardware and routes refits through the Anchorage supply station',t=>{
 let visits=0,refits=0;
 const {root,view,state,click}=command(t,{supply(){visits++;},refit(){refits++;}});
 const profile=profileFor(state.campaign,'Ace');profile.upgrades=['hull','hull'];profile.items=['gyro'];profile.modules=['plating'];profile.credits=2;state.campaign.pilots.push(profile);
 const saved=JSON.stringify(state);
 view.render(state);
 assert.match(root.innerHTML,/class="battlefield-scan"/,'Operations retains the geometry survey instead of reverting to the predecessor card layout');
 assert.equal((root.innerHTML.match(/class="route-stop /g)||[]).length,9);
 click({tab:'refits'});
 assert.match(root.innerHTML,/aria-selected="true"[^>]*data-tab="refits"/);
 assert.match(root.innerHTML,/<strong>Bulkhead lattice<\/strong>[\s\S]*?<b>×2<\/b>/);
 assert.match(root.innerHTML,/<strong>Counterweight gyro<\/strong>[\s\S]*?<b>×1<\/b>/);
 assert.match(root.innerHTML,/data-action="supply"/);
 assert.doesNotMatch(root.innerHTML,/data-refit=/,'Command cannot spend station-gated run tokens directly');
 click({action:'supply'});
 assert.equal(visits,1);assert.equal(refits,0);assert.equal(JSON.stringify(state),saved,'viewing the field build cannot spend or mutate progression');
});

test('researched loadout rerenders preserve the chosen tab and license gating without changing workshop gear',t=>{
 const {root,view,state,click}=command(t);
 const before=JSON.stringify(state.build);
 view.render(state);click({tab:'loadout'});
 view.render({...state,deploymentStats:{weight:36,capacity:40,hp:267,issues:[]},licensed:false});
 assert.match(root.innerHTML,/aria-selected="true"[^>]*data-tab="loadout"/);
 assert.match(root.innerHTML,/<div data-deployment-stats>[\s\S]*?267 armor/);
 assert.match(root.innerHTML,/License required/);
 assert.match(root.innerHTML,/<button\b[^>]*data-action="deploy"[^>]*\bdisabled\b/);
 assert.equal(JSON.stringify(state.build),before);
 state.campaign={...state.campaign,level:1,revision:state.campaign.revision+1};
 view.render(state);
 assert.match(root.innerHTML,/aria-selected="true"[^>]*data-tab="operations"/,'mission advancement returns Command to the new objective');
 assert.match(root.innerHTML,/data-level="1"[^>]*aria-current="step"/);
});
