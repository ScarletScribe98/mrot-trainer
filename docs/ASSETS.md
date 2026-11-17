# Ассеты «Зелёной лампы», этап 0.6.1

Созданы для проекта 17 ноября 2026 года. Кабинет, документы, штампы и иконки — оригинальные SVG/CSS этапа 0.6. В этапе 0.6.1 шесть SVG-портретов заменены растровыми изображениями, сгенерированными встроенным GPT Image. Фотографии и чужие картинки из интернета не использовались. Люди вымышлены. Шрифты остаются локальными OFL; см. CREDITS.md.

## Многослойный кабинет

| Файл | Содержание |
|---|---|
| `public/assets/scene-room.svg` | Шкаф с отдельными корешками папок, деревянные панели, окно и условный ночной город; статическое размытие дальнего плана |
| `public/assets/scene-desk.svg` | Стол в перспективе, зелёное сукно, волокна, прожилки и деревянная кромка |
| `public/assets/scene-lamp.svg` | Зелёный стеклянный абажур с бликами, внутренний свет, металл стойки, шарнир, основание, цепочка |
| `public/assets/scene-light.svg` | Тёплый конус, мягкие края и световое пятно на сукне |
| `public/assets/scene-props.svg` | Три группы предметов: перьевая ручка, штемпельная подушка, стопка папок |
| `public/assets/open-case.svg` | Раскрытое дело: тканевая обложка, корешок, крепления, несколько листов и загиб |
| `public/assets/paper-fibres.svg` | Тонкие бумажные волокна; накладываются на живой бланк и штамп |

Сцена расположена под общими экранами. Читаемые документы и плотная панель решения находятся выше всех слоёв. Текст и суммы не встраиваются в изображение. На титуле раскрытое дело также подписано живым HTML.

## Гравюрная пластина

`public/assets/archive.svg` содержит 13 декоративных символов и иконок. Шесть SVG-портретов, их определения, неиспользуемый символ старой фотокарточки и `scripts/refine-portraits.py` удалены. Базовый генератор больше не создаёт лица. Действующие портреты — `public/assets/portraits/portrait-1.webp` … `portrait-6.webp`; компонент `Portrait` подключает их на титуле, в карточках и каталоге «Об игре».

Иконки уровней: раскрытая книга, складная карта с условными контурами, стопка кадровых карточек, ведомость с карандашом, итоговый документ с отметкой. Применены тонкие двойные линии, тени штриховкой и мелкие детали без официальных гербов.

Штампы — три оригинальные фактурные рамки с маской потерь краски; надписи остаются HTML. Бумага получила волокна, загнутый край, тень скрепки и наклон папки 1°. Декоративное дело титула лежит в перспективе.

## Воспроизведение

```powershell
python scripts/create-archive-assets.py
python scripts/refine-level-icons.py
python scripts/create-office-scene.py
npm run build
node scripts/check-scene-budget.mjs
```

Эти команды воспроизводят детерминированную SVG-сцену. Растровые лица не создаются кодом: сделано 12 отдельных вызовов встроенного `image_gen`, по два на профиль. CLI/API, ключ и сторонний генератор не применялись. Точная ревизия модели инструментом не раскрывается; записываем её честно как «GPT Image, встроенный image_gen», без выдуманного номера.

Оригинальные варианты и входные `generation.json`, `selection.json`, `prompts.json` остались только в игнорируемой `work/portraits/`. Для повторной обработки этих локальных исходников: `python scripts/process-portraits.py` с Pillow 13.0.0 в `work/python-libs` либо в локальной среде Python. Генерация стохастическая; промт не гарантирует повторения идентичных пикселей. Отбракованные оригиналы не коммитятся. Лист 12 вариантов — `docs/screens/etap0_6_1/candidates.png`; выбранные шесть — `portraits.png` рядом.

Обработка едина для всех: кадрирование 4:5 через ImageOps.fit/LANCZOS, центр 0.5/0.45; 320×400 px; grayscale, autocontrast cutoff 0.5; дуотон #102d21 → #e6e7d8; WebP method=6, максимальное quality=92 с понижением до веса ≤30 000 байт. Геометрия лиц, глаза и пропорции не ретушировались. В листах сравнения используется тот же локальный Golos Text (OFL); подписи добавлены за пределами портретов и отсутствуют в WebP. Pillow — инструмент обработки, лицензия MIT-CMU; не включается в игру и npm-зависимости.

