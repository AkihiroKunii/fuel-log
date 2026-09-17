import { describe, expect, it } from 'vitest';
import { DAY_MS, buildTimeTicks, buildYTicks, formatTick, xDomainMs, yDomain } from './ticks';

describe('buildTimeTicks', () => {
  it('45日以下: 月曜始まりの週単位(開始日がちょうど月曜)', () => {
    const start = Date.UTC(2024, 0, 1); // 2024-01-01 は月曜
    const end = start + 30 * DAY_MS; // 2024-01-31(30日間)
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2024, 0, 1),
      Date.UTC(2024, 0, 8),
      Date.UTC(2024, 0, 15),
      Date.UTC(2024, 0, 22),
      Date.UTC(2024, 0, 29),
    ]);
  });

  it('45日以下: 開始日が月曜でなければ次の月曜から', () => {
    const start = Date.UTC(2024, 0, 3); // 水曜
    const end = Date.UTC(2024, 0, 24); // 21日間
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2024, 0, 8),
      Date.UTC(2024, 0, 15),
      Date.UTC(2024, 0, 22),
    ]);
  });

  it('45〜200日: 月初(開始日がちょうど月初)', () => {
    const start = Date.UTC(2024, 0, 1);
    const end = Date.UTC(2024, 5, 15); // 166日間
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2024, 0, 1),
      Date.UTC(2024, 1, 1),
      Date.UTC(2024, 2, 1),
      Date.UTC(2024, 3, 1),
      Date.UTC(2024, 4, 1),
      Date.UTC(2024, 5, 1),
    ]);
  });

  it('45〜200日: 開始日が月初でなければ翌月から', () => {
    const start = Date.UTC(2024, 0, 15);
    const end = Date.UTC(2024, 3, 20); // 96日間
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2024, 1, 1),
      Date.UTC(2024, 2, 1),
      Date.UTC(2024, 3, 1),
    ]);
  });

  it('200〜800日: 3か月ごとの月初(1・4・7・10月)', () => {
    const start = Date.UTC(2024, 0, 1);
    const end = Date.UTC(2025, 0, 1); // 366日間(うるう年)
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2024, 0, 1),
      Date.UTC(2024, 3, 1),
      Date.UTC(2024, 6, 1),
      Date.UTC(2024, 9, 1),
      Date.UTC(2025, 0, 1),
    ]);
  });

  it('800〜1500日: 半年ごと(1・7月)', () => {
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2023, 0, 1); // 1096日間
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2020, 0, 1),
      Date.UTC(2020, 6, 1),
      Date.UTC(2021, 0, 1),
      Date.UTC(2021, 6, 1),
      Date.UTC(2022, 0, 1),
      Date.UTC(2022, 6, 1),
      Date.UTC(2023, 0, 1),
    ]);
  });

  it('1500日超: 年初', () => {
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2025, 0, 1); // 1827日間
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2020, 0, 1),
      Date.UTC(2021, 0, 1),
      Date.UTC(2022, 0, 1),
      Date.UTC(2023, 0, 1),
      Date.UTC(2024, 0, 1),
      Date.UTC(2025, 0, 1),
    ]);
  });

  it('目盛が3本未満になるときは1段階細かい間隔にフォールバックする(月初→週単位)', () => {
    const start = Date.UTC(2024, 0, 1); // 月曜
    const end = start + 50 * DAY_MS; // 2024-02-20(50日間、月初だけだと2本しか無い)
    expect(buildTimeTicks(start, end)).toEqual([
      Date.UTC(2024, 0, 1),
      Date.UTC(2024, 0, 8),
      Date.UTC(2024, 0, 15),
      Date.UTC(2024, 0, 22),
      Date.UTC(2024, 0, 29),
      Date.UTC(2024, 1, 5),
      Date.UTC(2024, 1, 12),
      Date.UTC(2024, 1, 19),
    ]);
  });

  it('end が start 以下なら壊れずに start だけを返す', () => {
    const t = Date.UTC(2026, 8, 17);
    expect(buildTimeTicks(t, t)).toEqual([t]);
    expect(buildTimeTicks(t, t - DAY_MS)).toEqual([t]);
  });

  it('大きな範囲でも昇順で、範囲内に収まる', () => {
    const start = Date.UTC(2000, 0, 1);
    const end = Date.UTC(2026, 8, 17);
    const ticks = buildTimeTicks(start, end);
    for (let i = 1; i < ticks.length; i += 1) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(start);
      expect(t).toBeLessThanOrEqual(end);
    }
  });
});

