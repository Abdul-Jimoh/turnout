import { defineChain, type Address } from "viem";
import { arc, arcTestnet } from "viem/chains";

const arcLocal = defineChain({
  id: 31337,
  name: "Arc Local",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const chains = { arc, arcTestnet, arcLocal } as const;

export const chain = chains[(process.env.NEXT_PUBLIC_CHAIN ?? "arcTestnet") as keyof typeof chains] ?? arcTestnet;

export const turnoutAddress = (process.env.NEXT_PUBLIC_TURNOUT_ADDRESS ?? "") as Address;

export const explorerUrl = chain.blockExplorers?.default.url;

export const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "turnout-local";

export const ipfsGateway = (process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io").replace(/\/$/, "");

export const CLAIM_WINDOW = 7n * 24n * 60n * 60n;
export const DEFAULT_CHECK_IN_LEAD = 6 * 60 * 60;
export const MAX_TIERS = 10;
export const MAX_BATCH = 20;
