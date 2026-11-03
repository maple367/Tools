// Self-contained Cloudflare ES module. No runtime npm dependencies.
const ALLOWED = new Set(['https://home.maple367.eu.org', 'http://127.0.0.1:8765', 'http://localhost:8765']);
const MAX_HTML = 512 * 1024;
const TIMEOUT_MS = 7500;
const POSITIVE_TTL = 604800;
const NEGATIVE_TTL = 300;
const DOH = 'https://cloudflare-dns.com/dns-query';

// HTMLRewriter exposes raw attribute values. Decode HTML character references
// before URL resolution (ASCII/Latin-1 named references, plus all numeric references).
const ENTITIES = {"Aacute":"\u00c1","aacute":"\u00e1","Aacute;":"\u00c1","aacute;":"\u00e1","Acirc":"\u00c2","acirc":"\u00e2","Acirc;":"\u00c2","acirc;":"\u00e2","acute":"\u00b4","acute;":"\u00b4","AElig":"\u00c6","aelig":"\u00e6","AElig;":"\u00c6","aelig;":"\u00e6","Agrave":"\u00c0","agrave":"\u00e0","Agrave;":"\u00c0","agrave;":"\u00e0","AMP":"&","amp":"&","AMP;":"&","amp;":"&","angst;":"\u00c5","apos;":"'","Aring":"\u00c5","aring":"\u00e5","Aring;":"\u00c5","aring;":"\u00e5","ast;":"*","Atilde":"\u00c3","atilde":"\u00e3","Atilde;":"\u00c3","atilde;":"\u00e3","Auml":"\u00c4","auml":"\u00e4","Auml;":"\u00c4","auml;":"\u00e4","brvbar":"\u00a6","brvbar;":"\u00a6","bsol;":"\\","Ccedil":"\u00c7","ccedil":"\u00e7","Ccedil;":"\u00c7","ccedil;":"\u00e7","cedil":"\u00b8","cedil;":"\u00b8","Cedilla;":"\u00b8","cent":"\u00a2","cent;":"\u00a2","CenterDot;":"\u00b7","centerdot;":"\u00b7","circledR;":"\u00ae","colon;":":","comma;":",","commat;":"@","COPY":"\u00a9","copy":"\u00a9","COPY;":"\u00a9","copy;":"\u00a9","curren":"\u00a4","curren;":"\u00a4","deg":"\u00b0","deg;":"\u00b0","DiacriticalAcute;":"\u00b4","DiacriticalGrave;":"`","die;":"\u00a8","div;":"\u00f7","divide":"\u00f7","divide;":"\u00f7","dollar;":"$","Dot;":"\u00a8","DoubleDot;":"\u00a8","Eacute":"\u00c9","eacute":"\u00e9","Eacute;":"\u00c9","eacute;":"\u00e9","Ecirc":"\u00ca","ecirc":"\u00ea","Ecirc;":"\u00ca","ecirc;":"\u00ea","Egrave":"\u00c8","egrave":"\u00e8","Egrave;":"\u00c8","egrave;":"\u00e8","equals;":"=","ETH":"\u00d0","eth":"\u00f0","ETH;":"\u00d0","eth;":"\u00f0","Euml":"\u00cb","euml":"\u00eb","Euml;":"\u00cb","euml;":"\u00eb","excl;":"!","fjlig;":"fj","frac12":"\u00bd","frac12;":"\u00bd","frac14":"\u00bc","frac14;":"\u00bc","frac34":"\u00be","frac34;":"\u00be","grave;":"`","GT":">","gt":">","GT;":">","gt;":">","half;":"\u00bd","Hat;":"^","Iacute":"\u00cd","iacute":"\u00ed","Iacute;":"\u00cd","iacute;":"\u00ed","Icirc":"\u00ce","icirc":"\u00ee","Icirc;":"\u00ce","icirc;":"\u00ee","iexcl":"\u00a1","iexcl;":"\u00a1","Igrave":"\u00cc","igrave":"\u00ec","Igrave;":"\u00cc","igrave;":"\u00ec","iquest":"\u00bf","iquest;":"\u00bf","Iuml":"\u00cf","iuml":"\u00ef","Iuml;":"\u00cf","iuml;":"\u00ef","laquo":"\u00ab","laquo;":"\u00ab","lbrace;":"{","lbrack;":"[","lcub;":"{","lowbar;":"_","lpar;":"(","lsqb;":"[","LT":"<","lt":"<","LT;":"<","lt;":"<","macr":"\u00af","macr;":"\u00af","micro":"\u00b5","micro;":"\u00b5","midast;":"*","middot":"\u00b7","middot;":"\u00b7","nbsp":"\u00a0","nbsp;":"\u00a0","NewLine;":"\n","NonBreakingSpace;":"\u00a0","not":"\u00ac","not;":"\u00ac","Ntilde":"\u00d1","ntilde":"\u00f1","Ntilde;":"\u00d1","ntilde;":"\u00f1","num;":"#","Oacute":"\u00d3","oacute":"\u00f3","Oacute;":"\u00d3","oacute;":"\u00f3","Ocirc":"\u00d4","ocirc":"\u00f4","Ocirc;":"\u00d4","ocirc;":"\u00f4","Ograve":"\u00d2","ograve":"\u00f2","Ograve;":"\u00d2","ograve;":"\u00f2","ordf":"\u00aa","ordf;":"\u00aa","ordm":"\u00ba","ordm;":"\u00ba","Oslash":"\u00d8","oslash":"\u00f8","Oslash;":"\u00d8","oslash;":"\u00f8","Otilde":"\u00d5","otilde":"\u00f5","Otilde;":"\u00d5","otilde;":"\u00f5","Ouml":"\u00d6","ouml":"\u00f6","Ouml;":"\u00d6","ouml;":"\u00f6","para":"\u00b6","para;":"\u00b6","percnt;":"%","period;":".","plus;":"+","PlusMinus;":"\u00b1","plusmn":"\u00b1","plusmn;":"\u00b1","pm;":"\u00b1","pound":"\u00a3","pound;":"\u00a3","quest;":"?","QUOT":"\"","quot":"\"","QUOT;":"\"","quot;":"\"","raquo":"\u00bb","raquo;":"\u00bb","rbrace;":"}","rbrack;":"]","rcub;":"}","REG":"\u00ae","reg":"\u00ae","REG;":"\u00ae","reg;":"\u00ae","rpar;":")","rsqb;":"]","sect":"\u00a7","sect;":"\u00a7","semi;":";","shy":"\u00ad","shy;":"\u00ad","sol;":"/","strns;":"\u00af","sup1":"\u00b9","sup1;":"\u00b9","sup2":"\u00b2","sup2;":"\u00b2","sup3":"\u00b3","sup3;":"\u00b3","szlig":"\u00df","szlig;":"\u00df","Tab;":"\t","THORN":"\u00de","thorn":"\u00fe","THORN;":"\u00de","thorn;":"\u00fe","times":"\u00d7","times;":"\u00d7","Uacute":"\u00da","uacute":"\u00fa","Uacute;":"\u00da","uacute;":"\u00fa","Ucirc":"\u00db","ucirc":"\u00fb","Ucirc;":"\u00db","ucirc;":"\u00fb","Ugrave":"\u00d9","ugrave":"\u00f9","Ugrave;":"\u00d9","ugrave;":"\u00f9","uml":"\u00a8","uml;":"\u00a8","UnderBar;":"_","Uuml":"\u00dc","uuml":"\u00fc","Uuml;":"\u00dc","uuml;":"\u00fc","verbar;":"|","vert;":"|","VerticalLine;":"|","Yacute":"\u00dd","yacute":"\u00fd","Yacute;":"\u00dd","yacute;":"\u00fd","yen":"\u00a5","yen;":"\u00a5","yuml":"\u00ff","yuml;":"\u00ff"};
function attribute(value) {
  return String(value).replace(/&(#(?:x[0-9a-f]+|[0-9]+);?|[a-z][a-z0-9]*;?)/gi, (whole, key, offset, text) => {
    if (key[0] === '#') {
      const hex = /^#x/i.test(key);
      const n = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
    }
    if (!key.endsWith(';') && /[=a-z0-9]/i.test(text[offset + whole.length] || '')) return whole;
    return Object.hasOwn(ENTITIES,key) ? ENTITIES[key] : whole;
  });
}

