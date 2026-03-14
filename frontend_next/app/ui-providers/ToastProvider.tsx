// frontend_next/app/ui-providers/ToastProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "default" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  visible: boolean;
};

type PushOpts = {
  duration?: number;
  type?: ToastType;
};

type ToastAPI = {
  push: (message: string, opts?: PushOpts) => string;
  dismiss: (id: string) => void;
};

const ToastCtx = createContext<ToastAPI | null>(null);

function ToastSlot({
  item,
  onDone,
  onDismiss,
}: {
  item: ToastItem;
  onDone: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!item.visible) {
      requestAnimationFrame(() => setShow(false));
      const t = setTimeout(() => onDone(item.id), 220);
      return () => clearTimeout(t);
    }
  }, [item.visible, item.id, onDone]);

  const accent =
    item.type === "success"
      ? "border-l-4 border-l-emerald-500"
      : item.type === "error"
        ? "border-l-4 border-l-red-500"
        : "border-l-4 border-l-amber-500";

  return (
    <div
      className={[
        "pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg transition-all duration-200",
        accent,
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      ].join(" ")}
    >
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, visible: false } : x)));
  }, []);

  const push = useCallback((message: string, opts: PushOpts = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duration = typeof opts.duration === "number" ? opts.duration : 2500;
    const type: ToastType = opts.type || "default";

    setToasts((prev) => [...prev, { id, message, type, visible: true }]);

    const t = window.setTimeout(() => {
      setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, visible: false } : x)));
      timers.current.delete(id);
    }, duration);

    timers.current.set(id, t);
    return id;
  }, []);

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* Toast container — sits above BottomTabBar on mobile */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-20 left-1/2 z-[20000] grid w-[min(420px,calc(100vw-24px))] -translate-x-1/2 gap-2 sm:bottom-6"
      >
        {toasts.map((t) => (
          <ToastSlot key={t.id} item={t} onDone={removeToast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider />");
  return ctx;
}
