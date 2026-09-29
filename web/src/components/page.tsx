"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { Reveal } from "./motion";
import { Button, Label } from "./ui";

export function PageHeader({ label, title, children }: { label: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="gutter flex flex-col gap-6 border-b border-ink pt-10 pb-8 md:pt-14">
      <Reveal as="span" className="label text-ink-2">
        {label}
      </Reveal>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <Reveal as="h1" type="lines" onScroll={false} className="display text-[clamp(4rem,16vw,11rem)] wrap-break-word">
          {title}
        </Reveal>
        {children && <Reveal delay={0.2} onScroll={false}>{children}</Reveal>}
      </div>
    </section>
  );
}

export function RequireWallet({ reason, children }: { reason: string; children: ReactNode }) {
  const { isConnected } = useAccount();
  if (isConnected) return <>{children}</>;
  return (
    <section className="gutter py-16">
      <div className="flex flex-col items-start gap-6 border border-ink p-8 sm:p-12">
        <Label>Wallet needed</Label>
        <p className="headline max-w-2xl text-4xl sm:text-5xl">{reason}</p>
        <ConnectButton.Custom>
          {({ openConnectModal }) => <Button onClick={openConnectModal}>Connect wallet</Button>}
        </ConnectButton.Custom>
      </div>
    </section>
  );
}

export function StatBox({ label, value, foot, tone = "" }: { label: string; value: ReactNode; foot?: ReactNode; tone?: string }) {
  return (
    <div className={`flex flex-col justify-between gap-6 border-r border-b border-ink p-5 md:p-6 ${tone}`}>
      <span className="label opacity-70">{label}</span>
      <span className="font-mono text-[clamp(2rem,5vw,3.25rem)] leading-none font-bold tracking-tight">{value}</span>
      {foot && <span className="label opacity-70">{foot}</span>}
    </div>
  );
}
