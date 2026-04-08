import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * POST /api/notify/reminder
 *
 * Called when the vault owner's heartbeat is overdue or a countdown has started.
 * Body:
 *   email          — owner's email address
 *   vaultAddress   — vault public key (base58)
 *   type           — "overdue" | "countdown_started" | "countdown_urgent"
 *   minutesLeft    — minutes remaining before claim window opens (for countdown emails)
 */
export async function POST(req: NextRequest) {
  const { email, vaultAddress, type, minutesLeft } = await req.json();

  if (!email || !vaultAddress) {
    return NextResponse.json({ error: "Missing email or vaultAddress" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const blinkUrl = `${APP_URL}/api/actions/heartbeat?vault=${vaultAddress}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  const subjects: Record<string, string> = {
    overdue: "⚠️ Your Testament vault check-in is overdue",
    countdown_started: "🚨 Countdown started on your Testament vault",
    countdown_urgent: `🔴 URGENT — ${minutesLeft ?? "?"} minutes left to stop your vault countdown`,
  };

  const subject = subjects[type] ?? "Testament vault reminder";

  const urgencyColor = type === "countdown_urgent" ? "#ef4444" : type === "countdown_started" ? "#f97316" : "#eab308";
  const urgencyLabel = type === "countdown_urgent"
    ? `URGENT — only ${minutesLeft} minutes left to check in`
    : type === "countdown_started"
    ? "A countdown has been triggered on your vault"
    : "Your heartbeat check-in is overdue";

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

    <div style="background:${urgencyColor}22;border:1px solid ${urgencyColor};border-radius:12px;padding:16px 20px;margin-bottom:28px;">
      <p style="color:${urgencyColor};font-size:14px;font-weight:600;margin:0;">
        ${urgencyLabel}
      </p>
    </div>

    <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;">Check in now to keep your vault active.</h1>
    <p style="color:#a1a1aa;margin:0 0 28px;font-size:14px;">
      If you don't check in before the countdown ends, your beneficiaries will be able to claim your vault.
      One click below resets everything.
    </p>

    <a href="${blinkUrl}"
      style="display:inline-block;background:#fff;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;margin-bottom:32px;">
      Check in now →
    </a>

    <div style="background:#111;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Vault address</p>
      <p style="font-size:12px;color:#52525b;font-family:monospace;margin:0;">${vaultAddress}</p>
    </div>

    <p style="color:#3f3f46;font-size:12px;margin:0;">
      <a href="${dashboardUrl}" style="color:#52525b;">Open dashboard</a>
    </p>

  </div>
</body>
</html>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Reminder email error:", err);
    return NextResponse.json({ skipped: true, error: String(err) });
  }
}
