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
};

const ToastCtx = createContext<ToastAPI | null>(null);

function ToastSlot({ item, onDone }: { item: ToastItem; onDone: (id: string) => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // trigger entrance animation on next frame
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!item.visible) {
      setShow(false);
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
        "pointer-events-auto rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-lg transition-all duration-200",
        accent,
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      ].join(" ")}
    >
      {item.message}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message: string, opts: PushOpts = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duration = typeof opts.duration === "number" ? opts.duration : 2500;
    const type: ToastType = opts.type || "default";

    setToasts((prev) => [...prev, { id, message, type, visible: true }]);

    const t = window.setTimeout(() => {
      // trigger exit animation
      setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, visible: false } : x)));
      timers.current.delete(id);
    }, duration);

    timers.current.set(id, t);
    return id;
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      {/* Toast container — sits above BottomTabBar on mobile */}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[20000] grid w-[min(420px,calc(100vw-24px))] -translate-x-1/2 gap-2 sm:bottom-6">
        {toasts.map((t) => (
          <ToastSlot key={t.id} item={t} onDone={removeToast} />
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
