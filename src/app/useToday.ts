import { useEffect, useState } from 'react';
import { todayJst } from '../core/dates';
import type { DateStr } from '../core/types';

/**
 * Asia/Tokyo の「今日」。アプリを開いたまま日付をまたいでも、
 * 画面に戻ってきたとき(visibilitychange / focus)に更新される。
 */
export function useToday(): DateStr {
  const [today, setToday] = useState<DateStr>(() => todayJst());

  useEffect(() => {
    const refresh = () => setToday(todayJst());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return today;
}
