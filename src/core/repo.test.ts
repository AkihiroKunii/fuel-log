import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, backupToJson, parseBackup } from './backup';
import { parseCsv, toCsv } from './csv';
import { db } from './db';
import { deriveFillups } from './fuel';
import {
  addFillup,
  appendFillups,
  deleteAllFillups,
  deleteFillup,
  getAllFillups,
  getAllSettings,
  restoreBackup,
  updateFillup,
} from './repo';
import { sampleFillups } from './testFixtures';
import type { FillupInput } from './types';

const TODAY = '2026-09-17';

const INPUT: FillupInput = {
  date: '2026-09-01',
  tripKm: 412.3,
  liters: 28.5,
  yen: 4560,
  partial: false,
};

function toInput(r: {
  date: string;
  tripKm: number;
  liters: number;
  yen: number | null;
  partial: boolean;
}): FillupInput {
  return { date: r.date, tripKm: r.tripKm, liters: r.liters, yen: r.yen, partial: r.partial };
}

beforeEach(async () => {
  await db.fillups.clear();
  await db.settings.clear();
});

describe('addFillup', () => {
  it('createdAt と updatedAt に now を入れて1件追加する', async () => {
    const id = await addFillup(INPUT, 1000);
    const row = await db.fillups.get(id);

    expect(row).toMatchObject({ ...INPUT, createdAt: 1000, updatedAt: 1000 });
    expect(row?.id).toBe(id);
  });
});

describe('updateFillup', () => {
  it('createdAt は維持し、updatedAt だけ更新する', async () => {
    const id = await addFillup(INPUT, 1000);
    await updateFillup(id, { ...INPUT, tripKm: 300, partial: true }, 2000);

    const row = await db.fillups.get(id);
    expect(row?.tripKm).toBe(300);
    expect(row?.partial).toBe(true);
    expect(row?.createdAt).toBe(1000);
    expect(row?.updatedAt).toBe(2000);
  });

  it('存在しない id なら何も起きない', async () => {
    await expect(updateFillup(9999, INPUT, 2000)).resolves.toBeUndefined();
    expect(await db.fillups.count()).toBe(0);
  });
});

describe('deleteFillup / deleteAllFillups', () => {
  it('1件削除する(物理削除)', async () => {
    const id1 = await addFillup(INPUT, 1000);
    const id2 = await addFillup({ ...INPUT, date: '2026-09-02' }, 1000);

    await deleteFillup(id1);

    const rows = await getAllFillups();
    expect(rows.map((r) => r.id)).toEqual([id2]);
  });

  it('全削除する', async () => {
    await appendFillups([INPUT, { ...INPUT, date: '2026-09-02' }], 1000);
    await deleteAllFillups();

    expect(await getAllFillups()).toEqual([]);
  });
});

describe('appendFillups', () => {
  it('入力順に id を振り、件数を返す', async () => {
    const inputs: FillupInput[] = [
      { ...INPUT, date: '2026-09-03', tripKm: 300 },
      { ...INPUT, date: '2026-09-01', tripKm: 100 },
      { ...INPUT, date: '2026-09-02', tripKm: 200 },
    ];

    const count = await appendFillups(inputs, 1234);
    expect(count).toBe(3);

    const rows = (await getAllFillups()).sort((a, b) => a.id - b.id);
    expect(rows.map((r) => r.tripKm)).toEqual([300, 100, 200]); // 日付順ではなく入力順
    expect(rows[1].id).toBe(rows[0].id + 1);
    expect(rows[2].id).toBe(rows[0].id + 2);
    expect(rows.every((r) => r.createdAt === 1234 && r.updatedAt === 1234)).toBe(true);
  });

  it('空配列なら0件', async () => {
    expect(await appendFillups([], 1000)).toBe(0);
    expect(await db.fillups.count()).toBe(0);
  });

  it('既存データがあれば追記になる', async () => {
    await addFillup(INPUT, 1000);
    await appendFillups([{ ...INPUT, date: '2026-09-02' }], 1000);

    expect(await db.fillups.count()).toBe(2);
  });
});

describe('restoreBackup', () => {
  it('既存を置き換え、id と createdAt を維持する', async () => {
    await addFillup({ ...INPUT, date: '2026-01-01' }, 1);
    const backup = buildBackup(sampleFillups(), [{ key: 'memo', value: 1 }], new Date());

    await restoreBackup(backup);

    const rows = (await getAllFillups()).sort((a, b) => a.id - b.id);
    expect(rows).toHaveLength(15);
    expect(rows).toEqual(backup.tables.fillups);
    expect(await getAllSettings()).toEqual([{ key: 'memo', value: 1 }]);
  });

  it('空のバックアップなら全削除になる', async () => {
    await addFillup(INPUT, 1000);
    await restoreBackup(buildBackup([], [], new Date()));

    expect(await getAllFillups()).toEqual([]);
  });
});

describe('受け入れ条件4', () => {
  it('CSV書き出し → 全削除 → CSV取込 で件数と値が一致する', async () => {
    await appendFillups(sampleFillups().map(toInput), 1000);
    const before = await getAllFillups();
    const csv = toCsv(deriveFillups(before));

    await deleteAllFillups();
    const parsed = parseCsv(csv, TODAY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const count = await appendFillups(parsed.rows, 2000);

    const after = await getAllFillups();
    expect(count).toBe(before.length);
    expect(after).toHaveLength(15);
    expect(after.map(toInput)).toEqual(before.map(toInput)); // date/tripKm/liters/yen/partial が一致
  });

  it('JSONバックアップ → 全削除 → 復元 で id・createdAt も一致する', async () => {
    await appendFillups(sampleFillups().map(toInput), 1000);
    const before = await getAllFillups();
    const json = backupToJson(buildBackup(before, await getAllSettings(), new Date()));

    await deleteAllFillups();
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await restoreBackup(parsed.backup);

    const after = (await getAllFillups()).sort((a, b) => a.id - b.id);
    expect(after).toEqual(before.slice().sort((a, b) => a.id - b.id));
  });
});
