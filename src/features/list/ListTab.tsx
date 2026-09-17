import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { useAppNav } from '../../app/App';
import { DASH, formatKm, formatKmPerL, formatLiters, formatYen, formatYenPerL } from '../../core/format';
import { db } from '../../core/db';
import { deriveFillups } from '../../core/fuel';
import type { DerivedFillup } from '../../core/types';
import { SettingsPanel } from './SettingsPanel';
import './list.css';

export function ListTab() {
  const { openEditor, setTab } = useAppNav();
  const fillups = useLiveQuery(() => db.fillups.toArray(), []) ?? [];
  // deriveFillups は昇順を返すので、一覧は新しい順に反転する
  const rows = useMemo(() => deriveFillups(fillups).reverse(), [fillups]);

  return (
    <div>
      <div className="list-header">
        <h1>一覧</h1>
        <span className="list-count">全 {rows.length} 件</span>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">
            <p>まだ記録がありません</p>
            <button type="button" className="btn btn-primary" onClick={() => setTab('record')}>
              記録する
            </button>
          </div>
        ) : (
          <ul className="fillup-list">
            {rows.map((row) => (
              <ListRow key={row.id} row={row} onSelect={openEditor} />
            ))}
          </ul>
        )}
      </div>

      <SettingsPanel fillups={fillups} />
    </div>
  );
}

function ListRow({ row, onSelect }: { row: DerivedFillup; onSelect: (id: number) => void }) {
  const subParts = [`${formatKm(row.tripKm)} km`, `${formatLiters(row.liters)} L`];
  if (row.yen !== null) {
    subParts.push(`${formatYen(row.yen)}円（${formatYenPerL(row.yenPerL)} 円/L）`);
  }
  if (row.mergedPartials > 0) {
    subParts.push(`＋部分給油 ${row.mergedPartials} 回分`);
  }

  return (
    <li>
      <button type="button" className="fillup-row" onClick={() => onSelect(row.id)}>
        <div className="fillup-row-top">
          <span className="fillup-row-date">
            {row.date}
            {row.partial && <span className="badge">部分</span>}
          </span>
          <span className="fillup-row-kmpl">
            {row.kmPerL === null ? DASH : `${formatKmPerL(row.kmPerL)} km/L`}
          </span>
        </div>
        <div className="fillup-row-sub">{subParts.join(' ・ ')}</div>
      </button>
    </li>
  );
}
