/**
 * Testament Keeper
 *
 * Scans all on-chain vaults every few minutes (called by a cron job).
 * Automatically:
 *   1. Triggers countdown when a vault's check-in deadline has passed
 *   2. Executes all inheritance transfers when countdown completes
 *
 * Beneficiaries never have to visit the site or click anything.
 * Tokens arrive in their wallets automatically.
 *
 * Configure a cron to hit POST /api/keeper every 5 minutes.
 * Set KEEPER_PRIVATE_KEY to a funded wallet (pays ~0.000005 SOL per tx).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import idl from "../../../lib/idl.json";
import type { Testament } from "../../../lib/testament";

const PROGRAM_ID = new PublicKey(
  process.env.TESTAMENT_PROGRAM_ID ?? "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
);

// ── Account layout byte offsets ─────────────────────────────────────────────

const VAULT_LEN = 185;
const VAULT_OFF = {
  owner:                8,
  heartbeat_interval:   40,
  last_heartbeat:       48,
  countdown_duration:   56,
  countdown_started_at: 64,
  is_locked:            83,
  is_active:            84,
};

const BENEFICIARY_LEN = 77;
const BENEFICIARY_OFF = {
  vault:      8,
  wallet:     40,
  share_bps:  72,
  has_claimed: 74,
  index:      75,
};

const SOL_DELEGATION_LEN = 51;
const SOL_DELEGATION_OFF = {
  vault:        8,
  amount:       40,
  claimed_mask: 48,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function readI64(buf: Buffer, offset: number): number {
  return Number(BigInt.asIntN(64, buf.readBigInt64LE(offset)));
}

function loadKeeper(): Keypair {
  const key = process.env.KEEPER_PRIVATE_KEY;
  if (!key) throw new Error("KEEPER_PRIVATE_KEY not set");
  if (key.startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
  }
  // base58
  const { decode } = require("bs58") as { decode: (s: string) => Uint8Array };
  return Keypair.fromSecretKey(decode(key));
}

// ── Main keeper run ──────────────────────────────────────────────────────────

async function runKeeper() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );

  const keeperKeypair = loadKeeper();
  // Inline wallet — Wallet (NodeWallet) is CJS-only, so we implement the interface directly
  const wallet = {
    publicKey: keeperKeypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if ("version" in tx) {
        (tx as VersionedTransaction).sign([keeperKeypair]);
      } else {
        (tx as Transaction).sign(keeperKeypair);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) {
        if ("version" in tx) {
          (tx as VersionedTransaction).sign([keeperKeypair]);
        } else {
          (tx as Transaction).sign(keeperKeypair);
        }
      }
      return txs;
    },
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program<Testament>(idl as any, provider);

  const now = Math.floor(Date.now() / 1000);
  const log = {
    vaultsScanned: 0,
    countdownsTriggered: [] as string[],
    inheritancesExecuted: [] as string[],
    errors: [] as string[],
  };

  // ── 1. Fetch all Vault accounts ──────────────────────────────────────────
  const vaultAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: VAULT_LEN }],
  });
  log.vaultsScanned = vaultAccounts.length;

  for (const { pubkey: vaultKey, account } of vaultAccounts) {
    const d = account.data as Buffer;

    try {
      const isActive = Boolean(d[VAULT_OFF.is_active]);
      const isLocked = Boolean(d[VAULT_OFF.is_locked]);
      if (!isActive || !isLocked) continue;

      const heartbeatInterval   = readI64(d, VAULT_OFF.heartbeat_interval);
      const lastHeartbeat       = readI64(d, VAULT_OFF.last_heartbeat);
      const countdownDuration   = readI64(d, VAULT_OFF.countdown_duration);
      const countdownStartedAt  = readI64(d, VAULT_OFF.countdown_started_at);

      const heartbeatElapsed  = now >= lastHeartbeat + heartbeatInterval;
      const countdownActive   = countdownStartedAt > 0;
      const claimable         = countdownActive && now >= countdownStartedAt + countdownDuration;

      // ── Trigger countdown when owner misses their check-in ────────────────
      if (heartbeatElapsed && !countdownActive) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (program.methods.triggerCountdown() as any)
            .accounts({ vault: vaultKey, caller: keeperKeypair.publicKey })
            .rpc();
          log.countdownsTriggered.push(vaultKey.toBase58());
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          // "CountdownAlreadyStarted" means another keeper run beat us — not an error.
          if (!msg.includes("CountdownAlreadyStarted")) {
            log.errors.push(`trigger ${vaultKey.toBase58()}: ${msg}`);
          }
        }
        continue; // don't execute same run as trigger
      }

      // ── Execute all inheritance transfers once countdown is complete ───────
      if (claimable) {
        const beneficiaries = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            { dataSize: BENEFICIARY_LEN },
            { memcmp: { offset: BENEFICIARY_OFF.vault, bytes: vaultKey.toBase58() } },
          ],
        });

        // SOL transfers
        const [solDelegationPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("sol_delegation"), vaultKey.toBuffer()],
          PROGRAM_ID
        );
        const solDelegationInfo = await connection.getAccountInfo(solDelegationPda);

        if (solDelegationInfo) {
          const sd = solDelegationInfo.data as Buffer;
          const claimedMask = sd.readUInt16LE(SOL_DELEGATION_OFF.claimed_mask);

          for (const { account: ba } of beneficiaries) {
            const bd = ba.data as Buffer;
            const beneficiaryWallet = new PublicKey(bd.slice(BENEFICIARY_OFF.wallet, BENEFICIARY_OFF.wallet + 32));
            const index = bd[BENEFICIARY_OFF.index];

            if (claimedMask & (1 << index)) continue; // already executed

            const [beneficiaryPda] = PublicKey.findProgramAddressSync(
              [Buffer.from("beneficiary"), vaultKey.toBuffer(), beneficiaryWallet.toBuffer()],
              PROGRAM_ID
            );

            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (program.methods.executeSolInheritance() as any)
                .accounts({
                  vault: vaultKey,
                  solDelegation: solDelegationPda,
                  beneficiary: beneficiaryPda,
                  beneficiaryWallet,
                  caller: keeperKeypair.publicKey,
                  systemProgram: SystemProgram.programId,
                })
                .rpc();
              log.inheritancesExecuted.push(
                `SOL→${beneficiaryWallet.toBase58().slice(0, 8)} (vault ${vaultKey.toBase58().slice(0, 8)})`
              );
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              if (!msg.includes("AlreadyClaimed")) {
                log.errors.push(`sol_inheritance ${beneficiaryWallet.toBase58()}: ${msg}`);
              }
            }
          }
        }

        // SPL token transfers — iterate delegation records
        const delegationRecords = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            { dataSize: 115 }, // DelegationRecord::LEN
            { memcmp: { offset: 8, bytes: vaultKey.toBase58() } },
          ],
        });

        for (const { pubkey: delegationKey, account: da } of delegationRecords) {
          const dd = da.data as Buffer;
          // DelegationRecord: 8 disc + 32 vault + 32 mint + 32 owner_ata + 8 approved + 2 mask + 1 bump
          const tokenMint       = new PublicKey(dd.slice(40, 72));
          const ownerTokenAccount = new PublicKey(dd.slice(72, 104));
          const claimedMask     = dd.readUInt16LE(112);

          for (const { account: ba } of beneficiaries) {
            const bd = ba.data as Buffer;
            const beneficiaryWallet = new PublicKey(bd.slice(BENEFICIARY_OFF.wallet, BENEFICIARY_OFF.wallet + 32));
            const index = bd[BENEFICIARY_OFF.index];

            if (claimedMask & (1 << index)) continue;

            const [beneficiaryPda] = PublicKey.findProgramAddressSync(
              [Buffer.from("beneficiary"), vaultKey.toBuffer(), beneficiaryWallet.toBuffer()],
              PROGRAM_ID
            );

            // Derive beneficiary ATA for this mint
            const [beneficiaryAta] = PublicKey.findProgramAddressSync(
              [
                beneficiaryWallet.toBuffer(),
                new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(),
                tokenMint.toBuffer(),
              ],
              new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bQ")
            );

            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (program.methods.executeInheritance() as any)
                .accounts({
                  vault: vaultKey,
                  delegationRecord: delegationKey,
                  ownerTokenAccount,
                  beneficiary: beneficiaryPda,
                  beneficiaryAta,
                  beneficiaryWallet,
                  caller: keeperKeypair.publicKey,
                  tokenMint,
                  tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                  associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bQ"),
                  systemProgram: SystemProgram.programId,
                })
                .rpc();
              log.inheritancesExecuted.push(
                `SPL(${tokenMint.toBase58().slice(0, 8)})→${beneficiaryWallet.toBase58().slice(0, 8)}`
              );
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              if (!msg.includes("AlreadyClaimed")) {
                log.errors.push(`spl_inheritance mint=${tokenMint.toBase58().slice(0, 8)}: ${msg}`);
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      log.errors.push(`vault ${vaultKey.toBase58()}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return log;
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Protect against abuse — callers must provide the keeper secret
  const secret = req.headers.get("x-keeper-secret");
  if (process.env.KEEPER_SECRET && secret !== process.env.KEEPER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.KEEPER_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "KEEPER_PRIVATE_KEY not configured — add it to .env.local" },
      { status: 500 }
    );
  }

  try {
    const result = await runKeeper();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error("Keeper error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// GET is called by Vercel cron jobs (every 5 minutes).
// Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
export async function GET(req: NextRequest) {
  // Vercel cron auth — accept if no secret configured (dev) or bearer matches CRON_SECRET
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.KEEPER_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "KEEPER_PRIVATE_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await runKeeper();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error("Keeper cron error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
