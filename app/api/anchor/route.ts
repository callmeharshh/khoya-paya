import { NextResponse } from "next/server";
import { headHash, addAnchor, getAnchors } from "@/lib/audit";
import { anchorHash } from "@/lib/chain";

export const runtime = "nodejs";

// POST -> anchor the audit chain's current head hash to Polygon. The head hash
// commits to the whole chain, so this notarizes the entire audit log on-chain.
export async function POST() {
  const head = headHash();
  if (!head) {
    return NextResponse.json(
      { error: "Nothing to anchor yet — the audit log is empty." },
      { status: 400 }
    );
  }

  const result = await anchorHash(head);

  if (result.configured && result.txHash) {
    addAnchor({
      label: `audit-chain head`,
      hash: head,
      txHash: result.txHash,
      blockNumber: result.blockNumber ?? null,
      explorer: result.explorer!,
      timestamp: Date.now(),
    });
  }

  return NextResponse.json({ result, anchors: getAnchors() });
}
