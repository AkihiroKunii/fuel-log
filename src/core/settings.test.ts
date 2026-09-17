import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANGE,
  RANGE_OPTIONS,
  RANGE_STORAGE_KEY,
  isRangeKey,
  loadRange,
  saveRange,
  type RangeStorage,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}): RangeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const throwingStorage: RangeStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('RANGE_OPTIONS', () => {
  it('1か月 / 半年 / 1年 / 全期間 の4つ', () => {
    expect(RANGE_OPTIONS).toEqual([
      { value: '1m', label: '1か月' },
      { value: '6m', label: '半年' },
      { value: '1y', label: '1年' },
      { value: 'all', label: '全期間' },
    ]);
  });
});

describe('isRangeKey', () => {
  it('4つのキーだけ true', () => {
    expect(['1m', '6m', '1y', 'all'].every(isRangeKey)).toBe(true);
    expect(isRangeKey('2y')).toBe(false);
    expect(isRangeKey(null)).toBe(false);
    expect(isRangeKey(undefined)).toBe(false);
    expect(isRangeKey(1)).toBe(false);
  });
});

describe('loadRange / saveRange', () => {
  it('既定は全期間', () => {
    expect(DEFAULT_RANGE).toBe('all');
    expect(loadRange(memoryStorage())).toBe('all');
  });

  it('保存 → 読込 で残る', () => {
    const storage = memoryStorage();
    saveRange('6m', storage);

    expect(storage.data[RANGE_STORAGE_KEY]).toBe('6m');
    expect(loadRange(storage)).toBe('6m');
  });

  it('不正値が入っていれば既定値', () => {
    expect(loadRange(memoryStorage({ [RANGE_STORAGE_KEY]: '3m' }))).toBe('all');
    expect(loadRange(memoryStorage({ [RANGE_STORAGE_KEY]: '' }))).toBe('all');
  });

  it('storage が例外を投げても落ちない', () => {
    expect(loadRange(throwingStorage)).toBe('all');
    expect(() => saveRange('1y', throwingStorage)).not.toThrow();
  });

  it('storage が無い(null)環境でも落ちない', () => {
    expect(loadRange(null)).toBe('all');
    expect(() => saveRange('1y', null)).not.toThrow();
  });

  it('引数を省略しても落ちない(既定は globalThis.localStorage)', () => {
    expect(() => saveRange('1m')).not.toThrow();
    expect(isRangeKey(loadRange())).toBe(true);
  });
});
