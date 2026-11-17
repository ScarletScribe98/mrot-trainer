import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root='docs/verification/etap0_5';
mkdirSync(root,{recursive:true});
const profile=`work/lighthouse-themes-${Date.now()}`;
mkdirSync(profile,{recursive:true});
const server=await preview({preview:{port:4174,strictPort:true,host:'127.0.0.1'}});
const chromePath=`${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`;
let chrome;
const scores=[];
try {
 chrome=await launch({chromePath,userDataDir:resolve(profile),chromeFlags:['--headless=new','--no-first-run','--disable-extensions']});
 for(const theme of ['a','b','c']) for(const [screen,hash] of [['title','title'],['level3','game']]) {
  const result=await lighthouse(`http://127.0.0.1:4174/?theme=${theme}#${hash}`,{port:chrome.port,output:['html','json'],onlyCategories:['performance','accessibility'],formFactor:'mobile',screenEmulation:{mobile:true,width:360,height:740,deviceScaleFactor:1,disabled:false},logLevel:'error'});
  writeFileSync(`${root}/lighthouse-${theme}-${screen}.html`,result.report[0]);
  writeFileSync(`${root}/lighthouse-${theme}-${screen}.json`,result.report[1]);
  const performance=Math.round(result.lhr.categories.performance.score*100),accessibility=Math.round(result.lhr.categories.accessibility.score*100);
  const refs=new Set(result.lhr.categories.accessibility.auditRefs.map(ref=>ref.id));
  const failed=Object.values(result.lhr.audits).filter(a=>refs.has(a.id)&&a.score!==null&&a.score<1).map(a=>({id:a.id,title:a.title,details:a.details}));
  scores.push({theme,screen,performance,accessibility,failed});
  console.log(`${theme}/${screen}: Performance ${performance}, Accessibility ${accessibility}`);
  if(failed.length)console.log(JSON.stringify(failed,null,2));
 }
 writeFileSync(`${root}/lighthouse-scores.json`,JSON.stringify(scores,null,2)+'\n');
 if(scores.some(s=>s.performance<85||s.accessibility<90))process.exitCode=1;
} finally {await chrome?.kill();await new Promise(resolve=>server.httpServer.close(resolve));}
