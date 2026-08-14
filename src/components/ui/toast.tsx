"use client";
import * as React from "react";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
};

type ToastInput = Omit<Toast, "id">;

interface ToastContextValue {
  toast: (t: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function Toaster({ children = null }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (t: ToastInput) => {
      const id = `t${idRef.current++}`;
      setToasts((prev) => [...prev, { ...t, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border p-4 shadow-lg animate-fade-in-up ${
              t.variant === "destructive"
                ? "border-destructive bg-destructive text-destructive-foreground"
                : t.variant === "success"
                ? "border-accent bg-card"
                : "border-border bg-card"
            }`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description ? <p className="mt-1 text-sm opacity-90">{t.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
