import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Action-Version,X-Blockchain-Ids",
    "X-Action-Version": "2.1.3",
    "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  };
}

const PROGRAM_ID = new PublicKey(
  process.env.TESTAMENT_PROGRAM_ID ?? "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
);

// discriminator from target/idl/testament.json → instructions[triggerCountdown]
const TRIGGER_DISCRIMINATOR = Buffer.from([143, 69, 53, 127, 187, 66, 184, 178]);

export async function GET(req: NextRequest) {
  const vault = new URL(req.url).searchParams.get("vault");
  if (!vault) return NextResponse.json({ error: "Missing vault" }, { status: 400 });

  return NextResponse.json(
    {
      title: "Testament — Trigger Countdown",
      icon: "https://testament.app/icon.png",
      description:
        "The vault owner has not checked in. Trigger the countdown so beneficiaries can claim.",
      label: "Trigger countdown",
      links: {
        actions: [{ label: "Trigger now", href: `/api/actions/trigger?vault=${vault}` }],
      },
    },
    { headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const vault = new URL(req.url).searchParams.get("vault");
  if (!vault) return NextResponse.json({ error: "Missing vault" }, { status: 400 });

  const { account } = (await req.json()) as { account: string };
  if (!account) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet")
    );
    const callerPubkey = new PublicKey(account);
    const vaultPubkey = new PublicKey(vault);

    // Verify vault account exists
    const vaultInfo = await connection.getAccountInfo(vaultPubkey);
    if (!vaultInfo) return NextResponse.json({ error: "Vault not found" }, { status: 404 });

    // Verify countdown not already started (countdownStartedAt at offset 8+32+8+8+8 = 64)
    const countdownStartedAt = Number(
      BigInt.asIntN(64, vaultInfo.data.readBigInt64LE(8 + 32 + 8 + 8 + 8))
    );
    if (countdownStartedAt > 0) {
      return NextResponse.json({ error: "Countdown already started" }, { status: 400 });
    }

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: callerPubkey, isSigner: true, isWritable: false },
      ],
      data: TRIGGER_DISCRIMINATOR,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: callerPubkey, blockhash, lastValidBlockHeight }).add(ix);

    return NextResponse.json(
      {
        transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
        message: "Countdown triggered — beneficiaries can claim after the dispute window.",
      },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error("Trigger action error:", err);
    return NextResponse.json({ error: "Failed to build trigger transaction" }, { status: 500 });
  }
}
