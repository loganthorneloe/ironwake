import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PILOT_PROFILES,createPilotPreference} from '../dist/pilot-profiles.js';
import {createPilotEvents} from '../dist/pilot-events.js';
import {createPilotVoice} from '../dist/pilot-voice.js';
import {DEFAULT_BUILD, WEAPONS, ABILITIES, testPlatform, newWorld, setInput, step, snapshot, mechStats} from '../dist/core.js';

const url = new URL('../dist/audio/pilot/callouts.json', import.meta.url);
const catalog = JSON.parse(await readFile(url, 'utf8'));
function world() { return newWorld(testPlatform(), [{id:'self',build:DEFAULT_BUILD},{id:'ally',build:DEFAULT_BUILD}]); }
function audioHarness({missing = [], beforeFetch = async()=>{}} = {}) {
  const sources = [], requests = [];
  const ctx = {
    currentTime:0, state:'running', decodeAudioData:async data => ({duration:1.5,asset:new TextDecoder().decode(data)}),
    createGain:() => ({gain:{value:0},connect(){},disconnect(){}}),
    createBufferSource() {
      const source = {connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};
      sources.push(source); return source;
    }
  };
  const fetcher = async address => {
    requests.push(String(address)); await beforeFetch(String(address));
    if (String(address).endsWith('.json')) return new Response(JSON.stringify(catalog));
    if (missing.some(id => String(address).endsWith(id+'.wav'))) return new Response('',{status:404});
    return new Response(String(address));
  };
  const voice = createPilotVoice(ctx, {}, {fetcher, url});
  return {voice, ctx, sources, requests, end() { sources.at(-1)?.onended(); }};
}

test('actual simulation attacks produce one local callout edge, including repeated co-op snapshots', () => {
  const w=world(), tracker=createPilotEvents(), p=w.players[0];
  const update=state=>tracker.update(state,'self',mechStats(p.build).hp);
  assert.deepEqual(update(w), ['deploy']);
  setInput(w,'self',{left:true}); step(w,.02);
  assert.deepEqual(update(w), [p.hands[0].item]);
  assert.deepEqual(update(JSON.parse(JSON.stringify(snapshot(w)))), []);
  setInput(w,'self',{}); setInput(w,'ally',{left:true}); step(w,.02);
  assert.deepEqual(update(w), []);
  setInput(w,'self',{dash:true,x:1}); step(w,.02);
  assert.ok(update(w).includes('dash'));
  assert.deepEqual(update(w), []);
});

test('every weapon observes successful action counters, never raw held inputs', () => {
  for (const [item,weapon] of Object.entries(WEAPONS)) {
    const w=world(), p=w.players[0], tracker=createPilotEvents();
    p.hands[0].item=item; tracker.update(w,'self',1000);
    p.input={left:true}; w.time++;
    assert.deepEqual(tracker.update(w,'self',1000), []);
    if (item==='guard') p.hands[0].guarding=true;
    else p.hands[0][weapon.melee?'meleeCount':'shotCount']++;
    assert.deepEqual(tracker.update(w,'self',1000), [item]);
    assert.deepEqual(tracker.update(w,'self',1000), []);
  }
});

test('specials, health, revive, flight and mission results are transition based', () => {
  const w=world(), p=w.players[0], tracker=createPilotEvents(), hp=p.hp;
  const update=()=>tracker.update(w,'self',hp);
  update();
  for (const ability of Object.keys(ABILITIES)) {
    p.abilityCd=0;update();p.activeAbility=ability;p.abilityCd=14;
    assert.deepEqual(update(),[ability]);
  }
  p.hp=hp*.2; assert.deepEqual(update(),['critical']); assert.deepEqual(update(),[]);
  p.hp=0; assert.deepEqual(update(),['downed']); assert.deepEqual(update(),[]);
  p.hp=hp*.5; assert.deepEqual(update(),['revived']);
  p.airborne=true; assert.deepEqual(update(),['flight']);
  w.status='won';assert.deepEqual(update(),['won']);assert.deepEqual(update(),[]);
  tracker.reset();w.status='playing';update();w.status='lost';assert.deepEqual(update(),['lost']);
});

test('entry and rewound worlds baseline counters; campaign kills belong to this pilot', () => {
  const w=world(),p=w.players[0],tracker=createPilotEvents();
  p.hands[0].shotCount=100;w.time=100;p.field={kills:4};
  assert.deepEqual(tracker.update(w,'self',1000),['deploy']);
  w.kills=40;assert.deepEqual(tracker.update(w,'self',1000),[]);
  p.field.kills++;assert.deepEqual(tracker.update(w,'self',1000),['kill']);
  w.operation={heavyAlert:{id:17,landingAt:120}};
  assert.deepEqual(tracker.update(w,'self',1000),['heavy']);
  assert.deepEqual(tracker.update(w,'self',1000),[]);
  w.time=0;assert.deepEqual(tracker.update(w,'self',1000),['deploy']);
});

