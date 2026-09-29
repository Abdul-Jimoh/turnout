"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Reveal } from "@/components/motion";
import { Button, ButtonLink, Empty, Label, PhaseTag, Poster, Sep, Skeleton, TxStatus } from "@/components/ui";
import { CLAIM_WINDOW, explorerUrl, turnoutAddress } from "@/lib/config";
import { canBuy, phaseOf, TicketStatus, ticketStatusLabel, type Tier, type TurnoutEvent } from "@/lib/events";
import { eventDate, eventDay, eventTime, sameAddress, shortAddress, usdc } from "@/lib/format";
import { useBuyerTickets, useEvent, useHostProfile, useNow, useTurnoutTx } from "@/lib/hooks";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventId = /^\d+$/.test(id) ? BigInt(id) : undefined;
  const { event, tiers, isLoading, notFound } = useEvent(eventId);
  const now = useNow();

  if (!eventId || notFound) {
    return (
      <section className="gutter py-20">
        <Empty title="This event doesn't exist.">
          <ButtonLink href="/events">Browse events</ButtonLink>
        </Empty>
      </section>
    );
  }

  if (isLoading || !event || !tiers) {
    return (
      <section className="gutter grid gap-8 py-10 lg:grid-cols-2">
        <Skeleton className="aspect-4/5" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
    );
  }

  const phase = phaseOf(event, now);

  return (
    <article className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="border-b border-ink lg:border-r lg:border-b-0">
        <div className="lg:sticky lg:top-20">
          <Reveal onScroll={false} className="aspect-4/5 max-h-[calc(100dvh-5rem)] w-full overflow-hidden">
            <Poster uri={event.imageURI} name={event.name} id={event.id} />
          </Reveal>
        </div>
      </div>

      <div className="flex flex-col">
        <header className="gutter flex flex-col gap-5 border-b border-ink py-8 md:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <PhaseTag phase={phase} />
            <Label>
              {eventDay(event.startTime)}<Sep />{eventTime(event.startTime)}
            </Label>
          </div>
          <Reveal as="h1" type="lines" onScroll={false} className="display text-[clamp(3.5rem,11vw,8.5rem)] wrap-break-word">
            {event.name}
          </Reveal>
          {event.venue && <p className="text-xl text-ink-2">{event.venue}</p>}
        </header>

        <Schedule event={event} />

        <section className="gutter flex flex-col gap-6 border-b border-ink py-8 md:py-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="headline text-3xl sm:text-4xl">Tickets</h2>
            <Label>Paid in USDC on Arc</Label>
          </div>
          {canBuy(phase) ? (
            <BuyPanel event={event} tiers={tiers} />
          ) : (
            <ClosedNotice phase={phase} />
          )}
          <MyTickets event={event} tiers={tiers} />
        </section>

        <MoneyTrail event={event} />

        {event.description && (
          <section className="gutter flex flex-col gap-4 border-b border-ink py-8 md:py-10">
            <Label>About</Label>
            <p className="max-w-2xl text-lg leading-relaxed whitespace-pre-line">{event.description}</p>
          </section>
        )}

        <HostCard event={event} />
      </div>
    </article>
  );
}

