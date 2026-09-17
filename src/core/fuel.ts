// 燃費の派生計算(CLAUDE.md §4.4 / 要件 §4)。すべて純粋関数で、引数の配列は破壊しない。
import { rangeStart } from './dates';
import { round1 } from './format';
import type {
  DateStr,
  DerivedFillup,
  FillupInput,
  PeriodStats,
  RangeKey,
  StoredFillup,
} from './types';

/** date 昇順 → 同日は id 昇順。非破壊(新しい配列を返す)。 */
export function sortFillups<T extends StoredFillup>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.id - b.id;
  });
}

/**
 * 全行に派生値(kmPerL / yenPerL / yenPerKm / mergedPartials)を付ける。
 * 入力順は問わず、戻り値は昇順。**必ず全データに対して呼び、期間フィルタはこの後にかける**
 * (期間外の部分給油も期間内の満タン行に合算されなければならないため。規則5)。
 */
export function deriveFillups(rows: readonly StoredFillup[]): DerivedFillup[] {
  const sorted = sortFillups(rows);
  const out: DerivedFillup[] = [];
  // 直前に連続する部分給油(満タン行が来るまで溜める)
  let chainKm = 0;
  let chainL = 0;
  let chainYen = 0;
  let chainYenMissing = false;
  let chainCount = 0;

  for (const row of sorted) {
    const yenPerL = row.yen === null || row.liters <= 0 ? null : row.yen / row.liters;

    if (row.partial) {
      // 規則1: 部分給油の行は燃費も円/km も出さない(次の満タン行に合算する)
      out.push({ ...row, kmPerL: null, yenPerL, yenPerKm: null, mergedPartials: 0 });
      chainKm += row.tripKm;
      chainL += row.liters;
      chainCount += 1;
      if (row.yen === null) chainYenMissing = true;
      else chainYen += row.yen;
      continue;
    }

    // 規則2: 満タン行は直前の連鎖を合算してから燃費を出す
    const totalKm = row.tripKm + chainKm;
    const totalL = row.liters + chainL;
    const kmPerL = totalL > 0 ? totalKm / totalL : null;
    // 規則3: 円/km も同じ合算。自分か連鎖のどれかの yen が null なら null
    const yenMissing = chainYenMissing || row.yen === null;
    const yenPerKm = yenMissing || totalKm <= 0 ? null : (chainYen + (row.yen ?? 0)) / totalKm;

    out.push({ ...row, kmPerL, yenPerL, yenPerKm, mergedPartials: chainCount });

    chainKm = 0;
    chainL = 0;
    chainYen = 0;
    chainYenMissing = false;
    chainCount = 0;
  }

  return out;
}

/** 規則6: rangeStart 以降(開始日を含む)の行。'all' は全件。非破壊。 */
export function filterByRange(
  derived: readonly DerivedFillup[],
  range: RangeKey,
  today: DateStr,
): DerivedFillup[] {
  const start = rangeStart(range, today);
  if (start === null) return [...derived];
  return derived.filter((r) => r.date >= start);
}

/** 規則7: 平均・最高・最低・count は kmPerL 非 null の行のみ。合計は期間内の全行。 */
export function periodStats(rowsInPeriod: readonly DerivedFillup[]): PeriodStats {
  let count = 0;
  let sumKmPerL = 0;
  let maxKmPerL: number | null = null;
  let minKmPerL: number | null = null;
  let totalKm = 0;
  let totalLiters = 0;
  let totalYen = 0;

  for (const r of rowsInPeriod) {
    totalKm += r.tripKm;
    totalLiters += r.liters;
    if (r.yen !== null) totalYen += r.yen;
    if (r.kmPerL === null) continue;
    count += 1;
    sumKmPerL += r.kmPerL;
    if (maxKmPerL === null || r.kmPerL > maxKmPerL) maxKmPerL = r.kmPerL;
    if (minKmPerL === null || r.kmPerL < minKmPerL) minKmPerL = r.kmPerL;
  }

  return {
    count,
    fillupCount: rowsInPeriod.length,
    avgKmPerL: count > 0 ? sumKmPerL / count : null,
    maxKmPerL,
    minKmPerL,
    totalKm,
    totalLiters,
    totalYen,
  };
}

/** 規則8: 昇順で id の行より前にある、kmPerL が非 null の最も近い行の値。無ければ null。 */
export function previousKmPerL(derived: readonly DerivedFillup[], id: number): number | null {
  const sorted = sortFillups(derived);
  const idx = sorted.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const v = sorted[i].kmPerL;
    if (v !== null) return v;
  }
  return null;
}

/** previewKmPerL が候補行に使う仮 id。既存 id と衝突しないよう最大 id + 1 にする。 */
function nextId(rows: readonly StoredFillup[]): number {
  let max = 0;
  for (const r of rows) if (r.id > max) max = r.id;
  return max + 1;
}

/**
 * 規則9: 既存データに候補行を仮に加えて(editingId があればその行を置き換えて)派生計算し、
 * 候補行の kmPerL を返す。新規の候補は同日の既存行より後ろに並ぶ(仮 id が最大のため)。
 * 候補が部分給油なら null。editingId の行が存在しない場合は新規として扱う。
 */
export function previewKmPerL(
  existing: readonly StoredFillup[],
  candidate: FillupInput,
  editingId?: number,
): number | null {
  const target = editingId !== undefined && existing.some((r) => r.id === editingId)
    ? editingId
    : nextId(existing);

  const rows: StoredFillup[] = existing
    .filter((r) => r.id !== target)
    .concat({
      id: target,
      date: candidate.date,
      tripKm: candidate.tripKm,
      liters: candidate.liters,
      yen: candidate.yen,
      partial: candidate.partial,
      createdAt: 0,
      updatedAt: 0,
    });

  const derived = deriveFillups(rows);
  return derived.find((r) => r.id === target)?.kmPerL ?? null;
}

/**
 * 規則10: **表示値どうしの差**(小数1桁に丸めた値の差)。画面の数字と矛盾させないため。
 * diff は符号付き(悪化なら負)。表示は formatKmPerL(Math.abs(diff)) に ▲/▼ を添える。
 */
export function diffKmPerL(
  current: number,
  previous: number,
): { diff: number; dir: 'up' | 'down' | 'same' } {
  const diff = round1(round1(current) - round1(previous));
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  return { diff, dir };
}
