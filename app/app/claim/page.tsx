"use client";
import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Testament } from "../../lib/testament";
import idl from "../../lib/idl.json";
import { beneficiaryPda, bpsToPercent, PROGRAM_ID } from "../../lib/program";
import Nav from "../../components/Nav";

type ClaimState = "idle" | "checking" | "ready" | "not_claimable" | "no_beneficiary" | "claiming" | "done" | "error";

interface ClaimInfo {
  vaultPubkey: PublicKey;
  beneficiaryPdaAddr: PublicKey;
  shareBps: number;
  estimatedSol: number;
  countdownStartedAt: number;
  countdownDuration: number;
  claimableAt: number;
}

export default function ClaimPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [vaultAddress, setVaultAddress] = useState("");
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  function makeProgram() {
    const provider = new AnchorProvider(
      connection,
      wallet as Parameters<typeof AnchorProvider>[1],
      { commitment: "confirmed" }
    );
    return new Program<Testament>(idl as Testament, provider);
  }

  const checkVault = useCallback(async () => {
    if (!vaultAddress.trim() || !wallet.publicKey) return;
    setClaimState("checking");
    setTxError(null);

    try {
      const vaultPubkey = new PublicKey(vaultAddress.trim());
      const [beneficiaryPdaAddr] = beneficiaryPda(vaultPubkey, wallet.publicKey);

      // Fetch vault account
      const vaultInfo = await connection.getAccountInfo(vaultPubkey);
      if (!vaultInfo) throw new Error("Vault account not found on-chain.");

      // Decode vault (skip 8-byte discriminator)
      const d = vaultInfo.data;
      let offset = 8 + 32; // skip discriminator + owner
      const readI64 = () => { const v = Number(BigInt.asIntN(64, d.readBigInt64LE(offset))); offset += 8; return v; };
      const heartbeatInterval = readI64();
      const lastHeartbeat = readI64();
      const countdownDuration = readI64();
      const countdownStartedAt = readI64();
      offset += 8; // dispute_window
      offset += 1; // beneficiary_count
      offset += 2; // total_shares_bps
      offset += 1; // is_locked
      const isActive = Boolean(d[offset++]);

      if (!isActive) throw new Error("This vault has been closed.");
      if (countdownStartedAt === 0) {
        // check if heartbeat elapsed so user knows status
        const nowSec = Math.floor(Date.now() / 1000);
        const elapsedSec = nowSec - lastHeartbeat;
        if (elapsedSec < heartbeatInterval) {
          const remaining = Math.ceil((heartbeatInterval - elapsedSec) / 86400);
          throw new Error(`Vault owner is still active. Countdown can be triggered in ~${remaining} days.`);
        }
        setClaimState("not_claimable");
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const claimableAt = countdownStartedAt + countdownDuration;
      if (nowSec < claimableAt) {
        setClaimState("not_claimable");
        setClaimInfo({
          vaultPubkey, beneficiaryPdaAddr,
          shareBps: 0, estimatedSol: 0,
          countdownStartedAt, countdownDuration, claimableAt,
        });
        return;
      }

      // Fetch beneficiary account
      const beneficiaryInfo = await connection.getAccountInfo(beneficiaryPdaAddr);
      if (!beneficiaryInfo) {
        setClaimState("no_beneficiary");
        return;
      }

      const bd = beneficiaryInfo.data;
      const shareBps = bd.readUInt16LE(8 + 32 + 32); // skip discriminator + vault + wallet
      const hasClaimed = Boolean(bd[8 + 32 + 32 + 2]);
      if (hasClaimed) throw new Error("You have already claimed your share from this vault.");

      const vaultBalance = vaultInfo.lamports;
      const estimatedSol = (vaultBalance * shareBps) / 10000 / LAMPORTS_PER_SOL;

      setClaimInfo({ vaultPubkey, beneficiaryPdaAddr, shareBps, estimatedSol, countdownStartedAt, countdownDuration, claimableAt });
      setClaimState("ready");
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Failed to fetch vault");
      setClaimState("error");
    }
  }, [vaultAddress, wallet.publicKey, connection]);

  const handleClaim = useCallback(async () => {
    if (!wallet.publicKey || !claimInfo) return;
    setClaimState("claiming");
    setTxError(null);

    try {
      const program = makeProgram();
      await program.methods
        .claim()
        .accounts({
          vault: claimInfo.vaultPubkey,
          beneficiary: claimInfo.beneficiaryPdaAddr,
          beneficiarySigner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setClaimState("done");
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Claim transaction failed");
      setClaimState("error");
    }
  }, [wallet, connection, claimInfo]);

  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-20 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Claim inheritance</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Enter the vault address you were designated as a beneficiary for,
            or open the Blink URL sent to you.
          </p>
        </div>

        {/* Vault address input */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">Vault address</label>
          <div className="flex gap-2">
            <input type="text" placeholder="e.g. 7xKp3fQz…"
              value={vaultAddress}
              onChange={(e) => { setVaultAddress(e.target.value); setClaimState("idle"); setTxError(null); }}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
            <button onClick={checkVault}
              disabled={!vaultAddress.trim() || !wallet.connected || claimState === "checking"}
              className="px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium disabled:opacity-50">
              {claimState === "checking" ? "Checking…" : "Check"}
            </button>
          </div>
          {!wallet.connected && (
            <p className="text-xs text-zinc-600">Connect your wallet to check eligibility.</p>
          )}
        </div>

        {/* Error */}
        {claimState === "error" && txError && (
          <div className="rounded-xl border border-red-900/40 bg-red-900/10 p-5 text-sm text-red-400">{txError}</div>
        )}

        {/* Not claimable yet */}
        {claimState === "not_claimable" && claimInfo && (
          <div className="rounded-xl border border-yellow-900/40 bg-yellow-900/10 p-5 flex flex-col gap-2">
            <span className="text-yellow-400 font-medium text-sm">Not claimable yet</span>
            <p className="text-zinc-400 text-xs">
              Countdown is active. Claims open {new Date(claimInfo.claimableAt * 1000).toLocaleDateString()}.
              {claimInfo.claimableAt > nowSec && ` (~${Math.ceil((claimInfo.claimableAt - nowSec) / 86400)} days remaining)`}
            </p>
          </div>
        )}

        {/* No beneficiary record */}
        {claimState === "no_beneficiary" && (
          <div className="rounded-xl border border-zinc-700 p-5 text-sm text-zinc-400">
            Your wallet is not registered as a beneficiary on this vault.
          </div>
        )}

        {/* Ready */}
        {(claimState === "ready" || claimState === "claiming") && claimInfo && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-green-900/40 bg-green-900/10 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 font-medium text-sm">Vault is claimable</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">Your share</span>
                  <span className="font-semibold text-lg">{bpsToPercent(claimInfo.shareBps)}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 block mb-1">Estimated</span>
                  <span className="font-semibold text-lg">{claimInfo.estimatedSol.toFixed(4)} SOL</span>
                </div>
              </div>
              <p className="text-xs text-zinc-600">Exact amount is confidential until transfer completes.</p>
            </div>
            <button onClick={handleClaim} disabled={claimState === "claiming"}
              className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm disabled:opacity-60">
              {claimState === "claiming" ? "Claiming…" : "Claim my share →"}
            </button>
          </div>
        )}

        {/* Done */}
        {claimState === "done" && (
          <div className="rounded-xl border border-zinc-700 p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xl">✓</div>
            <div>
              <h2 className="font-semibold mb-1">Claim complete</h2>
              <p className="text-zinc-400 text-sm">
                Your share has been transferred. The amount was sent confidentially — it will not appear as a plain amount in public transaction history.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
