"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Testament } from "../../lib/testament";
import idl from "../../lib/idl.json";
import { vaultPda, beneficiaryPda, solDelegationPda } from "../../lib/program";
import Nav from "../../components/Nav";

type Step = 1 | 2 | 3 | 4 | 5;

interface BeneficiaryInput {
  wallet: string;
  sharePercent: number; // 0–100; converted to bps (×100) before sending on-chain
  label: string;        // off-chain label / nickname
  walletError?: string; // inline validation message
}

// Returns seconds from a value + unit
function toSeconds(value: number, unit: "minutes" | "hours" | "days"): number {
  if (unit === "minutes") return value * 60;
  if (unit === "hours") return value * 3600;
  return value * 86400;
}

function formatDuration(value: number, unit: "minutes" | "hours" | "days"): string {
  const singular = unit.replace(/s$/, "");
  return `${value} ${value === 1 ? singular : unit}`;
}

/** Converts a seconds count to the most human-readable unit string. */
function formatSeconds(secs: number): string {
  if (secs >= 86400) {
    const d = Math.floor(secs / 86400);
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const m = Math.floor(secs / 60);
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}

function validateWallet(address: string): string | undefined {
  if (!address) return undefined;
  try {
    new PublicKey(address);
    return undefined;
  } catch {
    return "Invalid Solana address";
  }
}

export default function CreateVault() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();

  // Redirect to dashboard if vault already exists for this wallet
  useEffect(() => {
    if (!wallet.publicKey) return;
    const [pda] = vaultPda(wallet.publicKey);
    connection.getAccountInfo(pda).then((info) => {
      if (info) router.replace("/dashboard");
    }).catch(() => {/* ignore */});
  }, [wallet.publicKey, connection]);

  const [step, setStep] = useState<Step>(1);
  const [heartbeatValue, setHeartbeatValue] = useState(5);
  const [heartbeatUnit, setHeartbeatUnit] = useState<"minutes" | "hours" | "days">("minutes");
  const [countdownValue, setCountdownValue] = useState(10);
  const [countdownUnit, setCountdownUnit] = useState<"minutes" | "hours" | "days">("minutes");

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryInput[]>([
    { wallet: "", sharePercent: 100, label: "" },
  ]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [txStep, setTxStep] = useState("");
  const [solAmountInput, setSolAmountInput] = useState("");
  const [designating, setDesignating] = useState(false);
  const [designateError, setDesignateError] = useState<string | null>(null);
  const [designated, setDesignated] = useState(false);

  const totalPercent = beneficiaries.reduce((s, b) => s + b.sharePercent, 0);
  const remainingPercent = 100 - totalPercent;

  const hasAddressErrors = beneficiaries.some(b => b.walletError);
  const validBeneficiaries = beneficiaries.filter(b => b.wallet && !b.walletError);

  function addBeneficiary() {
    if (beneficiaries.length >= 10) return;
    setBeneficiaries([...beneficiaries, { wallet: "", sharePercent: 0, label: "" }]);
  }

  function removeBeneficiary(i: number) {
    setBeneficiaries(beneficiaries.filter((_, idx) => idx !== i));
  }

  function updateBeneficiary(i: number, field: keyof BeneficiaryInput, value: string | number) {
    setBeneficiaries(
      beneficiaries.map((b, idx) => (idx === i ? { ...b, [field]: value } : b))
    );
  }

  function handleWalletBlur(i: number, value: string) {
    const err = validateWallet(value);
    setBeneficiaries(
      beneficiaries.map((b, idx) => (idx === i ? { ...b, walletError: err } : b))
    );
  }

  const handleCreate = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError("Please connect your wallet first.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new Program<Testament>(idl as Testament, provider);

      const owner = wallet.publicKey;
      const [vault] = vaultPda(owner);

      let messageHash: number[] = Array(32).fill(0);
      if (message.trim()) {
        const encoded = new TextEncoder().encode(message.trim());
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
        messageHash = Array.from(new Uint8Array(hashBuffer));
      }

      const heartbeatSecs = toSeconds(heartbeatValue, heartbeatUnit);
      const countdownSecs = toSeconds(countdownValue, countdownUnit);
      const disputeSecs = Math.floor(countdownSecs / 2);

      // 1. Create vault
      setTxStep("Creating vault…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods
        .createVault({
          heartbeatInterval: new BN(heartbeatSecs),
          countdownDuration: new BN(countdownSecs),
          disputeWindow: new BN(disputeSecs),
          messageHash,
        }) as any)
        .accounts({ vault, owner, systemProgram: SystemProgram.programId })
        .rpc();

      // 2. Add each beneficiary
      for (let i = 0; i < beneficiaries.length; i++) {
        const b = beneficiaries[i];
        if (!b.wallet || b.sharePercent === 0) continue;
        setTxStep(`Adding beneficiary ${i + 1} of ${beneficiaries.length}…`);
        const beneficiaryWallet = new PublicKey(b.wallet);
        const [beneficiaryPdaAddr] = beneficiaryPda(vault, beneficiaryWallet);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods
          .addBeneficiary({ shareBps: b.sharePercent * 100 }) as any)
          .accounts({
            vault,
            beneficiaryWallet,
            beneficiary: beneficiaryPdaAddr,
            owner,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }

      // 3. Lock vault
      setTxStep("Locking vault…");
      await program.methods
        .lockVault()
        .accounts({ vault, owner })
        .rpc();

      const vaultAddr = vault.toBase58();
      setVaultAddress(vaultAddr);

      if (email.trim()) {
        fetch("/api/notify/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            vaultAddress: vaultAddr,
            heartbeatValue,
            heartbeatUnit,
          }),
        }).catch(() => {/* silent */});
      }

      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed. Check console.");
      console.error(e);
    } finally {
      setCreating(false);
      setTxStep("");
    }
  }, [wallet, connection, heartbeatValue, heartbeatUnit, countdownValue, countdownUnit, beneficiaries, message, email]);

  const handleDesignate = useCallback(async () => {
    if (!wallet.publicKey) return;
    const solAmt = parseFloat(solAmountInput);
    if (isNaN(solAmt) || solAmt <= 0) { setDesignateError("Enter a valid SOL amount"); return; }
    setDesignating(true);
    setDesignateError(null);
    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program<Testament>(idl as Testament, provider);
      const [vault] = vaultPda(wallet.publicKey);
      const [solDelegAddr] = solDelegationPda(vault);
      await (program.methods.registerSolDelegation({ amount: new BN(Math.round(solAmt * LAMPORTS_PER_SOL)) }) as any)
        .accounts({
          vault,
          solDelegation: solDelegAddr,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      setDesignated(true);
      setStep(5);
    } catch (e: unknown) {
      setDesignateError(e instanceof Error ? e.message : "Designation failed");
    } finally {
      setDesignating(false);
    }
  }, [wallet, connection, solAmountInput]);

  // ── 1.1 Gate: wallet not connected ──
  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Nav />
        <div className="flex flex-col items-center justify-center h-[70vh] gap-6 text-center px-6">
          <h2 className="text-2xl font-semibold">Connect your wallet to begin</h2>
          <p className="text-zinc-400 max-w-sm text-sm">
            Your wallet is needed to create and sign the vault transactions on-chain.
          </p>
          <WalletMultiButton
            style={{
              backgroundColor: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              height: "44px",
              padding: "0 24px",
              color: "black",
            }}
          />
        </div>
      </div>
    );
  }

  const blinkUrl = vaultAddress
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/actions/heartbeat?vault=${vaultAddress}`
    : "";

  const heartbeatSecs = toSeconds(heartbeatValue, heartbeatUnit);
  const nextCheckIn = new Date(Date.now() + heartbeatSecs * 1000);
  const nextCheckInStr = nextCheckIn.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sigCount = validBeneficiaries.length + 2;

  function copyBlink() {
    if (blinkUrl) navigator.clipboard.writeText(blinkUrl);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-12">
          {([1, 2, 3, 4] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step >= s ? "bg-white text-black" : "bg-zinc-800 text-zinc-500"}`}>
                {s}
              </div>
              {s < 4 && <div className={`h-px w-16 ${step > s ? "bg-white" : "bg-zinc-800"}`} />}
            </div>
          ))}
          <span className="text-xs text-zinc-500 ml-3">
            {step === 1 && "Check-in settings"}
            {step === 2 && "Add beneficiaries"}
            {step === 3 && "Review & create"}
            {(step === 4 || step === 5) && "Designate assets"}
          </span>
        </div>

        {/* Step 1 — Check-in settings */}
        {step === 1 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Set your check-in schedule</h2>
              <p className="text-zinc-400 text-sm">How often must you check in? Missing this starts the missed check-in alert.</p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Check-in interval */}
              <div className="flex flex-col gap-3">
                <label className="text-sm text-zinc-400">Check-in interval</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={1}
                    value={heartbeatValue}
                    onChange={(e) => setHeartbeatValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                  />
                  <select
                    value={heartbeatUnit}
                    onChange={(e) => setHeartbeatUnit(e.target.value as "minutes" | "hours" | "days")}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "5 min", v: 5, u: "minutes" as const },
                    { label: "1 hr",  v: 1, u: "hours"   as const },
                    { label: "90 days", v: 90, u: "days" as const },
                  ].map(({ label, v, u }) => (
                    <button key={label}
                      onClick={() => { setHeartbeatValue(v); setHeartbeatUnit(u); }}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${heartbeatValue === v && heartbeatUnit === u ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Countdown duration */}
              <div className="flex flex-col gap-3">
                <label className="text-sm text-zinc-400">Missed check-in alert duration</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={2}
                    value={countdownValue}
                    onChange={(e) => setCountdownValue(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                  />
                  <select
                    value={countdownUnit}
                    onChange={(e) => setCountdownUnit(e.target.value as "minutes" | "hours" | "days")}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                  >
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "10 min", v: 10, u: "minutes" as const },
                    { label: "1 hr",   v: 1,  u: "hours"   as const },
                    { label: "14 days", v: 14, u: "days"   as const },
                  ].map(({ label, v, u }) => (
                    <button key={label}
                      onClick={() => { setCountdownValue(v); setCountdownUnit(u); }}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${countdownValue === v && countdownUnit === u ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* 1.3 — fixed dispute window display */}
                <p className="text-xs text-zinc-600">
                  After a missed check-in, beneficiaries wait {formatDuration(countdownValue, countdownUnit)} before claiming.
                  You have {formatSeconds(Math.floor(toSeconds(countdownValue, countdownUnit) / 2))} to dispute.
                </p>
              </div>
            </div>

            <button onClick={() => setStep(2)} className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm self-start">
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 — Beneficiaries */}
        {step === 2 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Add beneficiaries</h2>
              {/* 1.2 — % language */}
              <p className="text-zinc-400 text-sm">Shares must total 100%. Each beneficiary claims independently.</p>
            </div>
            <div className="flex flex-col gap-4">
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex gap-3 items-center">
                    {/* 1.7 — wallet validation on blur */}
                    <div className="flex-1 flex flex-col gap-1">
                      <input type="text" placeholder="Wallet address"
                        value={b.wallet}
                        onChange={(e) => updateBeneficiary(i, "wallet", e.target.value)}
                        onBlur={(e) => handleWalletBlur(i, e.target.value)}
                        className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none ${b.walletError ? "border-red-600 focus:border-red-500" : "border-zinc-700 focus:border-zinc-500"}`} />
                      {b.walletError && (
                        <span className="text-xs text-red-400">{b.walletError}</span>
                      )}
                    </div>
                    {/* 1.6 — label field */}
                    <input type="text" placeholder="Label (e.g. Wife, Son)"
                      value={b.label}
                      onChange={(e) => updateBeneficiary(i, "label", e.target.value)}
                      className="w-36 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                    {/* 1.2 — % input */}
                    <input type="number" min={1} max={100} placeholder="%"
                      value={b.sharePercent || ""}
                      onChange={(e) => updateBeneficiary(i, "sharePercent", parseFloat(e.target.value) || 0)}
                      className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                    <span className="text-xs text-zinc-600 w-4">%</span>
                    {beneficiaries.length > 1 && (
                      <button onClick={() => removeBeneficiary(i)} className="text-zinc-600 hover:text-red-400 text-sm">✕</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs">
                <button onClick={addBeneficiary} disabled={beneficiaries.length >= 10}
                  className="text-zinc-400 hover:text-white transition-colors disabled:opacity-40">
                  + Add beneficiary
                </button>
                {/* 1.2 — % remaining */}
                <span className={remainingPercent === 0 ? "text-green-400" : remainingPercent < 0 ? "text-red-400" : "text-zinc-500"}>
                  {remainingPercent === 0 ? "✓ 100% allocated" : `${remainingPercent}% remaining`}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-zinc-700 rounded-lg text-sm text-zinc-400">← Back</button>
              {/* 1.7 — disable if address errors */}
              <button onClick={() => setStep(3)} disabled={totalPercent !== 100 || hasAddressErrors}
                className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm disabled:opacity-40">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Review & Create */}
        {step === 3 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Review & create</h2>
            </div>

            {/* 1.4 — Email at the top of Step 3 */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-zinc-300">Where should we send your check-in reminders?</label>
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Without this, a missed check-in could trigger your own vault.
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Your email is never stored on-chain.
                </p>
              </div>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-3 bg-zinc-900 rounded-xl border border-zinc-800 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Check-in interval</span>
                <span>Every {formatDuration(heartbeatValue, heartbeatUnit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Missed check-in alert duration</span>
                <span>{formatDuration(countdownValue, countdownUnit)}</span>
              </div>
              {/* 1.3 — fixed dispute window */}
              <div className="flex justify-between">
                <span className="text-zinc-500">I&apos;m still alive window</span>
                <span>{formatSeconds(Math.floor(toSeconds(countdownValue, countdownUnit) / 2))}</span>
              </div>
              <div className="border-t border-zinc-800 pt-3 flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Beneficiaries</span>
                  <span>{validBeneficiaries.length}</span>
                </div>
                {/* 1.6 — show labels in review */}
                {validBeneficiaries.map((b, i) => (
                  <div key={i} className="flex justify-between text-xs text-zinc-600">
                    <span className="font-mono truncate max-w-[180px]">
                      {b.label ? `${b.label} — ` : ""}{b.wallet.slice(0, 8)}…{b.wallet.slice(-4)}
                    </span>
                    <span>{b.sharePercent}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Final message */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-zinc-300">Final message <span className="text-zinc-600">(optional)</span></label>
                <p className="text-xs text-zinc-600 mt-1">
                  Last words, account locations, or instructions for your beneficiaries.
                  A SHA-256 hash is anchored on-chain — the message stays private until you share it.
                </p>
              </div>
              <textarea
                rows={5}
                placeholder="Write your final message here…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
              {/* 1.8 — persistence warning */}
              <p className="text-xs text-amber-700 font-medium">
                Save a copy of this message — it will not be stored anywhere else after you leave this page.
              </p>
            </div>

            {/* 1.5 — Multi-tx signing warning */}
            <div className="rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm text-zinc-400">
              Your wallet will ask you to approve <span className="text-white font-medium">{sigCount} signatures</span> — one for each step. Keep the popup open.
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/20 border border-red-800 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {txStep && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="animate-spin">⟳</span> {txStep}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} disabled={creating}
                className="px-6 py-3 border border-zinc-700 rounded-lg text-sm text-zinc-400 disabled:opacity-40">
                ← Back
              </button>
              <button onClick={handleCreate} disabled={creating}
                className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm disabled:opacity-50">
                {creating ? txStep || "Creating…" : "Create legacy vault →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Designate SOL */}
        {step === 4 && vaultAddress && (
          <div className="flex flex-col gap-8 py-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center text-green-400 text-sm">✓</div>
                <span className="text-sm text-zinc-500">Vault created successfully</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Designate SOL for inheritance</h2>
              <p className="text-zinc-400 text-sm">
                How much SOL should go to your beneficiaries if you stop checking in?
                This amount moves into your plan — you can revoke it anytime from the dashboard.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-zinc-400">Amount to designate</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0.001"
                    step="0.01"
                    placeholder="e.g. 1.5"
                    value={solAmountInput}
                    onChange={e => setSolAmountInput(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                  <span className="text-sm text-zinc-500 w-10">SOL</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Beneficiaries receive their share proportionally: {validBeneficiaries.map(b => `${b.label || b.wallet.slice(0, 6)} gets ${b.sharePercent}%`).join(", ")}.
                </p>
              </div>

              {designateError && (
                <div className="rounded-lg bg-red-900/20 border border-red-800 px-4 py-3 text-sm text-red-400">{designateError}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDesignate}
                  disabled={designating || !solAmountInput}
                  className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm disabled:opacity-50 hover:bg-zinc-200 transition-colors">
                  {designating ? "Designating…" : "Designate SOL →"}
                </button>
                <button
                  onClick={() => setStep(5)}
                  disabled={designating}
                  className="px-6 py-3 border border-zinc-700 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">
                  Skip for now
                </button>
              </div>
            </div>

            <p className="text-xs text-zinc-700">
              You can also designate SPL tokens (USDC, etc.) from the dashboard after setup.
            </p>
          </div>
        )}

        {/* Step 5 — Final success */}
        {step === 5 && vaultAddress && (
          <div className="flex flex-col gap-8 py-4">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-900/30 border border-green-700 flex items-center justify-center text-2xl text-green-400">✓</div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">You&apos;re protected.</h2>
                <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                  {designated
                    ? "Your legacy plan is live and your SOL is designated. Check in periodically — that's all you need to do."
                    : "Your legacy plan is live. Visit the dashboard to designate assets when you're ready."}
                </p>
              </div>
            </div>

            {/* Next check-in */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Next check-in due</span>
              <span className="text-xl font-semibold">{nextCheckInStr}</span>
              <p className="text-xs text-zinc-600">Add a recurring reminder so you never miss it.</p>
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Testament+Check-In&recur=RRULE:FREQ=DAILY;INTERVAL=${Math.round(heartbeatSecs / 86400) || 1}&dates=${nextCheckIn.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start mt-1 px-4 py-2 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
              >
                Add to Google Calendar
              </a>
            </div>

            {/* What beneficiaries experience */}
            {validBeneficiaries.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
                <span className="text-sm font-medium">What your beneficiaries experience</span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  If you stop checking in and the countdown completes, tokens transfer automatically
                  to their wallets. <strong className="text-white">They don&apos;t need to visit any site,
                  click anything, or even know Testament exists.</strong> The tokens just arrive.
                </p>
                <div className="flex flex-col gap-1">
                  {validBeneficiaries.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-500">{b.label || `Beneficiary ${i + 1}`}</span>
                      <span className="text-zinc-600">{b.sharePercent}% · {b.wallet.slice(0, 8)}…</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link href="/dashboard" className="self-start px-6 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors">
              Go to dashboard →
            </Link>

            {/* Check-in link (secondary) */}
            <details className="group">
              <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors select-none">
                Advanced — My check-in link (Blink URL)
              </summary>
              <div className="mt-3 bg-zinc-900 border border-zinc-700 rounded-lg p-4 flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 flex-1 break-all">{blinkUrl}</span>
                <button onClick={copyBlink}
                  className="text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded px-2 py-1 shrink-0">
                  Copy
                </button>
              </div>
              <div className="text-xs text-zinc-600 font-mono mt-2">{vaultAddress}</div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
