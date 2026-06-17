import { NextResponse } from "next/server";
import { callStructured } from "@/lib/llm";
import { MATCH_SYSTEM, MATCH_SCHEMA, buildMatchPrompt } from "@/lib/prompts";
import { getReport, listOpen } from "@/lib/store";
import type { MatchResult } from "@/lib/types";

export const runtime = "nodejs";

// POST { reportId } -> re-run semantic matching for an existing report against
// the open reports of the opposite type. Lets an agent search at any time.
export async function POST(req: Request) {
  try {
    const { reportId } = await req.json();
    const report = getReport(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const oppositeType = report.reportType === "lost" ? "found" : "lost";
    const candidates = listOpen(oppositeType).filter(
      (c) => c.id !== report.id && c.category === report.category
    );

    let matches: MatchResult["matches"] = [];
    if (candidates.length > 0) {
      const result = await callStructured<MatchResult>({
        system: MATCH_SYSTEM,
        user: buildMatchPrompt(report, candidates),
        schema: MATCH_SCHEMA,
        maxTokens: 5000,
      });
      matches = result.matches.sort((a, b) => b.score - a.score);
    }

    return NextResponse.json({ report, matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
