"use client";

import Link from "next/link";
import { phaseOf, type Tier, type TurnoutEvent } from "@/lib/events";
import { eventDay, eventTime, usdc } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { PhaseTag, Poster, Skeleton } from "./ui";

export function EventCard({ event, tiers }: { event: TurnoutEvent; tiers: Tier[] }) {
  const now = useNow(30_000);
  const phase = phaseOf(event, now);
  const from = tiers.reduce((min, t) => (t.price < min ? t.price : min), tiers[0]?.price ?? 0n);
  const capacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  const left = capacity - event.ticketCount + event.refundedCount;

  return (
    <Link href={`/events/${event.id}`} className="group flex flex-col border border-ink bg-paper transition-colors hover:bg-white">
      <div className="relative aspect-4/3 overflow-hidden border-b border-ink sm:aspect-4/5">
        <div className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]">
          <Poster uri={event.imageURI} name={event.name} id={event.id} />
        </div>
        <PhaseTag phase={phase} className="absolute top-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <span className="label text-ink-2">
          {eventDay(event.startTime)}{" // "}{eventTime(event.startTime)}
        </span>
        <h3 className="headline text-2xl leading-[0.95] tracking-[-0.03em]">{event.name}</h3>
        {event.venue && <p className="text-sm text-ink-2">{event.venue}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-ink/15 pt-3">
          <span className="label">From {usdc(from)}</span>
          <span className="label text-ink-2">{left > 0 ? `${left} left` : "Sold out"}</span>
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col border border-ink">
      <Skeleton className="aspect-4/5" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export const eventGrid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
