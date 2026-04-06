import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import idl from "../../../../lib/idl.json";

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

const PROGRAM_ID = new PublicKey(
  process.env.TESTAMENT_PROGRAM_ID ??
    "2D4gZY98JkaJf3pwAJ1pCE2uUfPFJsFBygSYh4No8pYc"
);

// GET — Blink metadata card for the claim action
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vault = searchParams.get("vault");
  const beneficiary = searchParams.get("beneficiary");

  if (!vault || !beneficiary) {
    return NextResponse.json(
      { error: "Missing vault or beneficiary parameter" },
      { status: 400 }
    );
  }

  const payload = {
    title: "Testament — Claim Inheritance",
    icon: "https://testament.app/icon.png",
    description:
      "The vault has activated. Claim your share of the inheritance privately on Solana.",
    label: "Claim my share",
    links: {
      actions: [
        {
          label: "Claim now",
          href: `/api/actions/claim?vault=${vault}&beneficiary=${beneficiary}`,
        },
      ],
    },
  };

  return NextResponse.json(payload, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// POST — build the claim transaction for the beneficiary's wallet to sign
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vaultAddress = searchParams.get("vault");
  const beneficiaryWalletAddress = searchParams.get("beneficiary");

  if (!vaultAddress || !beneficiaryWalletAddress) {
    return NextResponse.json(
      { error: "Missing vault or beneficiary parameter" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { account } = body as { account: string };

  if (!account) {
    return NextResponse.json({ error: "Missing account in body" }, { status: 400 });
  }

  // Verify the signing account matches the beneficiary wallet
  if (account !== beneficiaryWalletAddress) {
    return NextResponse.json(
      { error: "Connected wallet does not match beneficiary address" },
      { status: 403 }
    );
  }

  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet")
    );

    const beneficiarySigner = new PublicKey(account);
    const vaultPubkey = new PublicKey(vaultAddress);
    const beneficiaryWallet = new PublicKey(beneficiaryWalletAddress);

    // Derive beneficiary PDA
    const [beneficiaryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("beneficiary"),
        vaultPubkey.toBuffer(),
        beneficiaryWallet.toBuffer(),
      ],
      PROGRAM_ID
    );

    // Fetch vault to get owner (needed for vault PDA verification)
    // In production, decode vault account data here to get owner pubkey
    // For now we trust the vault address passed in the URL

    // Discriminator pulled from IDL — stays correct when the program is rebuilt.
    const ix_def = idl.instructions.find((i: { name: string }) => i.name === "claim");
    if (!ix_def) throw new Error("claim instruction not found in IDL");
    const discriminator = Buffer.from(ix_def.discriminator);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: vaultPubkey, isSigner: false, isWritable: true },
        { pubkey: beneficiaryPda, isSigner: false, isWritable: true },
        { pubkey: beneficiarySigner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: beneficiarySigner,
      blockhash,
      lastValidBlockHeight,
    }).add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false });

    return NextResponse.json(
      {
        transaction: serialized.toString("base64"),
        message: "Inheritance claimed — funds transferred privately.",
      },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error("Claim action error:", err);
    return NextResponse.json(
      { error: "Failed to build claim transaction" },
      { status: 500 }
    );
  }
}
