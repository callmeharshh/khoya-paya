import { NextResponse } from "next/server";
import { callStructured } from "@/lib/anthropic";
import {
  COORDINATE_SYSTEM,
  COORDINATE_SCHEMA,
  buildCoordinatePrompt,
} from "@/lib/prompts";
import { getReport } from "@/lib/store";
import { appendAudit } from "@/lib/audit";
import type { CoordinationPlan } from "@/lib/types";

export const runtime = "nodejs";

// POST { lostId, foundId } -> a multilingual reunion-coordination plan.
export async function POST(req: Request) {
  try {
    const { lostId, foundId } = await req.json();
    const lost = getReport(lostId);
    const found = getReport(foundId);
    if (!lost || !found) {
      return NextResponse.json(
        { error: "Could not find both reports." },
        { status: 404 }
      );
    }

    const plan = await callStructured<CoordinationPlan>({
      system: COORDINATE_SYSTEM,
      user: buildCoordinatePrompt(lost, found),
      schema: COORDINATE_SCHEMA,
      maxTokens: 4000,
    });

    appendAudit(
      "match_found",
      `Coordination plan for ${lost.id} ↔ ${found.id} → ${plan.routedCenter}`,
      plan,
      `${lost.id}+${found.id}`
    );

    return NextResponse.json({ plan });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
