import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { formatKmPerL } from '../../core/format';
import { previewKmPerL } from '../../core/fuel';
import type { DateStr, FillupInput, StoredFillup } from '../../core/types';
import {
  validateFillupForm,
  type FillupField,
  type FillupFormErrors,
  type FillupFormValues,
} from '../../core/validation';

export interface FillupFormProps {
  mode: 'create' | 'edit';
  initial?: StoredFillup; // edit のとき
  existing: readonly StoredFillup[]; // プレビュー計算用の全データ
  today: DateStr;
  submitLabel: string; // '保存' / '変更を保存'
  onSubmit: (input: FillupInput) => Promise<void>;
  footer?: ReactNode; // 編集シートの「削除」ボタン等
  onDirty?: () => void; // 入力が始まったとき(前回の「保存しました」を片付ける合図)
}

// エラー表示・フォーカス移動の順序(上から下)
const FIELD_ORDER: FillupField[] = ['date', 'tripKm', 'liters', 'yen'];

export function FillupForm({
  mode,
  initial,
  existing,
  today,
  submitLabel,
  onSubmit,
  footer,
  onDirty,
}: FillupFormProps) {
  const idPrefix = useId();

  const [date, setDate] = useState<string>(initial?.date ?? today);
  const [tripKm, setTripKm] = useState<string>(initial ? String(initial.tripKm) : '');
  const [liters, setLiters] = useState<string>(initial ? String(initial.liters) : '');
  const [yen, setYen] = useState<string>(initial?.yen != null ? String(initial.yen) : '');
  const [partial, setPartial] = useState<boolean>(initial?.partial ?? false);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(initial?.partial ?? false);
  // 新規入力で日付を手で変えていない間は、日付が変わったら(アプリを開いたまま翌日になったら)今日に追従させる。
  // ホーム画面PWAは何日もメモリに残るので、これが無いと古い日付のまま保存してしまう。
  const [dateTouched, setDateTouched] = useState(false);
  useEffect(() => {
    if (mode === 'create' && !dateTouched) setDate(today);
  }, [mode, dateTouched, today]);

  const [errors, setErrors] = useState<FillupFormErrors>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const tripKmRef = useRef<HTMLInputElement>(null);
  const litersRef = useRef<HTMLInputElement>(null);
  const yenRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<FillupField, RefObject<HTMLInputElement | null>> = {
    date: dateRef,
    tripKm: tripKmRef,
    liters: litersRef,
    yen: yenRef,
  };

  const values: FillupFormValues = { date, tripKm, liters, yen, partial };

  // 保存ボタンの上に出す算出燃費プレビュー。検証と同じ正規化を使うため validateFillupForm の結果をそのまま使う
  // (結果が ok ならその値でプレビュー、ダメなら何も出さない)。
  const validation = useMemo(
    () => validateFillupForm(values, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, tripKm, liters, yen, partial, today],
  );
  const previewValue = useMemo(() => {
    if (!validation.ok) return null;
    return previewKmPerL(existing, validation.value, initial?.id);
  }, [validation, existing, initial?.id]);

  // 全欄の onChange から呼ぶ。一度保存を押してエラーが出た後は、入力のたびに再検証してエラーを消していく
  function revalidate(next: FillupFormValues) {
    onDirty?.();
    if (!triedSubmit) return;
    const result = validateFillupForm(next, today);
    setErrors(result.ok ? {} : result.errors);
  }

  function resetForm() {
    setDate(today);
    setDateTouched(false);
    setTripKm('');
    setLiters('');
    setYen('');
    setPartial(false);
    setDetailsOpen(false);
    setErrors({});
    setTriedSubmit(false);
  }

  function focusFirstError(fieldErrors: FillupFormErrors) {
    for (const field of FIELD_ORDER) {
      if (fieldErrors[field]) {
        fieldRefs[field].current?.focus();
        return;
      }
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setTriedSubmit(true);
    const result = validateFillupForm(values, today);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstError(result.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.value);
      if (mode === 'create') {
        resetForm();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    } catch {
      // 失敗時の通知は呼び出し側(onSubmit)の責務。ここでは入力を保持したまま何もしない。
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="fillup-form" onSubmit={handleSubmit} noValidate>
      <div className="field-inline">
        <label className="field-label" htmlFor={`${idPrefix}-date`}>
          日付
        </label>
        <div className="field-input-wrap">
          <input
            ref={dateRef}
            id={`${idPrefix}-date`}
            type="date"
            max={today}
            value={date}
            enterKeyHint="next"
            aria-invalid={errors.date ? 'true' : undefined}
            aria-describedby={errors.date ? `${idPrefix}-date-error` : undefined}
            onChange={(e) => {
              setDate(e.target.value);
              setDateTouched(true);
              revalidate({ ...values, date: e.target.value });
            }}
          />
        </div>
        {errors.date && (
          <p className="field-error" id={`${idPrefix}-date-error`}>
            {errors.date}
          </p>
        )}
      </div>

      <div className="fillup-grid">
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-tripKm`}>
            走行距離
          </label>
          <div className="field-input-wrap">
            <input
              ref={tripKmRef}
              id={`${idPrefix}-tripKm`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="0.0"
              value={tripKm}
              aria-invalid={errors.tripKm ? 'true' : undefined}
              aria-describedby={errors.tripKm ? `${idPrefix}-tripKm-error` : undefined}
              onChange={(e) => {
                setTripKm(e.target.value);
                revalidate({ ...values, tripKm: e.target.value });
              }}
            />
            <span className="field-unit" aria-hidden="true">
              km
            </span>
          </div>
          {errors.tripKm && (
            <p className="field-error" id={`${idPrefix}-tripKm-error`}>
              {errors.tripKm}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-liters`}>
            給油量
          </label>
          <div className="field-input-wrap">
            <input
              ref={litersRef}
              id={`${idPrefix}-liters`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="0.00"
              value={liters}
              aria-invalid={errors.liters ? 'true' : undefined}
              aria-describedby={errors.liters ? `${idPrefix}-liters-error` : undefined}
              onChange={(e) => {
                setLiters(e.target.value);
                revalidate({ ...values, liters: e.target.value });
              }}
            />
            <span className="field-unit" aria-hidden="true">
              L
            </span>
          </div>
          {errors.liters && (
            <p className="field-error" id={`${idPrefix}-liters-error`}>
              {errors.liters}
            </p>
          )}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-yen`}>
          給油金額（任意）
        </label>
        <div className="field-input-wrap">
          <input
            ref={yenRef}
            id={`${idPrefix}-yen`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0"
            value={yen}
            aria-invalid={errors.yen ? 'true' : undefined}
            aria-describedby={errors.yen ? `${idPrefix}-yen-error` : undefined}
            onChange={(e) => {
              setYen(e.target.value);
              revalidate({ ...values, yen: e.target.value });
            }}
          />
          <span className="field-unit" aria-hidden="true">
            円
          </span>
        </div>
        {errors.yen && (
          <p className="field-error" id={`${idPrefix}-yen-error`}>
            {errors.yen}
          </p>
        )}
      </div>

      <div className="fillup-meta-row">
        <button
          type="button"
          className="fillup-details-toggle"
          aria-expanded={detailsOpen}
          aria-controls={`${idPrefix}-details`}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          詳細
        </button>
        <div className="fillup-preview" aria-live="polite">
          {validation.ok && partial && (
            <span className="fillup-preview-note">燃費は次の満タン時に算出</span>
          )}
          {validation.ok && !partial && previewValue !== null && (
            <>
              <span className="fillup-preview-arrow" aria-hidden="true">
                →
              </span>
              <strong>{formatKmPerL(previewValue)}</strong>
              <span className="fillup-preview-unit">km/L</span>
            </>
          )}
        </div>
      </div>
      {detailsOpen && (
        <div className="fillup-details-body" id={`${idPrefix}-details`}>
          <label className="fillup-checkbox">
            <input
              type="checkbox"
              checked={partial}
              onChange={(e) => {
                setPartial(e.target.checked);
                revalidate({ ...values, partial: e.target.checked });
              }}
            />
            満タンにしなかった
          </label>
          <p className="hint">
            トリップメーターはいつも通りリセットしてください。燃費は次の満タン給油のときにまとめて計算します。
          </p>
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitLabel}
      </button>

      {footer && <div className="fillup-footer">{footer}</div>}
    </form>
  );
}
