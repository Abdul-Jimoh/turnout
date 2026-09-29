"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { explorerUrl } from "@/lib/config";
import { phaseLabel, type Phase } from "@/lib/events";
import { imageUrl } from "@/lib/ipfs";

type Variant = "ink" | "line" | "signal" | "ghost" | "alert";

const variants: Record<Variant, string> = {
  alert: "bg-alert text-ink border border-alert hover:bg-ink hover:text-alert hover:border-ink",
  ink: "bg-ink text-paper hover:bg-ink/85 border border-ink",
  line: "border border-ink text-ink hover:bg-ink hover:text-paper",
  signal: "bg-signal text-ink border border-ink hover:bg-ink hover:text-signal",
  ghost: "text-ink underline-offset-4 hover:underline",
};

const base =
  "label inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-12 transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none select-none";

export function Button({ variant = "ink", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "ink", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`label text-ink-2 ${className}`}>{children}</span>;
}

const phaseStyle: Record<Phase, string> = {
  "on-sale": "bg-paper text-ink border border-ink",
  doors: "bg-signal text-ink",
  live: "bg-signal text-ink",
  claims: "bg-paper-3 text-ink",
  settled: "bg-paper-2 text-ink-2",
  cancelled: "bg-alert text-ink",
};

export function PhaseTag({ phase, className = "" }: { phase: Phase; className?: string }) {
  return (
    <span className={`label inline-flex items-center gap-1.5 px-2 py-1 ${phaseStyle[phase]} ${className}`}>
      {(phase === "live" || phase === "doors") && <span className="size-1.5 rounded-full bg-ink animate-blink" />}
      {phaseLabel[phase]}
    </span>
  );
}

export function Marquee({ items, className = "", speed = 40 }: { items: string[]; className?: string; speed?: number }) {
  const row = (hidden?: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((item, i) => (
        <span key={i} className="label flex items-center gap-10 pr-10 whitespace-nowrap">
          <span className="opacity-50">{"//"}</span>
          {item}
        </span>
      ))}
    </div>
  );
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="flex w-max animate-marquee py-3.5" style={{ ["--marquee-speed" as string]: `${speed}s` }}>
        {row()}
        {row(true)}
        {row(true)}
        {row(true)}
      </div>
    </div>
  );
}

export function SectionHead({ index, title, aside }: { index: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-ink pb-6 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-3">
        <Label>{index}</Label>
        <h2 className="headline text-4xl sm:text-5xl md:text-6xl">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label text-ink">{label}</span>
      {children}
      {error ? <span className="text-sm text-alert">{error}</span> : hint ? <span className="text-sm text-ink-2">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full min-h-12 border border-ink bg-paper px-4 py-3 text-base outline-none placeholder:text-ink-3 focus:bg-white transition-colors";

export function TxStatus({ status, error, hash, success }: { status: string; error?: string; hash?: string; success?: ReactNode }) {
  if (status === "idle") return null;
  const text =
    status === "signing"
      ? "Confirm in your wallet…"
      : status === "pending"
        ? "Settling on Arc…"
        : status === "success"
          ? success ?? "Done."
          : error;
  return (
    <div
      role="status"
      className={`label flex flex-wrap items-center justify-between gap-2 border px-4 py-3 ${
        status === "error" ? "border-alert text-alert" : status === "success" ? "border-ok text-ok" : "border-ink text-ink"
      }`}
    >
      <span className="normal-case tracking-normal font-sans text-sm">{text}</span>
      {hash && explorerUrl && (
        <a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          View tx ↗
        </a>
      )}
    </div>
  );
}

const posterTones = ["bg-ink text-signal", "bg-signal text-ink", "bg-paper-3 text-ink", "bg-alert text-ink", "bg-ink text-paper"];

export function Poster({ uri, name, id, className = "" }: { uri?: string; name: string; id: bigint; className?: string }) {
  const src = imageUrl(uri);
  if (src) {
    return (
      <div className={`relative h-full w-full ${className}`}>
        <Image src={src} alt={`${name} poster`} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      </div>
    );
  }
  const tone = posterTones[Number(id % BigInt(posterTones.length))];
  return (
    <div className={`@container flex h-full w-full flex-col justify-between p-3 ${tone} ${className}`}>
      <span className="label truncate opacity-70">Nº {id.toString().padStart(3, "0")}</span>
      <span className="display text-[clamp(0.9rem,18cqi,5.5rem)] leading-[0.82] wrap-break-word">{name}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-paper-2 ${className}`} />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-ink-3 p-8 sm:p-12">
      <p className="headline text-3xl sm:text-4xl">{title}</p>
      {children}
    </div>
  );
}