test('speech arbitration drops spam and lets danger and specials interrupt lower priority lines', async () => {
  const {voice,ctx,sources,end}=audioHarness();await voice.preload();
  assert.equal(voice.play(['carbine','rail']), 'rail-piercer');
  assert.equal(voice.play(['carbine']), null);
  ctx.currentTime=.2;
  assert.equal(voice.play(['emp','dash']), 'thunder-collapse');
  assert.equal(sources[0].stopped,true);
  // The ended callback of an interrupted source must not clear the new source.
  sources[0].onended();
  assert.equal(voice.play(['repair']),null);
  assert.equal(voice.play(['critical']), 'not-finished');
  assert.equal(voice.play(['won']), 'our-victory');
  end();ctx.currentTime=4;
  assert.equal(voice.play(['rail']),null,'per-event cooldown survives interruption');
  assert.equal(voice.play(['carbine']), 'pulse-volley');
});

test('global spacing, take rotation, mute, suspension and reset never replay queued attacks', async () => {
  const {voice,ctx,sources,end}=audioHarness();await voice.preload();
  voice.play(['rail']);end();ctx.currentTime=2;
  assert.equal(voice.play(['carbine']),null,'space out speech even after a short clip');
  ctx.currentTime=10;assert.equal(voice.play(['rail']),'straight-through');
  assert.equal(voice.play(['emp'],false),null);assert.equal(sources.at(-1).stopped,true);
  ctx.state='suspended';assert.equal(voice.play(['won']),null);
  ctx.state='running';voice.reset();
  assert.equal(voice.play([]),null);
  assert.equal(voice.play(['rail']),'rail-piercer');
  voice.reset();assert.equal(sources.at(-1).stopped,true);
});

test('missing clips and failed downloads are optional; available alternatives still play', async () => {
  const {voice}=audioHarness({missing:['rail-piercer']});await voice.preload();
  assert.equal(voice.play(['rail']),'straight-through');
  const broken=createPilotVoice({state:'running'}, {}, {fetcher:async()=>{throw new Error('offline');}});
  await assert.doesNotReject(broken.preload());
  assert.equal(broken.play(['rail']),null);
});

test('voice selection stops the old speaker and ignores late loads of a previous choice', async () => {
  let release;
  const gate=new Promise(resolve=>release=resolve);
  const {voice,sources,requests}=audioHarness({beforeFetch:async address=>{if(address.includes('/flint/'))await gate;}});
  await voice.preload();voice.play(['rail']);
  assert.ok(sources.at(-1).buffer.asset.includes('/rook/'));
  const flint=voice.setProfile('flint');
  assert.equal(sources.at(-1).stopped,true);assert.equal(voice.ready,false);
  assert.equal(voice.play(['emp']),null,'old voice cannot speak during the switch');
  await voice.setProfile('echo');
  assert.equal(voice.profile,'echo');assert.equal(voice.ready,true);
  release();await flint;
  voice.play(['rail']);assert.ok(sources.at(-1).buffer.asset.includes('/echo/'));
  const count=requests.length;
  await voice.setProfile('rook');assert.equal(requests.length,count,'reuse the decoded pack');
  voice.play(['rail']);assert.ok(sources.at(-1).buffer.asset.includes('/rook/'));
});

test('voice preference persists independently and survives invalid values or blocked storage', () => {
  const values=new Map();const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const preference=createPilotPreference(storage);assert.equal(preference.id,'rook');
  assert.equal(preference.set('flint'),true);assert.equal(createPilotPreference(storage).id,'flint');
  assert.equal(preference.set('../bad'),false);assert.equal(preference.id,'flint');
  assert.equal(values.has('iw-pilot-voice'),false,'speech enabled preference is separate');
  values.set('iw-pilot-voice-id','removed-voice');assert.equal(createPilotPreference(storage).id,'rook');
  const blocked=createPilotPreference({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(blocked.id,'rook');assert.equal(blocked.set('echo'),true);assert.equal(blocked.id,'echo');
});

test('every selectable pack covers the arsenal with audible 24 kHz mono PCM', async () => {
  for (const key of [...Object.keys(WEAPONS),...Object.keys(ABILITIES),'dash','flight','critical','revived','won','lost']) {
    assert.ok(catalog.events[key]?.lines.length,key);
  }
  const ids=new Set();let bytes=0;
  for (const profile of PILOT_PROFILES) {
    assert.equal(catalog.profiles[profile.id].name,profile.name);
    assert.equal(catalog.profiles[profile.id].description,profile.description);
    const reference=await readFile(new URL('../scripts/voice/'+profile.id+'-reference.wav',import.meta.url));
    assert.ok(reference.length>24000,profile.id+' saved reference');
    for(const event of Object.values(catalog.events)) for(const line of event.lines){
    const asset=profile.id+'/'+line.id;
    assert.ok(!ids.has(asset),'unique take ID');ids.add(asset);
    const wav=await readFile(new URL(profile.id+'/'+line.id+'.wav',url));bytes+=wav.length;
    assert.equal(wav.toString('ascii',0,4),'RIFF',line.id);
    assert.equal(wav.toString('ascii',8,12),'WAVE');
    assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),1);
    assert.equal(wav.readUInt32LE(24),24000);assert.equal(wav.readUInt16LE(34),16);
    let offset=12,data;
    while(offset+8<=wav.length){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data'){data=wav.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
    assert.ok(data?.length>7200 && data.length<336000,asset+' duration');
    let peak=0,sum=0;for(let i=0;i<data.length;i+=2){const v=data.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
    assert.ok(peak>.1 && peak<.95,asset+' peak');
    assert.ok(Math.sqrt(sum/(data.length/2))>.02,asset+' audible');
  }
  }
  assert.equal(ids.size,96);
  assert.ok(bytes<7_000_000,'small browser voice packs');
});
