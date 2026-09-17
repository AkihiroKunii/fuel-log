import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  deriveFillups,
  diffKmPerL,
  filterByRange,
  periodStats,
  previewKmPerL,
  previousKmPerL,
  sortFillups,
} from './fuel';
import type { FillupInput, StoredFillup } from './types';

function row(p: {
  id: number;
  date: string;
  tripKm: number;
  liters: number;
  yen?: number | null;
  partial?: boolean;
}): StoredFillup {
  return {
    id: p.id,
    date: p.date,
    tripKm: p.tripKm,
    liters: p.liters,
    yen: p.yen ?? null,
    partial: p.partial ?? false,
    createdAt: 0,
    updatedAt: 0,
  };
}

function input(p: {
  date: string;
  tripKm: number;
  liters: number;
  yen?: number | null;
  partial?: boolean;
}): FillupInput {
  return {
    date: p.date,
    tripKm: p.tripKm,
    liters: p.liters,
    yen: p.yen ?? null,
    partial: p.partial ?? false,
  };
}

describe('sortFillups', () => {
  it('date 昇順 → 同日は id 昇順に並べ、入力配列は変えない', () => {
    const rows = [
      row({ id: 3, date: '2026-09-10', tripKm: 300, liters: 20 }),
      row({ id: 1, date: '2026-09-20', tripKm: 300, liters: 20 }),
      row({ id: 2, date: '2026-09-10', tripKm: 300, liters: 20 }),
    ];
    const before = rows.map((r) => r.id);

    // 2026-09-10 の2件は id 昇順(2 → 3)、その後に 2026-09-20 の id 1
    expect(sortFillups(rows).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe('deriveFillups', () => {
  it('通常の行は tripKm / liters で、合算は無い', () => {
    const [d] = deriveFillups([row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25, yen: 4000 })]);

    expect(d.kmPerL).toBe(16);
    expect(d.yenPerL).toBe(160);
    expect(d.yenPerKm).toBe(10);
    expect(d.mergedPartials).toBe(0);
  });

  it('部分給油1件の連鎖: 部分行は null、次の満タン行で合算する', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25, yen: 4000 }),
      row({ id: 2, date: '2026-09-08', tripKm: 100, liters: 5, yen: 800, partial: true }),
      row({ id: 3, date: '2026-09-15', tripKm: 300, liters: 20, yen: 3200 }),
    ]);

    expect(derived.map((d) => d.kmPerL)).toEqual([16, null, 16]);
    expect(derived[1].mergedPartials).toBe(0);
    expect(derived[2].mergedPartials).toBe(1);
  });

  it('部分給油が2件続いても合算できる', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 100, liters: 5, partial: true }),
      row({ id: 2, date: '2026-09-02', tripKm: 100, liters: 5, partial: true }),
      row({ id: 3, date: '2026-09-03', tripKm: 200, liters: 15 }),
    ]);

    expect(derived.map((d) => d.kmPerL)).toEqual([null, null, 16]); // 400 / 25
    expect(derived[2].mergedPartials).toBe(2);
  });

  it('データの先頭が部分給油でも同じ規則で次の満タン行に合算する', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 150, liters: 10, partial: true }),
      row({ id: 2, date: '2026-09-05', tripKm: 250, liters: 15 }),
    ]);

    expect(derived[0].kmPerL).toBeNull();
    expect(derived[1].kmPerL).toBe(16);
    expect(derived[1].mergedPartials).toBe(1);
  });

  it('末尾が部分給油のまま(後続の満タンが無い)なら null のまま残る', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25 }),
      row({ id: 2, date: '2026-09-10', tripKm: 100, liters: 5, partial: true }),
    ]);

    expect(derived.map((d) => d.kmPerL)).toEqual([16, null]);
    expect(derived[1].mergedPartials).toBe(0);
  });

  it('同日の2件は id 昇順で扱われる(1日2回給油)', () => {
    const derived = deriveFillups([
      row({ id: 2, date: '2026-09-10', tripKm: 300, liters: 20 }),
      row({ id: 1, date: '2026-09-10', tripKm: 100, liters: 5, partial: true }),
    ]);

    expect(derived.map((d) => d.id)).toEqual([1, 2]);
    expect(derived.map((d) => d.kmPerL)).toEqual([null, 16]); // 400 / 25
    expect(derived[1].mergedPartials).toBe(1);
  });

  it('入力が未ソートでも結果は昇順になり、入力配列は破壊されない', () => {
    const rows = [
      row({ id: 3, date: '2026-09-15', tripKm: 300, liters: 20 }),
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25 }),
      row({ id: 2, date: '2026-09-08', tripKm: 100, liters: 5, partial: true }),
    ];
    const snapshot = JSON.stringify(rows);

    const derived = deriveFillups(rows);

    expect(derived.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    expect(JSON.stringify(rows)).toBe(snapshot); // 並び替えも派生値の書き込みもしていない
    expect(rows[0]).not.toHaveProperty('kmPerL');
  });

  it('yenPerL は部分給油の行でも出る(その給油の単価として有効)', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 100, liters: 5, yen: 800, partial: true }),
      row({ id: 2, date: '2026-09-05', tripKm: 300, liters: 20, yen: 3200 }),
    ]);

    expect(derived[0].yenPerL).toBe(160);
    expect(derived[0].yenPerKm).toBeNull(); // 部分給油の行は 円/km を出さない
    expect(derived[1].yenPerL).toBe(160); // 満タン行の単価は自分の行だけで計算する
  });

  it('yenPerKm は連鎖を合算し、連鎖内に yen null があれば null', () => {
    const merged = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 100, liters: 5, yen: 800, partial: true }),
      row({ id: 2, date: '2026-09-05', tripKm: 300, liters: 20, yen: 3200 }),
    ]);
    expect(merged[1].yenPerKm).toBe(10); // (800 + 3200) / (100 + 300)

    const missingInChain = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 100, liters: 5, yen: null, partial: true }),
      row({ id: 2, date: '2026-09-05', tripKm: 300, liters: 20, yen: 3200 }),
    ]);
    expect(missingInChain[1].yenPerKm).toBeNull();

    const missingOnSelf = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 100, liters: 5, yen: 800, partial: true }),
      row({ id: 2, date: '2026-09-05', tripKm: 300, liters: 20, yen: null }),
    ]);
    expect(missingOnSelf[1].yenPerKm).toBeNull();
    expect(missingOnSelf[1].yenPerL).toBeNull();
  });

  it('yen が null なら yenPerL も null', () => {
    const [d] = deriveFillups([row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25, yen: null })]);
    expect(d.yenPerL).toBeNull();
    expect(d.yenPerKm).toBeNull();
    expect(d.kmPerL).toBe(16);
  });

  it('受け入れ条件2: 満タン→部分→満タン で、部分行は空欄・最後の行は2区間合算', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25, yen: 4000 }),
      row({ id: 2, date: '2026-09-08', tripKm: 100, liters: 5, yen: 800, partial: true }),
      row({ id: 3, date: '2026-09-15', tripKm: 300, liters: 20, yen: 3200 }),
    ]);

    expect(derived[0].kmPerL).toBe(16);
    expect(derived[1].kmPerL).toBeNull();
    expect(derived[1].yenPerKm).toBeNull();
    expect(derived[2].kmPerL).toBe((100 + 300) / (5 + 20));
    expect(derived[2].mergedPartials).toBe(1);
    expect(derived[2].yenPerKm).toBe((800 + 3200) / (100 + 300));
  });
});

