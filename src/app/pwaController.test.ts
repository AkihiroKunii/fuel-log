import { describe, expect, it, vi } from 'vitest';
import { createPwaController } from './pwaController';

describe('PWAの更新と入力の保護', () => {
  it('新版が届いても明示操作まで更新しない。起動処理は二重登録しない', async () => {
    const controller = createPwaController();
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn((options) => { options.onNeedRefresh(); return update; });
    controller.start(register);
    controller.start(register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().updateAvailable).toBe(true);
    expect(update).not.toHaveBeenCalled();
    await controller.applyUpdate();
    expect(update).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('初回のキャッシュ完了と、再起動時の有効な登録で準備完了になる', () => {
    const initial = createPwaController();
    expect(initial.getSnapshot().offlineReady).toBe(false);
    initial.start((options) => { options.onOfflineReady(); return async () => {}; });
    expect(initial.getSnapshot().offlineReady).toBe(true);
    const reopened = createPwaController();
    reopened.start((options) => {
      options.onRegisteredSW('/sw.js', { active: { state: 'activated' } } as ServiceWorkerRegistration);
      return async () => {};
    });
    expect(reopened.getSnapshot().offlineReady).toBe(true);
  });
  it('登録失敗を準備完了と表示せず、内部エラー内容を露出しない', () => {
    const controller = createPwaController();
    controller.start((options) => { options.onRegisterError(new Error('internal detail')); return async () => {}; });
    expect(controller.getSnapshot().offlineReady).toBe(false);
    expect(controller.getSnapshot().error).toContain('準備ができません');
    expect(controller.getSnapshot().error).not.toContain('internal detail');
  });
  it('更新失敗後は入力をリセットせず再試行できる', async () => {
    const controller = createPwaController();
    const update = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    controller.start((options) => { options.onNeedRefresh(); return update; });
    await controller.applyUpdate();
    expect(controller.getSnapshot()).toMatchObject({ updating: false, updateAvailable: true });
    expect(controller.getSnapshot().error).toContain('更新できません');
    await controller.applyUpdate();
    expect(update).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().error).toBe('');
  });
  it('更新が無いときは再読込を要求しない', async () => {
    const controller = createPwaController();
    const update = vi.fn();
    controller.start(() => update);
    await controller.applyUpdate();
    expect(update).not.toHaveBeenCalled();
  });
});
