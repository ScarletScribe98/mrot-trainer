import { useState } from 'preact/hooks';
import { formatAmount } from './calc';
import { baseLabels, type BaseSource } from './calc/payroll';
import { assessRegion, checkBasis, checkMinimum, checkTopup, federal, reasonLabels, regionCases, REGION_COUNT,
  type RegionCase } from './data/real/study';
import { assignedRegions, attemptReward, countRegionalCases, gradeRegionalAttempt, newRegionalAttempt, regionalStepAttempts, requestRegionalKey,
  rewardLabel, submitRegional, type Progress, type RegionalAttempt } from './game';
import { allowanceLabel, Button, Document, Folder, Hint, Icon, MethodNote, Money, PaymentLines, Stamp } from './ui/components';
import { effect } from './audio';

type Props = { progress: Progress; update: (change: (p: Progress) => Progress) => void; onBack: () => void };
const topics = ['base', 'variants', 'key'] as const;
const displayDecimal = (value: string) => value.replace('.', ',');

function AmountField({ label, options, value, update }: {
  label: string; options?: number[]; value: string; update: (value: string) => void;
}) {
  return <label class="real-field"><span>{label}</span>
    {options?.length ? <select required value={value} onChange={event => update(event.currentTarget.value)}>
      <option value="">Выберите сумму</option>
      {[...options].sort((a, b) => a - b).map(amount =>
        <option key={amount} value={formatAmount(amount)}>{formatAmount(amount)} ₽</option>)}
    </select> : <input required inputMode="decimal" autoComplete="off" maxLength={32} placeholder="В рублях" value={value}
      onInput={event => update(event.currentTarget.value)}/>}
  </label>;
}

