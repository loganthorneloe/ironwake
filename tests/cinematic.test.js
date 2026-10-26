import test from 'node:test';
import assert from 'node:assert/strict';
import{createDeploymentGate,insertionView,deploymentIntro,GRAY_REVEAL_SECONDS,INSERTION_SECONDS,TITLE_HOLD_SECONDS}from '../dist/cinematic.js';
import{thirdPersonView}from '../dist/third-person-view.js';
import{CHASSIS,chassisBlueprint,chassisFor}from '../dist/chassis.js';

test('camera handoff lands exactly on the chase pose for every chassis, heading and aspect',()=>{
 for(const chassis of Object.keys(CHASSIS))for(const yaw of [0,.7,Math.PI,4.2])for(const aspect of [16/9,390/844])for(const pitch of [-1.1,0,.9])for(const altitude of [0,160]){
  const build=chassisBlueprint(chassis),eye=thirdPersonView({x:200,y:300,altitude,build},{yaw,pitch},aspect),scale=chassisFor(build).scale;
  const end=insertionView(eye,1,scale);
  assert.deepEqual(end.position,eye.position);assert.equal(end.fov,eye.fov);
  for(const axis of ['x','y','z'])assert.ok(Math.abs((end.target[axis]-end.position[axis])/100-eye.direction[axis])<1e-9);
  for(const progress of [0,.25,.5,.9,1,2])for(const value of Object.values(insertionView(eye,progress,scale).position))assert.ok(Number.isFinite(value));
  assert.deepEqual(insertionView(eye,0,scale,true),end,'Reduced never displaces the gameplay camera');
 }
});

test('squad launch waits for every unique pilot and rejects stale deployment acknowledgements',()=>{
 const gate=createDeploymentGate('second-drop',['host','guest','slow']);
 assert.equal(gate.acknowledge('guest','first-drop'),false);
 assert.equal(gate.acknowledge('stranger','second-drop'),false);
 gate.acknowledge('guest','second-drop');gate.acknowledge('guest','second-drop');
 assert.equal(gate.readyCount,1);assert.equal(gate.complete,false);
 gate.acknowledge('host','second-drop');assert.equal(gate.complete,false);
 gate.acknowledge('slow','second-drop');assert.equal(gate.complete,true);assert.equal(gate.total,3);
});

test('solo uses the same readiness barrier and an empty squad cannot launch',()=>{
 const solo=createDeploymentGate('solo',['local']);assert.equal(solo.complete,false);
 solo.acknowledge('local','solo');assert.equal(solo.complete,true);
 assert.equal(createDeploymentGate('empty',[]).complete,false);
});

test('deployment completes only after gray reveal, camera and the full title hold',()=>{
 for(const reduced of [false,true]){
  const camera=reduced?.1:INSERTION_SECONDS,total=GRAY_REVEAL_SECONDS+camera+TITLE_HOLD_SECONDS;
  assert.equal(deploymentIntro(0,reduced).phase,'reveal');
  assert.equal(deploymentIntro(GRAY_REVEAL_SECONDS+.01,reduced).phase,'insertion');
  assert.equal(deploymentIntro(GRAY_REVEAL_SECONDS+camera+.01,reduced).phase,'holding');
  assert.equal(deploymentIntro(total-.01,reduced).complete,false);
  assert.equal(deploymentIntro(total+.01,reduced).complete,true);
 }
});
