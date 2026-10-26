// Host-owned hub movement and permanent armory. No browser or rendering dependencies.
import {PARTS, WEAPONS, ABILITIES, cleanBuild} from './core.js?v=41';

export const HUB_PROTOCOL = 'ironwake-anchorage-career-cinematic-field-v4-';
export const HUB_STATIONS = Object.freeze([
  {id:'mission', name:'Command', keeper:'Commander Vale', role:'Campaign & deployment', x:0, z:-5, color:'#a7efd1', number:'01'},
  {id:'supply', name:'Run supplies', keeper:'Quartermaster Pip', role:'Current run upgrades', x:-26, z:14, color:'#ffc278', number:'02'},
  {id:'parts', name:'Parts foundry', keeper:'Chief Rook', role:'Chassis research & frame licenses', x:-26, z:-7, color:'#79d5ee', number:'03'},
  {id:'weapons', name:'The arsenal', keeper:'Ordnance Officer Flint', role:'Permanent weapon licenses', x:26, z:14, color:'#ef9c7e', number:'04'},
  {id:'story', name:'Signal archive', keeper:'Archivist Echo', role:'Pilot training & recovered signals', x:26, z:-7, color:'#c4a9f5', number:'05'}
]);
export const HUB_SOLIDS = Object.freeze([
  {x:-34,z:2,w:16,d:9}, {x:-34,z:-21,w:16,d:10},
  {x:18,z:2,w:16,d:9}, {x:18,z:-21,w:16,d:10},
  {x:-5,z:-18,w:10,d:10}, {x:-16,z:-31,w:32,d:8}
]);
export const HUB_RADIUS = 5.8;
export const HUB_SPEED = 13;
export const HUB_STORIES = Object.freeze([
  {id:'anchorage', level:0, title:'A light that stays on', text:'Wake Anchorage was a cargo platform before the Crown Engine took the horizon. Now its landing lights guide every returning mech home. Vale keeps the mission table lit. Rook keeps the cranes running. Nobody asks how many more sorties the deck can take.'},
  {id:'ashgate', level:1, title:'The first returning signal', text:'Ashgate is quiet. Under the wreckage, Echo finds a freight beacon still calling this platform by its old name: Homebound. The squad has opened a route for supply runners. For the first time in weeks, Pip can put something new on the shelves.'},
  {id:'relay', level:3, title:'Someone on the other end', text:'Relay Nine carries a voice through the storm. There are settlements beyond the foundries, sheltering under dead transmission towers. The Crown has been draining their reactors. Vale changes the map: the operation is no longer just a breach. It is a rescue corridor.'},
  {id:'blackrail', level:6, title:'The last train north', text:'The Blackrail crawler arrives with scorched armor and a manifest full of names. Rook welds a piece of its hull onto the Anchorage gantry. Flint leaves an empty weapon rack for the next returning crew. The Crown Engine is visible from the upper deck now.'},
  {id:'crown', level:9, title:'Homebound', text:'The horizon goes dark, then fills with distant settlement lights. Echo records nine clear channels. Vale erases the final hostile marker but leaves the table running. There will be other fronts. For tonight, every landing light at Wake Anchorage stays on.'}
]);

