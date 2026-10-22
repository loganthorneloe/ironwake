// Presentation math and the host's deployment barrier have no renderer/DOM dependencies.
const clamp=value=>Math.max(0,Math.min(1,value));
const mix=(a,b,t)=>t===1?b:t===0?a:a+(b-a)*t;
export const INSERTION_SECONDS=.82;
export const MIN_LOADING_SECONDS=1.5;
export const GRAY_REVEAL_SECONDS=1.4;
export const TITLE_HOLD_SECONDS=1.8;
export function deploymentIntro(seconds,reduced=false){
 const cameraSeconds=reduced?.1:INSERTION_SECONDS;
 if(seconds<GRAY_REVEAL_SECONDS)return{phase:'reveal',progress:0,complete:false};
 if(seconds<GRAY_REVEAL_SECONDS+cameraSeconds)return{phase:'insertion',progress:clamp((seconds-GRAY_REVEAL_SECONDS)/cameraSeconds),complete:false};
 if(seconds<GRAY_REVEAL_SECONDS+cameraSeconds+TITLE_HOLD_SECONDS)return{phase:'holding',progress:1,complete:false};
 return{phase:'complete',progress:1,complete:true};
}
export function insertionView(eye,progress,scale=1,reduced=false){
 const p=reduced?1:clamp(progress),ease=1-Math.pow(1-p,3),remaining=1-ease;
 const {position,pivot,direction}=eye;
 const side={x:-direction.z,z:direction.x};
 const start={x:position.x-direction.x*17*scale-side.x*15*scale,y:position.y+16*scale,z:position.z-direction.z*17*scale-side.z*15*scale};
 const camera={x:mix(start.x,position.x,ease),y:mix(start.y,position.y,ease),z:mix(start.z,position.z,ease)};
 const chase={x:camera.x+direction.x*100,y:camera.y+direction.y*100,z:camera.z+direction.z*100};
 return{position:camera,target:{x:mix(chase.x,pivot.x,remaining),y:mix(chase.y,pivot.y,remaining),z:mix(chase.z,pivot.z,remaining)},chaseWeight:ease,fov:eye.fov+12*remaining};
}
export function createDeploymentGate(ticket,members){
 const expected=new Set(members),ready=new Set();
 return{
  acknowledge(id,receivedTicket){if(receivedTicket!==ticket||!expected.has(id))return false;ready.add(id);return true;},
  get complete(){return expected.size>0&&ready.size===expected.size;},
  get readyCount(){return ready.size;},get total(){return expected.size;}
 };
}
