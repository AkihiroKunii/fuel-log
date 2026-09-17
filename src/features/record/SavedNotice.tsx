import { useEffect, useMemo, useRef } from 'react';
import { formatKm, formatKmPerL, formatLiters } from '../../core/format';
import { deriveFillups, diffKmPerL, previousKmPerL } from '../../core/fuel';
import type { StoredFillup } from '../../core/types';

/**
 * 保存直後にフォーム直下へ出す結果カード。保存した id の行を deriveFillups(全データ) から引く。
 * liveQuery が更新されて対象行が見つかるまでは何も出さない。
 */
export function SavedNotice({
  fillups,
  savedId,
}: {
  fillups: readonly StoredFillup[];
  savedId: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const derived = useMemo(() => deriveFillups(fillups), [fillups]);
  const row = derived.find((r) => r.id === savedId);

  useEffect(() => {
    if (row) rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [row?.id]);

  if (!row) return null;

  const prev = row.partial ? null : previousKmPerL(derived, row.id);
  const diff = prev !== null && row.kmPerL !== null ? diffKmPerL(row.kmPerL, prev) : null;
  const diffSymbol = diff === null ? '' : diff.dir === 'up' ? '▲' : diff.dir === 'down' ? '▼' : '±';
  const diffClass =
    diff === null ? '' : diff.dir === 'up' ? 'diff-good' : diff.dir === 'down' ? 'diff-bad' : 'diff-muted';

  return (
    <div className="card saved-notice" role="status" ref={rootRef}>
      <p className="saved-notice-title">保存しました</p>
      <p className="saved-notice-meta">
        {row.date} / {formatKm(row.tripKm)} km / {formatLiters(row.liters)} L
      </p>

      {row.partial ? (
        <p className="saved-notice-partial">部分給油のため、燃費は次の満タン給油で算出します</p>
      ) : (
        <p className="saved-notice-main">
          <span className="saved-notice-value">{formatKmPerL(row.kmPerL)} km/L</span>
        </p>
      )}

      {!row.partial && (
        <p className="saved-notice-diff">
          {prev === null ? (
            '最初の燃費記録です'
          ) : (
            <>
              前回 {formatKmPerL(prev)}{' '}
              <span className={diffClass}>
                {diffSymbol}
                {diff !== null && formatKmPerL(Math.abs(diff.diff))}
              </span>
            </>
          )}
        </p>
      )}

      {row.mergedPartials > 0 && <p className="saved-notice-merged">部分給油 {row.mergedPartials} 回分を合算</p>}
    </div>
  );
}