function RegionalFacts({ item }: { item: RegionCase }) {
  const { context } = item;
  return <Folder><Document class="region-paper">
    <div class="document-top"><span>Форма 02 / Дело работника</span><span>Октябрь 2026</span></div>
    <h2>{item.region}</h2>
    <p class="real-source">Условие из методички v5 · {item.source}</p>
    <div class="region-condition">{item.condition.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
    <dl class="region-facts">
      <div><dt>Федеральный МРОТ</dt><dd><Money cents={federal.cents}/></dd></div>
      <div><dt>Региональная МЗ</dt><dd>{item.agreement.regional === null ? (item.agreement.reason === 'no-regional'
        ? 'Отдельного размера нет' : 'Размер в методичке не приведён') : <Money cents={item.agreement.regional}/>}</dd></div>
      <div><dt>Доля ставки q</dt><dd>{displayDecimal(item.wages.q)}</dd></div>
    </dl>
    <details class="real-details"><summary>Состав выплат и W</summary>
      <PaymentLines payments={assessRegion(item).payroll}/>
      <p class="real-source">{item.wages.source}; п. 1.3</p>
    </details>
    <details class="real-details"><summary>О регионе · показатели 2025 года</summary>
      <dl class="region-context">
        <div><dt>МРОТ / средняя зарплата</dt><dd>{context.load}</dd></div>
        <div><dt>Федеральный МРОТ / ПМ региона</dt><dd>{context.relative}</dd></div>
        <div><dt>Наборов на МРОТ после НДФЛ</dt><dd>{context.baskets ?? 'В таблице не приведено'}</dd></div>
      </dl><p class="real-source">Методичка v5, {context.source}</p>
    </details>
  </Document></Folder>;
}

function RegionFeedback({ item, step, detailed, onKey }: {
  item: RegionCase; step: number; detailed: boolean; onKey: () => void;
}) {
  const { base, full, minimum, w, due, complies } = assessRegion(item);
  return <div role="status"><Hint detailed={detailed}>
    <p>{step === 0 ? 'Проверьте, есть ли более высокая региональная МЗ и распространяется ли соглашение на этого работодателя.'
      : step === 1 ? 'Проверьте условия для k и s отдельно. Для минимума на полную ставку используйте B × (k + s).'
        : 'Сравните W с B × q. Положительную разницу умножьте на сумму k и s, затем округлите доплату.'}</p>
    {detailed && <details class="real-details region-review">
      <summary onClick={event => {
        if (!event.currentTarget.closest('details')?.open) onKey();
      }}>Сверить расчёт по ключу</summary>
      {step === 0 && <p>{baseLabels[base.source]} · <Money cents={base.amount}/>. {reasonLabels[base.reason]}.</p>}
      {step === 1 && <p>k = {displayDecimal(item.factors.k)}, s — {allowanceLabel(item.factors.s)}. M = <Money cents={full}/>.</p>}
      {step === 2 && <p>{complies ? 'Минимум соблюдён.' : 'Минимум не соблюдён.'}
        {' '}M × q = <Money cents={minimum}/>, W = <Money cents={w}/>, доплата — <Money cents={due}/>.</p>}
      {item.id === 9 && step === 1 && <p>54 186,00 ₽ получается и при k = 1,7, и при s = 0,5. Проверьте применимость каждого значения отдельно (п. 5.2).</p>}
      <p class="real-source">Методичка v5, п. 5.1, табл. 12</p>
    </details>}
  </Hint></div>;
}

function RegionalQuestion({ item, attempt, onAnswer, onBack, onKey, practice }: {
  item: RegionCase; attempt: RegionalAttempt; onAnswer: (correct: boolean) => void; onBack: () => void;
  onKey: () => void; practice: boolean;
}) {
  const [basis, setBasis] = useState<BaseSource | ''>('');
  const [reason, setReason] = useState('');
  const [k, setK] = useState('');
  const [s, setS] = useState('');
  const [amount, setAmount] = useState('');
  const [verdict, setVerdict] = useState('');
  const { step } = attempt;
  const result = assessRegion(item);
  if (step === 3) return <div class="inspection-panel region-questions">
    <Stamp>Проверка завершена</Stamp><h2>{practice ? 'Практика завершена' : 'Дело зачтено'}</h2>
    <p>{result.complies ? 'Минимум соблюдён.' : <>Доплата · <Money cents={result.due}/></>}
      {!practice && <> · {rewardLabel(attemptReward({ ...attempt, hint: attempt.hint ?? false }))}</>}</p>
    <MethodNote topics={topics}/>
    <div class="region-action"><Button type="button" onClick={onBack}>К карте</Button></div>
  </div>;
  function submit(event: Event) {
    event.preventDefault();
    const correct = step === 0 ? checkBasis(item, basis, reason)
      : step === 1 ? checkMinimum(item, k, s, amount) : checkTopup(item, verdict, amount);
    onAnswer(correct);
  }
  return <div class="inspection-panel region-questions">
    <div class="real-task-head"><h2>{['Выберите базу B', 'Рассчитайте минимум M', 'Проверьте соблюдение минимума'][step]}</h2>
      <span>{step + 1} / 3</span></div>
    <form class="region-form" onSubmit={submit}>
      {step === 0 ? <>
        <label class="real-field"><span>База B</span><select required value={basis} onChange={e => setBasis(e.currentTarget.value as BaseSource | '')}>
          <option value="">Выберите базу</option><option value="federal">Федеральный МРОТ</option>
          <option value="regional">Региональная МЗ</option>
        </select></label>
        <label class="real-field"><span>Причина выбора</span><select required value={reason} onChange={e => setReason(e.currentTarget.value)}>
          <option value="">Выберите причину</option>{Object.entries(reasonLabels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select></label>
      </> : step === 1 ? <>
        <label class="real-field"><span>Районный коэффициент k</span>
          {item.mistakes?.coefficientText ? <select required value={k} onChange={e => setK(e.currentTarget.value)}>
            <option value="">Выберите применение</option><option value="1">К работе в Махачкале не применяется · k = 1</option>
            <option value="other">{item.mistakes.coefficientText}</option>
          </select> : item.mistakes?.k ? <select required value={k} onChange={e => setK(e.currentTarget.value)}>
            <option value="">Выберите коэффициент</option>{item.mistakes.k.map(value => <option key={value} value={value}>{displayDecimal(value)}</option>)}
          </select> : <input required inputMode="decimal" value={k} onInput={e => setK(e.currentTarget.value)} autoComplete="off"/>}
        </label>
        <label class="real-field"><span>Северная надбавка s (доля)</span>
          {item.mistakes?.s ? <select required value={s} onChange={e => setS(e.currentTarget.value)}>
            <option value="">Выберите надбавку</option>{item.mistakes.s.map(value => <option key={value} value={value}>{allowanceLabel(value)}</option>)}
          </select> : <input required inputMode="decimal" value={s} onInput={e => setS(e.currentTarget.value)} autoComplete="off"/>}
        </label>
        <AmountField label="Применимый минимум M"
          options={item.mistakes?.minimum?.length ? [result.full, ...item.mistakes.minimum] : undefined}
          value={amount} update={setAmount}/>
      </> : <>
        <label class="real-field"><span>Минимум соблюдён?</span><select required value={verdict} onChange={e => setVerdict(e.currentTarget.value)}>
          <option value="">Выберите вывод</option><option value="yes">Да</option><option value="no">Нет</option>
        </select></label>
        <AmountField label="Доплата по формуле (3)" value={amount} update={setAmount}/>
        <p>Укажите 0 ₽, если доплата не требуется.</p>
      </>}
      {attempt.wrong && <RegionFeedback item={item} step={step} detailed={regionalStepAttempts(attempt) >= 2} onKey={onKey}/>}
      <MethodNote topics={topics}/>
      <div class="region-action"><Button type="submit">Проверить <Icon name="check" size={18}/></Button></div>
    </form>
  </div>;
}

export function LevelTwo({ progress, update, onBack }: Props) {
  const map = progress.study.map;
  const assigned = assignedRegions(progress);
  const done = progress.completed.includes(2);
  const [selected, setSelected] = useState<number | null>(null);
  const [practice, setPractice] = useState(false);
  const [review, setReview] = useState(newRegionalAttempt);
  const completed = countRegionalCases(progress, assigned);
  function returnToMap() {
    setSelected(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function open(id: number) {
    setPractice(done);
    setReview(newRegionalAttempt());
    setSelected(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return <section class="game-screen real-screen map-screen">
    <div class="game-breadcrumb"><button type="button" onClick={onBack}>Архив дел</button><span>/</span><span>Уровень 2</span>
      <span class="data-badge">Методичка v5</span>
      {selected !== null && <button class="return-map" type="button" onClick={returnToMap}>К карте регионов</button>}</div>
    <div class="section-heading game-heading"><div><h1>Карта минимумов</h1></div></div>
    {selected === null ? <Folder><Document class="map-paper">
      <div class="real-task-head"><h2>Регионы сквозной задачи</h2><span>{completed} / {REGION_COUNT}</span></div>
      <p>{done ? 'Все десять дел доступны для практики.' : 'Выберите дело из активной пятёрки. Остальные откроются для практики после зачёта.'}</p>
      <p class="real-source">Октябрь 2026 · МРОТ <Money cents={federal.cents}/> · табл. 8, п. 4.2</p>
      {done && <Stamp>Региональный эксперт</Stamp>}
      <ul class="region-map" aria-label="Схема регионов">
        {regionCases.map(item => {
          const required = assigned.includes(item.id);
          const finished = map.cases[item.id - 1].step === 3;
          return <li key={item.id}><button class={required ? 'region-assigned' : ''} type="button"
            disabled={!done && !required} onClick={() => open(item.id)}>
            <span>{item.short}</span><small>{finished ? 'Проверено' : done ? 'Практика' : required ? 'К проверке' : 'После зачёта'}</small>
          </button></li>;
        })}
      </ul>
    </Document></Folder> : (() => {
      const item = regionCases[selected - 1];
      const attempt = practice ? review : map.cases[selected - 1];
      return <div class="region-case">
        <RegionalFacts item={item}/>
        <RegionalQuestion key={selected + '-' + attempt.step} item={item} attempt={attempt} practice={practice}
          onKey={() => {
            if (!practice) update(p => requestRegionalKey(p, selected, attempt.step));
          }}
          onBack={returnToMap} onAnswer={correct => {
            effect(correct ? 'stamp' : 'click', progress.sound);
            if (practice) setReview(state => gradeRegionalAttempt(state, correct));
            else update(p => submitRegional(p, selected, correct));
          }}/>
      </div>;
    })()}
  </section>;
}
