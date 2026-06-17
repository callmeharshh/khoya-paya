import { NextResponse } from "next/server";
import { callStructured, ACTIVE_MODEL, type ImageInput } from "@/lib/llm";
import {
  INTAKE_SYSTEM,
  REPORT_SCHEMA,
  MATCH_SYSTEM,
  MATCH_SCHEMA,
  buildMatchPrompt,
} from "@/lib/prompts";
import { addReport, listOpen } from "@/lib/store";
import type { ExtractedReport, MatchResult } from "@/lib/types";

export const runtime = "nodejs";

// Parse a "data:image/jpeg;base64,...." URL into the provider-neutral shape.
function parseDataUrl(dataUrl: string): ImageInput | null {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], dataBase64: m[2] };
}

// POST { text, imageDataUrl? } -> extract a structured report (reading the photo
// if present), store it, then run semantic matching against the opposite type.
export async function POST(req: Request) {
  try {
    const { text, imageDataUrl } = await req.json();
    if ((!text || typeof text !== "string") && !imageDataUrl) {
      return NextResponse.json(
        { error: "Provide text and/or a photo." },
        { status: 400 }
      );
    }

    const trace: string[] = [];
    const image = imageDataUrl ? parseDataUrl(imageDataUrl) : null;
    if (image) trace.push("📷 Reading attached photo with vision");

    // 1. Extract structured report from the free-form (multilingual) input + photo.
    const extracted = await callStructured<ExtractedReport>({
      system: INTAKE_SYSTEM,
      user: `A person at the help booth said:\n\n"${text || "(no words — see photo)"}"\n\nExtract the structured report.`,
      schema: REPORT_SCHEMA,
      images: image ? [image] : undefined,
    });
    trace.push(
      `🗣 Detected ${extracted.detectedLanguage}; extracted a ${extracted.reportType.toUpperCase()} report (${extracted.urgency} urgency)`
    );

    const report = addReport(extracted, imageDataUrl ?? null);

    // 2. Match against the open reports of the opposite type.
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
    trace.push(
      top
        ? `🎯 Best match: ${top.reportId} at ${top.score}% (${top.confidence} confidence)`
        : "— No likely match yet; report added to the board"
    );

    return NextResponse.json({ report, matches, trace, model: ACTIVE_MODEL });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
