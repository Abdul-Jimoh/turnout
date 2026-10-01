"use client";

import { useGSAP } from "@gsap/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import gsap from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { chain } from "@/lib/config";
import { Joined } from "./ui";

const nav = [
  { href: "/events", label: "Events" },
  { href: "/tickets", label: "My tickets" },
  { href: "/host", label: "Host" },
];

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 rounded-full border border-ink px-2.5 py-2 xs:gap-2.5 xs:px-3 ${className}`}>
      <span className="relative block size-5 rounded-full bg-ink transition-transform duration-500 group-hover:rotate-180">
        <span className="absolute top-1/2 right-0.5 size-1.5 -translate-y-1/2 rounded-full bg-signal" />
      </span>
      <span className="headline text-base tracking-[-0.02em] xs:text-lg">TURNOUT</span>
    </Link>
  );
}

export function WalletButton({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain: current, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        const cls = "label inline-flex min-h-10 items-center gap-2 border border-ink px-3 py-2 transition-colors";
        if (!mounted) return <span className={`${cls} opacity-0`}>Connect</span>;
        if (!account) {
          return (
            <button onClick={openConnectModal} className={`${cls} bg-ink text-paper hover:bg-signal hover:text-ink`}>
              Connect
            </button>
          );
        }
        if (current?.unsupported) {
          return (
            <button onClick={openChainModal} className={`${cls} bg-alert text-ink`}>
              Switch to Arc
            </button>
          );
        }
        return (
          <button onClick={openAccountModal} className={`${cls} hover:bg-ink hover:text-paper`}>
            {!compact && account.displayBalance && <span className="hidden text-ink-2 sm:inline">{account.displayBalance}</span>}
            <span className="size-2 rounded-full bg-ok" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function WrongNetwork() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  if (!isConnected || chainId === chain.id) return null;
  return (
    <div className="gutter flex flex-wrap items-center justify-between gap-3 bg-alert py-2.5">
      <span className="label text-ink">Your wallet is on another network. Turnout runs on {chain.name}.</span>
      <button onClick={() => switchChain({ chainId: chain.id })} disabled={isPending} className="label underline underline-offset-4">
        {isPending ? "Switching…" : `Switch to ${chain.name}`}
      </button>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  useGSAP(
    () => {
      if (!open || !menuRef.current) return;
      gsap.fromTo(menuRef.current, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "expo.out" });
      gsap.from(menuRef.current.querySelectorAll("[data-item]"), { yPercent: 110, duration: 0.8, ease: "expo.out", stagger: 0.06, delay: 0.1 });
    },
    { dependencies: [open] },
  );

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-paper md:bg-paper/95 md:backdrop-blur-sm">
      <WrongNetwork />
      <div className="gutter flex h-16 items-center justify-between gap-4 md:h-20">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={`label relative py-1 text-sm ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}>
                {item.label}
                {active && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-ink" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <WalletButton compact />
          <button
            onClick={() => setOpen((v) => !v)}
            className="label flex min-h-10 items-center border border-ink px-3 md:hidden"
            aria-expanded={open}
            aria-label="Menu"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed inset-0 z-30 flex flex-col justify-between bg-ink px-[var(--gutter)] pt-24 pb-[var(--gutter)] text-paper md:hidden"
          >
            <nav className="flex flex-col">
              {[{ href: "/", label: "Home" }, ...nav, { href: "/host/new", label: "Create event" }, { href: "/door", label: "Door scanner" }].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="overflow-hidden border-b border-paper/20 py-3">
                  <span data-item className="display block text-[clamp(3rem,16vw,6rem)]">
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
            <span className="label text-paper/60">
              <Joined parts={["Tickets escrowed in USDC", chain.name]} />
            </span>
          </div>,
          document.body,
        )}
    </header>
  );
}
