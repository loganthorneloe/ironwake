import test from 'node:test';
import assert from 'node:assert/strict';
import{chassisBlueprint}from '../dist/chassis.js';
import{newWorld,step,snapshot,mechStats,combatStats}from '../dist/core.js';
import{newCampaign,cleanCampaign,registerPilot,campaignMission,recordSortie,profileFor,refitOffer,installRefit}from '../dist/campaign.js';
import{newCareer,cleanCareer,careerProfile,availablePoints,deploymentProgression,awardCareerForWorld}from '../dist/career-progression.js';
import{mutateCareerAtHub}from '../dist/career-hub.js';
import{HUB_STATIONS,HUB_CATALOG,newHubSave,cleanHubSave,syncHubPlayers,setHubInput,stepHub,nearStation,purchaseAtStation,ownsLicense,missingLicenses,rewardHub}from '../dist/hub-state.js';
import{sortieReport}from '../dist/sortie-progression.js';

const json=value=>JSON.parse(JSON.stringify(value));
const member=(id,name,chassis,career=newCareer())=>({id,name,build:chassisBlueprint(chassis),progression:deploymentProgression(career,chassis,name)});
function walk(state,id,stationId){
 const p=state.players.find(p=>p.id===id),station=HUB_STATIONS.find(s=>s.id===stationId);
 for(const point of[{x:0,z:Math.max(-6.5,p.z)},{x:0,z:station.z},station]){
  for(let i=0;i<300&&Math.hypot(point.x-p.x,point.z-p.z)>.7;i++){
   const dx=point.x-p.x,dz=point.z-p.z,length=Math.hypot(dx,dz);setHubInput(state,id,{x:dx/length,z:dz/length});stepHub(state,.05);
  }
  assert.ok(Math.hypot(point.x-p.x,point.z-p.z)<=.7,'existing deck route reaches the station');
 }
 setHubInput(state,id,{x:0,z:0});assert.ok(nearStation(state,id,stationId));
}
function certify(career,state,id,pilot,kind,key,nodeId){
 const next=mutateCareerAtHub(career,{state,playerId:id,pilot,playing:false,connecting:false,world:null},{kind,key,nodeId,revision:career.revision});
 assert.notEqual(next,career,'station accepts the earned certification');return next;
}
function quietEncounter(world){
 // Deterministic combat outcomes isolate the real objective/extraction lifecycle.
 world.operation.nextWave=world.operation.nextStrike=1e9;
 for(const p of world.players)p.recoverUntil=1e9;
}
function clearPurge(world){
 assert.equal(world.mission.spec.kind,'purge');quietEncounter(world);
 const required=world.mission.spec.kills+8*(world.players.length-1);
 world.time=world.mission.spec.minimum-.1;world.kills=required-1;step(world,.05);
 assert.equal(world.operation.phase,0,'the objective still needs its final combat defeat');
 world.kills=required;
 for(let i=0;i<5&&world.operation.phase===0;i++)step(world,.05);
 assert.equal(world.operation.phase,1);assert.equal(world.status,'playing','objective completion alone does not extract');
}
function recoverSalvage(world){
 assert.equal(world.mission.spec.kind,'salvage');quietEncounter(world);world.time=world.mission.spec.minimum+1;
 const pilot=world.players[0];
 for(const cell of world.operation.cells){
  const cache=world.enemies.find(e=>e.id==='cache-'+cell.id);assert.ok(cache);cache.hp=0;
  Object.assign(pilot,{x:cell.x,y:cell.y,altitude:cell.z});step(world,.05);
  assert.equal(cell.state,'carried','breaking a cache and reaching it picks up the cell');
  Object.assign(pilot,{x:world.operation.crawler.x,y:world.operation.crawler.y,altitude:0});step(world,.05);
  assert.equal(cell.state,'delivered','grounded delivery advances the authored objective');
 }
 assert.equal(world.operation.delivered,world.operation.cells.length);assert.equal(world.operation.phase,1);assert.equal(world.status,'playing');
}
function extract(world){
 world.time=Math.max(world.time,world.operation.shipAt+.1);
 for(const p of world.players)Object.assign(p,{...world.mission.exit,altitude:130});
 step(world,.05);assert.equal(world.extractTime,0,'airborne pilots cannot finish extraction');
 if(world.players.length>1){
  Object.assign(world.players[0],{...world.mission.exit,altitude:0});
  for(let i=0;i<70;i++){world.players[1].altitude=130;step(world,.05);}
  assert.equal(world.status,'playing','one pilot cannot extract while a squadmate remains airborne');
 }
 for(const p of world.players)Object.assign(p,{...world.mission.exit,altitude:0});
 for(let i=0;i<70&&world.status==='playing';i++)step(world,.05);
 assert.equal(world.status,'won');assert.equal(world.cleared,3);assert.ok(world.extractTime>=3);
}

