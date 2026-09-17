import { describe, expect, it } from 'vitest';
import { CSV_HEADER, csvFileName, parseCsv, toCsv } from './csv';
import { deriveFillups } from './fuel';
import { readSampleCsv, sampleFillups } from './testFixtures';
import type { DerivedFillup, StoredFillup } from './types';

const TODAY = '2026-09-17';

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

function derivedRows(): DerivedFillup[] {
  return deriveFillups([
    row({ id: 1, date: '2026-09-01', tripKm: 412.3, liters: 28.5, yen: 4560 }),
    row({ id: 2, date: '2026-09-08', tripKm: 100, liters: 5.5, yen: null, partial: true }),
    row({ id: 3, date: '2026-09-15', tripKm: 300, liters: 20, yen: 3200 }),
  ]);
}

describe('toCsv', () => {
  it('ヘッダ・昇順・末尾改行・BOM なし', () => {
    const csv = toCsv(derivedRows());
    const lines = csv.split('\n');

    expect(csv.startsWith('﻿')).toBe(false);
    expect(lines[0]).toBe(CSV_HEADER);
    expect(csv.endsWith('\n')).toBe(true);
    expect(lines).toHaveLength(5); // ヘッダ + 3行 + 末尾の空要素
    expect(lines[1]).toBe('2026-09-01,412.3,28.5,4560,false,14.5');
  });

  it('yen が null なら空欄、partial は true/false、kmPerL は小数1桁(null は空欄)', () => {
    const lines = toCsv(derivedRows()).trimEnd().split('\n');

    expect(lines[2]).toBe('2026-09-08,100,5.5,,true,'); // 部分給油は kmPerL 空欄
    expect(lines[3]).toBe('2026-09-15,300,20,3200,false,15.7'); // (100+300)/(5.5+20)=15.686…
  });

  it('未ソートで渡しても昇順で書き出す', () => {
    const derived = derivedRows().slice().reverse();
    const lines = toCsv(derived).trimEnd().split('\n');

    expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
  });

  it('0件ならヘッダだけ', () => {
    expect(toCsv([])).toBe(`${CSV_HEADER}\n`);
  });
});

