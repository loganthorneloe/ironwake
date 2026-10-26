import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeBuildInfo} from './build-info.mjs';
import {MAX_REQUEST,validateReport} from '../dist/feedback-schema.js';
// --field-qa enables local browser fixtures and a feedback mock. It never contacts GitHub.
// Example: node scripts/preview-server.mjs 4190 --field-qa
const root=resolve(import.meta.dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.mp4':'video/mp4','.webm':'video/webm'};
const json=(res,status,value)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(value));
export function createPreviewHandler({fieldQA=false}={}){
const feedbackLog=[];
async function mockFeedback(req,res){
 if(req.method==='GET')return json(res,200,{available:true,mock:true,message:'LOCAL QA MOCK: no issue or attachment is published.'});
 if(req.method!=='POST')return json(res,405,{error:'Only GET and POST are supported by the local mock.'});
 try{
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_REQUEST)return json(res,413,{error:'Local QA request is too large.'});chunks.push(chunk);}
  const data=await new Request('http://127.0.0.1/api/feedback',{method:'POST',headers:req.headers,body:Buffer.concat(chunks)}).formData();
  const screenshot=data.get('screenshot'),audio=data.get('audio'),report=validateReport(JSON.parse(data.get('report')),!!audio);
  const attempt={attempt:feedbackLog.length+1,id:req.headers['x-report-id']||null,kind:report.kind,context:report.context,screenshotBytes:screenshot?.size||0,audioBytes:audio?.size||0,requestBytes:size};
  feedbackLog.push(attempt);console.log('LOCAL QA feedback: '+JSON.stringify(attempt));
  // A deliberate first failure exercises draft retention and idempotent retries.
  if(feedbackLog.length===1)return json(res,502,{error:'Local mock failure: draft retained. Retry once to receive the mock receipt.',mock:true});
  return json(res,200,{url:'https://github.com/loganthorneloe/ironwake/issues/0',mock:true,message:'LOCAL QA MOCK: issue 0 is a placeholder; nothing was published.'});
 }catch(error){return json(res,400,{error:'Local mock rejected request: '+error.message,mock:true});}
}
return async(req,res)=>{
 try{
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(fieldQA&&path==='/ironwake/api/feedback')return await mockFeedback(req,res);
  if(fieldQA&&path==='/tests/field-qa-log.json')return json(res,200,{mock:true,publication:'none',attempts:feedbackLog});
  if(path.startsWith('/ironwake'))path='/dist'+path.slice(9);
  if(path.endsWith('/'))path+='index.html';
  const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  let body=await readFile(file);
  if(fieldQA&&file===resolve(root,'dist/app.js'))body=Buffer.concat([body,Buffer.from("\n// Local preview fixture; absent from the deployed app.\nimport {installFieldBrowserQA} from '/tests/field-browser-qa.js';\ninstallFieldBrowserQA({getWorld:()=>world,getLocalId:()=>localId});\n")]);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
 }catch{res.writeHead(404).end('Not found');}
};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),fieldQA=args.includes('--field-qa'),port=Number(args.find(arg=>!arg.startsWith('--'))||4175);
 await writeBuildInfo({root});
 createServer(createPreviewHandler({fieldQA})).listen(port,'127.0.0.1',()=>console.log(`IRONWAKE preview: http://127.0.0.1:${port}/ironwake/${fieldQA?' (FIELD QA / LOCAL FEEDBACK MOCK ONLY)':''}`));
}