test('hub campaign lifecycle carries permanent upgrades through two authored sorties, resume, defeat and a new run',()=>{
 let campaign=registerPilot(newCampaign(81),'Ace'),career=newCareer(),armory=newHubSave();
 let pilot=member('local','Ace','vanguard',career),hub=syncHubPlayers(null,[pilot]);
 assert.equal(campaign.level,0);assert.equal(campaign.runState,'active');assert.equal(hub.players[0].z,19);
 assert.deepEqual(missingLicenses(armory,pilot.build),[]);
 assert.equal(mutateCareerAtHub(career,{state:hub,playerId:'local',pilot:'Ace'},{kind:'mech',key:'vanguard',nodeId:'vanguard.frame.1',revision:0}),career);

 walk(hub,'local','parts');
 const license=HUB_CATALOG.find(item=>item.vendor==='parts'&&item.price>0&&item.level===0);
 armory=purchaseAtStation(armory,hub,'local',{id:license.id,revision:armory.revision});assert.ok(ownsLicense(armory,license.id));assert.equal(armory.credits,360-license.price);
 career=certify(career,hub,'local','Ace','mech','vanguard','vanguard.frame.1');
 walk(hub,'local','story');career=certify(career,hub,'local','Ace','pilot','Ace','survival.1');
 walk(hub,'local','mission');assert.ok(nearStation(hub,'local','mission'));
 pilot=member('local','Ace','vanguard',career);
 const first=newWorld(campaignMission(campaign),[pilot]);
 assert.equal(first.mission.missionId,'ashgate');assert.deepEqual(first.players[0].progression,pilot.progression);
 assert.equal(first.players[0].hp,Math.round(mechStats(pilot.build).hp*1.07));
 assert.equal(mutateCareerAtHub(career,{state:hub,playerId:'local',pilot:'Ace',world:first},{kind:'mech',key:'vanguard',nodeId:'vanguard.role.1',revision:career.revision}),career);
 clearPurge(first);extract(first);

 const firstReport=sortieReport(first,'victory'),beforeCredits=armory.credits;
 career=awardCareerForWorld(career,first,'local','Ace');campaign=recordSortie(campaign,'victory',firstReport);armory=rewardHub(armory,campaign);
 assert.equal(campaign.level,1);assert.equal(campaign.lastReport.missionId,'ashgate');assert.ok(campaign.records['ashgate:frontline']>0);
 assert.equal(careerProfile(career,'mech','vanguard').earned,2);assert.equal(careerProfile(career,'pilot','Ace').earned,2);
 assert.equal(availablePoints(career,'mech','vanguard'),1);assert.equal(armory.bestLevel,1);
 assert.equal(armory.credits,beforeCredits+120+Math.min(180,Math.floor(firstReport.salvage/2)));
 assert.equal(awardCareerForWorld(career,first,'local','Ace'),career);assert.equal(rewardHub(armory,campaign),armory);
 assert.equal(recordSortie(campaign,'victory',firstReport),campaign,'return/reload cannot settle the previous mission again');

 hub=syncHubPlayers(null,[pilot]);assert.equal(hub.players[0].z,19,'return lands at the arrival berth');assert.ok(!nearStation(hub,'local','parts'));
 const offer=refitOffer(campaign,'Ace')[0];assert.ok(offer);walk(hub,'local','supply');
 const careerBeforeRefit=json(career);campaign=installRefit(campaign,'Ace',{id:offer,revision:campaign.revision});assert.deepEqual(career,careerBeforeRefit);
 const saved=json({campaign,career,armory,build:pilot.build}),originalStats=combatStats(first.players[0]);
 campaign=cleanCampaign(saved.campaign);career=cleanCareer(saved.career);armory=cleanHubSave(saved.armory);
 assert.deepEqual({campaign,career,armory},{campaign:saved.campaign,career:saved.career,armory:saved.armory});
 pilot={...member('local','Ace','vanguard',career),build:saved.build};hub=syncHubPlayers(null,[pilot]);
 assert.equal(hub.players[0].z,19,'continue enters the same harbor at arrival, keeping saved progression');
 walk(hub,'local','mission');const second=newWorld(campaignMission(campaign),[pilot]);
 assert.equal(second.mission.missionId,'glasswater');assert.equal(second.mission.sector,2);
 assert.deepEqual(second.players[0].progression,first.players[0].progression);assert.equal(combatStats(second.players[0]).hp,originalStats.hp);
 assert.deepEqual(second.players[0].field.modules,[offer]);assert.ok(ownsLicense(armory,license.id));
 recoverSalvage(second);extract(second);
 const secondReport=sortieReport(second,'victory'),previousCareer=career,previousArmory=armory;
 career=awardCareerForWorld(career,second,'local','Ace');campaign=recordSortie(campaign,'victory',secondReport);armory=rewardHub(armory,campaign);
 assert.equal(campaign.level,2);assert.equal(campaignMission(campaign).missionId,'relay-nine');assert.ok(campaign.records['glasswater:frontline']>0);
 assert.equal(careerProfile(career,'mech','vanguard').earned,3);assert.equal(careerProfile(career,'pilot','Ace').earned,3);
 assert.equal(career.receipts.length,2);assert.equal(armory.rewarded.length,2);assert.ok(armory.credits>previousArmory.credits);
 assert.equal(previousCareer.receipts.length,1);assert.equal(awardCareerForWorld(career,second,'local','Ace'),career);assert.equal(rewardHub(armory,campaign),armory);

 const third=newWorld(campaignMission(campaign),[member('local','Ace','vanguard',career)]);third.operation.redeploys=0;third.players[0].hp=0;step(third,.05);
 assert.equal(third.status,'lost');const retainedCareer=json(career),retainedArmory=json(armory);
 assert.equal(awardCareerForWorld(career,third,'local','Ace'),career);
 campaign=recordSortie(campaign,'defeat',sortieReport(third,'defeat'));assert.equal(campaign.runState,'lost');assert.equal(rewardHub(armory,campaign),armory);
 assert.equal(recordSortie(campaign,'victory',secondReport),campaign,'a failed run cannot advance again');
 campaign=registerPilot({...newCampaign(82),records:campaign.records},'Ace');
 assert.equal(campaign.level,0);assert.equal(campaign.runState,'active');assert.equal(profileFor(campaign,'Ace').credits,0);assert.deepEqual(profileFor(campaign,'Ace').modules,[]);
 assert.deepEqual(career,retainedCareer);assert.deepEqual(armory,retainedArmory);assert.ok(campaign.records['ashgate:frontline']>0);
 assert.deepEqual(deploymentProgression(career,'vanguard','Ace'),pilot.progression);assert.equal(campaignMission(campaign).missionId,'ashgate');
});

