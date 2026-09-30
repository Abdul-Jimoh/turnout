"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePublicClient, useSignTypedData } from "wagmi";
import { checkInDomain, checkInTypes, CODE_LIFETIME, encodeCheckIn } from "@/lib/checkin";
import { friendlyError } from "@/lib/errors";
import { TicketStatus, type Ticket, type Tier, type TurnoutEvent } from "@/lib/events";
import { duration } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { QrCode } from "./qr";
import { Button, Joined } from "./ui";

type Code = { value: string; ids: bigint[]; expiresAt: number };

export function DoorPass({
  event,
  tiers,
  tickets,
  onClose,
  refetch,
}: {
  event: TurnoutEvent;
  tiers: Tier[];
  tickets: Ticket[];
  onClose: () => void;
  refetch: () => void;
}) {
  const valid = tickets.filter((t) => t.status === TicketStatus.Valid);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(valid.slice(0, 20).map((t) => t.id.toString())));
  const [code, setCode] = useState<Code>();
  const [error, setError] = useState<string>();
  const client = usePublicClient();
  const { signTypedDataAsync, isPending } = useSignTypedData();
  const now = useNow(500);

  const admitted = code?.ids.every((id) => tickets.find((t) => t.id === id)?.status === TicketStatus.CheckedIn);
  const expired = !!code && !admitted && now >= code.expiresAt;

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!code || admitted) return;
    const id = setInterval(refetch, 3000);
    return () => clearInterval(id);
  }, [code, admitted, refetch]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }

  async function generate() {
    setError(undefined);
    try {
      const ids = valid.filter((t) => selected.has(t.id.toString())).map((t) => t.id);
      const block = await client!.getBlock();
      const deadline = block.timestamp + BigInt(CODE_LIFETIME);
      const signature = await signTypedDataAsync({
        domain: checkInDomain,
        types: checkInTypes,
        primaryType: "CheckIn",
        message: { ticketIds: ids, deadline },
      });
      const skew = Date.now() / 1000 - Number(block.timestamp);
      setCode({ value: encodeCheckIn({ ticketIds: ids, deadline, signature }), ids, expiresAt: Number(deadline) + skew });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const tierName = (t: Ticket) => tiers[t.tier]?.name ?? `Tier ${t.tier + 1}`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink text-paper" role="dialog" aria-modal aria-label="Door pass">
      <div className="gutter flex items-center justify-between border-b border-paper/15 py-4">
        <span className="label text-paper/60">
          <Joined parts={["Door pass", event.name]} />
        </span>
        <button onClick={onClose} className="label border border-paper/40 px-3 py-2 hover:bg-paper hover:text-ink">
          Close
        </button>
      </div>

      <div className="gutter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-8">
        {admitted ? (
          <div className="flex flex-col items-center gap-4 bg-signal p-10 text-center text-ink">
            <span className="display text-8xl">In.</span>
            <p className="text-lg">
              {code!.ids.length} {code!.ids.length === 1 ? "ticket" : "tickets"} checked in. Enjoy {event.name}.
            </p>
          </div>
        ) : code && !expired ? (
          <>
            <QrCode value={code.value} label="Check-in code" className="p-3" />
            <div className="flex items-center justify-between">
              <span className="label text-paper/60">
                {code.ids.length} {code.ids.length === 1 ? "ticket" : "tickets"}
              </span>
              <span className="label text-signal">Expires in {duration(code.expiresAt - now)}</span>
            </div>
            <p className="text-sm text-paper/60">Show this to door staff. It can only be used once and stops working when it expires.</p>
          </>
        ) : (
          <>
            <h2 className="display text-6xl">{expired ? "Code expired" : "Show at door"}</h2>
            <p className="text-paper/70">
              {expired
                ? "Codes only last a few minutes so they can't be reused. Make a fresh one."
                : "Pick the tickets you're checking in now. Your wallet signs a short message. It's free, and nothing is sent onchain."}
            </p>
            <ul className="flex flex-col gap-2">
              {valid.map((t) => {
                const on = selected.has(t.id.toString());
                return (
                  <li key={t.id.toString()}>
                    <button
                      onClick={() => toggle(t.id.toString())}
                      className={`flex w-full items-center justify-between border px-4 py-3 text-left transition-colors ${on ? "border-signal bg-signal text-ink" : "border-paper/30"}`}
                      aria-pressed={on}
                    >
                      <span className="label">Nº {t.id.toString().padStart(4, "0")}</span>
                      <span className="headline text-xl tracking-[-0.02em]">{tierName(t)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && <p className="text-sm text-alert">{error}</p>}
            <Button variant="signal" onClick={generate} disabled={isPending || selected.size === 0}>
              {isPending ? "Sign in your wallet…" : `Get code for ${selected.size} ${selected.size === 1 ? "ticket" : "tickets"}`}
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
