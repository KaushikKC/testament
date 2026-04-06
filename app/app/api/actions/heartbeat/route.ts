import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import idl from "../../../../lib/idl.json";

// Solana Actions CORS headers — required for Blinks to work in wallets / Dialect
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Action-Version,X-Blockchain-Ids",
    "X-Action-Version": "2.1.3",
    "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  };
}

// GET — return the Blink metadata card shown in wallet / Dialect
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vault = searchParams.get("vault");

  if (!vault) {
    return NextResponse.json({ error: "Missing vault parameter" }, { status: 400 });
  }

  const payload = {
    title: "Testament Heartbeat",
    icon: "https://testament.app/icon.png",
    description:
      "Prove you're alive. One click resets your inheritance vault countdown.",
    label: "Check in",
    links: {
      actions: [
        {
          label: "Check in now",
          href: `/api/actions/heartbeat?vault=${vault}`,
        },
      ],
    },
  };

  return NextResponse.json(payload, { headers: corsHeaders() });
}

// OPTIONS — preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// POST — build and return the heartbeat transaction for the wallet to sign
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vaultAddress = searchParams.get("vault");

  if (!vaultAddress) {
    return NextResponse.json({ error: "Missing vault parameter" }, { status: 400 });
  }

  const body = await req.json();
  const { account } = body as { account: string };

  if (!account) {
    return NextResponse.json({ error: "Missing account in body" }, { status: 400 });
  }

  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet")
    );

    const ownerPubkey = new PublicKey(account);
    const vaultPubkey = new PublicKey(vaultAddress);

    // Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), ownerPubkey.toBuffer()],
      new PublicKey(
        process.env.TESTAMENT_PROGRAM_ID ??
          "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
      )
    );

    if (vaultPda.toBase58() !== vaultPubkey.toBase58()) {
      return NextResponse.json(
        { error: "Vault address does not match owner PDA" },
        { status: 400 }
      );
    }

    // Discriminator pulled from IDL — stays correct when the program is rebuilt.
    const ix_def = idl.instructions.find((i: { name: string }) => i.name === "heartbeat");
    if (!ix_def) throw new Error("heartbeat instruction not found in IDL");
    const discriminator = Buffer.from(ix_def.discriminator);

    const programId = new PublicKey(
      process.env.TESTAMENT_PROGRAM_ID ??
        "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
    );

    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: ownerPubkey, isSigner: true, isWritable: false },
      ],
      data: discriminator,
    });

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: ownerPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false });

    return NextResponse.json(
      {
        transaction: serialized.toString("base64"),
        message: "Heartbeat recorded — you're alive!",
      },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error("Heartbeat action error:", err);
    return NextResponse.json(
      { error: "Failed to build heartbeat transaction" },
      { status: 500 }
    );
  }
}
