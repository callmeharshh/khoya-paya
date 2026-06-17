import { NextResponse } from "next/server";
import { listReports, markReunited } from "@/lib/store";
import { ACTIVE_MODEL, PROVIDER } from "@/lib/llm";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    reports: listReports(),
    provider: PROVIDER,
    model: ACTIVE_MODEL,
  });
}

// POST { id, action: "reunite" } -> close a case.
export async function POST(req: Request) {
  const { id, action } = await req.json();
  if (action === "reunite") markReunited(id);
  return NextResponse.json({ reports: listReports() });
}
