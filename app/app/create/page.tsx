"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Testament } from "../../lib/testament";
import idl from "../../lib/idl.json";
import { vaultPda, beneficiaryPda, daysToSeconds } from "../../lib/program";
import Nav from "../../components/Nav";

type Step = 1 | 2 | 3 | 4;

interface BeneficiaryInput {
  wallet: string;
  shareBps: number;
}

export default function CreateVault() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [step, setStep] = useState<Step>(1);
  const [heartbeatDays, setHeartbeatDays] = useState(90);
  const [countdownDays, setCountdownDays] = useState(14);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryInput[]>([
    { wallet: "", shareBps: 10000 },
  ]);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [txStep, setTxStep] = useState("");

  const totalBps = beneficiaries.reduce((s, b) => s + b.shareBps, 0);
  const remaining = 10000 - totalBps;

  function addBeneficiary() {
    if (beneficiaries.length >= 10) return;
    setBeneficiaries([...beneficiaries, { wallet: "", shareBps: 0 }]);
  }

  function removeBeneficiary(i: number) {
    setBeneficiaries(beneficiaries.filter((_, idx) => idx !== i));
  }

  function updateBeneficiary(i: number, field: keyof BeneficiaryInput, value: string | number) {
    setBeneficiaries(
      beneficiaries.map((b, idx) => (idx === i ? { ...b, [field]: value } : b))
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
      const provider = new AnchorProvider(connection, wallet as Parameters<typeof AnchorProvider>[1], {
        commitment: "confirmed",
      });
      const program = new Program<Testament>(idl as Testament, provider);

      const owner = wallet.publicKey;
      const [vault] = vaultPda(owner);

      // 1. Create vault
      setTxStep("Creating vault…");
      await program.methods
        .createVault({
          heartbeatInterval: new BN(daysToSeconds(heartbeatDays)),
          countdownDuration: new BN(daysToSeconds(countdownDays)),
          disputeWindow: new BN(daysToSeconds(Math.floor(countdownDays / 2))),
          messageHash: Array(32).fill(0),
        })
        .accounts({ vault, owner, systemProgram: SystemProgram.programId })
        .rpc();

      // 2. Add each beneficiary
      for (let i = 0; i < beneficiaries.length; i++) {
        const b = beneficiaries[i];
        if (!b.wallet || b.shareBps === 0) continue;
        setTxStep(`Adding beneficiary ${i + 1} of ${beneficiaries.length}…`);
        const beneficiaryWallet = new PublicKey(b.wallet);
        const [beneficiaryPdaAddr] = beneficiaryPda(vault, beneficiaryWallet);
        await program.methods
          .addBeneficiary({ shareBps: b.shareBps })
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

      setVaultAddress(vault.toBase58());
      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed. Check console.");
      console.error(e);
    } finally {
      setCreating(false);
      setTxStep("");
    }
  }, [wallet, connection, heartbeatDays, countdownDays, beneficiaries]);

  const blinkUrl = vaultAddress
    ? `${window.location.origin}/api/actions/heartbeat?vault=${vaultAddress}`
    : "";

  function copyBlink() {
    if (blinkUrl) navigator.clipboard.writeText(blinkUrl);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-12">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step >= s ? "bg-white text-black" : "bg-zinc-800 text-zinc-500"}`}>
                {s}
              </div>
              {s < 3 && <div className={`h-px w-16 ${step > s ? "bg-white" : "bg-zinc-800"}`} />}
            </div>
          ))}
          <span className="text-xs text-zinc-500 ml-3">
            {step === 1 && "Heartbeat settings"}
            {step === 2 && "Add beneficiaries"}
            {step === 3 && "Review & create"}
            {step === 4 && "Vault created"}
          </span>
        </div>

        {/* Step 1 — Heartbeat */}
        {step === 1 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Set your heartbeat</h2>
              <p className="text-zinc-400 text-sm">How often must you check in? Missing this starts the countdown.</p>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-sm text-zinc-400">Check-in interval</label>
                <div className="flex gap-3 flex-wrap">
                  {[30, 60, 90, 180].map((d) => (
                    <button key={d} onClick={() => setHeartbeatDays(d)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${heartbeatDays === d ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                      {d} days
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-sm text-zinc-400">Countdown + dispute window</label>
                <div className="flex gap-3 flex-wrap">
                  {[7, 14, 30].map((d) => (
                    <button key={d} onClick={() => setCountdownDays(d)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${countdownDays === d ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                      {d} days
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-600">
                  After a missed heartbeat, beneficiaries wait {countdownDays} days before claiming.
                  You have {Math.floor(countdownDays / 2)} days to dispute.
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
              <p className="text-zinc-400 text-sm">Shares must total 10,000 bps (100%). Each claims independently.</p>
            </div>
            <div className="flex flex-col gap-3">
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <input type="text" placeholder="Wallet address"
                    value={b.wallet}
                    onChange={(e) => updateBeneficiary(i, "wallet", e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  <input type="number" min={1} max={10000} placeholder="bps"
                    value={b.shareBps || ""}
                    onChange={(e) => updateBeneficiary(i, "shareBps", parseInt(e.target.value) || 0)}
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
                  <span className="text-xs text-zinc-500 w-12 text-right">{((b.shareBps / 10000) * 100).toFixed(1)}%</span>
                  {beneficiaries.length > 1 && (
                    <button onClick={() => removeBeneficiary(i)} className="text-zinc-600 hover:text-red-400 text-sm">✕</button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between text-xs">
                <button onClick={addBeneficiary} disabled={beneficiaries.length >= 10}
                  className="text-zinc-400 hover:text-white transition-colors disabled:opacity-40">
                  + Add beneficiary
                </button>
                <span className={remaining === 0 ? "text-green-400" : remaining < 0 ? "text-red-400" : "text-zinc-500"}>
                  {remaining === 0 ? "✓ 100% allocated" : `${remaining} bps remaining`}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-zinc-700 rounded-lg text-sm text-zinc-400">← Back</button>
              <button onClick={() => setStep(3)} disabled={totalBps !== 10000}
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
              <p className="text-zinc-400 text-sm">This will send {beneficiaries.length + 2} transactions: create vault, add beneficiaries, lock vault.</p>
            </div>

            <div className="flex flex-col gap-3 bg-zinc-900 rounded-xl border border-zinc-800 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Heartbeat interval</span>
                <span>Every {heartbeatDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Countdown duration</span>
                <span>{countdownDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Dispute window</span>
                <span>{Math.floor(countdownDays / 2)} days</span>
              </div>
              <div className="border-t border-zinc-800 pt-3 flex justify-between">
                <span className="text-zinc-500">Beneficiaries</span>
                <span>{beneficiaries.filter(b => b.wallet).length}</span>
              </div>
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
              <button onClick={handleCreate} disabled={creating || !wallet.connected}
                className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm disabled:opacity-50">
                {!wallet.connected ? "Connect wallet first" : creating ? txStep || "Creating…" : "Create vault →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && vaultAddress && (
          <div className="flex flex-col gap-8 items-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-2xl">✓</div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">Vault created</h2>
              <p className="text-zinc-400 text-sm max-w-sm">
                Your vault is live on Solana devnet. Bookmark your heartbeat Blink — one click keeps it active.
              </p>
            </div>
            <div className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 flex items-center gap-3 text-left">
              <span className="text-xs font-mono text-zinc-400 flex-1 break-all">{blinkUrl}</span>
              <button onClick={copyBlink}
                className="text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded px-2 py-1 shrink-0">
                Copy
              </button>
            </div>
            <div className="text-xs text-zinc-600 font-mono">{vaultAddress}</div>
            <Link href="/dashboard" className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm">
              Go to dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
