"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Testament } from "../../lib/testament";
import idl from "../../lib/idl.json";
import { useVault } from "../../hooks/useVault";
import { vaultPda, bpsToPercent, timeUntil } from "../../lib/program";
import Nav from "../../components/Nav";

function HeartbeatBar({ daysLeft, total }: { daysLeft: number; total: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((daysLeft / total) * 100)));
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { vault, beneficiaries, loading, error, refetch } = useVault();

  const [copied, setCopied] = useState(false);
  const [txPending, setTxPending] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("1");
  const [showDepositInput, setShowDepositInput] = useState(false);

  function makeProgram() {
    const provider = new AnchorProvider(
      connection,
      wallet as Parameters<typeof AnchorProvider>[1],
      { commitment: "confirmed" }
    );
    return new Program<Testament>(idl as Testament, provider);
  }

  const doHeartbeat = useCallback(async () => {
    if (!wallet.publicKey) return;
    setTxPending("Sending heartbeat…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      await program.methods.heartbeat().accounts({ vault: vaultAddr, owner: wallet.publicKey }).rpc();
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Heartbeat failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection]);

  const doDeposit = useCallback(async () => {
    if (!wallet.publicKey) return;
    setTxPending("Depositing SOL…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      const lamports = Math.floor(parseFloat(depositAmount) * LAMPORTS_PER_SOL);
      await program.methods
        .deposit({ amount: new BN(lamports) })
        .accounts({ vault: vaultAddr, owner: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      setShowDepositInput(false);
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection, depositAmount]);

  const doDispute = useCallback(async () => {
    if (!wallet.publicKey) return;
    setTxPending("Submitting dispute…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      await program.methods.dispute().accounts({ vault: vaultAddr, owner: wallet.publicKey }).rpc();
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Dispute failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection]);

  const doClose = useCallback(async () => {
    if (!wallet.publicKey || !confirm("Close vault and reclaim all SOL? This cannot be undone.")) return;
    setTxPending("Closing vault…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      await program.methods
        .closeVault()
        .accounts({ vault: vaultAddr, owner: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection]);

  // ── Not connected ──
  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Nav />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center">
          <p className="text-zinc-400">Connect your wallet to view your vault.</p>
          <Link href="/create" className="text-sm text-zinc-500 hover:text-white transition-colors underline underline-offset-4">
            No vault yet? Create one →
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Nav />
        <div className="flex items-center justify-center h-[70vh]">
          <span className="text-zinc-500 animate-pulse">Fetching vault…</span>
        </div>
      </div>
    );
  }

  // ── No vault ──
  if (!vault || error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Nav />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
          <p className="text-zinc-400">{error ?? "No vault found for this wallet."}</p>
          <Link href="/create" className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium">
            Create a vault →
          </Link>
        </div>
      </div>
    );
  }

  // ── Vault data ──
  const nowSec = Math.floor(Date.now() / 1000);
  const heartbeatIntervalDays = Math.floor(vault.heartbeatInterval / 86400);
  const nextDeadlineSec = vault.lastHeartbeat + vault.heartbeatInterval;
  const daysLeft = Math.max(0, Math.ceil((nextDeadlineSec - nowSec) / 86400));
  const countdownActive = vault.countdownStartedAt > 0;
  const claimableAt = vault.countdownStartedAt + vault.countdownDuration;
  const isClaimable = countdownActive && nowSec >= claimableAt;
  const balanceSol = (vault.balanceLamports / LAMPORTS_PER_SOL).toFixed(4);
  const blinkUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/actions/heartbeat?vault=${vault.address.toBase58()}`
    : "";

  function copyBlink() {
    navigator.clipboard.writeText(blinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Tx feedback */}
        {txPending && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
            <span className="animate-spin">⟳</span> {txPending}
          </div>
        )}
        {txError && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">{txError}</div>
        )}

        {/* Countdown active banner */}
        {countdownActive && !isClaimable && (
          <div className="rounded-xl border border-yellow-800 bg-yellow-900/20 p-5 flex flex-col gap-2">
            <span className="text-yellow-400 font-semibold">Countdown active</span>
            <p className="text-sm text-zinc-400">
              Countdown triggered. Beneficiaries can claim {timeUntil(claimableAt * 1000)}.
              You can still dispute within the dispute window.
            </p>
            <button onClick={doDispute} disabled={!!txPending}
              className="self-start mt-1 px-4 py-2 bg-yellow-500 text-black rounded-lg text-sm font-medium disabled:opacity-50">
              Dispute — cancel countdown
            </button>
          </div>
        )}

        {/* Heartbeat card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-lg">Heartbeat</h2>
              <p className="text-zinc-500 text-sm mt-1">Check in every {heartbeatIntervalDays} days.</p>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${daysLeft <= 7 ? "text-red-400" : daysLeft <= 20 ? "text-yellow-400" : "text-green-400"}`}>
              {daysLeft}d
            </span>
          </div>

          <HeartbeatBar daysLeft={daysLeft} total={heartbeatIntervalDays} />

          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">Your heartbeat Blink</label>
            <div className="flex gap-2 items-center bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
              <span className="text-xs font-mono text-zinc-400 flex-1 truncate">{blinkUrl}</span>
              <button onClick={copyBlink}
                className="text-xs border border-zinc-700 rounded px-2 py-1 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors shrink-0">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <button onClick={doHeartbeat} disabled={!!txPending}
            className="self-start px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
            Check in now
          </button>
        </div>

        {/* Balance card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-lg">Vault Balance</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">{balanceSol}</span>
            <span className="text-zinc-500 text-lg">SOL</span>
          </div>

          {showDepositInput ? (
            <div className="flex gap-2 items-center">
              <input type="number" min="0.001" step="0.1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
              <span className="text-sm text-zinc-500">SOL</span>
              <button onClick={doDeposit} disabled={!!txPending}
                className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium disabled:opacity-50">
                Deposit
              </button>
              <button onClick={() => setShowDepositInput(false)} className="text-sm text-zinc-600 hover:text-zinc-400">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowDepositInput(true)}
              className="self-start px-5 py-2.5 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors">
              Deposit SOL
            </button>
          )}
        </div>

        {/* Beneficiaries */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Beneficiaries</h2>
            <span className="text-xs text-zinc-500">{beneficiaries.length} / 10</span>
          </div>

          {beneficiaries.length === 0 ? (
            <p className="text-sm text-zinc-600">No beneficiaries added yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-800">
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">{i + 1}</div>
                    <span className="font-mono text-sm text-zinc-300 truncate max-w-[180px]">
                      {b.wallet.toBase58()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-zinc-400">{bpsToPercent(b.shareBps)}</span>
                    <span className="text-xs text-zinc-600">
                      ~{((b.shareBps / 10000) * parseFloat(balanceSol)).toFixed(3)} SOL
                    </span>
                    {b.hasClaimed && <span className="text-xs text-green-500 border border-green-800 rounded px-1.5 py-0.5">Claimed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-red-900/40 p-6 flex flex-col gap-3">
          <h2 className="font-semibold text-red-400">Close Vault</h2>
          <p className="text-sm text-zinc-500">Reclaim all SOL. Only available when no countdown is active. Irreversible.</p>
          <button onClick={doClose} disabled={!!txPending || countdownActive}
            className="self-start px-5 py-2.5 border border-red-900 rounded-lg text-sm text-red-400 hover:border-red-700 transition-colors disabled:opacity-40">
            {countdownActive ? "Cannot close — countdown active" : "Close vault"}
          </button>
        </div>

      </div>
    </div>
  );
}
