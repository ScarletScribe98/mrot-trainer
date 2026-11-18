import { LevelArt, Portrait } from './ui/artwork';
import type { Progress } from './game';
import { Button, Document, Icon } from './ui/components';
export function Title({ onStart }: { onStart: () => void }) {
  return <section class="title-layout">
    <div class="title-copy">
      <div class="eyebrow brass"><span class="tiny-line"/>Учебный архив · Дело № 003</div>
      <h1>Инспектор<br/><em>труда.</em></h1>
      <p class="title-lead">Дело о минимальной зарплате</p>
      <p class="title-description">У каждой цифры есть основание.<br/>Изучите документы, проверьте расчёты<br class="desktop-break"/> и защитите право на оплату труда.</p>
      <Button onClick={onStart}>Начать дело<Icon name="arrow"/></Button>
      <div class="title-meta"><span>5 карточек</span><span>≈ 5 минут</span><span>Без спешки</span></div>
      <div class="title-footnote"><span>03 / 05</span><p>На вашем столе — пять судеб.<br/>Начните с одного точного решения.</p></div>
    </div>
    <div class="hero-art" role="img" aria-label="Раскрытое дело на сукне стола под светом зелёной лампы">
      <div class="film-case">
        <img class="film-case-art" src={`${import.meta.env.BASE_URL}assets/open-case.svg`} width="900" height="620" alt=""/>
        <div class="folio-cover"><span class="eyebrow">Отдел проверки<br/>заработной платы</span><div>ДЕЛО<br/><strong>003</strong></div><p>Личный состав<br/>Учебный архив</p></div>
        <div class="folio-page"><div class="eyebrow">Форма 03 / № 001</div><h2>Карточки<br/>работников</h2><div class="folio-profile"><Portrait index={0}/><p>Вера<br/>Соколова<small>Специалист<br/>по снабжению</small></p></div><div class="folio-lines"/><span class="eyebrow">К проверке · 5 документов</span></div>
      </div>
    </div>
  </section>;
}
const levelNames = ['Машина времени', 'Карта минимумов', 'Карточки работников', 'Аудит ведомости', 'Дело № 001'];
const levelDescriptions = [
  'Как менялась минимальная оплата труда', 'Как выбрать применимый минимум', 'Проверьте оплату пяти работников',
  'Найдите ошибку в чужом расчёте', 'Составьте итоговый акт проверки',
];
export function Levels({ progress, onStart, onStartAudit }: { progress: Progress; onStart: () => void; onStartAudit: () => void }) {
  const { audit, run } = progress;
  const audited = audit.cards.filter(card => card.answered).length;
  const auditStarted = audit.cards.some(card => card.step !== 'row' || card.attempts || card.hint);
  return <section class="levels-screen">
    <div class="eyebrow brass">Каталог практических дел</div>
    <div class="section-heading"><h1>Архив дел</h1><span class="catalog-count">02 / 05 ДОСТУПНО</span></div>
    <p class="intro">Проверьте карточки работников или найдите ошибку в готовом расчёте.</p>
    <div class="levels-grid">{levelNames.map((name, i) => {
      const open = i === 2 || i === 3;
      return <article class={'level-card' + (open ? ' level-card--open' : '')} key={name}>
        <div class="level-card-top"><span class="level-number">{String(i + 1).padStart(2, '0')}</span>
          <span class="eyebrow">{i === 4 ? 'Финальная проверка' : 'Уровень ' + (i + 1)}</span>{!open && <Icon name="lock" size={19}/>}</div>
        <div class="level-file-icon" aria-hidden="true"><LevelArt index={i}/></div>
        <h2>{name}</h2><p>{levelDescriptions[i]}</p>
        {i === 2 && <>
          <div class="level-open-meta"><span>5 карточек · ≈ 5 минут</span><span>{progress.completed.includes(3) ? 'ПРОЙДЕНО' : 'ДЕМО'}</span></div>
          <Button onClick={onStart}>{run.completed ? 'Результат проверки' : run.cards.some(c => c.attempts || c.answered) ? 'Продолжить проверку' : 'Открыть дело'}<Icon name="arrow"/></Button>
        </>}
        {i === 3 && <>
          <div class="level-open-meta"><span>5 листов · ≈ 4 минуты</span><span aria-label={'Проверено ' + audited + ' из 5 листов'}>{audited}/5</span></div>
          <Button onClick={onStartAudit}>{audit.completed ? 'Результат аудита' : auditStarted ? 'Продолжить аудит' : 'Открыть ведомость'}<Icon name="arrow"/></Button>
        </>}
        {!open && <span class="locked-note">Будет доступно позже</span>}
      </article>;
    })}</div>
    <div class="archive-note"><Icon name="info" size={20}/><p>Все работники, организации, регионы и суммы вымышлены.</p></div>
  </section>;
}
export function About({ onReset }: { onReset: () => void }) { return <section class="about-screen"><div class="eyebrow brass">Паспорт проекта / Этап 1</div><h1>Об игре и источники</h1><p class="intro">Учимся внимательно читать документы и проверять расчёты минимальной оплаты труда.</p><Document class="about-document"><span class="eyebrow">Важно перед началом</span><h2>Это учебный архив.</h2><p>Все данные демонстрационные. ФИО, организации и регионы вымышлены. Суммы и коэффициенты служат только для освоения механики и не являются реальными значениями МРОТ или региональных минимумов.</p><h3>Основание расчёта</h3><p>Применимый минимум = B × (k + s). B — большая из учебной и региональной баз. Недоплата — положительная разность между минимумом и зарплатой. Расчёты выполняются в целых копейках, временное округление — до копеек, половина вверх.</p><p class="todo-note">TODO(Эрика): реальные данные, правила применимости регионального минимума, округление, эталонные примеры и точные ссылки на методичку v5.</p><h3>Опыт и прогресс</h3><p>Первая попытка — +100. Исправление после первой ошибки с короткой обратной связью — +70. Открытая подсказка или разбор после повторной ошибки — +50. Три карточки или ведомости подряд без ошибок и подсказок — ещё +50. Прогресс и настройки сохраняются только в этом браузере.</p><p>Пороги званий: 0, 300, 800 и 1 500 очков. Правила опыта и пороги званий согласованы с Артёмом. Уровни 1, 2 и финал появятся позже; награда за всю игру пока недоступна.</p><h3>Материалы и авторство</h3><p>Основа — ТЗ «Инспектор труда», версия 1, и ТЗ этапа 0. Точные данные и ссылки из методички v5 ещё не добавлены: TODO(Эрика).</p><p>Шрифты Source Serif 4, Golos Text и IBM Plex Mono — SIL Open Font License 1.1. Они хранятся локально. Рисунки, иконки и бумажные фактуры созданы для проекта в CSS/SVG. Звуковые эффекты и тихий фоновый аккорд синтезируются через Web Audio. Чужие изображения в игре не используются.</p><h3>Лица учебного архива</h3><p>Шесть оригинальных вымышленных профилей. Портреты сгенерированы ИИ в манере дуотонной гравюры и не изображают реальных людей.</p><div class="portrait-catalog">{Array.from({ length: 6 }, (_, index) => <Portrait key={index} index={index}/>)}</div><h3>Без интернета</h3><p>После полной первой загрузки приложение сохраняется на устройстве. Дождитесь отметки «Архив доступен без интернета» внизу страницы. Музыка по умолчанию выключена.</p></Document><div class="reset-area"><div><h2>Начать с чистого листа</h2><p>Удалить сохранённый опыт и результаты на этом устройстве.</p></div><Button variant="secondary" onClick={onReset}>Начать заново</Button></div></section>; }
