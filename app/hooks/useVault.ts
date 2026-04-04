import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { vaultPda, beneficiaryPda, PROGRAM_ID } from "../lib/program";

export interface VaultData {
  address: PublicKey;
  owner: PublicKey;
  heartbeatInterval: number; // seconds
  lastHeartbeat: number;     // unix timestamp
  countdownDuration: number; // seconds
  countdownStartedAt: number;
  disputeWindow: number;
  beneficiaryCount: number;
  totalSharesBps: number;
  isLocked: boolean;
  isActive: boolean;
  messageHash: Uint8Array;
  balanceLamports: number;
}

export interface BeneficiaryData {
  address: PublicKey;
  vault: PublicKey;
  wallet: PublicKey;
  shareBps: number;
  hasClaimed: boolean;
  index: number;
}

export function useVault() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setVault(null);
      setBeneficiaries([]);
      return;
    }
    fetchVault(publicKey);
  }, [publicKey, connection]);

  async function fetchVault(owner: PublicKey) {
    setLoading(true);
    setError(null);
    try {
      const [pda] = vaultPda(owner);

      const accountInfo = await connection.getAccountInfo(pda);
      if (!accountInfo) {
        setVault(null);
        return;
      }

      // Manually decode vault account (8 byte discriminator + fields)
      const data = accountInfo.data;
      let offset = 8; // skip discriminator

      const readPubkey = () => {
        const pk = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;
        return pk;
      };
      const readI64 = () => {
        const val = Number(
          BigInt.asIntN(64, data.readBigInt64LE(offset))
        );
        offset += 8;
        return val;
      };
      const readU8 = () => data[offset++];
      const readU16 = () => {
        const val = data.readUInt16LE(offset);
        offset += 2;
        return val;
      };
      const readBool = () => Boolean(data[offset++]);
      const readBytes32 = () => {
        const bytes = data.slice(offset, offset + 32);
        offset += 32;
        return bytes;
      };

      const vaultOwner = readPubkey();
      const heartbeatInterval = readI64();
      const lastHeartbeat = readI64();
      const countdownDuration = readI64();
      const countdownStartedAt = readI64();
      const disputeWindow = readI64();
      const beneficiaryCount = readU8();
      const totalSharesBps = readU16();
      const isLocked = readBool();
      const isActive = readBool();
      const messageHash = readBytes32();
      // bump = readU8() — not needed client-side

      const balanceLamports = accountInfo.lamports;

      setVault({
        address: pda,
        owner: vaultOwner,
        heartbeatInterval,
        lastHeartbeat,
        countdownDuration,
        countdownStartedAt,
        disputeWindow,
        beneficiaryCount,
        totalSharesBps,
        isLocked,
        isActive,
        messageHash,
        balanceLamports,
      });

      // Fetch all beneficiary accounts using getProgramAccounts with memcmp filter
      const beneficiaryAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: 77 }, // Beneficiary::LEN
          { memcmp: { offset: 8, bytes: pda.toBase58() } }, // vault field
        ],
      });

      const parsed: BeneficiaryData[] = beneficiaryAccounts.map(({ pubkey, account }) => {
        const d = account.data;
        let o = 8;
        const vault = new PublicKey(d.slice(o, o + 32)); o += 32;
        const wallet = new PublicKey(d.slice(o, o + 32)); o += 32;
        const shareBps = d.readUInt16LE(o); o += 2;
        const hasClaimed = Boolean(d[o++]);
        const index = d[o++];
        return { address: pubkey, vault, wallet, shareBps, hasClaimed, index };
      });

      parsed.sort((a, b) => a.index - b.index);
      setBeneficiaries(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch vault");
    } finally {
      setLoading(false);
    }
  }

  return { vault, beneficiaries, loading, error, refetch: () => publicKey && fetchVault(publicKey) };
}

/** Fetch vault data for a specific owner pubkey (e.g. for beneficiary claim view). */
export async function fetchVaultByOwner(
  connection: import("@solana/web3.js").Connection,
  ownerPubkey: PublicKey
) {
  const [pda] = vaultPda(ownerPubkey);
  return connection.getAccountInfo(pda);
}
