import { formatUnits, parseUnits, type Address } from "viem";

// Native USDC on Arc has 18 decimals; prices are kept to whole micro-USDC (6 decimals).
const MICRO = 10n ** 12n;

export function usdc(amount: bigint, { symbol = true }: { symbol?: boolean } = {}) {
  const value = Number(formatUnits(amount, 18));
  const text = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
  });
  return symbol ? `$${text}` : text;
}

export function parseUsdc(input: string): bigint | null {
  const clean = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) return null;
  return parseUnits(clean, 6) * MICRO;
}

export function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function sameAddress(a?: Address | string, b?: Address | string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "2-digit", month: "short" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
const fullFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const toDate = (seconds: bigint | number) => new Date(Number(seconds) * 1000);

export function eventDay(seconds: bigint | number) {
  return dayFormat.format(toDate(seconds)).replace(",", "").toUpperCase();
}

export function eventTime(seconds: bigint | number) {
  return timeFormat.format(toDate(seconds));
}

export function eventDate(seconds: bigint | number) {
  return fullFormat.format(toDate(seconds));
}

export function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