export const HUB_CATALOG = Object.freeze([
  ...Object.entries(PARTS).flatMap(([slot, options])=>Object.entries(options).map(([id, item], index)=>({
    id:`part:${slot}:${id}`, vendor:'parts', slot, item:id, name:item.name,
    detail:item.desc+(item.appearance?' · '+item.appearance:''), price:index<3?0:90+Math.floor((index-3)/2)*45,
    level:index<6?0:2, weight:item.weight
  }))),
  ...Object.entries({...WEAPONS,...ABILITIES}).map(([id,item],index)=>({
    id:`weapon:${id}`, vendor:'weapons', item:id, slot:ABILITIES[id]?'equip2':'hand', name:item.name.split(' / ').at(-1),
    detail:item.desc, price:['carbine','blade','claws','emp'].includes(id)?0:120+(index%4)*40,
    level:['launcher','rotary','flamer','hammer'].includes(id)?2:['dynamo','scythe'].includes(id)?1:0, weight:item.weight
  }))
]);
const catalogById = new Map(HUB_CATALOG.map(item=>[item.id,item]));
const integer=(n,max=999999)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
export function newHubSave(){return{version:1,revision:0,credits:360,bestLevel:0,unlocks:[],rewarded:[]};}
export function cleanHubSave(value){
  if(value?.version!==1)return newHubSave();
  return{version:1,revision:integer(value.revision),credits:integer(value.credits),bestLevel:integer(value.bestLevel,9),
    unlocks:[...new Set((Array.isArray(value.unlocks)?value.unlocks:[]).filter(id=>catalogById.has(id)))],
    rewarded:[...new Set((Array.isArray(value.rewarded)?value.rewarded:[]).filter(id=>typeof id==='string'&&id.length<=90))].slice(-128)};
}
export const ownsLicense=(save,id)=>catalogById.get(id)?.price===0||!!save?.unlocks.includes(id);
export function missingLicenses(save,build){
  const b=cleanBuild(build);
  return [...Object.entries(b.parts).map(([slot,id])=>`part:${slot}:${id}`),...b.equipment.map(id=>`weapon:${id}`)].filter(id=>!ownsLicense(save,id));
}
// Import existing local builds once, so an established player's equipment keeps working.
export function inheritArmory(save,builds){
  const ids=new Set(save.unlocks);
  for(const build of builds)for(const id of missingLicenses(save,build))if(catalogById.has(id))ids.add(id);
  return{...save,unlocks:[...ids]};
}
export function purchaseLicense(save,request){
  const item=catalogById.get(request?.id);
  if(request?.revision!==save.revision||!item||ownsLicense(save,item.id)||save.bestLevel<item.level||save.credits<item.price)return save;
  return{...save,revision:save.revision+1,credits:save.credits-item.price,unlocks:[...save.unlocks,item.id]};
}
export function purchaseAtStation(save,state,playerId,request,combatActive=false){
  const item=catalogById.get(request?.id);
  return !combatActive&&item&&nearStation(state,playerId,item.vendor)?purchaseLicense(save,request):save;
}
export function rewardHub(save,campaign){
  if(!campaign?.lastReport||campaign.lastResult!=='victory')return save;
  const key=campaign.id+':'+campaign.sorties;
  if(save.rewarded.includes(key))return save;
  const reward=120+Math.min(180,integer(campaign.lastReport.salvage)/2|0);
  return{...save,revision:save.revision+1,credits:Math.min(999999,save.credits+reward),bestLevel:Math.max(save.bestLevel,campaign.level),rewarded:[...save.rewarded,key].slice(-128)};
}
export function syncHubPlayers(state,members){
  return{players:members.slice(0,4).map((p,i)=>state?.players?.find(q=>q.id===p.id)||{id:p.id,x:(i-1.5)*3,z:19,angle:-Math.PI/2,input:{x:0,z:0}})};
}
export function cleanHubInput(input){
  let x=Number.isFinite(input?.x)?Math.max(-1,Math.min(1,input.x)):0,z=Number.isFinite(input?.z)?Math.max(-1,Math.min(1,input.z)):0;
  const length=Math.max(1,Math.hypot(x,z));return{x:x/length,z:z/length};
}
export function setHubInput(state,id,input){const p=state.players.find(p=>p.id===id);if(p)p.input=cleanHubInput(input);}
function blocked(x,z){return HUB_SOLIDS.some(o=>x>o.x-.9&&x<o.x+o.w+.9&&z>o.z-.9&&z<o.z+o.d+.9);}
export function stepHub(state,dt){
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
  for(const p of state.players){const input=cleanHubInput(p.input),x=Math.max(-40,Math.min(40,p.x+input.x*HUB_SPEED*dt)),z=Math.max(-22,Math.min(27,p.z+input.z*HUB_SPEED*dt));
    if(!blocked(x,p.z))p.x=x;if(!blocked(p.x,z))p.z=z;
    if(input.x||input.z)p.angle=Math.atan2(input.z,input.x);
  }return state;
}
export function nearStation(state,id,stationId){const p=state?.players.find(p=>p.id===id),s=HUB_STATIONS.find(s=>s.id===stationId);return!!p&&!!s&&Math.hypot(p.x-s.x,p.z-s.z)<=HUB_RADIUS;}
export function hubSnapshot(state){return{players:state.players.map(({id,x,z,angle})=>({id,x,z,angle}))};}

// The fixed deck needs only a small visibility graph around its existing solids.
// Keep corners 2m beyond movement clearance so the 1m follower tolerance does not
// cut a detour back through a counter when it advances to the next waypoint.
export function hubRoute(from,to){
  const onDeck=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=-40&&p.x<=40&&p.z>=-22&&p.z<=27&&!blocked(p.x,p.z);
  if(!onDeck(from)||!onDeck(to))return[];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v)),nodes=[{x:from.x,z:from.z},{x:to.x,z:to.z}],keys=new Set(nodes.map(p=>p.x+','+p.z));
  for(const o of HUB_SOLIDS)for(const x of[o.x-2.9,o.x+o.w+2.9])for(const z of[o.z-2.9,o.z+o.d+2.9]){
    const p={x:clamp(x,-40,40),z:clamp(z,-22,27)},key=p.x+','+p.z;
    if(!keys.has(key)&&onDeck(p)){keys.add(key);nodes.push(p);}
  }
  function crosses(a,b,o){
    let near=0,far=1;
    for(const [axis,lo,hi]of[['x',o.x-.9,o.x+o.w+.9],['z',o.z-.9,o.z+o.d+.9]]){
      const d=b[axis]-a[axis];
      if(Math.abs(d)<1e-9){if(a[axis]<=lo||a[axis]>=hi)return false;continue;}
      const t0=(lo-a[axis])/d,t1=(hi-a[axis])/d;
      near=Math.max(near,Math.min(t0,t1));far=Math.min(far,Math.max(t0,t1));if(near>=far)return false;
    }
    return far>0&&near<1;
  }
  const distance=Array(nodes.length).fill(Infinity),previous=Array(nodes.length).fill(-1),visited=new Set();distance[0]=0;
  for(let count=0;count<nodes.length;count++){
    let best=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(best<0||distance[i]<distance[best]))best=i;
    if(best<0||!Number.isFinite(distance[best])||best===1)break;visited.add(best);
    for(let i=0;i<nodes.length;i++){
      if(i===best||visited.has(i)||HUB_SOLIDS.some(o=>crosses(nodes[best],nodes[i],o)))continue;
      const next=distance[best]+Math.hypot(nodes[i].x-nodes[best].x,nodes[i].z-nodes[best].z);
      if(next<distance[i]){distance[i]=next;previous[i]=best;}
    }
  }
  if(!Number.isFinite(distance[1]))return[];
  const route=[];for(let i=1;i!==0;i=previous[i]){if(i<0)return[];route.unshift(nodes[i]);}return route;
}
