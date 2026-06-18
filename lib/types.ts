// Shared types for Khoya-Paya — the missing-person reunification agent.

export type ReportType = "lost" | "found";
export type Category = "person" | "object";
export type Urgency = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";

export interface PersonDescription {
  nameIfKnown: string | null;
  ageApprox: string | null;
  gender: string | null;
  heightBuild: string | null;
  complexion: string | null;
  clothing: string[];
  distinguishingFeatures: string[];
  languagesSpoken: string[];
  medicalNotes: string | null;
}

export interface ObjectDescription {
  itemType: string | null; // phone, wallet, bag, jewellery, document…
  brand: string | null;
  color: string | null;
  material: string | null;
  size: string | null;
  distinguishingMarks: string[]; // scratches, stickers, engravings
  contents: string[]; // what's inside (bag/wallet) — used for ownership proof
  serialOrIdentifier: string | null; // IMEI, serial, ID number
  lockOrSecurity: string | null; // "locked, fingerprint" / pattern
  estimatedValue: string | null; // low / medium / high — high → strict claim flow
}

export interface Report {
  id: string;
  category: Category;
  reportType: ReportType;
  person: PersonDescription | null;
  object: ObjectDescription | null;
  lastSeen: {
    location: string | null;
    sector: string | null;
    time: string | null;
    circumstances: string | null;
  };
  reporter: {
    name: string | null;
    phone: string | null;
    relation: string | null;
  };
  detectedLanguage: string;
  originalText: string;
  urgency: Urgency;
  summary: string;
  status: "open" | "reunited";
  createdAt: number;
  photoUrl?: string | null; // data URL of an attached photo, if any
  trustFlags?: string[]; // anti-spam flags raised at intake
}

// The structured object Claude returns from a free-form report.
export type ExtractedReport = Omit<Report, "id" | "status" | "createdAt">;

export interface MatchCandidate {
  reportId: string;
  score: number; // 0-100
  confidence: Confidence;
  reasoning: string;
  matchingFeatures: string[];
  conflictingFeatures: string[];
  recommendedAction: string;
}

export interface MatchResult {
  matches: MatchCandidate[];
}

export interface Announcement {
  language: string;
  text: string;
}

export interface CoordinationPlan {
  announcements: Announcement[];
  routedCenter: string;
  verificationChecklist: string[];
  handoverNote: string;
}

// --- Trust & Safety: claimant verification interview ---

export interface VerificationQuestion {
  id: string;
  question: string;
  critical: boolean;
}

export interface VerificationQuestionSet {
  questions: VerificationQuestion[];
}

export type Verdict = "approve" | "deny" | "escalate";

export interface AnswerAssessment {
  question: string;
  assessment: string;
  matched: boolean;
}

export interface VerificationVerdict {
  verdict: Verdict;
  riskScore: number; // 0-100, higher = more likely fraud/unsafe
  confidence: Confidence;
  reasoning: string;
  requiresHumanSignoff: boolean;
  escalationReason: string | null;
  answerAssessments: AnswerAssessment[];
  photoComparison: string | null; // visual assessment when both photos exist
}
