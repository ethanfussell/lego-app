// frontend_next/app/providers/ToastProvider.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "default" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type PushOpts = {
  duration?: number;
  type?: ToastType;
};

type ToastAPI = {
  push: (message: string, opts?: PushOpts) => string;
};

const ToastCtx = createContext<ToastAPI | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const push = useCallback((message: string, opts: PushOpts = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duration = typeof opts.duration === "number" ? opts.duration : 2200;
    const type: ToastType = opts.type || "default";

    setToasts((prev) => [...prev, { id, message, type }]);

    const t = window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, duration);

    timers.current.set(id, t);
    return id;
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[20000] grid w-[min(520px,calc(100vw-24px))] -translate-x-1/2 gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-none rounded-xl border border-white/10 bg-zinc-900/90 px-3 py-2 font-bold text-white shadow-[0_12px_35px_rgba(0,0,0,0.18)]"
          >
            {t.message}
          </div>
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