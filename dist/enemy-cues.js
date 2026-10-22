import * as T from './vendor/three.module.min.js';
import {ENEMY_ATTACKS,ENEMY_ROLES,enemyRole} from './enemy-behaviors.js';
// One reusable line buffer per enemy / in-flight shell. No frame allocations of meshes.
export function createEnemyCues(parent){
 const pool=new Map();
 function draw(id,points,color,opacity){
  let line=pool.get(id);if(!line){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(1536),3));line=new T.LineSegments(geometry,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));line.frustumCulled=false;parent.add(line);pool.set(id,line);}
  const attribute=line.geometry.attributes.position;attribute.array.set(points);attribute.needsUpdate=true;line.geometry.setDrawRange(0,points.length/3);line.material.color.set(color);line.material.opacity=opacity;line.visible=true;
 }
 const point=(x,y,z)=>[x*.1,z*.1,y*.1];
 function circle(points,x,y,z,r){for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;points.push(...point(x+Math.cos(a)*r,y+Math.sin(a)*r,z),...point(x+Math.cos(b)*r,y+Math.sin(b)*r,z));}}
 return{update(w){
  for(const line of pool.values())line.visible=false;const used=new Set();
  for(const e of w.enemies){if(e.hp<=0)continue;
   const healedAge=w.time-(e.healedAt??-10);if(healedAge>=0&&healedAge<.5){const points=[];circle(points,e.x,e.y,(e.altitude||0)+5,20+healedAge*120);draw('r'+e.id,points,'#80f2b5',1-healedAge*2);used.add('r'+e.id);}
   const a=ENEMY_ATTACKS[e.attackKind];if(!a||!['windup','active','recovery'].includes(e.actionPhase))continue;
   const points=[],role=ENEMY_ROLES[enemyRole(e)],preparing=e.actionPhase==='windup',floor=(e.altitude||0)+3,z=(e.altitude||0)+(e.bodyHeight||65)*.6;
   if(e.actionPhase==='recovery'){circle(points,e.x,e.y,floor,e.r+9);draw('e'+e.id,points,'#d9e5d7',.38);used.add('e'+e.id);continue;}
   if(a.radius&&!a.heal){const shots=a.shots||1;for(let i=0;i<shots;i++){const offset=(i-(shots-1)/2)*100;circle(points,e.attackPoint.x+Math.cos(e.attackAngle+Math.PI/2)*offset,e.attackPoint.y+Math.sin(e.attackAngle+Math.PI/2)*offset,e.attackPoint.z+3,a.radius);}}
   else if(a.heal){circle(points,e.x,e.y,floor,a.radius);if(e.attackPoint)points.push(...point(e.x,e.y,z),...point(e.attackPoint.x,e.attackPoint.y,e.attackPoint.z));}
   else if(a.travel){const length=a.travel*a.active+a.reach;for(const side of[-1,1]){const ox=Math.cos(e.attackAngle+Math.PI/2)*a.reach*side,oy=Math.sin(e.attackAngle+Math.PI/2)*a.reach*side;points.push(...point(e.x+ox,e.y+oy,floor),...point(e.x+ox+Math.cos(e.attackAngle)*length,e.y+oy+Math.sin(e.attackAngle)*length,floor));}}
   else if(a.reach)circle(points,e.x,e.y,floor,a.reach);
   else{const length=e.attackKind==='snipe'?1150:650,spread=a.spread||0;for(const offset of spread?[-spread*(a.shots-1)/2,spread*(a.shots-1)/2]:[0]){const angle=e.attackAngle+offset;points.push(...point(e.x,e.y,z),...point(e.x+Math.cos(angle)*length,e.y+Math.sin(angle)*length,z+Math.tan(e.attackPitch||0)*length));}}
   draw('e'+e.id,points,role.color,preparing?.55+.4*Math.min(1,(e.actionTime||0)/a.windup):.85);used.add('e'+e.id);
  }
  for(const h of w.enemyHazards||[]){const points=[];circle(points,h.x,h.y,h.z+4,h.r);circle(points,h.x,h.y,h.z+5,h.r*Math.max(.03,h.time/h.max));draw('h'+h.id,points,'#ffbc69',.9);used.add('h'+h.id);}
  for(const[id,line]of pool)if(!used.has(id)){parent.remove(line);line.geometry.dispose();line.material.dispose();pool.delete(id);}
 },dispose(){for(const line of pool.values()){parent.remove(line);line.geometry.dispose();line.material.dispose();}pool.clear();}};
}