describe('filterByRange', () => {
  const today = '2026-09-17';
  // 1m の開始日 = 2026-08-18 / 6m = 2026-03-19 / 1y = 2025-09-17
  const boundaries: { range: '1m' | '6m' | '1y'; start: string; before: string }[] = [
    { range: '1m', start: '2026-08-18', before: '2026-08-17' },
    { range: '6m', start: '2026-03-19', before: '2026-03-18' },
    { range: '1y', start: '2025-09-17', before: '2025-09-16' },
  ];

  for (const { range, start, before } of boundaries) {
    it(`${range}: 開始日 ${start} は含み、その前日 ${before} は含まない`, () => {
      const derived = deriveFillups([
        row({ id: 1, date: before, tripKm: 400, liters: 25 }),
        row({ id: 2, date: start, tripKm: 400, liters: 25 }),
        row({ id: 3, date: today, tripKm: 400, liters: 25 }),
      ]);

      expect(filterByRange(derived, range, today).map((r) => r.date)).toEqual([start, today]);
    });
  }

  it('all は全件を返し、入力配列とは別の配列になる', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2020-01-01', tripKm: 400, liters: 25 }),
      row({ id: 2, date: today, tripKm: 400, liters: 25 }),
    ]);

    const filtered = filterByRange(derived, 'all', today);
    expect(filtered).toHaveLength(2);
    expect(filtered).not.toBe(derived);
  });

  it('規則5: 期間の外にある部分給油も、期間内の満タン行に合算されている', () => {
    // 部分給油は 1m の期間外(2026-08-10)、満タンは期間内(2026-09-01)
    const derived = deriveFillups([
      row({ id: 1, date: '2026-08-10', tripKm: 100, liters: 5, yen: 800, partial: true }),
      row({ id: 2, date: '2026-09-01', tripKm: 300, liters: 20, yen: 3200 }),
    ]);
    const inPeriod = filterByRange(derived, '1m', today);

    expect(inPeriod.map((r) => r.date)).toEqual(['2026-09-01']);
    expect(inPeriod[0].kmPerL).toBe(16); // 400 / 25。期間外の部分給油を含んだ値
    expect(inPeriod[0].mergedPartials).toBe(1);
    expect(inPeriod[0].yenPerKm).toBe(10);
  });
});

