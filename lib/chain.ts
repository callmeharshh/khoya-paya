// Polygon anchoring — "Proof-of-Reunion".
//
// The audit log (lib/audit.ts) is hash-chained, so its HEAD hash commits to the
// entire history. We anchor that single 32-byte hash to Polygon by sending a
// tiny transaction whose calldata IS the hash. Anyone can then verify, on a
// public ledger, that our records existed at that time and weren't altered —
// WITHOUT a single byte of personal data ever touching the chain.
//
// Graceful by design: with no POLYGON_PRIVATE_KEY set, anchoring is reported as
// "not configured" rather than crashing — so the app and demo always run.

import { ethers } from "ethers";

const RPC = process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology";
const PK = process.env.POLYGON_PRIVATE_KEY || "";
const EXPLORER = process.env.POLYGON_EXPLORER || "https://amoy.polygonscan.com";
const NETWORK = process.env.POLYGON_NETWORK || "Polygon Amoy testnet";

export function isChainConfigured(): boolean {
  return PK.length > 0;
}

export function chainNetwork(): string {
  return NETWORK;
}

export interface AnchorResult {
  configured: boolean;
  txHash?: string;
  blockNumber?: number | null;
  explorer?: string;
  address?: string;
  network?: string;
  error?: string;
}

// Send the hash to Polygon as transaction calldata (no contract needed). The tx
// is permanent and publicly verifiable on Polygonscan.
export async function anchorHash(hash: string): Promise<AnchorResult> {
  if (!isChainConfigured()) {
    return {
      configured: false,
      error:
        "Polygon anchoring not configured. Set POLYGON_PRIVATE_KEY (a funded Amoy testnet wallet) in .env.local.",
    };
  }
  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);
    const data = hash.startsWith("0x") ? hash : "0x" + hash;
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0, // zero-value tx; the calldata carries the proof
      data, // 0x + the 32-byte audit-chain head hash
    });
    const receipt = await tx.wait(1);
    return {
      configured: true,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      explorer: `${EXPLORER}/tx/${tx.hash}`,
      address: wallet.address,
      network: NETWORK,
    };
  } catch (e) {
    return {
      configured: true,
      error: e instanceof Error ? e.message : "Anchor transaction failed",
    };
  }
}
