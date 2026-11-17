import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ojsPublicUrl =
    process.env.OJS_PUBLIC_URL?.trim() || "http://localhost/jurnalpermukiman/index.php/JP";
  const mqcPublicUrl =
    process.env.MQC_PUBLIC_URL?.trim() || "http://localhost:3000/dashboard";

  return NextResponse.json(
    { ojsPublicUrl, mqcPublicUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
