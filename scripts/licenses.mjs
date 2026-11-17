import { readFileSync, existsSync, writeFileSync } from 'node:fs';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const records = Object.entries(lock.packages).filter(([path]) => path).map(([path, meta]) => {
 let license = meta.license;
 if (!license && existsSync(`${path}/package.json`)) license = JSON.parse(readFileSync(`${path}/package.json`, 'utf8')).license;
 return { name:meta.name || path.split('node_modules/').at(-1), version:meta.version, license:typeof license==='object'?license.type:license || 'НЕ УКАЗАНА', scope:meta.dev?'Разработка':'Приложение', installed:existsSync(`${path}/package.json`), path };
});
records.sort((a,b) => a.name.localeCompare(b.name)||a.version.localeCompare(b.version));
writeFileSync('docs/verification/packages-licenses.json', JSON.stringify(records,null,2)+'\n');
const table = '# Все пакеты из package-lock.json\n\nВключены транзитивные и платформенные optional-пакеты; колонка «Установлен» относится к машине проверки. Полные тексты лицензий установленных пакетов находятся рядом с их package.json в node_modules. Версии зафиксированы lock-файлом.\n\n| Пакет | Версия | Лицензия | Назначение | Установлен |\n|---|---|---|---|---|\n' + records.map(r=>`| ${r.name} | ${r.version} | ${r.license} | ${r.scope} | ${r.installed?'Да':'Нет'} |`).join('\n')+'\n';
writeFileSync('docs/DEPENDENCY_LICENSES.md',table);
console.log(`${records.length} entries; unspecified licenses: ${records.filter(r=>r.license==='НЕ УКАЗАНА').length}`);