export function publicHost(value) {
  const host = value.toLowerCase();
  if (host.length > 253 || !host.includes('.') || host.endsWith('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.includes('[')) return false;
  if (!host.split('.').every(p => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p))) return false;
  return !/(?:^|\.)(?:localhost|local|internal|intranet|lan|home|test|invalid|example|onion|arpa)$/.test(host);
}
export function safeURL(value, base) {
  if (String(value).length > 4096) throw new Error('unsafe_url');
  const u = new URL(value, base);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || !publicHost(u.hostname) || (u.port && !['80', '443'].includes(u.port))) throw new Error('unsafe_url');
  u.hash = '';
  return u;
}
export function publicIP(ip) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const a = ip.split('.').map(Number);
    if (a.some(n => n > 255)) return false;
    const [x,y,z] = a;
    return !(x === 0 || x === 10 || x === 127 || x >= 224 || (x === 100 && y >= 64 && y <= 127) || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && (y === 0 || y === 168 || (y === 88 && z === 99))) || (x === 198 && (y === 18 || y === 19 || (y === 51 && z === 100))) || (x === 203 && y === 0 && z === 113));
  }
  // Only globally routable unicast; rejects mapped IPv4, NAT64, ULA,
  // loopback, link-local, multicast, 6to4 and special/documentation space.
  if (!/^[0-9a-f:]+$/i.test(ip) || !ip.includes(':')) return false;
  const parts = ip.split('::');
  if (parts.length > 2) return false;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  if (![...left, ...right].every(p => /^[0-9a-f]{1,4}$/i.test(p))) return false;
  const count = left.length + right.length;
  if (parts.length === 1 ? count !== 8 : count >= 8) return false;
  const words = [...left, ...Array(parts.length === 2 ? 8-count : 0).fill('0'), ...right].map(p => parseInt(p,16));
  const [a,b] = words;
  return a >= 0x2000 && a <= 0x3fff && a !== 0x2002 && !(a === 0x2001 && (b <= 0x1ff || b === 0xdb8)) && !(a === 0x3fff && b <= 0xfff);
}
async function boundedText(response, max) {
  const len = response.headers.get('content-length');
  if (len && Number(len) > max) { await response.body?.cancel(); throw new Error('body_too_large'); }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) throw new Error('body_too_large');
      chunks.push(value);
    }
  } catch (e) { await reader.cancel().catch(()=>{}); throw e; }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const c of chunks) { bytes.set(c,offset); offset += c.length; }
  return new TextDecoder().decode(bytes);
}
export function createResolver(io = {}) {
  const fetcher = io.fetch || fetch;
  return async function resolve(input, signal) {
    const initial = safeURL(input);
    const origin = initial.origin;
    const validated = new Set();
    let dnsRequests = 0;
    async function validateHost(host, chain = new Set()) {
      if (validated.has(host)) return;
      if (!publicHost(host) || chain.has(host) || chain.size >= 5) throw new Error('unsafe_dns');
      const next = new Set(chain); next.add(host);
      let addresses = 0; const aliases = new Set();
      for (const type of ['A','AAAA']) {
        if (++dnsRequests > 24) throw new Error('dns_budget');
        const q = new URL(DOH); q.searchParams.set('name',host); q.searchParams.set('type',type);
        const res = await fetcher(q.href,{headers:{accept:'application/dns-json'}, redirect:'manual', signal});
        if (!res.ok) throw new Error('dns_unavailable');
        const data = JSON.parse(await boundedText(res,65536));
        if (data.Status !== 0 || data.TC || !Array.isArray(data.Answer || []) || (data.Answer || []).length > 64) throw new Error('unsafe_dns');
        for (const record of data.Answer || []) {
          const owner = String(record.name || '').toLowerCase().replace(/\.$/,'');
          if (!publicHost(owner)) throw new Error('unsafe_dns');
          if (record.type === 1 || record.type === 28) {
            if (!publicIP(String(record.data))) throw new Error('unsafe_dns');
            addresses++;
          } else if (record.type === 5) {
            const alias = String(record.data).toLowerCase().replace(/\.$/,'');
            if (!publicHost(alias)) throw new Error('unsafe_dns');
            aliases.add(alias);
          }
        }
      }
      for (const alias of aliases) await validateHost(alias,next);
      if (!addresses && !aliases.size) throw new Error('dns_no_address');
      validated.add(host);
    }
    await validateHost(initial.hostname);
    let page = new URL(origin + '/');
    const fallback = (reason) => ({iconUrl: origin + '/favicon.ico', origin, source:'fallback', verified:false, reason});
    let response;
    for (let hop = 0; hop <= 3; hop++) {
      await validateHost(page.hostname);
      try { response = await fetcher(page.href,{redirect:'manual',signal,headers:{accept:'text/html,application/xhtml+xml;q=0.9','user-agent':'MapleFaviconResolver/1.0'}}); }
      catch { return fallback('upstream_unavailable'); }
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || hop === 3) return fallback('redirect_limit');
        // Every redirect must pass URL and DNS validation before any fetch.
        page = safeURL(location,page);
        continue;
      }
      break;
    }
    if (!response.ok) { await response.body?.cancel(); return fallback('upstream_status'); }
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); return fallback('not_html'); }
    let html;
    try { html = await boundedText(response,MAX_HTML); } catch { return fallback('html_too_large'); }
    let baseHref = null; const links = [];
    await new HTMLRewriter().on('base[href]', {element(el) { if (baseHref === null) baseHref = attribute(el.getAttribute('href')); }})
      .on('link[href]', {element(el) {
        const rel = attribute(el.getAttribute('rel') || '').toLowerCase().split(/\s+/);
        const rank = rel.includes('icon') ? 0 : rel.includes('apple-touch-icon') ? 1 : 9;
        if (rank < 9 && links.length < 64) links.push({href:attribute(el.getAttribute('href')), rank});
      }}).transform(new Response(html,{headers:{'content-type':'text/html;charset=utf-8'}})).text();
    let base = page;
    if (baseHref !== null) { try { base = new URL(baseHref,page); } catch {} }
    links.sort((a,b)=>a.rank-b.rank);
    for (const link of links) {
      try {
        const icon = safeURL(link.href,base);
        if (icon.href.length > 4096) continue;
        await validateHost(icon.hostname);
        return {iconUrl:icon.href, origin, source:'html', verified:false};
      } catch (e) { if (signal.aborted) throw e; }
    }
    return fallback('no_safe_declaration');
  };
}
const resolver = createResolver();
export function createHandler(resolve = resolver) {
  return async function handle(request, env, ctx) {
    const origin = request.headers.get('origin');
    const headers = {'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store',vary:'Origin'};
    if (origin && !ALLOWED.has(origin)) return new Response(JSON.stringify({error:'origin_forbidden'}),{status:403,headers});
    if (origin) headers['access-control-allow-origin'] = origin;
    const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
    const url = new URL(request.url);
    if (request.method !== 'GET') return reply({error:'method_not_allowed'},405);
    if (url.pathname === '/health') return reply({ok:true, version:'maple-home-icons-v1', rateLimiter:!!env.RATE_LIMITER});
    if (url.pathname !== '/resolve') return reply({error:'not_found'},404);
    if (!env.RATE_LIMITER?.limit) return reply({error:'rate_limiter_unavailable'},503);
    let rate;
    try { rate = await env.RATE_LIMITER.limit({key:request.headers.get('cf-connecting-ip') || 'unknown'}); }
    catch { return reply({error:'rate_limiter_unavailable'},503); }
    if (!rate.success) return reply({error:'rate_limited'},429);
    let input;
    try { input = safeURL(url.searchParams.get('url') || ''); } catch { return reply({error:'invalid_url'},400); }
    const key = new Request('https://favicon-cache.invalid/v1/' + encodeURIComponent(input.origin));
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return reply(await hit.json());
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_,reject) => { timer = setTimeout(()=>{controller.abort();reject(new Error('timeout'));},TIMEOUT_MS); });
      const data = await Promise.race([resolve(input.origin,controller.signal),timeout]);
      const cached = new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':`public, max-age=${data.source === 'html' ? POSITIVE_TTL : NEGATIVE_TTL}`}});
      ctx.waitUntil(cache.put(key,cached));
      return reply(data);
    } catch { return reply({error: controller.signal.aborted ? 'timeout' : 'resolution_failed'},502); }
    finally { clearTimeout(timer); controller.abort(); }
  };
}
export default {fetch:createHandler()};
