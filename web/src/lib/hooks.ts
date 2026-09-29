"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Address, ContractFunctionArgs, ContractFunctionName } from "viem";
import { useBalance, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { turnoutAbi } from "./abi";
import { turnoutAddress } from "./config";
import { friendlyError } from "./errors";
import type { Ticket, Tier, TurnoutEvent } from "./events";

const contract = { address: turnoutAddress, abi: turnoutAbi } as const;
const PAGE = 500n;

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useEventsById(ids: bigint[]) {
  const query = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...contract, functionName: "getEvent", args: [id] } as const,
      { ...contract, functionName: "getTiers", args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0 },
  });

  const events = useMemo(() => {
    if (!query.data) return undefined;
    const list: { event: TurnoutEvent; tiers: Tier[] }[] = [];
    ids.forEach((id, i) => {
      const e = query.data[i * 2];
      const t = query.data[i * 2 + 1];
      if (e?.status !== "success" || t?.status !== "success") return;
      list.push({ event: { ...(e.result as Omit<TurnoutEvent, "id">), id }, tiers: t.result as Tier[] });
    });
    return list;
  }, [query.data, ids]);

  return { ...query, events: ids.length === 0 ? [] : events };
}

export function useAllEvents() {
  const count = useReadContract({ ...contract, functionName: "eventCount" });
  const ids = useMemo(() => {
    const n = Number(count.data ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(n - i));
  }, [count.data]);
  const result = useEventsById(ids);
  return { ...result, isLoading: count.isLoading || result.isLoading, events: count.data === undefined ? undefined : result.events };
}

export function useEvent(id?: bigint) {
  const ids = useMemo(() => (id ? [id] : []), [id]);
  const { events, ...rest } = useEventsById(ids);
  return { ...rest, event: events?.[0]?.event, tiers: events?.[0]?.tiers, notFound: rest.isFetched && events?.length === 0 };
}

export function useHostEvents(host?: Address) {
  const res = useReadContract({
    ...contract,
    functionName: "getHostEvents",
    args: host ? [host, 0n, PAGE] : undefined,
    query: { enabled: !!host },
  });
  const ids = useMemo(() => [...(res.data?.[0] ?? [])].reverse(), [res.data]);
  const result = useEventsById(ids);
  return { ...result, isLoading: res.isLoading || result.isLoading, events: res.data === undefined ? undefined : result.events };
}

export function useBuyerTickets(buyer?: Address) {
  const res = useReadContract({
    ...contract,
    functionName: "getBuyerTickets",
    args: buyer ? [buyer, 0n, PAGE] : undefined,
    query: { enabled: !!buyer },
  });
  const tickets = res.data?.[0] as Ticket[] | undefined;
  const eventIds = useMemo(() => [...new Set((tickets ?? []).map((t) => t.eventId))].sort((a, b) => Number(b - a)), [tickets]);
  const events = useEventsById(eventIds);
  return {
    tickets,
    events: events.events,
    isLoading: res.isLoading || events.isLoading,
    refetch: () => Promise.all([res.refetch(), events.refetch()]),
  };
}

export function useEventTickets(eventId?: bigint) {
  const res = useReadContract({
    ...contract,
    functionName: "getEventTickets",
    args: eventId ? [eventId, 0n, PAGE] : undefined,
    query: { enabled: !!eventId },
  });
  return { ...res, tickets: res.data?.[0] as Ticket[] | undefined };
}

export function useHostProfile(host?: Address) {
  const res = useReadContracts({
    contracts: host
      ? [
          { ...contract, functionName: "hostName", args: [host] },
          { ...contract, functionName: "getHostStats", args: [host] },
        ]
      : [],
    query: { enabled: !!host },
  });
  const name = res.data?.[0]?.result as string | undefined;
  const stats = res.data?.[1]?.result as
    | { eventsCreated: bigint; eventsCancelled: bigint; ticketsSold: bigint; ticketsCheckedIn: bigint; ticketsRefunded: bigint }
    | undefined;
  return { ...res, name, stats };
}

export function useProtocolStats() {
  const counts = useReadContracts({
    contracts: [
      { ...contract, functionName: "eventCount" },
      { ...contract, functionName: "ticketCount" },
    ],
  });
  const escrow = useBalance({ address: turnoutAddress, query: { enabled: !!turnoutAddress } });
  return {
    events: counts.data?.[0]?.result as bigint | undefined,
    tickets: counts.data?.[1]?.result as bigint | undefined,
    escrow: escrow.data?.value,
    isLoading: counts.isLoading || escrow.isLoading,
  };
}

type TxState = { status: "idle" | "signing" | "pending" | "success" | "error"; error?: string; hash?: `0x${string}` };

type WriteFn = ContractFunctionName<typeof turnoutAbi, "nonpayable" | "payable">;
type WriteRequest<F extends WriteFn> = {
  functionName: F;
  args: ContractFunctionArgs<typeof turnoutAbi, "nonpayable" | "payable", F>;
  value?: bigint;
};

export function useTurnoutTx() {
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<TxState>({ status: "idle" });

  async function send<F extends WriteFn>(request: WriteRequest<F>) {
    setState({ status: "signing" });
    try {
      const hash = await writeContractAsync({ ...contract, ...request } as Parameters<typeof writeContractAsync>[0]);
      setState({ status: "pending", hash });
      const receipt = await client!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted.");
      setState({ status: "success", hash });
      await queryClient.invalidateQueries();
      return receipt;
    } catch (error) {
      setState({ status: "error", error: friendlyError(error) });
      return undefined;
    }
  }

  return { ...state, send, reset: () => setState({ status: "idle" }), busy: state.status === "signing" || state.status === "pending" };
}

export { contract as turnoutContract };
