"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createWalletClient, http, parseAbiItem, type Address, type Hex } from "viem";
import { generatePrivateKey, nonceManager, privateKeyToAccount } from "viem/accounts";
import { useBalance, usePublicClient, useReadContracts } from "wagmi";
import { QrCode } from "@/components/qr";
import { Scanner } from "@/components/scanner";
import { Button, Joined, Label, PhaseTag } from "@/components/ui";
import { turnoutAbi } from "@/lib/abi";
import { decodeCheckIn, decodeDevice, encodeDevice } from "@/lib/checkin";
import { chain, turnoutAddress } from "@/lib/config";
import { friendlyError } from "@/lib/errors";
import { phaseOf, type Tier, type TurnoutEvent } from "@/lib/events";
import { shortAddress, usdc } from "@/lib/format";
import { useNow } from "@/lib/hooks";

const STORAGE_KEY = `turnout.door.${chain.id}.${turnoutAddress.toLowerCase()}`;
const LOG_RANGE = 9_000n;
const LOW_GAS = 10n ** 16n;
const staffAdded = parseAbiItem("event StaffAdded(uint256 indexed eventId, address indexed staff)");

type Stored = { key: Hex; fromBlock: string; scannedTo: string; events: string[] };
type Result = { ok: true; count: number; detail: string; event: string } | { ok: false; reason: string };