## Движение и бюджет

В `OfficeScene.tsx` мышь двигает только декорации, максимум 6,81 px для ближайшего слоя. Текст и игровые документы не участвуют в параллаксе. Анимируются только transform/opacity: свет и пыль. При reduced-motion движения отключены, смещения сбрасываются; при скрытии страницы анимации приостанавливаются. Доступ к датчикам наклона не требуется.

Бюджет проверяется рекурсивно по всем SVG/WebP/AVIF в `public/assets`, включая вложенную папку портретов. Результат и веса каждого файла — `docs/verification/etap0_6_1/scene-budget.json`. Дополнительно прибавляется весь скомпилированный JS/CSS приложения и service worker; даже эта консервативная сумма должна укладываться в 400 000 байт. Проверяется precache всех ресурсов; WebP добавлен в glob Workbox.

Старые варианты A/C и исходные снимки этапа 0.5 сохранены только в истории Git и исторических материалах.

## Растровые портреты: дата, модель, параметры и выбор

Дата каждого вызова: **2026-11-17**. Модель каждого: **GPT Image — встроенный image_gen; точная версия не раскрыта**. Настройка вызова: `transparent_background=false`, без входных картинок; формат 4:5 указан в промте. Параметры качества и размера генератор отдельно не предоставляет. Шестой профиль — второй оператор оборудования, согласован с Артёмом; новой карточки в механике нет.

| Файл | Профиль | Выбран вариант | Размер | WebP quality | Вес, байт |
|---|---|---|---|---|---|
| `public/assets/portraits/portrait-1.webp` | Вера Соколова — Специалист по снабжению | A | 320×400 | 83 | 29388 |
| `public/assets/portraits/portrait-2.webp` | Марк Лебедев — Оператор оборудования | B | 320×400 | 86 | 29654 |
| `public/assets/portraits/portrait-3.webp` | Алина Белова — Техник производства | A | 320×400 | 82 | 29916 |
| `public/assets/portraits/portrait-4.webp` | Роман Мельников — Кладовщик | A | 320×400 | 82 | 28732 |
| `public/assets/portraits/portrait-5.webp` | Нина Орлова — Диспетчер | B | 320×400 | 82 | 29350 |
| `public/assets/portraits/portrait-6.webp` | Второй оператор — Профиль фотокаталога | A | 320×400 | 85 | 29774 |

Полный промт каждого выбранного портрета, SHA-256 и параметры продублированы в `docs/verification/etap0_6_1/portraits.json`. Ниже точный общий префикс, затем точные суффиксы обеих генераций каждого профиля; полный промт = префикс + суффикс.

### Общий префикс

```text
Use case: stylized-concept. Production asset: one standalone raster portrait for an adult Russian educational archive game, part of a coherent six-person engraved portrait series. Vertical 4:5 canvas. Bust portrait, both shoulders fully within frame, head in natural three-quarter view, eye-level; full face visible, calm believable human expression, individual natural facial anatomy, subtle asymmetry. Fine traditional copperplate etching and drypoint crosshatching derived from realistic human observation, rich organic midtones and skin texture, no vector look, no flat geometric face or mask. Gentle side light from a desk lamp at upper left, readable eyes and facial planes, deep neutral bottle-green background fading into subtle paper grain. Strict two-ink palette: very deep bottle green #102d21 and creamy paper #e6e7d8, intermediate tones built by fine hatching. Restrained documentary dignity, ordinary working people, not fashion models or heroes. Same printmaking technique, engraving density, portrait scale and subdued studio backdrop across the whole series. No hands in crop. No text, letters, numbers, labels, nameplates, border, logos, signatures, watermark, hats, uniforms with badges, weapons, Soviet symbols, blood, famous people or recognizable real people. Draw precisely ONE person, no collage or contact sheet. 
```

### 1. Вера Соколова

Специалист по снабжению; выбран A.

Вариант A:

```text
Fictional woman aged about 38, procurement specialist Vera Sokolova. Long oval face, thoughtful warm eyes, slightly prominent cheekbones, dark hair loosely pinned back with a few natural wisps. Practical unbranded blouse and softly tailored work cardigan, small plain pencil visible in breast pocket. Quiet attentive half-smile, head turned slightly to viewer's right.
```

Вариант B:

