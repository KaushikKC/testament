/**
 * GET /api/stats
 * Returns live protocol stats fetched from devnet.
 * Cached for 60 seconds via Next.js revalidation.
 */
import { NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(
  process.env.TESTAMENT_PROGRAM_ID ?? "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
);
const VAULT_LEN = 185;
const SOL_DELEGATION_LEN = 51;

export const revalidate = 60; // cache for 60s

export async function GET() {
  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed"
    );

    const [vaults, solDelegations] = await Promise.all([
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: VAULT_LEN }],
        dataSlice: { offset: 0, length: 0 }, // count only, no data needed
      }),
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: SOL_DELEGATION_LEN }],
        dataSlice: { offset: 40, length: 8 }, // only the amount field
      }),
    ]);

    const totalSolProtected = solDelegations.reduce((sum, { account }) => {
      const lamports = Number(account.data.readBigUInt64LE(0));
      return sum + lamports;
    }, 0);

    return NextResponse.json({
      totalVaults: vaults.length,
      totalSolProtected: (totalSolProtected / LAMPORTS_PER_SOL).toFixed(2),
    });
  } catch (e) {
    return NextResponse.json({ totalVaults: 0, totalSolProtected: "0" });
  }
}
