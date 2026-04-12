/**
 * POST /api/notify/inheritance
 *
 * Called by the keeper after executing an inheritance transfer.
 * Body:
 *   email          — beneficiary's email (if known) OR owner email
 *   role           — "beneficiary" | "owner"
 *   vaultAddress   — vault public key (base58)
 *   beneficiaryWallet — beneficiary wallet address
 *   solAmount      — SOL transferred (optional)
 *   tokenMint      — SPL mint address (optional, for token transfers)
 */
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { email, role, vaultAddress, beneficiaryWallet, solAmount, tokenMint } = await req.json();

  if (!email || !vaultAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const isBeneficiary = role === "beneficiary";
  const assetDesc = solAmount
    ? `${solAmount} SOL`
    : tokenMint
    ? `tokens (mint: ${tokenMint.slice(0, 8)}…)`
    : "assets";

  const subject = isBeneficiary
    ? `You just received ${assetDesc} via Testament`
    : `Inheritance transfer executed — ${assetDesc} sent`;

  const headline = isBeneficiary
    ? `You just received ${assetDesc}.`
    : `The inheritance transfer has been executed.`;

  const body = isBeneficiary
    ? `A Testament vault has completed its countdown. ${assetDesc} has been transferred directly to your wallet — no action needed on your part.`
    : `The countdown for your vault completed. ${assetDesc} was automatically transferred to ${beneficiaryWallet?.slice(0, 8)}… All inheritance transfers have been executed as you configured.`;

  try {
    await resend.emails.send({
      from: "Testament <onboarding@resend.dev>",
      to: email,
      subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#000;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">

    <div style="background:#16a34a22;border:1px solid #16a34a;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="color:#4ade80;font-size:14px;font-weight:600;margin:0;">Transfer complete</p>
    </div>

    <h1 style="font-size:22px;font-weight:600;margin:0 0 12px;">${headline}</h1>
    <p style="color:#a1a1aa;margin:0 0 28px;font-size:14px;line-height:1.6;">
      ${body}
    </p>

    ${beneficiaryWallet ? `
    <div style="background:#111;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Recipient wallet</p>
      <p style="font-size:12px;color:#a1a1aa;font-family:monospace;margin:0;">${beneficiaryWallet}</p>
    </div>` : ""}

    <div style="background:#111;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Vault</p>
      <p style="font-size:12px;color:#52525b;font-family:monospace;margin:0;">${vaultAddress}</p>
    </div>

    <p style="color:#3f3f46;font-size:12px;margin:0;">
      <a href="${APP_URL}/dashboard" style="color:#52525b;">View on Testament</a>
    </p>

  </div>
</body>
</html>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Inheritance email error:", err);
    return NextResponse.json({ skipped: true, error: String(err) });
  }
}
