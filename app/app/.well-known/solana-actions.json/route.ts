import { NextResponse } from "next/server";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

export async function GET() {
  return NextResponse.json(
    {
      rules: [
        { pathPattern: "/api/actions/heartbeat", apiPath: "/api/actions/heartbeat" },
        { pathPattern: "/api/actions/claim",     apiPath: "/api/actions/claim"     },
        { pathPattern: "/api/actions/trigger",   apiPath: "/api/actions/trigger"   },
      ],
    },
    { headers: cors() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}
