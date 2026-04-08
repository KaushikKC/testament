"use client";
import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Testament } from "../../lib/testament";
import idl from "../../lib/idl.json";
import Nav from "../../components/Nav";

export default function RecoverPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [vaultAddress, setVaultAddress] = useState("");
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  function makeProgram() {
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: "confirmed" }
    );
    return new Program<Testament>(idl as Testament, provider);
  }

  const doTransferOwnership = useCallback(async () => {
    if (!wallet.publicKey) return;
    setStatus("pending");
    setMessage("Submitting ownership transfer…");

    try {
      let vaultPub: PublicKey;
      let newOwnerPub: PublicKey;
      try {
        vaultPub = new PublicKey(vaultAddress.trim());
        newOwnerPub = new PublicKey(newOwnerAddress.trim());
      } catch {
        setStatus("error");
        setMessage("Invalid vault or wallet address.");
        return;
      }

      const program = makeProgram();

      // Derive alias PDA
      const [vaultAlias] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_alias"), newOwnerPub.toBuffer()],
        program.programId
      );

      // Derive guardian config PDA
      const [guardianConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from("guardian_config"), vaultPub.toBuffer()],
        program.programId
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program.methods as any)
        .transferOwnership()
        .accounts({
          vault: vaultPub,
          guardianConfig,
          recoveryWallet: wallet.publicKey,
          newOwnerWallet: newOwnerPub,
          vaultAlias,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStatus("done");
      setMessage("Ownership transferred successfully. The new wallet can now control the vault.");
    } catch (e: unknown) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Transaction failed.");
      console.error(e);
    }
  }, [wallet, connection, vaultAddress, newOwnerAddress]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <div className="max-w-xl mx-auto px-6 py-16 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Recover vault ownership</h1>
          <p className="text-zinc-400 text-sm">
            If the original vault owner has lost their wallet, the registered recovery wallet can
            transfer ownership to a new address — provided guardians have reached quorum.
          </p>
        </div>

        {!wallet.connected ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-zinc-400 text-sm">Connect the recovery wallet to continue.</p>
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
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">Original vault address</label>
              <input
                type="text"
                placeholder="Vault PDA address"
                value={vaultAddress}
                onChange={(e) => setVaultAddress(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400">New owner wallet address</label>
              <input
                type="text"
                placeholder="New wallet that will control the vault"
                value={newOwnerAddress}
                onChange={(e) => setNewOwnerAddress(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
              <p className="font-medium text-zinc-300 mb-2">Requirements</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>This connected wallet must be the registered recovery wallet.</li>
                <li>At least 2 of the vault&apos;s guardians must have voted for liveness.</li>
                <li>The vault must not be in an active missed check-in alert.</li>
              </ul>
            </div>

            {status !== "idle" && (
              <div className={`rounded-lg px-4 py-3 text-sm ${
                status === "error" ? "bg-red-900/20 border border-red-800 text-red-400" :
                status === "done" ? "bg-green-900/20 border border-green-800 text-green-400" :
                "bg-zinc-900 border border-zinc-800 text-zinc-400"
              }`}>
                {status === "pending" && <span className="animate-spin mr-2">⟳</span>}
                {message}
              </div>
            )}

            <button
              onClick={doTransferOwnership}
              disabled={status === "pending" || !vaultAddress || !newOwnerAddress}
              className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {status === "pending" ? "Transferring…" : "Transfer ownership →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
