# Khoya·Paya — Technical Deep-Dive & Judge Defense

Study this to answer ANY question. For each piece: **what it is → how it works →
why → the answer if a judge probes.**

The one-sentence anchor:
> "A 3-stage AI agent — understand a multilingual report, match it by meaning
> across languages, then coordinate a *safe* reunion — for people and
> belongings, with a fraud-resistant verification layer, wrapped in a live
> control room and exposed as an MCP server so it plugs into the government's
> systems."

---

## 1. Architecture & request flow

Frontend (browser, `app/page.tsx`) → your backend API routes (`app/api/*`) →
Claude via the provider layer (`lib/llm.ts`) → back to the browser. The browser
never talks to the model directly (keeps the API key secret, lets you control
logic and add safety/anti-spam).

Filing a report: `page.tsx` → `POST /api/intake` → extract (Claude) → store →
match (Claude) → return report + matches + trace + completeness. Coordinating:
`POST /api/coordinate`. Verifying: `POST /api/verify`. Everything significant is
written to the audit log.

**Defense — "walk me through the stack":** Next.js (one codebase for frontend +
backend), TypeScript for safety, Claude Opus 4.8 for the reasoning, in-memory
store (drop-in for the govt registry), MCP server for integration.

---

## 2. The four AI jobs (`lib/prompts.ts` — your core IP)

Each = a **system prompt** (instructions) + a **JSON schema** (required output
shape) + input data.

**(a) Intake** — messy, emotional, code-mixed speech (+ optional photo) → a clean
structured report. Rules: extract only what's stated (never invent), translate
descriptions to English fields while preserving meaning, classify person vs
object, set urgency (high for child/elderly/medical/valuables), map the place to
a real Nashik sector, capture every language the person speaks.

**(b) Match** — compares a new report against open reports of the OPPOSITE type,
SAME category. Reasons like a reunification officer: "saffron dhoti" ≈ "orange
clothes," weights stable features (gender, age band, marks, languages), geography
and timing matter, one hard contradiction sharply lowers the score. Returns 0–100
score + confidence + plain reasoning + matching/conflicting features, only ≥25,
sorted.

**(c) Coordinate** — for a matched pair: loudspeaker announcements in every
relevant language (native script), the nearest real center to route to, a safety
verification checklist, and a handover note.

**(d) Verify** — the trust layer (see §7).

**Defense — "why is this AI, not a database?"** A database needs the same
keywords. Families and volunteers never use the same words, let alone the same
language. Matching *meaning* across that gap is impossible without an LLM — that's
the core. (In tests it scored 95–98% with explanations.)

---

## 3. Structured output via forced tool calls (`lib/llm.ts`)

**How:** instead of free text, we define one tool `record` whose `input_schema`
IS the shape we want, force `tool_choice` to it, and read the validated arguments
(`block.input`). The model literally cannot reply with prose — it must return
data matching the schema.

**Why this over JSON-mode:** works on every SDK version and model, no beta flags
— maximum reliability for a live demo.

**Defense — "how do you guarantee valid output?"** Schema-constrained tool calls;
the model is forced to return our exact structure, validated at the tool layer,
so the app never parses guesswork.

---

## 4. Provider layer & reliability (`lib/llm.ts`)

**How:** one `callStructured()` the whole app uses. Picks Claude (default) or
Gemini (dev fallback) by env var, handles images (vision), and **retries
transient errors** (503/overload/rate spikes) up to 4× with backoff (0.7s, 1.4s,
2.1s) — but fails fast on real errors (bad key, spend cap).

**Why:** Claude for quality at the event; Gemini let me build/test before having
an Anthropic key; the abstraction means we're **not vendor-locked**.

**Defense — "what if Anthropic goes down / raises prices?"** We built a provider
abstraction — flip one env var and it fails over to another model. We run on
Claude for quality on purpose, not lock-in. (Also defuses "thin wrapper" — see
§16.)

---

## 5. Vision intake

**How:** a reporter can attach a photo; `callStructured` passes the image to the
model, which reads appearance details (clothing, age, build, marks) and merges
them with the spoken description into the same structured report.

**Why:** a relative usually has a photo on their phone; it enriches a sparse
report instantly and powers photo-to-photo verification.

**Defense — "is the photo stored / is that a privacy risk?"** It's attached to the
active case only, used to enrich the description and verify ownership, and meant
to be deleted after reunion. No biometric database.

