import test from 'node:test';
import assert from 'node:assert/strict';
import{hubTeamKey}from '../dist/hub-view.js';
import{newCampaign,registerPilot,recordSortie}from '../dist/campaign.js';
import{chassisBlueprint}from '../dist/chassis.js';
import{newHubSave}from '../dist/hub-state.js';

test('hub readiness refreshes after defeat and a fresh campaign even with an unchanged squad and loadout',()=>{
 const build=chassisBlueprint('vanguard'),members=[{id:'host',name:'Host',build,ready:false},{id:'guest',name:'Guest',build,ready:false}];
 const state={members,room:'TEST23',isHost:false,connecting:false,build,save:newHubSave()};
 const active=registerPilot(newCampaign(1),'Guest'),failed=recordSortie(active,'defeat',{outcome:'defeat',missionId:'ashgate',pilots:[{name:'Guest'}]});
 const restarted=registerPilot({...newCampaign(2),records:failed.records},'Guest');
 const before=structuredClone(members);
 assert.equal(failed.runState,'lost');assert.equal(restarted.runState,'active');
 assert.notEqual(hubTeamKey({...state,campaign:active}),hubTeamKey({...state,campaign:failed}),'a failed run disables readiness');
 assert.notEqual(hubTeamKey({...state,campaign:failed}),hubTeamKey({...state,campaign:restarted}),'a fresh run enables readiness without requiring a loadout or squad change');
 assert.equal(hubTeamKey({...state,campaign:restarted}),hubTeamKey({...state,campaign:structuredClone(restarted)}),'equivalent network snapshots do not churn the controls');
 assert.deepEqual(members,before);
});
