"use client";

import { useMemo, useState } from "react";
import { EventCard, EventCardSkeleton, eventGrid } from "@/components/event-card";
import { Reveal } from "@/components/motion";
import { PageHeader } from "@/components/page";
import { ButtonLink, Empty, inputClass } from "@/components/ui";
import { phaseOf } from "@/lib/events";
import { useAllEvents, useNow } from "@/lib/hooks";

const filters = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;

type Filter = (typeof filters)[number]["id"];

export default function EventsPage() {
  const { events, isLoading } = useAllEvents();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events ?? [])
      .filter(({ event }) => {
        const phase = phaseOf(event, now);
        const upcoming = phase === "on-sale" || phase === "doors" || phase === "live";
        if (filter === "upcoming" && !upcoming) return false;
        if (filter === "past" && upcoming) return false;
        return !q || event.name.toLowerCase().includes(q) || event.venue.toLowerCase().includes(q);
      })
      .sort((a, b) => (filter === "upcoming" ? Number(a.event.startTime - b.event.startTime) : 0));
  }, [events, filter, query, now]);

  return (
    <>
      <PageHeader label={`${events?.length ?? "—"} events // All onchain`} title="Events" />
      <section className="gutter flex flex-col gap-3 border-b border-ink py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`label border border-ink px-4 py-2.5 not-first:-ml-px ${filter === f.id ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or venue"
          className={`${inputClass} sm:max-w-sm`}
          aria-label="Search events"
        />
      </section>
      <section className="gutter py-10 md:py-14">
        {isLoading || !events ? (
          <div className={eventGrid}>
            {Array.from({ length: 8 }, (_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : shown.length > 0 ? (
          <Reveal type="stagger" key={filter} className={eventGrid}>
            {shown.map(({ event, tiers }) => (
              <EventCard key={event.id.toString()} event={event} tiers={tiers} />
            ))}
          </Reveal>
        ) : (
          <Empty title={query ? "No events match that." : filter === "past" ? "No past events yet." : "Nothing coming up yet."}>
            <ButtonLink href="/host/new">Host an event</ButtonLink>
          </Empty>
        )}
      </section>
    </>
  );
}
