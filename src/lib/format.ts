export function fmtEta(min: number) {
  if (min < 1) return "<1 min";
  if (min < 90) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
}

const NE_DIGITS = "०१२३४५६७८९";
export const toNepaliDigits = (s: string | number) => String(s).replace(/\d/g, (d) => NE_DIGITS[+d]);

export const fmtTemp = (t?: number) => (t === undefined || Number.isNaN(t) ? "—" : `${t > 0 ? "+" : ""}${t.toFixed(1)}°C`);
