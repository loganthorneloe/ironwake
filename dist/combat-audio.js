import {enemyRole} from './enemy-behaviors.js';
export const WARNING_CUES={hunter:'hunter',wisp:'wisp',scarab:'scarab',rammer:'rammer',needle:'needle',mortar:'mortar',mender:'mender',siege:'siege'};
export const ATTACK_WARNING_CUES={bite:'bite',pounce:'hunter',burst:'wisp',fan:'scarab',sweep:'sweep',charge:'rammer',stomp:'stomp',snipe:'needle',bombard:'mortar',mend:'mender',siegeFan:'siege',siegeBarrage:'siegeBarrage',siegeStomp:'stomp'};
// Collect fresh replicated events once, prioritize threats aimed at this pilot,
// and discard excess cues immediately instead of playing a stale warning queue.
export function createCombatAudioTracker(){
 const seen=new Map();let last=-1,played=[];
 return{reset(){seen.clear();last=-1;played=[];},collect(w,listener,enabled=true){
  if(w.time<last){seen.clear();played=[];}last=w.time;
  played=played.filter(at=>w.time-at<.12);
  for(const[key,at]of seen)if(w.time-at>3)seen.delete(key);
  const candidates=[];
  function add(key,cue,source,priority){
   if(seen.has(key))return;seen.set(key,w.time);
   const dx=source.x-listener.x,dy=source.y-listener.y,d=Math.hypot(dx,dy);
   if(!enabled||listener.hp<=0||d>1200)return;
   candidates.push({cue,sourceId:source.id,pan:Math.sin(Math.atan2(dy,dx)-(listener.angle||0))*.85,gain:Math.pow(Math.max(0,1-d/1200),1.3),priority:priority+(source.attackTarget===listener.id?4:0)-d/1200});
  }
  for(const e of w.enemies){
   if(e.hp<=0||e.stun>0||e.training||e.objective||e.type==='rival')continue;
   if(e.actionPhase==='windup'&&(e.actionTime||0)<.18)add('a:'+e.id+':'+(e.actionCount||0),ATTACK_WARNING_CUES[e.attackKind]||WARNING_CUES[enemyRole(e)],e,['needle','rammer','siege'].includes(enemyRole(e))?4:2);
   const order=e.squadOrder;
   if(order?.kind==='rush'&&w.time>=order.rushAt-.18&&w.time-order.rushAt<.15)add('r:'+order.group+':'+order.start,'rush',e,3);
  }
  for(const c of w.teamCombos||[])if(w.time-c.at<.2)add('c:'+c.id,c.kind==='finish'?'teamFinish':'teamBreak',c,6);
  candidates.sort((a,b)=>b.priority-a.priority);
  const result=candidates.slice(0,Math.max(0,3-played.length));for(const cue of result)played.push(w.time);return result;
 }};
}
