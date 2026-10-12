"use client";

interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  labelFor: string;
  /** Disables both +/- buttons — used when the item is out of stock or unpriced. */
  disabled?: boolean;
}

export function QtyStepper({ value, onChange, min = 1, max = 20, labelFor, disabled = false }: QtyStepperProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-paper">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="grid h-9 w-9 place-items-center rounded-full text-lg font-semibold text-soft transition hover:bg-cardamomdark disabled:opacity-30"
        aria-label={`Decrease ${labelFor}`}
      >
        −
      </button>
      <span className="w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="grid h-9 w-9 place-items-center rounded-full text-lg font-semibold text-soft transition hover:bg-cardamomdark disabled:opacity-30"
        aria-label={`Increase ${labelFor}`}
      >
        +
      </button>
    </div>
  );
}
