import {initDestruction,stepDestruction,structureHasOpening} from './destruction.js';

export const BREACH_PHASES=['Breach the customs wall','Rupture the refinery tanks','Collapse the command roof','Extract through the freight yard'];
// Level 02 is intentionally opt-in. Cinderfall and its campaign remain untouched.
export function destructionMission(variant='level',seed=92002){
 const practice=variant!=='level',stress=variant==='stress',width=practice?2600:5100,height=practice?2300:2800;
 const entry=variant==='fuel'?{x:870,y:1285}:variant==='collapse'?{x:1750,y:900}:stress?{x:450,y:1605}:{x:450,y:practice?720:900},exit=practice?{x:2100,y:1600}:{x:4600,y:1800},obstacles=[],compounds=[],landmarks=[];
 let count=0;
 const add=(x,y,w,h,height,material='concrete',extra={})=>{const o={x,y,w,h,height,material,breakable:count++,...extra};obstacles.push(o);return o.breakable;};
 const crate=(x,y)=>add(x,y,60,60,55,'cargo');
 const tank=(x,y,goal)=>add(x,y,70,70,110,'fuel',{shape:'tank',explosive:165,goal});
 function compound(x,y,w,h,name,goal=null){
  compounds.push({x,y,w,h,name});
  for(let dx=0;dx<w;dx+=80)for(const dy of[0,h-20])add(x+dx,y+dy,Math.min(78,w-dx),20,150,'concrete');
  for(let dy=20;dy<h-20;dy+=80)for(const dx of[0,w-20])add(x+dx,y+dy,20,Math.min(78,h-20-dy),150,'concrete',{goal:dx===0&&Math.abs(y+dy-entry.y)<115?goal:null});
 }
 if(practice){
  compound(900,340,640,800,'01 / BREACH CELLS');
  // Material lanes: thin glass, concrete and reinforced steel, all in weapon reach.
  for(let i=0;i<3;i++){
   const material=['glass','concrete','steel'][i];
   for(let row=0;row<2;row++)for(let j=0;j<5;j++)add(680+i*300,420+j*80,18,77,70+row*70,material,{baseZ:row*70});
   landmarks.push({x:680+i*300,y:380,name:material.toUpperCase()+' / LIVE FIRE'});
  }
  for(let i=0;i<6;i++)tank(1120+i%3*95,1250+Math.floor(i/3)*100);
  const supports=[add(1730,700,35,35,200,'support'),add(2040,700,35,35,200,'support'),add(1730,1040,35,35,200,'support'),add(2040,1040,35,35,200,'support')];
  for(let x=1720;x<2100;x+=95)for(let y=690;y<1100;y+=100)add(x,y,93,98,220,'steel',{baseZ:200,supports});
  landmarks.push({x:1900,y:660,name:'02 / SUPPORT COLLAPSE'},{x:1200,y:1210,name:'03 / FUEL CHAIN'});
  if(stress)for(let y=1400;y<2100;y+=95)for(let x=600;x<2150;x+=95){crate(x,y);if((Math.round((x-600)/95)+Math.round((y-1400)/95))%5===0)tank(x+15,y+15);}
 }else{
  compound(1000,460,800,880,'01 / CUSTOMS COMPOUND','gate');
  compound(2200,300,800,1150,'02 / REFINERY');
  compound(3400,800,850,1000,'03 / COMMAND BASTION');
  for(const [x,y]of[[1220,600],[1440,1150],[1570,650],[1920,1200],[2400,450],[2770,1250],[3100,1550],[3620,1460],[4070,1600]]){crate(x,y);crate(x+70,y);}
  for(const [x,y]of[[2470,650],[2670,900],[2480,1160]])tank(x,y,'refinery');
  for(const [x,y]of[[2390,650],[2590,900],[2560,1160]])tank(x,y);
  // Load paths are authored, not an unbounded physics solver. Knock all four
  // columns out to cascade the slab, or shoot individual roof panels directly.
  const supports=[[3510,950],[4080,950],[3510,1580],[4080,1580]].map(([x,y])=>add(x,y,36,36,210,'support',{goal:'support'}));
  for(let x=3500;x<4140;x+=80)for(let y=940;y<1660;y+=90)add(x,y,78,88,230,'steel',{baseZ:210,supports,goal:'command',durability:144});
  // Glass control rooms, power cabinets, barricades and pipe racks diversify cover.
  for(let i=0;i<6;i++)add(3660+i*65,1280,62,16,130,'glass');
  for(let i=0;i<4;i++)add(1830,500+i*110,45,70,90,'steel',{shape:'cabinet'});
  for(let i=0;i<7;i++)add(3040+i*55,650,45,32,65,'cargo');
  for(const c of compounds)landmarks.push({x:c.x+c.w/2,y:c.y-70,name:c.name});
 }
 for(const o of[{x:0,y:0,w:width,h:90},{x:0,y:height-90,w:width,h:90},{x:0,y:90,w:90,h:height-180},{x:width-90,y:90,w:90,h:height-180}])obstacles.push({...o,height:300,wall:true});
 const spine=[entry,...compounds.map(c=>({x:c.x+c.w/2,y:c.y+c.h/2})),exit];
 const zones=BREACH_PHASES.map((name,i)=>({...([{x:1000,y:900},{x:2600,y:900},{x:3800,y:1300},exit][i]),id:i,name}));
 return{mode:'destruction',destructible:true,variant,seed,name:practice?(stress?'DESTRUCTION STRESS YARD':variant==='fuel'?'FUEL CHAIN RANGE':variant==='collapse'?'SUPPORT COLLAPSE RIG':'BREACH RANGE'):'BREAKWATER',terrain:'KEPLER-9 / INDUSTRIAL SIEGE',sector:2,biome:1,width,height,entry,exit,heading:0,obstacles,compounds,landmarks,rooms:spine.map(p=>({...p,w:700,h:700})),spine,paths:[spine],zones:practice?[]:zones,platforms:[],ramps:[],boundaries:[],panelCount:count};
}
const alive=w=>w.players.filter(p=>p.hp>0),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const group=(w,name)=>w.mission.obstacles.filter(o=>o.goal===name);
const removed=(w,o)=>w.destruction.hp[o.breakable]<=0||!!w.destruction.severed[o.breakable];
export function initDestructionMission(w){
 initDestruction(w);
 w.siege={phase:0,nextWave:3,waves:0,extract:0,redeploys:2,wipeAt:null,checkpoint:{...w.mission.entry},notice:'LIVE DEMOLITION / Breach walls. Open your own route.',noticeUntil:3};
 w.encounter=true;
}
function enemy(w,x,y,type='gunner'){
 const scale=1+.35*(w.players.length-1),hp=(type==='drone'?80:110)*scale;
 const drone=type==='drone';
 w.enemies.push({id:w.id++,type,species:drone?'hunter':'wisp',bodyHeight:drone?40:34,hover:drone?0:100,x,y,altitude:drone?0:100,hp,max:hp,angle:Math.PI,stun:0,windup:0,attackAngle:0,attackPitch:0,attackTarget:null,cd:1.1,speed:drone?260:170,r:18});
 w.effects.push({id:w.id++,x,y,z:2,r:60,kind:'dodge',color:'#f2b47b',life:.45,max:.45});
}
export function stepDestructionMission(w,dt,stats,onBlast){
 stepDestruction(w,onBlast);const s=w.siege;
 if(w.mission.variant!=='level'){
  // A no-pressure proving ground: destroyed geometry resets only on a new run.
  for(const p of w.players)if(p.hp<=0){p.hp=stats(p.build,p).hp;p.x=w.mission.entry.x;p.y=w.mission.entry.y;p.altitude=0;}
  return;
 }
 const living=alive(w);
 if(!living.length){
  s.wipeAt??=w.time;
  if(s.redeploys<=0){w.status='lost';return;}
  if(w.time-s.wipeAt>4){s.redeploys--;s.wipeAt=null;w.bullets=[];for(const [i,p]of w.players.entries()){p.hp=stats(p.build,p).hp;p.x=s.checkpoint.x-70-i*45;p.y=s.checkpoint.y;p.altitude=0;p.recoverUntil=w.time+3;}}
  return;
 }
 s.wipeAt=null;
 if(w.time>=s.nextWave&&w.enemies.length<8+w.players.length*3){
  s.nextWave=w.time+7;s.waves++;const focus=living[s.waves%living.length],angle=s.waves*2.399;
  // Flank from clear floor, never spawn inside a still-solid compound panel.
  const candidates=[{x:focus.x+Math.cos(angle)*430,y:focus.y+Math.sin(angle)*430},{x:focus.x-350,y:focus.y+360},{x:focus.x+350,y:focus.y-360}];
  let spawned=0;
  for(const p of candidates){if(p.x<140||p.y<140||p.x>w.mission.width-140||p.y>w.mission.height-140)continue;
   const blocked=w.mission.obstacles.some(o=>(o.breakable===undefined||!removed(w,o))&&(o.baseZ||0)<60&&p.x>o.x-30&&p.x<o.x+o.w+30&&p.y>o.y-30&&p.y<o.y+o.h+30);
   if(!blocked){if(w.enemies.length>=8+w.players.length*3)break;enemy(w,p.x,p.y,spawned%2?'drone':'gunner');if(++spawned>=1+w.players.length)break;}
  }
 }
 const complete=s.phase===0?group(w,'gate').some(o=>removed(w,o)||structureHasOpening(w.mission,o)):s.phase===1?group(w,'refinery').every(o=>removed(w,o)):s.phase===2?group(w,'command').every(o=>removed(w,o)):false;
 if(complete){
  s.phase++;w.cleared=s.phase;w.zoneIndex=s.phase;s.checkpoint={...w.mission.zones[s.phase]};
  s.notice=['','WALL BREACHED / Push into the refinery','FUEL NETWORK RUPTURED / Bring down command','COMMAND COLLAPSED / Boost to extraction'][s.phase];s.noticeUntil=w.time+3.5;
  for(const p of w.players){p.hp=Math.min(stats(p.build,p).hp,Math.max(p.hp,stats(p.build,p).hp*.5)+35);p.recoverUntil=w.time+1.5;}
 }
 if(s.phase===3){
  const together=living.every(p=>distance(p,w.mission.exit)<155&&(p.altitude||0)<35);
  s.extract=together?s.extract+dt:0;
  if(s.extract>=3){w.cleared=4;w.status='won';}
 }
 for(const p of living)if(w.time-(p.lastHurt??-10)>5)p.hp=Math.min(stats(p.build,p).hp,p.hp+dt*5);
}
export function destructionMarkers(w){
 if(!w.siege)return[];
 if(w.mission.variant!=='level')return w.mission.landmarks.map(p=>({...p,z:110}));
 const phase=w.siege.phase;
 if(phase===3)return[{...w.mission.exit,z:65,name:'EXTRACTION / ASSEMBLE SQUAD'}];
 return group(w,phase===0?'gate':phase===1?'refinery':'support').filter(o=>!removed(w,o)).map(o=>({x:o.x+o.w/2,y:o.y+o.h/2,z:Math.min(130,o.height+15),name:phase===0?'BREACH WALL':phase===1?'FUEL PUMP / CHAIN REACTION':'LOAD-BEARING COLUMN'}));
}
export function destructionObjective(w,p){
 const s=w.siege,practice=w.mission.variant!=='level';
 if(w.status==='won')return{personal:'Extraction complete',personalDetail:'Your mech is clear of Breakwater.',team:'Breakwater secured',teamDetail:'Customs breached. Refinery ruptured. Command collapsed.',progress:100};
 if(practice)return{personal:'Break the environment',personalDetail:'Fire at material lanes, detonate the fuel chain, or remove the gold roof columns. Restart the range to reset.',team:w.mission.name,teamDetail:w.destruction.destroyed+' / '+w.mission.panelCount+' pieces removed · '+w.destruction.chains+' chains · '+w.destruction.collapses+' slabs collapsed',progress:null};
 const phase=s.phase,remaining=group(w,phase===0?'gate':phase===1?'refinery':'support').filter(o=>!removed(w,o)).length;
 return{personal:p.hp<=0?'Wait for a squad revive':phase===0?'Make your own entrance':phase===1?'Shoot the orange fuel tanks':phase===2?'Target the four gold columns':'Boost to the extraction beacon',personalDetail:phase===0?'Bullets chip panels; melee and rockets open wider breaches.':phase===1?'Fuel detonations propagate through adjacent cover. Keep moving.':phase===2?'Remove the load-bearing columns to drop the roof, or destroy the slabs directly.':'All surviving pilots must land in the pad for 3 seconds.',team:BREACH_PHASES[phase],teamDetail:phase===3?s.extract>0?'EXTRACTING / '+Math.max(0,3-s.extract).toFixed(1)+'s':'Rally at the green beacon · '+s.redeploys+' redeploys':remaining+' '+(phase===0?'breachable panels':phase===1?'fuel pumps':'columns')+' remaining · '+w.enemies.length+' hostiles',progress:Math.round(phase/4*100)};
}
