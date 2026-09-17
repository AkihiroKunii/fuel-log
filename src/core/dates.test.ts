import { describe, expect, it } from 'vitest';
import { addDays, dateToMs, isValidDateStr, rangeStart, todayJst } from './dates';

describe('todayJst', () => {
  it('UTC 14:59 はまだ同じ日、UTC 15:00 で JST の翌日になる', () => {
    expect(todayJst(new Date('2026-09-17T14:59:59Z'))).toBe('2026-09-17');
    expect(todayJst(new Date('2026-09-17T15:00:00Z'))).toBe('2026-09-18');
  });

  it('UTC 00:00 でも JST では同じ日の朝9時', () => {
    expect(todayJst(new Date('2026-09-17T00:00:00Z'))).toBe('2026-09-17');
  });

  it('年をまたぐ', () => {
    expect(todayJst(new Date('2026-12-31T14:59:59Z'))).toBe('2026-12-31');
    expect(todayJst(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });

  it('引数なしでも YYYY-MM-DD 形式を返す', () => {
    expect(todayJst()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isValidDateStr', () => {
  it('実在する日付は true', () => {
    expect(isValidDateStr('2026-09-17')).toBe(true);
    expect(isValidDateStr('2026-01-01')).toBe(true);
    expect(isValidDateStr('2026-12-31')).toBe(true);
  });

  it('うるう日は年によって変わる', () => {
    expect(isValidDateStr('2028-02-29')).toBe(true);
    expect(isValidDateStr('2026-02-29')).toBe(false);
    expect(isValidDateStr('2100-02-29')).toBe(false); // 100 の倍数は平年
    expect(isValidDateStr('2000-02-29')).toBe(true); // 400 の倍数はうるう年
  });

  it('実在しない日付・形式違い・空文字は false', () => {
    expect(isValidDateStr('2026-02-30')).toBe(false);
    expect(isValidDateStr('2026-13-01')).toBe(false);
    expect(isValidDateStr('2026-00-10')).toBe(false);
    expect(isValidDateStr('2026-09-00')).toBe(false);
    expect(isValidDateStr('2026-9-1')).toBe(false);
    expect(isValidDateStr('2026/09/17')).toBe(false);
    expect(isValidDateStr('20260917')).toBe(false);
    expect(isValidDateStr('2026-09-17T00:00:00Z')).toBe(false);
    expect(isValidDateStr('')).toBe(false);
  });
});

describe('addDays', () => {
  it('月をまたぐ', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('年をまたぐ', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('うるう年の2月をまたぐ', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('0日なら同じ日、往復すると元に戻る', () => {
    expect(addDays('2026-09-17', 0)).toBe('2026-09-17');
    expect(addDays(addDays('2026-09-17', -365), 365)).toBe('2026-09-17');
  });

  it('不正な日付は RangeError', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });
});

describe('rangeStart', () => {
  const today = '2026-09-17';

  it('1m は30日前、6m は182日前、1y は365日前', () => {
    expect(rangeStart('1m', today)).toBe('2026-08-18');
    expect(rangeStart('6m', today)).toBe('2026-03-19');
    expect(rangeStart('1y', today)).toBe('2025-09-17');
  });

  it('all は null', () => {
    expect(rangeStart('all', today)).toBeNull();
  });
});

describe('dateToMs', () => {
  it('UTC 00:00 の epoch ms', () => {
    expect(dateToMs('1970-01-01')).toBe(0);
    expect(dateToMs('2026-09-17')).toBe(Date.UTC(2026, 8, 17));
  });

  it('1日の差はちょうど 86,400,000 ms', () => {
    expect(dateToMs('2026-09-18') - dateToMs('2026-09-17')).toBe(86_400_000);
  });

  it('不正な日付は RangeError', () => {
    expect(() => dateToMs('2026-13-01')).toThrow(RangeError);
  });
});
