'use client';

import { useAppStore } from '@/lib/store';

export function ToastContainer() {
  const { toasts } = useAppStore();

  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
