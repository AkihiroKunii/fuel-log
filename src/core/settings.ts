// 画面の設定(CLAUDE.md §4.9)。今のところ localStorage の表示範囲だけ。
// Dexie の settings テーブルは将来用で、ここからは書かない。
import type { RangeKey } from './types';

export const RANGE_STORAGE_KEY = 'fuel-log:range';
export const DEFAULT_RANGE: RangeKey = 'all';

/** セグメント表示の選択肢(順序もこのまま使う)。 */
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '1m', label: '1か月' },
  { value: '6m', label: '半年' },
  { value: '1y', label: '1年' },
  { value: 'all', label: '全期間' },
];

/** localStorage の必要な部分だけ。テストでは任意の実装を注入できる。 */
export type RangeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isRangeKey(v: unknown): v is RangeKey {
  return v === '1m' || v === '6m' || v === '1y' || v === 'all';
}

/** 既定の保存先。localStorage が無い/参照が例外を投げる環境(プライベートモード等)では null。 */
function defaultStorage(): RangeStorage | null {
  try {
    const s = (globalThis as { localStorage?: RangeStorage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/** 保存された表示範囲。読めない・不正値のときは既定値('all')。 */
export function loadRange(storage: RangeStorage | null = defaultStorage()): RangeKey {
  try {
    const raw = storage?.getItem(RANGE_STORAGE_KEY);
    return isRangeKey(raw) ? raw : DEFAULT_RANGE;
  } catch {
    return DEFAULT_RANGE;
  }
}

/** 表示範囲を保存する。書けない環境でも落ちない。 */
export function saveRange(range: RangeKey, storage: RangeStorage | null = defaultStorage()): void {
  try {
    storage?.setItem(RANGE_STORAGE_KEY, range);
  } catch {
    // 保存できなくても動作は続ける(容量超過・プライベートモード等)
  }
}
