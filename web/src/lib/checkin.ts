import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { chain, turnoutAddress } from "./config";

// Must match CHECK_IN_TYPEHASH and the EIP712("Turnout", "1") domain in the contract.
export const checkInTypes = {
  CheckIn: [
    { name: "ticketIds", type: "uint256[]" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const checkInDomain = {
  name: "Turnout",
  version: "1",
  chainId: chain.id,
  verifyingContract: turnoutAddress,
} as const;

// The contract only accepts signatures within 10 minutes of their deadline; stay a little inside that.
export const CODE_LIFETIME = 8 * 60;

export type CheckInCode = { chainId: number; ticketIds: bigint[]; deadline: bigint; signature: Hex };

const TICKET_PREFIX = "turnout:1";
const DEVICE_PREFIX = "turnout-door:";

export function encodeCheckIn({ ticketIds, deadline, signature }: Omit<CheckInCode, "chainId">) {
  return [TICKET_PREFIX, chain.id, ticketIds.join("-"), deadline, signature].join(":");
}

export function decodeCheckIn(raw: string): CheckInCode | null {
  const parts = raw.trim().split(":");
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== TICKET_PREFIX) return null;
  const [, , chainId, ids, deadline, signature] = parts;
  if (!/^\d+$/.test(chainId) || !/^\d+(-\d+)*$/.test(ids) || !/^\d+$/.test(deadline) || !isHex(signature)) return null;
  return { chainId: Number(chainId), ticketIds: ids.split("-").map(BigInt), deadline: BigInt(deadline), signature };
}

export function encodeDevice(address: Address) {
  return `${DEVICE_PREFIX}${address}`;
}

export function decodeDevice(raw: string): Address | null {
  const value = raw.trim().replace(DEVICE_PREFIX, "");
  return isAddress(value) ? getAddress(value) : null;
}