function Schedule({ event }: { event: TurnoutEvent }) {
  const rows = [
    { label: "Starts", value: `${eventDate(event.startTime)}, ${eventTime(event.startTime)}` },
    { label: "Ends", value: `${eventDate(event.endTime)}, ${eventTime(event.endTime)}` },
    { label: "Doors / check-in", value: `From ${eventTime(event.checkInOpensAt)}, ${eventDay(event.checkInOpensAt)}` },
  ];
  return (
    <dl className="grid border-b border-ink sm:grid-cols-3">
      {rows.map((r, i) => (
        <div key={r.label} className={`gutter flex flex-col gap-2 py-5 ${i < 2 ? "border-b border-ink sm:border-r sm:border-b-0" : ""}`}>
          <dt className="label text-ink-2">{r.label}</dt>
          <dd className="leading-snug">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BuyPanel({ event, tiers }: { event: TurnoutEvent; tiers: Tier[] }) {
  const { isConnected } = useAccount();
  const firstOpen = tiers.findIndex((t) => t.sold < t.capacity);
  const [tier, setTier] = useState(Math.max(0, firstOpen));
  const [quantity, setQuantity] = useState(1);
  const tx = useTurnoutTx();

  const selected = tiers[tier];
  const left = selected.capacity - selected.sold;
  const max = Math.min(20, left);
  const total = selected.price * BigInt(quantity);

  async function buy() {
    await tx.send({
      functionName: "buyTickets",
      args: [event.id, tier, quantity],
      value: total,
    });
    setQuantity(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col border-t border-l border-ink" role="radiogroup" aria-label="Ticket tier">
        {tiers.map((t, i) => {
          const soldOut = t.sold >= t.capacity;
          const active = i === tier;
          return (
            <button
              key={i}
              role="radio"
              aria-checked={active}
              disabled={soldOut}
              onClick={() => {
                setTier(i);
                setQuantity(1);
              }}
              className={`flex items-center justify-between gap-4 border-r border-b border-ink px-4 py-4 text-left transition-colors disabled:cursor-not-allowed ${
                active ? "bg-ink text-paper" : soldOut ? "text-ink-3" : "hover:bg-paper-2"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`size-3 rounded-full border ${active ? "border-signal bg-signal" : "border-current"}`} />
                <span className="headline text-xl tracking-[-0.02em]">{t.name}</span>
              </span>
              <span className="flex items-center gap-4">
                <span className={`label ${active ? "text-paper/60" : "text-ink-2"}`}>{soldOut ? "Sold out" : `${t.capacity - t.sold} left`}</span>
                <span className="font-mono text-lg">{usdc(t.price)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {left > 0 && (
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex border border-ink">
            <button className="label w-12 hover:bg-paper-2 disabled:opacity-30" onClick={() => setQuantity((q) => q - 1)} disabled={quantity <= 1} aria-label="Fewer">
              −
            </button>
            <span className="flex w-12 items-center justify-center border-x border-ink font-mono text-lg" aria-live="polite">
              {quantity}
            </span>
            <button className="label w-12 hover:bg-paper-2 disabled:opacity-30" onClick={() => setQuantity((q) => q + 1)} disabled={quantity >= max} aria-label="More">
              +
            </button>
          </div>
          {isConnected ? (
            <Button onClick={buy} disabled={tx.busy} className="flex-1">
              {tx.busy ? "Processing…" : `Buy ${quantity} · ${usdc(total)}`}
            </Button>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button onClick={openConnectModal} className="flex-1">
                  Connect to buy · {usdc(total)}
                </Button>
              )}
            </ConnectButton.Custom>
          )}
        </div>
      )}

      <TxStatus
        {...tx}
        success={
          <>
            You&apos;re in.{" "}
            <Link href="/tickets" className="underline underline-offset-4">
              See your tickets
            </Link>
          </>
        }
      />
    </div>
  );
}

function ClosedNotice({ phase }: { phase: string }) {
  const text =
    phase === "cancelled"
      ? "This event was cancelled. Ticket holders can claim a full refund from My tickets."
      : phase === "live"
        ? "Sales have closed. The event is happening now."
        : "Sales have closed for this event.";
  return <p className="border border-ink bg-paper-2 px-4 py-4 leading-snug">{text}</p>;
}

function MyTickets({ event, tiers }: { event: TurnoutEvent; tiers: Tier[] }) {
  const { address } = useAccount();
  const { tickets } = useBuyerTickets(address);
  const mine = tickets?.filter((t) => t.eventId === event.id) ?? [];
  if (mine.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border border-ink p-4">
      <div className="flex items-center justify-between">
        <Label>You hold {mine.length} {mine.length === 1 ? "ticket" : "tickets"}</Label>
        <Link href="/tickets" className="label underline underline-offset-4">
          My tickets →
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {mine.map((t) => (
          <li key={t.id.toString()} className={`label border border-ink px-2 py-1 ${t.status === TicketStatus.CheckedIn ? "bg-signal" : ""}`}>
            Nº {t.id.toString()}<Sep />{tiers[t.tier]?.name}<Sep />{ticketStatusLabel[t.status as TicketStatus]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoneyTrail({ event }: { event: TurnoutEvent }) {
  const claimEnds = event.endTime + CLAIM_WINDOW;
  const items = [
    { k: "Held", v: "Your payment sits in the Turnout contract, not with the host." },
    { k: "Released", v: "The host is paid for your ticket only when you're checked in at the door." },
    { k: "Cancelled", v: "If the host cancels, you can claim a full refund at any time." },
    { k: "Not scanned", v: `If you weren't checked in, claim a refund until ${eventDate(claimEnds)}, ${eventTime(claimEnds)}.` },
  ];
  return (
    <section className="gutter border-b border-ink bg-ink py-8 text-paper md:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="headline text-3xl sm:text-4xl">Where your money goes</h2>
        <span className="label text-signal">Enforced by code</span>
      </div>
      <dl className="grid gap-px bg-paper/15 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.k} className="flex flex-col gap-2 bg-ink py-4 sm:p-4">
            <dt className="label text-signal">{i.k}</dt>
            <dd className="leading-snug text-paper/80">{i.v}</dd>
          </div>
        ))}
      </dl>
      {explorerUrl && (
        <a href={`${explorerUrl}/address/${turnoutAddress}`} target="_blank" rel="noreferrer" className="label mt-6 inline-block text-paper/60 underline underline-offset-4 hover:text-signal">
          Event #{event.id.toString()} on the Turnout contract ↗
        </a>
      )}
    </section>
  );
}

function HostCard({ event }: { event: TurnoutEvent }) {
  const { name, stats } = useHostProfile(event.host);
  const { address } = useAccount();
  const rate = stats && stats.ticketsCheckedIn > 0n ? Math.round((Number(stats.ticketsCheckedIn) / Number(stats.ticketsSold)) * 100) : undefined;

  return (
    <section className="gutter flex flex-col gap-5 py-8 md:py-10">
      <Label>Hosted by</Label>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link href={`/hosts/${event.host}`} className="headline text-4xl hover:underline">
            {name || shortAddress(event.host)}
          </Link>
          <span className="label text-ink-2">{shortAddress(event.host)}</span>
        </div>
        {sameAddress(address, event.host) && <ButtonLink href={`/host/${event.id}`}>Manage event</ButtonLink>}
      </div>
      {stats && (
        <dl className="grid grid-cols-3 border-t border-l border-ink">
          {[
            { k: "Events", v: stats.eventsCreated.toString() },
            { k: "Tickets sold", v: stats.ticketsSold.toString() },
            { k: "Check-in rate", v: rate === undefined ? "New" : `${rate}%` },
          ].map((s) => (
            <div key={s.k} className="flex flex-col gap-2 border-r border-b border-ink p-3 sm:p-4">
              <dt className="label text-ink-2">{s.k}</dt>
              <dd className="font-mono text-2xl font-bold sm:text-3xl">{s.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
