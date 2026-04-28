export function formatCurrency(amount: number, symbol = "₹", code = "INR"): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: abs % 1 === 0 ? 0 : 2 });
  return `${sign}${symbol}${formatted}`;
}

export function formatPercent(p: number, digits = 1): string {
  if (!isFinite(p)) return "—";
  return `${p > 0 ? "+" : ""}${p.toFixed(digits)}%`;
}

export function formatDelta(curr: number, prev: number): { pct: number; direction: "up" | "down" | "flat" } {
  if (prev === 0) {
    if (curr === 0) return { pct: 0, direction: "flat" };
    return { pct: 100, direction: curr > 0 ? "up" : "down" };
  }
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return { pct, direction: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat" };
}
