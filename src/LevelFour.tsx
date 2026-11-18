import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatAllowance } from './calc/final';
import { baseLabels, generateAuditSheets, parseAuditAmount, type AuditAnswer, type AuditError, type AuditSheet } from './calc/audit';
import { advanceAudit, requestAuditHint, submitAudit, type AuditStep, type Progress } from './game';
import { effect } from './audio';
import { Asset, Portrait } from './ui/artwork';
import { Button, Document, Folder, Hint, Icon, MethodNote, Money, Stamp } from './ui/components';

const rowLabels = [
  'МРОТ (учебный)', 'Региональный минимум (учебный)', 'Принятая база B', 'Районный коэффициент k',
  'Процентная надбавка s', 'Применимый минимум', 'Начисленная зарплата', 'Недоплата', 'Вывод',
];
const sourceNotes: Record<number, string> = {
  1: 'Учебное значение МРОТ для этого дела.',
  2: 'Учебный минимум региона работника. Его сравнивают с МРОТ при выборе базы.',
  4: 'Коэффициент из исходных данных. В расчёте его складывают с долей надбавки.',
  5: 'Для расчёта процент нужно записать десятичной дробью, например 20 % = 0,20.',
  7: 'Начислено за полностью отработанный месяц.',
};
const stepTitles = {
  row: 'Найдите первую ошибку',
  explanation: 'Объясните ошибку',
  correction: 'Исправьте значение',
};

function verdictLabel(violation: boolean): string {
  return violation ? 'Нарушение есть' : 'Нарушения нет';
}

function Worksheet({ sheet, index, selected, canSelect, wrongSelection, detailed, onSelect, onNotes }: {
  sheet: AuditSheet; index: number; selected: number | null; canSelect: boolean; wrongSelection: boolean;
  detailed: boolean; onSelect: (row: number) => void; onNotes: () => void;
}) {
  const { task, shown } = sheet;
  const [viewed, setViewed] = useState<number | null>(null);
  const values = [
    <Money cents={task.federal}/>, <Money cents={task.regional}/>,
    <><Money cents={shown.base}/><small>{baseLabels[shown.source]}</small></>,
    task.k.replace('.', ','), formatAllowance(task.s),
    <Money cents={shown.minimum}/>, <Money cents={task.salary}/>, <Money cents={shown.due}/>,
    <span class="audit-verdict">{verdictLabel(shown.violation)}</span>,
  ];

  return <Folder><Document class="audit-sheet">
    <Asset name="clip" class="document-paperclip"/>
    <div class="document-top"><span>Форма 04 / Расчёт проверяющего</span><span>№ {String(index + 1).padStart(3, '0')}</span></div>
    <div class="worker-heading">
      <Portrait index={index}/>
      <div><h2>{task.name}</h2><p>{task.position}</p><span class="company">{task.company}</span>
        <span class="company">Учебный регион · {task.region}</span></div>
    </div>
    <h3>Расчёт предыдущего проверяющего</h3>
    {canSelect && <p class="audit-sheet-instruction">Отметьте первую неверную строку.</p>}
    <ol class="audit-rows">
      {rowLabels.map((label, i) => {
        const row = i + 1;
        const note = sourceNotes[row];
        return <li key={row}>
          <button type="button" data-row={row} class="audit-row" aria-expanded={note ? viewed === row : undefined}
            aria-pressed={note ? undefined : selected === row} disabled={!note && !canSelect}
            onClick={() => note ? setViewed(viewed === row ? null : row) : onSelect(row)}>
            <span class="audit-row-index" aria-hidden="true">{String(row).padStart(2, '0')}</span>
            <span class="audit-row-label">{label}{note && <small>Исходные данные</small>}</span>
            <span class="audit-row-value">{values[i]}</span>
          </button>
          {note && viewed === row && <p class="audit-source-note">{note}</p>}
          {wrongSelection && selected === row && <div class="audit-row-feedback">
            <p role="status">Проверьте расчёт по порядку, начиная с базы.</p>
            {detailed && <button type="button" onClick={onNotes}>Перейти к разбору <Icon name="arrow" size={17}/></button>}
          </div>}
        </li>;
      })}
    </ol>
  </Document></Folder>;
}

