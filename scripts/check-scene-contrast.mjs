import {readFileSync,writeFileSync} from 'node:fs';
const css=readFileSync('src/ui/tokens.css','utf8');
const tokens=Object.fromEntries(Array.from(css.matchAll(/--([\w-]+):\s*(#[a-fA-F0-9]{6});/g)).map(m=>[m[1],m[2]]));
function rgb(hex){return hex.replace('#','').match(/../g).map(v=>parseInt(v,16));}
function lum(v){const c=v.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const pairs=[['text','bg'],['muted','bg'],['text','panel'],['muted','panel'],['ink','paper'],['ink-muted','paper'],['button-ink','button-bg'],['stamp','paper'],['verdict','bg'],['seal','bg'],['folder-ink','folder'],['folder-muted','folder']];
const result=pairs.map(([fg,bg])=>({foreground:fg,background:bg,ratio:Number(ratio(rgb(tokens[fg]),rgb(tokens[bg])).toFixed(2))}));
// Worst-case bright scene under the translucent dense panel.
const panel=rgb('#0b1c14').map((v,i)=>v*247/255+rgb('#ffffff')[i]*(1-247/255));
result.push({foreground:'panel body #bdc9b9',background:'dense panel over white',ratio:Number(ratio(rgb('#bdc9b9'),panel).toFixed(2))});
result.push({foreground:'formula text #becab8',background:'#22372b',ratio:Number(ratio(rgb('#becab8'),rgb('#22372b')).toFixed(2))});
writeFileSync('docs/verification/etap0_6/contrast.json',JSON.stringify(result,null,2)+'\n');
console.log(`${result.length} text combinations; minimum contrast ${Math.min(...result.map(r=>r.ratio))}:1`);
if(result.some(r=>r.ratio<4.5))process.exitCode=1;
