"use client";
import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";

// Import wallet adapter default styles
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");

export default function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
