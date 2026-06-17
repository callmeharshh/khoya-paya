import { NextResponse } from "next/server";
import { callStructured } from "@/lib/llm";
import {
  VERIFY_QUESTIONS_SYSTEM,
  VERIFY_QUESTIONS_SCHEMA,
  buildVerifyQuestionsPrompt,
  VERIFY_SCORE_SYSTEM,
  VERIFY_VERDICT_SCHEMA,
  buildVerifyScorePrompt,
} from "@/lib/prompts";
import { getReport } from "@/lib/store";
import type { VerificationQuestionSet, VerificationVerdict } from "@/lib/types";

export const runtime = "nodejs";

// Trust & Safety: verify a claimant before handover.
// stage "questions" -> private challenge questions from the found record.
// stage "score"     -> a verdict (approve / deny / escalate) on the answers.
export async function POST(req: Request) {
  try {
    const { reportId, stage, answers, claimantRelation } = await req.json();
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
      const verdict = await callStructured<VerificationVerdict>({
        system: VERIFY_SCORE_SYSTEM,
        user: buildVerifyScorePrompt(
          found,
          Array.isArray(answers) ? answers : [],
          claimantRelation || ""
        ),
        schema: VERIFY_VERDICT_SCHEMA,
        maxTokens: 3000,
      });
      return NextResponse.json({ verdict });
    }

    return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