function loadDevice(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function saveDevice(d: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

export default function DoorPage() {
  const client = usePublicClient();
  const [device, setDevice] = useState<Stored | null>(null);
  const update = useCallback((d: Stored) => {
    saveDevice(d);
    setDevice(d);
  }, []);

  useEffect(() => {
    if (!client) return;
    let live = true;
    (async () => {
      let d = loadDevice();
      if (!d) {
        const block = await client.getBlockNumber();
        d = { key: generatePrivateKey(), fromBlock: block.toString(), scannedTo: (block - 1n).toString(), events: [] };
        saveDevice(d);
      }
      if (live) setDevice(d);
    })();
    return () => {
      live = false;
    };
  }, [client]);

  if (!device) {
    return (
      <section className="gutter py-20">
        <Label>Setting up this device…</Label>
      </section>
    );
  }
  return <Door device={device} onChange={update} />;
}

function useAuthorizedEvents(device: Stored, onChange: (d: Stored) => void, address: Address) {
  const client = usePublicClient();
  const deviceRef = useRef(device);
  useEffect(() => {
    deviceRef.current = device;
  });

  useEffect(() => {
    if (!client) return;
    let stopped = false;

    async function sync() {
      const latest = await client!.getBlockNumber();
      let d = deviceRef.current;
      let from = BigInt(d.scannedTo) + 1n;
      const found = new Set(d.events);
      while (from <= latest && !stopped) {
        const to = from + LOG_RANGE > latest ? latest : from + LOG_RANGE;
        const logs = await client!.getLogs({ address: turnoutAddress, event: staffAdded, args: { staff: address }, fromBlock: from, toBlock: to });
        logs.forEach((l) => found.add(l.args.eventId!.toString()));
        d = { ...d, scannedTo: to.toString(), events: [...found] };
        from = to + 1n;
      }
      if (!stopped && (d.scannedTo !== deviceRef.current.scannedTo || d.events.length !== deviceRef.current.events.length)) onChange(d);
    }

    sync().catch(() => undefined);
    const id = setInterval(() => sync().catch(() => undefined), 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [client, address, onChange]);

  const ids = useMemo(() => device.events.map(BigInt), [device.events]);
  const reads = useReadContracts({
    contracts: ids.flatMap((id) => [
      { address: turnoutAddress, abi: turnoutAbi, functionName: "isStaff", args: [id, address] } as const,
      { address: turnoutAddress, abi: turnoutAbi, functionName: "getEvent", args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0, refetchInterval: 10_000 },
  });

  return useMemo(
    () =>
      ids
        .map((id, i) => ({
          id,
          active: reads.data?.[i * 2]?.result === true,
          event: reads.data?.[i * 2 + 1]?.result as Omit<TurnoutEvent, "id"> | undefined,
        }))
        .filter((e) => e.active && e.event)
        .map((e) => ({ ...e.event!, id: e.id }) as TurnoutEvent),
    [reads.data, ids],
  );
}

function Door({ device, onChange }: { device: Stored; onChange: (d: Stored) => void }) {
  const account = useMemo(() => privateKeyToAccount(device.key, { nonceManager }), [device.key]);
  const wallet = useMemo(() => createWalletClient({ account, chain, transport: http() }), [account]);
  const client = usePublicClient();
  const events = useAuthorizedEvents(device, onChange, account.address);
  const { data: balance, refetch: refetchBalance } = useBalance({ address: account.address, query: { refetchInterval: 10_000 } });
  const now = useNow(30_000);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();
  const [admittedCount, setAdmittedCount] = useState(0);

  const handleScan = useCallback(
    async (raw: string) => {
      if (busy || result || !client) return;
      const code = decodeCheckIn(raw);
      if (!code) {
        setResult({ ok: false, reason: decodeDevice(raw) ? "That's a door device code, not a ticket." : "Not a Turnout ticket code." });
        return;
      }
      if (code.chainId !== chain.id) {
        setResult({ ok: false, reason: "This ticket is for a different network." });
        return;
      }
      if (Number(code.deadline) < Date.now() / 1000) {
        setResult({ ok: false, reason: "Code expired. Ask them to tap Show at door again." });
        return;
      }

      setBusy(true);
      try {
        const request = {
          address: turnoutAddress,
          abi: turnoutAbi,
          functionName: "checkIn",
          args: [code.ticketIds, code.deadline, code.signature],
          account,
        } as const;
        await client.simulateContract(request);
        const hash = await wallet.writeContract(request);
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The check-in transaction failed.");

        const first = await client.readContract({ address: turnoutAddress, abi: turnoutAbi, functionName: "getTicket", args: [code.ticketIds[0]] });
        const [tiers, ev] = await Promise.all([
          client.readContract({ address: turnoutAddress, abi: turnoutAbi, functionName: "getTiers", args: [first.eventId] }) as Promise<readonly Tier[]>,
          client.readContract({ address: turnoutAddress, abi: turnoutAbi, functionName: "getEvent", args: [first.eventId] }),
        ]);
        const counts = new Map<string, number>();
        for (const id of code.ticketIds) {
          const t = id === code.ticketIds[0] ? first : await client.readContract({ address: turnoutAddress, abi: turnoutAbi, functionName: "getTicket", args: [id] });
          const name = tiers[t.tier]?.name ?? "Ticket";
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        setAdmittedCount((n) => n + code.ticketIds.length);
        setResult({
          ok: true,
          count: code.ticketIds.length,
          detail: [...counts].map(([name, n]) => `${name} × ${n}`).join("  ·  "),
          event: ev.name,
        });
        refetchBalance();
      } catch (e) {
        setResult({ ok: false, reason: friendlyError(e) });
      } finally {
        setBusy(false);
      }
    },
    [busy, result, client, account, wallet, refetchBalance],
  );

  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(undefined), result.ok ? 2600 : 4000);
    return () => clearTimeout(id);
  }, [result]);

  const lowGas = balance !== undefined && balance.value < LOW_GAS;

  if (scanning) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-ink text-paper">
        <div className="gutter flex items-center justify-between py-3">
          <span className="label text-paper/70">
            <Joined parts={[`${admittedCount} admitted`, balance ? `${usdc(balance.value)} gas` : "…"]} />
          </span>
          <button onClick={() => setScanning(false)} className="label border border-paper/40 px-3 py-2">
            Stop
          </button>
        </div>
        <Scanner onScan={handleScan} paused={busy || !!result} className="flex-1" />
        <div className="gutter py-4">
          <p className="label text-center text-paper/60">{busy ? "Checking in…" : "Point at the guest's check-in code"}</p>
        </div>
        {result && (
          <button
            onClick={() => setResult(undefined)}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center ${result.ok ? "bg-signal text-ink" : "bg-alert text-ink"}`}
          >
            <span className="display text-[clamp(5rem,28vw,12rem)]">{result.ok ? "In." : "No."}</span>
            {result.ok ? (
              <>
                <span className="headline text-3xl">
                  {result.count} {result.count === 1 ? "guest" : "guests"}
                </span>
                <span className="label text-base">{result.detail}</span>
                <span className="label opacity-70">{result.event}</span>
              </>
            ) : (
              <span className="max-w-sm text-xl leading-snug">{result.reason}</span>
            )}
            <span className="label opacity-60">Tap to continue</span>
          </button>
        )}
      </div>,
      document.body,
    );
  }

  return (
    <section className="gutter mx-auto flex w-full max-w-xl flex-col gap-8 py-10 md:py-14">
      <div className="flex flex-col gap-3">
        <Label>
          <Joined parts={["Door device", shortAddress(account.address)]} />
        </Label>
        <h1 className="display text-[clamp(4rem,18vw,8rem)]">{events.length ? "Ready" : "Pair me"}</h1>
      </div>

      {events.length === 0 ? (
        <>
          <p className="text-lg leading-snug text-ink-2">
            On the host&apos;s event page, open <strong className="text-ink">Door devices</strong> and scan this code. This screen updates by itself once
            the device is added.
          </p>
          <div className="mx-auto w-full max-w-xs border border-ink p-3">
            <QrCode value={encodeDevice(account.address)} label="Door device pairing code" />
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(account.address)}
            className="self-center border border-ink px-3 py-2 font-mono text-xs break-all hover:bg-ink hover:text-paper"
          >
            <span className="block">{account.address}</span>
            <span className="label mt-1 block opacity-60">Tap to copy</span>
          </button>
          <p className="label flex items-center justify-center gap-2 text-ink-2">
            <span className="size-2 animate-blink rounded-full bg-ink" /> Waiting for the host
          </p>
        </>
      ) : (
        <>
          <ul className="flex flex-col border-t border-ink">
            {events.map((e) => (
              <li key={e.id.toString()} className="flex items-center justify-between gap-3 border-b border-ink py-4">
                <span className="headline text-2xl tracking-[-0.03em]">{e.name}</span>
                <PhaseTag phase={phaseOf(e, now)} />
              </li>
            ))}
          </ul>
          <Button variant="signal" onClick={() => setScanning(true)} disabled={lowGas} className="min-h-16 text-base">
            Start scanning
          </Button>
        </>
      )}

      <div className={`flex flex-col gap-2 border p-4 ${lowGas ? "border-alert" : "border-ink"}`}>
        <div className="flex items-center justify-between">
          <Label>Gas on this device</Label>
          <span className="font-mono">{balance ? usdc(balance.value) : "…"}</span>
        </div>
        <p className="text-sm text-ink-2">
          {lowGas
            ? "Not enough USDC to submit check-ins. The host can top this device up from the event page."
            : "Each check-in costs a fraction of a cent. The key for this device lives only in this browser."}
        </p>
      </div>
      {events.length > 0 && balance && balance.value > LOW_GAS && <ReturnGas wallet={wallet} to={events[0].host} balance={balance.value} />}
    </section>
  );
}

function ReturnGas({ wallet, to, balance }: { wallet: ReturnType<typeof createWalletClient>; to: Address; balance: bigint }) {
  const client = usePublicClient();
  const [state, setState] = useState<string>();

  async function send() {
    try {
      setState("Sending…");
      const gasPrice = await client!.getGasPrice();
      const value = balance - gasPrice * 21_000n * 2n;
      if (value <= 0n) return setState("Nothing left to return.");
      const hash = await wallet.sendTransaction({ account: wallet.account!, chain, to, value });
      await client!.waitForTransactionReceipt({ hash });
      setState(`Returned ${usdc(value)} to the host.`);
    } catch (e) {
      setState(friendlyError(e));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={send} className="label self-start underline underline-offset-4">
        Done for the night? Return leftover gas to {shortAddress(to)}
      </button>
      {state && <span className="text-sm text-ink-2">{state}</span>}
    </div>
  );
}
