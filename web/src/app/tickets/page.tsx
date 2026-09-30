"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { DoorPass } from "@/components/door-pass";
import { Reveal } from "@/components/motion";
import { PageHeader, RequireWallet } from "@/components/page";
import { Button, ButtonLink, Empty, Joined, Label, PhaseTag, Poster, Skeleton, TxStatus } from "@/components/ui";
import { CLAIM_WINDOW } from "@/lib/config";
import { phaseOf, TicketStatus, ticketRefundable, ticketStatusLabel, type Ticket, type Tier, type TurnoutEvent } from "@/lib/events";
import { duration, eventDay, eventTime, usdc } from "@/lib/format";
import { useBuyerTickets, useNow, useTurnoutTx } from "@/lib/hooks";

export default function TicketsPage() {
  return (
    <>
      <PageHeader label={<Joined parts={["Held by your wallet", "Escrowed until the door"]} />} title="My tickets" />
      <RequireWallet reason="Connect the wallet you bought with to see your tickets.">
        <TicketList />
      </RequireWallet>
    </>
  );
}

function TicketList() {
  const { address } = useAccount();
  const { tickets, events, isLoading, refetch } = useBuyerTickets(address);

  if (isLoading || !tickets || (tickets.length > 0 && !events)) {
    return (
      <section className="gutter flex flex-col gap-6 py-10">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </section>
    );
  }

  if (tickets.length === 0) {
    return (
      <section className="gutter py-12">
        <Empty title="No tickets yet.">
          <ButtonLink href="/events">Find an event</ButtonLink>
        </Empty>
      </section>
    );
  }

  return (
    <section className="gutter flex flex-col gap-10 py-10 md:py-14">
      {events?.map(({ event, tiers }) => (
        <EventTickets
          key={event.id.toString()}
          event={event}
          tiers={tiers}
          tickets={tickets.filter((t) => t.eventId === event.id)}
          refetch={refetch}
        />
      ))}
    </section>
  );
}

function EventTickets({ event, tiers, tickets, refetch }: { event: TurnoutEvent; tiers: Tier[]; tickets: Ticket[]; refetch: () => void }) {
  const now = useNow();
  const [showPass, setShowPass] = useState(false);
  const doorsOpen = !event.cancelled && now >= Number(event.checkInOpensAt) && now <= Number(event.endTime);
  const unscanned = tickets.filter((t) => t.status === TicketStatus.Valid);
  const phase = phaseOf(event, now);
  const refundable = tickets.filter((t) => ticketRefundable(t, event, now));
  const tx = useTurnoutTx();
  const { address } = useAccount();

  const claimable = refundable.slice(0, 20);
  const refundTotal = claimable.reduce((sum, t) => sum + t.price, 0n);
  const windowLeft = Number(event.endTime + CLAIM_WINDOW) - now;

  async function claim() {
    if (!address) return;
    await tx.send({ functionName: "claimRefund", args: [claimable.map((t) => t.id), address] });
  }

  return (
    <Reveal as="article" className="grid border border-ink md:grid-cols-[14rem_1fr]">
      <Link href={`/events/${event.id}`} className="relative block aspect-video overflow-hidden border-b border-ink md:aspect-auto md:border-r md:border-b-0">
        <Poster uri={event.imageURI} name={event.name} id={event.id} />
      </Link>
      <div className="flex flex-col">
        <header className="flex flex-col gap-3 border-b border-ink p-4 sm:flex-row sm:items-start sm:justify-between md:p-6">
          <div className="flex flex-col gap-2">
            <Label>
              <Joined parts={[eventDay(event.startTime), eventTime(event.startTime), event.venue]} />
            </Label>
            <Link href={`/events/${event.id}`} className="headline text-3xl tracking-[-0.03em] hover:underline sm:text-4xl">
              {event.name}
            </Link>
          </div>
          <PhaseTag phase={phase} className="self-start" />
        </header>

        <ul className="grid gap-3 p-4 sm:grid-cols-2 md:p-6 xl:grid-cols-3">
          {tickets.map((t) => (
            <TicketStub key={t.id.toString()} ticket={t} tier={tiers[t.tier]} />
          ))}
        </ul>

        {unscanned.length > 0 && !event.cancelled && now <= Number(event.endTime) && (
          <div className="mt-auto flex flex-col gap-3 border-t border-ink p-4 sm:flex-row sm:items-center sm:justify-between md:p-6">
            <span className="text-sm text-ink-2">
              {doorsOpen
                ? `Check-in is open. ${unscanned.length} ${unscanned.length === 1 ? "ticket" : "tickets"} ready to scan.`
                : `Check-in opens ${eventDay(event.checkInOpensAt)}, ${eventTime(event.checkInOpensAt)}.`}
            </span>
            <Button onClick={() => setShowPass(true)} disabled={!doorsOpen}>
              Show at door
            </Button>
          </div>
        )}
        {showPass && <DoorPass event={event} tiers={tiers} tickets={tickets} onClose={() => setShowPass(false)} refetch={refetch} />}

        {refundable.length > 0 && (
          <div className="mt-auto flex flex-col gap-3 border-t border-ink bg-signal p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="headline text-2xl">
                  {refundable.length} {refundable.length === 1 ? "ticket" : "tickets"} refundable
                </span>
                <span className="text-sm text-ink/70">
                  {event.cancelled ? "The host cancelled. Claim any time." : `You weren't checked in. Window closes in ${duration(windowLeft)}.`}
                </span>
              </div>
              <Button onClick={claim} disabled={tx.busy}>
                {tx.busy ? "Processing…" : `Claim ${usdc(refundTotal)}`}
              </Button>
            </div>
            <TxStatus {...tx} success="Refunded to your wallet." />
          </div>
        )}
      </div>
    </Reveal>
  );
}

const stubTone: Record<TicketStatus, string> = {
  [TicketStatus.None]: "",
  [TicketStatus.Valid]: "bg-paper",
  [TicketStatus.CheckedIn]: "bg-ink text-paper",
  [TicketStatus.Refunded]: "bg-paper-2 text-ink-2",
};

function TicketStub({ ticket, tier }: { ticket: Ticket; tier?: Tier }) {
  const status = ticket.status as TicketStatus;
  return (
    <li className={`stub flex flex-col border border-ink ${stubTone[status]}`} style={{ ["--stub-y" as string]: "62%" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="label">Nº {ticket.id.toString().padStart(4, "0")}</span>
        <span className={`label ${status === TicketStatus.CheckedIn ? "text-signal" : ""}`}>{ticketStatusLabel[status]}</span>
      </div>
      <div className="px-4 pb-4">
        <span className="display text-4xl">{tier?.name ?? `Tier ${ticket.tier + 1}`}</span>
      </div>
      <div className="mx-4 border-t border-dashed border-current/40" />
      <div className="flex items-center justify-between px-4 py-3">
        <span className="label opacity-70">Admit one</span>
        <span className="font-mono">{usdc(ticket.price)}</span>
      </div>
    </li>
  );
}
