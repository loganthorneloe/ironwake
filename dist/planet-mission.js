import{initRound,stepRound,roundMarkers,roundObjective}from './round-director.js';
import {contractFor,awardSalvage} from './sortie-progression.js';
// Host-authoritative Cinderfall director. All progress lives in the replicated world.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const randomSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export const OPERATION_PHASES=['Establish the beachhead','Destroy the orbital batteries','Fuel the canyon crawler','Destroy the reactor warden','Reach the extraction ship'];
// The route is authored; the seed changes cover and battery positions, not navigation.
export function planetMission(seed=38001){
 const r=randomSeed(seed),jitter=()=>Math.round((r()-.5)*100),entry={x:850,y:1050},
 batteries=[{x:2050+jitter(),y:1100+jitter(),z:0},{x:3050+jitter(),y:1850+jitter(),z:110},{x:3000+jitter(),y:3100+jitter(),z:0}],
 route=[{x:3650,y:3850},{x:4750,y:3900},{x:5350,y:4650},{x:6500,y:4600}],reactor={x:7200,y:4600},exit={x:7900,y:3150},
 spine=[entry,...batteries,...route,reactor,exit],
 cells=[{x:3450,y:3660,z:0},{x:4050,y:4060,z:100},{x:4650,y:3650,z:0},{x:5100,y:4240,z:0},{x:5620,y:4840,z:145},{x:6200,y:4370,z:0}],
 rooms=spine.map(p=>({...p,w:1000,h:1000})),
 zones=[{...entry,id:0,name:'01 / DROP ZONE'},{...batteries[1],id:1,name:'02 / BATTERY RIDGE'},{...route[0],id:2,name:'03 / FREIGHT CUT'},{...reactor,id:3,name:'04 / REACTOR',boss:true},{...exit,id:4,name:'05 / UPLINK PAD'}];
 const platforms=[...batteries.filter(p=>p.z),...cells.filter(p=>p.z),{x:reactor.x-180,y:reactor.y+Math.sin(Math.PI*2/3)*360,z:120}].map((p,i)=>({x:p.x-160,y:p.y-130,w:320,h:260,z:p.z,kind:'deck',zone:i}));
 const ramps=platforms.map(p=>({x:p.x,y:p.y+p.h,w:100,h:310,z:p.z,axis:'y',sign:-1}));
 const routeDistance=p=>Math.min(...spine.slice(1).map((b,i)=>segmentDistance(p,spine[i],b)));
 // Solid, visible canyon walls keep the flight corridor legible. Merge tiles into strips.
 const obstacles=[],tile=220,width=8800,height=5940;
 for(let y=0;y<height;y+=tile){let start=-1;for(let x=0;x<=width;x+=tile){const solid=x<width&&routeDistance({x:x+tile/2,y:y+tile/2})>720;
 if(solid&&start<0)start=x;if(!solid&&start>=0){obstacles.push({x:start,y,w:x-start,h:tile,height:440+r()*140,cliff:true,rock:true});start=-1;}}}
 // Cargo stacks sit at the edges of the road, never across a delivery lane or objective.
 for(let i=1;i<spine.length;i++){const a=spine[i-1],b=spine[i],d=distance(a,b),nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d;
 for(let f=.25;f<.95;f+=.3)for(const side of[-1,1]){const x=a.x+(b.x-a.x)*f+nx*side*390,y=a.y+(b.y-a.y)*f+ny*side*390;
 if([...spine,...cells].some(p=>distance(p,{x,y})<270)||platforms.some(p=>x>p.x-100&&x<p.x+p.w+100&&y>p.y-100&&y<p.y+p.h+340))continue;
 obstacles.push({x:x-55,y:y-45,w:110,h:90,height:65+r()*35,cargo:true});}}
 for(const [i,p]of batteries.entries()){const a=spine[i],b=spine[i+2],d=distance(a,b),nx=-(b.y-a.y)/d,ny=(b.x-a.x)/d;for(const side of[-1,1])obstacles.push({x:p.x+nx*side*480-70,y:p.y+ny*side*480-70,w:140,h:140,height:270,landmark:'silo'});}
 for(const side of[-1,1])obstacles.push({x:reactor.x+side*480-90,y:reactor.y+390,w:180,h:180,height:510,landmark:'reactor'});
 const portals=[];for(let i=1;i<spine.length;i++){const a=spine[i-1],b=spine[i],d=distance(a,b);for(let f=.15;f<1;f+=420/d)for(const side of[-1,1]){const x=a.x+(b.x-a.x)*f-(b.y-a.y)/d*side*550,y=a.y+(b.y-a.y)*f+(b.x-a.x)/d*side*550;
 if(!obstacles.some(o=>x>o.x-70&&x<o.x+o.w+70&&y>o.y-70&&y<o.y+o.h+70)&&!platforms.some(o=>x>o.x-70&&x<o.x+o.w+70&&y>o.y-70&&y<o.y+o.h+70))portals.push({x,y,heading:Math.atan2(b.y-a.y,b.x-a.x)-side*Math.PI/2});}}
 return{mode:'operation',seed,name:'CINDERFALL',terrain:'KEPLER-9 / FREIGHT CANYON',sector:1,biome:2,width,height,heading:0,entry,exit,rooms,zones,paths:[spine],spine,portals,boundaries:[],platforms,ramps,obstacles,batteries,cells,route,reactor,estimatedMinutes:15};
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
export function initOperation(w){if(w.mission.raid)return initRound(w);const count=w.players.length;w.operation={phase:0,phaseAt:0,nextWave:1.5,nextStrike:18,killsAt:0,redeploys:2,wipeAt:null,checkpoint:{...w.mission.entry},wave:0,notice:'ORBITAL INSERTION · Follow the freight road into the canyon',noticeUntil:9,batteriesDown:[],cells:[],delivered:0,crawler:{...w.mission.route[0],segment:0,progress:0,fuel:0},extraction:0,elitePhases:[],teamSize:count};for(const p of w.players){p.altitude=210;p.recoverUntil=6;}w.encounter=true;}
function objective(w,id,kind,p,hp,group,locked=false){const scale=1+.75*(w.players.length-1),e={id,type:'objective',objective:true,objectiveKind:kind,group,x:p.x,y:p.y,altitude:p.z||0,hp:hp*scale,max:hp*scale,r:kind==='battery'?42:25,locked,stun:0,speed:0};w.enemies.push(e);return e;}
function notice(w,text){w.operation.notice=text;w.operation.noticeUntil=w.time+6;}
function enter(w,phase,stats){const o=w.operation;o.phase=phase;o.phaseAt=w.time;o.killsAt=w.kills;o.nextWave=w.time+3;o.nextStrike=w.time+12;w.zoneIndex=phase;w.cleared=phase;o.checkpoint={...w.mission.zones[phase]};for(const p of w.players){const f=stats(p.build,p);if(p.hp<=0){p.x=o.checkpoint.x;p.y=o.checkpoint.y;p.altitude=o.checkpoint.z||0;p.revive=0;}p.hp=Math.min(f.hp,Math.max(p.hp,f.hp*.55)+f.hp*.3);p.recoverUntil=w.time+3;}awardSalvage(w,30);notice(w,'CHECKPOINT · '+OPERATION_PHASES[phase]+' · SALVAGE RECOVERED');
 if(phase===1)w.mission.batteries.forEach((p,i)=>{objective(w,'battery-'+i,'battery',p,3600,i,true);for(const side of[-1,1])objective(w,'relay-'+i+'-'+side,'relay',{x:p.x+side*(p.z?90:230),y:p.y-(p.z?50:180),z:p.z},950,i);});
 if(phase===2){o.cells=w.mission.cells.map((p,i)=>({id:'cell-'+i,...p,state:'sealed',carrier:null}));o.cells.forEach(c=>objective(w,'cache-'+c.id,'cache',c,700,c.id));}
 if(phase===3){const p=w.mission.reactor;for(let i=0;i<3;i++){const a=i*Math.PI*2/3;objective(w,'coolant-'+i,'coolant',{x:p.x+Math.cos(a)*360,y:p.y+Math.sin(a)*360,z:i===1?120:0},2200,i);}o.bossSpawned=false;}
 if(phase===4){o.shipAt=w.time+95;w.spawn=[];notice(w,'REACTOR DESTROYED · Extraction inbound · Keep moving');}
}
export const operationEnemyCap=players=>24+8*players;
function supportWave(w){
 const o=w.operation,n=w.players.length,alive=w.players.filter(p=>p.hp>0);const contract=contractFor(w.sortie?.contract);o.nextWave=w.time+contract.wave;if(!alive.length)return;
 // Recycle only distant fodder. Elites and mission objects persist across the route.
 w.enemies=w.enemies.filter(e=>e.objective||e.elite||alive.some(p=>distance(p,e)<1900));
 const combat=w.enemies.filter(e=>!e.objective&&e.hp>0).length+w.spawn.length,amount=Math.min(operationEnemyCap(n)-combat,7+n*2+Math.min(3,o.phase));if(amount<=0)return;
 const anchor=alive[o.wave%alive.length],ports=w.mission.portals.filter(p=>distance(p,anchor)>330&&distance(p,anchor)<1100).sort((a,b)=>distance(a,anchor)-distance(b,anchor));
 if(!ports.length)return;
 for(let i=0;i<amount;i++){const port=ports[(o.wave+i)%Math.min(6,ports.length)],type=(o.wave+i)%contract.tanks===0&&(o.phase>0||contract.id==='siegebreaker')?'tank':(o.wave+i)%3===0?'gunner':'drone';
 const specialists=[[],['rammer','needle'],['mender','mortar','rammer'],['needle','mortar','mender','rammer'],['needle','mortar','rammer','mender']][o.phase]||[];const selected=specialists.length&&i%4===3?specialists[(o.wave+Math.floor(i/4))%specialists.length]:type;
 w.spawn.push({time:w.time+2.4+i*.13,type:selected,zone:{x:port.x,y:port.y,exact:true,operation:true,variant:0}});}
 o.wave++;
}

export function queueHeavyDrop(w,point,boss=false){
 const o=w.operation,at=w.time+6;
 w.spawn.push({time:at,type:boss?'boss':'tank',zone:{x:point.x,y:point.y,exact:true,operation:true,elite:true,warden:boss}});
 o.heavyAlert={id:++w.id,start:w.time,landingAt:at+600/340,until:at+600/340+3,name:boss?'REACTOR WARDEN':'SIEGE MECH',x:point.x,y:point.y};
}
function eliteArrival(w){const o=w.operation;if(![1,2].includes(o.phase)||o.elitePhases.includes(o.phase)||w.time-o.phaseAt<contractFor(w.sortie?.contract).eliteTimes[o.phase===1?0:1]||w.enemies.some(e=>e.elite&&e.hp>0)||w.spawn.some(s=>s.zone.elite))return;
 const p=w.players.find(p=>p.hp>0);if(!p)return;let point;for(let i=0;i<12;i++){const a=i*Math.PI/6,x=clamp(p.x+Math.cos(a)*550,160,w.mission.width-160),y=clamp(p.y+Math.sin(a)*550,160,w.mission.height-160);if(!w.mission.obstacles.some(b=>x>b.x-70&&x<b.x+b.w+70&&y>b.y-70&&y<b.y+b.h+70)&&!w.mission.platforms.some(b=>x>b.x-70&&x<b.x+b.w+70&&y>b.y-70&&y<b.y+b.h+70)){point={x,y};break;}}if(point){o.elitePhases.push(o.phase);queueHeavyDrop(w,point);}}

function bombard(w){const o=w.operation,alive=w.players.filter(p=>p.hp>0);if(!alive.length)return;for(const p of alive.slice(0,o.phase===4?4:2))w.hazards.push({x:p.x,y:p.y,r:o.phase===4?150:115,time:2.5});o.nextStrike=w.time+(o.phase===4?6:o.phase===1?10:15);}
export function stepOperation(w,dt,stats){if(w.mission.raid)return stepRound(w,dt,stats);const o=w.operation;if(!o||w.status!=='playing')return;const alive=w.players.filter(p=>p.hp>0);
 // Downed or disconnected carriers drop cells, so the objective cannot be stranded.
 for(const c of o.cells)if(c.state==='carried'&&!alive.some(p=>p.id===c.carrier)){const p=w.players.find(p=>p.id===c.carrier);if(p){c.x=p.x;c.y=p.y;}c.z=0;c.state='loose';c.carrier=null;}
 if(!alive.length){if(o.wipeAt==null)o.wipeAt=w.time;if(o.redeploys<=0){w.status='lost';return;}if(w.time-o.wipeAt>=7){o.redeploys--;for(const [i,p]of w.players.entries()){p.hp=stats(p.build,p).hp;p.x=o.checkpoint.x+i*55;p.y=o.checkpoint.y;p.altitude=150;p.revive=0;p.recoverUntil=w.time+5;}w.enemies=w.enemies.filter(e=>e.objective||e.elite||distance(e,o.checkpoint)>700);w.bullets=[];w.hazards=[];w.enemyHazards=[];o.wipeAt=null;notice(w,'EMERGENCY REDEPLOY · '+o.redeploys+' remaining');}return;}o.wipeAt=null;
 eliteArrival(w);if(w.time>=o.nextWave)supportWave(w);if(o.phase>0&&w.time>=o.nextStrike)bombard(w);
 if(o.phase===0){if(w.time>=45&&w.kills>=18+6*(w.players.length-1))enter(w,1,stats);}
 else if(o.phase===1){for(let i=0;i<3;i++){const battery=w.enemies.find(e=>e.id==='battery-'+i);if(battery)battery.locked=w.enemies.some(e=>e.objectiveKind==='relay'&&e.group===i&&e.hp>0);if(!battery||battery.hp<=0){if(!o.batteriesDown.includes(i))o.batteriesDown.push(i);}}if(o.batteriesDown.length===3)enter(w,2,stats);}
 else if(o.phase===2){for(const c of o.cells){if(c.state==='sealed'&&!w.enemies.some(e=>e.id==='cache-'+c.id&&e.hp>0))c.state='loose';if(c.state==='loose'){const p=alive.find(p=>distance(p,c)<90&&Math.abs((p.altitude||0)-c.z)<80&&!o.cells.some(q=>q.carrier===p.id));if(p){c.state='carried';c.carrier=p.id;notice(w,'CELL RECOVERED · Bring it to the crawler');}}if(c.state==='carried'){const p=alive.find(p=>p.id===c.carrier);if(p){c.x=p.x;c.y=p.y;c.z=p.altitude||0;}if(p&&distance(p,o.crawler)<145&&(p.altitude||0)<100){c.state='delivered';c.carrier=null;o.delivered++;o.crawler.fuel+=42;notice(w,'CRAWLER FUELED · '+o.delivered+' / 6 cells');}}}
 const c=o.crawler,route=w.mission.route;if(c.fuel>0&&c.segment<route.length-1){const target=route[c.segment+1],d=distance(c,target),travel=Math.min(d,22*dt);c.x+=(target.x-c.x)/Math.max(d,1)*travel;c.y+=(target.y-c.y)/Math.max(d,1)*travel;c.fuel=Math.max(0,c.fuel-dt);if(d<4)c.segment++;}const lengths=route.slice(1).map((p,i)=>distance(p,route[i])),total=lengths.reduce((a,b)=>a+b,0);c.progress=clamp((lengths.slice(0,c.segment).reduce((a,b)=>a+b,0)+(c.segment<lengths.length?distance(route[c.segment],c):0))/total,0,1);if(c.segment>=route.length-1&&o.delivered>=6)enter(w,3,stats);}
 else if(o.phase===3){if(!o.bossSpawned&&!w.enemies.some(e=>e.objectiveKind==='coolant'&&e.hp>0)){queueHeavyDrop(w,w.mission.reactor,true);o.bossSpawned=true;}if(o.bossSpawned&&!w.spawn.some(s=>s.zone.warden)&&!w.enemies.some(e=>e.id==='cinder-warden'&&e.hp>0))enter(w,4,stats);}
 else if(o.phase===4){const ready=w.time>=o.shipAt,atExit=alive.every(p=>distance(p,w.mission.exit)<190&&(p.altitude||0)<50);o.extraction=ready&&atExit?o.extraction+dt:0;w.extractTime=o.extraction;if(o.extraction>=6){w.cleared=5;w.zoneIndex=5;w.status='won';notice(w,'CINDERFALL COMPLETE');}}
}
export function operationMarkers(w,p){if(w.mission.raid)return roundMarkers(w,p);const o=w.operation;if(!o)return[];if(o.phase===0)return[{x:w.mission.entry.x+550,y:w.mission.entry.y,name:'BREACH THE CHECKPOINT',z:95}];if(o.phase===1)return w.enemies.filter(e=>e.objective&&e.hp>0).map(e=>({...e,z:(e.altitude||0)+95,name:e.objectiveKind==='relay'?'SHIELD RELAY':e.locked?'BATTERY · SHIELDED':'DESTROY BATTERY'}));if(o.phase===2){const carrying=o.cells.some(c=>c.carrier===p?.id);return[{...o.crawler,z:100,name:carrying?'DELIVER CELL':'CRAWLER · '+Math.round(o.crawler.progress*100)+'%'},...o.cells.filter(c=>['sealed','loose'].includes(c.state)&&!carrying).map(c=>({...c,z:c.z+85,name:c.state==='sealed'?'BREAK CELL CACHE':'RECOVER CELL'}))];}if(o.phase===3)return w.enemies.filter(e=>e.hp>0&&(e.objective||e.id==='cinder-warden')).map(e=>({...e,z:(e.altitude||0)+110,name:e.objective?'DESTROY COOLANT':'REACTOR WARDEN'}));return[{...w.mission.exit,z:100,name:w.time<o.shipAt?'EXTRACTION · '+Math.ceil(o.shipAt-w.time)+'s':'LAND TO EXTRACT'}];}
export function operationObjective(w,p){if(w.mission.raid)return roundObjective(w,p);const o=w.operation,markers=operationMarkers(w,p),closest=[...markers].sort((a,b)=>distance(a,p)-distance(b,p))[0],timer=Math.floor(w.time/60)+':'+String(Math.floor(w.time%60)).padStart(2,'0');let detail=o.phase===0?`${w.kills} / ${18+6*(w.players.length-1)} hostiles · Push up the freight road`:o.phase===1?`${o.batteriesDown.length} / 3 batteries · Break each battery’s two shield relays`:o.phase===2?`${o.delivered} / 6 cells · Crawler ${Math.round(o.crawler.progress*100)}% · ${Math.ceil(o.crawler.fuel)}s fuel`:o.phase===3?o.bossSpawned?'Warden exposed · Keep moving between volleys':'Destroy all three coolant nodes to expose the warden':w.time<o.shipAt?`Ship arrives in ${Math.ceil(o.shipAt-w.time)}s · Evade bombardment`:`${o.extraction.toFixed(1)} / 6s · All surviving pilots must land on the pad`;
 return{personal:p.hp<=0?'Mech disabled':closest?.name||'Keep fighting',personalDetail:p.hp<=0?(o.wipeAt!=null?'Emergency redeploy in '+Math.max(0,Math.ceil(7-w.time+o.wipeAt))+'s':'Stay near an ally to recover'):closest?`${Math.round(distance(closest,p))}m · Space to fly · Shift to dash`:'Support your squad',team:w.status==='won'?'Cinderfall complete':w.status==='lost'?'Operation failed':OPERATION_PHASES[o.phase],teamDetail:detail+` · ${timer} · ${o.redeploys} redeploys`,progress:w.status==='won'?100:o.phase*20};}
