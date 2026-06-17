// The prompts + JSON schemas that turn Claude into the reunification agent.
// Three jobs: (1) extract a structured report from messy multilingual speech,
// (2) semantically match a new report against open reports of the opposite type,
// (3) draft a multilingual reunion-coordination plan.

import type { Report } from "./types";
import { SECTOR_LIST_TEXT, CENTER_LIST_TEXT } from "./geo";

// ---------------------------------------------------------------------------
// 1. INTAKE — free-form (often emotional, code-mixed) speech -> structured report
// ---------------------------------------------------------------------------

export const INTAKE_SYSTEM = `You are the intake agent at a Khoya-Paya (lost-and-found) help booth at the Kumbh Mela — a gathering of 80 million people. People walk up in distress and describe a person they have lost, or a person they have found, speaking Hindi, Marathi, Bhojpuri, English, or a code-mixed blend, often informally and emotionally.

People also report lost or found BELONGINGS — a phone, wallet, bag, jewellery, documents. Your job covers both lost people and lost objects.

Your job: turn their words into one precise, structured report a control room can act on.

Rules:
- Set "category" to "person" if the report is about a human being, or "object" if it is about a belonging.
- If category is "person": fill the "person" object and set "object" to null.
- If category is "object": fill the "object" object and set "person" to null. Capture itemType, brand, color, material, size, distinguishing marks, contents (what's inside, for bags/wallets), any serial/IMEI/ID, lock or security, and an estimatedValue of "low", "medium", or "high". For an OBJECT, set urgency "high" when estimatedValue is high (valuables attract fraudulent claims); otherwise "medium" or "low".
- Extract only what is stated or strongly implied. Use null for unknown fields; never invent details.
- Translate descriptive details into clear English in the structured fields, but PRESERVE the meaning faithfully (e.g. "narangi saree" -> clothing: "orange saree").
- "reportType" is "lost" if the speaker has lost someone, "found" if they have found/are with someone who is lost.
- Set urgency "high" if the missing/found person is a child, elderly, has a medical condition, or is described as confused/unwell; "medium" for an adult who is merely separated; "low" otherwise.
- detectedLanguage: the primary language the speaker used (e.g. "Hindi", "Marathi", "Hindi-English mix").
- summary: one tight English sentence a volunteer can read aloud.
- List every language the missing/found person can understand in languagesSpoken — this is critical for announcements.
- lastSeen.sector: map the described place to the SINGLE closest mela sector from this list, or null if unclear. Valid sectors: ${SECTOR_LIST_TEXT}.
- IF A PHOTO IS ATTACHED: read it carefully and use it to fill physical details — clothing and colors, approximate age, build, complexion, hair, and distinguishing features (glasses, marks, jewellery). Merge what you see with what the speaker said; if they conflict, prefer the photo for appearance and note it. Never guess identity beyond what is visible.`;

export const REPORT_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["person", "object"] },
    reportType: { type: "string", enum: ["lost", "found"] },
    person: {
      type: ["object", "null"],
      properties: {
        nameIfKnown: { type: ["string", "null"] },
        ageApprox: { type: ["string", "null"] },
        gender: { type: ["string", "null"] },
        heightBuild: { type: ["string", "null"] },
        complexion: { type: ["string", "null"] },
        clothing: { type: "array", items: { type: "string" } },
        distinguishingFeatures: { type: "array", items: { type: "string" } },
        languagesSpoken: { type: "array", items: { type: "string" } },
        medicalNotes: { type: ["string", "null"] },
      },
      required: [
        "nameIfKnown",
        "ageApprox",
        "gender",
        "heightBuild",
        "complexion",
        "clothing",
        "distinguishingFeatures",
        "languagesSpoken",
        "medicalNotes",
      ],
      additionalProperties: false,
    },
    object: {
      type: ["object", "null"],
      properties: {
        itemType: { type: ["string", "null"] },
        brand: { type: ["string", "null"] },
        color: { type: ["string", "null"] },
        material: { type: ["string", "null"] },
        size: { type: ["string", "null"] },
        distinguishingMarks: { type: "array", items: { type: "string" } },
        contents: { type: "array", items: { type: "string" } },
        serialOrIdentifier: { type: ["string", "null"] },
        lockOrSecurity: { type: ["string", "null"] },
        estimatedValue: { type: ["string", "null"] },
      },
      required: [
        "itemType",
        "brand",
        "color",
        "material",
        "size",
        "distinguishingMarks",
        "contents",
        "serialOrIdentifier",
        "lockOrSecurity",
        "estimatedValue",
      ],
      additionalProperties: false,
    },
    lastSeen: {
      type: "object",
      properties: {
        location: { type: ["string", "null"] },
        sector: { type: ["string", "null"] },
        time: { type: ["string", "null"] },
        circumstances: { type: ["string", "null"] },
      },
      required: ["location", "sector", "time", "circumstances"],
      additionalProperties: false,
    },
    reporter: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        relation: { type: ["string", "null"] },
      },
      required: ["name", "phone", "relation"],
      additionalProperties: false,
    },
    detectedLanguage: { type: "string" },
    originalText: { type: "string" },
    urgency: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string" },
  },
  required: [
    "category",
    "reportType",
    "person",
    "object",
    "lastSeen",
    "reporter",
    "detectedLanguage",
    "originalText",
    "urgency",
    "summary",
  ],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// 2. MATCH — semantic, cross-lingual matching against opposite-type reports
