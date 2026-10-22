// Independent of game initialization so the identity survives loading/errors.
const label=document.getElementById('buildLabel');
// Native dialogs sit above every z-index and blur the rest of the page.
// Keep the same fixed label in the active dialog's top layer while it is open.
const modal=document.getElementById('modal');
const keepVisible=()=>{(modal.open?modal:document.body).append(label);};
new MutationObserver(keepVisible).observe(modal,{attributes:true,attributeFilter:['open']});
keepVisible();
try{
 const response=await fetch(new URL('./build-info.json',import.meta.url),{cache:'no-store'});
 if(!response.ok)throw new Error('Build metadata unavailable');
 const info=await response.json();
 label.textContent=info.label;
 label.title=`IRONWAKE ${info.version}\nBuild: ${info.build}\nSource: ${info.revision}${info.dirty?' (uncommitted changes)':''}\nBuilt: ${info.builtAt}`;
}catch{
 label.textContent='Development build';
 label.title='Run npm run dev, npm run preview, or npm run build to generate version/build information.';
}
