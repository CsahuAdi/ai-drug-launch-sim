const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,600 / ₹85.0 L / ₹1.50 Cr (Indian lakh/crore notation) */
export function formatINR(n: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (opts.compact !== false) {
    if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 1 : 2)} Cr`;
    if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1)} L`;
  }
  return `${sign}₹${inr.format(a)}`;
}

export const formatNumber = (n: number): string => (Number.isFinite(n) ? inr.format(Math.round(n)) : "—");

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function formatPct(x: number, digits = 1): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : "—";
}

export const formatMonth = (m: number | null): string => (m === null ? "Not reached" : `Month ${m}`);
