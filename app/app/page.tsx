import Link from "next/link";
import Nav from "../components/Nav";

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
          Even after you're gone.
        </h1>

        <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
          The first trustless, privacy-preserving crypto inheritance protocol on Solana.
          Multi-beneficiary splits. Confidential amounts. One-click heartbeat via Blinks.
          No lawyers. No trusted third parties.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/create"
            className="px-6 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            Create Your Vault
          </Link>
          <Link
            href="/claim"
            className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-medium text-sm hover:border-zinc-500 hover:text-white transition-colors"
          >
            Claim Inheritance
          </Link>
        </div>
      </main>

      {/* How it works */}
      <section className="px-8 py-20 border-t border-zinc-800 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-semibold mb-12 text-center text-zinc-100">How Testament works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
          {[
            {
              step: "01",
              title: "Create your vault",
              desc: "Set beneficiaries with % splits, a heartbeat interval, and an encrypted final message.",
            },
            {
              step: "02",
              title: "Check in regularly",
              desc: "Click your Blink URL once every 90 days. That's it. Takes 2 seconds.",
            },
            {
              step: "03",
              title: "If you stop checking in",
              desc: "A 14-day countdown starts. You can still dispute it — or your beneficiaries get notified.",
            },
            {
              step: "04",
              title: "Assets flow privately",
              desc: "Each beneficiary claims their share via Blink. Amounts are confidential on-chain.",
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

      {/* Stats */}
      <section className="border-t border-zinc-800 px-8 py-16">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: "$150B+", label: "in crypto lost to death annually" },
            { value: "60M+", label: "crypto holders with no plan" },
            { value: "0", label: "trusted third parties needed" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-8 py-6 text-center text-xs text-zinc-600">
        Testament · Colosseum Frontier Hackathon 2026 · Built on Solana
      </footer>
    </div>
  );
}
