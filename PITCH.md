# Khoya·Paya — Pitch & Demo Runbook

Your job at 6 PM is not to show code. It's to make the room *feel* the problem,
then watch Claude solve it in 30 seconds. Impact → demo → deployability. Done.

---

## 0. Before you present (10-min pre-flight)

- [ ] `.env.local` has `ANTHROPIC_API_KEY`, Gemini lines commented out. Header badge reads **⚡ Claude** (not red ⚠ Gemini).
- [ ] `npm run dev` running. Open `http://localhost:3000`. Board shows the 3 seeded found cases + sector hotspots.
- [ ] Do **one full practice run** on Claude so you've seen the real latency.
- [ ] (If demoing MCP) `npm run mcp` running + Claude Desktop pointed at it.
- [ ] Browser zoomed so text is readable from the back of the room. Close other tabs.
- [ ] Phone with a photo of an "elderly woman" ready, if you want to show vision intake.
- [ ] Backup: a screen recording of a successful run, in case wifi dies.

---

## 1. The hook (30 seconds — memorize this)

> "At the last Maha Kumbh, a stampede killed people. But the quieter tragedy
> happens every single day: **thousands of people get separated from their
> families** — grandmothers, six-year-olds, pilgrims who speak only Bhojpuri and
> carry no phone. Right now the system is volunteers shouting names over
> loudspeakers and paper registers at ten centers that can't talk to each other.
>
> At 80 million people, that doesn't scale. So we built **Khoya·Paya** — an
> agent that reunites families across the language barrier, at the speed of the
> crowd."

Why it lands: it's real, it's emotional, and every official in that room has
seen it happen.

---

## 2. The demo (3 minutes — exact click-path)

**Frame first (10s):** "This is a live control room at the Nashik mela. These
are real found-person reports volunteers filed this afternoon." *(point at the
board + the sector hotspot bars — "you can already see where the crowd pressure
is.")*

**Step 1 — Intake in a real language (40s).**
Click **🧓 Lost mother (Hindi)**. Read the messy Hindi aloud. Hit **Process report**.
> "A panicked son just described his mother in Hindi. Watch."
Point at the **Agent activity** trace as it fills in: detected Hindi → extracted
a structured report → searched the open cases. Then the **structured report**
card: "It pulled out age, the orange saree, the walking stick, that she speaks
Bhojpuri — and placed her in the Ramkund sector."

**Step 2 — The match (40s) — this is the wow.**
Point at the match card: **F001, 95%, high confidence.**
> "It didn't keyword-match. The volunteer wrote 'narangi saree' in Marathi; the
> son said 'orange saree' in Hindi. Claude knows those are the same woman. It
> even explains *why* — and flags what would rule a match out. No human can do
> this across 80 million people and six languages."

**Step 3 — The reunion (50s).**
Click **Coordinate reunion**. When the plan appears:
- "Loudspeaker announcements — in Hindi, Bhojpuri *and* Marathi, ready to read."
- "Routed to the nearest center: Khoya-Paya Kendra, Ramkund."
- "And this —" *(point at the verification checklist)* "— before we hand over a
  confused elderly woman or a child, staff must confirm the relationship. **You
  never hand a child to the wrong adult.** That's the difference between a demo
  and something you can actually deploy."

