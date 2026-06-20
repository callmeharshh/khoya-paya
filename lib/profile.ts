// Structured "appearance profile" — a fixed set of parameters that make a report
// complete enough to match well. After each intake/refine we compute which are
// still missing and ask targeted questions, looping until all are captured.
// Deterministic (computed in code), so the completeness check is reliable.

import type { Report } from "./types";

interface FieldDef {
  field: string;
  label: string;
  question: string;
}

// 6 core appearance parameters for a PERSON.
const PERSON_FIELDS: FieldDef[] = [
  { field: "ageApprox", label: "Age", question: "Roughly how old are they?" },
  { field: "gender", label: "Gender", question: "Are they male or female?" },
  {
    field: "heightBuild",
    label: "Height & build",
    question: "What is their height and build (tall/short, thin/heavy)?",
  },
  {
    field: "complexion",
    label: "Complexion",
    question: "What is their complexion / skin tone?",
  },
  {
    field: "clothing",
    label: "Clothing",
    question: "What were they wearing? Please include colours.",
  },
  {
    field: "distinguishingFeatures",
    label: "Distinguishing features",
    question:
      "Any distinguishing features — marks, glasses, jewellery, a walking stick?",
  },
];

// 6 core parameters for an OBJECT.
const OBJECT_FIELDS: FieldDef[] = [
  {
    field: "itemType",
    label: "Item type",
    question: "What type of item is it (phone, wallet, bag…)?",
  },
  { field: "color", label: "Colour", question: "What colour is it?" },
  { field: "brand", label: "Brand / make", question: "What brand or make is it?" },
  { field: "size", label: "Size", question: "What is its size or dimensions?" },
  {
    field: "distinguishingMarks",
    label: "Distinguishing marks",
    question: "Any scratches, stickers, engravings, or a case?",
  },
  {
    field: "serialOrIdentifier",
    label: "Serial / ID",
    question: "Do you have a serial number, IMEI, or any ID on it?",
  },
];

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
}

export interface Completeness {
  total: number;
  filledCount: number;
  complete: boolean;
  captured: string[]; // labels already filled
  missing: { field: string; label: string; question: string }[];
}

export function computeCompleteness(report: Report): Completeness {
  const defs = report.category === "object" ? OBJECT_FIELDS : PERSON_FIELDS;
  const subject = (
    report.category === "object" ? report.object : report.person
  ) as Record<string, unknown> | null;

  const captured: string[] = [];
  const missing: FieldDef[] = [];
  for (const d of defs) {
    if (subject && isFilled(subject[d.field])) captured.push(d.label);
    else missing.push(d);
  }

  return {
    total: defs.length,
    filledCount: captured.length,
    complete: missing.length === 0,
    captured,
    missing,
  };
}
