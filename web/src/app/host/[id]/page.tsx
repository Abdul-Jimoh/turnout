"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { type Address } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { Scanner } from "@/components/scanner";
import { RequireWallet, StatBox } from "@/components/page";
import { Button, ButtonLink, Empty, Field, inputClass, Joined, Label, PhaseTag, Poster, Sep, Skeleton, TxStatus } from "@/components/ui";
import { decodeDevice } from "@/lib/checkin";
import { CLAIM_WINDOW, explorerUrl } from "@/lib/config";
import { phaseOf, TicketStatus, ticketStatusLabel, withdrawable, type Tier, type TurnoutEvent } from "@/lib/events";
import { duration, eventDate, eventDay, eventTime, sameAddress, shortAddress, usdc } from "@/lib/format";
import { turnoutContract, useEvent, useEventTickets, useNow, useTurnoutTx } from "@/lib/hooks";
import { uploadPoster } from "@/lib/ipfs";

export default function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventId = /^\d+$/.test(id) ? BigInt(id) : undefined;

  return (
    <RequireWallet reason="Connect the host wallet to manage this event.">
      <Manage eventId={eventId} />
    </RequireWallet>
  );
}

function Manage({ eventId }: { eventId?: bigint }) {
  const { address } = useAccount();
  const { event, tiers, isLoading, notFound } = useEvent(eventId);

  if (!eventId || notFound) {
    return (
      <section className="gutter py-20">
        <Empty title="This event doesn't exist.">
          <ButtonLink href="/host">Back to your events</ButtonLink>
        </Empty>
      </section>
    );
  }
  if (isLoading || !event || !tiers) {
    return (
      <section className="gutter flex flex-col gap-4 py-10">
        <Skeleton className="h-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </section>
    );
  }
  if (!sameAddress(address, event.host)) {
    return (
      <section className="gutter py-20">
        <Empty title="Only the host can manage this event.">
          <ButtonLink href={`/events/${event.id}`}>View event page</ButtonLink>
        </Empty>
      </section>
    );
  }

  return (
    <>
      <Header event={event} />
      <Money event={event} tiers={tiers} />
      <DoorDevices event={event} />
      <Attendees event={event} tiers={tiers} />
      <EditDetails event={event} />
      <Cancel event={event} />
    </>
  );
}

