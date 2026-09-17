import { describe, expect, it } from 'vitest';
import { average, buildSeries, dotRadius, lastNonNullPoint } from './chartSeries';
import type { DerivedFillup } from '../../core/types';

function row(p: { id: number; date: string; kmPerL?: number | null }): DerivedFillup {
  return {
    id: p.id,
    date: p.date,
    tripKm: 300,
    liters: 20,
    yen: null,
    partial: false,
    createdAt: 0,
    updatedAt: 0,
    kmPerL: p.kmPerL ?? null,
    yenPerL: null,
    yenPerKm: null,
    mergedPartials: 0,
  };
}

describe('buildSeries', () => {
  it('date を UTC epoch ms(t)に変換し、指定した指標を value にする', () => {
    const rows = [
      row({ id: 1, date: '2026-09-01', kmPerL: 15 }),
      row({ id: 2, date: '2026-09-08', kmPerL: null }),
    ];
    const points = buildSeries(rows, (r) => r.kmPerL);

    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ t: Date.UTC(2026, 8, 1), value: 15, row: rows[0] });
    expect(points[1].t).toBe(Date.UTC(2026, 8, 8));
    expect(points[1].value).toBeNull();
    expect(points[1].row).toBe(rows[1]); // row は複製せずそのまま持つ
  });

  it('空配列なら空配列', () => {
    expect(buildSeries([], (r) => r.kmPerL)).toEqual([]);
  });
});

describe('average', () => {
  it('null・undefined を除いた単純平均', () => {
    expect(average([10, null, 20, undefined])).toBe(15);
  });

  it('対象が無ければ null', () => {
    expect(average([])).toBeNull();
    expect(average([null, null, undefined])).toBeNull();
  });

  it('NaN・Infinity も除く', () => {
    expect(average([10, Number.NaN, 20, Number.POSITIVE_INFINITY])).toBe(15);
  });
});

describe('dotRadius', () => {
  it('60点まで: r=4・リングあり', () => {
    expect(dotRadius(1)).toEqual({ r: 4, ring: true });
    expect(dotRadius(60)).toEqual({ r: 4, ring: true });
  });

  it('61〜150点: r=3・リングあり', () => {
    expect(dotRadius(61)).toEqual({ r: 3, ring: true });
    expect(dotRadius(150)).toEqual({ r: 3, ring: true });
  });

  it('151点以上: r=2・リング無し', () => {
    expect(dotRadius(151)).toEqual({ r: 2, ring: false });
    expect(dotRadius(1000)).toEqual({ r: 2, ring: false });
  });
});

describe('lastNonNullPoint', () => {
  it('末尾から見て value が非nullの最初の点(=最新の有効値)を返す', () => {
    const rows = [
      row({ id: 1, date: '2026-09-01', kmPerL: 15 }),
      row({ id: 2, date: '2026-09-08', kmPerL: null }), // 部分給油など
    ];
    const points = buildSeries(rows, (r) => r.kmPerL);
    expect(lastNonNullPoint(points)?.row.id).toBe(1);
  });

  it('全部 null なら undefined', () => {
    const points = buildSeries([row({ id: 1, date: '2026-09-01' })], (r) => r.kmPerL);
    expect(lastNonNullPoint(points)).toBeUndefined();
  });

  it('空配列なら undefined', () => {
    expect(lastNonNullPoint([])).toBeUndefined();
  });
});
