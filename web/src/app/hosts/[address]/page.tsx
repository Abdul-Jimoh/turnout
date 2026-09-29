"use client";

import { use } from "react";
import { isAddress, type Address } from "viem";
import { EventCard, EventCardSkeleton, eventGrid } from "@/components/event-card";
import { Reveal } from "@/components/motion";
import { PageHeader, StatBox } from "@/components/page";
import { ButtonLink, Empty, Joined, Label } from "@/components/ui";
import { explorerUrl } from "@/lib/config";
import { phaseOf } from "@/lib/events";
import { shortAddress } from "@/lib/format";
import { useHostEvents, useHostProfile, useNow } from "@/lib/hooks";

export default function HostProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  if (!isAddress(address)) {
    return (
      <section className="gutter py-20">
        <Empty title="That isn't a valid host address.">
          <ButtonLink href="/events">Browse events</ButtonLink>
        </Empty>
      </section>
    );
  }
  return <Profile host={address} />;
}

function Profile({ host }: { host: Address }) {
  const { name, stats } = useHostProfile(host);
  const { events, isLoading } = useHostEvents(host);
  const now = useNow(60_000);

  const sold = Number(stats?.ticketsSold ?? 0n);
  const checkedIn = Number(stats?.ticketsCheckedIn ?? 0n);
  const upcoming = events?.filter(({ event }) => ["on-sale", "doors", "live"].includes(phaseOf(event, now))) ?? [];
  const past = events?.filter(({ event }) => !["on-sale", "doors", "live"].includes(phaseOf(event, now))) ?? [];

  return (
    <>
      <PageHeader label={<Joined parts={["Host", shortAddress(host)]} />} title={name || shortAddress(host)}>
        {explorerUrl && (
          <a href={`${explorerUrl}/address/${host}`} target="_blank" rel="noreferrer" className="label underline underline-offset-4">
            View wallet on explorer ↗
          </a>
        )}
      </PageHeader>

      <section className="border-b border-ink">
        <div className="grid border-l border-ink sm:grid-cols-2 lg:grid-cols-4">
          <StatBox label="Events hosted" value={stats?.eventsCreated.toString() ?? "—"} foot={`${stats?.eventsCancelled ?? 0n} cancelled`} />
          <StatBox label="Tickets sold" value={sold} />
          <StatBox label="Check-in rate" value={checkedIn ? `${Math.round((checkedIn / sold) * 100)}%` : "New"} foot={checkedIn ? `${checkedIn} guests through the door` : "No check-ins yet"} tone="bg-signal" />
          <StatBox label="Refunds claimed" value={stats?.ticketsRefunded.toString() ?? "—"} />
        </div>
        <p className="gutter max-w-3xl py-5 text-sm text-ink-2">
          This record is written by the Turnout contract as events happen. Hosts can&apos;t edit or delete it, so a high check-in rate is earned at the door.
        </p>
      </section>

      {[
        { title: "Upcoming", list: upcoming, empty: "Nothing scheduled right now." },
        { title: "Past", list: past, empty: "No past events yet." },
      ].map((group) => (
        <section key={group.title} className="gutter flex flex-col gap-6 py-10 md:py-14">
          <div className="flex items-end justify-between border-b border-ink pb-4">
            <h2 className="headline text-4xl sm:text-5xl">{group.title}</h2>
            <Label>{isLoading ? "—" : group.list.length}</Label>
          </div>
          {isLoading || !events ? (
            <div className={eventGrid}>
              {Array.from({ length: 3 }, (_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : group.list.length ? (
            <Reveal type="stagger" className={eventGrid}>
              {group.list.map(({ event, tiers }) => (
                <EventCard key={event.id.toString()} event={event} tiers={tiers} />
              ))}
            </Reveal>
          ) : (
            <p className="text-ink-2">{group.empty}</p>
          )}
        </section>
      ))}
    </>
  );
}
