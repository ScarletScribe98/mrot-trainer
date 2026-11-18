import { OfficeScene } from './ui/OfficeScene';
import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { canOpenFinal, initialProgress, loadProgress, newAuditRun, newRun, rank, STORAGE_KEY, type Progress } from './game';
import { effect, setMusic } from './audio';
import { AudioToggles, Button, Icon, XPPanel } from './ui/components';
import { Title, Levels, About } from './screens';
import { Game } from './LevelThree';
import { LevelFour } from './LevelFour';
import { FinalCase } from './FinalCase';
import { ActScreen } from './ActScreen';
import { makeActData } from './act';
import { generateFinalSheet } from './calc/final';
import './ui/tokens.css';
import './ui/style.css';
import './ui/assets.css';
import './ui/motion.css';
import './ui/projector.css';
import './ui/scene.css';
import './ui/title.css';
import './ui/documents.css';
import './ui/readability.css';
import './ui/audit.css';
import './ui/final.css';
import './ui/act.css';
type Screen = 'title' | 'levels' | 'game' | 'audit' | 'final' | 'act' | 'about';
const screens: Record<Screen, string> = { title: 'Главная', levels: 'Архив дел', game: 'Карточки работников', audit: 'Аудит ведомости', final: 'Дело № 001', act: 'Акт проверки', about: 'Об игре и источники' };
function readScreen(): Screen { const hash = location.hash.slice(1); return ['title', 'levels', 'game', 'audit', 'final', 'act', 'about'].includes(hash) ? hash as Screen : 'title'; }
// Старые ссылки сохраняют экран и остальные параметры, но больше не выбирают тему.
const entryUrl = new URL(location.href);
if (entryUrl.searchParams.has('theme')) { entryUrl.searchParams.delete('theme'); history.replaceState(history.state, '', entryUrl); }
function App() {
 const [route, setScreen] = useState<Screen>(readScreen);
 const [progress, setProgress] = useState<Progress>(loadProgress);
 const screen = (route === 'final' || route === 'act') && !canOpenFinal(progress) ? 'levels'
  : route === 'act' && !progress.final.act ? 'final' : route;
 const [storageError, setStorageError] = useState(false);
 const [resetting, setResetting] = useState(false);
 const [offlineReady, setOfflineReady] = useState(false);
 const headingRef = useRef<HTMLElement>(null);
 useEffect(() => { const change = () => setScreen(readScreen()); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
 useEffect(() => { document.title = `${screens[screen]} — Инспектор труда`; headingRef.current?.focus({ preventScroll: true }); }, [screen]);
 useLayoutEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); setStorageError(false); } catch { setStorageError(true); } }, [progress]);
 useEffect(() => { if (!('serviceWorker' in navigator) || import.meta.env.DEV) return; let active = true; void navigator.serviceWorker.ready.then(async () => { if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); if (active) setOfflineReady(true); }); return () => { active = false; }; }, []);
 useEffect(() => { const resume = () => setMusic(progress.music && !document.hidden); document.addEventListener('pointerdown', resume, { once: true }); document.addEventListener('visibilitychange', resume); if (!progress.music) setMusic(false); return () => { document.removeEventListener('pointerdown', resume); document.removeEventListener('visibilitychange', resume); }; }, [progress.music]);
 const navigate = (next: Screen) => { effect('paper', progress.sound); location.hash = next; setScreen(next); window.scrollTo({ top: 0, behavior: 'instant' }); };
 const showSignedAct = () => {
  history.replaceState(history.state, '', '#act');
  setScreen('act');
  window.scrollTo({ top: 0, behavior: 'instant' });
 };
 const replay = () => { setProgress({ ...progress, run: newRun((progress.run.seed + 1777) >>> 0) }); navigate('game'); };
 const replayAudit = () => { setProgress(p => ({ ...p, audit: newAuditRun((p.audit.seed + 1777) >>> 0) })); navigate('audit'); };
 const toggleSound = () => { effect('click', !progress.sound); setProgress(p => ({ ...p, sound: !p.sound })); };
 const toggleMusic = () => { setMusic(!progress.music); setProgress(p => ({ ...p, music: !p.music })); };
 return <div class="app-shell"><OfficeScene screen={screen}/><a class="skip-link" href="#main">К содержимому</a><header class="topbar"><button class="brand" onClick={() => navigate('title')} title="На главную"><span class="brand-mark"><Icon name="archive" size={30}/></span><span>Инспектор труда<small>Дело о минимальной зарплате</small></span></button><div class="header-center"><span class="status-dot"/>Учебный архив <span class="slash">/</span> Дело № {screen === 'final' || screen === 'act' ? '001' : screen === 'audit' ? '004' : '003'}</div><button class="about-link" onClick={() => navigate('about')}><Icon name="info" size={20}/><span>Об игре</span></button></header>
 <div class="body-layout"><aside class="sidebar"><div class="sidebar-label eyebrow">Рабочий стол</div><nav aria-label="Основная навигация"><button aria-current={screen === 'title' ? 'page' : undefined} onClick={() => navigate('title')}><span class="nav-index">01</span>Вводная<Icon name="arrow" size={16}/></button><button aria-current={screen === 'levels' || screen === 'game' || screen === 'audit' || screen === 'final' || screen === 'act' ? 'page' : undefined} onClick={() => navigate('levels')}><span class="nav-index">02</span>Архив дел<Icon name="arrow" size={16}/></button><button aria-current={screen === 'about' ? 'page' : undefined} onClick={() => navigate('about')}><span class="nav-index">03</span>Об игре<Icon name="arrow" size={16}/></button></nav><div class="sidebar-note"><span class="tiny-line"/><p>Точность —<br/>дело принципа.</p><small>Проверьте цифры.<br/>Защитите право на оплату.</small></div><div class="sidebar-bottom"><XPPanel xp={progress.xp}/><AudioToggles sound={progress.sound} music={progress.music} onSound={toggleSound} onMusic={toggleMusic}/></div></aside>
 <main id="main" ref={headingRef} tabIndex={-1} class={`main main--${screen}`}><div key={screen} class="screen">
 {storageError && <p class="storage-warning" role="alert">Хранилище браузера недоступно. В этой сессии можно играть, но прогресс не сохранится.</p>}
 {screen === 'title' && <Title onStart={() => navigate('levels')}/>}
 {screen === 'levels' && <Levels progress={progress} onStart={() => navigate('game')} onStartAudit={() => navigate('audit')} onStartFinal={() => navigate(progress.final.act ? 'act' : 'final')}/>}
 {screen === 'game' && <Game key={progress.run.seed} progress={progress} update={setProgress} onBack={() => navigate('levels')} onReplay={replay}/>}
 {screen === 'audit' && <LevelFour key={progress.audit.seed} progress={progress} update={setProgress} onBack={() => navigate('levels')} onReplay={replayAudit}/>}
 {screen === 'final' && <FinalCase progress={progress} update={setProgress} onBack={() => navigate('levels')} onSigned={showSignedAct}/>}
 {screen === 'act' && progress.final.act && <ActScreen
  act={makeActData(generateFinalSheet(progress.final.seed), progress.final.act, progress.final.draft.name)}
  onBack={() => navigate('levels')}/>}
 {screen === 'about' && <About onReset={() => setResetting(true)}/>}
 </div><footer class="main-footer"><span><span class="status-dot"/>{offlineReady ? 'Архив доступен без интернета' : 'Локальный учебный тренажёр'}</span><span>ДЕМОВЕРСИЯ <span class="slash">/</span> ЭТАП 2</span></footer></main></div>
 <div class="mobile-tools"><span>{rank(progress.xp)} · {progress.xp} очков</span><AudioToggles sound={progress.sound} music={progress.music} onSound={toggleSound} onMusic={toggleMusic}/></div>
 {resetting && <div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="reset-title" class="reset-dialog" onKeyDown={e => { if (e.key === 'Escape') setResetting(false); if (e.key === 'Tab') { const buttons = e.currentTarget.querySelectorAll('button'); const first = buttons[0], last = buttons[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }}><h2 id="reset-title">Открыть чистое дело?</h2><p>Опыт и результаты проверок будут удалены с этого устройства.</p><Button autoFocus onClick={() => { setMusic(false); setProgress(initialProgress()); setResetting(false); navigate('title'); }}>Начать заново</Button><Button variant="quiet" onClick={() => setResetting(false)}>Отмена</Button></section></div>}
 </div>;
}
render(<App/>, document.getElementById('app')!);