// ---------------------------------------------------------------------------

export const MATCH_SYSTEM = `You are the matching agent in a Kumbh Mela lost-and-found control room. A new report has just arrived. You are given the open reports of the OPPOSITE type (if a LOST report arrives, you are matching it against FOUND ones, and vice versa). All candidates are the same category as the new report — either all people, or all belongings.

Compare the new report against each candidate and judge whether they are the same person OR the same object. For OBJECTS, weight brand, type, color, distinguishing marks, contents, and any serial/identifier; remember descriptions vary ("dark phone" ≈ "black mobile") and a matching serial or unique content is near-conclusive. For PEOPLE, reason like an experienced reunification officer:
- Descriptions come from panicked relatives and volunteers in different languages — expect imprecision. "Saffron dhoti" and "orange traditional clothes" describe the same thing. A relative's "around 70" and a volunteer's "elderly man, maybe 65" are compatible.
- Weight stable, distinctive features (gender, approximate age band, distinguishing marks, medical notes, languages spoken) far more than easily-changed or vaguely-described ones.
- Geography and timing matter: a person found near a ghat shortly after being lost nearby is more likely a match.
- A single hard contradiction on a stable feature (e.g. clearly different gender or a 40-year age gap) should sharply lower the score.

For each candidate, give a 0-100 score and a confidence level. Only return candidates scoring 25 or above, sorted highest first. Be concrete in your reasoning — name the specific features that align or conflict.`;

export const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reportId: { type: "string" },
          score: { type: "integer" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          reasoning: { type: "string" },
          matchingFeatures: { type: "array", items: { type: "string" } },
          conflictingFeatures: { type: "array", items: { type: "string" } },
          recommendedAction: { type: "string" },
        },
        required: [
          "reportId",
          "score",
          "confidence",
          "reasoning",
          "matchingFeatures",
          "conflictingFeatures",
          "recommendedAction",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
} as const;

export function buildMatchPrompt(
  newReport: Report,
  candidates: Report[]
): string {
  return `NEW ${newReport.reportType.toUpperCase()} REPORT:
${JSON.stringify(stripForPrompt(newReport), null, 2)}

CANDIDATE ${newReport.reportType === "lost" ? "FOUND" : "LOST"} REPORTS:
${JSON.stringify(candidates.map(stripForPrompt), null, 2)}

Match the new report against each candidate. Use the candidate's "id" as reportId.`;
}

function stripForPrompt(r: Report) {
  return {
    id: r.id,
    category: r.category,
    reportType: r.reportType,
    person: r.person,
    object: r.object,
    lastSeen: r.lastSeen,
    urgency: r.urgency,
    summary: r.summary,
  };
}

// ---------------------------------------------------------------------------
// 3. COORDINATE — draft a multilingual reunion plan for a likely match
// ---------------------------------------------------------------------------

export const COORDINATE_SYSTEM = `You are the coordination agent for a Kumbh Mela lost-and-found control room. A LOST report and a FOUND report have been judged a likely match. Produce an actionable reunion plan.

Produce:
- announcements: a short loudspeaker announcement (2-3 sentences) in EACH language relevant to reuniting this pair — include the languages the lost person and the reporter speak, and Hindi as a default. Each announcement names the lost person (if known), a couple of distinctive details, and instructs them / anyone with them to come to the named center. Write each in the native script.
- routedCenter: choose the single nearest sensible center to route to from this list of actual Khoya-Paya Kendras, based on the lost/found sectors and locations: ${CENTER_LIST_TEXT}.
- verificationChecklist: 3-5 concrete questions or checks staff MUST confirm before handing over a person — extra strict when the person is a child or elderly/confused. This prevents wrong or unsafe handovers.
- handoverNote: one sentence for the reuniting volunteer summarizing the case.`;

export const COORDINATE_SCHEMA = {
  type: "object",
  properties: {
    announcements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          language: { type: "string" },
          text: { type: "string" },
        },
        required: ["language", "text"],
        additionalProperties: false,
      },
    },
    routedCenter: { type: "string" },
    verificationChecklist: { type: "array", items: { type: "string" } },
    handoverNote: { type: "string" },
  },
  required: [
    "announcements",
    "routedCenter",
    "verificationChecklist",
    "handoverNote",
  ],
  additionalProperties: false,
} as const;

