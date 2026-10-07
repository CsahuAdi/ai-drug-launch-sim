"use client";

import { useEffect, useId, useState } from "react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* --------------------------------- layout --------------------------------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, right, children, className }: { title?: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white p-5", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-800">{children}</h3>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "teal" | "amber" | "rose" | "indigo" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-teal-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  size = "md",
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
    ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
    danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        styles[variant],
      )}
    >
      {children}
    </button>
  );
}

export function Callout({ tone = "slate", title, children }: { tone?: "slate" | "amber" | "teal" | "rose"; title?: string; children: React.ReactNode }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-2 text-lg font-semibold text-slate-900">{title}</div>
      <p className="mb-5 max-w-md text-sm text-slate-600">{body}</p>
      {action}
    </div>
  );
}

/* -------------------------------- form inputs ------------------------------ */

export function Field({ label, hint, children, right }: { label: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-slate-800">{label}</label>
        {right}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Numeric input that lets the user type freely and commits (clamped) on blur / Enter. */
export function NumberBox({
  value,
  onChange,
  min,
  max,
  step = 1,
  scale = 1,
  prefix,
  suffix,
  width = "w-28",
  decimals = 0,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** displayed = value / scale */
  scale?: number;
  prefix?: string;
  suffix?: string;
  width?: string;
  decimals?: number;
  ariaLabel?: string;
}) {
  const shown = (value / scale).toFixed(decimals);
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(shown);
  }, [shown, focused]);

  const commit = () => {
    const n = parseFloat(text.replace(/,/g, ""));
    if (Number.isFinite(n)) {
      const clamped = Math.min(max, Math.max(min, n * scale));
      const snapped = Math.min(max, Math.max(min, Math.round(clamped / step) * step));
      onChange(Number(snapped.toFixed(6)));
    }
    setFocused(false);
    setText(shown);
  };

  return (
    <span className={cx("inline-flex items-center rounded-lg border border-slate-300 bg-white text-sm focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600", width)}>
      {prefix && <span className="pl-2.5 text-slate-500">{prefix}</span>}
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent px-2 py-1.5 text-right tabular-nums text-slate-900 outline-none"
        value={focused ? text : shown}
        onFocus={() => {
          setFocused(true);
          setText(shown);
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix && <span className="pr-2.5 text-slate-500">{suffix}</span>}
    </span>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  scale = 1,
  prefix,
  suffix,
  decimals = 0,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  scale?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  hint?: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <Field
      label={label}
      hint={hint}
      right={
        <NumberBox
          ariaLabel={label}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          scale={scale}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
        />
      }
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ ["--fill" as string]: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>
          {prefix}
          {(min / scale).toLocaleString("en-IN")}
          {suffix}
        </span>
        <span>
          {prefix}
          {(max / scale).toLocaleString("en-IN")}
          {suffix}
        </span>
      </div>
    </Field>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
            o.value === value ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1",
        checked ? "bg-teal-700" : "bg-slate-300",
      )}
    >
      <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function SelectBox<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel?: string }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---------------------------------- KPIs ---------------------------------- */

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div
        className={cx(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "good" ? "text-teal-800" : tone === "warn" ? "text-amber-700" : "text-slate-900",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
