import {ENEMY_ATTACKS,enemySeed,enemyRole} from './enemy-behaviors.js';
// Authored keys: crouch, pitch, roll, turret, petals. Animation never changes
// simulation clocks or actor position. Only body articulation uses held frames.
const poses={
 pounce:[[-.65,-.28,0,0,0],[.9,.35,0,0,0],[-.5,.2,0,0,0]],
 bite:[[-.15,-.2,.1,0,0],[.1,.38,-.12,0,0],[0,.1,0,0,0]],
 burst:[[.35,-.15,-.2,-.12,0],[.1,.12,.15,.14,0],[0,.08,0,.08,0]],
 fan:[[-.3,-.15,0,-.18,0],[-.45,.22,0,.28,0],[-.2,.12,0,.12,0]],
 sweep:[[-.4,-.12,-.12,-.35,0],[-.3,.15,.12,.2,0],[-.15,.08,.08,.15,0]],
 charge:[[-.55,-.36,0,0,0],[-.25,.48,0,0,0],[-.65,.3,0,0,0]],
 stomp:[[-.6,-.4,0,0,0],[-.8,.5,0,0,0],[-.4,.2,0,0,0]],
 snipe:[[-.18,-.04,0,-.15,0],[-.28,.16,0,.4,0],[-.12,.1,0,.22,0]],
 bombard:[[-.5,-.18,0,.9,0],[-.65,.28,0,.35,0],[-.3,.14,0,.55,0]],
 mend:[[.45,-.08,0,0,1],[.65,-.1,0,0,1],[.15,.08,0,0,.4]],
 siegeFan:[[-.4,-.22,0,-.15,0],[-.6,.28,0,.4,0],[-.25,.12,0,.15,0]],
 siegeBarrage:[[-.45,-.3,0,-.8,0],[-.6,.25,0,-.3,0],[-.2,.15,0,-.4,0]],
 siegeStomp:[[-.8,-.5,0,0,0],[-1,.55,0,0,0],[-.5,.2,0,0,0]],
};
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t),zero=[0,0,0,0,0];
export const ENEMY_MOTION={
 hunter:{energy:1.45,elastic:1,bounce:.42,sway:.07,lag:.42},
 wisp:{energy:1.25,elastic:.85,bounce:.55,sway:.2,lag:.32},
 scarab:{energy:1.15,elastic:.3,bounce:.12,sway:.035,lag:.16},
 rammer:{energy:1.4,elastic:.4,bounce:.2,sway:.055,lag:.2},
 needle:{energy:1.18,elastic:.5,bounce:.24,sway:.07,lag:.32},
 mortar:{energy:1.15,elastic:.25,bounce:.1,sway:.03,lag:.17},
 mender:{energy:1.25,elastic:.9,bounce:.35,sway:.12,lag:.5},
 siege:{energy:1.3,elastic:.2,bounce:.1,sway:.025,lag:.14},
};
const heldTime=(time,fps,end)=>time>=end?end:Math.floor(time*fps+1e-7)/fps;
function spring(time,duration,elastic){
 const t=clamp(time/Math.max(.001,duration));
 return Math.sin(t*Math.PI*(elastic>.6?5:3))*Math.exp(-t*3.5)*(1-smooth(t));
}
export function enemyPose(p,{style='anime',reduced=false,time=0}={}){
 const a=ENEMY_ATTACKS[p.attackKind],keys=poses[p.attackKind],profile=ENEMY_MOTION[enemyRole(p)];
 const anime=style==='anime',extras=anime&&!reduced,elapsed=Math.max(0,p.actionTime||0);
 let pose=zero,forward=0,twist=0,squash=0,stretch=0,kick=0,secondary=0,smear=0,brace=0;
 if(a&&keys&&p.hp!==0){
  if(p.actionPhase==='windup'){
   const time=extras?heldTime(elapsed,12,a.windup):elapsed;
   pose=mix(zero,keys[0],smooth(time/(a.windup*(anime?.5:.65))));
   if(anime){const load=smooth(time/(a.windup*.5));forward=(a.travel?-.5:-.12)*load;brace=.15*load;
    if(extras){squash=.055*profile.elastic*load;twist=(p.attackKind==='bite'?-.16:p.attackKind==='sweep'?-.12:.035)*load;}}
  }else if(p.actionPhase==='active'){
   pose=mix(keys[0],keys[1],smooth(elapsed/(anime?.035:.065)));
   if(anime){const pop=smooth(elapsed/.035);forward=(a.travel?.65:a.heal?0:-.2)*pop;brace=.25*pop;
    if(extras){stretch=(a.travel?.12:.065)*profile.elastic*Math.sin(clamp(elapsed/.13)*Math.PI);kick=Math.sin(clamp(elapsed/.14)*Math.PI);secondary=kick*profile.lag;smear=a.travel?.7+.3*Math.sin(clamp(elapsed/a.active)*Math.PI):a.reach?Math.sin(clamp(elapsed/.11)*Math.PI):0;}}
  }else if(p.actionPhase==='recovery'){
   const time=extras?heldTime(elapsed,18,a.recovery):elapsed,brake=anime?.1:.16;
   pose=time<brake?mix(keys[1],keys[2],smooth(time/brake)):mix(keys[2],zero,smooth((time-brake)/Math.max(.01,a.recovery-brake)));
   if(anime){const settle=1-smooth(time/a.recovery);forward=(a.travel?-.25:.12)*settle;brace=.18*settle;
    if(extras){const rebound=spring(Math.max(0,time-brake),a.recovery-brake,profile.elastic);pose[0]+=rebound*.55*profile.elastic;pose[1]+=rebound*.16;secondary=rebound*profile.lag;twist=rebound*.09;squash=Math.max(0,-rebound)*.04*profile.elastic;}}
  }
  if(anime){pose=[pose[0]*(1+.35*profile.energy),pose[1]*(1+.35*profile.energy),pose[2]*1.45,pose[3],pose[4]];}
 }
 if(p.stun>0){pose=[-.35,.22,.12,0,0];forward=twist=squash=stretch=kick=secondary=smear=brace=0;}
 const comboAge=time-(p.comboAt??-10);
 if(anime&&!reduced&&comboAge>=0&&comboAge<.42){const reaction=Math.sin(comboAge/.42*Math.PI)*(1-comboAge/.42);pose[1]-=reaction*.5;pose[2]+=reaction*.28;secondary+=reaction*.4;brace+=reaction*.25;}
 return{height:pose[0],pitch:pose[1],roll:pose[2],turret:pose[3],petals:pose[4],forward,twist,squash,stretch,kick,secondary,smear,brace};
}
// Shared by actual siege rendering and the lab, so previews cannot drift from play.
export function applyEnemyPose(g,p,options={}){
 const pose=enemyPose(p,options),u=g.userData;
 u.body.position.set(0,pose.height,-pose.forward);
 u.body.rotation.set(pose.pitch,pose.twist,pose.roll);
 // Mild silhouette deformation. Rigid/heavy roles receive much less than scouts.
 u.body.scale.set(1+pose.squash-pose.stretch*.3,1-pose.squash+pose.stretch,1+pose.squash*.4-pose.stretch*.25);
 if(!u.robot)for(let i=0;i<(u.arms?.length||0);i++){u.arms[i].rotation.z+=(i?1:-1)*pose.brace;u.arms[i].rotation.x-=pose.brace*.4;}
 return pose;
}
export function locomotionStyle(p){
 const role=enemyRole(p),variation=.92+enemySeed(p.id)*.16,profile=ENEMY_MOTION[role];
 return{stride:({hunter:.65,scarab:.32,rammer:.45,needle:.48,mortar:.23,mender:.35}[role]||.45)*variation,
  cadence:({hunter:1.6,scarab:1.1,rammer:1.25,needle:1.4,mortar:.85,mender:1.2}[role]||1)*variation,
  phase:enemySeed(p.id)*Math.PI*2,...profile};
}
