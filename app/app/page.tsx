"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import Nav from "../components/Nav";

// 2.1 — Wallet value calculator
function WalletCalculator() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<{ sol: number; usd: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function lookup() {
    setErr(null);
    setResult(null);
    let pub: PublicKey;
    try {
      pub = new PublicKey(address.trim());
    } catch {
      setErr("Enter a valid Solana wallet address.");
      return;
    }
    setLoading(true);
    try {
      const conn = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
        "confirmed"
      );
      const lamports = await conn.getBalance(pub);
      const sol = lamports / LAMPORTS_PER_SOL;
      // Rough price fetch — coingecko public endpoint, no key needed
      let usdPrice = 150; // fallback
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
          { next: { revalidate: 60 } }
        );
        const d = await r.json();
        usdPrice = d?.solana?.usd ?? 150;
      } catch { /* use fallback */ }
      setResult({ sol, usd: Math.round(sol * usdPrice) });
    } catch {
      setErr("Could not fetch balance. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-6 flex flex-col gap-4 text-left">
      <p className="text-sm text-zinc-300 font-medium">See what&apos;s at risk</p>
      <p className="text-xs text-zinc-500">Enter any Solana wallet to see how much has no heir.</p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          onClick={lookup}
          disabled={loading || !address}
          className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {loading ? "…" : "Check"}
        </button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {result && (
        <div className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3">
          {result.sol === 0 ? (
            <p className="text-sm text-zinc-400">This wallet has 0 SOL.</p>
          ) : (
            <>
              <p className="text-base font-semibold text-white">
                Your {result.sol.toFixed(2)} SOL (${result.usd.toLocaleString()}) has no heir.
              </p>
              <p className="text-xs text-zinc-500 mt-1">Set one up in 3 minutes.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProtocolStats() {
  const [stats, setStats] = useState<{ totalVaults: number; totalSolProtected: string } | null>(null);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const items = [
    { value: stats ? stats.totalVaults.toString() : "…", label: "active legacy plans", live: true },
    { value: stats ? `${stats.totalSolProtected} SOL` : "…", label: "protected on-chain", live: true },
    { value: "0", label: "trusted third parties needed", live: false },
  ];

  return (
    <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
      {items.map((stat) => (
        <div key={stat.label}>
          <div className="text-3xl font-bold text-white flex items-center justify-center gap-2">
            {stat.value}
            {stat.live && stats && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" title="Live" />
            )}
          </div>
          <div className="text-sm text-zinc-500 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Nav />

      {/* Hero */}
      <main className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-8 py-24">
        <div className="inline-block px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-400 tracking-wide uppercase">
          Built on Solana · Colosseum Frontier 2026
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-tight max-w-3xl">
          Your assets.<br />
          <span className="text-zinc-400">Your rules.</span><br />
          Even after you&apos;re gone.
        </h1>

        <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
          Set your beneficiaries once. Check in periodically.
          If you stop, your assets transfer automatically — your family doesn&apos;t need to do anything.
          No lawyers. No trusted third parties. No claiming.
        </p>

        {/* 2.5 — Trust anchor */}
        <p className="text-xs text-zinc-600 max-w-md">
          Your legacy vault lives on Solana — not our servers. Even if Testament shuts down, your beneficiaries can still claim.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/create"
            className="px-6 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            Create your plan →
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-medium text-sm hover:border-zinc-500 hover:text-white transition-colors"
          >
            View dashboard
          </Link>
        </div>

        {/* 2.1 — Wallet calculator */}
        <WalletCalculator />
      </main>

      {/* How it works */}
      <section className="px-8 py-20 border-t border-zinc-800 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-semibold mb-12 text-center text-zinc-100">How Testament works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
          {[
            {
              step: "01",
              title: "Set up your plan",
              desc: "Add beneficiaries with % splits. Designate which tokens they inherit. Your tokens stay in your wallet — you can spend them freely.",
            },
            {
              step: "02",
              title: "Check in periodically",
              desc: "Click your check-in link once every 90 days. One tap. Takes 2 seconds.",
            },
            {
              step: "03",
              title: "If you stop checking in",
              desc: "After your deadline passes, a 14-day alert window starts automatically. You can still say \"I'm still alive\" within that window.",
            },
            {
              step: "04",
              title: "Assets transfer automatically",
              desc: "When the window closes, tokens transfer directly to each beneficiary's wallet. They don't need to visit any site or do anything.",
            },
          ].map((item) => (
            <div key={item.step} className="flex flex-col gap-3">
              <span className="text-xs font-mono text-zinc-600">{item.step}</span>
              <h3 className="font-semibold text-zinc-100">{item.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats — live from chain */}
      <section className="border-t border-zinc-800 px-8 py-16">
        <ProtocolStats />
      </section>

      {/* Footer — 2.5 trust anchor */}
      <footer className="border-t border-zinc-800 px-8 py-6 text-center text-xs text-zinc-600">
        <p>Testament · Colosseum Frontier Hackathon 2026 · Built on Solana</p>
        <p className="mt-1 text-zinc-700">Your legacy vault lives on Solana — not our servers. Even if Testament shuts down, your beneficiaries can still claim.</p>
      </footer>
    </div>
  );
}