export function buildCoordinatePrompt(lost: Report, found: Report): string {
  return `LOST REPORT:
${JSON.stringify(lost, null, 2)}

FOUND REPORT:
${JSON.stringify(found, null, 2)}

Draft the reunion coordination plan.`;
}

// ---------------------------------------------------------------------------
// 4. VERIFY — identity / ownership verification to STOP a wrong handover.
//    Two stages: (a) generate private challenge questions from the found
//    record, (b) score the claimant's answers and return a verdict.
//    This is the trust layer: the system never hands over on a guess.
// ---------------------------------------------------------------------------

export const VERIFY_QUESTIONS_SYSTEM = `You are the identity-verification agent at a Kumbh Mela lost-and-found center. Someone has come to CLAIM a found person or object. Before any handover you must check they are the genuine family member or owner — this is what prevents a lost child being handed to a trafficker, or a valuable item to the wrong person.

You are given the FOUND record. Generate 4-6 specific verification questions that ONLY the true family/owner could answer, derived strictly from concrete details in the record: distinguishing marks, exact clothing, medical notes, things the found person said about themselves, an object's contents / serials / lock screen.

Rules:
- Never ask anything that would have been said in a public loudspeaker announcement, or that a bystander could guess. Prefer private, specific details.
- Each question must be answerable from the record so the answer can be judged.
- Mark a question "critical" when a wrong answer should block the handover.`;

export const VERIFY_QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          critical: { type: "boolean" },
        },
        required: ["id", "question", "critical"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

export function buildVerifyQuestionsPrompt(found: Report): string {
  return `FOUND RECORD (a ${found.category}) to verify a claimant against:
${JSON.stringify(
  {
    category: found.category,
    person: found.person,
    object: found.object,
    lastSeen: found.lastSeen,
    summary: found.summary,
  },
  null,
  2
)}

${
  found.category === "object"
    ? "This is a belonging — ask ownership-proof questions only the true owner could answer (contents, serial/IMEI, lock screen / password, marks, where it was lost). For a locked device, asking them to unlock it is a strong proof."
    : "This is a person — ask private questions only the genuine family could answer."
}
Generate the verification questions.`;
}

export const VERIFY_SCORE_SYSTEM = `You are the identity-verification agent at a Kumbh Mela lost-and-found center. You have the FOUND record and a claimant's answers to your verification questions. Decide whether to hand the person/object over.

Judge each answer against the record — note matches, mismatches, and vague or evasive answers. A wrong answer on a CRITICAL question is a strong fraud signal.

SAFETY OVERRIDE (non-negotiable): if the found record is a child, or a vulnerable / elderly / confused / disoriented adult, or a high-value object, you may NEVER return "approve" on your own. The most you may return is "escalate", and requiresHumanSignoff MUST be true — a senior officer (and police, for a child) must authorize in person. Reuniting safely matters more than reuniting fast.

verdict:
- "approve": only a low-stakes adult / low-value case with strong, consistent, specific answers.
- "deny": clear mismatches or fraud signals.
- "escalate": any uncertainty, weak answers, OR any high-stakes case per the safety override.

Give a 0-100 riskScore (higher = more likely fraud/unsafe), a confidence level, plain-English reasoning a staff member can act on, and a per-answer assessment.`;

export const VERIFY_VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["approve", "deny", "escalate"] },
    riskScore: { type: "integer" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasoning: { type: "string" },
    requiresHumanSignoff: { type: "boolean" },
    escalationReason: { type: ["string", "null"] },
    answerAssessments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          assessment: { type: "string" },
          matched: { type: "boolean" },
        },
        required: ["question", "assessment", "matched"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "verdict",
    "riskScore",
    "confidence",
    "reasoning",
    "requiresHumanSignoff",
    "escalationReason",
    "answerAssessments",
  ],
  additionalProperties: false,
} as const;

export function buildVerifyScorePrompt(
  found: Report,
  qa: { question: string; answer: string }[],
  claimantRelation: string
): string {
  return `FOUND RECORD (a ${found.category}):
${JSON.stringify(
  {
    category: found.category,
    person: found.person,
    object: found.object,
    lastSeen: found.lastSeen,
    summary: found.summary,
  },
  null,
  2
)}

CLAIMANT says their relationship is: ${claimantRelation || "unspecified"}

CLAIMANT's answers to the verification questions:
${qa.map((p, i) => `${i + 1}. Q: ${p.question}\n   A: ${p.answer || "(no answer)"}`).join("\n")}

Judge whether to hand over.`;
}