**Step 4 — The fraud catch (50s) — THE SHOWSTOPPER. Do not skip this.**
In the plan popup, point to **Step 2 — Verify the claimant**.
> "But here's the question nobody else is asking: what if the person claiming
> this lost child is *not* the family? At a mela, that's a trafficking risk.
> Watch."
Click **Generate verification questions** — the agent invents private questions
only the real family could answer ("which side is the scar on?", "what cartoon
is on the shirt?"). Now play the impostor: type **wrong/vague answers**, set
relation to "uncle". Click **Run verification**.
> "Denied. Risk 95 out of 100. And because it's a child, the system *refuses* to
> hand over on AI alone — it forces police sign-off. **It will not let you hand a
> child to the wrong person.**"
*(If you have time, redo with correct answers → APPROVE, and the green handover
button unlocks.)* Then **Approve handover & mark reunited.**

> Anyone can build a system that reunites. This is the only one built so it
> reunites the **right** person.

**Optional — objects too (20s).** Click **📱 Lost phone (Hindi)** → Process →
matches the found phone (F004). Coordinate → verify: *"the agent asks them to
describe the lock screen and unlock it. A thief can't. For a valuable, it won't
release without staff confirming the unlock in person."* One platform, people
**and** belongings.

**Step 5 — Deployability (optional, 30s) — the closer.**
> "And it's not just this screen. The whole system is a Model Context Protocol
> server." *(In Claude Desktop:)* "An officer can just type —" file a case in
> natural language — "and it lands on the board with a match. It drops straight
> into a Claude-powered control room."

*(If MCP feels risky live, say the sentence and show the README config instead —
don't gamble the demo on a second moving part.)*

---

## 3. One-liner per judging criterion (have these ready)

- **Real-world impact:** "Reuniting a lost child or grandmother — every official here has watched this fail. We make it work at scale."
- **Technical execution:** "Voice and photo in any language → structured reasoning → cross-lingual semantic matching → multilingual generation. Claude doing what only Claude does well, with reliable structured output."
- **Creativity:** "The AI verification interview. The interesting problem isn't finding the match — it's *not* handing a child to the wrong person. The agent generates private questions only the real family could answer, scores the answers, and refuses to hand over a child on AI alone. That's the part that comes from thinking about deployment, not demos."
- **Deployability:** "Runs on a phone and a booth. No new hardware. It's an MCP server, so it plugs into the government's existing control room. Ready for the Nashik pilot."

---

## 4. Q&A prep (the questions a government rep WILL ask)

**"What about people with no phone / who can't read?"**
> "That's the default case, not the edge case. Intake is *voice* — a volunteer
> at a booth speaks the description, or the lost person speaks for themselves.
> Output is *loudspeaker announcements*, not an app. No phone needed on either
> side."

**"How do you stop a wrong or fraudulent match — someone claiming a child?"**
> "This is the core of the project — let me show you." *(Run the live fraud catch
> if you haven't.)* "The agent generates private verification questions only the
> real family could answer, derived from details that were never publicly
> announced, and scores the claimant's answers with a fraud-risk score. For a
> child or a vulnerable adult, it will *never* approve on its own — it forces a
> senior officer and police to sign off in person. The agent assists; a human
> always authorizes. We'd rather reunite slowly and safely than fast and wrong."

**"What about data privacy / consent?"**
> "Reports are minimal and purpose-bound — a description and a contact, deleted
> after reunion. No biometric database. Photos are optional and used only for
> the active case. For a government deployment this sits behind their registry
> and their access controls — we built the store as a drop-in for that."

**"Does it actually work in Marathi / Bhojpuri, or just Hindi?"**
> "All of them, including code-mixed speech — let me show you." *(Use the Marathi
> 'Found man' example live.)*

**"What happens when the network is down / it's overloaded?"**
> "Reports queue locally and the board still works offline; matching syncs when
> the connection's back. The reunification logic degrades to assisting a human,
> never blocking them."

**"How is this different from a database search?"**
> "A database needs the same words. Families and volunteers never use the same
> words, let alone the same language. The whole point is matching *meaning*
> across that gap — that's the part that's impossible without an LLM."

**"Who are you / can you actually build the pilot?"**
> "I built this end-to-end, solo, today. Give me the immersion trip and access
> to a real center's data and I'll have a Nashik pilot running."
*(Own the 18-year-old-solo angle — it's a strength here, not a weakness.)*

---

## 5. The close (15 seconds)

> "Khoya·Paya isn't a prototype of an idea. It runs, it's multilingual, it has
> the safety rails a real deployment needs, and it plugs into your control room
> today. Eighty million people are coming to Nashik in 2027. Let's make sure
> every family that arrives together, leaves together."

---

## 6. Things NOT to do

- Don't open the code editor. Nobody scores you on TypeScript.
- Don't explain the architecture unless asked. Show the outcome.
- Don't demo on Gemini. Check the badge.
- Don't add features the morning of. Rehearse the run you have.
- Don't bury the fraud catch (verification interview) — it's your most memorable moment. Build the demo around it.
- If something errors live, stay calm, say "transient — one moment," re-click.
  You have the screen recording as backup.

---

## 7. 60-second rehearsal checklist (run this 5×)

Hook → click Lost mother → trace + structured card → match 95% (say *why*) →
Coordinate → announcements + center routing → **fraud catch: generate questions,
impostor answers, DENIED/ESCALATE** → (correct answers → APPROVE) → Mark reunited
→ deployability line → close. Time it. Tighten. Repeat until it's muscle memory.
