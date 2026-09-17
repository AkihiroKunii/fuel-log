import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useAppNav } from '../../app/nav';
import {
  DASH,
  formatKm,
  formatKmPerL,
  formatLiters,
  formatYen,
  formatYenPerL,
} from '../../core/format';
import { db } from '../../core/db';
import { deriveFillups } from '../../core/fuel';
import type { DerivedFillup } from '../../core/types';
import { SettingsPanel } from './SettingsPanel';
import './list.css';

// 一覧は最初に PAGE_SIZE 件だけ出し、ボタンで PAGE_SIZE 件ずつ増やす。
// データ管理(設定)は要件どおり一覧の最下部に置くため、件数が増えても辿り着けるようにする。
const PAGE_SIZE = 30;

export function ListTab() {
  const { openEditor, setTab } = useAppNav();
  const fillups = useLiveQuery(() => db.fillups.toArray(), []) ?? [];
  // deriveFillups は昇順を返すので、一覧は新しい順に反転する
  const rows = useMemo(() => deriveFillups(fillups).reverse(), [fillups]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const remaining = rows.length - visibleRows.length;

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
          <>
            <ul className="fillup-list">
              {visibleRows.map((row) => (
                <ListRow key={row.id} row={row} onSelect={openEditor} />
              ))}
            </ul>
            {remaining > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-block list-more"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                さらに {Math.min(PAGE_SIZE, remaining)} 件を表示（残り {remaining} 件）
              </button>
            )}
          </>
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
            {row.kmPerL === null ? (
              DASH
            ) : (
              <>
                {formatKmPerL(row.kmPerL)}
                <small>km/L</small>
              </>
            )}
          </span>
        </div>
        <div className="fillup-row-sub">{subParts.join(' ・ ')}</div>
      </button>
    </li>
  );
}
