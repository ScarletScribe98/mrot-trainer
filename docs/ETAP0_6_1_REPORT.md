# Этап 0.6.1: растровые портреты

Дата: 17 ноября 2026, Europe/Moscow. Проект: `C:\Projects\mrot-trainer`.
Основание: `docs/TZ_Codex_etap0_6_1_portrety.md`; шестой профиль согласован Артёмом: второй оператор оборудования, без новой игровой карточки.

## Выполнение по пунктам ТЗ

| № | Требование | Результат |
|---|---|---|
| 1 | Шесть растровых портретов | Выполнены встроенным GPT Image: 12 отдельных генераций, два варианта каждого из шести профилей. SVG-заменителей нет. |
| 2 | Единая серия, живые лица, профессии | Офорт/гравюра, тонкая штриховка, погрудный ракурс 3/4, боковой свет, тёмный фон. Разные возраст, волосы, форма лица и характер. Вера — блуза/кардиган и карандаш; Марк — рабочая куртка; Алина — очки и измерительный инструмент; Роман — жилет, клетчатая рубашка, ключи; Нина — гарнитура; второй оператор — возрастное лицо, рабочая куртка и линейка. |
| 3 | Вымышленные люди, без запрещённых элементов | Визуально проверены 12 кандидатов и шесть итоговых WebP. Не обнаружены явные артефакты глаз, лишние части тела, надписи, логотипы или узнаваемые публичные лица. Руки не входят в кадр. Шляп, крови, советской символики нет. Подписи листов сравнения добавлены вне изображений. |
| 4 | По два варианта и отбор | Сначала получены все 12 вариантов. Выбраны A/B/A/A/B/A для Веры, Марка, Алины, Романа, Нины, второго оператора. Все шесть сведены к одинаковой палитре. Оригиналы кандидатов находятся только в игнорируемой work/portraits/candidates; отбракованные оригиналы не коммитились. Лист всех 12 входит в отчётные скриншоты по ТЗ. |
| 5 | WebP, размер, замена SVG, PWA | Шесть файлов 320×400, каждый ≤30 000 байт. Самая крупная рамка каталога 147×195: разрешение обеспечивает 2×; игровые рамки меньше. Единый компонент подключает изображения на титуле, в пяти карточках и каталоге «Об игре». Шесть SVG, их символы/определения и прежний генератор удалены. WebP входит в precache; проверены декодирование шести изображений и игра без сети. |
| 6 | Происхождение | docs/ASSETS.md: точные общий промт и 12 суффиксов, выбор по профилям, модель, дата, обработка. CREDITS.md: AI-generated assets. Полные промты выбранных шести и SHA-256 — verification/etap0_6_1/portraits.json. |

## Отбор и обработка

Вера A — более открытое выражение и ясный боковой свет. Марк B — живой взгляд и характерная рабочая куртка. Алина A — очки отделяют её от Веры, профессия читается по инструменту. Роман A — борода, ключи и жилет, отличается от обоих операторов. Нина B — седые волосы, возраст и гарнитура, не повторяет Веру. Второй оператор A — старшее лицо с усами, заметно отличается от Марка; более выразительная штриховка, чем у B. Все шесть имеют одинаковый масштаб головы и плеч, нейтральный фон и направление света.

Модель: **GPT Image, встроенный image_gen**. Точный номер ревизии инструмент не раскрывает. CLI/API и ключи не использовались. Дата каждого вызова — 2026-11-17. Полученные PNG 1122×1402 приведены к 4:5: ImageOps.fit/LANCZOS, центр 0.5/0.45, 320×400; grayscale/autocontrast cutoff 0.5; дуотон #102d21 → #e6e7d8. WebP method 6, quality индивидуально подбирается от 92 вниз до ≤30 000 байт. Ретуши анатомии и дорисовки кодом нет. Скрипт обработки — scripts/process-portraits.py.

## Ассеты и вес каждого портрета

