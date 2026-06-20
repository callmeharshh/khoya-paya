import { NextResponse } from "next/server";
import { callStructured, ACTIVE_MODEL, type ImageInput } from "@/lib/llm";
import {
  INTAKE_SYSTEM,
  REPORT_SCHEMA,
  MATCH_SYSTEM,
  MATCH_SCHEMA,
  buildMatchPrompt,
} from "@/lib/prompts";
import { addReport, updateReport, listOpen } from "@/lib/store";
import { checkRate } from "@/lib/ratelimit";
import { appendAudit } from "@/lib/audit";
import { computeCompleteness } from "@/lib/profile";
import type { ExtractedReport, MatchResult } from "@/lib/types";

export const runtime = "nodejs";

function parseDataUrl(dataUrl: string): ImageInput | null {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], dataBase64: m[2] };
}

// POST { text, imageDataUrl?, deviceId?, phone?, replaceId? }
// Extract a structured report (reading a photo if present), apply anti-spam,
// store (or refine in place), audit it, then run semantic matching.
export async function POST(req: Request) {
  try {
    const { text, imageDataUrl, deviceId, phone, replaceId } = await req.json();
    if ((!text || typeof text !== "string") && !imageDataUrl) {
      return NextResponse.json(
        { error: "Provide text and/or a photo." },
        { status: 400 }
      );
    }

    // --- Anti-spam (skip on a refine of an existing report) ---
    let trustFlags: string[] = [];
    if (!replaceId) {
      const rate = checkRate(deviceId, phone);
      if (!rate.allowed) {
        return NextResponse.json({ error: rate.flags[0] }, { status: 429 });
      }
      trustFlags = rate.flags;
    }

    const trace: string[] = [];
    const image = imageDataUrl ? parseDataUrl(imageDataUrl) : null;
    if (image) trace.push("📷 Reading attached photo with vision");

    // 1. Extract the structured report.
    const reportData = await callStructured<ExtractedReport>({
      system: INTAKE_SYSTEM,
      user: `A person at the help booth said:\n\n"${text || "(no words — see photo)"}"\n\nExtract the structured report.`,
      schema: REPORT_SCHEMA,
      images: image ? [image] : undefined,
    });
    trace.push(
      `🗣 Detected ${reportData.detectedLanguage}; extracted a ${reportData.category}/${reportData.reportType.toUpperCase()} report (${reportData.urgency} urgency)`
    );

    // 2. Store new, or refine an existing report in place.
    const report = replaceId
      ? updateReport(replaceId, reportData, imageDataUrl ?? null)
      : addReport(reportData, imageDataUrl ?? null, trustFlags);
    if (!report) {
      return NextResponse.json(
        { error: "Could not find the report to refine." },
        { status: 404 }
      );
    }
    if (trustFlags.length) trace.push(`🚩 ${trustFlags.join(" ")}`);
    appendAudit(
      "report_filed",
      `${replaceId ? "Refined" : "Filed"} ${report.id} — ${report.summary}`,
      report,
      report.id
    );

    // Structured appearance profile — which core parameters are still missing.
    const completeness = computeCompleteness(report);
    trace.push(
      `📋 Appearance profile: ${completeness.filledCount}/${completeness.total} core details captured`
    );

    // 3. Match against open reports of the opposite type, same category.
    const oppositeType = report.reportType === "lost" ? "found" : "lost";
    const candidates = listOpen(oppositeType).filter(
      (c) => c.id !== report.id && c.category === report.category
    );
    trace.push(
      `🔎 Searched ${candidates.length} open ${oppositeType} ${report.category} report(s) for a match`
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
    const top = matches[0];
    if (top) {
      appendAudit(
        "match_found",
        `${report.id} ↔ ${top.reportId} at ${top.score}% (${top.confidence})`,
        top,
        report.id
      );
    }
    trace.push(
      top
        ? `🎯 Best match: ${top.reportId} at ${top.score}% (${top.confidence} confidence)`
        : "— No likely match yet; report added to the board"
    );

    return NextResponse.json({
      report,
      matches,
      trace,
      completeness,
      model: ACTIVE_MODEL,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
