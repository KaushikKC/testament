"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const links = [
  { href: "/create", label: "Create" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/claim", label: "Claim" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-zinc-800 sticky top-0 z-50 bg-black/90 backdrop-blur">
      <Link href="/" className="font-semibold text-lg tracking-tight text-white">
        Testament
      </Link>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex gap-5 text-sm">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`transition-colors ${
                pathname === href
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Wallet connect — styled to match dark theme */}
        <WalletMultiButton
          style={{
            backgroundColor: "transparent",
            border: "1px solid rgb(63 63 70)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            height: "36px",
            padding: "0 14px",
            color: "rgb(161 161 170)",
          }}
        />
      </div>
    </nav>
  );
}
