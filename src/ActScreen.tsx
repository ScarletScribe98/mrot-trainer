import { useState } from 'preact/hooks';
import { actDisclaimer, actStamp, saveActPng, type ActData } from './act';
import { Button, Document, Icon, Stamp } from './ui/components';

export function ActScreen({ act, onBack }: { act: ActData; onBack: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  async function download() {
    setExporting(true);
    setExportError(false);
    try { await saveActPng(act); }
    catch { setExportError(true); }
    finally { setExporting(false); }
  }

  return <section class="act-screen" aria-labelledby="act-heading">
    <div class="act-toolbar">
      <Button type="button" variant="quiet" onClick={onBack}>Архив дел</Button>
      <div class="act-actions">
        <Button type="button" onClick={download} disabled={exporting}>
          {exporting ? 'Подготовка изображения…' : 'Сохранить как изображение'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => window.print()}>Распечатать</Button>
      </div>
    </div>
    {exportError && <p class="act-export-error" role="alert">Изображение сохранить не удалось. Повторите попытку или распечатайте акт.</p>}
    <Document class="act-paper">
      <header class="act-paper-head"><span>Учебный архив / Дело № {act.number}</span><time>{act.date}</time></header>
      <h1 id="act-heading">Акт проверки № {act.number}</h1>
      <p class="act-disclaimer">{actDisclaimer}</p>
      <dl class="act-details">{act.details.map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>

      <table class="act-table" aria-label="Результаты проверки работников" role="table">
        <thead role="rowgroup"><tr role="row">{act.columns.map((label, i) =>
          <th scope="col" role="columnheader" key={i}>{label}</th>)}</tr></thead>
        <tbody role="rowgroup">{act.rows.map(([name, ...amounts]) => <tr role="row" key={name}>
          <th scope="row" role="rowheader">{name}</th>
          {amounts.map((value, i) => <td role="cell" key={i}><span class="act-mobile-label" aria-hidden="true">{act.columns[i + 1]}</span>
            <span class="act-amount">{value}</span></td>)}
        </tr>)}</tbody>
      </table>

      <div class="act-total">
        <strong>{act.conclusion}</strong>
        <div><span>Общая недоплата</span><b class="act-amount">{act.total}</b></div>
      </div>
      <div class="act-closing">
        <dl class="act-summary" aria-label="Сводка игры">{act.summary.map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <Stamp>{actStamp}</Stamp>
      </div>
    </Document>
    <div class="act-return"><Button type="button" variant="quiet" onClick={onBack}>Вернуться в архив <Icon name="arrow"/></Button></div>
  </section>;
}
