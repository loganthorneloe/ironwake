import * as T from './vendor/three.module.min.js';
import {makeMech,animateMech,disposeMech} from './three-view.js?v=impact-1';
import {buildKey,cleanBuild} from './core.js?v=41';
import {chassisBlueprint} from './chassis.js';
import {HUB_STATIONS} from './hub-state.js';

// Repeated architecture is instanced by geometry/material; only machinery and pilots animate.
export function createHubScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#172c37');scene.fog=new T.Fog('#172c37',105,230);
  const camera=new T.PerspectiveCamera(47,1,.2,400),target=new T.Vector3(0,0,0),point=new T.Vector3();
  scene.add(new T.HemisphereLight('#d9efff','#30424b',2));
  const sun=new T.DirectionalLight('#ffd8ad',3.4);sun.position.set(-45,70,30);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-65,right:65,top:55,bottom:-55,near:1,far:180});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.06;scene.add(sun);
  const fill=new T.DirectionalLight('#77baca',1.2);fill.position.set(40,20,-40);scene.add(fill);
  const geo={box:new T.BoxGeometry(1,1,1),tube:new T.CylinderGeometry(1,1,1,12),ball:new T.IcosahedronGeometry(1,1),ring:new T.TorusGeometry(1,.035,4,48)};
  const materials=new Map(),batches=new Map(),textures=[],moving=[],models=new Map(),dummies=[],labels=[];
  const mat=(color,glow=false)=>{const key=color+glow;if(!materials.has(key))materials.set(key,glow?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:.78,metalness:.3}));return materials.get(key);};
  function piece(x,y,z,w,h,d,color,shape='box',glow=false,rotation=0,dynamic=false){
    const material=mat(color,glow),g=geo[shape],o=new T.Mesh(g,material);o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.y=rotation;
    if(dynamic){o.castShadow=!glow;o.receiveShadow=true;scene.add(o);return o;}
    o.updateMatrix();const key=shape+color+glow;let b=batches.get(key);if(!b)batches.set(key,b={geo:g,mat:material,matrices:[],shadow:!glow});b.matrices.push(o.matrix.clone());return o;
  }
  const box=(...args)=>piece(...args);
  const cylinder=(x,y,z,r,h,color,glow=false)=>piece(x,y,z,r,h,r,color,'tube',glow);
  function ring(x,y,z,r,color){const o=new T.Mesh(geo.ring,mat(color,true));o.position.set(x,y,z);o.scale.setScalar(r);o.rotation.x=-Math.PI/2;scene.add(o);return o;}
  function sign(text,x,y,z,color,width=11){
    const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d');
    ctx.fillStyle='#10212a';ctx.fillRect(0,0,768,160);ctx.fillStyle=color;ctx.fillRect(0,0,9,160);ctx.font='600 57px Arial';ctx.textAlign='center';ctx.fillText(text,390,101,735);
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
    const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),plane=new T.Mesh(new T.PlaneGeometry(width,width*160/768),material);plane.position.set(x,y,z);scene.add(plane);labels.push(plane);return plane;
  }
  function crate(x,z,size=1.4,color='#657477',y=.7){
    box(x,y,z,size,size,size,color);for(const side of[-1,1])box(x+side*size*.33,y,z,size*.08,size*1.04,size*1.03,'#273a43');
    box(x,y+.12,z+size*.51,size*.5,size*.16,.04,'#bdc8b3');
  }
  function tank(x,z,color='#d89b54',height=3){cylinder(x,height/2,z,.75,height,'#536b74');for(const y of[.3,height-.3])cylinder(x,y,z,.83,.2,'#273c49');box(x,height*.64,z+.74,.18,height*.38,.08,color,'box',true);}
  function npc(x,z,color){
    box(x,1.75,z,.7,1.1,.5,color);cylinder(x,2.55,z,.28,.5,'#d4ba94');box(x,2.65,z+.27,.44,.13,.07,'#90ebdc','box',true);
    for(const side of[-1,1]){box(x+side*.23,.72,z,.24,1,.3,'#273f49');box(x+side*.6,1.7,z+.13,.25,1,.28,color);box(x+side*.23,.16,z+.12,.35,.2,.6,'#1b2d36');}
  }
  function stall(s){
    const x=s.x,z=s.id==='parts'||s.id==='story'?-17:7;
    box(x,.15,z,16,.3,10,'#344c57');box(x,2,z-3.8,16,4,.5,'#293f4a');
    for(const side of[-1,1]){box(x+side*7.7,3.2,z,.4,6.4,8,'#30434c');box(x+side*7.7,6.4,z,.7,.3,9,s.color);box(x+side*7.4,2,z+3.7,.2,4,.2,s.color,'box',true);}
    if(s.id!=='parts')box(x,6.6,z-2.7,16.4,.45,4.8,'#465962');
    for(let i=0;i<8;i++)box(x-7+i*2,6.88,z-1,.12,.16,8.5,'#809191');
    box(x,5.4,z+3.1,14.7,1.8,.35,'#1a303a');sign(s.number+' / '+s.name.toUpperCase(),x,5.5,z+3.32,s.color,13.8);
    box(x,1.3,z+2.7,9,2.6,1.7,'#4b6065');box(x,2.65,z+2.7,9.4,.15,2,'#96aaa6');box(x,1.5,z+3.58,7,.12,.05,s.color,'box',true);
    npc(x-2,z+.6,s.color);box(x+2,3,z+2.8,1.2,.7,.15,'#1d3640','box',false,-.25);box(x+2,3.05,z+2.9,.9,.45,.05,s.color,'box',true,-.25);
    ring(s.x,.06,s.z,3.1,s.color);for(let i=0;i<5;i++)box(s.x-1.5+i*.75,.035,s.z+3.3,.4,.03,.7,s.color);
  }

  // The Anchorage sits above a cloud sea, with distant factories marking the campaign front.
  box(0,-1,0,94,2,69,'#263b46');box(0,-2.5,0,97,1,72,'#172e3c');
  for(let x=-44;x<=44;x+=4)for(let z=-30;z<=30;z+=4){box(x,.012,z,3.94,.04,3.94,((x+z)/4)%3?'#52656b':'#5b6c70');box(x-1.8,.045,z-1.8,.12,.03,.12,'#98aaa5');}
  for(const x of[-15,15]){box(x,.065,0,.16,.04,55,'#d2b778');box(x+.45,.065,0,.06,.04,55,'#e5d5a5');}
  for(const side of[-1,1]){
    box(side*46,1.5,0,1.2,3,69,'#344b59');box(side*46,3.05,0,1.4,.15,69,'#93a7a5');
    for(let z=-30;z<=30;z+=5){box(side*44.7,2.5,z,.3,5,.3,'#284551');box(side*44.7,4.7,z,.45,.5,.5,'#f6d6a0','box',true);}
    for(let i=0;i<12;i++){const h=8+(i*7%23);box(side*(64+i*3),h/2-9,-55-i*6,5+i%3,h,5,'#253e4b');box(side*(64+i*3),h-8,-55-i*6,.16,1,.16,'#fd9164','box',true);}
    box(side*35,-.1,33,20,.4,1,'#d7a66a');
  }
  // Rear blast wall, layered power conduits and the service gantry.
  box(0,3,-33,92,6,1.5,'#2a4553');for(let x=-42;x<44;x+=6){box(x,3,-32,1,6,2,'#49636b');box(x,5.6,-31.8,3.4,.2,.1,'#95c6bd','box',true);}
  for(const z of[-30,30])for(let i=0;i<24;i++)box(-44+i*3.8,.07,z,1.9,.06,.5,i%2?'#243a45':'#cfad67','box',false,-.55);
  for(const s of HUB_STATIONS.filter(s=>s.id!=='mission'))stall(s);

  // Quartermaster: stocked shelves, oxygen bottles, cases, pallet cart and a striped awning.
  for(let i=0;i<6;i++){crate(-31+i*1.8,4,1.25,i%2?'#77988a':'#b18b58');crate(-31+i*1.8,4,1.1,'#839085',2.1);}
  for(let i=0;i<3;i++)tank(-33+i*2.1,10,'#ffc278',2.6);
  crate(-18,11,1.7);crate(-19.7,12.5,1.2);box(-31,.32,14,4,.4,2.3,'#c2a269');for(const side of[-1,1])cylinder(-31+side*1.4,.3,14,.4,.3,'#182c36');
  for(let i=0;i<8;i++)box(-33+i*2,6.9,7,1,.08,7,'#a67a42');

  // Foundry: structural frame on a jig, gantry crane, cable reel, pipes and tool wall.
  const display=makeMech(cleanBuild(chassisBlueprint('vanguard')));display.position.set(-28,.2,-17);display.scale.multiplyScalar(.62);scene.add(display);dummies.push(display);
  box(-21,8,-17,.6,8,.6,'#d0a45d');box(-27,11.7,-17,13,.7,.7,'#d0a45d');box(-26,9.6,-17,.07,4,.07,'#283f49');box(-26,7.5,-17,.7,.7,.3,'#d9b26d');
  for(let i=0;i<4;i++){box(-32+i*.8,3.5,-20,.2,1.4,.16,'#94b4be');box(-32+i*.8,4,-19.9,.7,.2,.1,'#81a8b3');}
  for(let i=0;i<3;i++){cylinder(-34+i*1.3,.5,-10,.5,1,'#547783');box(-34+i*1.3,1.6,-10,.2,2,.2,'#8ac9da');}
  const fan=piece(-20,3.8,-19,1,.2,1,'#79d5ee','tube',false,0,true);fan.rotation.x=Math.PI/2;moving.push({o:fan,kind:'fan'});
  // Service catwalk and exposed coolant runs make the foundry read as a working repair bay.
  for(const x of[-34,-18]){box(x,4,-18,.55,8,.55,'#b59360');box(x,8.1,-18,1,.25,5,'#b9ab82');}
  box(-26,8.2,-20,17,.4,1.6,'#526974');for(let i=0;i<9;i++)box(-34+i*2,8.5,-19.2,.15,.8,.15,'#e2be77');
  for(const x of[-35.5,-36.4]){cylinder(x,2.5,-17,.17,5,'#8a9d9d');box(x,4.9,-14,.35,.35,6,'#8a9d9d');box(x,1,-17,.6,.3,.6,'#d3ab62');}

  // Arsenal: five different weapon silhouettes on the back wall and a calibration bench.
  for(let i=0;i<5;i++){
    const x=20+i*2.8;box(x,3.2,3.5,.3,3,.4,'#1a313e');box(x,3.6,3.8,.5,.6,1.4,'#8b9da0');box(x,4,4,.25,1.6,.35,'#d0b191');box(x,3,4.1,.3,.7,.5,'#445563');
    if(i%2)for(let j=0;j<3;j++)box(x+(j-1)*.24,4,4.2,.14,1.7,.14,'#7b8e93');else box(x+.35,3.7,4.1,.6,.5,.5,'#edaa7d');
  }
  tank(34,11,'#ef9c7e',3.5);crate(18,13,1.6,'#8b7160');crate(20,13,1.6,'#8b7160');crate(19,13,1.5,'#b7a28b',2.25);
  box(32,1.4,14,5,2.8,1.7,'#3e535b');box(32,2.85,14,5.4,.12,2,'#819592');

  // Archive: relay server, illuminated shelves, spinning dish and a recovered signal beacon.
  for(let i=0;i<3;i++){
    box(20+i*2.4,2.4,-19,1.7,4.8,1,'#1c3443');for(let j=0;j<8;j++){box(20+i*2.4,.5+j*.52,-18.43,1.4,.28,.06,'#586a82');box(19.55+i*2.4,.5+j*.52,-18.38,.15,.15,.05,'#c4a9f5','box',true);}
  }
  cylinder(32,3.8,-19,.23,7.6,'#a0adb4');const dish=piece(32,7.5,-19,2.2,.6,2.2,'#b3bec1','ball',false,0,true);moving.push({o:dish,kind:'dish'});
  cylinder(31,1.5,-12,1,3,'#2b424f');const archiveRing=ring(31,3.3,-12,1.4,'#c4a9f5');moving.push({o:archiveRing,kind:'signal'});
  sign('LISTEN / REMEMBER / RETURN',26,4.25,-12.8,'#c4a9f5',8);

  // Central command: physical map table, nine mission beacons and an animated orbital sweep.
  cylinder(0,1,-13,3.4,2,'#293e4c');cylinder(0,2.1,-13,5,.3,'#87a49e');cylinder(0,2.35,-13,4.6,.2,'#15383d');
  const missionNodes=[];
  for(let i=0;i<9;i++){
    const x=(i%3-1)*2.3,z=-13+(Math.floor(i/3)-1)*1.4;
    box(x,2.7,z,1.7,.6,1,'#5a9f98');const node=piece(x,3.2,z,.18,.9,.18,'#a7efd1','tube',true,0,true);missionNodes.push(node);
  }
  const sweep=ring(0,3.3,-13,4.2,'#a7efd1');moving.push({o:sweep,kind:'map'});npc(-6,-14,'#8bb6a2');
  ring(0,.07,-10,6,'#a7efd1');sign('01 / COMMAND',0,7,-17,'#a7efd1',12);
  for(const side of[-1,1]){box(side*7,4.3,-18,.35,8.6,.35,'#a0b0a7');box(side*7,8.6,-18,1,.25,1,'#f6d6a0','box',true);}

  // Docked dropship, recessed engines, service umbilical and landing pylons.
  box(0,6,-27,15,4,6,'#7a8a8b');box(0,8.2,-27,10,.5,5,'#a5b0a6');box(0,6,-23.7,7,2,.5,'#233f4d');box(0,6.4,-23.35,6,.7,.1,'#91dccf','box',true);
  for(const side of[-1,1]){
    box(side*10,5.8,-27,8,1,7,'#647b80','box',false,side*.18);box(side*12,6,-27,3,2,5,'#344e5a');box(side*12,6,-24.4,2,.7,.15,'#9ce5df','box',true);
    for(const x of[side*4,side*11]){box(x,2,-26,.4,4,.5,'#a1aaa3');box(x,.3,-25.8,2,.5,2,'#253d48');}
    box(side*5,7,-27,1.5,3,1,'#b9ab89');box(side*5,7.5,-26.45,1,.2,.1,'#f5c77c','box',true);
  }
  box(0,.3,-21,8,.5,6,'#435a61');for(let i=0;i<5;i++)box(0,.57,-23+i*.8,7,.04,.1,'#c0bb96');sign('WAKE / ANCHORAGE',0,11.5,-30,'#efd2a1',21);

  // Arrival berths and a painted compass give the squad a readable orientation on return.
  for(let i=0;i<3;i++){
    const x=(i-1)*10;ring(x,.07,20,4,'#b1c6b0');box(x,.08,20,.2,.03,5,'#c8d1b5');box(x,.08,20,5,.03,.2,'#c8d1b5');
    sign('BAY 0'+(i+1),x,.13,25,'#d3c9a2',4).rotation.x=-Math.PI/2;
  }
  for(const side of[-1,1])for(const z of[-3,22]){
    cylinder(side*38,1,z,2,2,'#2d454d');for(let i=0;i<6;i++)piece(side*38+Math.cos(i*2.4),2.4+i%2*.4,z+Math.sin(i*2.4),.8,1.4,.7,i%2?'#6f9e89':'#8aab84','ball');
  }
  // Direction strips connect the vendors to the centre without narrowing the walking lanes.
  for(const s of HUB_STATIONS.filter(s=>s.id!=='mission'))for(let i=0;i<8;i++)box(Math.sign(s.x)*(9+i*2),.07,s.z,1,.04,.18,s.color,'box',true);
  for(const b of batches.values()){
    const mesh=new T.InstancedMesh(b.geo,b.mat,b.matrices.length);b.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=b.shadow;mesh.receiveShadow=true;scene.add(mesh);
  }
  let lastTime=0,zoom=1,contextLost=false;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;});
  return{
    zoom(delta){zoom=T.MathUtils.clamp(zoom+delta*.001,.72,1.35);},
    render(state,members,selfId,time,bestLevel=0,reduced=false,viewContext=null){
      if(contextLost)throw new Error('Hub graphics context lost. Reload to restore 3D.');
      const dt=Math.max(.001,Math.min(.05,lastTime?time-lastTime:.016));lastTime=time;
      const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
      if(canvas.width!==Math.round(width*renderer.getPixelRatio())||canvas.height!==Math.round(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
      const self=state.players.find(p=>p.id===selfId),portrait=width/height<1.1;
      const visiting=!!viewContext?.station;
      target.lerp(new T.Vector3((self?.x||0)*(visiting?1:portrait ? .75 : .23),0,(self?.z||0)*(visiting?1:portrait ? .4 : .23)-3),1-Math.exp(-dt*3));
      // Keep the physical vendor and equipped mech in the uncovered part of the
      // existing plaza while its contextual panel is open.
      if(visiting)camera.setViewOffset(width,height,(viewContext.occlusion?.right||0)/2,(viewContext.occlusion?.bottom||0)/2,width,height);
      else if(camera.view?.enabled)camera.clearViewOffset();
      camera.position.set(target.x,(portrait?82:66)*zoom,target.z+(portrait?87:70)*zoom);camera.lookAt(target);
      for(const [id,entry]of models)if(!state.players.some(p=>p.id===id)){scene.remove(entry.g);disposeMech(entry.g);models.delete(id);}
      for(const p of state.players){
        const member=members.find(m=>m.id===p.id);if(!member)continue;const key=buildKey(member.build);let entry=models.get(p.id);
        if(entry?.key!==key){if(entry){scene.remove(entry.g);disposeMech(entry.g);}const g=makeMech(cleanBuild(member.build));g.position.set(p.x,0,p.z);scene.add(g);entry={g,key};models.set(p.id,entry);}
        animateMech(entry.g,{x:p.x*10,y:p.z*10,angle:p.angle,hp:100,altitude:0,hands:[],shot:0,swing:0},dt,time);
      }
      for(const {o,kind}of moving){
        if(kind==='fan')o.rotation.z=reduced?0:time*4;
        if(kind==='dish')o.rotation.y=reduced?.3:Math.sin(time*.2)*.5;
        if(kind==='signal'){o.position.y=3.3+(reduced?0:Math.sin(time*1.4)*.3);o.rotation.z=reduced?0:time*.3;}
        if(kind==='map')o.rotation.z=reduced?0:time*.2;
      }
      missionNodes.forEach((o,i)=>{o.scale.y=i<bestLevel ? .35 : i===bestLevel ? 1.6 : 1;o.visible=i<=bestLevel;});
      renderer.render(scene,camera);
    },
    project(x,z,y=0){point.set(x,y,z).project(camera);return{x:(point.x*.5+.5)*canvas.clientWidth,y:(-.5*point.y+.5)*canvas.clientHeight,visible:point.z<1&&Math.abs(point.x)<1.2&&Math.abs(point.y)<1.2};},
    stats(){return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},
    dispose(){for(const {g}of models.values())disposeMech(g);dummies.forEach(disposeMech);scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();});Object.values(geo).forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());labels.forEach(o=>{o.geometry.dispose();o.material.dispose();});renderer.dispose();}
  };
}
