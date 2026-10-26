import{impactMode}from './impact-preferences.js';
// One persistent overlay, one owner. Starting/cancelling a sequence invalidates old work.
export function createSceneFlow(root){
 let serial=0,animation=null;
 const $=s=>root.querySelector(s),shutter=$('.scene-shutter'),screen=$('.deployment-card');
 const reduced=()=>impactMode()==='reduced';
 function cut(){
  animation?.cancel();shutter.hidden=false;
  animation=shutter.animate(reduced()?[{opacity:.7},{opacity:0}]:[{clipPath:'polygon(0 0,100% 0,100% 100%,0 100%)',transform:'translateX(0)'},{clipPath:'polygon(110% 0,110% 0,100% 100%,100% 100%)',transform:'translateX(8%)'}],{duration:reduced()?90:220,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
  const current=animation;current.finished.then(()=>{if(animation===current)shutter.hidden=true;}).catch(()=>{});
 }
 function cancel(){serial++;root.dataset.phase='idle';screen.hidden=true;root.removeAttribute('aria-busy');}
 return{
  cut,cancel,
  begin(mission,count){cancel();const token=serial;root.dataset.motion=reduced()?'reduced':'full';root.dataset.phase='loading';screen.hidden=false;root.setAttribute('aria-busy','true');$('.deployment-mission').textContent=mission.name;$('.deployment-mode').textContent=mission.mode==='operation'?'COMBAT INSERTION':mission.mode==='trial'?'LIVE FIRE / DUEL':'SYSTEM CHECK / RANGE';$('.deployment-squad').textContent=`${String(count).padStart(2,'0')} PILOT${count===1?'':'S'} / LINK ESTABLISHED`;$('.deployment-status').textContent='Opening launch corridor';$('.deployment-progress').value=0;return token;},
  current:token=>token===serial,
  stage(index){$('.deployment-status').textContent='Preparing battlefield';$('.deployment-progress').value=index;root.querySelectorAll('[data-load-step]').forEach((el,i)=>el.dataset.state=i<index?'done':i===index?'active':'pending');},
  intro(phase){root.dataset.phase=phase;},
  wait(){root.dataset.phase='waiting';$('.deployment-status').textContent='Waiting for squad launch clearance';},
  launch(){cancel();}
 };
}
