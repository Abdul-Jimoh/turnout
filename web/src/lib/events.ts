import type { Address } from "viem";
import { CLAIM_WINDOW } from "./config";

export type TurnoutEvent = {
  id: bigint;
  host: Address;
  startTime: bigint;
  endTime: bigint;
  checkInOpensAt: bigint;
  cancelled: boolean;
  ticketCount: number;
  checkedInCount: number;
  refundedCount: number;
  soldAmount: bigint;
  checkedInAmount: bigint;
  refundedAmount: bigint;
  withdrawnAmount: bigint;
  name: string;
  venue: string;
  description: string;
  imageURI: string;
};

export type Tier = {
  name: string;
  price: bigint;
  capacity: number;
  sold: number;
};

export type Ticket = {
  id: bigint;
  eventId: bigint;
  holder: Address;
  tier: number;
  price: bigint;
  status: TicketStatus;
};

export enum TicketStatus {
  None = 0,
  Valid = 1,
  CheckedIn = 2,
  Refunded = 3,
}

export type Phase = "cancelled" | "on-sale" | "doors" | "live" | "claims" | "settled";

export function phaseOf(e: Pick<TurnoutEvent, "cancelled" | "startTime" | "endTime" | "checkInOpensAt">, now: number): Phase {
  const t = BigInt(Math.floor(now));
  if (e.cancelled) return "cancelled";
  if (t > e.endTime + CLAIM_WINDOW) return "settled";
  if (t > e.endTime) return "claims";
  if (t >= e.startTime) return "live";
  if (t >= e.checkInOpensAt) return "doors";
  return "on-sale";
}

export const phaseLabel: Record<Phase, string> = {
  cancelled: "Cancelled",
  "on-sale": "On sale",
  doors: "Doors open",
  live: "Happening now",
  claims: "Claim window",
  settled: "Settled",
};

export function canBuy(phase: Phase) {
  return phase === "on-sale" || phase === "doors";
}

export function withdrawable(e: TurnoutEvent, now: number) {
  const earned = !e.cancelled && BigInt(Math.floor(now)) > e.endTime + CLAIM_WINDOW ? e.soldAmount - e.refundedAmount : e.checkedInAmount;
  return earned - e.withdrawnAmount;
}

export function ticketRefundable(ticket: Ticket, e: TurnoutEvent, now: number) {
  if (ticket.status !== TicketStatus.Valid) return false;
  if (e.cancelled) return true;
  const t = BigInt(Math.floor(now));
  return t > e.endTime && t <= e.endTime + CLAIM_WINDOW;
}

export const ticketStatusLabel: Record<TicketStatus, string> = {
  [TicketStatus.None]: "Unknown",
  [TicketStatus.Valid]: "Valid",
  [TicketStatus.CheckedIn]: "Checked in",
  [TicketStatus.Refunded]: "Refunded",
};
