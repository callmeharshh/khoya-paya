import { NextResponse } from "next/server";
import { callStructured, type ImageInput } from "@/lib/llm";
import {
  VERIFY_QUESTIONS_SYSTEM,
  VERIFY_QUESTIONS_SCHEMA,
  buildVerifyQuestionsPrompt,
  VERIFY_SCORE_SYSTEM,
  VERIFY_VERDICT_SCHEMA,
  buildVerifyScorePrompt,
} from "@/lib/prompts";
import { getReport } from "@/lib/store";
import { appendAudit } from "@/lib/audit";
import type { VerificationQuestionSet, VerificationVerdict } from "@/lib/types";

export const runtime = "nodejs";

function parseDataUrl(dataUrl?: string | null): ImageInput | null {
  if (!dataUrl) return null;
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], dataBase64: m[2] };
}

// Trust & Safety: verify a claimant before handover.
// stage "questions" -> private challenge questions from the found record.
// stage "score"     -> verdict on the answers, incl. photo-to-photo comparison
//                      when both the found record and the claimant's report have
//                      photos.
export async function POST(req: Request) {
  try {
    const { reportId, stage, answers, claimantRelation, claimantReportId } =
      await req.json();
    const found = getReport(reportId);
    if (!found) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (stage === "questions") {
      const result = await callStructured<VerificationQuestionSet>({
        system: VERIFY_QUESTIONS_SYSTEM,
        user: buildVerifyQuestionsPrompt(found),
        schema: VERIFY_QUESTIONS_SCHEMA,
        maxTokens: 2000,
      });
      return NextResponse.json(result);
    }

    if (stage === "score") {
      // Photos: found record first, claimant's own photo second (order matters
      // for the prompt). Only include ones that exist.
      const images: ImageInput[] = [];
      const foundPhoto = parseDataUrl(found.photoUrl);
      const claimant = claimantReportId ? getReport(claimantReportId) : undefined;
      const claimantPhoto = parseDataUrl(claimant?.photoUrl);
      if (foundPhoto) images.push(foundPhoto);
      if (foundPhoto && claimantPhoto) images.push(claimantPhoto);

      const verdict = await callStructured<VerificationVerdict>({
        system: VERIFY_SCORE_SYSTEM,
        user: buildVerifyScorePrompt(
          found,
          Array.isArray(answers) ? answers : [],
          claimantRelation || ""
        ),
        schema: VERIFY_VERDICT_SCHEMA,
        images: images.length ? images : undefined,
        maxTokens: 3000,
      });

      appendAudit(
        "verification",
        `${found.id}: ${verdict.verdict.toUpperCase()} (risk ${verdict.riskScore}/100)${
          verdict.requiresHumanSignoff ? " — sign-off required" : ""
        }`,
        verdict,
        found.id
      );

      return NextResponse.json({ verdict, comparedPhotos: images.length });
    }

    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
