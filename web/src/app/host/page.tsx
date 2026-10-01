"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Reveal } from "@/components/motion";
import { PageHeader, RequireWallet, StatBox } from "@/components/page";
import { Button, ButtonLink, Empty, inputClass, Joined, Label, PhaseTag, Poster, Sep, Skeleton, TxStatus } from "@/components/ui";
import { phaseOf, withdrawable, type Tier, type TurnoutEvent } from "@/lib/events";
import { eventDay, eventTime, usdc } from "@/lib/format";
import { useHostEvents, useHostProfile, useNow, useTurnoutTx } from "@/lib/hooks";

export default function HostPage() {
  return (
    <>
      <PageHeader label={<Joined parts={["Your events", "Your escrow"]} />} title="Host">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/door" variant="line">
            Door scanner
          </ButtonLink>
          <ButtonLink href="/host/new" variant="signal">
            + Create event
          </ButtonLink>
        </div>
      </PageHeader>
      <RequireWallet reason="Connect the wallet you host with to manage your events.">
        <Dashboard />
      </RequireWallet>
    </>
  );
}

function Dashboard() {
  const { address } = useAccount();
  const { events, isLoading } = useHostEvents(address);
  const now = useNow(15_000);

  const totals = (events ?? []).reduce(
    (acc, { event }) => ({
      sold: acc.sold + event.ticketCount,
      checkedIn: acc.checkedIn + event.checkedInCount,
      escrow: acc.escrow + event.soldAmount - event.refundedAmount - event.withdrawnAmount,
      ready: acc.ready + withdrawable(event, now),
    }),
    { sold: 0, checkedIn: 0, escrow: 0n, ready: 0n },
  );

  return (
    <>
      <HostName />
      <section className="grid border-l border-ink sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Events" value={events?.length ?? "—"} />
        <StatBox label="Tickets sold" value={totals.sold} />
        <StatBox label="Checked in" value={totals.sold ? `${Math.round((totals.checkedIn / totals.sold) * 100)}%` : "—"} foot={`${totals.checkedIn} guests`} />
        <StatBox label="Ready to withdraw" value={usdc(totals.ready)} foot={`${usdc(totals.escrow)} still in escrow`} tone="bg-signal" />
      </section>

      <section className="gutter py-10 md:py-14">
        {isLoading || !events ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Empty title="You haven't hosted anything yet.">
            <p className="max-w-lg text-ink-2">
              Create an event, set your tiers and share the link. You&apos;re paid per guest as they&apos;re checked in.
            </p>
            <ButtonLink href="/host/new">Create your first event</ButtonLink>
          </Empty>
        ) : (
          <Reveal type="stagger" className="flex flex-col border-t border-ink">
            {events.map(({ event, tiers }) => (
              <HostEventRow key={event.id.toString()} event={event} tiers={tiers} now={now} />
            ))}
          </Reveal>
        )}
      </section>
    </>
  );
}

function HostName() {
  const { address } = useAccount();
  const { name } = useHostProfile(address);
  const [draft, setDraft] = useState<string | null>(null);
  const tx = useTurnoutTx();
  const value = draft ?? name ?? "";

  async function save() {
    const receipt = await tx.send({ functionName: "setHostName", args: [value.trim()] });
    if (receipt) setDraft(null);
  }

  return (
    <section className="gutter flex flex-col gap-3 border-b border-ink py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2">
          <span className="label">Public host name</span>
          <input
            value={value}
            maxLength={50}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="How buyers see you, e.g. Lagos Builders Club"
            className={inputClass}
          />
        </label>
        <Button onClick={save} disabled={tx.busy || draft === null || value.trim() === (name ?? "")} variant="line">
          {tx.busy ? "Saving…" : "Save name"}
        </Button>
      </div>
      <TxStatus {...tx} success="Name saved onchain." />
    </section>
  );
}

function HostEventRow({ event, tiers, now }: { event: TurnoutEvent; tiers: Tier[]; now: number }) {
  const phase = phaseOf(event, now);
  const capacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  const soldPct = capacity ? (event.ticketCount / capacity) * 100 : 0;
  const inPct = event.ticketCount ? (event.checkedInCount / event.ticketCount) * 100 : 0;
  const ready = withdrawable(event, now);

  return (
    <Link href={`/host/${event.id}`} className="group grid grid-cols-[5rem_1fr] gap-4 border-b border-ink py-4 transition-colors hover:bg-paper-2 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:px-2">
      <div className="row-span-2 aspect-square overflow-hidden border border-ink sm:row-span-1">
        <Poster uri={event.imageURI} name={event.name} id={event.id} sizes="7rem" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PhaseTag phase={phase} />
          <Label>
            {eventDay(event.startTime)}<Sep />{eventTime(event.startTime)}
          </Label>
        </div>
        <span className="headline truncate text-2xl tracking-[-0.03em] sm:text-3xl">{event.name}</span>
        <div className="flex flex-col gap-1.5">
          <Bar label={`Sold ${event.ticketCount}/${capacity}`} pct={soldPct} />
          <Bar label={`In ${event.checkedInCount}/${event.ticketCount}`} pct={inPct} tone="bg-signal" />
        </div>
      </div>
      <div className="col-start-2 flex items-center justify-between gap-4 sm:col-start-3 sm:flex-col sm:items-end">
        <div className="flex flex-col sm:items-end">
          <Label>Withdrawable</Label>
          <span className="font-mono text-2xl font-bold">{usdc(ready)}</span>
        </div>
        <span className="label transition-transform group-hover:translate-x-1">Manage →</span>
      </div>
    </Link>
  );
}

function Bar({ label, pct, tone = "bg-ink" }: { label: string; pct: number; tone?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label w-24 shrink-0 text-ink-2">{label}</span>
      <span className="relative h-2 flex-1 border border-ink">
        <span className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
    </div>
  );
}
