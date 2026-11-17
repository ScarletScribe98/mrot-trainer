type AssetName = 'desk' | 'lamp' | 'folder' | 'form' | 'worker-card' | 'clip' | 'stamp-frame' | 'stamp-violation' | 'stamp-clear' | `portrait-${number}` | `level-${string}`;
const boxes: Record<string, string> = {
  desk: '0 0 1200 800', lamp: '0 0 300 420', folder: '0 0 700 500',
  form: '0 0 500 650', 'worker-card': '0 0 260 180', clip: '0 0 40 150',
};
export function Asset({ name, class: className = '', stretch = false }: { name: AssetName; class?: string; stretch?: boolean }) {
  const viewBox = boxes[name] ?? (name.startsWith('portrait-') ? '0 0 160 210' : name.startsWith('level-') ? '0 0 80 80' : '0 0 400 100');
  return <svg class={`asset ${className}`} viewBox={viewBox} preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'} aria-hidden="true" focusable="false"><use href={`${import.meta.env.BASE_URL}assets/archive.svg#${name}`}/></svg>;
}
export function Portrait({ index, class: className = '' }: { index: number; class?: string }) {
  return <div class={`worker-portrait ${className}`}><Asset name={`portrait-${index % 6 + 1}`}/></div>;
}
export function LevelArt({ index }: { index: number }) {
  const names = ['history', 'map', 'cards', 'ledger', 'final'];
  return <Asset name={`level-${names[index]}`} class="level-art"/>;
}
export function VerdictSeal({ violation }: { violation: boolean }) {
  return <div class={`verdict-seal ${violation ? 'verdict-seal--violation' : ''}`}><Asset name={violation ? 'stamp-violation' : 'stamp-clear'} stretch/><span>{violation ? 'Нарушение' : 'Нарушений нет'}</span></div>;
}