function Header({ event }: { event: TurnoutEvent }) {
  const now = useNow();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="gutter grid gap-6 border-b border-ink py-8 md:grid-cols-[8rem_1fr] md:items-end md:py-10">
      <div className="aspect-4/5 w-24 overflow-hidden border border-ink md:w-32">
        <Poster uri={event.imageURI} name={event.name} id={event.id} sizes="8rem" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <PhaseTag phase={phaseOf(event, now)} />
          <Label>
            {eventDay(event.startTime)}<Sep />{eventTime(event.startTime)}–{eventTime(event.endTime)}
          </Label>
        </div>
        <h1 className="display text-[clamp(3rem,10vw,7rem)] wrap-break-word">{event.name}</h1>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/events/${event.id}`} variant="line">
            Public page ↗
          </ButtonLink>
          <Button variant="line" onClick={copy}>
            {copied ? "Link copied" : "Copy share link"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Money({ event, tiers }: { event: TurnoutEvent; tiers: Tier[] }) {
  const now = useNow();
  const { address } = useAccount();
  const tx = useTurnoutTx();
  const phase = phaseOf(event, now);
  const ready = withdrawable(event, now);
  const capacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  const escrow = event.soldAmount - event.refundedAmount - event.withdrawnAmount;
  const unscanned = event.soldAmount - event.checkedInAmount - event.refundedAmount;
  const releaseAt = Number(event.endTime + CLAIM_WINDOW);

  const note =
    phase === "cancelled"
      ? "This event is cancelled. Ticket holders are claiming refunds."
      : phase === "settled"
        ? "The claim window has closed. Everything not refunded is yours."
        : unscanned > 0n
          ? `${usdc(unscanned)} from unscanned tickets unlocks ${eventDate(releaseAt)}, ${eventTime(releaseAt)}${
              now < releaseAt ? ` (in ${duration(releaseAt - now)})` : ""
            }, minus any refunds claimed before then.`
          : "Every ticket sold so far has been checked in or refunded.";

  return (
    <section className="border-b border-ink">
      <div className="grid border-l border-ink sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Sold" value={`${event.ticketCount}/${capacity}`} foot={usdc(event.soldAmount)} />
        <StatBox
          label="Checked in"
          value={event.ticketCount ? `${Math.round((event.checkedInCount / event.ticketCount) * 100)}%` : "—"}
          foot={<Joined parts={[`${event.checkedInCount} guests`, usdc(event.checkedInAmount)]} />}
        />
        <StatBox label="In escrow" value={usdc(escrow)} foot={<Joined parts={[`${event.refundedCount} refunded`, `${usdc(event.withdrawnAmount)} withdrawn`]} />} />
        <StatBox label="Withdrawable now" value={usdc(ready)} tone="bg-signal" />
      </div>
      <div className="gutter flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl leading-snug text-ink-2">{note}</p>
        <Button
          onClick={() => address && tx.send({ functionName: "withdraw", args: [event.id, address] })}
          disabled={ready === 0n || tx.busy}
        >
          {tx.busy ? "Withdrawing…" : `Withdraw ${usdc(ready)}`}
        </Button>
      </div>
      {tx.status !== "idle" && (
        <div className="gutter pb-6">
          <TxStatus {...tx} success="Sent to your wallet." />
        </div>
      )}
    </section>
  );
}

const PAGE = 25;

function Attendees({ event, tiers }: { event: TurnoutEvent; tiers: Tier[] }) {
  const { tickets, isLoading } = useEventTickets(event.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TicketStatus | 0>(0);
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tickets ?? []).filter(
      (t) => (!status || t.status === status) && (!q || t.holder.toLowerCase().includes(q) || t.id.toString() === q.replace(/^#/, "")),
    );
  }, [tickets, query, status]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = shown.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <section className="gutter flex flex-col gap-6 border-b border-ink py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <Label>Guest list</Label>
          <h2 className="headline text-4xl">{event.ticketCount} tickets</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={status}
            onChange={(e) => {
              setStatus(Number(e.target.value) as TicketStatus);
              setPage(0);
            }}
            className={`${inputClass} sm:w-44`}
            aria-label="Filter by status"
          >
            <option value={0}>All statuses</option>
            <option value={TicketStatus.Valid}>Valid</option>
            <option value={TicketStatus.CheckedIn}>Checked in</option>
            <option value={TicketStatus.Refunded}>Refunded</option>
          </select>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Wallet or ticket #"
            className={`${inputClass} sm:w-64`}
            aria-label="Search guests"
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="border border-dashed border-ink-3 p-6 text-ink-2">{tickets?.length ? "No tickets match." : "No tickets sold yet. Share your event link."}</p>
      ) : (
        <div className="overflow-x-auto border border-ink">
          <table className="w-full min-w-136 text-left">
            <thead className="bg-ink text-paper">
              <tr>
                {["Ticket", "Holder", "Tier", "Paid", "Status"].map((h) => (
                  <th key={h} className="label px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id.toString()} className="border-t border-ink/15">
                  <td className="px-4 py-3 font-mono">#{t.id.toString()}</td>
                  <td className="px-4 py-3 font-mono">
                    {explorerUrl ? (
                      <a href={`${explorerUrl}/address/${t.holder}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {shortAddress(t.holder)}
                      </a>
                    ) : (
                      shortAddress(t.holder)
                    )}
                  </td>
                  <td className="px-4 py-3">{tiers[t.tier]?.name}</td>
                  <td className="px-4 py-3 font-mono">{usdc(t.price)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`label px-2 py-1 ${
                        t.status === TicketStatus.CheckedIn ? "bg-signal" : t.status === TicketStatus.Refunded ? "bg-paper-3 text-ink-2" : "border border-ink"
                      }`}
                    >
                      {ticketStatusLabel[t.status as TicketStatus]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="line" onClick={() => setPage(current - 1)} disabled={current === 0}>
            ← Prev
          </Button>
          <Label>
            Page {current + 1} of {pages}
          </Label>
          <Button variant="line" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
            Next →
          </Button>
        </div>
      )}
    </section>
  );
}