describe('formatTick', () => {
  it('期間が約200日以下なら M/D(ゼロ埋めなし)', () => {
    expect(formatTick(Date.UTC(2026, 8, 17), 30)).toBe('9/17');
    expect(formatTick(Date.UTC(2026, 0, 5), 200)).toBe('1/5');
  });

  it('期間が200日超なら YY/M', () => {
    expect(formatTick(Date.UTC(2026, 3, 1), 201)).toBe('26/4');
    expect(formatTick(Date.UTC(2005, 3, 1), 300)).toBe('05/4');
  });
});

describe('xDomainMs', () => {
  const todayMs = Date.UTC(2026, 8, 17);

  it('1m/6m/1y など range に開始日があれば [rangeStart, today]', () => {
    const rangeStartMs = Date.UTC(2026, 7, 18);
    expect(xDomainMs({ todayMs, rangeStartMs, oldestMs: Date.UTC(2000, 0, 1) })).toEqual([
      rangeStartMs,
      todayMs,
    ]);
  });

  it("all: 最古が14日より前なら [最古, today]", () => {
    const oldestMs = Date.UTC(2026, 0, 1);
    expect(xDomainMs({ todayMs, rangeStartMs: null, oldestMs })).toEqual([oldestMs, todayMs]);
  });

  it('all: 最古が14日以内なら today-14日を開始日にする(最短14日幅)', () => {
    const oldestMs = todayMs - 3 * DAY_MS;
    expect(xDomainMs({ todayMs, rangeStartMs: null, oldestMs })).toEqual([
      todayMs - 14 * DAY_MS,
      todayMs,
    ]);
  });

  it('all: データが無ければ today-14日を開始日にする', () => {
    expect(xDomainMs({ todayMs, rangeStartMs: null, oldestMs: null })).toEqual([
      todayMs - 14 * DAY_MS,
      todayMs,
    ]);
  });
});

describe('yDomain', () => {
  it('floor(min - pad) 〜 ceil(max + pad)', () => {
    expect(yDomain([12, 14, 16], 1)).toEqual([11, 17]);
    expect(yDomain([150, 160, 170], 5)).toEqual([145, 175]);
  });

  it('値が1つだけでも壊れない', () => {
    expect(yDomain([14], 1)).toEqual([13, 15]);
  });

  it('全部同じ値でも壊れない', () => {
    expect(yDomain([14, 14, 14], 1)).toEqual([13, 15]);
  });

  it('空配列でも壊れない([0, pad*2] を返す)', () => {
    expect(yDomain([], 1)).toEqual([0, 2]);
    expect(yDomain([], 5)).toEqual([0, 10]);
  });

  it('非有限値は無視する', () => {
    expect(yDomain([10, Number.NaN, 20, Number.POSITIVE_INFINITY], 1)).toEqual([9, 21]);
  });
});

describe('buildYTicks', () => {
  it('整数の目盛を返す(4〜6本目安)', () => {
    expect(buildYTicks([9, 19])).toEqual([10, 12, 14, 16, 18]);
  });

  it('1/2/5/10刻みでは4〜6本に収まらない domain でも、整数刻みへフォールバックして本数を守る', () => {
    // 145〜175 は 5刻みで7本・10刻みで3本になり 1/2/5/10 系には収まらないため、6刻み(5本)を使う
    expect(buildYTicks([145, 175])).toEqual([150, 156, 162, 168, 174]);
    // 11〜28 も同様(5刻みで3本・2刻みで9本)で、3刻み(6本)にフォールバックする
    expect(buildYTicks([11, 28])).toEqual([12, 15, 18, 21, 24, 27]);
  });

  it('幅が狭い domain(単一値+pad=1)でも整数刻みで壊れない', () => {
    expect(buildYTicks([13, 15])).toEqual([13, 14, 15]);
  });

  it('domain の幅が0なら1本だけ返す', () => {
    expect(buildYTicks([10, 10])).toEqual([10]);
  });

  it('不正な domain(非有限)でも壊れない', () => {
    expect(buildYTicks([Number.NaN, 10])).toEqual([0]);
  });
});