test('a guest settles the completed shared sortie snapshot into only their local career',()=>{
 let hostCareer=newCareer(),guestCareer=newCareer(),campaign=registerPilot(registerPilot(newCampaign(93),'HOST'),'GUEST',['HOST','GUEST']);
 let roster=[member('host','HOST','ronin',hostCareer),member('guest','GUEST','citadel',guestCareer)];
 const hub=syncHubPlayers(null,roster);
 walk(hub,'guest','parts');guestCareer=certify(guestCareer,hub,'guest','GUEST','mech','citadel','citadel.frame.1');
 walk(hub,'guest','story');guestCareer=certify(guestCareer,hub,'guest','GUEST','pilot','GUEST','survival.1');
 roster=[member('host','HOST','ronin',hostCareer),member('guest','GUEST','citadel',guestCareer)];
 const world=newWorld(campaignMission(campaign),roster);clearPurge(world);extract(world);
 const remote=json(snapshot(world));assert.equal(remote.status,'won');assert.equal(remote.mission.campaign.id,campaign.id);
 assert.deepEqual(remote.players[1].progression,roster[1].progression);assert.equal(combatStats(remote.players[1]).hp,combatStats(world.players[1]).hp);
 const beforeHost=json(hostCareer);guestCareer=awardCareerForWorld(guestCareer,remote,'guest','GUEST');
 assert.equal(careerProfile(guestCareer,'mech','citadel').earned,2);assert.equal(careerProfile(guestCareer,'pilot','GUEST').earned,2);
 assert.equal(careerProfile(guestCareer,'mech','ronin').earned,1);assert.equal(careerProfile(guestCareer,'pilot','HOST').earned,1);assert.deepEqual(hostCareer,beforeHost);
 assert.equal(awardCareerForWorld(guestCareer,remote,'guest','GUEST'),guestCareer);assert.equal(awardCareerForWorld(guestCareer,remote,'missing','GUEST'),guestCareer);
 hostCareer=awardCareerForWorld(hostCareer,world,'host','HOST');assert.equal(careerProfile(hostCareer,'mech','ronin').earned,2);assert.equal(careerProfile(hostCareer,'mech','citadel').earned,1);
 campaign=recordSortie(campaign,'victory',sortieReport(world,'victory'));
 const armory=rewardHub(newHubSave(),campaign);assert.equal(rewardHub(armory,cleanCampaign(json(campaign))),armory,'shared host settlement stays single-use after transport');
 const returned=syncHubPlayers(null,roster);assert.ok(returned.players.every(p=>p.z===19));
 assert.deepEqual(cleanCareer(json(guestCareer)),guestCareer);assert.equal(profileFor(campaign,'GUEST').credits,1);
});
