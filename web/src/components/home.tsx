"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState } from "react";
import { formatUnits } from "viem";
import { canBuy, phaseOf } from "@/lib/events";
import { useAllEvents, useNow, useProtocolStats } from "@/lib/hooks";
import { EventCard, EventCardSkeleton, eventGrid } from "./event-card";
import { CountUp, Reveal } from "./motion";
import { ButtonLink, Empty, Joined, Label, Marquee, SectionHead } from "./ui";

export function Hero() {
  return (
    <section className="gutter grid gap-10 pt-10 pb-12 md:pt-16 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-6">
      <div className="flex flex-col gap-8">
        <Reveal as="span" className="label text-ink-2">
          <Joined parts={["Event ticketing", "Escrowed in USDC", "Settled on Arc"]} />
        </Reveal>
        <h1 className="display text-[clamp(4.6rem,min(21vw,19vh),13rem)]">
          <Reveal as="span" type="lines" onScroll={false} className="block">
            Paid at
          </Reveal>
          <span className="flex items-center gap-[0.12em]">
            <HeroPill />
            <Reveal as="span" type="lines" onScroll={false} delay={0.08} className="block">
              the
            </Reveal>
          </span>
          <Reveal as="span" type="lines" onScroll={false} delay={0.16} className="block">
            door.
          </Reveal>
        </h1>
        <Reveal delay={0.35} onScroll={false} className="flex max-w-xl flex-col gap-6">
          <p className="text-lg leading-snug text-ink-2 sm:text-xl">
            Buy tickets in USDC. The money waits in a contract on Arc, and the host is paid the moment you&apos;re checked in.{" "}
            <span className="text-ink">Not scanned? You take it back.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/events">Find an event</ButtonLink>
            <ButtonLink href="/host/new" variant="line">
              Host with Turnout
            </ButtonLink>
          </div>
        </Reveal>
      </div>
      <LiveTicket />
    </section>
  );
}

function HeroPill() {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(ref.current, { scaleX: 0, transformOrigin: "left center", duration: 1.1, ease: "expo.out", delay: 0.2 });
      gsap.to("[data-scan]", { xPercent: 900, duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true });
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className="pill relative h-[0.62em] w-[1.5em] shrink-0 overflow-hidden" aria-hidden>
      <span data-scan className="absolute top-0 left-[6%] h-full w-[10%] bg-signal" />
    </span>
  );
}

const ticketSteps = [
  { label: "Valid", note: "$25.00 held in escrow", tone: "bg-paper text-ink" },
  { label: "Scanned", note: "Holder signed at the door", tone: "bg-signal text-ink" },
  { label: "Checked in", note: "$25.00 released to host", tone: "bg-ink text-signal" },
];