describe('parseCsv', () => {
  it('toCsv → parseCsv の往復で値が一致する', () => {
    const derived = derivedRows();
    const parsed = parseCsv(toCsv(derived), TODAY);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toEqual(
      derived.map((d) => ({
        date: d.date,
        tripKm: d.tripKm,
        liters: d.liters,
        yen: d.yen,
        partial: d.partial,
      })),
    );
  });

  it('BOM・CRLF・空行を許容する', () => {
    const text = `﻿${CSV_HEADER}\r\n\r\n2026-09-01,412.3,28.5,4560,false,14.5\r\n\r\n`;
    const parsed = parseCsv(text, TODAY);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].tripKm).toBe(412.3);
  });

  it('ダブルクォートで囲まれたフィールドも読める(Excel 等で再保存された場合)', () => {
    const text = `"date","tripKm","liters","yen","partial","kmPerL"\n"2026-09-01","412.3","28.5","4560","false","14.5"\n`;
    const parsed = parseCsv(text, TODAY);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]).toEqual({
      date: '2026-09-01',
      tripKm: 412.3,
      liters: 28.5,
      yen: 4560,
      partial: false,
    });
  });

  it('kmPerL 列は無くてもよく、有っても値は無視される', () => {
    const noKmPerL = parseCsv('date,tripKm,liters,yen,partial\n2026-09-01,400,25,4000,false\n', TODAY);
    expect(noKmPerL.ok).toBe(true);

    const wrongKmPerL = parseCsv(`${CSV_HEADER}\n2026-09-01,400,25,4000,false,999.9\n`, TODAY);
    expect(wrongKmPerL.ok).toBe(true);
    if (!wrongKmPerL.ok) return;
    expect(wrongKmPerL.rows[0].tripKm).toBe(400);
  });

  it('列の順序が違ってもヘッダ名で対応付ける', () => {
    const parsed = parseCsv('partial,liters,tripKm,date,yen\nfalse,25,400,2026-09-01,4000\n', TODAY);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]).toEqual({
      date: '2026-09-01',
      tripKm: 400,
      liters: 25,
      yen: 4000,
      partial: false,
    });
  });

  it('partial は true/false/1/0/空 を受け付け、それ以外はエラー', () => {
    const ok = parseCsv(
      `${CSV_HEADER}\n` +
        '2026-09-01,400,25,4000,true,\n' +
        '2026-09-02,400,25,4000,TRUE,\n' +
        '2026-09-03,400,25,4000,1,\n' +
        '2026-09-04,400,25,4000,false,\n' +
        '2026-09-05,400,25,4000,0,\n' +
        '2026-09-06,400,25,4000,,\n',
      TODAY,
    );
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.rows.map((r) => r.partial)).toEqual([true, true, true, false, false, false]);

    const ng = parseCsv(`${CSV_HEADER}\n2026-09-01,400,25,4000,yes,\n`, TODAY);
    expect(ng.ok).toBe(false);
    if (ng.ok) return;
    expect(ng.errors[0]).toBe('2行目: partial は true/false/1/0/空 のいずれかで入力してください');
  });

  it('金額が空欄なら null', () => {
    const parsed = parseCsv(`${CSV_HEADER}\n2026-09-01,400,25,,false,\n`, TODAY);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0].yen).toBeNull();
  });

  it('ヘッダが不正なら取り込まない', () => {
    const missing = parseCsv('date,tripKm,liters\n2026-09-01,400,25\n', TODAY);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors).toHaveLength(1);
    expect(missing.errors[0]).toContain('1行目');
    expect(missing.errors[0]).toContain('ヘッダ');

    expect(parseCsv('', TODAY).ok).toBe(false);
    expect(parseCsv('   \n\n', TODAY).ok).toBe(false);
  });

  it('1行でも不正なら ok:false で、行番号付きのメッセージを返す(何も取り込まない)', () => {
    const text = `${CSV_HEADER}\n` + '2026-09-01,400,25,4000,false,16.0\n' + '2026-09-02,3000,25,4000,false,\n';
    const parsed = parseCsv(text, TODAY);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual(['3行目: 走行距離: 1〜2,000 km の範囲で入力してください']);
  });

  it('空行があっても行番号は元ファイルの行番号', () => {
    const text = `${CSV_HEADER}\n\n\n2026-09-02,3000,25,4000,false,\n`;
    const parsed = parseCsv(text, TODAY);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0].startsWith('4行目:')).toBe(true);
  });

  it('1行に複数のエラーがあれば項目ごとに返す', () => {
    const parsed = parseCsv(`${CSV_HEADER}\n2026-02-30,0.5,200,99999,false,\n`, TODAY);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual([
      '2行目: 日付を入力してください',
      '2行目: 走行距離: 1〜2,000 km の範囲で入力してください',
      '2行目: 給油量: 0.5〜120 L の範囲で入力してください',
      '2行目: 金額: 0〜50,000 円の整数で入力してください',
    ]);
  });

  it('列数が足りない行はエラー', () => {
    const parsed = parseCsv(`${CSV_HEADER}\n2026-09-01,400,25\n`, TODAY);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual(['2行目: 列数が足りません']);
  });

  it('未来日は取り込まない', () => {
    const parsed = parseCsv(`${CSV_HEADER}\n2026-09-18,400,25,4000,false,\n`, TODAY);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual(['2行目: 日付は今日以前にしてください']);
  });
});

describe('サンプルデータ(docs/samples/fillups-sample.csv)', () => {
  it('バックアップサンプルから書き出した CSV と一致する', () => {
    expect(toCsv(deriveFillups(sampleFillups()))).toBe(readSampleCsv());
  });

  it('取り込むと15件になり、部分給油・金額空欄・同日2回給油を含む', () => {
    const parsed = parseCsv(readSampleCsv(), TODAY);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(15);
    expect(parsed.rows.filter((r) => r.partial)).toHaveLength(1);
    expect(parsed.rows.filter((r) => r.yen === null)).toHaveLength(2);
    expect(parsed.rows.filter((r) => r.date === '2026-08-02')).toHaveLength(2);
  });
});

describe('csvFileName', () => {
  it('fuel-log-YYYY-MM-DD.csv', () => {
    expect(csvFileName('2026-09-17')).toBe('fuel-log-2026-09-17.csv');
  });
});