export function LevelFour({ progress, update, onBack, onReplay }: {
  progress: Progress; update: (p: Progress) => void; onBack: () => void; onReplay: () => void;
}) {
  const { audit } = progress;
  if (audit.completed) return <section class="result-screen">
    <h1>Аудит завершён</h1>
    <Document class="result-document">
      <Stamp>Проверка завершена</Stamp>
      <h2>Пять ведомостей проверены</h2>
      <p>Вы нашли первую ошибку в каждом расчёте, объяснили её и внесли исправление.</p>
      <p class="result-notice">{progress.completed.includes(3) ? 'Финальное дело доступно в архиве.' : 'Пройдите карточки работников, чтобы открыть финальное дело.'}</p>
      <div class="result-stats"><div><strong>5 / 5</strong><span>листов проверено</span></div>
        <div><strong>+{audit.earned}</strong><span>очков за прохождение</span></div></div>
    </Document>
    <div class="result-actions"><Button onClick={onReplay}>Новые ведомости<Icon name="arrow"/></Button>
      <Button variant="secondary" onClick={onBack}>Вернуться в архив</Button></div>
  </section>;
  return <AuditCase key={audit.index} progress={progress} update={update} onBack={onBack}/>;
}

function AuditFeedback({ sheet, step, detailed }: { sheet: AuditSheet; step: AuditStep; detailed: boolean }) {
  const shortHint = step === 'row' ? 'Сверьте базу, минимум и недоплату по порядку.'
    : step === 'explanation' ? 'Сопоставьте отмеченную строку с исходными данными и формулой.'
    : sheet.row === 3 ? 'Сравните суммы в первых двух строках.'
    : sheet.row === 6 ? 'Сложите k и долю надбавки s. Умножьте базу B на полученную сумму.'
    : 'Вычтите зарплату из применимого минимума. Если разность отрицательна, запишите ноль.';
  return <Hint detailed={detailed}>
    <p>{shortHint}</p>
    {detailed && <>
      <ol>
        <li>Сравните МРОТ и региональный минимум. Возьмите большую базу B.</li>
        <li>Посчитайте применимый минимум по формуле B × (k + s).</li>
        <li>Сверьте недоплату и вывод. Нарушение есть, если недоплата больше нуля.</li>
      </ol>
      <details class="audit-comparison">
        <summary>Сравнить расчёты</summary>
        <table><thead><tr><th scope="col">Строка</th><th scope="col">В листе</th><th scope="col">Верно</th></tr></thead>
          <tbody>{([3, 6, 8, 9] as const).map(row => {
            const compareValue = (calc: AuditSheet['shown']) => {
              if (row === 3) return <><Money cents={calc.base}/><small>{baseLabels[calc.source]}</small></>;
              if (row === 9) return verdictLabel(calc.violation);
              return <Money cents={row === 6 ? calc.minimum : calc.due}/>;
            };
            return <tr class={row === sheet.row ? 'audit-comparison-error' : ''} key={row}>
              <th scope="row">{rowLabels[row - 1]}{row === sheet.row && <small>Первая ошибка</small>}</th>
              <td>{compareValue(sheet.shown)}</td><td>{compareValue(sheet.correct)}</td>
            </tr>;
          })}</tbody>
        </table>
      </details>
      <MethodNote/>
    </>}
  </Hint>;
}

