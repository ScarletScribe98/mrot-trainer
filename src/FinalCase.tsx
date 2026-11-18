import { Fragment } from 'preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatAmount } from './calc';
import { baseLabels } from './calc/audit';
import { generateFinalSheet, type FinalCell, type FinalDraft, type FinalVerdict } from './calc/final';
import { submitFinal, type Progress } from './game';
import { effect } from './audio';
import { allowanceLabel, Button, Document, Folder, Icon, MethodNote, Money, PaymentLines, type MethodTopic } from './ui/components';

type Update = (change: (p: Progress) => Progress) => void;
const amountLabel = (value: string) => value.trim() || 'Сумма не указана';
const rubles = (cents: number) => formatAmount(cents) + ' ₽';
const verdictLabel = (value: FinalVerdict) => value === 'yes' ? 'Нарушение есть' : value === 'no' ? 'Нарушения нет' : 'Вывод не выбран';
const conclusionLabel = (value: FinalVerdict) => value === 'yes' ? 'Нарушения выявлены' : value === 'no' ? 'Нарушения не выявлены' : 'Вывод не выбран';

function Review({ title, entered, correct, children, topics = ['topup', 'key'] }: {
  title: string; entered: string; correct: string; children: ComponentChildren; topics?: readonly MethodTopic[];
}) {
  return <details class="final-review">
    <summary>{title}</summary>
    <p>{children}</p>
    <dl><div><dt>В ведомости</dt><dd>{entered}</dd></div><div><dt>Верно</dt><dd>{correct}</dd></div></dl>
    <MethodNote topics={topics}/>
  </details>;
}

interface FieldProps<T> {
  id: FinalCell; label: string; value: T; invalid: boolean; hint: string; onChange: (value: T) => void;
}
function Choice({ id, label, value, invalid, hint, onChange, summary }: FieldProps<FinalVerdict> & { summary?: boolean }) {
  return <div class={'final-field' + (invalid ? ' final-field--invalid' : '')}>
    <select id={'final-' + id} aria-label={label} aria-invalid={invalid || undefined}
      aria-describedby={invalid ? 'final-tip-' + id : undefined} value={value}
      onChange={e => onChange(e.currentTarget.value as FinalVerdict)}>
      <option value="">Выберите</option>
      <option value="yes">{summary ? 'Нарушения выявлены' : 'Есть'}</option>
      <option value="no">{summary ? 'Нарушения не выявлены' : 'Нет'}</option>
    </select>
    {invalid && <p class="final-tip" id={'final-tip-' + id}>{hint}</p>}
  </div>;
}

function SumField({ id, label, value, onChange, hint, invalid, disabled }: FieldProps<string> & { disabled?: boolean }) {
  return <div class={'final-field' + (invalid ? ' final-field--invalid' : '')}>
    <div class="final-money-input">
      <input id={'final-' + id} aria-label={label} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'final-tip-' + id : undefined}
        inputMode="decimal" autoComplete="off" maxLength={32} value={value} disabled={disabled}
        placeholder={disabled ? '—' : '0,00'} onInput={e => onChange(e.currentTarget.value)}/>
      {!disabled && !value.includes('₽') && <span aria-hidden="true">₽</span>}
    </div>
    {invalid && <p class="final-tip" id={'final-tip-' + id}>{hint}</p>}
  </div>;
}

