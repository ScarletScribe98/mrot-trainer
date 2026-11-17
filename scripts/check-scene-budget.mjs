import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
function walk(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]); }
const files = walk('public/assets').filter(path => /\.(svg|webp|avif)$/.test(path)).sort().map(path => {
  const data = readFileSync(path);
  return { path, bytes: statSync(path).size, gzipBytes: gzipSync(data, { level: 9 }).length };
});
const codeFiles = [...readdirSync('dist/assets').filter(name=>/\.(js|css)$/.test(name)).map(name=>`dist/assets/${name}`), ...readdirSync('dist').filter(name=>/\.js$/.test(name)).map(name=>`dist/${name}`)];
const frontendBytes=codeFiles.reduce((sum,path)=>sum+statSync(path).size,0);
const report = { files, frontendBytes, rawBytes: files.reduce((sum, file) => sum + file.bytes, 0), gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0), budgetBytes: 400000 };
report.conservativeTotalBytes=report.rawBytes+frontendBytes;
writeFileSync('docs/verification/etap0_6_1/scene-budget.json', JSON.stringify(report, null, 2) + '\n');
console.log(`All scene/portrait SVG and WebP assets, including standalone duplicates: ${report.rawBytes} bytes (${(report.rawBytes/1024).toFixed(1)} KiB), gzip ${(report.gzipBytes/1024).toFixed(1)} KiB; limit 400000 bytes`);
console.log(`SVG/WebP plus all compiled app/service-worker JS and CSS: ${report.conservativeTotalBytes} bytes (${(report.conservativeTotalBytes/1024).toFixed(1)} KiB)`);
if(report.conservativeTotalBytes > report.budgetBytes) process.exitCode = 1;
const sw = readFileSync('dist/sw.js','utf8');
const missing = files.filter(file => !sw.includes(file.path.replace('public/',''))).map(file=>file.path);
if(missing.length) { console.error('Missing from PWA precache:', missing); process.exitCode=1; } else console.log('All scene assets are present in the generated PWA precache');
