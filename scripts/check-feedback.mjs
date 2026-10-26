// Optional Chrome integration test; submissions are mocked and never create issues.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=fileURLToPath(new URL('../.openai/feedback/',import.meta.url));await mkdir(output,{recursive:true});
const server=spawn(process.execPath,[fileURLToPath(new URL('./preview-server.mjs',import.meta.url)),'4294'],{windowsHide:true});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Preview exited: '+code)));});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.grantPermissions(['microphone'],{origin:'http://127.0.0.1:4294'});
 let attempts=0,reportId;
 await ctx.route('**/api/feedback',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{available:true}});
  const req=route.request(),data=await new Request(req.url(),{method:'POST',headers:{'Content-Type':req.headers()['content-type']},body:req.postDataBuffer()}).formData();
  const report=JSON.parse(data.get('report'));assert.equal(report.kind,'suggestion');assert.ok(data.get('screenshot').size>10000);assert.ok(data.get('audio').size>100);assert.equal(report.context.screen,'battle');
  if(reportId)assert.equal(req.headers()['x-report-id'],reportId);reportId=req.headers()['x-report-id'];attempts++;
  return attempts===1?route.fulfill({status:502,json:{error:'Test failure: draft retained'}}):route.fulfill({json:{url:'https://github.com/loganthorneloe/ironwake/issues/123'}});
 });
 const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 console.log('Opening game');await page.goto('http://127.0.0.1:4294/ironwake/');await page.waitForFunction(()=>!!document.querySelector('#feedbackDialog'),null,{timeout:20000});
 console.log('Checking deployment cancellation and feedback coexistence');await page.locator('#startGarage').click();await page.locator('#testBuildTop').click();
 await page.waitForFunction(()=>document.querySelector('#sceneFlow').dataset.phase==='loading');
 assert.equal(await page.locator('#buildLabel').isVisible(),true);
 await page.locator('.deployment-cancel').click();await page.waitForFunction(()=>document.querySelector('#sceneFlow').dataset.phase==='idle');
 await page.keyboard.press('F8');await page.waitForFunction(()=>document.querySelector('#feedbackScreenshot').naturalWidth>0);
 assert.equal(await page.locator('#feedbackDialog #buildLabel').count(),1);await page.locator('#feedbackCancel').click();
 console.log('Entering range');await page.locator('#testBuildTop').click();await page.waitForFunction(()=>!document.querySelector('#game').hidden&&document.querySelector('#sceneFlow').dataset.phase==='idle',null,{timeout:20000});
 await page.evaluate(()=>document.exitPointerLock());await page.waitForTimeout(500);await page.screenshot({path:output+'/01-game.png'});
 console.log('Opening report');await page.keyboard.press('F8');await page.waitForFunction(()=>document.querySelector('#feedbackScreenshot').naturalWidth>0,null,{timeout:15000});
 const source=await page.locator('#feedbackScreenshot').getAttribute('src');await writeFile(output+'/captured-game.jpg',new Uint8Array(await page.evaluate(async url=>Array.from(new Uint8Array(await(await fetch(url)).arrayBuffer())),source)));
 const time=()=>page.locator('#feedbackContext').textContent().then(t=>JSON.parse(t).round.time);const before=await time();await page.waitForTimeout(600);await page.locator('#feedbackRetake').click();await page.waitForFunction(()=>!document.querySelector('#feedbackSubmit').disabled);assert.equal(await time(),before);
 await page.locator('[name=title]').fill('Railgun misses close targets');for(const key of ['details','steps','expected','actual'])await page.locator(`[name=${key}]`).fill('Test the railgun against a close range target and inspect its hull.');await page.screenshot({path:output+'/02-bug-report.png'});
 await page.locator('#feedbackCancel').click();await page.keyboard.press('F8');assert.equal(await page.locator('[name=title]').inputValue(),'Railgun misses close targets');
 await page.locator('[data-kind=suggestion]').click();await page.locator('[name=title]').fill('Add a clearer target damage readout');
 for(const [key,value] of Object.entries({details:'Show the last shot damage beside each practice target.',steps:'When testing a new weapon in the range.',expected:'Display a brief damage number and remaining target hull.',actual:'It would make comparing loadouts much easier.'}))await page.locator(`[name=${key}]`).fill(value);
 console.log('Recording voice');await page.locator('#feedbackRecord').click();await page.waitForFunction(()=>document.querySelector('#feedbackRecord').textContent==='Stop recording',null,{timeout:10000});await page.waitForTimeout(600);await page.screenshot({path:output+'/03-recording.png'});await page.waitForTimeout(600);await page.screenshot({path:output+'/04-recording.png'});await page.locator('#feedbackRecord').click();await page.waitForFunction(()=>!document.querySelector('#feedbackAudio').hidden);
 assert.equal(await page.locator('[name=details]').getAttribute('required'),null);await page.screenshot({path:output+'/05-suggestion-voice.png'});
 console.log('Testing submission retry');await page.locator('[name=consent]').check();await page.locator('#feedbackSubmit').click();await page.waitForFunction(()=>document.querySelector('#feedbackStatus').textContent.includes('Test failure'));assert.equal(await page.locator('[name=title]').inputValue(),'Add a clearer target damage readout');await page.locator('#feedbackSubmit').click();await page.locator('#feedbackSuccess').waitFor({state:'visible'});assert.equal(attempts,2);await page.screenshot({path:output+'/06-receipt.png'});
 await page.locator('#feedbackDone').click();await page.locator('#gameReport').click();assert.equal(await page.locator('[name=title]').inputValue(),'');await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});await page.locator('#feedbackRecord').click();await page.waitForFunction(()=>document.querySelector('#feedbackAudioStatus').textContent.includes('permission denied'));
 await page.locator('#feedbackClose').click();await page.setViewportSize({width:390,height:844});await page.keyboard.press('F8');await page.waitForTimeout(600);const box=await page.locator('#feedbackDialog').boundingBox();assert.ok(box.width<=390&&box.x>=0);assert.equal(await page.evaluate(()=>{const d=document.querySelector('#feedbackDialog');return d.scrollWidth<=d.clientWidth;}),true);await page.screenshot({path:output+'/07-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: screenshot, F8/button, pause, drafts, microphone, submission retry, receipt, denial, mobile');
}finally{await browser.close();server.kill();}