export function FinalCase({ progress, update, onBack, onSigned }: {
  progress: Progress; update: Update; onBack: () => void; onSigned: () => void;
}) {
  const { final } = progress;
  const { draft, issues } = final;
  const sheet = generateFinalSheet(final.seed);
  const detailed = final.attempts >= 2;
  const [signing, setSigning] = useState(false);
  const timer = useRef(0);
  const signingGuard = useRef(false);
  const focusTarget = useRef<FinalCell | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (final.act && !signing) onSigned();
  }, [!!final.act, signing]);
  useLayoutEffect(() => {
    if (!focusTarget.current) return;
    const field = document.getElementById('final-' + focusTarget.current);
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'nearest' });
    focusTarget.current = undefined;
  }, [final.attempts]);

  function edit(draftChanges: (draft: FinalDraft) => Partial<FinalDraft>, cell?: FinalCell) {
    update(p => p.final.act ? p : {
      ...p, final: { ...p.final, draft: { ...p.final.draft, ...draftChanges(p.final.draft) },
        issues: cell ? p.final.issues.filter(issue => issue !== cell) : p.final.issues },
    });
  }
  function editRow(index: number, values: Partial<FinalDraft['rows'][number]>, cell: FinalCell) {
    edit(current => ({ rows: current.rows.map((row, i) => i === index ? { ...row, ...values } : row) }), cell);
  }
  function sign(event: Event) {
    event.preventDefault();
    if (signingGuard.current || final.act) return;
    const checked = submitFinal(progress);
    if (!checked.final.act) {
      focusTarget.current = checked.final.issues[0];
      effect('click', progress.sound);
      update(() => checked);
      return;
    }
    signingGuard.current = true;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) setSigning(true);
    update(() => checked);
    effect('stamp', progress.sound);
    if (reduced) onSigned();
    else timer.current = window.setTimeout(onSigned, 320);
  }

  const invalidBase = issues.includes('base');
  const invalidTotal = issues.includes('total');
  const invalidConclusion = issues.includes('conclusion');
  return <section class="game-screen final-screen">
    <div class="game-breadcrumb"><button onClick={onBack}>Архив дел</button><span>/</span><span>Финал</span>
      <span class="data-badge">Учебные данные</span></div>
    <div class="game-heading final-heading">
      <div><div class="eyebrow brass">Финальная проверка</div><h1>Дело № 001</h1></div>
      <p>Выберите общую базу, проверьте четыре строки ведомости и подпишите акт.</p>
    </div>
    <form onSubmit={sign} noValidate>
      <div class="document-stage final-stage">
        <Folder><Document class="final-paper">
          <div class="document-top"><span>Форма 05 / Расчётная ведомость</span><span>№ 001</span></div>
          <div class="final-organization">
            <div><h2>{sheet.organization}</h2><p>Учебный регион · {sheet.region}</p></div>
            <div><p>{sheet.period}</p><p>Районный коэффициент k <strong>{sheet.k.replace('.', ',')}</strong></p></div>
          </div>
          <fieldset class={'final-base' + (invalidBase ? ' final-field--invalid' : '')}>
            <legend>Общая база B для организации</legend>
            <div class="final-base-options">{(['federal', 'regional'] as const).map((source, i) =>
              <label class={draft.base === source ? 'final-base-selected' : ''} key={source}>
                <input type="radio" name="final-base" id={i === 0 ? 'final-base' : 'final-base-regional'}
                  checked={draft.base === source} aria-invalid={invalidBase || undefined}
                  aria-describedby={invalidBase ? 'final-tip-base' : undefined}
                  onChange={() => edit(() => ({ base: source }), 'base')}/>
                <span>{baseLabels[source]}</span><Money cents={sheet[source]}/>
              </label>)}</div>
            {invalidBase && <p class="final-tip" id="final-tip-base">Сравните МРОТ и региональный минимум. Проверьте выбор общей базы B.</p>}
            {invalidBase && detailed && <Review title="Разбор выбора базы" topics={['base']}
              entered={draft.base ? baseLabels[draft.base] + ' · ' + rubles(sheet[draft.base]) : 'База не выбрана'}
              correct={baseLabels[sheet.baseSource] + ' · ' + rubles(sheet.base)}>
              Выберите большую из двух сумм. От неё зависит минимум для каждого работника.
            </Review>}
          </fieldset>

          <table class="final-table" aria-label="Расчётная ведомость на четырёх работников" role="table">
            <thead role="rowgroup"><tr role="row">
              {['Работник', 'Доля ставки q', 'Надбавка s', 'Выплаты', 'Нарушение', 'Доплата'].map(label =>
                <th scope="col" role="columnheader" key={label}>{label}</th>)}
            </tr></thead>
            <tbody role="rowgroup">{sheet.rows.map((row, index) => {
              const answer = draft.rows[index];
              const verdictId = `row-${index}-verdict` as const;
              const amountId = `row-${index}-amount` as const;
              const invalidVerdict = issues.includes(verdictId);
              const invalidAmount = issues.includes(amountId) && answer.verdict === 'yes';
              return <Fragment key={row.name}>
                <tr class="final-worker" role="row">
                  <th scope="row" role="rowheader"><strong>{row.name}</strong><small>{row.position}</small></th>
                  <td class="final-rate" role="cell"><span class="final-mobile-label" aria-hidden="true">Доля ставки q</span><span>{row.q.replace('.', ',')}</span></td>
                  <td class="final-allowance" role="cell"><span class="final-mobile-label" aria-hidden="true">Надбавка s</span><span>{allowanceLabel(row.s)}</span></td>
                  <td class="final-payments" role="cell"><details class="payment-details">
                    <summary>Состав выплат</summary><PaymentLines payments={row.payments}/>
                  </details></td>
                  <td class="final-verdict-cell" role="cell"><span class="final-mobile-label" aria-hidden="true">Нарушение</span>
                    <Choice id={verdictId} label={'Нарушение · ' + row.name} value={answer.verdict} invalid={invalidVerdict}
                      hint="Сравните учитываемую зарплату W с B × q."
                      onChange={verdict => editRow(index, verdict === 'yes' ? { verdict } : { verdict, amount: '' }, verdictId)}/></td>
                  <td class="final-amount-cell" role="cell"><span class="final-mobile-label" aria-hidden="true">Доплата</span>
                    <SumField id={amountId} label={'Недоплата · ' + row.name} value={answer.amount} disabled={answer.verdict !== 'yes'}
                      invalid={invalidAmount} onChange={amount => editRow(index, { amount }, amountId)}
                      hint="Умножьте положительную разницу B × q − W на сумму k и s."/></td>
                </tr>
                {detailed && (invalidVerdict || invalidAmount) && <tr class="final-review-row" role="row">
                  <td colSpan={6} role="cell"><Review title={'Разбор строки · ' + row.name} topics={['wages', 'topup', 'key']}
                    entered={verdictLabel(answer.verdict) + (answer.verdict === 'yes' ? ' · ' + amountLabel(answer.amount) : '')}
                    correct={verdictLabel(row.violation ? 'yes' : 'no') + ' · ' + rubles(row.due)}>
                    Учтите оклад за ставку и премию. W = {rubles(row.w)}, q = {row.q.replace('.', ',')}. Доплата = max(0; B × q − W) × (k + s).
                  </Review></td>
                </tr>}
              </Fragment>;
            })}</tbody>
          </table>

          <fieldset class="final-totals">
            <legend>Итог по организации</legend>
            <div class="final-total-fields">
              <div><label for="final-total">Общая сумма недоплаты</label>
                <SumField id="total" label="Общая сумма недоплаты" value={draft.total} invalid={invalidTotal}
                  onChange={total => edit(() => ({ total }), 'total')} hint="Сложите недоплаты по всем строкам."/></div>
              <div><label for="final-conclusion">Общий вывод</label>
                <Choice id="conclusion" label="Общий вывод" value={draft.conclusion} invalid={invalidConclusion}
                  onChange={conclusion => edit(() => ({ conclusion }), 'conclusion')} hint="Сверьте общий вывод с итоговой суммой." summary/></div>
            </div>
            {detailed && (invalidTotal || invalidConclusion) && <Review title="Разбор итога"
              entered={amountLabel(draft.total) + ' · ' + conclusionLabel(draft.conclusion)}
              correct={rubles(sheet.total) + ' · ' + conclusionLabel(sheet.total > 0 ? 'yes' : 'no')}>
              Сложите недоплаты по всем работникам. Если сумма больше нуля, нарушения выявлены.
            </Review>}
          </fieldset>
        </Document></Folder>
      </div>
      <div class={'final-sign' + (signing ? ' final-sign--press' : '')}>
        <div class="final-name">
          <label for="final-reviewer">Имя проверяющего <small>(по желанию)</small></label>
          <input id="final-reviewer" type="text" autoComplete="off" maxLength={64} value={draft.name}
            aria-describedby="final-name-help" onInput={e => { const name = e.currentTarget.value; edit(() => ({ name })); }}/>
          <small id="final-name-help">Имя хранится только в этом браузере.</small>
        </div>
        <div class="final-sign-actions">
          <Button type="submit" class="final-sign-button" disabled={!!final.act}>
            {final.act ? 'Акт подписан' : 'Подписать акт'}<Icon name="check"/>
          </Button>
          {!final.hint && !detailed && !final.act && <button type="button" class="hint-button"
            onClick={() => update(p => p.final.act ? p : { ...p, final: { ...p.final, hint: true } })}>
            <Icon name="info" size={17}/>Нужна подсказка?<span>Зачёт +50</span>
          </button>}
        </div>
        <p role="status" class="final-submit-status">{invalidBase ? 'Проверьте общую базу.'
          : issues.length ? 'В ведомости есть ответы, которые нужно сверить.' : ''}</p>
        {final.hint && !final.act && <p class="final-help">Выберите базу. Для каждой строки сравните W с B × q. Положительную разницу умножьте на сумму k и s.</p>}
      </div>
    </form>
  </section>;
}
