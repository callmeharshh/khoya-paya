import { NextResponse } from "next/server";
import { getAudit, verifyChain, getAnchors } from "@/lib/audit";
import { isChainConfigured, chainNetwork } from "@/lib/chain";

export const runtime = "nodejs";

// The tamper-evident audit trail, a live chain-integrity check, and any
// on-chain (Polygon) anchors of the chain.
export async function GET() {
  return NextResponse.json({
    entries: getAudit(),
    chainValid: verifyChain(),
    anchors: getAnchors(),
    chainConfigured: isChainConfigured(),
    network: chainNetwork(),
  });
}