```text
Fictional woman aged about 42, procurement specialist Vera Sokolova. Rounded-square face, gently curved nose, expressive medium eyes, dark shoulder-length hair neatly pulled back. Plain blouse with narrow collar and practical office cardigan, subtle plain pen clip at pocket. Reserved but friendly thoughtful expression, three-quarter head toward viewer's right.
```

### 2. Марк Лебедев

Оператор оборудования; выбран B.

Вариант A:

```text
Fictional man aged about 49, industrial equipment operator Mark Lebedev. Broad slightly weathered face, sturdy jaw, close-cropped graying hair, clean-shaven, faint smile lines and textured skin. Plain zip-front work jacket and a folded collar, unbranded small measuring-tool clip on breast pocket. Calm alert eyes, serious but approachable, head turned slightly toward viewer's left.
```

Вариант B:

```text
Fictional man aged about 44, equipment operator Mark Lebedev. Lean angular face with prominent nose, short slightly untidy dark hair and a hint of stubble, fine lines beside eyes. Practical unbranded industrial work jacket over a plain crewneck, a plain mechanical pencil in chest pocket. Relaxed confident expression, slight three-quarter turn toward viewer's left.
```

### 3. Алина Белова

Техник производства; выбран A.

Вариант A:

```text
Fictional woman aged about 29, production technician Alina Belova. Youthful broad oval face with freckles, short wavy hair tucked behind ears, slim plain round eyeglasses with clear eyes visible behind lenses. Practical unbranded technician's work coat with a small caliper clip at chest pocket. Focused curious expression, three-quarter head toward viewer's right.
```

Вариант B:

```text
Fictional woman aged about 32, production technician Alina Belova. Narrow heart-shaped face, small slightly upturned nose, gently arched eyebrows, dark curly hair gathered loosely at nape, no glasses. Plain unbranded technical work coat, a small caliper visible in chest pocket. Bright attentive eyes and faint candid smile, three-quarter toward viewer's right.
```

### 4. Роман Мельников

Кладовщик; выбран A.

Вариант A:

```text
Fictional man aged about 36, warehouse stock clerk Roman Melnikov. Round broad face, short curly hair, neatly trimmed full beard, warm slightly narrowed eyes and sturdy neck. Plain checked work shirt under unbranded rugged waistcoat, small plain ring of two keys clipped on vest. Open kind expression, three-quarter head toward viewer's left.
```

Вариант B:

```text
Fictional man aged about 41, warehouse stock clerk Roman Melnikov. Long face, high forehead, receding short hair and neatly trimmed moustache, expressive deep-set eyes. Plain unbranded heavy work waistcoat over rolled-collar shirt, one small plain metal key clipped to breast pocket. Calm wry half-smile, three-quarter head toward viewer's left.
```

### 5. Нина Орлова

Диспетчер; выбран B.

Вариант A:

```text
Fictional woman aged about 55, dispatcher Nina Orlova. Distinctive mature square-oval face, naturally hooded eyes, smile lines, silver-streaked chin-length bob. Plain blouse and knitted cardigan, simple thin wired single-ear dispatcher headset with one small microphone, no branding. Reassuring composed expression, three-quarter head toward viewer's right.
```

Вариант B:

```text
Fictional woman aged about 58, dispatcher Nina Orlova. Rounded face, prominent cheekbones, soft crow's feet and natural neck lines, silver short swept-back hair. Plain collared blouse and cardigan, simple unbranded thin wired single-ear telephone headset. Attentive slightly amused expression, three-quarter head toward viewer's right.
```

### 6. Второй оператор

Профиль фотокаталога; выбран A.

Вариант A:

```text
Fictional man aged about 63, a second anonymous industrial equipment operator, distinct from middle-aged Mark. Long weathered face with large nose, silver short swept hair, thin grey moustache, many gentle wrinkles, no glasses. Plain unbranded worn cotton work jacket, small plain steel ruler in breast pocket. Patient thoughtful expression, three-quarter head toward viewer's left.
```

Вариант B:

```text
Fictional man aged about 61, a second anonymous industrial equipment operator, distinct from middle-aged Mark. Broad weathered face, almost bald head with short grey hair at sides, clean-shaven, small deep-set kind eyes and pronounced wrinkles. Plain unbranded zip-front work jacket, small plain steel rule clipped to chest pocket. Quiet experienced expression, three-quarter head toward viewer's left.
```
