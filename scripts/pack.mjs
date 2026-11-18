import { spawnSync } from 'node:child_process';
import { accessSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const archive = resolve('work/mrot-trainer-dist.zip');
const temporary = resolve(`work/mrot-trainer-dist-${process.pid}.zip`);
try {
  accessSync(resolve(dist, 'index.html'));
} catch {
  console.error('Сначала соберите dist командой npm run build.');
  process.exit(1);
}

mkdirSync('work', { recursive: true });
try {
  // Windows ships bsdtar, which writes standard ZIP entry paths.
  const [command, args] = process.platform === 'win32'
    ? ['tar.exe', ['--format', 'zip', '-cf', temporary, '-C', dist, '.']]
    : ['zip', ['-q', '-r', temporary, '.']];
  const result = spawnSync(command, args, { cwd: dist, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} не создал ZIP (код ${result.status}).`);
  renameSync(temporary, archive);
  console.log(archive);
} finally {
  rmSync(temporary, { force: true });
}
