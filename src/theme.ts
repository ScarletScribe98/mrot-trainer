export type Theme = 'a' | 'b' | 'c';
export const themes: { id: Theme; name: string; description: string }[] = [
  { id: 'a', name: 'Графит', description: 'Холодный уголь, белая бумага, винный штамп' },
  { id: 'b', name: 'Зелёная лампа', description: 'Бутылочное стекло, мягкий свет, тёмное сукно' },
  { id: 'c', name: 'Нуар-редакция', description: 'Тёплый серый, контрастный набор, плёночное зерно' },
];
export function readTheme(): Theme {
  const value = new URL(location.href).searchParams.get('theme');
  return value === 'b' || value === 'c' ? value : 'a';
}
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
export function setThemeUrl(theme: Theme): void {
  const url = new URL(location.href);
  url.searchParams.set('theme', theme);
  history.replaceState(history.state, '', url);
  applyTheme(theme);
}
