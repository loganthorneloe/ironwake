// Optional Chrome regression for PR #12 + canonical reporting. No reports are sent.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('../.openai/pilot-feedback/',import.meta.url));await mkdir(output,{recursive:true});
const server=spawn(process.execPath,[fileURLToPath(new URL('./preview-server.mjs',import.meta.url)),'4296'],{cwd:root,windowsHide:true});
await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(String(data).includes('preview:'))resolve();});server.once('error',reject);server.once('exit',code=>reject(Error('Preview exited: '+code)));});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 let submissions=0;
 await ctx.route('**/api/feedback',async route=>{if(route.request().method()!=='GET')submissions++;return route.fulfill({json:{available:false}});});
 await ctx.addInitScript(()=>{
  const decoded=new WeakSet();window.pilotPlayback={decoded:0,started:0};
  const decode=BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData=function(...args){return decode.apply(this,args).then(buffer=>{decoded.add(buffer);window.pilotPlayback.decoded++;return buffer;});};
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){if(decoded.has(this.buffer))window.pilotPlayback.started++;return start.apply(this,args);};
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 await page.goto('http://127.0.0.1:4296/ironwake/');await page.locator('#feedbackDialog').waitFor({state:'attached'});
 const buildVisible=async()=>{await page.locator('#buildLabel').waitFor({state:'visible'});assert.match(await page.locator('#buildLabel').textContent(),/v[0-9].*local\./);};
 const controlsFit=async selector=>assert.equal(await page.evaluate(selector=>{
  const boxes=[...document.querySelectorAll(selector)].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
  return boxes.every(r=>r.x>=0&&r.right<=innerWidth&&r.y>=0)&&boxes.every((a,i)=>boxes.slice(i+1).every(b=>a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y));
 },selector),true,'controls fit the viewport without overlapping: '+selector);
 for(const width of [1440,390,360]){await page.setViewportSize({width,height:1000});await controlsFit('.topbar nav button');}
 await page.setViewportSize({width:1440,height:1000});
 // Cancelling a preview while its audio is still loading must not start speech later.
 let release;const gate=new Promise(resolve=>release=resolve);let blocked=0;
 await ctx.route('**/audio/pilot/flint/*.wav',async route=>{blocked++;await gate;await route.continue();});
 await page.locator('#pilotVoiceSettings').click();await buildVisible();
 await page.locator('[name=pilotVoice][value=flint]').check();await page.locator('#previewPilotVoice').click();
 await page.waitForFunction(()=>document.querySelector('#pilotVoicePreviewStatus').textContent.includes('Loading'));
 assert.ok(blocked>0);await page.locator('#closePilotVoices').click();release();
 await page.waitForFunction(()=>window.pilotPlayback.decoded===32);assert.equal(await page.evaluate(()=>window.pilotPlayback.started),0);
 for(const [id,name] of [['flint','Flint'],['echo','Echo'],['rook','Rook']]){
  await page.locator('#pilotVoiceSettings').click();await page.locator(`[name=pilotVoice][value=${id}]`).check();await page.locator('#previewPilotVoice').click();
  await page.waitForFunction(name=>document.querySelector('#pilotVoicePreviewStatus').textContent===name+' preview.',name);await buildVisible();await page.locator('#closePilotVoices').click();
 }
 assert.equal(await page.evaluate(()=>window.pilotPlayback.decoded),96);assert.equal(await page.evaluate(()=>window.pilotPlayback.started),3);
 await page.locator('#pilotVoiceSettings').click();await page.locator('[name=pilotVoice][value=echo]').check();await page.locator('#closePilotVoices').click();await page.reload();assert.equal(await page.locator('#pilotVoiceSettings').textContent(),'Voice: Echo');
 await page.locator('.topbar [data-feedback]').click();await buildVisible();await page.locator('[name=title]').fill('Local coexistence regression draft');await page.locator('#feedbackClose').click();
 await page.locator('#startGarage').click();await page.locator('#testBuildTop').click();
 await page.waitForFunction(()=>document.querySelector('#sceneFlow').dataset.phase==='idle'&&!document.querySelector('#game').hidden&&!document.querySelector('#game').inert);
 assert.equal(await page.locator('#gameReport').count(),1,'one reporting control survives the merge');
 const audioModules=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name).filter(url=>new URL(url).pathname.endsWith('/audio.js')));
 assert.equal(new Set(audioModules).size,1,'pilot voice, transitions and combat share one audio module');
 await page.evaluate(()=>document.exitPointerLock());
 assert.equal(await page.locator('#voiceSettings').textContent(),'ECHO ▾');await controlsFit('#audioControls button');await buildVisible();await page.screenshot({path:output+'desktop-combat.png'});
 await page.locator('#voiceSettings').click();await page.locator('[name=pilotVoice][value=flint]').check();await page.locator('#closePilotVoices').click();assert.equal(await page.locator('#voiceSettings').textContent(),'FLINT ▾');
 await page.locator('#gameReport').click();assert.equal(await page.locator('[name=title]').inputValue(),'Local coexistence regression draft');await buildVisible();await page.waitForFunction(()=>document.querySelector('#feedbackScreenshot').naturalWidth>0);await page.screenshot({path:output+'desktop-feedback.png'});await page.locator('#feedbackClose').click();
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});await controlsFit('#audioControls button');
  await page.locator('#voiceSettings').click();await buildVisible();await page.locator('#closePilotVoices').click();
  await page.screenshot({path:output+width+'-combat.png'});
  await page.locator('#gameReport').click();await buildVisible();await page.locator('#feedbackClose').click();
  await page.keyboard.press('F8');await buildVisible();await page.locator('#feedbackClose').click();
 }
 await page.locator('#exitGame').click();await page.locator('#game').waitFor({state:'hidden'});assert.equal(await page.locator('#pilotVoiceSettings').textContent(),'Voice: Flint');
 assert.equal(submissions,0);assert.deepEqual(errors,[]);
 console.log('PASS: 3 voice packs / 96 decoded clips, preview cancellation, selection persistence, menu/combat reporting, draft retention, capture, build labels, and non-overlapping desktop/390px/360px controls. No external submissions.');
}finally{await browser.close();server.kill();}
