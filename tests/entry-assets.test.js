import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const entry=new URL('../dist/index.html',import.meta.url);
const html=await readFile(entry,'utf8');
const tags=[...html.matchAll(/<(script|link|[a-z][\w-]*)\b([^>]*)>/gi)].map(([,name,source])=>({
 name:name.toLowerCase(),
 attributes:Object.fromEntries([...source.matchAll(/(?:^|\s)([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(([,key,,value])=>[key.toLowerCase(),value]))
}));
const assets=tags.flatMap(({name,attributes:a})=>name==='script'&&a.src?[{kind:'script',reference:a.src}]:name==='link'&&a.rel?.split(/\s+/).includes('stylesheet')&&a.href?[{kind:'stylesheet',reference:a.href}]:[]);
const local=assets.map(asset=>({...asset,url:new URL(asset.reference,entry)})).filter(asset=>asset.url.protocol==='file:');

test('entry scripts and stylesheets resolve to shipped, nonempty files despite cache query strings',async()=>{
 assert.ok(local.some(asset=>asset.kind==='script'),'entry ships a script');
 assert.ok(local.some(asset=>asset.kind==='stylesheet'),'entry ships a stylesheet');
 for(const {reference,url} of local){
  const path=new URL(url);path.search='';path.hash='';
  const file=await stat(path).catch(()=>null);
  assert.ok(file?.isFile()&&file.size>0,`missing or empty entry asset: ${reference}`);
 }
});

test('the deployment overlay is styled by an included entry stylesheet',async()=>{
 assert.ok(tags.some(tag=>tag.attributes.id==='sceneFlow'),'deployment overlay ships in the entry');
 const styles=(await Promise.all(local.filter(asset=>asset.kind==='stylesheet').map(asset=>readFile(asset.url,'utf8')))).join('\n');
 for(const selector of [/#sceneFlow\b/,/\.deployment-card\b/,/\.scene-shutter\b/])assert.match(styles,selector,'deployment presentation must have loaded styling');
});

test('entry IDs are unique and include both pilot voice, reporting and hub integration controls',()=>{
 const ids=tags.flatMap(tag=>tag.attributes.id?[tag.attributes.id]:[]),counts=new Map();
 for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
 assert.deepEqual([...counts].filter(([,count])=>count!==1),[],'duplicate IDs make controls bind to the wrong element');
 for(const id of ['pilotVoiceSettings','voiceSettings','voiceToggle','soundToggle','gameReport','gameFieldInventory','combatMenu','interfaceMenu','hubScreen','campaignScreen','sceneFlow'])assert.equal(counts.get(id),1,`missing entry control: ${id}`);
 const combatMenu=html.match(/<details\b[^>]*\bid="combatMenu"[^>]*>[\s\S]*?<\/details>/)?.[0];
 assert.ok(combatMenu,'combat utilities have a native disclosure');
 for(const id of ['voiceSettings','voiceToggle','soundToggle','gameReport','gameFieldInventory'])assert.ok(combatMenu.includes(`id="${id}"`),`${id} remains reachable inside the combat menu`);
 const report=tags.find(tag=>tag.attributes.id==='gameReport');
 assert.equal(report.name,'button');
 assert.match(html,/<button\b[^>]*\bid=["']gameReport["'][^>]*\bdata-feedback\b/,'the combat report button must remain connected to feedback');
});
