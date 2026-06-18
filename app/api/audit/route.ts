import { NextResponse } from "next/server";
import { getAudit, verifyChain } from "@/lib/audit";

export const runtime = "nodejs";

// The tamper-evident audit trail + a live check that the hash chain is intact.
export async function GET() {
  return NextResponse.json({ entries: getAudit(), chainValid: verifyChain() });
}
