"use client";

import type { OrderStatus } from "@/types";
import { ORDER_STATUS_FLOW } from "@/types";

interface StepConfig {
  key: OrderStatus;
  label: string;
  icon: string;
}

// Ruchima is delivery-only (no self-pickup concept) — single step list.
const STEPS: StepConfig[] = [
  { key: "Placed", label: "Placed", icon: "📝" },
  { key: "Paid", label: "Paid", icon: "✅" },
  { key: "Packed", label: "Packed", icon: "📦" },
  { key: "Shipped", label: "Shipped", icon: "🚚" },
  { key: "Delivered", label: "Delivered", icon: "🏡" },
];

export function OrderStatusSteps({ status }: { status: OrderStatus }) {
  if (status === "Cancelled") {
    return (
      <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-3 text-center text-sm font-semibold text-terracotta">
        ✖️ This order was cancelled
      </div>
    );
  }
  if (status === "Refunded") {
    return (
      <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-3 text-center text-sm font-semibold text-terracotta">
        ↩️ This order was refunded
      </div>
    );
  }

  const currentStep = ORDER_STATUS_FLOW[status] ?? 0;
  const pct = STEPS.length > 1 ? (currentStep / (STEPS.length - 1)) * 100 : 100;

  return (
    <div className="relative pt-1">
      {/* track + progress fill (drawn behind the dots) */}
      <div className="absolute left-[10%] right-[10%] top-[1.4rem] h-0.5 rounded bg-line" aria-hidden />
      <div
        className="absolute left-[10%] top-[1.4rem] h-0.5 rounded bg-terracotta transition-all duration-500"
        style={{ width: `${pct * 0.8}%` }}
        aria-hidden
      />

      <ol className="relative flex justify-between">
        {STEPS.map((step, i) => {
          const reached = i <= currentStep;
          const isCurrent = i === currentStep;
          return (
            <li key={step.key} className="flex flex-1 flex-col items-center text-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full border-2 bg-paper text-base transition ${
                  reached ? "border-terracotta text-terracotta" : "border-line text-soft/50"
                } ${isCurrent ? "bg-terracotta text-cardamom ring-4 ring-terracotta/15" : ""}`}
              >
                <span aria-hidden>{step.icon}</span>
              </div>
              <span
                className={`mt-1.5 max-w-[4.5rem] text-[10px] font-semibold leading-tight ${
                  reached ? "text-paprika" : "text-soft/60"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