function AuditCase({ progress, update, onBack }: { progress: Progress; update: (p: Progress) => void; onBack: () => void }) {
  const { audit } = progress;
  const card = audit.cards[audit.index];
  const sheet = generateAuditSheets(audit.seed)[audit.index];
  const [selection, setSelection] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<AuditError | null>(null);
  const [correction, setCorrection] = useState('');
  const [validation, setValidation] = useState('');
  const notesHeading = useRef<HTMLHeadingElement>(null);
  const moveToNotes = useRef(false);
  const { step, answered } = card;

  function focusNotes() {
    notesHeading.current?.focus({ preventScroll: true });
    notesHeading.current?.scrollIntoView({ block: 'nearest' });
  }

  useLayoutEffect(() => {
    if (!moveToNotes.current) return;
    moveToNotes.current = false;
    focusNotes();
  }, [step, answered]);

  function answer(response: AuditAnswer) {
    const result = submitAudit(progress, sheet, response);
    moveToNotes.current = result.correct;
    setValidation(!result.correct && response.step !== 'row' ? 'Пока не сходится. Попробуйте ещё раз.' : '');
    effect(result.correct && response.step === 'correction' ? 'stamp' : 'click', progress.sound);
    update(result.progress);
  }

  function submitForm(event: Event) {
    event.preventDefault();
    if (step === 'explanation') {
      if (explanation) answer({ step, value: explanation });
      else setValidation('Выберите объяснение.');
    }
    if (step === 'correction') {
      if (sheet.row === 3 ? !!correction : parseAuditAmount(correction) !== null) answer({ step, value: correction });
      else setValidation(sheet.row === 3 ? 'Выберите правильную базу.' : 'Введите сумму в рублях с точностью до копейки.');
    }
  }

  function next() {
    effect('paper', progress.sound);
    update(advanceAudit(progress));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  return <section class="game-screen audit-screen">
    <div class="game-breadcrumb"><button onClick={onBack}>Архив дел</button><span>/</span><span>Уровень 4</span>
      <span class="demo-badge">Демонстрационные данные</span></div>
    <div class="section-heading game-heading">
      <div><div class="eyebrow brass">Дело № 004 · Проверка расчёта</div><h1>Аудит ведомости</h1></div>
      <div class="card-counter"><strong>{String(audit.index + 1).padStart(2, '0')}<span> / 05</span></strong><span>ЛИСТ В ДЕЛЕ</span></div>
    </div>
    <div class="case-progress" role="group" aria-label={'Проверено ' + audit.cards.filter(c => c.answered).length + ' из 5 листов'}>
      {audit.cards.map((c, i) => <span key={i} class={c.answered ? 'done' : audit.index === i ? 'current' : ''}/>)}
    </div>
    <div class="case-workspace">
      <div class="document-stage">
        <Worksheet sheet={sheet} index={audit.index} selected={step === 'row' ? selection : sheet.row}
          canSelect={step === 'row'} wrongSelection={step === 'row' && card.attempts > 0}
          detailed={card.attempts >= 2} onNotes={focusNotes} onSelect={row => { setSelection(row); answer({ step: 'row', value: row }); }}/>
      </div>
      <div class="inspection-panel audit-notes">
        <div class="panel-header"><span class="eyebrow brass">Пометки инспектора</span>
          {!answered && <span>Шаг {step === 'row' ? 1 : step === 'explanation' ? 2 : 3} из 3</span>}</div>
        <h2 ref={notesHeading} tabIndex={-1}>{answered ? 'Исправление принято' : stepTitles[step]}</h2>
        {step === 'row' && <p class="panel-intro">Выберите строку, в которой проверяющий впервые ошибся. Исходные данные можно открыть для просмотра.</p>}
        {step !== 'row' && <p class="audit-selection">Строка {sheet.row} · {rowLabels[sheet.row - 1]}</p>}
        {answered ? <div class="accepted">
          <Stamp>Ошибка найдена</Stamp>
          <p><strong>+{card.reward} очков опыта</strong>{card.reward === 150 && <span>Включая +50 за серию из трёх.</span>}</p>
          <Button type="button" onClick={next}>{audit.index === 4 ? 'Подвести итоги' : 'Следующий лист'}<Icon name="arrow"/></Button>
        </div> : <>
          {step !== 'row' && <form onSubmit={submitForm}>
            {step === 'explanation' && <fieldset class="audit-options">
              <legend>Почему значение неверно?</legend>
              {sheet.explanations.map(option => <label class={explanation === option.id ? 'selected' : ''} key={option.id}>
                <input type="radio" name="audit-explanation" value={option.id} checked={explanation === option.id}
                  onChange={() => { setExplanation(option.id); setValidation(''); }}/>{option.label}
              </label>)}
            </fieldset>}
            {step === 'correction' && (sheet.row === 3 ? <fieldset class="audit-options">
              <legend>Какую базу нужно взять?</legend>
              <label class={correction === 'federal' ? 'selected' : ''}><input type="radio" name="audit-base" value="federal" checked={correction === 'federal'} onChange={() => { setCorrection('federal'); setValidation(''); }}/>{baseLabels.federal}</label>
              <label class={correction === 'regional' ? 'selected' : ''}><input type="radio" name="audit-base" value="regional" checked={correction === 'regional'} onChange={() => { setCorrection('regional'); setValidation(''); }}/>{baseLabels.regional}</label>
            </fieldset> : <div class="amount-field">
              <label for="audit-amount">Правильная сумма</label>
              <div class="amount-control"><input id="audit-amount" inputMode="decimal" autoComplete="off" maxLength={32} placeholder="0,00"
                value={correction} aria-describedby="audit-amount-help"
                onInput={e => { setCorrection(e.currentTarget.value); setValidation(''); }}/><span aria-hidden="true">₽</span></div>
              <small id="audit-amount-help">В рублях, с точностью до копейки</small>
            </div>)}
            <Button type="submit" class="submit-answer">{step === 'explanation' ? 'Проверить объяснение' : 'Проверить исправление'}<Icon name="check" size={20}/></Button>
          </form>}
          <p class="validation" role="status">{validation}</p>
          {card.attempts < 2 && !card.hint && <button type="button" class="hint-button"
            onClick={() => update(requestAuditHint(progress))}><Icon name="info" size={17}/>Нужна подсказка?<span>Зачёт +50</span></button>}
          <div class="feedback" role="status">
            {(card.attempts > 0 || card.hint) && <AuditFeedback sheet={sheet} step={step} detailed={card.attempts >= 2}/>}
          </div>
          <div class="reward-note"><span>С первой попытки +100</span><span>Серия из трёх +50</span></div>
        </>}
      </div>
    </div>
  </section>;
}