describe('periodStats', () => {
  it('空配列なら null と 0', () => {
    const s = periodStats([]);
    expect(s).toEqual({
      count: 0,
      fillupCount: 0,
      avgKmPerL: null,
      maxKmPerL: null,
      minKmPerL: null,
      totalKm: 0,
      totalLiters: 0,
      totalYen: 0,
    });
  });

  it('平均・最高・最低・count は kmPerL 非 null の行だけ、合計は部分給油も含む', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25, yen: 4000 }),
      row({ id: 2, date: '2026-09-08', tripKm: 100, liters: 5, yen: null, partial: true }),
      row({ id: 3, date: '2026-09-15', tripKm: 300, liters: 20, yen: 3200 }),
    ]);
    const s = periodStats(derived);

    expect(s.count).toBe(2); // kmPerL が出ているのは1件目と3件目
    expect(s.fillupCount).toBe(3); // 部分給油を含む全行数
    expect(s.avgKmPerL).toBe(16);
    expect(s.maxKmPerL).toBe(16);
    expect(s.minKmPerL).toBe(16);
    expect(s.totalKm).toBe(800);
    expect(s.totalLiters).toBe(50);
    expect(s.totalYen).toBe(7200); // yen が null の行は除く
  });

  it('最高・最低・平均が別々の値になる', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25 }), // 16
      row({ id: 2, date: '2026-09-08', tripKm: 360, liters: 30 }), // 12
      row({ id: 3, date: '2026-09-15', tripKm: 280, liters: 20 }), // 14
    ]);
    const s = periodStats(derived);

    expect(s.maxKmPerL).toBe(16);
    expect(s.minKmPerL).toBe(12);
    expect(s.avgKmPerL).toBe(14);
    expect(s.count).toBe(3);
  });

  it('全行が部分給油なら count は 0 だが合計は出る', () => {
    const derived = deriveFillups([
      row({ id: 1, date: '2026-09-01', tripKm: 100, liters: 5, yen: 800, partial: true }),
    ]);
    const s = periodStats(derived);

    expect(s.count).toBe(0);
    expect(s.fillupCount).toBe(1);
    expect(s.avgKmPerL).toBeNull();
    expect(s.totalKm).toBe(100);
    expect(s.totalYen).toBe(800);
  });
});

describe('previousKmPerL', () => {
  const derived = deriveFillups([
    row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25 }), // 16
    row({ id: 2, date: '2026-09-08', tripKm: 100, liters: 5, partial: true }), // null
    row({ id: 3, date: '2026-09-15', tripKm: 300, liters: 20 }), // 16
  ]);

  it('kmPerL が null の行(部分給油)は飛ばして、その前の値を返す', () => {
    expect(previousKmPerL(derived, 3)).toBe(16);
  });

  it('先頭行には前回が無いので null', () => {
    expect(previousKmPerL(derived, 1)).toBeNull();
  });

  it('部分給油の行から見ても直前の満タン行の値を返す', () => {
    expect(previousKmPerL(derived, 2)).toBe(16);
  });

  it('存在しない id は null', () => {
    expect(previousKmPerL(derived, 999)).toBeNull();
  });
});