const GAS_OPTIONS = [
  { label: "None", value: 0n },
  { label: "$0.50", value: 5n * 10n ** 17n },
  { label: "$1", value: 10n ** 18n },
  { label: "$2", value: 2n * 10n ** 18n },
];

function DoorDevices({ event }: { event: TurnoutEvent }) {
  const now = useNow(30_000);
  const phase = phaseOf(event, now);
  const staff = useReadContract({ ...turnoutContract, functionName: "getStaff", args: [event.id] });
  const [input, setInput] = useState("");
  const [gas, setGas] = useState(GAS_OPTIONS[2].value);
  const [scanning, setScanning] = useState(false);
  const tx = useTurnoutTx();

  if (phase === "cancelled" || phase === "claims" || phase === "settled") return null;

  const device = decodeDevice(input);
  const devices = (staff.data ?? []) as readonly Address[];

  async function add() {
    if (!device) return;
    const receipt = await tx.send({ functionName: "addStaff", args: [event.id, device], value: gas });
    if (receipt) setInput("");
  }

  return (
    <section className="gutter grid gap-6 border-b border-ink py-10 md:grid-cols-[14rem_1fr]">
      <div className="flex flex-col gap-2">
        <Label>At the door</Label>
        <h2 className="headline text-3xl">Door devices</h2>
        <p className="text-sm text-ink-2">
          Any phone can scan tickets. Open{" "}
          <Link href="/door" className="underline underline-offset-4">
            /door
          </Link>{" "}
          on it, then add its code here. Add one per entrance.
        </p>
      </div>
      <div className="flex flex-col gap-5">
        {devices.length > 0 && (
          <ul className="flex flex-col border-t border-ink">
            {devices.map((d, i) => (
              <DeviceRow key={d} event={event} device={d} index={i} />
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 border border-ink p-4">
          <span className="label">Add a device</span>
          {scanning ? (
            <div className="flex flex-col gap-2">
              <Scanner
                className="aspect-square w-full max-w-xs"
                onScan={(raw) => {
                  if (decodeDevice(raw)) {
                    setInput(raw);
                    setScanning(false);
                  }
                }}
              />
              <button onClick={() => setScanning(false)} className="label self-start underline underline-offset-4">
                Cancel scan
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the device address"
                className={`${inputClass} font-mono text-sm`}
                aria-label="Device address"
              />
              <Button variant="line" onClick={() => setScanning(true)}>
                Scan code
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="label text-ink-2">Send it gas</span>
            <div className="flex flex-wrap">
              {GAS_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  onClick={() => setGas(o.value)}
                  className={`label border border-ink px-4 py-2.5 not-first:-ml-px ${gas === o.value ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-ink-2">About 400 check-ins per dollar. You can top up later.</span>
          </div>
          {input && !device && <span className="text-sm text-alert">That isn&apos;t a valid device address.</span>}
          <TxStatus {...tx} success="Device added. It will switch to scanning mode by itself." />
          <Button onClick={add} disabled={!device || tx.busy} className="self-start">
            {tx.busy ? "Adding…" : gas ? `Add device + ${usdc(gas)} gas` : "Add device"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DeviceRow({ event, device, index }: { event: TurnoutEvent; device: Address; index: number }) {
  const { data: balance } = useBalance({ address: device, query: { refetchInterval: 15_000 } });
  const tx = useTurnoutTx();
  const low = balance !== undefined && balance.value < 10n ** 16n;

  return (
    <li className="flex flex-col gap-3 border-b border-ink py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="headline text-xl">Door {index + 1}</span>
        <span className="label text-ink-2">
          <Joined parts={[shortAddress(device), balance ? `${usdc(balance.value)} gas` : "…"]} />
          {low && <span className="ml-2 text-alert">Low</span>}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="line"
          disabled={tx.busy}
          onClick={() => tx.send({ functionName: "addStaff", args: [event.id, device], value: 10n ** 18n })}
        >
          Top up $1
        </Button>
        <Button variant="line" disabled={tx.busy} onClick={() => tx.send({ functionName: "removeStaff", args: [event.id, device] })}>
          Remove
        </Button>
      </div>
      {tx.status === "error" && <span className="text-sm text-alert">{tx.error}</span>}
    </li>
  );
}

function EditDetails({ event }: { event: TurnoutEvent }) {
  const [name, setName] = useState(event.name);
  const [venue, setVenue] = useState(event.venue);
  const [description, setDescription] = useState(event.description);
  const [poster, setPoster] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const tx = useTurnoutTx();

  if (event.cancelled) return null;

  const dirty = name !== event.name || venue !== event.venue || description !== event.description || poster !== null;

  async function save() {
    let imageURI = event.imageURI;
    if (poster) {
      setUploading(true);
      setUploadError(undefined);
      try {
        imageURI = await uploadPoster(poster);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Poster upload failed.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    const receipt = await tx.send({
      functionName: "updateEventDetails",
      args: [event.id, name.trim(), venue.trim(), description.trim(), imageURI],
    });
    if (receipt) setPoster(null);
  }

  return (
    <section className="gutter grid gap-6 border-b border-ink py-10 md:grid-cols-[14rem_1fr]">
      <div className="flex flex-col gap-2">
        <Label>Details</Label>
        <h2 className="headline text-3xl">Edit</h2>
        <p className="text-sm text-ink-2">Name, venue, description and poster can change any time. Schedule and prices can&apos;t.</p>
      </div>
      <div className="flex flex-col gap-5">
        <Field label="Event name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Venue or link">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={5} className={`${inputClass} resize-y`} />
        </Field>
        <Field label="Replace poster" hint={poster ? poster.name : "JPEG, PNG or WebP"} error={uploadError}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
            className="label file:label file:mr-4 file:border file:border-ink file:bg-paper file:px-4 file:py-2"
          />
        </Field>
        <TxStatus {...tx} success="Details updated." />
        <Button onClick={save} disabled={!dirty || !name.trim() || uploading || tx.busy} className="self-start">
          {uploading ? "Uploading…" : tx.busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}

function Cancel({ event }: { event: TurnoutEvent }) {
  const now = useNow();
  const tx = useTurnoutTx();
  const [confirm, setConfirm] = useState(false);
  const allowed = !event.cancelled && event.checkedInCount === 0 && now <= Number(event.endTime);

  if (!allowed) return null;

  return (
    <section className="gutter flex flex-col gap-4 py-10">
      <Label>Danger zone</Label>
      <div className="flex flex-col gap-4 border border-alert p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-xl flex-col gap-1">
          <span className="headline text-2xl">Cancel this event</span>
          <p className="text-ink-2">
            Sales stop and every ticket becomes fully refundable, permanently. You can only do this before anyone is checked in.
          </p>
        </div>
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="line" onClick={() => setConfirm(false)} disabled={tx.busy}>
              Keep it
            </Button>
            <Button
              variant="alert"
              onClick={() => tx.send({ functionName: "cancelEvent", args: [event.id] })}
              disabled={tx.busy}
            >
              {tx.busy ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </div>
        ) : (
          <Button variant="line" onClick={() => setConfirm(true)}>
            Cancel event
          </Button>
        )}
      </div>
      <TxStatus {...tx} success="Event cancelled. Buyers can now claim refunds." />
      <Link href={`/events/${event.id}`} className="label self-start underline underline-offset-4">
        View public page
      </Link>
    </section>
  );
}
