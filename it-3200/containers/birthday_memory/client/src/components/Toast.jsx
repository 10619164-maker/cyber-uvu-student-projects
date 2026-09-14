import { useCallback, useEffect, useState } from 'react';

/** Single-slot toast: a new message replaces the previous one. */
export function useToast() {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return { toast, show, dismiss };
}

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast-layer" role="status" aria-live="polite">
      <div key={toast.key} className={`toast toast--${toast.tone}`}>
        <span className="toast__emoji" aria-hidden="true">
          {toast.tone === 'success' ? '🎉' : '⚠️'}
        </span>
        <p>{toast.message}</p>
        <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
