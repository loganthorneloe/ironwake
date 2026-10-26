import * as T from './vendor/three.module.min.js';
import {FIELD_ITEMS,FIELD_RELAYS} from './field-catalog.js';
import {impactMode} from './impact-preferences.js';

// Field equipment uses the same three-step toon ramp, dark ink and service
// colors as the mech. Models are merged once, then shared across bounded nodes.
export const FIELD_SCENE_LIMITS=Object.freeze({nodes:64,pilots:4});
const INK='#14262d',BONE='#d5cfac',STEEL='#7a9495',DARK='#283d44',ORANGE='#e9a365';
const hash=value=>[...String(value)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
const entries=(kind)=>Object.values(kind==='relay'?FIELD_RELAYS:FIELD_ITEMS);
const TECH_ASSEMBLIES={gyro:[3,0],spall:[4,0],ferrite:[0,0],redline:[3,1],bloodpump:[0,1],mirror:[1,0],razor:[3,2],lens:[1,1],resonator:[1,2],nozzle:[3,3],igniter:[2,0],relaycoil:[0,2],medic:[5,0],reactor:[0,3],laststand:[5,1],anvil:[4,1],aegis:[4,2],blackbox:[2,1]};
const metadata=node=>(node.kind==='relay'?FIELD_RELAYS[node.relayId]:FIELD_ITEMS[node.itemId])||{id:'unknown',icon:'IW',color:'#8cded5',role:'FIELD TECH'};

export function createFieldScene(parent){
 const root=new T.Group();root.name='field-equipment';parent.add(root);
 const box=new T.BoxGeometry(1,1,1),tube=new T.CylinderGeometry(1,1,1,8),cone=new T.CylinderGeometry(.55,1,1,6),orb=new T.IcosahedronGeometry(1,0),ring=new T.TorusGeometry(1,.06,4,32),plane=new T.PlaneGeometry(1,1);
 const gradient=new T.DataTexture(new Uint8Array([48,48,48,255,142,142,142,255,255,255,255,255]),3,1,T.RGBAFormat);gradient.minFilter=gradient.magFilter=T.NearestFilter;gradient.generateMipmaps=false;gradient.needsUpdate=true;
 const toon=new T.MeshToonMaterial({vertexColors:true,gradientMap:gradient}),basic=new T.MeshBasicMaterial({vertexColors:true}),ink=new T.LineBasicMaterial({color:INK}),pulseMaterial=new T.MeshBasicMaterial({color:'#c9eee0',transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide});
 const ownedGeometry=new Set([box,tube,cone,orb,ring,plane]),ownedMaterials=new Set([toon,basic,ink,pulseMaterial]),templates=new Map(),nodes=new Map(),pilots=new Map(),stamp=new T.Object3D(),normal=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3(),color=new T.Color();
 let atlas=null,atlasMaterial=null;const atlasIndex=new Map();
 if(globalThis.document){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');
  if(c){c.fillStyle=INK;c.fillRect(0,0,512,512);[...Object.values(FIELD_ITEMS),...Object.values(FIELD_RELAYS)].forEach((meta,i)=>{atlasIndex.set(meta.id,i);const x=i%8*64,y=Math.floor(i/8)*64;c.strokeStyle=meta.color;c.lineWidth=2;c.strokeRect(x+5,y+8,54,48);c.fillStyle=meta.color;c.textAlign='center';c.textBaseline='middle';c.font='bold 19px monospace';c.fillText(meta.icon||'IW',x+32,y+32,50);});atlas=new T.CanvasTexture(canvas);atlas.colorSpace=T.SRGBColorSpace;atlas.magFilter=T.NearestFilter;atlasMaterial=new T.MeshBasicMaterial({map:atlas,side:T.DoubleSide});ownedMaterials.add(atlasMaterial);}
 }
 function component(parts,geo,x,y,z,sx,sy,sz,tint,lit=false,rx=0,ry=0,rz=0){parts.push({geo,x,y,z,sx,sy,sz,tint,lit,rx,ry,rz});}
 function bake(key,parts){
  if(templates.has(key))return templates.get(key);const meshes=[];
  for(const lit of[false,true]){const positions=[],normals=[],colors=[];
   for(const part of parts){if(part.lit!==lit)continue;stamp.position.set(part.x,part.y,part.z);stamp.rotation.set(part.rx,part.ry,part.rz);stamp.scale.set(part.sx,part.sy,part.sz);stamp.updateMatrix();normal.getNormalMatrix(stamp.matrix);color.set(part.tint);const g=part.geo.index?part.geo.toNonIndexed():part.geo,pa=g.attributes.position,na=g.attributes.normal;
    for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i).applyMatrix4(stamp.matrix);n.fromBufferAttribute(na,i).applyMatrix3(normal).normalize();positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);}if(g!==part.geo)g.dispose();
   }
   if(!positions.length)continue;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();ownedGeometry.add(geometry);meshes.push({geometry,material:lit?basic:toon});
   if(!lit){const edges=new T.EdgesGeometry(geometry,28);ownedGeometry.add(edges);meshes.push({geometry:edges,material:ink,edge:true});}
  }
  templates.set(key,meshes);return meshes;
 }
 function model(key,parts){const g=new T.Group();g.name=key;for(const template of bake(key,parts)){const mesh=template.edge?new T.LineSegments(template.geometry,template.material):new T.Mesh(template.geometry,template.material);mesh.castShadow=!template.edge&&template.material===toon;mesh.receiveShadow=true;g.add(mesh);}return g;}
 function screen(g,meta,x,y,z,size=1){if(!atlasMaterial)return;const index=atlasIndex.get(meta.id);if(index===undefined)return;const key='screen:'+meta.id;let geometry=templates.get(key);if(!geometry){geometry=plane.clone();const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,((index%8)+uv.getX(i))/8,1-(Math.floor(index/8)+1-uv.getY(i))/8);ownedGeometry.add(geometry);templates.set(key,geometry);}const mesh=new T.Mesh(geometry,atlasMaterial);mesh.position.set(x,y,z);mesh.rotation.y=z<0?Math.PI:0;mesh.scale.setScalar(size);g.add(mesh);}
 function tech(meta){
  const p=[],id=meta.id||meta.icon||'tech',index=Math.max(0,entries('cache').findIndex(m=>m.id===id)),[family,variant]=TECH_ASSEMBLIES[id]||[index%6,Math.floor(index/6)],accent=meta.color||'#8cded5';
  const add=(geo,x,y,z,sx,sy,sz,c,lit=false,rx=0,ry=0,rz=0)=>component(p,geo,x,y,z,sx,sy,sz,c,lit,rx,ry,rz);
  // Capacitor bank, optical assembly, thermal block, vector motor, armor pack,
  // and service drone. Each variant changes structure as well as paint.
  if(family===0){for(let i=0;i<2+variant;i++){const x=(i-(1+variant)/2)*.62;add(tube,x,0,0,.25,1.25+variant*.14,.25,BONE);add(tube,x,.38,0,.27,.13,.27,accent,true);add(box,x,-.67,0,.2,.28,.2,STEEL);}add(box,0,-.45,0,1.5+variant*.5,.16,.5,DARK);}
  if(family===1){add(tube,0,0,0,.74,.5,.74,STEEL,false,Math.PI/2);add(tube,0,0,-.29,.56,.12,.56,accent,true,Math.PI/2);for(let i=0;i<3+variant;i++){const a=i*Math.PI*2/(3+variant);add(box,Math.cos(a)*.85,Math.sin(a)*.85,0,.22,.46,.3,BONE,false,0,0,a);}add(box,0,-.8,.2,.5,.4,.6,DARK);}
  if(family===2){add(box,0,0,0,1.1,.9,.6,DARK);for(let i=0;i<4+variant;i++)add(box,(i-(3+variant)/2)*.27,0,0,.13,1.1+variant*.2,.9,BONE);add(box,0,0,-.5,1.3,.18,.12,accent,true);for(const side of[-1,1])add(tube,side*.65,-.4,0,.16,.5,.16,STEEL,false,0,0,Math.PI/2);}
  if(family===3){add(tube,0,0,0,.56,1.35,.56,DARK,false,Math.PI/2);for(let i=0;i<2+variant;i++)add(tube,0,0,-.5+i*.42,.69,.13,.69,BONE,false,Math.PI/2);add(cone,0,0,-.85,.48,.5,.48,accent,true,Math.PI/2);for(const side of[-1,1])add(box,side*.77,.1,0,.32,.65+variant*.3,1.15,STEEL,false,0,0,-side*.2);}
  if(family===4){for(let i=0;i<2+variant;i++)add(box,0,-.3+i*.32,-i*.08,1.45-i*.1,.22,1.1,BONE,false,.1,0,i%2?.13:-.13);for(const side of[-1,1])add(box,side*.57,.15,-.58,.16,.8,.12,accent,true);add(box,0,-.7,0,.6,.3,.65,DARK);}
  if(family===5){add(orb,0,0,0,.7,.48,.65,BONE);add(box,0,0,-.64,.65,.18,.1,accent,true);for(let i=0;i<3+variant;i++){const a=i*Math.PI*2/(3+variant);add(box,Math.cos(a)*.8,-.15,Math.sin(a)*.8,.15,.3,1,DARK,false,0,-a+Math.PI/2);add(tube,Math.cos(a)*1.12,-.25,Math.sin(a)*1.12,.25,.25,.25,accent);}add(box,0,.55,0,.1,.45,.1,STEEL);}
  const g=model('salvage:'+id,p);screen(g,meta,0,.05,-.72,.65);return g;
 }
 function housing(){const p=[];for(const side of[-1,1]){component(p,box,side*1.55,.52,0,.5,1.05,2.6,BONE);component(p,box,side*1.83,.7,0,.08,.33,1.8,ORANGE);component(p,box,side*1.3,.12,0,.45,.24,3.1,DARK);}component(p,box,0,.18,0,3.3,.36,2.5,DARK);component(p,box,0,.43,0,2.7,.08,1.9,STEEL);component(p,box,0,.48,-1.3,2.6,.32,.2,BONE);for(let i=0;i<4;i++)component(p,box,(i-1.5)*.55,.49,1.28,.25,.22,.12,ORANGE);return model('cache:housing',p);}
 function shutters(){const p=[];for(const side of[-1,1]){component(p,box,side*.79,1.4,0,1.55,.26,2.4,BONE,false,0,0,side*.13);component(p,box,side*.8,1.55,0,1.4,.09,.3,ORANGE);}return model('cache:shutters',p);}
 function relay(meta){const p=[],index=Math.max(0,entries('relay').findIndex(m=>m.id===meta.id)),family=index%6,variant=Math.floor(index/6),accent=meta.color||'#8cded5',height=5.3+variant*.8;
  const add=(geo,x,y,z,sx,sy,sz,c,lit=false,rx=0,ry=0,rz=0)=>component(p,geo,x,y,z,sx,sy,sz,c,lit,rx,ry,rz);
  add(tube,0,.2,0,2.1,.4,2.1,DARK);add(cone,0,.6,0,1.6,.6,1.6,BONE);add(box,0,2.5,0,1.1,3.7,.95,DARK);for(const side of[-1,1]){add(box,side*.72,2.4,0,.4,3.1,1.3,BONE,false,0,0,-side*.05);add(box,side*.85,.58,0,1.3,.23,.45,ORANGE,false,0,0,side*.55);}add(box,0,2.8,-.55,.62,1.15,.12,accent,true);add(box,0,3.8,-.58,.8,.15,.1,ORANGE);
  if(family===0){add(box,0,height,0,.35,3+variant*.4,.35,STEEL);for(let i=0;i<3+variant;i++){add(box,0,height-.75+i*.65,0,3.5-i*.5,.16,.2,BONE);add(box,0,height-.73+i*.65,-.13,2.5-i*.4,.06,.04,accent,true);}}
  if(family===1){for(const side of[-1,1]){add(box,side*1.05,height-.5,0,.4,2.7,.5,STEEL,false,0,0,-side*.2);add(tube,side*1.3,height+.5,0,.4,.25,.4,accent,true);}for(let i=0;i<2+variant;i++)add(tube,0,height-.6+i*.5,0,1.05,.16,1.05,BONE);}
  if(family===2){add(tube,0,height,0,1.7,.32,1.7,BONE,false,Math.PI/3);add(tube,0,height-.15,-.17,1.3,.35,1.3,DARK,false,Math.PI/3);add(orb,0,height+.3,-.7,.35,.35,.35,accent,true);add(box,0,height-1,0,.3,2.4,.4,STEEL);for(let i=0;i<variant+1;i++)add(box,.7+i*.4,height-.4+i*.6,.3,.16,1.7,.16,STEEL);}
  if(family===3){for(const side of[-1,1])add(box,side*1.2,height-.3,0,.5,2.5,.65,BONE);add(box,0,height+.9,0,2.9,.4,.7,BONE);add(tube,0,height,0,.7,1.8,.7,accent,true);for(let i=0;i<2+variant;i++)add(tube,0,height-.7+i*.6,0,1,.12,1,DARK);}
  if(family===4){add(box,0,height,0,3.1,1.7,.4,DARK,false,.1);for(let i=0;i<3+variant;i++)add(box,(i-(2+variant)/2)*.62,height,0,.44,2+variant*.25,.6,BONE,false,.15);add(box,0,height-.55,-.4,2.6,.2,.12,accent,true);add(box,0,height+1.4,0,.1,1.2,.1,STEEL);}
  if(family===5){add(tube,0,height,0,.95,2,.95,BONE);for(let i=0;i<3+variant;i++)add(tube,0,height-.7+i*.4,0,1.05,.1,1.05,accent,true);for(const side of[-1,1]){add(box,side*1.35,height-.4,0,.25,2.4,.7,STEEL);add(orb,side*1.35,height+.9,0,.3,.3,.3,ORANGE);}}
  const g=model('relay:'+meta.id,p);screen(g,meta,0,2.8,-.64,.92);screen(g,meta,0,2.8,.64,.92);return g;
 }
 const beaconGeometry=new T.CylinderGeometry(.018,.075,16,4);ownedGeometry.add(beaconGeometry);
 function markerMaterial(tint,opacity){const key='marker:'+tint+':'+opacity;if(templates.has(key))return templates.get(key);const material=new T.MeshBasicMaterial({color:tint,transparent:true,opacity,depthWrite:false,side:T.DoubleSide});ownedMaterials.add(material);templates.set(key,material);return material;}
 function createNode(node){const meta=metadata(node),g=new T.Group(),isRelay=node.kind==='relay',base=isRelay?relay(meta):housing(),content=isRelay?null:tech(meta),lid=isRelay?null:shutters();g.name=node.id;g.add(base);if(lid)g.add(lid);if(content)g.add(content);const beacon=new T.Mesh(beaconGeometry,markerMaterial(meta.color,.28)),halo=new T.Mesh(ring,markerMaterial(meta.color,.75));beacon.position.y=10;halo.rotation.x=Math.PI/2;halo.position.y=.1;halo.scale.setScalar(isRelay?2.5:2.3);g.add(beacon,halo);root.add(g);const entry={g,base,content,lid,beacon,halo,signature:(node.kind==='relay'?node.relayId:node.itemId),index:hash(node.id)%97,meta};nodes.set(node.id,entry);return entry;}
 function pilotFx(id){const g=new T.Group(),halo=new T.Mesh(ring,markerMaterial('#8cded5',.5)),pulse=new T.Mesh(ring,pulseMaterial);halo.rotation.x=pulse.rotation.x=Math.PI/2;halo.scale.setScalar(2.7);pulse.visible=false;g.add(halo,pulse);root.add(g);const fx={g,halo,pulse,level:null,pulseAt:-10};pilots.set(id,fx);return fx;}
 function preview(kind,id){return kind==='relay'?relay(FIELD_RELAYS[id]||{id,color:'#8cded5'}):tech(FIELD_ITEMS[id]||{id,color:'#8cded5'});}
 return{root,nodes,pilots,preview,
  stats(){return{fieldNodes:nodes.size,fieldPilots:pilots.size,fieldTemplates:templates.size};},
  update(w,t=w.time||0,selfId=null){
   const reduced=impactMode()==='reduced',list=(w.field?.nodes||[]).slice(0,FIELD_SCENE_LIMITS.nodes),ids=new Set(list.map(n=>n.id)),self=w.players?.find(p=>p.id===selfId);
   for(const[id,entry]of nodes)if(!ids.has(id)){entry.g.removeFromParent();nodes.delete(id);}
   for(const node of list){const signature=node.kind==='relay'?node.relayId:node.itemId;let entry=nodes.get(node.id);if(entry&&entry.signature!==signature){entry.g.removeFromParent();nodes.delete(node.id);entry=null;}entry||=createNode(node);const {g,base,content,lid,beacon,halo,index}=entry,spent=node.state==='spent'||(node.kind==='relay'&&self&&node.claimed?.includes(self.id));g.position.set(node.x*.1,(node.z||0)*.1,node.y*.1);entry.spent=spent;beacon.visible=halo.visible=!spent;beacon.material=markerMaterial(entry.meta.color,reduced?.16:.28);if(!reduced)halo.scale.setScalar((node.kind==='relay'?2.5:2.3)+Math.sin(t*1.8+index)*.08);if(content){content.visible=!spent;content.position.y=2.4+(reduced?0:Math.sin(t*1.9+index)*.15);content.rotation.y=reduced?index*.37:t*.65+index;lid.position.y=spent?.1:.35;lid.rotation.z=spent?-.2:0;}
    // Spent infrastructure remains in the level, with quiet neutral machinery.
    base.children.forEach(o=>{if(o.isMesh&&o.material===basic)o.visible=!spent;});
   }
   const players=(w.players||[]).slice(0,FIELD_SCENE_LIMITS.pilots),playerIds=new Set(players.map(p=>p.id));for(const[id,fx]of pilots)if(!playerIds.has(id)){fx.g.removeFromParent();pilots.delete(id);}
   for(const p of players){const fx=pilots.get(p.id)||pilotFx(p.id),level=p.field?.level||1;if(fx.level!==null&&level>fx.level)fx.pulseAt=t;fx.level=level;fx.g.position.set(p.x*.1,(p.altitude||0)*.1+.12,p.y*.1);const buffs=(p.field?.buffs||[]).filter(b=>b.expiresAt>(w.time||0));fx.halo.visible=p.hp>0&&buffs.length>0;const buff=FIELD_RELAYS[buffs.at(-1)?.relayId];if(buff)fx.halo.material=markerMaterial(buff.color,.5);fx.halo.rotation.z=reduced?0:t*.1;const age=t-fx.pulseAt;fx.pulse.visible=p.hp>0&&age>=0&&age<(reduced?.5:1.2);if(fx.pulse.visible){const f=age/(reduced?.5:1.2);fx.pulse.scale.setScalar(2.8+f*(reduced?1.6:7));fx.pulse.position.y=f*.3;}
   }
  },
  dispose(){root.removeFromParent();root.clear();nodes.clear();pilots.clear();for(const geometry of ownedGeometry)geometry.dispose();for(const material of ownedMaterials)material.dispose();gradient.dispose();atlas?.dispose();templates.clear();}
 };
}
