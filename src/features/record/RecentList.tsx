import { useMemo } from 'react';
import { DASH, formatKmPerL } from '../../core/format';
import { deriveFillups } from '../../core/fuel';
import type { StoredFillup } from '../../core/types';

/** 記録タブ下部の直近3件。新しい順。タップで編集シートを開く。 */
export function RecentList({
  fillups,
  onSelect,
}: {
  fillups: readonly StoredFillup[];
  onSelect: (id: number) => void;
}) {
  const recent = useMemo(() => deriveFillups(fillups).slice(-3).reverse(), [fillups]);

  return (
    <div>
      <h2>直近の記録</h2>
      {recent.length === 0 ? (
        <p className="hint">まだ記録がありません。最初の給油を登録しましょう。</p>
      ) : (
        <ul className="recent-list">
          {recent.map((r) => (
            <li key={r.id}>
              <button type="button" className="recent-row" onClick={() => onSelect(r.id)}>
                <span className="recent-date">
                  {r.date}
                  {r.partial && <span className="badge">部分</span>}
                </span>
                <span className="recent-value">
                  {r.kmPerL === null ? DASH : `${formatKmPerL(r.kmPerL)} km/L`}
                </span>
                <span className="recent-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
