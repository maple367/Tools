import {publicHost, publicIP, safeURL, createResolver, createHandler} from './worker.js';
const assert = (v,m='assertion failed') => {if(!v) throw new Error(m);};
const equal = (a,b) => assert(a===b,`${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
const reject = async fn => {let threw=false;try{await fn();}catch{threw=true;}assert(threw,'expected rejection');};
const signal = () => new AbortController().signal;
function fixture(options={}) {
  const calls=[];
  const fetch = async (value,init={}) => {
    const u = new URL(value); calls.push(u.href);
    if(u.hostname==='cloudflare-dns.com') {
      const name=u.searchParams.get('name'), type=u.searchParams.get('type');
      const Answer=options.dns ? options.dns(name,type) : [{name:name+'.',type:type==='A'?1:28,data:type==='A'?'93.184.216.34':'2606:4700:4700::1111'}];
      return Response.json({Status:0,Answer});
    }
    assert(init.redirect==='manual','automatic redirect');
    if(options.page) return options.page(u,calls);
    return new Response(options.html || '<title>No icon</title>',{headers:{'content-type':'text/html'}});
  };
  return {calls, resolve:createResolver({fetch})};
}
export default {async fetch(request,env,ctx) {
  const results=[];
  const test=async(name,fn)=>{try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:String(e.stack||e)});}};
  await test('hostile URLs and alternate IP encodings',async()=>{
    for(const url of ['file:///etc/passwd','javascript:alert(1)','https://user:pw@example.com','http://127.0.0.1','http://2130706433','http://0x7f000001','http://0177.0.0.1','http://[::1]','http://[::ffff:127.0.0.1]','https://printer','https://foo.local','https://foo.internal','https://example.com:8443','https://example.com.']) await reject(()=>safeURL(url));
    assert(publicHost('www.maple367.eu.org')); equal(safeURL('https://www.example.com/x?a=1').origin,'https://www.example.com');
  });
  await test('public/private IPv4 and IPv6 classifications',async()=>{
    for(const ip of ['0.0.0.0','10.0.0.1','100.64.1.2','127.0.0.1','169.254.1.1','172.31.1.1','192.168.1.1','192.0.0.9','198.18.0.1','198.51.100.1','203.0.113.2','224.1.1.1','255.255.255.255','::1','::ffff:7f00:1','::ffff:127.0.0.1','fc00::1','fe80::1','64:ff9b::1','2001:db8::1','2001::1','2002:7f00::1','3fff::1','2001:4860:::1']) assert(!publicIP(ip),ip);
    for(const ip of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111','2001:4860:4860::8888']) assert(publicIP(ip),ip);
  });
  await test('real HTMLRewriter rel parsing, CSS ignored, first base, entities and icon preference',async()=>{
    const f=fixture({html:`<base href='/resources/css/'><base href='https://evil.internal/'><link rel='stylesheet' href='wrong.css'><link rel='apple-touch-icon' href='/apple.png'><link REL='SHORTCUT ICON' href='images/favicon.ico?a=1&amp;b=2'>`});
    const r=await f.resolve('https://www.incopat.com/private?token=secret',signal());
    equal(r.iconUrl,'https://www.incopat.com/resources/css/images/favicon.ico?a=1&b=2');equal(r.source,'html');equal(r.verified,false);
    const upstream=f.calls.filter(x=>!x.startsWith('https://cloudflare-dns.com/'));equal(upstream.length,1);equal(upstream[0],'https://www.incopat.com/');
  });
  await test('absolute CDN declaration and apple fallback',async()=>{
    let f=fixture({html:`<link rel='icon' href='https://imgs.maple367.eu.org/maple_logo.ico'>`});equal((await f.resolve('https://www.maple367.eu.org',signal())).iconUrl,'https://imgs.maple367.eu.org/maple_logo.ico');
    f=fixture({html:`<link rel='apple-touch-icon' href='/apple.png'>`});equal((await f.resolve('https://apple.example.com',signal())).iconUrl,'https://apple.example.com/apple.png');
  });
  await test('unsafe declarations skipped, no image or CSS proxy',async()=>{
    const f=fixture({html:`<link rel='icon' href='http://127.0.0.1/a'><link rel='icon' href='data:image/png;base64,abc'><link rel='stylesheet' href='/main.css'>`});const r=await f.resolve('https://safe.example.com',signal());equal(r.source,'fallback');equal(r.verified,false);equal(r.iconUrl,'https://safe.example.com/favicon.ico');
  });
  await test('mixed public/private DNS and private AAAA rejected before homepage fetch',async()=>{
    for(const bad of [{type:1,data:'10.0.0.1'},{type:28,data:'::ffff:7f00:1'}]) {
      const f=fixture({dns:(name,type)=>[{name,type:1,data:'8.8.8.8'},{name,...bad}]});await reject(()=>f.resolve('https://mixed.example.com',signal()));assert(f.calls.every(x=>x.startsWith('https://cloudflare-dns.com/')));
    }
  });
  await test('CNAME chains resolved, internal alias/loop/private final rejected',async()=>{
    for(const mode of ['internal','loop','private','public']) {
      const f=fixture({dns:(name,type)=>name==='cname.example.com'?[{name,type:5,data:mode==='internal'?'server.internal.':mode==='loop'?'cname.example.com.':'target.example.com.'}]:[{name,type:1,data:mode==='private'?'127.0.0.1':'8.8.8.8'}]});
      if(mode==='public')equal((await f.resolve('https://cname.example.com',signal())).source,'fallback');else await reject(()=>f.resolve('https://cname.example.com',signal()));
    }
  });
  await test('safe final redirect base and validated redirect targets',async()=>{
    const f=fixture({page:u=>u.hostname==='start.example.com'?new Response(null,{status:302,headers:{location:'https://final.example.com/sub/page'}}):new Response(`<link rel='icon' href='fav.ico'>`,{headers:{'content-type':'text/html'}})});
    equal((await f.resolve('https://start.example.com/bookmark?secret=x',signal())).iconUrl,'https://final.example.com/sub/fav.ico');
    for(const target of ['http://127.0.0.1/x','http://server.internal/','file:///secret']) {const bad=fixture({page:()=>new Response(null,{status:302,headers:{location:target}})});await reject(()=>bad.resolve('https://start.example.com',signal()));equal(bad.calls.filter(x=>!x.includes('cloudflare-dns.com')).length,1);}
    const privateDNS=fixture({dns:(name,type)=>[{name,type:1,data:name==='blocked.example.com'?'10.0.0.1':'8.8.8.8'}],page:()=>new Response(null,{status:302,headers:{location:'https://blocked.example.com/'}})});await reject(()=>privateDNS.resolve('https://start.example.com',signal()));equal(privateDNS.calls.filter(x=>!x.includes('cloudflare-dns.com')).length,1);
  });
  await test('redirect loops bounded to four homepage requests',async()=>{
    const f=fixture({page:()=>new Response(null,{status:302,headers:{location:'/loop'}})});equal((await f.resolve('https://loop.example.com',signal())).reason,'redirect_limit');equal(f.calls.filter(x=>!x.includes('cloudflare-dns.com')).length,4);
  });
  await test('blocked upstream, content types and declared/streaming 512KiB limit',async()=>{
    for(const page of [()=>new Response('blocked',{status:403}),()=>new Response('png',{headers:{'content-type':'image/png'}}),()=>new Response('x',{headers:{'content-type':'text/html','content-length':'524289'}}),()=>new Response('x'.repeat(524289),{headers:{'content-type':'text/html'}})]) {
      const f=fixture({page});const r=await f.resolve('https://large.example.com',signal());equal(r.source,'fallback');equal(r.verified,false);
    }
  });
  const allowed={RATE_LIMITER:{limit:async()=>({success:true})}};
  const req=(path,origin,method='GET')=>new Request('https://resolver.example.com'+path,{method,headers:origin?{origin}:undefined});
  await test('exact CORS, CLI GET, methods, and missing limiter fail closed',async()=>{
    const handler=createHandler(async()=>({iconUrl:'https://cors.example.com/favicon.ico',source:'fallback',verified:false}));
    for(const origin of ['https://home.maple367.eu.org','http://127.0.0.1:8765','http://localhost:8765']) {const r=await handler(req('/health',origin),{},ctx);equal(r.status,200);equal(r.headers.get('access-control-allow-origin'),origin);}
    for(const origin of ['null','https://home.maple367.eu.org.evil.com','http://home.maple367.eu.org','http://localhost:8766']) equal((await handler(req('/health',origin),{},ctx)).status,403);
    equal((await handler(req('/health'),{},ctx)).status,200);equal((await handler(req('/resolve?url=https://cors.example.com'),{},ctx)).status,503);equal((await handler(req('/resolve',null,'POST'),allowed,ctx)).status,405);
    equal((await handler(req('/resolve?url=http://127.0.0.1'),allowed,ctx)).status,400);
  });
  await test('rate denied, limiter exception, limiter invoked even for cache hit',async()=>{
    const handler=createHandler();const q=req('/resolve?url=https://rate.example.com');
    equal((await handler(q,{RATE_LIMITER:{limit:async()=>({success:false})}},ctx)).status,429);
    equal((await handler(q,{RATE_LIMITER:{limit:async()=>{throw Error('unavailable');}}},ctx)).status,503);
  });
  await test('actual Workers Cache API positive/negative TTL and path-private cache key',async()=>{
    let count=0,limits=0;const env={RATE_LIMITER:{limit:async()=>{limits++;return {success:true};}}};
    for(const source of ['html','fallback']) {
      const host=`cache-${source}-${Date.now()}.example.com`;
      const handler=createHandler(async()=>{count++;return {iconUrl:`https://${host}/favicon.ico`,source,verified:false};});
      const r=await handler(req(`/resolve?url=${encodeURIComponent('https://'+host+'/secret?a=b')}`),env,ctx);equal(r.status,200);
      // Cache writes use waitUntil: poll the actual cache rather than assuming completion.
      const key=new Request('https://favicon-cache.invalid/v1/'+encodeURIComponent('https://'+host));let cached;
      for(let i=0;i<20;i++){cached=await caches.default.match(key);if(cached)break;await new Promise(r=>setTimeout(r,10));}
      assert(cached);equal(cached.headers.get('cache-control'),`public, max-age=${source==='html'?604800:300}`);
      equal((await handler(req(`/resolve?url=https://${host}/other?new=value`),env,ctx)).status,200);
    }
    equal(count,2);equal(limits,4);
  });
  await test('total resolver deadline enforced at 7.5 seconds',async()=>{
    const handler=createHandler(()=>new Promise(()=>{}));const start=Date.now();const r=await handler(req('/resolve?url=https://timeout.example.com'),allowed,ctx);equal(r.status,502);equal((await r.json()).error,'timeout');assert(Date.now()-start<8100);
  });
  return Response.json({runtime:'Cloudflare workerd / real HTMLRewriter and Cache API',passed:results.filter(r=>r.ok).length,total:results.length,results});
}};
