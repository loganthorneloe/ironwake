// Career saves stay personal; the hub only supplies the physical access boundary.
import{MECH_TREES,treeFor,unlockCareer,resetCareer}from './career-progression.js';
import{nearStation}from './hub-state.js';

const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const careerStationFor=kind=>kind==='mech'?'parts':kind==='pilot'?'story':null;

export function mutateCareerAtHub(career,context,request,reset=false){
 if(!record(context)||!record(request)||context.playing||context.connecting||context.world)return career;
 const {state,playerId,pilot}=context,station=careerStationFor(request.kind);
 if(!station||typeof pilot!=='string'||pilot!==pilot.trim()||pilot.length>24||!treeFor('pilot',pilot))return career;
 if(typeof playerId!=='string'||!playerId||!record(state)||!Array.isArray(state.players))return career;
 if(!state.players.every(p=>record(p)&&typeof p.id==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.z))||state.players.filter(p=>p.id===playerId).length!==1)return career;
 if(!nearStation(state,playerId,station))return career;
 if(request.kind==='pilot'?request.key!==pilot:typeof request.key!=='string'||!Object.hasOwn(MECH_TREES,request.key))return career;
 return reset?resetCareer(career,request):unlockCareer(career,request);
}
