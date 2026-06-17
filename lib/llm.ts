// Provider layer. Claude is the default and what you ship/demo with.
// Gemini is a DEV-ONLY fallback so you can test the pipeline before you have an
// Anthropic key — set LLM_PROVIDER=gemini + GEMINI_API_KEY in .env.local.
//
// ⚠️  Demo and submit on Claude. This is the Claude Impact Lab — the judging
//     panel is Anthropic + a government rep. Gemini is for local testing only.

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export type Provider = "claude" | "gemini";

export const PROVIDER: Provider =
  (process.env.LLM_PROVIDER as Provider) || "claude";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const ACTIVE_MODEL = PROVIDER === "gemini" ? GEMINI_MODEL : CLAUDE_MODEL;

let _anthropic: Anthropic | null = null;
let _gemini: GoogleGenAI | null = null;

function anthropic() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}
function gemini() {
  if (!_gemini)
    _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _gemini;
}

export interface ImageInput {
  mediaType: string; // e.g. "image/jpeg"
  dataBase64: string; // raw base64, no data: prefix
}

export interface StructuredOpts {
  system: string;
  user: string;
  schema: object;
  maxTokens?: number;
  images?: ImageInput[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Transient = worth retrying (capacity blips, rate spikes). NOT retryable:
// auth errors, invalid requests, or a hard spend/billing cap.
function isTransient(msg: string): boolean {
  if (/spending cap|billing|api key|invalid|permission|not found/i.test(msg)) {
    return false;
  }
  return /\b503\b|\b429\b|unavailable|overloaded|high demand|temporarily|exhausted|rate limit/i.test(
    msg
  );
}

// One structured call that returns validated JSON as T, optionally with images.
// Retries transient provider errors (e.g. Gemini 503 "high demand") with backoff
// so a single capacity blip never breaks a live demo.
export async function callStructured<T>(opts: StructuredOpts): Promise<T> {
  const attempt = () =>
    PROVIDER === "gemini"
      ? geminiStructured<T>(opts)
      : claudeStructured<T>(opts);

  const maxAttempts = 4;
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i === maxAttempts - 1 || !isTransient(msg)) throw e;
      await sleep(700 * (i + 1)); // 0.7s, 1.4s, 2.1s
    }
  }
  throw lastErr;
}

// --- Claude: force a single tool whose input_schema IS the shape we want. -----
async function claudeStructured<T>(opts: StructuredOpts): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as "image/jpeg" | "image/png",
        data: img.dataBase64,
      },
    });
  }
  content.push({ type: "text", text: opts.user });

  const res = await anthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    tools: [
      {
        name: "record",
        description: "Record the structured result.",
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "record" },
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude returned no tool_use block");
  }
  return block.input as T;
}

// --- Gemini: JSON mode + schema described in the prompt (robust across quirks).
async function geminiStructured<T>(opts: StructuredOpts): Promise<T> {
  const parts: any[] = [];
  for (const img of opts.images ?? []) {
    parts.push({
      inlineData: { mimeType: img.mediaType, data: img.dataBase64 },
    });
  }
  parts.push({
    text: `${opts.user}\n\nReturn ONLY a JSON object matching this JSON Schema (no prose, no markdown):\n${JSON.stringify(
      opts.schema
    )}`,
  });

  const res = await gemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      // Give the whole budget to the JSON output; 2.5-flash otherwise spends
      // part of it on hidden "thinking" tokens and truncates the response.
      maxOutputTokens: Math.max(opts.maxTokens ?? 4000, 6000),
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = (res.text ?? "").trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    // Strip accidental code fences if the model wrapped the JSON.
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned) as T;
  }
}
