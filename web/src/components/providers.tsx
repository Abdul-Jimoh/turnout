"use client";

import { RainbowKitProvider, lightTheme, type Theme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const base = lightTheme({ accentColor: "#0e0e0c", accentColorForeground: "#ffe14a", borderRadius: "none", overlayBlur: "small" });

const theme: Theme = {
  ...base,
  colors: { ...base.colors, modalBackground: "#f2f1ec", modalBorder: "#0e0e0c", generalBorder: "#0e0e0c" },
  fonts: { body: "var(--font-archivo), system-ui, sans-serif" },
  shadows: { ...base.shadows, dialog: "8px 8px 0 #0e0e0c" },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } } }));

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "Turnout" }}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
