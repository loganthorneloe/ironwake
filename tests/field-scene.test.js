import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.min.js';
import {FIELD_ITEMS,FIELD_RELAYS} from '../dist/field-catalog.js';
import {createFieldScene,FIELD_SCENE_LIMITS} from '../dist/field-scene.js';
import {impactMode,toggleImpactMode} from '../dist/impact-preferences.js';
import {createEquipmentFX} from '../dist/equipment-effects.js';
import {cleanBuild,ABILITIES} from '../dist/core.js';

const pilot=()=>({id:'p',x:120,y:30,altitude:50,hp:100,field:{level:1,buffs:[]}});
const cache=(id='cache',itemId=Object.keys(FIELD_ITEMS)[0])=>({id,kind:'cache',itemId,x:100,y:200,z:30,state:'ready',claimed:[]});
const relay=(id='relay')=>({id,kind:'relay',relayId:Object.keys(FIELD_RELAYS)[0],x:300,y:400,z:50,state:'ready',claimed:[]});
function signature(model){const h=createHash('sha256');model.traverse(o=>{if(o.isMesh){h.update(Buffer.from(o.geometry.attributes.position.array.buffer));h.update(JSON.stringify(o.position.toArray()));}});return h.digest('hex');}

test('all salvage components and resonance relays have distinct industrial mesh assemblies',()=>{
 const parent=new T.Group(),fx=createFieldScene(parent);
 for(const[kind,catalogue]of[['cache',FIELD_ITEMS],['relay',FIELD_RELAYS]]){
  const signatures=new Set();for(const id of Object.keys(catalogue)){const model=fx.preview(kind,id),value=signature(model);assert.ok(!signatures.has(value),kind+':'+id);signatures.add(value);}
  assert.equal(signatures.size,Object.keys(catalogue).length);
 }
 fx.dispose();assert.equal(parent.children.length,0);
});

test('cache contents share geometry, follow height, and leave a persistent spent housing',()=>{
 const fx=createFieldScene(new T.Group()),p=pilot(),a=cache(),b=cache('second'),w={time:0,players:[p],field:{nodes:[a,b]}};
 fx.update(w,1,p.id);const first=fx.nodes.get(a.id),second=fx.nodes.get(b.id);assert.equal(first.content.children[0].geometry,second.content.children[0].geometry);assert.deepEqual(first.g.position.toArray(),[10,3,20]);assert.equal(first.content.visible,true);assert.equal(first.beacon.visible,true);
 a.state='spent';fx.update(w,2,p.id);assert.equal(first.content.visible,false);assert.equal(first.beacon.visible,false);assert.equal(first.base.visible,true);assert.equal(first.g.parent,fx.root);
 w.field.nodes=[];fx.update(w,3,p.id);assert.equal(fx.nodes.size,0);fx.dispose();
});

test('relay claimed state is local to each pilot and active calibration rings stop at expiry or death',()=>{
 const fx=createFieldScene(new T.Group()),p=pilot(),node=relay(),w={time:1,players:[p],field:{nodes:[node]}};
 node.claimed=[p.id];p.field.buffs=[{relayId:node.relayId,expiresAt:20}];fx.update(w,1,p.id);assert.equal(fx.nodes.get(node.id).beacon.visible,false);assert.equal(fx.pilots.get(p.id).halo.visible,true);assert.equal(fx.pilots.get(p.id).g.position.y,5.12);
 fx.update(w,2,'ally');assert.equal(fx.nodes.get(node.id).beacon.visible,true);w.time=21;fx.update(w,3,p.id);assert.equal(fx.pilots.get(p.id).halo.visible,false);p.field.buffs[0].expiresAt=40;p.hp=0;fx.update(w,4,p.id);assert.equal(fx.pilots.get(p.id).halo.visible,false);fx.dispose();
});

test('level-up pulse begins on a level transition, Reduced freezes rotation, and scene bounds survive large snapshots',()=>{
 const fx=createFieldScene(new T.Group()),p=pilot(),w={time:1,players:[p],field:{nodes:[cache()]}};fx.update(w,1,p.id);assert.equal(fx.pilots.get(p.id).pulse.visible,false);p.field.level=2;fx.update(w,2,p.id);assert.equal(fx.pilots.get(p.id).pulse.visible,true);fx.update(w,4,p.id);assert.equal(fx.pilots.get(p.id).pulse.visible,false);
 const was=impactMode();if(was!=='reduced')toggleImpactMode();fx.update(w,5,p.id);const rotation=fx.nodes.get('cache').content.rotation.y;fx.update(w,8,p.id);assert.equal(fx.nodes.get('cache').content.rotation.y,rotation);if(was!=='reduced')toggleImpactMode();
 w.field.nodes=Array.from({length:200},(_,i)=>cache('c'+i));w.players=Array.from({length:12},(_,i)=>({...pilot(),id:'p'+i}));fx.update(w,9,'p0');assert.equal(fx.nodes.size,FIELD_SCENE_LIMITS.nodes);assert.equal(fx.pilots.size,FIELD_SCENE_LIMITS.pilots);
 fx.root.updateMatrixWorld(true);fx.root.traverse(o=>{for(const number of o.matrixWorld.elements)assert.ok(Number.isFinite(number));});fx.dispose();
});

test('disposing a battlefield releases merged geometry and atlas-independent materials',()=>{
 const parent=new T.Group(),fx=createFieldScene(parent),p=pilot();fx.update({time:0,players:[p],field:{nodes:[cache(),relay()]}},1,p.id);let disposed=0;fx.nodes.get('cache').content.children[0].geometry.addEventListener('dispose',()=>disposed++);fx.dispose();assert.equal(disposed,1);assert.equal(parent.children.length,0);assert.equal(fx.nodes.size,0);assert.equal(fx.pilots.size,0);
});

test('special field visuals and ally/enemy links reach the same upgraded radius as combat',()=>{
 const fx=createEquipmentFX(new T.Group()),p={...pilot(),x:0,y:0,altitude:0,build:cleanBuild({}),activeAbility:'shield',active:ABILITIES.shield.duration-.5,field:{upgrades:['warhead'],buffs:[{relayId:'overload',expiresAt:60}]}},matrix=new T.Matrix4();
 fx.update({time:.5,players:[p]},.5);assert.equal(fx.shells[0].scale.x,ABILITIES.shield.radius*.1*1.5);
 p.activeAbility='emp';p.active=ABILITIES.emp.duration-.5;const enemy={x:400,y:0,altitude:0,hp:100,stun:3};fx.update({time:.5,players:[p],enemies:[enemy]},.5);let linked=false;for(let i=0;i<fx.pools[0].count;i++){fx.pools[0].getMatrixAt(i,matrix);if(Math.abs(matrix.elements[12]-40)<.001)linked=true;}assert.equal(linked,true,'EMP links a stunned enemy beyond the original radius');
 p.activeAbility='repair';p.active=ABILITIES.repair.duration-.5;fx.update({time:.5,players:[p]},.5);const alone=fx.pools[1].count;const ally={...pilot(),id:'ally',x:300,y:0,altitude:0,build:p.build};fx.update({time:.5,players:[p,ally]},.5);assert.equal(fx.pools[1].count,alone+4,'repair reaches an ally inside the upgraded radius');
 const preview=createEquipmentFX(new T.Group(),{fieldScale:.3});p.activeAbility='shield';p.active=ABILITIES.shield.duration-.5;preview.update({time:.5,players:[p]},.5);assert.ok(Math.abs(preview.shells[0].scale.x-ABILITIES.shield.radius*.1*1.5*.3)<1e-8);preview.dispose();fx.dispose();
});
