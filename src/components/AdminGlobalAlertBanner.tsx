"use client";

import { useAdminAlerts } from "@/lib/admin-alerts-context";

export function AdminGlobalAlertBanner() {
  const { alerts } = useAdminAlerts();

  if (alerts.queue.length === 0) return null;

  const latest = alerts.queue[alerts.queue.length - 1];
  const summary = latest.items.map((i) => `${i.name}×${i.qty}`).join(", ");

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:w-[480px] z-50 animate-pulse-alert rounded-2xl border-2 border-terracotta bg-paper p-4 sm:p-5 shadow-2xl backdrop-blur-md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terracotta opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-terracotta"></span>
            </span>
            <p className="text-xs font-black uppercase tracking-wider text-paprika">
              🔔 {alerts.queue.length === 1 ? "New Incoming Order!" : `${alerts.queue.length} New Orders Waiting!`}
            </p>
          </div>
          <button
            onClick={alerts.toggleMute}
            className="text-xs px-2.5 py-1 rounded-lg border border-line bg-cardamom font-medium text-cumin hover:bg-line/40 transition"
            title={alerts.muted ? "Sound muted — tap to unmute" : "Sound on — tap to mute"}
          >
            {alerts.muted ? "🔇 Muted" : "🔊 Sound On"}
          </button>
        </div>

        <div className="rounded-xl bg-cardamom/70 p-3 border border-line/50">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-base font-extrabold text-paprika">{latest.orderId}</span>
            <span className="text-xs font-bold text-cumin bg-white px-2 py-0.5 rounded-full border border-line">
              ₹{latest.grandTotal}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-cumin">{latest.customerName} · {latest.phone}</p>
          <p className="text-xs text-soft mt-0.5">{summary}</p>
          <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-turmericgold/20 text-turmericdark border border-turmericgold/30">
            Shipped Delivery
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-soft">
            {alerts.queue.length > 1
              ? `+ ${alerts.queue.length - 1} more order(s) queued`
              : "Looping alert active"}
          </p>
          <button
            onClick={alerts.acknowledge}
            autoFocus
            className="btn btn-terracotta px-4 py-2 text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-1.5"
          >
            <span>✅</span>
            <span>Got it — start preparing</span>
          </button>
        </div>
      </div>
    </div>
  );
}
