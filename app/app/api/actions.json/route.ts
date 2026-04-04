import { NextResponse } from "next/server";

// Solana Actions registry — tells wallets which routes are valid Blinks.
// See: https://solana.com/docs/advanced/actions
export async function GET() {
  return NextResponse.json({
    rules: [
      {
        pathPattern: "/api/actions/heartbeat",
        apiPath: "/api/actions/heartbeat",
      },
      {
        pathPattern: "/api/actions/claim",
        apiPath: "/api/actions/claim",
      },
    ],
  });
}
