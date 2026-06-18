import { NextResponse } from "next/server";
import { listReports, markReunited, getReport } from "@/lib/store";
import { ACTIVE_MODEL, PROVIDER } from "@/lib/llm";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    reports: listReports(),
    provider: PROVIDER,
    model: ACTIVE_MODEL,
  });
}

// POST { id, action: "reunite" } -> close a case (audited).
export async function POST(req: Request) {
  const { id, action } = await req.json();
  if (action === "reunite") {
    const r = getReport(id);
    markReunited(id);
    appendAudit(
      "reunited",
      `Case ${id} resolved — reunited${r ? `: ${r.summary}` : ""}`,
      { id },
      id
    );
  }
  return NextResponse.json({ reports: listReports() });
}
