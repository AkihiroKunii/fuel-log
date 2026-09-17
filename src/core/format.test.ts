import { describe, expect, it } from 'vitest';
import {
  DASH,
  formatKm,
  formatKmPerL,
  formatLiters,
  formatYen,
  formatYenPerKm,
  formatYenPerL,
  round1,
  round2,
  roundTo,
} from './format';

describe('roundTo / round1', () => {
  it('見えている十進表記どおりに四捨五入する(toFixed の誤差を避ける)', () => {
    // (1.005).toFixed(2) は '1.00' になるが、表示は '1.01' であってほしい
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(0.615, 2)).toBe(0.62);
    expect(round1(14.45)).toBe(14.5);
    expect(round1(14.44)).toBe(14.4);
    expect(round1(14.46)).toBe(14.5);
    expect(round1(13.94)).toBe(13.9);
  });

  it('計算結果の誤差を吸収する', () => {
    expect(round1(412.3 / 28.5)).toBe(14.5); // 14.466666666666667
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(0.6000000000000014)).toBe(0.6);
    expect(round2(4560 / 412.3)).toBe(11.06);
  });

  it('負数は0から遠い側へ丸め、-0 は 0 にする', () => {
    expect(round1(-0.6000000000000014)).toBe(-0.6);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(Object.is(round1(-0.04), 0)).toBe(true);
  });

  it('桁0は整数に丸める', () => {
    expect(roundTo(4559.5, 0)).toBe(4560);
    expect(roundTo(4559.4, 0)).toBe(4559);
  });
});

describe('formatKmPerL / formatYenPerL', () => {
  it('小数1桁で固定表示する', () => {
    expect(formatKmPerL(14.466666666666667)).toBe('14.5');
    expect(formatKmPerL(14)).toBe('14.0');
    expect(formatKmPerL(14.45)).toBe('14.5');
    expect(formatKmPerL(0)).toBe('0.0');
    expect(formatYenPerL(160)).toBe('160.0');
    expect(formatYenPerL(160.04)).toBe('160.0');
    expect(formatYenPerL(160.05)).toBe('160.1');
  });

  it('null / undefined / NaN はダッシュ', () => {
    expect(formatKmPerL(null)).toBe(DASH);
    expect(formatKmPerL(undefined)).toBe(DASH);
    expect(formatKmPerL(Number.NaN)).toBe(DASH);
    expect(formatKmPerL(Number.POSITIVE_INFINITY)).toBe(DASH);
    expect(formatYenPerL(null)).toBe(DASH);
    expect(DASH).toBe('—');
  });
});

describe('formatYenPerKm', () => {
  it('小数2桁で固定表示する', () => {
    expect(formatYenPerKm(11.025)).toBe('11.03');
    expect(formatYenPerKm(11)).toBe('11.00');
    expect(formatYenPerKm(1.005)).toBe('1.01');
    expect(formatYenPerKm(null)).toBe(DASH);
  });
});

describe('formatKm', () => {
  it('小数1桁まで・末尾の0は省く', () => {
    expect(formatKm(412.3)).toBe('412.3');
    expect(formatKm(412)).toBe('412');
    expect(formatKm(412.0)).toBe('412');
    expect(formatKm(412.34)).toBe('412.3');
    expect(formatKm(412.35)).toBe('412.4');
    expect(formatKm(0)).toBe('0');
    expect(formatKm(null)).toBe(DASH);
  });
});

describe('formatLiters', () => {
  it('小数2桁まで・末尾の0は省く', () => {
    expect(formatLiters(28.5)).toBe('28.5');
    expect(formatLiters(28.55)).toBe('28.55');
    expect(formatLiters(28.5)).toBe('28.5');
    expect(formatLiters(28)).toBe('28');
    expect(formatLiters(28.555)).toBe('28.56');
    expect(formatLiters(28.504)).toBe('28.5');
    expect(formatLiters(0.5)).toBe('0.5');
    expect(formatLiters(null)).toBe(DASH);
  });
});

describe('formatYen', () => {
  it('3桁区切りの整数', () => {
    expect(formatYen(4560)).toBe('4,560');
    expect(formatYen(560)).toBe('560');
    expect(formatYen(0)).toBe('0');
    expect(formatYen(1234567)).toBe('1,234,567');
    expect(formatYen(4559.5)).toBe('4,560');
    expect(formatYen(-1234)).toBe('-1,234');
    expect(formatYen(null)).toBe(DASH);
  });
});
