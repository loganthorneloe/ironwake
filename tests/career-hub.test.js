import test from 'node:test';
import assert from 'node:assert/strict';
import{careerStationFor,mutateCareerAtHub}from '../dist/career-hub.js';
import{newCareer,cleanCareer,careerProfile,availablePoints,deploymentProgression}from '../dist/career-progression.js';
import{HUB_STATIONS,newHubSave,syncHubPlayers,setHubInput,stepHub,nearStation}from '../dist/hub-state.js';
import{newCampaign,registerPilot,recordSortie,profileFor,refitOffer,installRefit}from '../dist/campaign.js';

const request=(career,kind='mech',key='vanguard',nodeId='vanguard.role.1')=>({kind,key,nodeId,revision:career.revision});
const context=()=>({state:syncHubPlayers(null,[{id:'local'},{id:'friend'}]),playerId:'local',pilot:'Ace',playing:false,connecting:false,world:null});
function walkTo(ctx,stationId){
 const player=ctx.state.players.find(p=>p.id===ctx.playerId),station=HUB_STATIONS.find(s=>s.id===stationId);
 for(const point of[{x:0,z:Math.max(-6.5,player.z)},{x:0,z:station.z},station]){
  for(let i=0;i<300&&Math.hypot(point.x-player.x,point.z-player.z)>.7;i++){
   const dx=point.x-player.x,dz=point.z-player.z,length=Math.hypot(dx,dz);
   setHubInput(ctx.state,ctx.playerId,{x:dx/length,z:dz/length});stepHub(ctx.state,.05);
  }
  assert.ok(Math.hypot(point.x-player.x,point.z-player.z)<=.7,'walking route reaches its waypoint');
 }
 setHubInput(ctx.state,ctx.playerId,{x:0,z:0});assert.ok(nearStation(ctx.state,ctx.playerId,stationId));
}

test('walking to existing foundry and archive gives separate personal certification access',()=>{
 const ctx=context(),initial=newCareer();
 assert.equal(careerStationFor('mech'),'parts');assert.equal(careerStationFor('pilot'),'story');assert.equal(careerStationFor('run'),null);
 assert.equal(mutateCareerAtHub(initial,ctx,request(initial)),initial,'arrival berth has no certification access');
 walkTo(ctx,'parts');
 const researched=mutateCareerAtHub(initial,ctx,request(initial));
 assert.notEqual(researched,initial);assert.equal(availablePoints(researched,'mech','vanguard'),0);
 assert.equal(availablePoints(researched,'pilot','Ace'),1);assert.deepEqual(initial,newCareer());
 assert.equal(mutateCareerAtHub(researched,ctx,request(researched,'pilot','Ace','tactics.1')),researched,'pilot training requires the archive');
 walkTo(ctx,'story');
 const trained=mutateCareerAtHub(researched,ctx,request(researched,'pilot','Ace','tactics.1'));
 assert.notEqual(trained,researched);assert.deepEqual(deploymentProgression(trained,'vanguard','Ace'),{mech:['vanguard.role.1'],pilot:['tactics.1']});
 assert.deepEqual(deploymentProgression(trained,'lark','Ace'),{mech:[],pilot:['tactics.1']});
 assert.deepEqual(deploymentProgression(trained,'vanguard','Wing'),{mech:['vanguard.role.1'],pilot:[]});
 assert.equal(mutateCareerAtHub(trained,ctx,request(trained,'mech','lark','lark.role.1')),trained,'archive does not grant foundry access');
});

test('station access preserves prerequisite, budget, revision and authored chassis rules',()=>{
 const ctx=context();walkTo(ctx,'parts');
 const funded=cleanCareer({...newCareer(),mechs:{vanguard:{earned:18}}});
 for(const req of[request(funded,'mech','vanguard','vanguard.role.3'),request(funded,'mech','vanguard','lark.role.1'),request(funded,'mech','missing','vanguard.role.1'),request(funded,'mech',null,'custom.role.1'),{...request(funded),revision:1}])assert.equal(mutateCareerAtHub(funded,ctx,req),funded);
 const browsed=mutateCareerAtHub(funded,ctx,request(funded,'mech','lark','lark.role.1'));
 assert.deepEqual(careerProfile(browsed,'mech','lark').unlocked,['lark.role.1'],'a known browsed chassis can be researched independently');
 assert.equal(availablePoints(browsed,'mech','vanguard'),18);
 assert.equal(mutateCareerAtHub(browsed,ctx,request(browsed,'mech','lark','lark.role.2')),browsed,'research still requires earned points');
 assert.equal(mutateCareerAtHub(browsed,ctx,request(funded)),browsed,'an older panel cannot spend after another purchase');
});

