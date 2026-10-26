import {fillUiIcons} from './ui-icons.js';
// Shared navigation and the title menu's physical selection band.
fillUiIcons();
const $=selector=>document.querySelector(selector);
const menus=[...document.querySelectorAll('.interface-menu')];
let dialogReturnFocus;
$('#modal').addEventListener('close',()=>{
 if(dialogReturnFocus?.isConnected&&dialogReturnFocus.getClientRects().length)dialogReturnFocus.focus({preventScroll:true});
 dialogReturnFocus=null;
});
const closeMenu=(menu,restoreFocus=false)=>{menu.open=false;if(restoreFocus)menu.querySelector('summary').focus();};
document.addEventListener('click',event=>{
 if(event.target.closest('#railHome'))$('#homeNav').click();
 for(const menu of menus){
  if(!menu.open)continue;
  if(!menu.contains(event.target)){closeMenu(menu);continue;}
  const action=event.target.closest('[data-menu-action],[data-view],[data-feedback],#gameHelp,#exitGame,#pilotVoiceSettings,#voiceSettings');
  if(action)closeMenu(menu);
 }
 const destination=event.target.closest('[data-menu-action]')?.dataset.menuAction;
 if(destination==='campaign')$('#campaignNav').click();
 if(destination==='workshop')$('#garageNav').click();
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;
 const open=menus.find(menu=>menu.open);
 if(open){event.preventDefault();event.stopPropagation();closeMenu(open,true);}
},true);
for(const menu of menus)menu.addEventListener('toggle',()=>{
 if(menu.open)for(const other of menus)if(other!==menu)closeMenu(other);
});

function syncShell(){
 const screen=document.body.dataset.screen;
 const active={home:'railHome',campaign:'campaignNav',hub:'campaignNav',garage:'garageNav'}[screen];
 for(const button of document.querySelectorAll('.section-rail .rail-button')){
  if(button.id===active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 if(screen==='home')selectHome(homeButtons()[0]);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('#mainContent').animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
}
const homeButtons=()=>[...document.querySelectorAll('.home-choice')].filter(button=>!button.hidden);
function selectHome(button){
 if(!button)return;
 for(const row of homeButtons())row.classList.toggle('home-selected',row===button);
 $('#homeSelectionDetail').textContent=button.id==='continueCampaign'?$('#homeResumeDetail').textContent:button.dataset.homeDetail;
}
const homeChoices=$('.home-choices');
homeChoices.addEventListener('pointerover',event=>{const row=event.target.closest('.home-choice');if(row)selectHome(row);});
homeChoices.addEventListener('focusin',event=>{const row=event.target.closest('.home-choice');if(row)selectHome(row);});
new MutationObserver(()=>{if(document.body.dataset.screen==='home')selectHome(homeButtons()[0]);}).observe($('#continueCampaign'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('keydown',event=>{
 if(document.body.dataset.screen!=='home'||$('#hangar').hidden||document.querySelector('dialog[open],.interface-menu[open]')||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
 const rows=homeButtons(),index=Math.max(0,rows.indexOf(document.activeElement));
 const next=event.key==='Home'?0:event.key==='End'?rows.length-1:(index+(event.key==='ArrowUp'?-1:1)+rows.length)%rows.length;
 event.preventDefault();rows[next].focus();selectHome(rows[next]);
});
new MutationObserver(syncShell).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
syncShell();
$('.section-rail').addEventListener('keydown',event=>{
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const buttons=[...document.querySelectorAll('.section-rail .rail-button')],index=buttons.indexOf(document.activeElement);
 if(index<0)return;event.preventDefault();
 const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)+buttons.length)%buttons.length;
 buttons[next].focus();
});

function referenceSection(label,nodes){
 const section=document.createElement('details');section.className='manual-section';
 const summary=document.createElement('summary');summary.textContent=label;section.append(summary,...nodes);return section;
}
export function prepareDialog(body){
 if(!$('#modal').open){const source=document.activeElement;dialogReturnFocus=source?.closest('.interface-menu')?.querySelector('summary')||source;}
 const title=body.querySelector('h2');
 if(title){title.id='dialogTitle';$('#modal').setAttribute('aria-labelledby','dialogTitle');$('#modal').removeAttribute('aria-label');}
 else{$('#modal').removeAttribute('aria-labelledby');$('#modal').setAttribute('aria-label','Game dialog');}
 const controls=body.querySelector('.manual-controls');
 $('#modal').classList.toggle('handbook-dialog',!!controls);$('#modal').classList.toggle('armory-dialog',!!body.querySelector('.armory-grid'));
 if(!controls)return;
 const aiming=controls.nextElementSibling,touch=body.lastElementChild;
 title.textContent='Pilot field manual';
 title.after(controls);
 for(const [key,label] of [['H','Controls & help'],['M','Toggle sound'],['TAB','Full map · hold'],['ESC','Release mouse']]){
  const row=document.createElement('span'),kbd=document.createElement('kbd');kbd.textContent=key;row.append(kbd,document.createTextNode(label));controls.append(row);
 }
 const movement=referenceSection('Aiming, movement & touch',[aiming,touch]);
 controls.after(movement);
 const effects=body.querySelector('.impact-setting');
 const effectSection=referenceSection('Motion & impact effects',[]);
 effects.before(effectSection);effectSection.append(effects);
 for(const heading of [...body.querySelectorAll(':scope > h3')]){
  const nodes=[];let next=heading.nextSibling;
  while(next&&!(next.nodeType===1&&next.tagName==='H3')){nodes.push(next);next=next.nextSibling;}
  const section=referenceSection(heading.textContent,nodes);heading.replaceWith(section);
 }
 // Keep motion preferences easy to find, after the essential controls.
 body.append(body.querySelector('.manual-section:has(.impact-setting)'));
 const layout=document.createElement('div');layout.className='handbook-layout';
 const navigation=document.createElement('nav');navigation.className='handbook-navigation';navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','Handbook topics');navigation.setAttribute('aria-orientation','vertical');
 const content=document.createElement('div');content.className='handbook-content';
 const topics=[{label:'Quick controls',nodes:[controls]},...[...body.querySelectorAll('.manual-section')].map(section=>({label:section.querySelector('summary').textContent,nodes:[...section.children].filter(node=>node.tagName!=='SUMMARY'),section}))];
 const activateTopic=(index,focus=false)=>{
  for(const [i,button] of [...navigation.children].entries()){button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;content.children[i].hidden=i!==index;}
  if(focus)navigation.children[index].focus();
 };
 for(const [index,topic] of topics.entries()){
  const button=document.createElement('button');button.type='button';button.dataset.helpSection=String(index);button.id='help-topic-'+index;button.setAttribute('role','tab');button.setAttribute('aria-controls','help-panel-'+index);button.textContent=topic.label;
  button.onclick=()=>activateTopic(index);navigation.append(button);
  const panel=document.createElement('section');panel.id='help-panel-'+index;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
  if(index){const heading=document.createElement('h3');heading.textContent=topic.label;panel.append(heading);}
  panel.append(...topic.nodes);content.append(panel);topic.section?.remove();
 }
 navigation.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const current=[...navigation.children].indexOf(document.activeElement),count=topics.length;
  const next=event.key==='Home'?0:event.key==='End'?count-1:(current+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)+count)%count;activateTopic(next,true);
 });
 layout.append(navigation,content);body.append(layout);activateTopic(0);
}
