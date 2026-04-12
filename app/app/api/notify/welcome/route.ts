import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { registerEmail } from "../../../../lib/emailRegistry";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { email, vaultAddress, heartbeatValue, heartbeatUnit } = await req.json();

  if (!email || !vaultAddress) {
    return NextResponse.json({ error: "Missing email or vaultAddress" }, { status: 400 });
  }

  // Persist email<>vault mapping for keeper notifications
  registerEmail(vaultAddress, email);

  if (!process.env.RESEND_API_KEY) {
    // Silently skip if not configured — don't break vault creation
    return NextResponse.json({ skipped: true });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const blinkUrl = `${APP_URL}/api/actions/heartbeat?vault=${vaultAddress}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  const intervalLabel = `${heartbeatValue} ${heartbeatUnit}`;

  try {
    await resend.emails.send({
      from: "Testament <onboarding@resend.dev>",
      to: email,
      subject: "Your inheritance vault is live — save your heartbeat link",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#000;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px;">

    <h1 style="font-size:24px;font-weight:600;margin:0 0 8px;">Your vault is live.</h1>
    <p style="color:#a1a1aa;margin:0 0 32px;font-size:15px;">
      Testament is now protecting your assets. Here's everything you need to keep it active.
    </p>

    <div style="background:#111;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">
        Your heartbeat link
      </p>
      <p style="font-size:13px;color:#a1a1aa;word-break:break-all;margin:0 0 16px;font-family:monospace;">
        ${blinkUrl}
      </p>
      <a href="${blinkUrl}"
        style="display:inline-block;background:#fff;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">
        Check in now →
      </a>
    </div>

    <div style="background:#111;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">
        What happens next
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:14px;color:#a1a1aa;">
          ⏱ Check in once every <strong style="color:#fff;">${intervalLabel}</strong>
        </div>
        <div style="font-size:14px;color:#a1a1aa;">
          📧 We'll email you a reminder before your deadline
        </div>
        <div style="font-size:14px;color:#a1a1aa;">
          🔒 If you stop checking in, the countdown starts — your beneficiaries are notified
        </div>
        <div style="font-size:14px;color:#a1a1aa;">
          ✅ One click on the link above resets everything
        </div>
      </div>
    </div>

    <div style="background:#111;border:1px solid #27272a;border-radius:12px;padding:24px;margin-bottom:32px;">
      <p style="color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">
        Vault address
      </p>
      <p style="font-size:12px;color:#52525b;font-family:monospace;margin:0;">${vaultAddress}</p>
    </div>

    <p style="color:#3f3f46;font-size:12px;margin:0;">
      Save this email. The heartbeat link above is all you need to keep your vault active.
    </p>
    <p style="color:#3f3f46;font-size:12px;margin:8px 0 0;">
      <a href="${dashboardUrl}" style="color:#52525b;">Open dashboard</a>
    </p>

  </div>
</body>
</html>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Welcome email error:", err);
    // Don't fail vault creation if email fails
    return NextResponse.json({ skipped: true, error: String(err) });
  }
}
