// Permanent career progression. Campaign refits and combat-time upgrades own separate state.
import{CHASSIS}from './chassis.js';
import{MISSIONS}from './mission-catalog.js';

export const CAREER_VERSION=1;
export const CAREER_POINT_CAP=18;
const MAX_PILOTS=128,MAX_RECEIPTS=256,RESERVED=new Set(['__proto__','prototype','constructor']);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>record(value)&&Object.hasOwn(value,key)?value[key]:undefined;
const count=(value,max,fallback=0)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):fallback;
const pilotKey=value=>{const key=typeof value==='string'?value.trim().slice(0,24).trim():'';return key&&!RESERVED.has(key)?key:null;};
const mechKey=value=>value==null||value==='custom'?'custom':typeof value==='string'&&Object.hasOwn(CHASSIS,value)?value:null;
const identity=(kind,key)=>kind==='mech'?mechKey(key):kind==='pilot'?pilotKey(key):null;
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

// Each role supplies a small foundation; the authored branch names and final techniques
// give each factory chassis its own specialization, including within the same class.
const roles={
 recon:[{speed:.025},{dashRecharge:.04},{speed:.035,dashRecharge:.04}],
 sniper:[{damage:.025},{heavyDamage:.04},{damage:.035,heavyDamage:.04}],
 aerial:[{lift:.035},{dashRecharge:.04},{lift:.045,speed:.025}],
 skirmisher:[{speed:.025},{damage:.03},{speed:.03,damage:.03}],
 melee:[{damage:.025},{dashRecharge:.04},{damage:.04,dashRecharge:.03}],
 assault:[{damage:.025},{hp:.04},{damage:.035,hp:.03}],
 support:[{specialRecharge:.04},{repair:.25},{specialRecharge:.05,repair:.25}],
 defense:[{hp:.04},{damageReduction:-.025},{hp:.04,damageReduction:-.025}],
 artillery:[{heavyDamage:.035},{damage:.025},{heavyDamage:.05,damage:.025}],
 custom:[{damage:.02},{speed:.025},{damage:.025,speed:.025}]
};
const foundations={
 scout:[{hp:.025},{speed:.025},{hp:.035,speed:.02}],
 light:[{hp:.03},{dashRecharge:.03},{hp:.04,dashRecharge:.03}],
 medium:[{hp:.04},{damageReduction:-.02},{hp:.04,damageReduction:-.02}],
 heavy:[{hp:.045},{damageReduction:-.025},{hp:.05,damageReduction:-.025}],
 giga:[{hp:.05},{damageReduction:-.03},{hp:.055,damageReduction:-.03}],
 custom:[{hp:.035},{lift:.025},{hp:.035,lift:.025}]
};
// id, three branch names, three signature names and signature effects.
const signatures=[
 ['lark',['Pathfinder drive','Featherweight shell','Signal runner'],['Open horizon','Slipstream hull','First light'],[{speed:.05,dashRecharge:.04},{hp:.03,speed:.035},{specialRecharge:.06,lift:.03}]],
 ['needle',['Deadeye optics','Ghost frame','Cold capacitor'],['Thread the gap','Vanishing point','Still heart'],[{damage:.04,heavyDamage:.05},{hp:.025,speed:.03},{specialRecharge:.05,damage:.02}]],
 ['wisp',['Cloud dancer','Vapor shell','Ion updraft'],['High cirrus','Mist envelope','Blue thermal'],[{lift:.075,speed:.025},{hp:.03,lift:.04},{dashRecharge:.06,specialRecharge:.03}]],
 ['kestrel',['Pursuit drive','Duelist frame','Strike circuit'],['Talons out','Bank and break','Hunting current'],[{speed:.04,damage:.04},{hp:.04,dashRecharge:.035},{specialRecharge:.05,heavyDamage:.035}]],
 ['ronin',['Edge discipline','Samurai shell','Quickdraw reactor'],['Last cut','Iron resolve','Unsheathed'],[{damage:.06,dashRecharge:.03},{hp:.05,damageReduction:-.02},{dashRecharge:.07,specialRecharge:.025}]],
 ['harrier',['Dive vector','Interceptor frame','Afterburn circuit'],['Falling star','Wing guard','Redline arc'],[{lift:.065,heavyDamage:.035},{hp:.035,speed:.025},{dashRecharge:.05,specialRecharge:.05}]],
 ['vanguard',['Assault doctrine','Forward armor','Command reactor'],['Spearhead','Hold the line','Rally current'],[{damage:.045,hp:.03},{hp:.05,damageReduction:-.02},{specialRecharge:.06,dashRecharge:.025}]],
 ['longbow',['Rangefinder','Counterfire frame','Siege capacitor'],['Perfect solution','Steady platform','Two thunders'],[{damage:.035,heavyDamage:.065},{hp:.04,damageReduction:-.025},{specialRecharge:.05,heavyDamage:.04}]],
 ['warden',['Guardian relay','Escort armor','Triage reactor'],['Unbroken watch','Bodyguard','Second wind'],[{specialRecharge:.055,repair:.4},{hp:.055,damageReduction:-.025},{repair:.55,specialRecharge:.035}]],
 ['bastion',['Anchor protocol','Bulwark shell','Reserve reactor'],['Immovable','Layered fortress','Deep reserve'],[{hp:.06,damageReduction:-.035},{hp:.065,damageReduction:-.025},{specialRecharge:.06,repair:.3}]],
 ['anvil',['Bombardment rig','Shock cradle','Ordnance circuit'],['Hammerfall','Recoil foundation','Rolling barrage'],[{heavyDamage:.08,damage:.025},{hp:.05,damageReduction:-.025},{specialRecharge:.055,heavyDamage:.035}]],
 ['skyguard',['Gunship vector','Armored airframe','Flight reactor'],['Air superiority','Sky fortress','Storm engine'],[{lift:.065,heavyDamage:.045},{hp:.05,lift:.025},{specialRecharge:.045,dashRecharge:.045}]],
 ['colossus',['Breach doctrine','Titan skeleton','War furnace'],['World breaker','Unyielding mass','Heart of iron'],[{damage:.06,heavyDamage:.035},{hp:.075,damageReduction:-.025},{specialRecharge:.05,repair:.35}]],
 ['leviathan',['Siege doctrine','Dreadnought hull','Broadside reactor'],['Final broadside','Continental plate','Endless salvo'],[{heavyDamage:.085,damage:.03},{hp:.07,damageReduction:-.03},{specialRecharge:.06,heavyDamage:.035}]],
 ['citadel',['Fortress relay','Keep walls','Sanctuary core'],['Safe harbor','Living fortress','Beacon of return'],[{repair:.55,specialRecharge:.045},{hp:.08,damageReduction:-.03},{repair:.6,specialRecharge:.04}]],
 ['custom',['Adaptive weapons','Modular frame','Open architecture'],['Personal signature','Built to endure','Unbound circuit'],[{damage:.035,heavyDamage:.035},{hp:.045,lift:.03},{specialRecharge:.055,dashRecharge:.035}]]
];
const effectLabels={hp:'hull',speed:'ground speed',lift:'lift',damage:'damage',heavyDamage:'damage against armored targets',damageReduction:'incoming damage',dashRecharge:'dash recharge',specialRecharge:'special recharge'};
function effectDescription(effects){return Object.entries(effects).map(([id,n])=>id==='repair'?`+${n} hull/sec after the recovery delay`:`${n>=0?'+':''}${Math.round(n*1000)/10}% ${effectLabels[id]}`).join('; ')+'.';}
function branch(prefix,id,name,techniques,effects){return{id,name,description:`Develop ${name.toLowerCase()} through three permanent certifications.`,nodes:effects.map((effect,i)=>({id:`${prefix}${id}.${i+1}`,name:techniques[i],description:effectDescription(effect),cost:i+1,requires:i?[`${prefix}${id}.${i}`]:[],effects:{...effect}}))};}
export const MECH_TREES=freeze(Object.fromEntries(signatures.map(([id,names,capstones,effects])=>{
 const chassis=CHASSIS[id],specialty=chassis?.specialty||'custom',size=chassis?.size||'custom',role=roles[specialty],frame=foundations[size];
 return[id,{id,name:`${chassis?.name||'Custom frame'} certifications`,description:`Permanent ${chassis?.role?.toLowerCase()||'modular frame'} training. Earn a chassis point for each campaign victory; every chassis keeps its own tree.`,branches:[
  branch(id+'.','role',names[0],['Role calibration','Advanced doctrine',capstones[0]],[role[0],role[1],effects[0]]),
  branch(id+'.','frame',names[1],['Hull calibration','Frame reinforcement',capstones[1]],[frame[0],frame[1],effects[1]]),
  branch(id+'.','systems',names[2],['Reactor calibration','Response tuning',capstones[2]],[{specialRecharge:.04},{dashRecharge:.035},effects[2]])
 ]}];
})));
export const PILOT_TREE=freeze({id:'pilot',name:'Pilot disciplines',description:'Permanent training follows this callsign across every chassis. Earn a pilot point for each campaign victory.',branches:[
 branch('','tactics','Tactics',['Target practice','Threat analysis','Combat intuition'],[{damage:.02},{heavyDamage:.035},{damage:.03,heavyDamage:.035}]),
 branch('','survival','Survival',['Emergency drills','Damage control','Veteran composure'],[{hp:.03},{damageReduction:-.025},{hp:.035,repair:.4}]),
 branch('','systems','Systems',['Power management','Vector discipline','Neural synchrony'],[{specialRecharge:.04},{speed:.025,lift:.03},{dashRecharge:.05,specialRecharge:.04}])
]});
export function treeFor(kind,key){return kind==='pilot'&&(key==null||pilotKey(key))?PILOT_TREE:kind==='mech'&&mechKey(key)?MECH_TREES[mechKey(key)]:null;}
const nodesFor=tree=>tree?.branches.flatMap(branch=>branch.nodes)||[];
const spend=(profile,tree)=>nodesFor(tree).reduce((sum,node)=>sum+(profile.unlocked.includes(node.id)?node.cost:0),0);
function cleanUnlocks(value,tree,budget=CAREER_POINT_CAP){
 const wanted=new Set((Array.isArray(value)?value:[]).slice(0,64).filter(id=>typeof id==='string')),unlocked=[];let spent=0;
 for(const node of nodesFor(tree))if(wanted.has(node.id)&&node.requires.every(id=>unlocked.includes(id))&&spent+node.cost<=budget){unlocked.push(node.id);spent+=node.cost;}
 return unlocked;
}
function cleanProfile(value,tree){const earned=Math.max(1,count(own(value,'earned'),CAREER_POINT_CAP,1));return{earned,unlocked:cleanUnlocks(own(value,'unlocked'),tree,earned)};}
export function newCareer(){return{version:CAREER_VERSION,revision:0,mechs:{},pilots:{},receipts:[]};}
const campaignId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=64?value:null;
function cleanReceipt(value){if(typeof value!=='string'||value.length>160)return null;try{const parts=JSON.parse(value);return Array.isArray(parts)&&parts.length===2&&campaignId(parts[0])&&Number.isInteger(parts[1])&&parts[1]>=0&&parts[1]<MISSIONS.length?JSON.stringify(parts):null;}catch{return null;}}
export function cleanCareer(value){
 if(!record(value)||value.version!==CAREER_VERSION)return newCareer();
 const result=newCareer();result.revision=count(value.revision,Number.MAX_SAFE_INTEGER-1);
 for(const [key,profile]of Object.entries(record(value.mechs)?value.mechs:{}))if(mechKey(key)===key)result.mechs[key]=cleanProfile(profile,MECH_TREES[key]);
 for(const [key,profile]of Object.entries(record(value.pilots)?value.pilots:{}).slice(0,MAX_PILOTS))if(pilotKey(key)===key)result.pilots[key]=cleanProfile(profile,PILOT_TREE);
 const receipts=(Array.isArray(value.receipts)?value.receipts:[]).slice(-MAX_RECEIPTS).map(cleanReceipt).filter(Boolean);result.receipts=[...new Set(receipts)];return result;
}
export function careerProfile(state,kind,key){const id=identity(kind,key),tree=treeFor(kind,key);return cleanProfile(state?.version===CAREER_VERSION&&id?own(own(state,kind==='mech'?'mechs':'pilots'),id):null,tree);}
export function availablePoints(state,kind,key){const profile=careerProfile(state,kind,key);return profile.earned-spend(profile,treeFor(kind,key));}
export function nodeStatus(state,kind,key,nodeId){
 const tree=treeFor(kind,key),node=nodesFor(tree).find(node=>node.id===nodeId),profile=careerProfile(state,kind,key);
 if(!identity(kind,key)||!node)return{unlocked:false,available:false,reason:'Unknown upgrade.'};
 if(profile.unlocked.includes(node.id))return{unlocked:true,available:false,reason:'Unlocked.'};
 if(!node.requires.every(id=>profile.unlocked.includes(id)))return{unlocked:false,available:false,reason:'Unlock the previous certification first.'};
 if(availablePoints(state,kind,key)<node.cost)return{unlocked:false,available:false,reason:`Requires ${node.cost} available points.`};
 return{unlocked:false,available:true,reason:'Available.'};
}
const currentRequest=(state,request)=>record(state)&&state.version===CAREER_VERSION&&record(request)&&Number.isSafeInteger(state.revision)&&state.revision>=0&&state.revision<Number.MAX_SAFE_INTEGER-1&&request.revision===state.revision;
function writeProfile(state,kind,key,profile){const group=kind==='mech'?'mechs':'pilots';return{...state,revision:state.revision+1,[group]:{...state[group],[key]:profile}};}
export function unlockCareer(state,request){
 if(!currentRequest(state,request)||!nodeStatus(state,request.kind,request.key,request.nodeId).available)return state;
 const key=identity(request.kind,request.key),clean=cleanCareer(state),group=request.kind==='mech'?'mechs':'pilots';
 if(group==='pilots'&&!Object.hasOwn(clean.pilots,key)&&Object.keys(clean.pilots).length>=MAX_PILOTS)return state;
 const profile=careerProfile(clean,request.kind,key);return writeProfile(clean,request.kind,key,{...profile,unlocked:[...profile.unlocked,request.nodeId]});
}
export function resetCareer(state,request){
 if(!currentRequest(state,request)||!identity(request.kind,request.key))return state;
 const profile=careerProfile(state,request.kind,request.key);if(!profile.unlocked.length)return state;
 return writeProfile(cleanCareer(state),request.kind,identity(request.kind,request.key),{...profile,unlocked:[]});
}
export function deploymentProgression(state,chassisId,pilot){return{mech:careerProfile(state,'mech',chassisId).unlocked,pilot:careerProfile(state,'pilot',pilot).unlocked};}
export function cleanDeploymentProgression(value,chassisId){return{mech:cleanUnlocks(value?.mech,treeFor('mech',chassisId)),pilot:cleanUnlocks(value?.pilot,PILOT_TREE)};}
export const PROGRESSION_LIMITS=freeze({hp:[1,1.3],speed:[1,1.2],lift:[1,1.3],damage:[1,1.2],heavyDamage:[1,1.3],damageReduction:[.8,1],dashRecharge:[1,1.25],specialRecharge:[1,1.3],repair:[0,3]});
const baseModifiers=()=>({hp:1,speed:1,lift:1,damage:1,heavyDamage:1,damageReduction:1,dashRecharge:1,specialRecharge:1,repair:0});
const bounded=(value,id,fallback)=>Number.isFinite(value)?Math.max(PROGRESSION_LIMITS[id][0],Math.min(PROGRESSION_LIMITS[id][1],value)):fallback;
export function progressionModifiers(progression,chassisId){
 const clean=cleanDeploymentProgression(progression,chassisId),mods=baseModifiers();
 for(const [ids,tree]of[[clean.mech,treeFor('mech',chassisId)],[clean.pilot,PILOT_TREE]])for(const node of nodesFor(tree))if(ids.includes(node.id))for(const [id,value]of Object.entries(node.effects))mods[id]+=value;
 for(const id of Object.keys(mods))mods[id]=bounded(mods[id],id,mods[id]);return mods;
}
export function applyProgressionStats(base,mods){
 const result={...base};for(const [field,id]of[['hp','hp'],['speed','speed'],['walkSpeed','speed'],['lift','lift']])if(Number.isFinite(base?.[field]))result[field]=Math.round(base[field]*bounded(mods?.[id],id,1));return result;
}
export function awardCareer(state,request){
 if(!record(state)||state.version!==CAREER_VERSION||!record(request)||request.outcome!=='victory'||request.practice!==false||!campaignId(request.campaignId)||!Object.hasOwn(request,'chassisId')||request.chassisId===undefined||!Number.isInteger(request.level)||request.level<0||request.level>=MISSIONS.length||MISSIONS[request.level].id!==request.missionId)return state;
 const mech=mechKey(request.chassisId),pilot=pilotKey(request.pilot);if(!mech||!pilot)return state;
 const clean=cleanCareer(state),receipt=JSON.stringify([request.campaignId,request.level]);if(clean.receipts.includes(receipt)||clean.revision>=Number.MAX_SAFE_INTEGER-1||!Object.hasOwn(clean.pilots,pilot)&&Object.keys(clean.pilots).length>=MAX_PILOTS)return state;
 const mechProfile=careerProfile(clean,'mech',mech),pilotProfile=careerProfile(clean,'pilot',pilot);
 return{...clean,revision:clean.revision+1,mechs:{...clean.mechs,[mech]:{...mechProfile,earned:Math.min(CAREER_POINT_CAP,mechProfile.earned+1)}},pilots:{...clean.pilots,[pilot]:{...pilotProfile,earned:Math.min(CAREER_POINT_CAP,pilotProfile.earned+1)}},receipts:[...clean.receipts,receipt].slice(-MAX_RECEIPTS)};
}
// The same world/snapshot contract settles local host and guest rewards. Attribute
// research to the deployed chassis, even if the hangar selection later changes.
export function awardCareerForWorld(state,world,localId,pilot){
 const mission=world?.mission;
 if(world?.status!=='won'||mission?.mode!=='operation'||!mission.raid||!mission.campaign||mission.practice)return state;
 const player=Array.isArray(world.players)?world.players.find(p=>p.id===localId):null;
 if(!player)return state;
 return awardCareer(state,{campaignId:mission.campaign.id,level:mission.campaign.level,missionId:mission.missionId,outcome:'victory',practice:false,chassisId:player.build?.chassis||'custom',pilot});
}
