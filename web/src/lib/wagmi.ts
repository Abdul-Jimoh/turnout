import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http } from "wagmi";
import { chain, walletConnectProjectId } from "./config";

export const wagmiConfig = getDefaultConfig({
  appName: "Turnout",
  appDescription: "Event tickets paid in USDC, held in escrow on Arc until you show up.",
  projectId: walletConnectProjectId,
  chains: [chain],
  transports: { [chain.id]: http() },
  wallets: [
    { groupName: "Popular", wallets: [metaMaskWallet, rabbyWallet, rainbowWallet, coinbaseWallet, walletConnectWallet] },
  ],
  ssr: true,
});