| Файл в public/assets/portraits | Профиль | Размер | WebP quality | Вес, байт | Вес, КБ (1000 байт) |
|---|---|---|---|---|---|
| portrait-1.webp | Вера Соколова | 320×400 | 83 | 29388 | 29.388 |
| portrait-2.webp | Марк Лебедев | 320×400 | 86 | 29654 | 29.654 |
| portrait-3.webp | Алина Белова | 320×400 | 82 | 29916 | 29.916 |
| portrait-4.webp | Роман Мельников | 320×400 | 82 | 28732 | 28.732 |
| portrait-5.webp | Нина Орлова | 320×400 | 82 | 29350 | 29.350 |
| portrait-6.webp | Второй оператор | 320×400 | 85 | 29774 | 29.774 |

Всего портреты: **176814 байт**.
Все SVG/WebP сцены с портретами, включая неиспользуемые отдельные дубликаты декораций: **266617 байт**.
Консервативно, вместе со всем JS/CSS приложения и service worker: **383151 байт**, лимит **400 000 байт** соблюдён.

Precache: **32 записи, 441.19 KiB**. Его полный вес также включает локальные шрифты, иконки PWA и HTML; это шире бюджета графической сцены. Все ресурсы сцены и шесть WebP присутствуют в сгенерированном sw.js; рекурсивная проверка не пропускает вложенную папку portraits. Веса всех ресурсов — [scene-budget.json](verification/etap0_6_1/scene-budget.json).

## Лицензии и шрифты

Новые игровые ассеты — только шесть перечисленных AI-generated WebP. Сторонние исходные фотографии, картинки и логотипы не использовались; лицензия OFL на эти изображения не заявляется. Происхождение записано в CREDITS.md. Сцена, иконки и бумага остаются оригинальными SVG/CSS проекта.

Новых шрифтов нет. Source Serif 4, Golos Text, IBM Plex Mono — прежние локальные SIL OFL 1.1, файлы и лицензии не менялись. Листы сравнения подписаны тем же локальным Golos Text. Pillow 13.0.0 — локальный инструмент обработки с лицензией MIT-CMU, не включён в игру и npm-зависимости; фактический LICENSE проверен в work/python-libs/pillow-13.0.0.dist-info/licenses/LICENSE.

## Проверки

- npm test: **21/21**, два файла. Расчётное ядро и модульные тесты не изменены.
- npm run test:browser: **14/14** в Microsoft Edge, 24.3 s: 11 прежних проверок и три проверки растровой серии.
- npm run build: **успешно**, TypeScript и production Vite/PWA.
- Проверены механика пяти карточек, XP 70/50, чистое прохождение 550 XP, подсказки, разбор, сохранение, сброс, ввод копеек, повреждённое хранилище, отсутствие внешних запросов и ошибок браузера, оба разрешения, крупные шрифты и отсутствие горизонтального переполнения.
- Офлайн: все шесть WebP декодируются после перезапуска без сети; пять карточек и итог проходят. Кеш включает все новые пути.
- Reduced-motion и параллакс проверены прежним тестом: при reduced-motion сцена статична; документы не двигаются; смещение декораций ≤6.81 px, анимации только transform/opacity.
- Скриншоты и листы визуально просмотрены. Обе темы A/C по-прежнему отсутствуют. Размеры шрифтов, компоновка и сцена принятого этапа 0.6 сохранены.

Lighthouse mobile, 360×740, встроенное мобильное замедление, production preview:

| Экран | Performance | Accessibility |
|---|---|---|
| Титул | 99 | 100 |
| Выбор уровня | 99 | 100 |
| Уровень 3 | 99 | 100 |

Пороги 85/90 выполнены на всех трёх экранах. Это автоматическая проверка, дополненная просмотром интерфейса; оценка 100 сама по себе не заменяет пользовательскую проверку доступности. HTML/JSON Lighthouse и scores — в docs/verification/etap0_6_1.

## Вывод тестов и сборки

### npm test

```text
> inspektor-truda@0.1.0 test
> vitest run


 RUN  v4.1.12 C:/Projects/mrot-trainer


 Test Files  2 passed (2)
      Tests  21 passed (21)
   Start at  22:06:12
   Duration  190ms (transform 55ms, setup 0ms, import 74ms, tests 31ms, environment 0ms)
```

