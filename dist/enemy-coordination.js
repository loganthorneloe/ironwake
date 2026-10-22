import {enemyRole} from './enemy-behaviors.js';
const planners=new WeakMap(),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const available=e=>e.hp>0&&!e.training&&!e.objective&&!e.landing&&e.type!=='rival'&&!e.elite&&e.type!=='boss';
const melee=e=>['hunter','rammer'].includes(enemyRole(e));

// Decisions are refreshed at 4 Hz. Short, overlapping packs never stop the rest
// of the battlefield; the individual controller still owns attack commitment.
export function coordinateEnemies(w){
 let planner=planners.get(w);if(!planner)planners.set(w,planner={next:0,serial:0,last:0});
 if(w.time<planner.last)planner.next=0;planner.last=w.time;
 if(w.time<planner.next)return;planner.next=w.time+.25;
 const living=w.players.filter(p=>p.hp>0),eligible=w.enemies.filter(available);
 for(const e of w.enemies)if(e.squadOrder&&(!available(e)||e.stun>0||!living.some(p=>p.id===e.squadOrder.targetId)||w.time>=e.squadOrder.until))delete e.squadOrder;
 if(!living.length)return;
 // Existing orders keep their side and axis while destinations follow the target.
 for(const e of eligible){const order=e.squadOrder,target=living.find(p=>p.id===order?.targetId);if(!order||!target)continue;
  if(distance(e,target)>1400){delete e.squadOrder;continue;}
  if(order.kind==='flank'){order.x=target.x-Math.cos(order.axis)*180-Math.sin(order.axis)*order.side*260;order.y=target.y-Math.sin(order.axis)*180+Math.cos(order.axis)*order.side*260;}
  else{order.x=target.x;order.y=target.y;}
 }
 const free=eligible.filter(e=>!e.squadOrder&&(e.stun||0)<=0&&!['windup','active','recovery'].includes(e.actionPhase));
 for(const target of living){
  const near=free.filter(e=>!e.squadOrder&&distance(e,target)<1000&&living.every(p=>p===target||distance(e,target)<=distance(e,p)+160)).sort((a,b)=>distance(a,target)-distance(b,target)||(String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0));
  if(near.length<2)continue;
  // Do not keep recruiting a new rush every planning tick around an active pack.
  if(eligible.some(e=>e.squadOrder?.targetId===target.id&&e.squadOrder.until>w.time))continue;
  const rush=near.filter(melee).slice(0,3),ranged=near.filter(e=>['wisp','needle','scarab'].includes(enemyRole(e))).slice(0,3);
  if(rush.length+ranged.length<2)continue;
  const lead=rush[0]||ranged[0],axis=Math.atan2(target.y-lead.y,target.x-lead.x),group=++planner.serial,rushAt=w.time+.18,until=w.time+2.4;
  for(const [index,e]of rush.entries())e.squadOrder={group,targetId:target.id,kind:'rush',axis,side:index%2?1:-1,start:w.time,rushAt:rushAt+index*.08,until,x:target.x,y:target.y};
  for(const [index,e]of ranged.entries()){
   const side=index%2?-1:1,kind=index===2?'suppress':'flank';
   e.squadOrder={group,targetId:target.id,kind,axis,side,start:w.time,rushAt,until,x:target.x-Math.cos(axis)*180-Math.sin(axis)*side*260,y:target.y-Math.sin(axis)*180+Math.cos(axis)*side*260};
  }
 }
}

export function squadDestination(w,e,target){
 const order=e.squadOrder;if(!order||order.until<=w.time||order.targetId!==target.id)return null;
 if(order.kind==='rush'){
  const angle=Math.atan2(target.y-e.y,target.x-e.x),spread=distance(e,target)>200?order.side*55:0;
  return{x:target.x-Math.sin(angle)*spread,y:target.y+Math.cos(angle)*spread,altitude:target.altitude||0,speed:1.18,intent:'PACK RUSH'};
 }
 if(order.kind==='flank'&&distance(e,order)>95&&w.time-order.start<1.1)return{x:order.x,y:order.y,altitude:e.altitude||0,speed:1.08,intent:order.side>0?'FLANK RIGHT':'FLANK LEFT'};
 return null;
}