describe('previewKmPerL', () => {
  const existing = [
    row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25 }),
    row({ id: 2, date: '2026-09-10', tripKm: 100, liters: 5, partial: true }),
  ];

  it('新規の候補: 既存の部分給油の連鎖を引き継いで計算する', () => {
    const v = previewKmPerL(existing, input({ date: '2026-09-17', tripKm: 300, liters: 20 }));
    expect(v).toBe(16); // (100 + 300) / (5 + 20)
  });

  it('新規の候補は同日の既存行より後ろに並ぶ', () => {
    const sameDay = [row({ id: 5, date: '2026-09-17', tripKm: 100, liters: 5, partial: true })];
    const v = previewKmPerL(sameDay, input({ date: '2026-09-17', tripKm: 300, liters: 20 }));
    expect(v).toBe(16); // 同日の部分給油が候補行の前に来るので合算される
  });

  it('連鎖が無ければ単純に tripKm / liters', () => {
    const v = previewKmPerL([existing[0]], input({ date: '2026-09-17', tripKm: 300, liters: 20 }));
    expect(v).toBe(15);
  });

  it('候補が部分給油なら null', () => {
    const v = previewKmPerL(existing, input({ date: '2026-09-17', tripKm: 300, liters: 20, partial: true }));
    expect(v).toBeNull();
  });

  it('editingId を指定するとその行を置き換えて計算する', () => {
    const rows = [
      row({ id: 1, date: '2026-09-01', tripKm: 400, liters: 25 }),
      row({ id: 2, date: '2026-09-10', tripKm: 300, liters: 30 }), // 10 km/L
    ];
    const v = previewKmPerL(rows, input({ date: '2026-09-10', tripKm: 300, liters: 20 }), 2);

    expect(v).toBe(15); // 置き換えた値で計算される(元の 10 ではない)
    expect(rows[1].liters).toBe(30); // 入力は破壊されない
  });

  it('編集で日付を変えると連鎖の並びも変わる', () => {
    const rows = [
      row({ id: 1, date: '2026-09-05', tripKm: 100, liters: 5, partial: true }),
      row({ id: 2, date: '2026-09-01', tripKm: 300, liters: 20 }), // 部分給油より前なので合算されない
    ];

    expect(previewKmPerL(rows, input({ date: '2026-09-01', tripKm: 300, liters: 20 }), 2)).toBe(15);
    // 日付を部分給油より後ろに動かすと合算される
    expect(previewKmPerL(rows, input({ date: '2026-09-10', tripKm: 300, liters: 20 }), 2)).toBe(16);
  });

  it('存在しない editingId は新規として扱う', () => {
    const v = previewKmPerL(existing, input({ date: '2026-09-17', tripKm: 300, liters: 20 }), 999);
    expect(v).toBe(16);
  });

  it('既存が空でも計算できる', () => {
    expect(previewKmPerL([], input({ date: '2026-09-17', tripKm: 300, liters: 20 }))).toBe(15);
  });
});

describe('diffKmPerL', () => {
  it('表示値どうしの差を返す(浮動小数の誤差が出ない)', () => {
    const d = diffKmPerL(14.46, 13.94); // 表示は 14.5 と 13.9
    expect(d.diff).toBe(0.6);
    expect(d.dir).toBe('up');
  });

  it('悪化は down で差は負', () => {
    const d = diffKmPerL(13.94, 14.46);
    expect(d.diff).toBe(-0.6);
    expect(d.dir).toBe('down');
  });

  it('表示値が同じなら same で 0', () => {
    expect(diffKmPerL(14.5, 14.5)).toEqual({ diff: 0, dir: 'same' });
    // 14.46 も 13.94… ではなく 14.44 なら、どちらも 14.5 / 14.4 にならず同値になる場合
    expect(diffKmPerL(14.46, 14.54)).toEqual({ diff: 0, dir: 'same' }); // 14.5 と 14.5
  });

  it('生の値では差が出ても、表示値が同じなら same', () => {
    expect(diffKmPerL(14.466666666666667, 14.5).dir).toBe('same');
  });
});

describe('大量データ', () => {
  it('1,000件でも deriveFillups と periodStats が動く', () => {
    const rows: StoredFillup[] = [];
    for (let i = 0; i < 1000; i += 1) {
      rows.push(
        row({
          id: i + 1,
          date: addDays('2023-01-01', i),
          tripKm: 300 + (i % 100),
          liters: 20 + (i % 10),
          yen: 3000 + i,
          partial: i % 10 === 5,
        }),
      );
    }

    const derived = deriveFillups(rows);
    const stats = periodStats(filterByRange(derived, 'all', '2026-09-17'));

    expect(derived).toHaveLength(1000);
    expect(stats.fillupCount).toBe(1000);
    expect(stats.count).toBe(900); // 10件に1件が部分給油
    expect(stats.avgKmPerL).not.toBeNull();
  });
});
