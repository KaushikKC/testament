/**
 * End-to-end test script for Testament.
 *
 * Usage:
 *   npx ts-node scripts/test-flow.ts
 *
 * This script:
 *   1. Reads your local Solana keypair (~/.config/solana/id.json) as the vault owner
 *   2. Reads /tmp/test-beneficiary.json as the beneficiary
 *   3. Fetches the existing vault for the owner
 *   4. Registers a SOL delegation of 0.05 SOL
 *   5. Prints status
 *   6. Can also trigger keeper actions directly
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc");
const RPC = "https://api.devnet.solana.com";

function loadKeypair(filePath: string): Keypair {
  const expanded = filePath.replace("~", process.env.HOME!);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(expanded, "utf8"))));
}

function pda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/testament.json"), "utf8"));

  const owner = loadKeypair("~/.config/solana/id.json");
  const beneficiary = loadKeypair("/tmp/test-beneficiary.json");

  console.log("Owner:      ", owner.publicKey.toBase58());
  console.log("Beneficiary:", beneficiary.publicKey.toBase58());

  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new anchor.Program(idl as any, provider);

  const vaultPda = pda([Buffer.from("vault"), owner.publicKey.toBuffer()], PROGRAM_ID);
  const solDelegationPda = pda([Buffer.from("sol_delegation"), vaultPda.toBuffer()], PROGRAM_ID);

  console.log("\nVault PDA:         ", vaultPda.toBase58());
  console.log("SolDelegation PDA: ", solDelegationPda.toBase58());

  // ── Check vault state ──
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (!vaultInfo) {
    console.log("\n❌ No vault found for this owner. Create one at http://localhost:3000/create first.");
    return;
  }

  const d = vaultInfo.data;
  const lastHeartbeat    = Number(BigInt.asIntN(64, d.readBigInt64LE(48)));
  const heartbeatInterval = Number(BigInt.asIntN(64, d.readBigInt64LE(40)));
  const countdownStartedAt = Number(BigInt.asIntN(64, d.readBigInt64LE(64)));
  const countdownDuration  = Number(BigInt.asIntN(64, d.readBigInt64LE(56)));
  const isLocked = Boolean(d[83]);
  const isActive = Boolean(d[84]);

  const now = Math.floor(Date.now() / 1000);
  const nextDeadline = lastHeartbeat + heartbeatInterval;
  const heartbeatElapsed = now >= nextDeadline;
  const countdownActive  = countdownStartedAt > 0;
  const claimable        = countdownActive && now >= countdownStartedAt + countdownDuration;

  console.log("\n── Vault Status ───────────────────────────────────────");
  console.log("  Is active:", isActive, "  Is locked:", isLocked);
  console.log("  Heartbeat interval:", heartbeatInterval, "sec");
  console.log("  Last heartbeat:    ", new Date(lastHeartbeat * 1000).toISOString());
  console.log("  Next deadline:     ", new Date(nextDeadline * 1000).toISOString());
  console.log("  Heartbeat elapsed: ", heartbeatElapsed);
  console.log("  Countdown active:  ", countdownActive);
  console.log("  Claimable:         ", claimable);

  // ── Check SOL delegation ──
  const solDelegationInfo = await connection.getAccountInfo(solDelegationPda);
  if (solDelegationInfo) {
    const amount = Number(solDelegationInfo.data.readBigUInt64LE(40));
    const claimedMask = solDelegationInfo.data.readUInt16LE(48);
    console.log("\n── SOL Delegation ──────────────────────────────────────");
    console.log("  Designated:", (amount / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    console.log("  Claimed mask:", claimedMask.toString(2).padStart(10, "0"));
  } else {
    console.log("\n── No SOL delegation yet. Registering 0.05 SOL... ──────");
    if (!isLocked) {
      console.log("  ❌ Vault must be locked before registering delegation.");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods.registerSolDelegation({ amount: new anchor.BN(0.05 * LAMPORTS_PER_SOL) }) as any)
        .accounts({
          vault: vaultPda,
          solDelegation: solDelegationPda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ SOL delegation registered:", tx);
    } catch (e: unknown) {
      console.log("  ❌ Error:", e instanceof Error ? e.message : String(e));
    }
  }

  // ── Print what to do next ──
  console.log("\n── What to do next ─────────────────────────────────────");
  if (!heartbeatElapsed && !countdownActive) {
    const waitSec = nextDeadline - now;
    console.log(`  ⏳ Wait ${waitSec}s for heartbeat to elapse, then run:`);
    console.log("     curl -X POST http://localhost:3000/api/keeper");
  } else if (heartbeatElapsed && !countdownActive) {
    console.log("  🔔 Heartbeat elapsed! Run keeper to trigger countdown:");
    console.log("     curl -X POST http://localhost:3000/api/keeper");
  } else if (countdownActive && !claimable) {
    const waitSec = (countdownStartedAt + countdownDuration) - now;
    console.log(`  ⏳ Countdown active. Wait ${waitSec}s more, then run:`);
    console.log("     curl -X POST http://localhost:3000/api/keeper");
  } else if (claimable) {
    console.log("  ✅ Countdown complete! Run keeper to execute transfers:");
    console.log("     curl -X POST http://localhost:3000/api/keeper");
  }

  // ── Check beneficiary balance ──
  const benBalance = await connection.getBalance(beneficiary.publicKey);
  console.log("\n── Beneficiary Balance ─────────────────────────────────");
  console.log("  ", beneficiary.publicKey.toBase58(), "→", (benBalance / LAMPORTS_PER_SOL).toFixed(4), "SOL");
}

main().catch(console.error);