test('combat, loading and connection transitions stop purchases and resets even near a vendor',()=>{
 const ctx=context();walkTo(ctx,'parts');const initial=newCareer(),installed=mutateCareerAtHub(initial,ctx,request(initial));
 for(const block of[{playing:true},{connecting:true},{world:{status:'playing'}},{world:{status:'won'}},{world:{status:'loading'}}]){
  assert.equal(mutateCareerAtHub(initial,{...ctx,...block},request(initial)),initial);
  assert.equal(mutateCareerAtHub(installed,{...ctx,...block},request(installed),true),installed);
 }
 const reset=mutateCareerAtHub(installed,ctx,request(installed),true);
 assert.equal(availablePoints(reset,'mech','vanguard'),1);assert.deepEqual(careerProfile(reset,'mech','vanguard').unlocked,[]);
 assert.equal(reset.revision,installed.revision+1);assert.deepEqual(careerProfile(installed,'mech','vanguard').unlocked,['vanguard.role.1']);
});

test('trusted local pose and callsign control access despite supplied identities or malformed state',()=>{
 const ctx=context(),career=newCareer();walkTo(ctx,'story');
 const pilotRequest=request(career,'pilot','Ace','tactics.1');
 assert.equal(mutateCareerAtHub(career,ctx,{...pilotRequest,key:'Wing'}),career,'another callsign cannot be trained');
 assert.equal(mutateCareerAtHub(career,{...ctx,playerId:'friend'},{...pilotRequest,playerId:'local'}),career,'request player IDs cannot borrow a nearby pose');
 assert.equal(mutateCareerAtHub(career,{...ctx,playerId:'unknown'},pilotRequest),career);
 for(const value of[null,{},[],{players:null},{players:[null]},{players:[{id:'local',x:Infinity,z:0}]},{players:[{id:'local',x:26,z:-7},{id:'local',x:26,z:-7}]}])assert.equal(mutateCareerAtHub(career,{...ctx,state:value},pilotRequest),career);
 for(const pilot of[undefined,null,'',' Ace','Ace ','constructor','__proto__','A'.repeat(25)])assert.equal(mutateCareerAtHub(career,{...ctx,pilot},pilotRequest),career);
 for(const value of[null,undefined,[],{},'purchase'])assert.equal(mutateCareerAtHub(career,ctx,value),career);
 assert.equal(mutateCareerAtHub(career,null,pilotRequest),career);
 assert.equal(mutateCareerAtHub(null,ctx,pilotRequest),null);
 const trained=mutateCareerAtHub(career,ctx,pilotRequest);
 const refunded=mutateCareerAtHub(trained,ctx,request(trained,'pilot','Ace'),true);
 assert.equal(availablePoints(refunded,'pilot','Ace'),1);assert.deepEqual(careerProfile(refunded,'pilot','Ace').unlocked,[]);
});

test('career station spending leaves shared credits, personal run tokens and field modules independent',()=>{
 const ctx=context();walkTo(ctx,'parts');
 const campaign=recordSortie(registerPilot(newCampaign(11),'Ace'),'victory',{outcome:'victory',missionId:'ashgate',salvage:240,seconds:120,pilots:[{name:'Ace'}]}),armory=newHubSave();
 const beforeCampaign=structuredClone(campaign),beforeArmory=structuredClone(armory),initial=newCareer();
 const career=mutateCareerAtHub(initial,{...ctx,campaign,armory},request(initial));
 assert.equal(availablePoints(career,'mech','vanguard'),0);assert.deepEqual(campaign,beforeCampaign);assert.deepEqual(armory,beforeArmory);
 const offer=refitOffer(campaign,'Ace')[0];assert.ok(offer);const refitted=installRefit(campaign,'Ace',{id:offer,revision:campaign.revision});
 assert.equal(profileFor(refitted,'Ace').credits,profileFor(campaign,'Ace').credits-1);assert.deepEqual(profileFor(refitted,'Ace').modules,[offer]);
 assert.equal(availablePoints(career,'mech','vanguard'),0);assert.deepEqual(careerProfile(career,'mech','vanguard').unlocked,['vanguard.role.1']);assert.deepEqual(career.receipts,initial.receipts);
});
