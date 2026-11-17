import { readFileSync, writeFileSync } from 'node:fs';
const css=readFileSync('src/ui/tokens.css','utf8');
const pairs=[['text','bg'],['muted','bg'],['text','panel'],['muted','panel'],['ink','paper'],['ink-muted','paper'],['button-ink','button-bg'],['stamp','paper'],['verdict','bg'],['seal','bg'],['folder-ink','folder'],['folder-muted','folder']];
function luminance(hex){const values=hex.replace('#','').match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
const results=[];
for(const theme of ['a','b','c']){
 const block=css.match(new RegExp(`:root\\[data-theme='${theme}'\\] \\{([\\s\\S]*?)\\n\\}`))[1];
 const tokens=Object.fromEntries(Array.from(block.matchAll(/--([\w-]+):\s*([^;]+);/g)).map(m=>[m[1],m[2].trim()]));
 for(const [fg,bg] of pairs){const a=luminance(tokens[fg]),b=luminance(tokens[bg]);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);results.push({theme,foreground:fg,background:bg,ratio:Number(ratio.toFixed(2)),AA:ratio>=4.5});}
}
writeFileSync('docs/verification/etap0_5/contrast.json',JSON.stringify(results,null,2)+'\n');
console.log(`${results.length} semantic color pairs; minimum contrast ${Math.min(...results.map(r=>r.ratio))}:1`);
if(results.some(r=>!r.AA)){console.log(results.filter(r=>!r.AA));process.exitCode=1;}
