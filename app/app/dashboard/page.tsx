"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Testament } from "../../lib/testament";
import idl from "../../lib/idl.json";
import { useVault } from "../../hooks/useVault";
import { vaultPda, solDelegationPda, bpsToPercent, timeUntil } from "../../lib/program";
import Nav from "../../components/Nav";

function CheckInBar({ daysLeft, total }: { daysLeft: number; total: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((daysLeft / total) * 100)));
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface SolDelegationInfo {
  amount: number; // lamports
  claimedMask: number;
}

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { vault, beneficiaries, loading, error, refetch } = useVault();

  const [copied, setCopied] = useState(false);
  const [txPending, setTxPending] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [solDelegation, setSolDelegation] = useState<SolDelegationInfo | null>(null);

  function makeProgram() {
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: "confirmed" }
    );
    return new Program<Testament>(idl as Testament, provider);
  }

  // Load SOL delegation data
  useEffect(() => {
    if (!vault) return;
    const [pdaAddr] = solDelegationPda(vault.address);
    connection.getAccountInfo(pdaAddr).then((info) => {
      if (!info) { setSolDelegation(null); return; }
      // SolDelegation: 8 discriminator + 32 vault + 8 amount + 2 claimedMask + 1 bump
      const d = info.data;
      const amount = Number(d.readBigUInt64LE(40)); // offset 8+32=40
      const claimedMask = d.readUInt16LE(48);       // offset 40+8=48
      setSolDelegation({ amount, claimedMask });
    }).catch(() => setSolDelegation(null));
  }, [vault, connection]);

  const doHeartbeat = useCallback(async () => {
    if (!wallet.publicKey) return;
    setTxPending("Sending check-in…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      await program.methods.heartbeat().accounts({ vault: vaultAddr, owner: wallet.publicKey }).rpc();
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection]);

  const doDispute = useCallback(async () => {
    if (!wallet.publicKey) return;
    setTxPending("Proving you're alive…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      await program.methods.dispute().accounts({ vault: vaultAddr, owner: wallet.publicKey }).rpc();
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection]);

  const doRevokeSol = useCallback(async () => {
    if (!wallet.publicKey || !confirm("Withdraw the designated SOL back to your wallet?")) return;
    setTxPending("Revoking SOL designation…");
    setTxError(null);
    try {
      const program = makeProgram();
      const [vaultAddr] = vaultPda(wallet.publicKey);
      const [solDelegationAddr] = solDelegationPda(vaultAddr);
      await program.methods
        .revokeSolDelegation()
        .accounts({
          vault: vaultAddr,
          solDelegation: solDelegationAddr,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setSolDelegation(null);
      await refetch();
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setTxPending(null);
    }
  }, [wallet, connection]);

  const doClose = useCallback(async () => {
    if (!wallet.publicKey || !confirm("Close your legacy plan and reclaim all SOL? This cannot be undone.")) return;
    setTxPending("Closing plan…");
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
          <p className="text-zinc-400">Connect your wallet to view your legacy plan.</p>
          <Link href="/create" className="text-sm text-zinc-500 hover:text-white transition-colors underline underline-offset-4">
            No plan yet? Create one →
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Nav />
        <div className="flex items-center justify-center h-[70vh]">
          <span className="text-zinc-500 animate-pulse">Fetching your plan…</span>
        </div>
      </div>
    );
  }

  if (!vault || error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Nav />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
          <p className="text-zinc-400">{error ?? "No legacy plan found for this wallet."}</p>
          <Link href="/create" className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium">
            Create a plan →
          </Link>
        </div>
      </div>
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const heartbeatIntervalDays = Math.max(1, Math.floor(vault.heartbeatInterval / 86400));
  const nextDeadlineSec = vault.lastHeartbeat + vault.heartbeatInterval;
  const daysLeft = Math.max(0, Math.ceil((nextDeadlineSec - nowSec) / 86400));
  const countdownActive = vault.countdownStartedAt > 0;
  const claimableAt = vault.countdownStartedAt + vault.countdownDuration;
  const isClaimable = countdownActive && nowSec >= claimableAt;
  const blinkUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/actions/heartbeat?vault=${vault.address.toBase58()}`
    : "";

  // Format next check-in as a calendar date
  const nextCheckInDate = new Date(nextDeadlineSec * 1000).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  function copyBlink() {
    navigator.clipboard.writeText(blinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">

        {txPending && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
            <span className="animate-spin">⟳</span> {txPending}
          </div>
        )}
        {txError && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">{txError}</div>
        )}

        {/* Missed check-in alert banner */}
        {countdownActive && !isClaimable && (
          <div className="rounded-xl border border-yellow-800 bg-yellow-900/20 p-5 flex flex-col gap-2">
            <span className="text-yellow-400 font-semibold">Missed check-in alert active</span>
            <p className="text-sm text-zinc-400">
              Alert triggered. Beneficiaries can claim {timeUntil(claimableAt * 1000)}.
              You can still prove you&apos;re alive within the window.
            </p>
            <button onClick={doDispute} disabled={!!txPending}
              className="self-start mt-1 px-4 py-2 bg-yellow-500 text-black rounded-lg text-sm font-medium disabled:opacity-50">
              I&apos;m still alive — cancel alert
            </button>
          </div>
        )}

        {/* Check-in card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-lg">Check-in</h2>
              <p className="text-zinc-500 text-sm mt-1">Next check-in due {nextCheckInDate}</p>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${daysLeft <= 7 ? "text-red-400" : daysLeft <= 20 ? "text-yellow-400" : "text-green-400"}`}>
              {daysLeft}d
            </span>
          </div>

          <CheckInBar daysLeft={daysLeft} total={heartbeatIntervalDays} />

          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">My check-in link (Blink)</label>
            <div className="flex gap-2 items-center bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
              <span className="text-xs font-mono text-zinc-400 flex-1 truncate">{blinkUrl}</span>
              <button onClick={copyBlink}
                className="text-xs border border-zinc-700 rounded px-2 py-1 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors shrink-0">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={doHeartbeat} disabled={!!txPending}
              className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
              Check in now
            </button>
            <a
              href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Testament+Check-In&dates=${formatGoogleCalDate(nextDeadlineSec)}&details=Time+to+check+in+to+your+Testament+legacy+plan`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors">
              Add to calendar
            </a>
          </div>

          {/* Biometric upgrade prompt */}
          <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-medium">Upgrade to biometric check-ins</p>
              <p className="text-xs text-zinc-700">Use Face ID or fingerprint — only your biology can prove you&apos;re alive.</p>
            </div>
            <span className="text-xs text-zinc-600 border border-zinc-800 rounded px-2 py-1">Soon</span>
          </div>
        </div>

        {/* Designated assets card (replaces old deposit card) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-lg">Designated assets</h2>
              <p className="text-zinc-500 text-sm mt-1">
                These tokens stay in your wallet — you can still spend them.
                Only if you stop checking in will they transfer to your beneficiaries.
              </p>
            </div>
          </div>

          {solDelegation ? (
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  {(solDelegation.amount / LAMPORTS_PER_SOL).toFixed(4)} SOL
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Designated — held in plan PDA</p>
              </div>
              <button
                onClick={doRevokeSol}
                disabled={!!txPending || countdownActive}
                title={countdownActive ? "Cannot revoke while alert is active" : "Withdraw SOL back to wallet"}
                className="text-xs border border-zinc-700 text-zinc-400 hover:border-red-700 hover:text-red-400 rounded px-2.5 py-1 transition-colors disabled:opacity-40">
                Revoke
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-zinc-800/40 border border-dashed border-zinc-700 px-4 py-4 flex flex-col gap-2">
              <p className="text-sm text-zinc-500">No assets designated yet.</p>
              <p className="text-xs text-zinc-600">
                After your plan is locked, use the dashboard to designate SOL or SPL tokens for inheritance.
              </p>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <Link href="/create"
              className="px-4 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors">
              Manage designations →
            </Link>
          </div>

          {/* Trust anchor note */}
          <p className="text-xs text-zinc-700 mt-1">
            The program is open-source and will be immutable post-audit — no admin can ever move your funds without your delegation.
          </p>
        </div>

        {/* Recipients */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Recipients</h2>
            <span className="text-xs text-zinc-500">{beneficiaries.length} / 10</span>
          </div>

          {beneficiaries.length === 0 ? (
            <p className="text-sm text-zinc-600">No recipients added yet.</p>
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
                    {b.hasClaimed && <span className="text-xs text-green-500 border border-green-800 rounded px-1.5 py-0.5">Claimed</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recovery wallet status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-3">
          <h2 className="font-semibold text-lg">Recovery wallet</h2>
          <p className="text-sm text-zinc-500">
            A backup wallet lets you regain control if you ever lose your Solana keypair — confirmed by your guardians.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm text-zinc-400">No recovery wallet registered</span>
            <Link href="/recover" className="ml-auto text-xs text-zinc-500 underline hover:text-white transition-colors">
              Set up recovery →
            </Link>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-red-900/40 p-6 flex flex-col gap-3">
          <h2 className="font-semibold text-red-400">Close legacy plan</h2>
          <p className="text-sm text-zinc-500">Reclaim all SOL. Only available when no missed check-in alert is active. Irreversible.</p>
          <button onClick={doClose} disabled={!!txPending || countdownActive}
            className="self-start px-5 py-2.5 border border-red-900 rounded-lg text-sm text-red-400 hover:border-red-700 transition-colors disabled:opacity-40">
            {countdownActive ? "Cannot close — alert active" : "Close plan"}
          </button>
        </div>

        {/* Trust anchor */}
        <p className="text-xs text-zinc-700 text-center pb-4">
          Your legacy plan lives on Solana — not our servers. Even if Testament shuts down, your beneficiaries can still claim.
        </p>

      </div>
    </div>
  );
}

function formatGoogleCalDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  return `${dateStr}/${dateStr}`;
}
