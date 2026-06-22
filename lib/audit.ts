// Tamper-evident audit trail. Every significant action (report filed, match
// found, verification verdict, reunion) is appended as a hash-chained entry:
// each entry's hash includes the previous entry's hash, so altering any past
// record breaks the chain. This is the accountability layer — and each
// entryHash is exactly what you'd anchor to Polygon for on-chain proof, without
// ever putting personal data on a public ledger.

import { createHash } from "crypto";

export interface AuditEntry {
  seq: number;
  timestamp: number;
  type: "report_filed" | "match_found" | "verification" | "reunited";
  summary: string;
  refId: string | null;
  dataHash: string; // sha256 of the (private) payload
  prevHash: string;
  entryHash: string;
}

const g = globalThis as unknown as { __khoyaAudit?: AuditEntry[] };
const log: AuditEntry[] = g.__khoyaAudit ?? (g.__khoyaAudit = []);

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function appendAudit(
  type: AuditEntry["type"],
  summary: string,
  payload: unknown,
  refId: string | null = null
): AuditEntry {
  const prevHash = log.length ? log[log.length - 1].entryHash : "GENESIS";
  const timestamp = Date.now();
  const seq = log.length;
  const dataHash = sha256(JSON.stringify(payload ?? {}));
  const entryHash = sha256(`${prevHash}|${seq}|${timestamp}|${type}|${dataHash}`);
  const entry: AuditEntry = {
    seq,
    timestamp,
    type,
    summary,
    refId,
    dataHash,
    prevHash,
    entryHash,
  };
  log.push(entry);
  return entry;
}

export function getAudit(): AuditEntry[] {
  return log;
}

// --- Polygon anchors: a record of audit-chain hashes notarized on-chain. ---

export interface Anchor {
  label: string;
  hash: string; // the audit-chain head hash that was anchored
  txHash: string;
  blockNumber: number | null;
  explorer: string;
  timestamp: number;
}

const ag = globalThis as unknown as { __khoyaAnchors?: Anchor[] };
const anchors: Anchor[] = ag.__khoyaAnchors ?? (ag.__khoyaAnchors = []);

export function addAnchor(a: Anchor): void {
  anchors.push(a);
}

export function getAnchors(): Anchor[] {
  return anchors;
}

// The current head hash commits to the entire chain (or null if empty).
export function headHash(): string | null {
  return log.length ? log[log.length - 1].entryHash : null;
}

// Recompute the chain to prove nothing was tampered with.
export function verifyChain(): boolean {
  let prev = "GENESIS";
  for (const e of log) {
    if (e.prevHash !== prev) return false;
    const h = sha256(`${e.prevHash}|${e.seq}|${e.timestamp}|${e.type}|${e.dataHash}`);
    if (h !== e.entryHash) return false;
    prev = e.entryHash;
  }
  return true;
}