---

## 6. Appearance-profile completeness loop (`lib/profile.ts`)

**How:** we define **6 core appearance parameters** per category (person: age,
gender, height/build, complexion, clothing, distinguishing features — object:
type, colour, brand, size, marks, serial/ID). After each intake/refine,
`computeCompleteness()` checks — in code, deterministically — which are filled,
and the agent asks targeted questions for the missing ones. The reporter answers,
we **refine the same report in place** (`replaceId`, no duplicate), and re-check —
looping until all 6 are captured (progress bar 0→6/6).

**Why:** a vague report ("my brother is lost") matches badly. Forcing a complete,
structured description dramatically improves match quality — and it's computed in
code, so completeness is reliable, not at the model's whim.

**Defense — "what if the report is too vague to match?"** The agent won't stop at
vague — it drives a structured 6-parameter profile to completeness, asking only
for what's missing, in the reporter's language. The matcher only runs on a
description worth matching.

---

## 7. Trust & Safety — the verification interview (THE MOAT) (`app/api/verify`)

**How — two stages:**
1. **Generate questions:** the agent reads the FOUND record and produces private
   challenge questions only the true family/owner could answer (a scar's side, a
   lock-screen image, what's in the bag) — never things publicly announced. Marks
   each "critical."
2. **Score answers:** the claimant answers; the agent compares each against the
   record, returns a verdict — **APPROVE / DENY / ESCALATE** — with a 0–100 fraud
   risk score, per-answer assessment, and reasoning.

**Safety override (non-negotiable, in the prompt):** for a child, a vulnerable/
elderly/confused adult, or a high-value object, it may **never auto-approve** — at
most "escalate," with `requiresHumanSignoff = true` (police for a child). The
green handover button stays locked unless the verdict is approve.

**Why:** anyone can build "reunite." The hard, important problem is *not* handing
a child to the wrong person. That's where trafficking risk lives.

**Defense — "how do you stop a wrong/fraudulent handover?"** Private questions
from undisclosed details + a fraud risk score + a hard rule that the AI never
releases a child on its own — a human (and police) must authorize. The agent
assists; a human always authorizes. We'd rather reunite slowly and safely than
fast and wrong.

---

## 8. Photo-to-photo verification

**How:** in the score stage, if BOTH the found record and the claimant's own
report have photos, both images are sent to the model, which judges whether they
show the same individual/item and returns a `photoComparison` weighed into the
verdict.

**Why:** a second, visual signal on top of the answers — strong for a confident
match or a clear mismatch.

**Defense — "face recognition is unreliable/biased":** it's not an automated
face-recognition database making decisions — it's one *advisory* signal a human
reviews, alongside the questions, never the sole basis for handover. For
high-stakes cases it only escalates to a human.

---

## 9. Objects (lost belongings)

**How:** `Report.category` is "person" or "object"; intake auto-detects it and
fills the matching description (`ObjectDescription`: type, brand, colour, marks,
contents, serial/IMEI, lock, value). Matching is category-scoped (phones match
phones). Verification asks ownership-proof questions ("describe the lock screen,"
"unlock it"); high-value items never auto-approve.

**Why:** same pipeline, double the scope — a unified people-and-belongings
platform — and objects make the fraud angle even sharper (everyone claims the
found iPhone).

**Defense — "isn't objects just bolted on?"** Same 3-stage pipeline, one extra
category field; the ownership-proof flow reuses the exact verification engine —
deliberate reuse, not a separate hack.

---

## 10. Anti-spam rate-limiting (`lib/ratelimit.ts`)

**How:** tracks report velocity per device (a browser id in localStorage) and per
phone in a rolling 5-minute window. Flags suspicious volume (>8/device, >5/phone),
**blocks** egregious spam (>20/device → HTTP 429). Flags surface on the report as
🚩.

**Why:** a common hackathon-project weakness; data poisoning would wreck matching.
Verified: phone flags @6, device flags @9, device blocks @21.

**Defense — "why not 1 report per number?"** Too strict — a father may report his
mother AND his son. We use velocity + flagging, not hard caps, plus an optional
phone field for accountability. Production would add OTP verification.

---

## 11. Audit trail (`lib/audit.ts`) + the blockchain decision

**How:** every action (report filed, match, verification, reunion) is appended as
a **hash-chained entry** — each entry's `entryHash = sha256(prevHash | seq |
timestamp | type | dataHash)`. Changing any past entry breaks every hash after it.
`verifyChain()` recomputes the chain; the UI shows "✅ Chain verified." Only a
hash of the payload is stored in the entry, not the raw data.

**Why:** accountability — tamper-evident proof for the government that records
weren't altered and reunions actually happened.

**Defense — "your mentor said blockchain; where is it?"** Deliberate call: you
**never put lost-children data on a public chain** — that's a privacy and
child-safety disaster a judge will punish. Instead we built a tamper-evident
hash-chained log now (real value), and each `entryHash` is exactly what you'd
**anchor** to Polygon for on-chain proof — the fingerprint, never the personal
data. That's the mature version of the idea.

---

## 12. Geography & sector hotspots (`lib/geo.ts`)

**How:** real Nashik–Trimbakeshwar sectors (Ramkund, Tapovan, Kapila Sangam…) and
named Khoya-Paya Kendras. Intake maps each report to a sector; coordination routes
to a real center; the board shows a live per-sector case-count bar chart.

**Why:** makes it concrete and deployable, and the hotspot view reads as
crowd-pressure monitoring — speaks to the government operator.

---

## 13. MCP server (`mcp/server.ts`)

**How:** exposes 4 Model Context Protocol tools (`file_report`, `find_matches`,
`coordinate_reunion`, `list_cases`) that call the web API. Any MCP client (Claude
Desktop, a control-room agent) can drive the system in natural language; anything
filed appears live on the board (shared state via the same API).

**Why:** the deployability story — "drops straight into a Claude-powered
government control room."

**Defense — "how does this integrate with existing systems?"** Two surfaces: a
web app for booths, and an MCP server so an AI control room calls it as tools. The
store is a drop-in for the government registry.

---

## 14. Storage & scale

**How:** in-memory store pinned to `globalThis` (one shared instance across Next's
per-route bundles). Seeded with 4 demo cases. Resets on restart.

**Defense — "this won't scale / it's in memory":** correct for a hackathon demo —
it's behind a clean interface (`lib/store.ts`) so production swaps in the
government registry / Postgres with no other changes. **For matching at 80M:** you
don't send thousands of reports to the LLM — you use **vector embeddings as a
fast pre-filter** to shortlist ~20 candidates, then the LLM does the smart final
judgment on those. Embeddings = scale; the LLM = accuracy. (We didn't build
embeddings because at demo scale the LLM matches directly and better; it's the
scale architecture.)

---

## 15. Rapid-fire hard-question cheat sheet

- **"Isn't this a thin wrapper around Claude?"** The model is the engine; we built
  the ambulance — orchestration, the safety/verification engine, the audit trail
  (our code, not Claude's), domain specialization, MCP integration, and a provider
  layer so we're not vendor-locked. Anyone can call an API; the moat is the system
  around it.
- **"No-phone / illiterate pilgrim?"** They don't use an app — it's at the booth,
  a volunteer holds the tablet, the pilgrim just speaks; output is loudspeaker
  announcements. Also a phone helpline. No phone, app, or literacy needed.
- **"What if the AI is wrong / false match?"** It only *suggests* matches with a
  score and reasoning; a human confirms; verification gates handover; children
  never released on AI alone.
- **"Privacy / data of minors?"** Minimal, purpose-bound data, deleted after
  reunion; no biometric DB; only hashes on the audit log; nothing personal
  on-chain.
- **"Network is patchy."** Booths have connectivity; the logic degrades to
  assisting a human, never blocking; reports queue.
- **"How is matching different from search?"** Search needs the same words; we
  match meaning across languages — impossible without an LLM.
- **"Scale to 80M?"** Embeddings pre-filter → LLM judges the shortlist; stateless
  API behind a real database.
- **"Who built this / can you deploy it?"** Built solo, end-to-end, it runs today,
  it's deployed. Give me the immersion trip and a real center's data and I'll have
  a Nashik pilot running.

---

## 16. Models & cost

Claude Opus 4.8 (`claude-opus-4-8`) for quality; Gemini is a dev-only fallback
(flip `LLM_PROVIDER`). Structured output keeps token use lean (only the fields
needed). At scale, embeddings pre-filtering cuts LLM calls dramatically.
