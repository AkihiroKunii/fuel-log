import { describe, expect, it } from 'vitest';
import {
  backupFileName,
  backupToJson,
  buildBackup,
  parseBackup,
  type BackupFile,
} from './backup';
import { readSampleBackupJson, sampleFillups } from './testFixtures';
import type { SettingRow, StoredFillup } from './types';

function row(over: Partial<StoredFillup> = {}): StoredFillup {
  return {
    id: 1,
    date: '2026-09-01',
    tripKm: 412.3,
    liters: 28.5,
    yen: 4560,
    partial: false,
    createdAt: 1_757_000_000_000,
    updatedAt: 1_757_000_000_000,
    ...over,
  };
}

function jsonWithRow(over: Record<string, unknown>): string {
  const base: Record<string, unknown> = { ...row() };
  return JSON.stringify({
    app: 'fuel-log',
    schemaVersion: 1,
    exportedAt: '2026-09-17T00:00:00.000Z',
    tables: { fillups: [{ ...base, ...over }], settings: [] },
  });
}

describe('buildBackup', () => {
  it('app・schemaVersion・exportedAt を付け、fillups を昇順で入れる', () => {
    const backup = buildBackup(
      [row({ id: 2, date: '2026-09-10' }), row({ id: 1, date: '2026-09-01' })],
      [],
      new Date('2026-09-17T00:30:00.000Z'),
    );

    expect(backup.app).toBe('fuel-log');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe('2026-09-17T00:30:00.000Z');
    expect(backup.tables.fillups.map((r) => r.id)).toEqual([1, 2]);
    expect(backup.tables.settings).toEqual([]);
  });

  it('settings もそのまま入る', () => {
    const settings: SettingRow[] = [{ key: 'range', value: 'all' }];
    const backup = buildBackup([], settings, new Date('2026-09-17T00:00:00.000Z'));

    expect(backup.tables.settings).toEqual(settings);
  });
});

describe('parseBackup', () => {
  it('build → JSON → parse の往復で一致する', () => {
    const backup = buildBackup([row({ id: 1 }), row({ id: 2, date: '2026-09-10', yen: null })], [], new Date());
    const parsed = parseBackup(backupToJson(backup));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup).toEqual(backup);
  });

  it('サンプルバックアップを読める', () => {
    const parsed = parseBackup(readSampleBackupJson());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.tables.fillups).toHaveLength(15);
    expect(parsed.backup.tables.fillups.map((r) => r.id)).toEqual(sampleFillups().map((r) => r.id));
  });

  it('JSON でなければエラー', () => {
    const parsed = parseBackup('これはJSONではありません');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('JSON');
  });

  it('app が違えばエラー(他アプリのバックアップで DB を消さない)', () => {
    const parsed = parseBackup(
      JSON.stringify({ app: 'sleep-log', schemaVersion: 1, exportedAt: '', tables: { fillups: [], settings: [] } }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('fuel-log');
  });

  it('schemaVersion が違えばエラー', () => {
    const parsed = parseBackup(
      JSON.stringify({ app: 'fuel-log', schemaVersion: 2, exportedAt: '', tables: { fillups: [], settings: [] } }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('schemaVersion');
  });

  it('tables が無い・配列でないときはエラー', () => {
    expect(parseBackup(JSON.stringify({ app: 'fuel-log', schemaVersion: 1, exportedAt: '' })).ok).toBe(false);
    expect(
      parseBackup(JSON.stringify({ app: 'fuel-log', schemaVersion: 1, exportedAt: '', tables: { fillups: {}, settings: [] } }))
        .ok,
    ).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup('null').ok).toBe(false);
  });

  it('行の型が不正ならエラー(項目名が分かる)', () => {
    const cases: { over: Record<string, unknown>; field: string }[] = [
      { over: { id: '1' }, field: 'id' },
      { over: { id: 0 }, field: 'id' },
      { over: { date: '2026-02-30' }, field: 'date' },
      { over: { tripKm: '400' }, field: 'tripKm' },
      { over: { liters: null }, field: 'liters' },
      { over: { yen: '4560' }, field: 'yen' },
      { over: { partial: 'false' }, field: 'partial' },
      { over: { createdAt: null }, field: 'createdAt' },
      { over: { updatedAt: 'x' }, field: 'updatedAt' },
    ];

    for (const c of cases) {
      const parsed = parseBackup(jsonWithRow(c.over));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.error).toContain(c.field);
    }
  });

  it('値域が不正ならエラー', () => {
    for (const over of [{ tripKm: 0 }, { tripKm: 2001 }, { liters: 0.4 }, { liters: 121 }, { yen: -1 }, { yen: 50_001 }, { yen: 100.5 }]) {
      expect(parseBackup(jsonWithRow(over)).ok).toBe(false);
    }
  });

  it('yen は null を許す', () => {
    expect(parseBackup(jsonWithRow({ yen: null })).ok).toBe(true);
  });

  it('id が重複していればエラー', () => {
    const text = JSON.stringify({
      app: 'fuel-log',
      schemaVersion: 1,
      exportedAt: '2026-09-17T00:00:00.000Z',
      tables: { fillups: [row({ id: 1 }), row({ id: 1, date: '2026-09-02' })], settings: [] },
    });
    const parsed = parseBackup(text);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('id');
  });

  it('settings の行が不正ならエラー', () => {
    const text = JSON.stringify({
      app: 'fuel-log',
      schemaVersion: 1,
      exportedAt: '2026-09-17T00:00:00.000Z',
      tables: { fillups: [], settings: [{ value: 1 }] },
    });
    expect(parseBackup(text).ok).toBe(false);
  });

  it('余分な項目は落として正規化する', () => {
    const text = JSON.stringify({
      app: 'fuel-log',
      schemaVersion: 1,
      exportedAt: '2026-09-17T00:00:00.000Z',
      extra: 'ignored',
      tables: { fillups: [{ ...row(), note: 'ignored' }], settings: [] },
    });
    const parsed = parseBackup(text);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.tables.fillups[0]).toEqual(row());
    expect(parsed.backup).not.toHaveProperty('extra');
  });
});

describe('backupFileName / backupToJson', () => {
  it('fuel-log-backup-YYYY-MM-DD.json', () => {
    expect(backupFileName('2026-09-17')).toBe('fuel-log-backup-2026-09-17.json');
  });

  it('読みやすい JSON(末尾改行あり)', () => {
    const backup: BackupFile = buildBackup([], [], new Date('2026-09-17T00:00:00.000Z'));
    const text = backupToJson(backup);

    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "app": "fuel-log"');
  });
});