function LiveTicket() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.from(ref.current, { y: 60, rotate: reduce ? 0 : 6, autoAlpha: 0, duration: 1.2, ease: "expo.out", delay: 0.4 });
      if (reduce) return;
      const tl = gsap.timeline({ repeat: -1, delay: 1.6 });
      ticketSteps.forEach((_, i) => {
        tl.call(() => setStep(i)).to("[data-stamp]", { scale: 1, autoAlpha: 1, duration: 0.35, ease: "back.out(3)" }, "+=0.05").to({}, { duration: 1.6 });
        tl.to("[data-stamp]", { scale: 1.4, autoAlpha: 0, duration: 0.25 });
      });
      gsap.to(ref.current, { rotate: -2.5, y: -8, duration: 3, ease: "sine.inOut", repeat: -1, yoyo: true });
    },
    { scope: ref },
  );

  const current = ticketSteps[step];
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-sm lg:mr-0" aria-hidden>
      <div className={`stub flex flex-col border border-ink transition-colors duration-500 ${current.tone}`} style={{ ["--stub-y" as string]: "68%" }}>
        <div className="flex items-center justify-between border-b border-current/20 px-6 pt-6 pb-4">
          <span className="label">Admit one</span>
          <span className="label">Nº 0042</span>
        </div>
        <div className="flex flex-col gap-1 px-6 py-6">
          <span className="label opacity-60"><Joined parts={["Sat 18 Oct", "19:00"]} /></span>
          <span className="display text-6xl">Rooftop Sessions</span>
          <span className="label opacity-60"><Joined parts={["VIP", "Victoria Island"]} /></span>
        </div>
        <div className="mx-6 border-t border-dashed border-current/40" />
        <div className="relative flex min-h-28 items-center justify-between px-6 py-6">
          <div className="flex flex-col gap-1">
            <span className="label opacity-60">Status</span>
            <span className="headline text-3xl">{current.label}</span>
            <span className="text-sm opacity-70">{current.note}</span>
          </div>
          <span
            data-stamp
            className="label invisible absolute right-6 rotate-[-12deg] scale-50 border-2 border-current px-2 py-1 text-base"
          >
            {step === 0 ? "Held" : step === 1 ? "Signed" : "Paid"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Ticker() {
  return (
    <Marquee
      className="border-y border-ink bg-ink text-paper"
      items={["Tickets in USDC", "Escrowed onchain", "Paid on check-in", "Refund if unscanned", "No platform fee", "Final in under a second"]}
    />
  );
}

export function Proof() {
  const { events, tickets, escrow } = useProtocolStats();
  const stats = [
    { label: "Events hosted", value: Number(events ?? 0n), format: undefined, foot: "Created onchain" },
    { label: "Tickets issued", value: Number(tickets ?? 0n), format: undefined, foot: "Tied to buyer wallets" },
    {
      label: "In escrow",
      value: Number(formatUnits(escrow ?? 0n, 18)),
      format: (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`,
      foot: "Waiting for the door",
    },
    { label: "Gas per ticket", value: 0, format: () => "<1¢", foot: "Paid in USDC too" },
  ];

  return (
    <section className="gutter py-20 md:py-28">
      <div className="mb-12 flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
        <Reveal as="h2" type="lines" className="headline text-[clamp(2.2rem,10.5vw,7.5rem)] whitespace-nowrap">
          Proof on chain
        </Reveal>
        <Reveal as="p" className="max-w-sm text-lg leading-snug text-ink-2">
          Every number here is read live from the Turnout contract. Nothing is self-reported, and anyone can check it on the explorer.
        </Reveal>
      </div>
      <Reveal type="stagger" className="grid grid-cols-2 border-t border-l border-ink lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-4 border-r border-b border-ink p-4 sm:gap-6 sm:p-6 md:p-8">
            <Label>{s.label}</Label>
            <CountUp value={s.value} format={s.format} className="font-mono text-[clamp(2.2rem,8vw,6rem)] leading-none font-bold tracking-tight" />
            <Label>{s.foot}</Label>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

export function OnSale() {
  const { events, isLoading } = useAllEvents();
  const now = useNow(60_000);
  const open = events?.filter(({ event }) => canBuy(phaseOf(event, now)) || phaseOf(event, now) === "live").slice(0, 8);

  return (
    <section className="gutter pb-20 md:pb-28">
      <SectionHead
        index={<Joined parts={["01", "On sale now"]} />}
        title="Get in the door"
        aside={
          <ButtonLink href="/events" variant="line">
            All events →
          </ButtonLink>
        }
      />
      <div className="pt-8">
        {isLoading || !events ? (
          <div className={eventGrid}>
            {Array.from({ length: 4 }, (_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : open && open.length > 0 ? (
          <Reveal type="stagger" className={eventGrid}>
            {open.map(({ event, tiers }) => (
              <EventCard key={event.id.toString()} event={event} tiers={tiers} />
            ))}
          </Reveal>
        ) : (
          <Empty title="Nothing on sale right now.">
            <ButtonLink href="/host/new">Be the first to host</ButtonLink>
          </Empty>
        )}
      </div>
    </section>
  );
}

const steps = [
  { n: "01", title: "Buy in USDC", body: "Pick a tier and pay from your wallet. One transaction, no approvals, gas in USDC." },
  { n: "02", title: "Held in escrow", body: "Your payment sits in the Turnout contract. The host can't touch it yet." },
  { n: "03", title: "Signed at the door", body: "Your wallet signs a code that expires in minutes. Staff scan it. It can't be faked or reused." },
  { n: "04", title: "Paid or refunded", body: "Scanned in? The host is paid instantly. Not scanned? Claim your money back within 7 days." },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <div className="gutter mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal as="h2" type="lines" className="headline max-w-4xl text-[clamp(2.8rem,8vw,6rem)] text-balance">
          The money waits for you
        </Reveal>
        <Label><Joined parts={["02", "How it works"]} /></Label>
      </div>
      <Reveal type="stagger" className="grid gap-3 px-[var(--gutter)] sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={`flex min-h-64 flex-col justify-between gap-10 rounded-r-[9rem] border border-ink p-6 pr-16 md:min-h-80 md:p-8 md:pr-20 xl:aspect-[5/6] ${
              i === 3 ? "bg-ink text-paper" : i === 2 ? "bg-signal" : ""
            }`}
          >
            <span className="font-mono text-sm">{s.n}</span>
            <div className="flex flex-col gap-3">
              <h3 className="headline text-3xl tracking-[-0.03em]">{s.title}</h3>
              <p className={`leading-snug ${i === 3 ? "text-paper/70" : "text-ink-2"} ${i === 2 ? "text-ink/75" : ""}`}>{s.body}</p>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

export function Audiences() {
  const buyers = [
    "Your money isn't the host's until you're through the door",
    "Cancelled event? Full refund, any time, no forms",
    "Event never happened? Claim it back yourself",
    "Tickets live in your wallet. Nothing to lose in an inbox",
  ];
  const hosts = [
    "Get paid per guest the moment they're scanned",
    "Prove you're legit: every event you run builds a public record",
    "Any phone is a scanner: open getturnout.site/door, one per entrance",
    "Sell to anyone with USDC, anywhere, without a card processor",
  ];
  return (
    <section className="bg-ink text-paper">
      <Marquee className="border-b border-paper/15 text-paper/70" items={["For buyers", "For hosts", "For the door"]} speed={60} />
      <div className="grid md:grid-cols-2">
        {[
          { title: "If you're buying", items: buyers, cta: { href: "/events", label: "Browse events" } },
          { title: "If you're hosting", items: hosts, cta: { href: "/host/new", label: "Create an event" } },
        ].map((col, i) => (
          <div key={col.title} className={`gutter flex flex-col gap-10 py-16 md:py-24 ${i === 0 ? "border-b border-paper/15 md:border-r md:border-b-0" : ""}`}>
            <Reveal as="h2" type="lines" className="display text-[clamp(3.5rem,10vw,7rem)] text-signal">
              {col.title}
            </Reveal>
            <Reveal as="ul" type="stagger" className="flex flex-col">
              {col.items.map((item, j) => (
                <li key={item} className="flex gap-5 border-t border-paper/15 py-4 text-lg leading-snug">
                  <span className="font-mono text-sm text-paper/40">0{j + 1}</span>
                  {item}
                </li>
              ))}
            </Reveal>
            <ButtonLink href={col.cta.href} variant="signal" className="self-start">
              {col.cta.label}
            </ButtonLink>
          </div>
        ))}
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Where does my money go when I buy a ticket?",
    a: "Into the Turnout contract on Arc, not to the host. It's released to the host ticket by ticket, only when each ticket holder is checked in at the door.",
  },
  {
    q: "What if the event is cancelled?",
    a: "Every ticket becomes refundable immediately, with no deadline. Open My tickets and claim it back in one transaction.",
  },
  {
    q: "What if the host disappears and nothing happens?",
    a: "Then nobody gets scanned. For 7 days after the event's end time, anyone whose ticket wasn't scanned can claim a full refund. The host doesn't have to do anything, and can't stop it.",
  },
  {
    q: "How does check-in work?",
    a: "At the door your wallet signs a short message listing your tickets. It's free, needs no gas and expires in about 10 minutes. Door staff scan the code and submit it. Nobody, not even the host, can check you in without your signature.",
  },
  {
    q: "What do I need to buy a ticket?",
    a: "A wallet with USDC on Arc. USDC is also Arc's gas token, so there's no second coin to buy. Fees are a fraction of a cent.",
  },
  {
    q: "Can a host change the date or price after I've bought?",
    a: "No. The schedule, tiers and prices are locked the moment the event is created. A host can edit the description or poster, or cancel and refund everyone.",
  },
  {
    q: "Does Turnout take a cut?",
    a: "No. There's no platform fee. The only cost is Arc network gas, paid in USDC.",
  },
];

export function Faq() {
  return (
    <section className="gutter py-20 md:py-28">
      <div className="mb-10 flex items-end justify-between gap-6">
        <Reveal as="h2" type="lines" className="display text-[clamp(5rem,18vw,12rem)]">
          FAQ
        </Reveal>
        <Label><Joined parts={["03", "Straight answers"]} /></Label>
      </div>
      <Reveal type="stagger" className="border-t border-l border-r border-ink">
        {faqs.map((f) => (
          <FaqItem key={f.q} {...f} />
        ))}
      </Reveal>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.to(body.current, { height: open ? "auto" : 0, duration: 0.55, ease: "expo.out" });
    },
    { dependencies: [open] },
  );

  return (
    <div className="group border-b border-ink transition-colors duration-300 hover:bg-ink hover:text-paper">
      <button onClick={() => setOpen((v) => !v)} className="flex min-h-20 w-full items-stretch text-left sm:min-h-24" aria-expanded={open}>
        <span className="label flex flex-1 items-center px-4 py-5 text-sm transition-transform duration-300 group-hover:translate-x-1.5 sm:px-8 sm:text-base">
          {q}
        </span>
        <span className="flex w-14 shrink-0 items-center justify-center border-l border-ink group-hover:border-paper/25 sm:w-20">
          <span className={`block text-3xl leading-none font-light transition-transform duration-500 ${open ? "rotate-45" : ""}`}>+</span>
        </span>
      </button>
      <div ref={body} className="h-0 overflow-hidden">
        <p className="border-t border-ink px-4 py-6 font-mono text-sm leading-relaxed group-hover:border-paper/25 sm:px-8 sm:text-base">{a}</p>
      </div>
    </div>
  );
}

export function Closing() {
  return (
    <section className="gutter border-t border-ink py-20 md:py-32">
      <Reveal as="h2" type="lines" className="display text-[clamp(4rem,15vw,13rem)]">
        See you at the door.
      </Reveal>
      <Reveal className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/events">Find an event</ButtonLink>
        <ButtonLink href="/host/new" variant="signal">
          <Joined parts={["Host an event", "No fee"]} />
        </ButtonLink>
      </Reveal>
    </section>
  );
}
