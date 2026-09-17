import Dexie, { type Table } from 'dexie';
import type { Fillup, SettingRow, StoredFillup } from './types';

export class FuelLogDb extends Dexie {
  // 第3型引数(Fillup)は Table への add/put 用の「挿入型」。id は ++id で自動採番されるため、
  // 読み取り結果(StoredFillup, id必須)と挿入時の引数(Fillup, id省略可)を型で分けている。
  fillups!: Table<StoredFillup, number, Fillup>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('fuel-log');
    this.version(1).stores({
      fillups: '++id, date',
      settings: 'key',
    });
  }
}

export const db = new FuelLogDb();
