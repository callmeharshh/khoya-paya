// Report store. Next.js bundles each API route separately, so a plain
// module-level array would give every route its OWN copy — a report added in
// /api/intake would be invisible to /api/coordinate. We pin the state to
// globalThis so all route bundles share one store within the server process.
// (For production, swap this for Postgres / the government registry.)

import type { ExtractedReport, Report } from "./types";

interface StoreState {
  reports: Report[];
  counter: number;
  seeded: boolean;
}

const g = globalThis as unknown as { __khoyaStore?: StoreState };
const state: StoreState =
  g.__khoyaStore ?? (g.__khoyaStore = { reports: [], counter: 0, seeded: false });

function makeId(type: string) {
  state.counter += 1;
  return `${type === "lost" ? "L" : "F"}${String(state.counter).padStart(3, "0")}`;
}

export function addReport(
  extracted: ExtractedReport,
  photoUrl?: string | null
): Report {
  const report: Report = {
    ...extracted,
    id: makeId(extracted.reportType),
    status: "open",
    createdAt: Date.now(),
    photoUrl: photoUrl ?? null,
  };
  state.reports.unshift(report);
  return report;
}

export function getReport(id: string): Report | undefined {
  return state.reports.find((r) => r.id === id);
}

export function listReports(): Report[] {
  return state.reports;
}

export function listOpen(type?: "lost" | "found"): Report[] {
  return state.reports.filter(
    (r) => r.status === "open" && (type ? r.reportType === type : true)
  );
}

export function markReunited(id: string) {
  const r = getReport(id);
  if (r) r.status = "reunited";
}

// --- Seed data so the control room and matching look alive on first load. ---
// FOUND reports filed by volunteers across the Nashik mela grounds.

function seed() {
  if (state.seeded) return;
  state.seeded = true;
  const now = Date.now();
  const seeds: Report[] = [
    {
      id: "F001",
      category: "person",
      reportType: "found",
      person: {
        nameIfKnown: null,
        ageApprox: "around 70",
        gender: "female",
        heightBuild: "short, frail",
        complexion: "wheatish",
        clothing: ["orange traditional saree", "white shawl"],
        distinguishingFeatures: ["walks with a wooden stick", "silver nose ring"],
        languagesSpoken: ["Bhojpuri", "Hindi"],
        medicalNotes: "seems disoriented, hard of hearing",
      },
      object: null,
      lastSeen: {
        location: "Ramkund steps, Panchavati",
        sector: "Ramkund / Panchavati",
        time: "about 30 minutes ago",
        circumstances: "found alone and confused near the steps by a volunteer",
      },
      reporter: { name: "Volunteer Asha", phone: "100", relation: "volunteer" },
      detectedLanguage: "Marathi",
      originalText:
        "एक वृद्ध महिला रामकुंडाजवळ एकटी सापडली, नारंगी साडी, काठी घेऊन चालते, गोंधळलेली दिसते.",
      urgency: "high",
      summary:
        "Disoriented elderly woman (~70) in an orange saree with a walking stick found alone at Ramkund.",
      status: "open",
      createdAt: now - 1000 * 60 * 30,
      photoUrl: null,
    },
    {
      id: "F002",
      category: "person",
      reportType: "found",
      person: {
        nameIfKnown: "Raju",
        ageApprox: "about 6 years",
        gender: "male",
        heightBuild: "small child",
        complexion: "dark",
        clothing: ["red t-shirt with a cartoon", "blue shorts"],
        distinguishingFeatures: ["small scar on left eyebrow", "crying"],
        languagesSpoken: ["Hindi"],
        medicalNotes: null,
      },
      object: null,
      lastSeen: {
        location: "Kapila Sangam main bathing area",
        sector: "Kapila Sangam",
        time: "15 minutes ago",
        circumstances: "found crying, separated from family in the crowd",
      },
      reporter: { name: "Volunteer Imran", phone: "100", relation: "volunteer" },
      detectedLanguage: "Hindi",
      originalText:
        "एक छोटा लड़का रो रहा है, लाल टीशर्ट, करीब 6 साल, कपिला संगम के पास मिला, अपना नाम राजू बता रहा है.",
      urgency: "high",
      summary:
        "Crying boy (~6), says his name is Raju, red cartoon t-shirt, found near the Kapila Sangam bathing area.",
      status: "open",
      createdAt: now - 1000 * 60 * 15,
      photoUrl: null,
    },
    {
      id: "F003",
      category: "person",
      reportType: "found",
      person: {
        nameIfKnown: null,
        ageApprox: "around 40",
        gender: "male",
        heightBuild: "tall, heavy build",
        complexion: "fair",
        clothing: ["white kurta", "saffron scarf"],
        distinguishingFeatures: ["thick black beard"],
        languagesSpoken: ["Hindi", "Gujarati"],
        medicalNotes: null,
      },
      object: null,
      lastSeen: {
        location: "Tapovan parking gate 9",
        sector: "Tapovan Parking",
        time: "an hour ago",
        circumstances: "approached the gate post asking for help finding his group",
      },
      reporter: { name: "Volunteer Sita", phone: "100", relation: "volunteer" },
      detectedLanguage: "Hindi",
      originalText:
        "करीब 40 साल का आदमी, सफेद कुर्ता, अपने ग्रुप से बिछड़ गया, तपोवन पार्किंग गेट पर मदद माँग रहा है.",
      urgency: "medium",
      summary:
        "Man (~40) in a white kurta separated from his group, asking for help at Tapovan parking.",
      status: "open",
      createdAt: now - 1000 * 60 * 60,
      photoUrl: null,
    },
    {
      id: "F004",
      category: "object",
      reportType: "found",
      person: null,
      object: {
        itemType: "phone",
        brand: "Samsung",
        color: "black",
        material: "glass and metal",
        size: "large smartphone",
        distinguishingMarks: ["cracked top-right corner", "blue silicone case"],
        contents: [],
        serialOrIdentifier: null,
        lockOrSecurity: "locked, pattern lock; lock screen shows a baby photo",
        estimatedValue: "high",
      },
      lastSeen: {
        location: "submitted at Ramkund help post",
        sector: "Ramkund / Panchavati",
        time: "20 minutes ago",
        circumstances: "handed in by a pilgrim who found it on the ghat steps",
      },
      reporter: { name: "Volunteer Ravi", phone: "100", relation: "volunteer" },
      detectedLanguage: "Hindi",
      originalText:
        "एक काला सैमसंग फोन रामकुंड घाट पर मिला, ऊपर कोना टूटा है, नीला कवर लगा है, लॉक है.",
      urgency: "high",
      summary:
        "Found black Samsung phone with a cracked corner and blue case, locked, handed in at Ramkund.",
      status: "open",
      createdAt: now - 1000 * 60 * 20,
      photoUrl: null,
    },
  ];
  state.reports.push(...seeds);
  state.counter = 4;
}

seed();