### npm run build

```text
> inspektor-truda@0.1.0 build
> tsc --noEmit && vite build

vite v7.3.8 building client environment for production...
transforming...
✓ 23 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js               0.14 kB
dist/manifest.webmanifest        0.53 kB
dist/index.html                  0.87 kB │ gzip:  0.55 kB
dist/assets/index-C3ghksy_.css  49.01 kB │ gzip: 11.00 kB
dist/assets/index-DVs_L5bK.js   49.53 kB │ gzip: 18.05 kB
✓ built in 196ms

PWA v1.3.0
mode      generateSW
precache  32 entries (441.19 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

### npm run test:browser

```text
> inspektor-truda@0.1.0 test:browser
> playwright test

[WebServer] (node:38224) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 14 tests using 1 worker

(node:41072) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ok  1 tests\portraits.spec.ts:4:2 › Растровая серия: титул и карточка 1920 (2.1s)
  ok  2 tests\portraits.spec.ts:4:2 › Растровая серия: титул и карточка 360 (530ms)
  ok  3 tests\portraits.spec.ts:26:1 › Шесть WebP-портретов: декодирование, разрешение 2x и офлайн-каталог (381ms)
  ok  4 tests\scene.spec.ts:40:73 › Кабинет: пять состояний и прохождение 1920 (3.9s)
  ok  5 tests\scene.spec.ts:40:73 › Кабинет: пять состояний и прохождение 360 (2.3s)
  ok  6 tests\scene.spec.ts:68:1 › Единственное оформление: старые параметры не выбирают темы (426ms)
  ok  7 tests\scene.spec.ts:82:1 › Офлайн: новые слои в кеше, пять карточек и результат после перезапуска (1.1s)
  ok  8 tests\scene.spec.ts:95:1 › Движение: максимум 6,81 px, документы неподвижны; reduced-motion статичен (676ms)
  ok  9 tests\trainer.spec.ts:34:2 › Пять карточек, подсказки, сохранение, снимки 1920 (5.1s)
  ok 10 tests\trainer.spec.ts:34:2 › Пять карточек, подсказки, сохранение, снимки 360 (2.6s)
  ok 11 tests\trainer.spec.ts:76:1 › Чистое прохождение: 550 опыта, звук, музыка и сброс (1.2s)
  ok 12 tests\trainer.spec.ts:88:1 › PWA: холодное открытие без сети и прохождение пяти карточек (1.2s)
  ok 13 tests\trainer.spec.ts:100:1 › Повреждённое и недоступное хранилище (333ms)
  ok 14 tests\trainer.spec.ts:109:1 › Ввод не округляет ответ молча; самостоятельное исправление даёт 70 (437ms)

  14 passed (24.3s)
```

### npm run audit

```text
> inspektor-truda@0.1.0 audit
> node scripts/audit.mjs

