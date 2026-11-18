import { NextResponse } from "next/server";
import { resolvePortalUrls } from "@/lib/portalExtract";

export const dynamic = "force-dynamic";

export async function GET() {
  const { publicBaseUrl: ojsPublicUrl } = resolvePortalUrls();
  const mqcPublicUrl =
    process.env.MQC_PUBLIC_URL?.trim() || "http://localhost:3000/dashboard";

  return NextResponse.json(
    { ojsPublicUrl, mqcPublicUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
