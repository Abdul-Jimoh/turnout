# Turnout

**Event tickets paid in USDC, held in escrow on Arc, released to the host at the door.**

Live on Arc mainnet: **[getturnout.site](https://www.getturnout.site)** · Demo video: _link coming_

When you buy a ticket to an independent event, the money goes straight to the organiser. If the event is cancelled or never happens, getting it back is slow, awkward or impossible. Honest first-time hosts have the opposite problem: they can't prove they're legit.

Turnout puts a contract between the two. The buyer's USDC sits in escrow and is released to the host **per ticket, only when that ticket's holder is checked in at the door**. If the event is cancelled, or the holder is never scanned, they claim the money back themselves. No platform, no support ticket, no admin key.

## How it works

1. **A host creates an event:** name, venue, poster, schedule and up to 10 ticket tiers. One transaction. The schedule and prices are locked from that moment.
2. **A buyer pays in USDC.** One transaction with native USDC, so there's no approval step and no second gas token. The money goes to the contract, not the host.
3. **The host pairs door phones.** Any phone opens `/door` and generates its own key in the browser. The host authorizes it for one event and sends it a few cents of gas in the same transaction. One phone per entrance.
4. **Check-in.** At the door, the buyer's wallet signs a short EIP-712 message listing their tickets and a deadline a few minutes ahead. It shows as a QR code, the door phone scans it and submits it. The contract only accepts it if the **ticket holder** signed it, so the host can't check people in who didn't show up.
5. **Payout.** Each checked-in ticket's price is withdrawable by the host immediately.
6. **Refunds.**
   - Cancelled event: every ticket is refundable at any time.
   - Event happened, ticket never scanned: refundable by its holder for 7 days after the event ends.
   - Unclaimed unscanned tickets go to the host once those 7 days pass.

Every ticket's price ends up with exactly one party: the host (checked in, or unclaimed after the window) or the buyer (refunded).

## Why Arc

- **USDC is the gas token.** Buyers and hosts deal in dollars only. Buying is a single `payable` call.
- **Fees are tiny and predictable.** Measured on mainnet: creating an event ≈ $0.008, buying ≈ $0.003, a check-in ≈ $0.002, a withdrawal ≈ $0.001. That makes $5 tickets and per-guest check-ins practical.
- **Instant, deterministic finality.** A scan is final in under a second, so door staff never wait on confirmations and there are no reorgs to reconcile.

## Deployments

| Network | Address |
|---|---|
| Arc mainnet (5042) | [`0xfA7Ba87b2FFf0629dEAD5C20665D9e44eF742a76`](https://explorer.arc.io/address/0xfA7Ba87b2FFf0629dEAD5C20665D9e44eF742a76) (verified) |
| Arc testnet (5042002) | [`0x7deCBf269f987449dAC2E3f43e5Ebd7896D3B78f`](https://explorer.testnet.arc.io/address/0x7deCBf269f987449dAC2E3f43e5Ebd7896D3B78f) (verified) |

The contract has no owner, no admin functions, no pause and no upgrade path. Nobody can move a buyer's money except under the rules above.

## Repository

```
contracts/   Foundry project: src/Turnout.sol, tests, deploy and lifecycle scripts
web/         Next.js app: events, tickets, host dashboard, door scanner
```

The web app has no backend or database. It reads state straight from the contract through paginated view functions, and posters are stored on IPFS with only their `ipfs://` URI onchain. The single server route uploads posters to Pinata.

## Threat model

| Threat | Mitigation |
|---|---|
| Host fakes check-ins to unlock escrow | Every check-in needs an EIP-712 signature from the ticket holder (ECDSA, or ERC-1271 for smart wallets) |
| Host collects signatures in advance | Signatures are only accepted within 10 minutes of their deadline, and only inside the event's check-in window |
| A QR screenshot is passed on or replayed | Tickets move `Valid → CheckedIn` once; a second scan reverts |
| Two doors scan the same ticket | The first transaction wins; the second reverts with no double count |
| Host buys their own tickets to game refunds | Refund eligibility is decided per ticket, never by comparing tickets across buyers |
| Host moves the date or price after selling | Schedule, tiers and prices are immutable after creation; events last at most 30 days |
| Refund after attending, or refunding twice | Only `Valid` tickets can be refunded, and the status changes before any transfer |
| Reentrancy on payouts | Checks-effects-interactions plus `ReentrancyGuard` on every value transfer |
| One event drains another's funds | All accounting is per event, and payouts are bounded by that event's own counters |
| Payout to a contract or blocklisted address reverts | Pull payments with a caller-chosen recipient, so one failing payout can't block anyone else |
| Lost or leaked door-device key | It can only submit holder-signed check-ins for its event; the host can remove it. At most its gas top-up is at risk |
| 18- vs 6-decimal USDC confusion | The contract only uses native `msg.value` (18 decimals) and requires prices in whole micro-USDC, so amounts stay exact in both views |
| EIP-7702 delegated buyer wallets | A plain signature from the holder is accepted before ERC-1271 is consulted |

**Accepted trade-offs**
- A buyer who simply didn't attend can still reclaim their money during the claim window. Hosts are guaranteed revenue only for guests who actually came through the door.
- There is no manual check-in for guests without a phone, since that would let a host fake attendance.
- Door devices need an internet connection.

## Testing

```
cd contracts
arc-forge test --network arc
arc-forge coverage --network arc --no-match-coverage "(test|script)/"
```

- **108 tests:** unit tests for every rule and revert, fuzz tests on amounts and timing (1,000 runs each), and invariant tests over random sequences of create, buy, check-in, withdraw, refund and cancel (16,384 calls per invariant, zero reverts).
- **Invariants checked:** the contract balance always equals what's owed across all events, per-event counters always match the tickets they summarise, and a settled ticket never changes state.
- **Coverage:** 100% of lines, statements, branches and functions in `Turnout.sol`.
- The full lifecycle (check-in, withdraw, cancel, refund and a claim-window refund) has been run against both testnet and mainnet.

Coverage shows every path is exercised, not that the contract is free of bugs. **Turnout has not been audited.** Treat it as experimental and use small amounts.

## Running it locally

Requirements: [Arc Foundry](https://github.com/circlefin/arc-foundry) (`arc-forge`, `arc-anvil`), Node 22, pnpm.

```bash
git clone --recurse-submodules https://github.com/Abdul-Jimoh/turnout.git
cd turnout

# local Arc chain with demo hosts, events and tickets
arc-anvil --network arc
cd contracts && arc-forge script script/Seed.s.sol --network arc --rpc-url http://127.0.0.1:8545 --broadcast

# web app
cd ../web && cp .env.example .env.local
# set NEXT_PUBLIC_CHAIN=arcLocal and NEXT_PUBLIC_TURNOUT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
pnpm install && pnpm dev
```

Deploying to a public network uses a Foundry keystore:

```bash
cd contracts && cp .env.example .env && source .env
arc-forge script script/Deploy.s.sol --network arc --rpc-url $ARC_RPC_URL --account <keystore> --broadcast
```

## What's next

- Host reputation from onchain history, which is already recorded per host
- Ticket transfers and resale with price caps
- Email or passkey wallets for buyers who don't have one yet
- An external audit

## License

MIT
