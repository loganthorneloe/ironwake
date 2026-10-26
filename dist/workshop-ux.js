import {PARTS,mechStats,buildKey} from './core.js?v=41';
import {fitComponent} from './workshop-grid.js?v=41';
import {itemIcon} from './workshop-icons.js?v=41';

const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let context=null,previousKey='',previousSlot='',selectedCandidate=null,candidateBuild=null;
const shortName=item=>item.name.split(' / ').at(-1);
const number=value=>Math.round(value*10)/10;

// Inspection is deliberately separate from installation. The active build is only
// written by the existing fitting command after the pilot chooses Install.
export function getWorkshopPreview(build){
 return document.body.dataset.screen==='garage'&&candidateBuild?candidateBuild:build;
}

export function updateWorkshopWorkbench(next){
 context=next;
 const {build,activeSlot,options,current}=next,key=buildKey(build),isPart=!!PARTS[activeSlot];
 if(key!==previousKey||activeSlot!==previousSlot){selectedCandidate=current;candidateBuild=null;}
 previousKey=key;previousSlot=activeSlot;
 if(!options.some(([id])=>id===selectedCandidate))selectedCandidate=options[0]?.[0]||current;
 const group=isPart?'frame':'armament';
 $('#partTabs').hidden=!isPart;$('#equipmentTabs').hidden=isPart;$('.finish-tools').hidden=!isPart;
 document.querySelectorAll('[data-socket-group]').forEach(button=>{
  button.setAttribute('aria-pressed',String(button.dataset.socketGroup===group));
  button.onclick=()=>{if(button.dataset.socketGroup!==group)next.onSlot(button.dataset.socketGroup==='frame'?'torso':'equip0');};
 });
 $('#componentCount').textContent=options.length+' available';
 $('#parts').innerHTML=options.map(([id,item])=>{
  const fitted=id===current;
  return `<button class="part-choice ${fitted?'selected':''}" data-choice="${id}" aria-pressed="${fitted}" aria-label="Preview ${escape(shortName(item))}, ${item.weight} tonnes${fitted?', fitted':''}"><span class="catalog-card-top"><span class="option-icon">${itemIcon(activeSlot,id,item)}</span><span class="catalog-mass">${item.weight}<small>t</small></span></span><strong class="catalog-name">${escape(shortName(item))}</strong><span class="catalog-state" aria-hidden="true">${fitted?'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7 12 3 3 7-7"/></svg>':'<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>'}</span></button>`;
 }).join('');
 document.querySelectorAll('#parts [data-choice]').forEach(button=>{
  button.onpointermove=event=>{if(event.pointerType==='mouse')previewCandidate(button.dataset.choice);};
  button.onfocus=()=>{selectedCandidate=button.dataset.choice;showCandidate(selectedCandidate);};
  button.onclick=()=>{selectedCandidate=button.dataset.choice;showCandidate(selectedCandidate);};
 });
 $('#parts').onpointerleave=()=>previewCandidate(selectedCandidate);
 showCandidate(selectedCandidate);
}

function previewCandidate(id){
 if(!context)return;
 const {build,activeSlot,current,options,selectedSocket}=context;
 const item=options.find(([key])=>key===id)?.[1];if(!item)return;
 candidateBuild=id===current?null:fitComponent(build,activeSlot,{kind:selectedSocket.kind,id});
 document.querySelector('.mech-stage').dataset.preview=id===current?'':'Preview: '+shortName(item);
 document.querySelectorAll('#parts [data-choice]').forEach(button=>button.classList.toggle('candidate',button.dataset.choice===id&&id!==current));
}

function showCandidate(id){
 if(!context)return;
 const {build,activeSlot,current,options,selectedSocket,onFit}=context;
 const item=options.find(([key])=>key===id)?.[1];if(!item)return;
 const fitted=options.find(([key])=>key===current)?.[1]||context.socketItems[current];
 const proposed=fitComponent(build,activeSlot,{kind:selectedSocket.kind,id});
 if(!proposed)return;
 candidateBuild=id===current?null:proposed;
 const before=mechStats(build),after=mechStats(proposed),installed=id===current;
 document.querySelector('.mech-stage').dataset.preview=installed?'':'Preview: '+shortName(item);
 document.querySelectorAll('#parts [data-choice]').forEach(button=>button.classList.toggle('candidate',button.dataset.choice===id&&!installed));
 const rows=[['Armor',before.hp,after.hp,'',true],['Boost speed',Math.round(before.speed*before.boost),Math.round(after.speed*after.boost),'',true],['Free payload',number(before.capacity-before.weight),number(after.capacity-after.weight),'t',true]];
 if(!PARTS[activeSlot]&&activeSlot!=='equip2'&&item.range&&fitted?.range)rows[0]=['Reach',fitted.range,item.range,'m',true];
 if(activeSlot==='equip2')rows[0]=['Cooldown',fitted?.cd||0,item.cd,'s',false];
 const comparison=rows.map(([label,oldValue,newValue,unit,higherBetter])=>{
  const change=newValue-oldValue,kind=change===0?'':(change>0===higherBetter?'better':'worse');
  return `<span>${label}</span><span>${oldValue}${unit}</span><span class="${kind}">${newValue}${unit}${change===0?'':change>0?' ↑':' ↓'}</span>`;
 }).join('');
 const warning=after.valid?'':after.issues?.join(' ')||'This fit exceeds chassis capacity. Refit before deployment.';
 $('#componentComparison').innerHTML=`<h3 class="candidate-name">${escape(shortName(item))}</h3><p class="candidate-description">${escape(item.appearance||item.desc||item.role||'Modular mech component.')}</p><div class="comparison-table"><span></span><span class="comparison-head">Fitted</span><span class="comparison-head">Preview</span>${comparison}</div>${warning?`<p class="fit-warning">${escape(warning)}</p>`:''}<button id="fitComponent" ${installed?'disabled':''}>${installed?'Component installed':'Install component'}<span>${installed?'✓':'＋'}</span></button>`;
 $('#fitComponent').onclick=()=>{selectedCandidate=id;candidateBuild=null;onFit(id);};
}
