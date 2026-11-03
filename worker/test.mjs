import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
const mf = new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:fileURLToPath(new URL('./test-worker.js',import.meta.url)),modulesRoot:fileURLToPath(new URL('.',import.meta.url)),compatibilityDate:'2026-06-01'});
try {
  const res=await mf.dispatchFetch('https://tests.example.com/');
  const report=await res.json();
  console.log(JSON.stringify(report,null,2));
  if(report.passed!==report.total) process.exitCode=1;
} finally {await mf.dispose();}
