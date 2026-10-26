// Real-layout regressions for the explicit local field QA preview.
// Run after seeding the long inventory and opening the production inventory UI.
export function runInventoryLayoutChecks(doc=document){
 const inventory=doc.getElementById('fieldInventory');
 if(!inventory||inventory.hidden||inventory.closest('[hidden]'))return {status:'not-run',reason:'Open the seeded long field inventory, then inspect again.'};
 const win=doc.defaultView,rect=inventory.getBoundingClientRect(),css=win.getComputedStyle(inventory);
 const checks=[
  {name:'Inventory has more than 60px of visible content height',pass:inventory.clientHeight>60&&rect.width>0&&css.visibility!=='hidden'&&css.display!=='none',actual:inventory.clientHeight},
  {name:'Long inventory overflows a scrolling content area',pass:inventory.scrollHeight>inventory.clientHeight&&['auto','scroll'].includes(css.overflowY),actual:{scrollHeight:inventory.scrollHeight,clientHeight:inventory.clientHeight,overflowY:css.overflowY}},
  {name:'Inventory stays within the game viewport',pass:rect.left>=0&&rect.top>=0&&rect.right<=win.innerWidth+1&&rect.bottom<=win.innerHeight+1,actual:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,viewportWidth:win.innerWidth,viewportHeight:win.innerHeight}}
 ];
 // Exercise real DOM scrolling without generating any game input events.
 const before=inventory.scrollTop,target=Math.min(64,inventory.scrollHeight-inventory.clientHeight);
 let actual=0;
 try{inventory.scrollTop=target;actual=inventory.scrollTop;}finally{inventory.scrollTop=before;}
 checks.push({name:'Inventory content can scroll and its original position is restored',pass:target>0&&actual>0&&Math.abs(actual-target)<=1&&Math.abs(inventory.scrollTop-before)<=1,actual:{target,reached:actual,restored:inventory.scrollTop,original:before}});
 return {status:checks.every(check=>check.pass)?'pass':'fail',checks};
}
