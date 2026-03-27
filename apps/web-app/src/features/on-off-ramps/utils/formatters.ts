/**
 * Format a number as MXN currency.
 */
export function formatMxn(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a crypto amount with up to 7 decimal places.
 */
export function formatCrypto(amount: string | number, symbol: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `— ${symbol}`;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 7 })} ${symbol}`;
}

/**
 * Mask a CLABE number showing only last 4 digits.
 * E.g. "646180157000000004" -> "•••• •••• •••• 0004"
 */
export function maskClabe(clabe: string): string {
  if (!clabe || clabe.length < 4) return clabe;
  const last4 = clabe.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

/**
 * Format seconds as MM:SS countdown string.
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format an exchange rate for display.
 */
export function formatRate(rate: string, from: string, to: string): string {
  const num = parseFloat(rate);
  if (isNaN(num)) return `1 ${from} = — ${to}`;
  return `1 ${from} = ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${to}`;
}
