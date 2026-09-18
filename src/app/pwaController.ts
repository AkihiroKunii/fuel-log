export interface PwaState {
  offlineReady: boolean;
  updateAvailable: boolean;
  updating: boolean;
  error: string;
}

interface RegistrationOptions {
  immediate: boolean;
  onOfflineReady: () => void;
  onNeedRefresh: () => void;
  onRegisteredSW: (url: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError: (error: unknown) => void;
}
type Register = (options: RegistrationOptions) => (reloadPage?: boolean) => Promise<void>;

// 登録と更新を分離し、新版の到着だけでは入力中の画面を再読込しない。
export function createPwaController() {
  let state: PwaState = { offlineReady: false, updateAvailable: false, updating: false, error: '' };
  const listeners = new Set<() => void>();
  let update: ReturnType<Register> | undefined;
  let started = false;
  const publish = (patch: Partial<PwaState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start(register: Register) {
      if (started) return;
      started = true;
      try {
        update = register({
          immediate: true,
          onOfflineReady: () => publish({ offlineReady: true, error: '' }),
          onNeedRefresh: () => publish({ updateAvailable: true }),
          onRegisteredSW: (_url, registration) => {
            if (registration?.active?.state === 'activated') publish({ offlineReady: true });
          },
          onRegisterError: () => publish({ error: 'オフラインの準備ができませんでした。通信できる状態で開き直してください。' }),
        });
      } catch {
        publish({ error: 'このブラウザではオフライン利用の準備ができませんでした。' });
      }
    },
    async applyUpdate() {
      if (!state.updateAvailable || state.updating || !update) return;
      publish({ updating: true, error: '' });
      try {
        await update(true);
      } catch {
        publish({ error: '更新できませんでした。記録を保存してから、もう一度お試しください。' });
      } finally {
        publish({ updating: false });
      }
    },
  };
}

export const pwa = createPwaController();
