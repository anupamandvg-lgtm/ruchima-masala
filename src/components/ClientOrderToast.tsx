"use client";

import Link from "next/link";
import { useClientOrderAlerts } from "@/lib/client-order-alerts-context";

export function ClientOrderToast() {
  const { toasts, dismissToast } = useClientOrderAlerts();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Order Status Updates"
      aria-live="polite"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto transform transition-all duration-300 ease-out translate-y-0 opacity-100 rounded-2xl border-2 border-line bg-paper/95 p-4 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 p-1.5 rounded-xl bg-cardamom border border-line/50" aria-hidden="true">
              {toast.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-cumin truncate">{toast.title}</h4>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="text-soft hover:text-cumin text-base leading-none p-1 rounded-lg hover:bg-cardamom transition"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-soft mt-0.5 leading-relaxed">{toast.message}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-line/40 text-xs">
                <span className="font-mono font-bold text-terracotta">{toast.orderId}</span>
                <Link
                  href="/orders"
                  onClick={() => dismissToast(toast.id)}
                  className="font-semibold text-terracotta hover:text-paprika transition flex items-center gap-1"
                >
                  Track Order &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
    </aside>
  );
}
