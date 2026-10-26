import test from 'node:test';
import assert from 'node:assert/strict';
import{newCareer,awardCareerForWorld,careerProfile}from '../dist/career-progression.js';
import{newCampaign,campaignMission,recordSortie}from '../dist/campaign.js';
import{chassisBlueprint}from '../dist/chassis.js';
import{newWorld,snapshot}from '../dist/core.js';

test('host and guest each settle only their deployed chassis and local pilot from the same final snapshot',()=>{
 const campaign=newCampaign(46),world=newWorld(campaignMission(campaign),[
  {id:'host',name:'HOST',build:chassisBlueprint('ronin')},
  {id:'guest',name:'GUEST',build:chassisBlueprint('citadel')}
 ]);
 world.status='won';
 const remote=JSON.parse(JSON.stringify(snapshot(world)));
 const host=awardCareerForWorld(newCareer(),world,'host','HOST');
 const guest=awardCareerForWorld(newCareer(),remote,'guest','GUEST');
 assert.equal(careerProfile(host,'mech','ronin').earned,2);
 assert.equal(careerProfile(host,'mech','citadel').earned,1);
 assert.equal(careerProfile(guest,'mech','citadel').earned,2);
 assert.equal(careerProfile(guest,'pilot','GUEST').earned,2);
 assert.equal(careerProfile(guest,'pilot','HOST').earned,1);
 assert.equal(awardCareerForWorld(guest,remote,'guest','GUEST'),guest);
 assert.equal(awardCareerForWorld(host,world,'host','HOST'),host);
 // Settling the run and starting another campaign never changes career balances.
 recordSortie(campaign,'victory',{outcome:'victory',missionId:world.mission.missionId});
 newCampaign(47);
 assert.equal(careerProfile(guest,'mech','citadel').earned,2);
});

test('playing, defeat, withdrawal, practice, non-campaign and absent pilots cannot earn career points',()=>{
 const state=newCareer(),world=newWorld(campaignMission(newCampaign(46)),[{id:'p',build:chassisBlueprint('warden')}]);
 for(const status of['playing','lost','withdrawn'])assert.equal(awardCareerForWorld(state,{...world,status},'p','Pilot'),state);
 const won={...world,status:'won'};
 for(const mission of[{...won.mission,practice:true},{...won.mission,raid:false},{...won.mission,campaign:null},{...won.mission,mode:'sandbox'}])assert.equal(awardCareerForWorld(state,{...won,mission},'p','Pilot'),state);
 assert.equal(awardCareerForWorld(state,won,'disconnected','Pilot'),state);
 assert.equal(awardCareerForWorld(state,{...won,players:null},'p','Pilot'),state);
 assert.equal(awardCareerForWorld(state,null,'p','Pilot'),state);
});