title: Performance 99, Accessibility 100
[]
levels: Performance 99, Accessibility 100
[]
level3: Performance 99, Accessibility 100
[]
```

### node scripts/check-scene-budget.mjs

```text
All scene/portrait SVG and WebP assets, including standalone duplicates: 266617 bytes (260.4 KiB), gzip 185.3 KiB; limit 400000 bytes
SVG/WebP plus all compiled app/service-worker JS and CSS: 383151 bytes (374.2 KiB)
All scene assets are present in the generated PWA precache
```

## Скриншоты и листы

Папка: `C:\Projects\mrot-trainer\docs\screens\etap0_6_1\`.
`portraits.png` — шесть выбранных рядом. `candidates.png` — 12 вариантов, верхний ряд A, нижний B; выбранные обведены и подписаны. Листы используют единый дуотон. Титул и уровень 3 представлены точными окнами 1920×1080 и 360×740, а также полными страницами (-full): на мобильном титуле раскрытое дело находится ниже первого окна, как в принятой компоновке.

| Файл | Пиксели | Вес, байт |
|---|---|---|
| [01-title-1920x1080-full.png](screens/etap0_6_1/01-title-1920x1080-full.png) | 1920×1080 | 1173636 |
| [01-title-1920x1080.png](screens/etap0_6_1/01-title-1920x1080.png) | 1920×1080 | 1173636 |
| [01-title-360x740-full.png](screens/etap0_6_1/01-title-360x740-full.png) | 360×1091 | 251970 |
| [01-title-360x740.png](screens/etap0_6_1/01-title-360x740.png) | 360×740 | 199304 |
| [02-level3-1920x1080-full.png](screens/etap0_6_1/02-level3-1920x1080-full.png) | 1920×1229 | 898347 |
| [02-level3-1920x1080.png](screens/etap0_6_1/02-level3-1920x1080.png) | 1920×1080 | 871794 |
| [02-level3-360x740-full.png](screens/etap0_6_1/02-level3-360x740-full.png) | 360×2054 | 322699 |
| [02-level3-360x740.png](screens/etap0_6_1/02-level3-360x740.png) | 360×740 | 187802 |
| [candidates.png](screens/etap0_6_1/candidates.png) | 1584×804 | 1550222 |
| [portraits.png](screens/etap0_6_1/portraits.png) | 1584×414 | 820962 |

Машиночитаемые инвентари: verification/etap0_6_1/screens.json и portraits.json. Принятые скриншоты предыдущих этапов не перезаписаны; дополнительные регрессионные снимки теперь сохраняются в work/etap0_6_1-regression-screens.

## Границы изменений

src/calc, src/game.ts, src/game.test.ts, src/LevelThree.tsx, public/fonts и package-lock.json не изменены относительно 5a7181a. Новых игровых карточек и реальных нормативных сумм нет. TODO(Эрика) сохранены. Ничего не пушилось и не публиковалось.

## Локальные коммиты / git log --oneline

Первые два коммита: генерация/ассеты; подключение и удаление SVG. Завершающий третий коммит содержит тесты, скриншоты и этот отчёт. Ниже точный снимок git log перед его созданием; его собственный хеш будет выведен в ответе. Полный итоговый git log сохраняется после коммита в игнорируемый work/portraits/git-log-final.txt, чтобы отчёт не пытался включить собственный будущий хеш.

```text
09dfa6b feat(portraits): replace SVG faces and precache WebP across the archive
3ccb0b1 feat(assets): generate coherent six-person raster engraving series
5a7181a test(scene): capture five states before-after and verify offline motion and Lighthouse
191505f perf(scene): enforce SVG budget precache coverage and compositor-only animation
8b1c8a3 style(readability): isolate questions and figures on dense AA reading surfaces
1ad0f3e feat(icons): engrave book map personnel cards ledger and final act
b0e85d3 feat(portraits): engrave six fictional profiles with side light and work details
c11c88f style(documents): add paper fibres folded edge and grounded case shadows
1f5f7cc feat(title): stage film opening with open case and start-case action
279e286 feat(scene): compose layered night office green glass lamp and desk lighting
8012851 refactor(theme): retain Green Lamp only and remove A C switching
88d984a test(themes): capture comparisons and verify offline projector contrast and Lighthouse
d872da9 fix(stage0): separate accepted verdict and record approved XP and rank thresholds
f401795 style(projector): enlarge service text field labels amounts and formula
137501e feat(motion): animate card turns ink impressions and inserted explanation sheets
6856533 feat(assets): draw original archive scene six portraits and engraved SVG props
4f12cb7 feat(themes): add Graphite Green Lamp and Noir palettes with live switching
3db75c4 docs: record stage 0 acceptance licenses and Erika follow-ups
4fc76f7 test: verify demo offline persistence accessibility and both viewport sizes
3d1aa1a feat(game): deliver five worker cards with hints XP and saved progress
7b55c15 feat(ui): create dark archive design system with local OFL fonts
dee80b0 feat(calc): add exact kopeck calculations and seeded demo tasks
14f8c7c build: scaffold strict Preact Vite app and offline Pages workflow
a3941bf docs: preserve supplied stage 0 specifications and visual references
```
