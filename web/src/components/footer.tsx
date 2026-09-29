import Link from "next/link";
import { chain, explorerUrl, turnoutAddress } from "@/lib/config";
import { shortAddress } from "@/lib/format";

export function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="gutter grid gap-10 border-b border-paper/15 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <span className="label text-paper/50">Turnout</span>
          <p className="max-w-md text-lg leading-snug text-paper/80">
            Ticketing where the money waits for you to walk in. Paid in USDC, held by a contract on Arc, released at the door.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <span className="label text-paper/50">Use it</span>
          <Link href="/events" className="hover:text-signal">Find events</Link>
          <Link href="/tickets" className="hover:text-signal">My tickets</Link>
          <Link href="/host/new" className="hover:text-signal">Host an event</Link>
        </div>
        <div className="flex flex-col gap-3">
          <span className="label text-paper/50">Verify it</span>
          {explorerUrl && turnoutAddress && (
            <a href={`${explorerUrl}/address/${turnoutAddress}`} target="_blank" rel="noreferrer" className="hover:text-signal">
              Contract {shortAddress(turnoutAddress)} ↗
            </a>
          )}
          <a href="https://github.com/Abdul-Jimoh/turnout" target="_blank" rel="noreferrer" className="hover:text-signal">
            Source on GitHub ↗
          </a>
          <span className="text-paper/50">{chain.name}</span>
        </div>
      </div>
      <div className="gutter overflow-hidden pt-6">
        <p className="display translate-y-[0.16em] text-center text-[25.5vw] leading-[0.75] text-paper select-none" aria-hidden>
          Turnout.
        </p>
      </div>
    </footer>
  );
}
