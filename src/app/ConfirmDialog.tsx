import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  // resolve は state の更新関数の中で呼ばない(StrictMode の二重実行を避ける)ため ref で持つ
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false); // 多重に開かれたら前の確認はキャンセル扱い
        resolverRef.current = resolve;
        setPending(opts);
      }),
    [],
  );

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();

    // シートの上に重ねて開くことがある。Esc は最前面のこのダイアログだけを閉じたいので、
    // capture で先に受けて伝播を止める(シート側の Esc ハンドラに届かせない)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={pending.message ? 'confirm-message' : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title">{pending.title}</h2>
            {pending.message && <p id="confirm-message">{pending.message}</p>}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'キャンセル'}
              </button>
              <button
                type="button"
                ref={confirmBtnRef}
                className={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
