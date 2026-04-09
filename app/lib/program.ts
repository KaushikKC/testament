import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TESTAMENT_PROGRAM_ID ??
    "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
);

export const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

/** Derive the vault PDA for a given owner. */
export function vaultPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    PROGRAM_ID
  );
}

/** Derive the beneficiary PDA for a vault + wallet pair. */
export function beneficiaryPda(
  vault: PublicKey,
  wallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("beneficiary"), vault.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  );
}

/** Derive the DelegationRecord PDA for a vault + SPL mint pair. */
export function delegationRecordPda(
  vault: PublicKey,
  tokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), vault.toBuffer(), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

/** Derive the SolDelegation PDA for a vault. */
export function solDelegationPda(vault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sol_delegation"), vault.toBuffer()],
    PROGRAM_ID
  );
}

/** Derive the VaultAlias PDA for a new owner. */
export function vaultAliasPda(newOwner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_alias"), newOwner.toBuffer()],
    PROGRAM_ID
  );
}

/** Build an AnchorProvider from a wallet adapter. */
export function makeProvider(
  connection: Connection,
  wallet: Wallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

/** Basis points → percentage string. */
export function bpsToPercent(bps: number): string {
  return ((bps / 10_000) * 100).toFixed(2) + "%";
}

/** Days → seconds (for heartbeat_interval / countdown_duration args). */
export function daysToSeconds(days: number): number {
  return days * 24 * 60 * 60;
}

/** Remaining time until deadline as human string. */
export function timeUntil(deadlineUnixMs: number): string {
  const diff = deadlineUnixMs - Date.now();
  if (diff <= 0) return "Elapsed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}
