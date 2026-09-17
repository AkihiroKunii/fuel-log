import { describe, expect, it } from 'vitest';
import { DASH } from '../../core/format';
import { formatKmGrouped, formatLitersGrouped } from './numberFormat';

describe('formatKmGrouped', () => {
  it('3桁区切りを入れる(小数1桁まで・末尾0省略は formatKm と同じ)', () => {
    expect(formatKmGrouped(1234.5)).toBe('1,234.5');
    expect(formatKmGrouped(1234567)).toBe('1,234,567');
    expect(formatKmGrouped(412.3)).toBe('412.3');
    expect(formatKmGrouped(412)).toBe('412');
    expect(formatKmGrouped(0)).toBe('0');
  });

  it('1000未満は区切りが入らない', () => {
    expect(formatKmGrouped(999.9)).toBe('999.9');
  });

  it('値が無ければダッシュ', () => {
    expect(formatKmGrouped(null)).toBe(DASH);
    expect(formatKmGrouped(undefined)).toBe(DASH);
    expect(formatKmGrouped(Number.NaN)).toBe(DASH);
  });
});

describe('formatLitersGrouped', () => {
  it('3桁区切りを入れる(小数2桁まで・末尾0省略は formatLiters と同じ)', () => {
    expect(formatLitersGrouped(1234.56)).toBe('1,234.56');
    expect(formatLitersGrouped(98.5)).toBe('98.5');
    expect(formatLitersGrouped(1000)).toBe('1,000');
  });

  it('値が無ければダッシュ', () => {
    expect(formatLitersGrouped(null)).toBe(DASH);
    expect(formatLitersGrouped(undefined)).toBe(DASH);
  });
});
