import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
// Optional real-network transport: Windows workerd bypasses the local HTTP
// proxy; curl uses it. This adapter is NOT a fixture and does not alter URLs.
const transport = process.env.CURL_TRANSPORT ? {outboundService:async(request)=>{
  const args=['-sS','--max-time','7','--max-redirs','0','-D','-','-H','accept: '+(request.headers.get('accept')||'*/*'),request.url];
  const {stdout}=await exec('curl',args,{encoding:'buffer',maxBuffer:2*1024*1024});
  let bytes=stdout, header;
  do {
    const at=bytes.indexOf(Buffer.from('\r\n\r\n'));
    if(at<0) throw Error('missing HTTP response headers');
    header=bytes.subarray(0,at).toString();bytes=bytes.subarray(at+4);
  } while(/^HTTP\/\S+ 200 Connection established/i.test(header));
  const lines=header.split('\r\n'),status=Number(lines.shift().split(' ')[1]),headers=new Headers();
  for(const line of lines){const colon=line.indexOf(':');if(colon>0 && !/^(set-cookie|transfer-encoding|content-length|content-encoding)$/i.test(line.slice(0,colon)))headers.append(line.slice(0,colon),line.slice(colon+1).trim());}
  return new Response([204,205,304].includes(status)?null:bytes,{status,headers});
}} : {};
const mf = new Miniflare({...transport,modules:true,scriptPath:fileURLToPath(new URL('./worker.js',import.meta.url)),compatibilityDate:'2026-06-01',ratelimits:{RATE_LIMITER:{namespace_id:'36720261103',simple:{limit:30,period:60}}}});
try {
  console.log('HEALTH',await (await mf.dispatchFetch('https://resolver.example.com/health')).text());
  for (const site of ['https://www.incopat.com/','https://www.maple367.eu.org/']) {
    const started=Date.now();
    const res=await mf.dispatchFetch('https://resolver.example.com/resolve?url='+encodeURIComponent(site),{headers:{origin:'https://home.maple367.eu.org','cf-connecting-ip':'198.51.100.5'}});
    console.log(JSON.stringify({site,status:res.status,elapsedMs:Date.now()-started,result:await res.json()}));
  }
  // Actual built-in workerd limiter, not the injected fixture object.
  const statuses=[];
  for(let i=0;i<31;i++) statuses.push((await mf.dispatchFetch('https://resolver.example.com/resolve?url=http://127.0.0.1',{headers:{'cf-connecting-ip':'198.51.100.99'}})).status);
  console.log('BUILT_IN_LIMITER',JSON.stringify({invalid400:statuses.filter(s=>s===400).length,limited429:statuses.filter(s=>s===429).length,statuses}));
  if(statuses.filter(s=>s===400).length!==30 || statuses[30]!==429) process.exitCode=1;
} finally {await mf.dispose();}
