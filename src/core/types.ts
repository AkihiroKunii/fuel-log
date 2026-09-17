export type DateStr = string; // 'YYYY-MM-DD'(Asia/Tokyo 固定)

export interface Fillup {
  id?: number;
  date: DateStr;
  tripKm: number; // トリップメーターの値(前回リセットからの距離)
  liters: number;
  yen: number | null; // 税込支払額。未入力は null
  partial: boolean; // 満タンにしなかった
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}
export type StoredFillup = Fillup & { id: number };
export type FillupInput = Pick<Fillup, 'date' | 'tripKm' | 'liters' | 'yen' | 'partial'>;

export interface DerivedFillup extends StoredFillup {
  kmPerL: number | null;
  yenPerL: number | null;
  yenPerKm: number | null;
  mergedPartials: number; // この行の計算に合算した直前の部分給油の件数(通常 0)
}

export type RangeKey = '1m' | '6m' | '1y' | 'all';

export interface PeriodStats {
  count: number; // kmPerL が非 null の行数(平均・最高・最低の母数。画面の「件数」はこれ)
  fillupCount: number; // 期間内の全行数(部分給油を含む)
  avgKmPerL: number | null; // 単純平均
  maxKmPerL: number | null;
  minKmPerL: number | null;
  totalKm: number;
  totalLiters: number;
  totalYen: number; // yen が null の行は除く
}

export interface SettingRow {
  key: string;
  value: unknown;
}
