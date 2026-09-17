import { describe, expect, it } from 'vitest';
import { MESSAGES, validateFillupForm, type FillupFormValues } from './validation';

const TODAY = '2026-09-17';

function values(over: Partial<FillupFormValues> = {}): FillupFormValues {
  return { date: TODAY, tripKm: '412.3', liters: '28.5', yen: '4560', partial: false, ...over };
}

describe('validateFillupForm: 正常系', () => {
  it('4項目そろっていれば FillupInput になる', () => {
    const r = validateFillupForm(values(), TODAY);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      date: TODAY,
      tripKm: 412.3,
      liters: 28.5,
      yen: 4560,
      partial: false,
    });
  });

  it('金額が空欄なら yen は null', () => {
    const r = validateFillupForm(values({ yen: '' }), TODAY);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.yen).toBeNull();
  });

  it('金額が空白だけでも null', () => {
    const r = validateFillupForm(values({ yen: '   ' }), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.yen).toBeNull();
  });

  it('partial はそのまま通る', () => {
    const r = validateFillupForm(values({ partial: true }), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.partial).toBe(true);
  });

  it('全角数字・全角小数点・桁区切りカンマ・前後の空白を受理する', () => {
    const r = validateFillupForm(
      values({ tripKm: '１２３．４', liters: ' 28.50 ', yen: '1,234' }),
      TODAY,
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tripKm).toBe(123.4);
    expect(r.value.liters).toBe(28.5);
    expect(r.value.yen).toBe(1234);
  });
});

describe('validateFillupForm: 日付', () => {
  it('空文字は必須エラー', () => {
    const r = validateFillupForm(values({ date: '' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.date).toBe(MESSAGES.dateRequired);
  });

  it('実在しない日付・形式違いも同じ文言', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-9-1', '2026/09/17']) {
      const r = validateFillupForm(values({ date }), TODAY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.date).toBe(MESSAGES.dateRequired);
    }
  });

  it('今日は通り、翌日はエラー', () => {
    expect(validateFillupForm(values({ date: TODAY }), TODAY).ok).toBe(true);

    const r = validateFillupForm(values({ date: '2026-09-18' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.date).toBe(MESSAGES.futureDate);
  });

  it('うるう日も実在すれば通る', () => {
    expect(validateFillupForm(values({ date: '2028-02-29' }), '2028-03-01').ok).toBe(true);
  });
});

describe('validateFillupForm: 走行距離', () => {
  it('境界値: 1 と 2,000 は通り、0.9 と 2000.1 はエラー', () => {
    expect(validateFillupForm(values({ tripKm: '1' }), TODAY).ok).toBe(true);
    expect(validateFillupForm(values({ tripKm: '2000' }), TODAY).ok).toBe(true);

    for (const tripKm of ['0.9', '2000.1', '0']) {
      const r = validateFillupForm(values({ tripKm }), TODAY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.tripKm).toBe(MESSAGES.tripKmRange);
    }
  });

  it('必須', () => {
    const r = validateFillupForm(values({ tripKm: '' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.tripKm).toBe(MESSAGES.tripKmRequired);
  });

  it('小数は1桁まで(判定は文字列で行うので 412.10 も桁超過)', () => {
    expect(validateFillupForm(values({ tripKm: '412.3' }), TODAY).ok).toBe(true);

    for (const tripKm of ['412.34', '412.10']) {
      const r = validateFillupForm(values({ tripKm }), TODAY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.tripKm).toBe(MESSAGES.decimals1);
    }
  });
});

describe('validateFillupForm: 給油量', () => {
  it('境界値: 0.5 と 120 は通り、0.49 と 120.01 はエラー', () => {
    expect(validateFillupForm(values({ liters: '0.5' }), TODAY).ok).toBe(true);
    expect(validateFillupForm(values({ liters: '120' }), TODAY).ok).toBe(true);

    for (const liters of ['0.49', '120.01']) {
      const r = validateFillupForm(values({ liters }), TODAY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.liters).toBe(MESSAGES.litersRange);
    }
  });

  it('必須', () => {
    const r = validateFillupForm(values({ liters: '' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.liters).toBe(MESSAGES.litersRequired);
  });

  it('小数は2桁まで', () => {
    expect(validateFillupForm(values({ liters: '28.55' }), TODAY).ok).toBe(true);

    const r = validateFillupForm(values({ liters: '28.555' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.liters).toBe(MESSAGES.decimals2);
  });
});

describe('validateFillupForm: 金額', () => {
  it('境界値: 0 と 50,000 は通り、50,001 と小数はエラー', () => {
    expect(validateFillupForm(values({ yen: '0' }), TODAY).ok).toBe(true);
    expect(validateFillupForm(values({ yen: '50000' }), TODAY).ok).toBe(true);
    expect(validateFillupForm(values({ yen: '50,000' }), TODAY).ok).toBe(true);

    for (const yen of ['50001', '4560.5', '4560.0']) {
      const r = validateFillupForm(values({ yen }), TODAY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.yen).toBe(MESSAGES.yenRange);
    }
  });
});

describe('validateFillupForm: 数値として読めない入力', () => {
  it('末尾の小数点・先頭の小数点・指数表記・負数・文字は「数値で入力してください」', () => {
    for (const tripKm of ['412.', '.5', '1e3', '-5', 'abc', '４１２．', '１ ２']) {
      const r = validateFillupForm(values({ tripKm }), TODAY);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.errors.tripKm).toBe(MESSAGES.notNumber);
    }
  });

  it('金額の負数・指数表記も同じ', () => {
    const r = validateFillupForm(values({ yen: '-100' }), TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.yen).toBe(MESSAGES.notNumber);
  });
});

describe('validateFillupForm: 複数エラー', () => {
  it('項目ごとのエラーをまとめて返す', () => {
    const r = validateFillupForm(
      { date: '2026-09-18', tripKm: '', liters: '999', yen: 'abc', partial: false },
      TODAY,
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual({
      date: MESSAGES.futureDate,
      tripKm: MESSAGES.tripKmRequired,
      liters: MESSAGES.litersRange,
      yen: MESSAGES.notNumber,
    });
  });

  it('エラーが無ければ errors は返らない', () => {
    const r = validateFillupForm(values(), TODAY);
    expect(r).not.toHaveProperty('errors');
  });
});
