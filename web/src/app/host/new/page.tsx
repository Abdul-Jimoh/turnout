"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseEventLogs } from "viem";
import { PageHeader, RequireWallet } from "@/components/page";
import { Button, Field, inputClass, Label, TxStatus } from "@/components/ui";
import { turnoutAbi } from "@/lib/abi";
import { DEFAULT_CHECK_IN_LEAD, MAX_TIERS } from "@/lib/config";
import { eventDay, eventTime, parseUsdc, toDatetimeLocal, usdc } from "@/lib/format";
import { useNow, useTurnoutTx } from "@/lib/hooks";
import { uploadPoster } from "@/lib/ipfs";

type TierDraft = { name: string; price: string; capacity: string };

const MAX_DURATION = 30 * 24 * 60 * 60;

export default function NewEventPage() {
  return (
    <>
      <PageHeader label="New event // Locked in once created" title="Create" />
      <RequireWallet reason="Connect the wallet that should receive ticket money.">
        <EventForm />
      </RequireWallet>
    </>
  );
}

function defaultStart() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setHours(19, 0, 0, 0);
  return d;
}

function EventForm() {
  const router = useRouter();
  const now = useNow(30_000);
  const tx = useTurnoutTx();
  const [poster, setPoster] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(() => toDatetimeLocal(defaultStart()));
  const [end, setEnd] = useState(() => toDatetimeLocal(new Date(defaultStart().getTime() + 4 * 60 * 60 * 1000)));
  const [leadHours, setLeadHours] = useState(DEFAULT_CHECK_IN_LEAD / 3600);
  const [tiers, setTiers] = useState<TierDraft[]>([{ name: "General", price: "10", capacity: "100" }]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [touched, setTouched] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pickPoster(file: File | null) {
    setPoster(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  const startTs = Math.floor(new Date(start).getTime() / 1000);
  const endTs = Math.floor(new Date(end).getTime() / 1000);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Give your event a name.";
    if (!Number.isFinite(startTs) || startTs < now + 5 * 60) e.start = "Start at least a few minutes from now.";
    if (!Number.isFinite(endTs) || endTs <= startTs) e.end = "The end must be after the start.";
    else if (endTs - startTs > MAX_DURATION) e.end = "Events can last at most 30 days.";
    tiers.forEach((t, i) => {
      const price = parseUsdc(t.price);
      const cap = Number(t.capacity);
      if (!t.name.trim()) e[`tier${i}`] = "Name this tier.";
      else if (price === null || price < 10n ** 16n) e[`tier${i}`] = "Price must be at least $0.01.";
      else if (!Number.isInteger(cap) || cap < 1 || cap > 1_000_000) e[`tier${i}`] = "Capacity must be a whole number above 0.";
    });
    return e;
  }, [name, startTs, endTs, tiers, now]);

  const valid = Object.keys(errors).length === 0;
  const busy = uploading || tx.busy;

  function updateTier(i: number, patch: Partial<TierDraft>) {
    setTiers((all) => all.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  async function submit() {
    setTouched(true);
    if (!valid) return;

    let imageURI = "";
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
      functionName: "createEvent",
      args: [
        {
          name: name.trim(),
          venue: venue.trim(),
          description: description.trim(),
          imageURI,
          startTime: BigInt(startTs),
          endTime: BigInt(endTs),
          checkInOpensAt: BigInt(startTs - leadHours * 3600),
          tiers: tiers.map((t) => ({ name: t.name.trim(), price: parseUsdc(t.price)!, capacity: Number(t.capacity) })),
        },
      ],
    });
    if (!receipt) return;
    const [created] = parseEventLogs({ abi: turnoutAbi, logs: receipt.logs, eventName: "EventCreated" });
    if (created) router.push(`/host/${created.args.eventId}`);
  }

  const show = (key: string) => (touched ? errors[key] : undefined);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FormSection index="01" title="Poster">
          <PosterPicker preview={preview} onPick={pickPoster} onClear={() => pickPoster(null)} />
        </FormSection>

        <FormSection index="02" title="Details">
          <Field label="Event name" error={show("name")}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} placeholder="Rooftop Sessions Vol. 5" />
          </Field>
          <Field label="Venue or link" hint="Where people should show up.">
            <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={200} className={inputClass} placeholder="Victoria Island, Lagos" />
          </Field>
          <Field label="Description" hint={`${description.length}/2000`}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={5}
              className={`${inputClass} resize-y`}
              placeholder="What's happening, who it's for, what to bring."
            />
          </Field>
        </FormSection>

        <FormSection index="03" title="When">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" error={show("start")}>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Ends" error={show("end")}>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <details className="group border border-ink">
            <summary className="label flex cursor-pointer list-none items-center justify-between px-4 py-3">
              Advanced: when check-in opens
              <span className="text-lg transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-ink p-4">
              <input
                type="range"
                min={0}
                max={24}
                value={leadHours}
                onChange={(e) => setLeadHours(Number(e.target.value))}
                className="accent-ink"
                aria-label="Hours before start"
              />
              <p className="text-sm text-ink-2">
                Door staff can start scanning <strong className="text-ink">{leadHours === 0 ? "at the start time" : `${leadHours}h before the start`}</strong>. Default is 6h.
              </p>
            </div>
          </details>
        </FormSection>

        <FormSection index="04" title="Tickets">
          <div className="flex flex-col gap-3">
            {tiers.map((t, i) => (
              <div key={i} className="flex flex-col gap-3 border border-ink p-4">
                <div className="flex items-center justify-between">
                  <Label>Tier {i + 1}</Label>
                  {tiers.length > 1 && (
                    <button type="button" onClick={() => setTiers((all) => all.filter((_, j) => j !== i))} className="label text-ink-2 hover:text-alert">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <input value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} maxLength={32} placeholder="VIP" className={inputClass} aria-label="Tier name" />
                  <div className="relative">
                    <span className="label absolute top-1/2 left-4 -translate-y-1/2 text-ink-2">$</span>
                    <input
                      value={t.price}
                      onChange={(e) => updateTier(i, { price: e.target.value })}
                      inputMode="decimal"
                      placeholder="25"
                      className={`${inputClass} pl-8`}
                      aria-label="Price in USDC"
                    />
                  </div>
                  <input
                    value={t.capacity}
                    onChange={(e) => updateTier(i, { capacity: e.target.value.replace(/\D/g, "") })}
                    inputMode="numeric"
                    placeholder="Seats"
                    className={inputClass}
                    aria-label="Capacity"
                  />
                </div>
                {show(`tier${i}`) && <span className="text-sm text-alert">{show(`tier${i}`)}</span>}
              </div>
            ))}
            {tiers.length < MAX_TIERS && (
              <button
                type="button"
                onClick={() => setTiers((all) => [...all, { name: "", price: "", capacity: "" }])}
                className="label border border-dashed border-ink py-4 hover:bg-paper-2"
              >
                + Add a tier
              </button>
            )}
          </div>
        </FormSection>

        <div className="gutter sticky bottom-0 z-10 flex flex-col gap-3 border-t border-ink bg-paper py-4 lg:static">
          <p className="text-sm text-ink-2">
            The schedule, tiers and prices can&apos;t be changed after creation. You can still edit the name, venue, description and poster, or cancel before
            anyone is checked in.
          </p>
          {uploadError && <p className="text-sm text-alert">{uploadError}</p>}
          <TxStatus {...tx} success="Event created. Taking you to it…" />
          <Button type="submit" disabled={busy}>
            {uploading ? "Uploading poster…" : tx.busy ? "Creating…" : "Create event"}
          </Button>
        </div>
      </form>

      <aside className="hidden border-l border-ink lg:block">
        <div className="sticky top-20 flex flex-col gap-4 p-6">
          <Label>{"Preview //"}</Label>
          <div className="flex flex-col border border-ink bg-white">
            <div className="aspect-4/5 overflow-hidden border-b border-ink bg-paper-2">
              {preview ? (
                <div className="relative h-full w-full">
                  <Image src={preview} alt="" fill unoptimized className="object-cover" />
                </div>
              ) : (
                <div className="flex h-full flex-col justify-end bg-ink p-4 text-signal">
                  <span className="display text-5xl wrap-break-word">{name || "Your event"}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 p-4">
              <span className="label text-ink-2">
                {Number.isFinite(startTs) ? `${eventDay(startTs)} // ${eventTime(startTs)}` : "Pick a date"}
              </span>
              <span className="headline text-2xl tracking-[-0.03em]">{name || "Event name"}</span>
              {venue && <span className="text-sm text-ink-2">{venue}</span>}
              <div className="mt-2 flex flex-col gap-1 border-t border-ink/15 pt-3">
                {tiers.map((t, i) => {
                  const price = parseUsdc(t.price);
                  return (
                    <div key={i} className="label flex justify-between">
                      <span>{t.name || `Tier ${i + 1}`}</span>
                      <span>{price !== null ? usdc(price) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FormSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="gutter grid gap-6 border-b border-ink py-8 md:grid-cols-[10rem_1fr] md:py-10">
      <div className="flex flex-col gap-1">
        <Label>{`${index} //`}</Label>
        <h2 className="headline text-3xl">{title}</h2>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function PosterPicker({ preview, onPick, onClear }: { preview: string | null; onPick: (f: File) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string>();

  function accept(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError("Use a JPEG, PNG or WebP image.");
    if (file.size > 15 * 1024 * 1024) return setError("That image is over 15MB.");
    setError(undefined);
    onPick(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={`relative flex aspect-4/5 w-full max-w-xs items-center justify-center overflow-hidden border border-dashed border-ink transition-colors sm:max-w-sm ${
          drag ? "bg-signal" : "bg-paper-2"
        }`}
      >
        {preview ? (
          <Image src={preview} alt="Poster preview" fill unoptimized className="object-cover" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex flex-col items-center gap-2 p-6 text-center">
            <span className="headline text-2xl">Drop a poster</span>
            <span className="label text-ink-2">or tap to choose // 4:5 works best</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
      <div className="flex gap-4">
        {preview && (
          <>
            <button type="button" onClick={() => input.current?.click()} className="label underline underline-offset-4">
              Replace
            </button>
            <button type="button" onClick={onClear} className="label text-ink-2 underline underline-offset-4">
              Remove
            </button>
          </>
        )}
      </div>
      {error ? <span className="text-sm text-alert">{error}</span> : <span className="text-sm text-ink-2">Optional. Stored on IPFS, linked from the contract.</span>}
    </div>
  );
}
