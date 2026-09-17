import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';

describe('db', () => {
  beforeEach(async () => {
    await db.fillups.clear();
    await db.settings.clear();
  });

  it('adds a fillup row and reads it back', async () => {
    const id = await db.fillups.add({
      date: '2026-09-17',
      tripKm: 412.3,
      liters: 28.5,
      yen: 4560,
      partial: false,
      createdAt: 1,
      updatedAt: 1,
    });

    const row = await db.fillups.get(id);
    expect(row).toBeDefined();
    expect(row?.date).toBe('2026-09-17');
    expect(row?.tripKm).toBe(412.3);
    expect(row?.liters).toBe(28.5);
    expect(row?.yen).toBe(4560);
    expect(row?.partial).toBe(false);
  });

  it('orders rows by the date index', async () => {
    await db.fillups.bulkAdd([
      { date: '2026-09-10', tripKm: 300, liters: 20, yen: null, partial: false, createdAt: 1, updatedAt: 1 },
      { date: '2026-08-01', tripKm: 250, liters: 18, yen: null, partial: false, createdAt: 2, updatedAt: 2 },
      { date: '2026-09-17', tripKm: 400, liters: 28, yen: null, partial: false, createdAt: 3, updatedAt: 3 },
    ]);

    const rows = await db.fillups.orderBy('date').toArray();
    expect(rows.map((r) => r.date)).toEqual(['2026-08-01', '2026-09-10', '2026-09-17']);
  });
});
