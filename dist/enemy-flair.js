import * as T from './vendor/three.module.min.js';
import {ENEMY_ATTACKS,ENEMY_ROLES,enemyRole} from './enemy-behaviors.js';
import {impactLevel} from './impact-preferences.js';

// Graphic accents are shared across the horde: two fixed draws, no textures,
// screen flashes, actor clones, camera moves, or simulation time manipulation.
export function createEnemyFlair(parent){
 const capacity=64,vertices=capacity*96,linePositions=new Float32Array(vertices*3),lineColors=new Float32Array(vertices*3),smearPositions=new Float32Array(vertices*3),smearColors=new Float32Array(vertices*3);
 function geometry(positions,colors){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage));g.setDrawRange(0,0);return g;}
 const lines=new T.LineSegments(geometry(linePositions,lineColors),new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));
 const smears=new T.Mesh(geometry(smearPositions,smearColors),new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.45,side:T.DoubleSide,depthWrite:false}));
 lines.frustumCulled=smears.frustumCulled=false;parent.add(lines,smears);
 let lineCount=0,smearCount=0;
 const tint=new T.Color();
 function vertex(array,colors,index,x,y,z,fade){if(index>=vertices)return index;array.set([x*.1,z*.1,y*.1],index*3);colors.set([tint.r*fade,tint.g*fade,tint.b*fade],index*3);return index+1;}
 return{update(w,{style='anime',reduced=impactLevel()<1}={}){
  lineCount=smearCount=0;
  if(style==='anime'&&!reduced){
   for(const c of (w.teamCombos||[]).slice(-12)){
    const age=w.time-c.at;if(age<0||age>.45)continue;const fade=1-age/.45,r=(c.kind==='finish'?40:27)+age*100;tint.set(c.kind==='finish'?'#fff0b8':'#b6fbff');
    for(let i=0;i<8;i++){const a=i*Math.PI/4,b=a+Math.PI/8;for(const [x,y,z]of[[c.x+Math.cos(a)*r,c.y+Math.sin(a)*r,c.z],[c.x+Math.cos(b)*r*.4,c.y+Math.sin(b)*r*.4,c.z+12*fade]])lineCount=vertex(linePositions,lineColors,lineCount,x,y,z,fade);}
   }
   for(const e of w.enemies.slice(0,capacity)){
   const a=ENEMY_ATTACKS[e.attackKind];if(e.hp<=0||e.stun>0||!a)continue;
   const time=e.actionTime||0,angle=e.attackAngle||0,fx=Math.cos(angle),fy=Math.sin(angle),sx=-fy,sy=fx,z=(e.altitude||0)+(e.bodyHeight||75)*.7;
   tint.set(ENEMY_ROLES[enemyRole(e)].color);
   const at=(forward,side,height)=>[e.x+fx*forward+sx*side,e.y+fy*forward+sy*side,height];
   const stroke=(from,to,fade=1)=>{lineCount=vertex(linePositions,lineColors,lineCount,...from,fade*.35);lineCount=vertex(linePositions,lineColors,lineCount,...to,fade);};
   if(e.actionPhase==='windup'){
    // A single lens glint builds into the release; never a pulsing warning.
    const progress=time/a.windup;if(progress>.65){const gleam=Math.sin(Math.min(1,(progress-.65)/.35)*Math.PI),size=gleam*(enemyRole(e)==='siege'?23:15);tint.set('#f4fff9');
     stroke(at(e.r,-size,z),at(e.r,size,z));stroke(at(e.r,0,z-size*.7),at(e.r,0,z+size*.7));
    }
   }else if(e.actionPhase==='active'){
    if(a.travel){for(let i=0;i<6;i++){const side=(i%2?1:-1)*(e.r+5+Math.floor(i/2)*7),height=(e.altitude||0)+9+Math.floor(i/2)*9;stroke(at(-e.r-65-i*8,side,height),at(e.r*.2,side,height));}}
    else if(a.reach){const fade=Math.max(0,1-time/.15),rad=Math.min(a.reach,e.r*2.5),segments=8;
     for(let i=0;i<segments&&fade>0;i++){const start=-1.1+i*2.2/segments,end=start+2.2/segments;const tip=at(Math.cos(end)*rad,Math.sin(end)*rad,z),base=at(Math.cos(start)*rad,Math.sin(start)*rad,z),inside=at(Math.cos(start)*rad*.65,Math.sin(start)*rad*.65,z-5);stroke(base,tip,fade);for(const p of[base,inside,tip])smearCount=vertex(smearPositions,smearColors,smearCount,...p,fade);}
    }else if(time<.15){const fade=1-time/.15;for(const side of[-1,1])stroke(at(e.r+5,side*6,z),at(e.r+30,side*18,z+10),fade);}
   }
  }}
  for(const [mesh,count]of[[lines,lineCount],[smears,smearCount]]){mesh.visible=count>0;mesh.geometry.setDrawRange(0,count);mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.attributes.color.needsUpdate=true;}
 },dispose(){for(const mesh of[lines,smears]){parent.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}},stats(){return{capacity,lineVertices:lineCount,smearVertices:smearCount,maxVertices:vertices};}};
}
