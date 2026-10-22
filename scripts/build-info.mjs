import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function git(root,...args){
 try{return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
 catch{return '';}
}

function positiveInteger(value,name){
 if(!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw new Error(`Invalid ${name}: expected a positive integer.`);
 return Number(value);
}

export async function writeBuildInfo({root=resolve(import.meta.dirname,'..'),env=process.env,now=new Date()}={}){
 const {version}=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 let build;
 if(env.GITHUB_ACTIONS==='true'){
  const run=positiveInteger(env.GITHUB_RUN_NUMBER,'GITHUB_RUN_NUMBER');
  const attempt=positiveInteger(env.GITHUB_RUN_ATTEMPT,'GITHUB_RUN_ATTEMPT');
  build=`github.${run}.${attempt}`;
 }else{
  const counterFile=resolve(root,'.local-build-number');
  let previous=0;
  try{previous=positiveInteger((await readFile(counterFile,'utf8')).trim(),'.local-build-number');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const next=positiveInteger(previous+1,'next local build number');
  await writeFile(counterFile,`${next}\n`);
  build=`local.${next}`;
 }
 const revision=(env.GITHUB_ACTIONS==='true'?env.GITHUB_SHA:'')||git(root,'rev-parse','HEAD')||'unknown';
 const dirty=Boolean(git(root,'status','--porcelain','--untracked-files=normal'));
 const source=revision==='unknown'?'source unknown':revision.slice(0,7)+(dirty?'+dirty':'');
 const info={version,build,revision,dirty,builtAt:now.toISOString(),label:`v${version} · ${build} · ${source}`};
 await mkdir(resolve(root,'dist'),{recursive:true});
 await writeFile(resolve(root,'dist/build-info.json'),JSON.stringify(info,null,2)+'\n');
 console.log(`IRONWAKE ${info.label}`);
 return info;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await writeBuildInfo();
