# Khoya·Paya — a reunification agent for Kumbh Mela 2027

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Claude](https://img.shields.io/badge/Model-Claude%20Opus%204.8-d97757)
![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-server-6E40C9)
![Polygon](https://img.shields.io/badge/Anchoring-Polygon-8247E5?logo=polygon&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

> Built for the **Claude Impact Lab** (Kumbhathon Innovation Foundation × Claude India).
> Problem area: **Multilingual Communication Systems / Agentic AI for Administration.**

At the Kumbh Mela, **thousands of people are separated from their families every
day** — elderly pilgrims, children, people who speak only a regional dialect and
often carry no phone. Today the "system" is volunteers shouting names over
loudspeakers and handwritten registers at ~10 *Khoya-Paya* (lost-and-found)
centers that can't talk to each other.

**Khoya·Paya** turns that into an agentic pipeline powered by Claude (Opus 4.8):

1. **Intake** — a pilgrim describes the lost (or found) person in *their own
   language* — Hindi, Marathi, Bhojpuri, English, or a code-mixed blend, by
   voice or text. Claude extracts a clean, structured report — handling messy,
   emotional, informal speech.
2. **Match** — when a report arrives, Claude **semantically** compares it against
   all open reports of the opposite type. It knows "saffron dhoti" ≈ "orange
   traditional clothes" and that "around 70" ≈ "elderly, maybe 65" — fuzzy,
   cross-lingual matching no keyword search or human eye can do at this scale.
3. **Coordinate** — on a likely match, the agent drafts **loudspeaker
   announcements in every relevant language**, routes to the nearest center, and
   generates a **safety verification checklist** that must be confirmed before a
   child or elderly person is handed over.

It's deployable with nothing more than a phone and a help booth — which is
exactly why it can actually run at the mela.

---

## Why this design

Judged on **real-world impact, technical execution, creativity, and
deployability** — Khoya·Paya is built to score on all four:

- **Impact** — life-or-death, and every government official in the room knows the problem.
- **Deployability** — works on existing infrastructure (a phone, a booth, a loudspeaker). The in-memory store is a drop-in for the government's registry.
- **Technical execution** — voice → structured reasoning → semantic matching → multilingual generation is a genuine Claude showcase, using forced-tool structured output for reliable JSON.
- **Creativity** — the safety-verification step (don't hand a child to the wrong adult) is the kind of detail that shows real domain thinking.

---

## Capabilities

- **Multilingual voice + text intake** — Hindi, Marathi, Bhojpuri, English, code-mixed.
- **Vision intake** — attach a photo (a relative's phone snap) and Claude reads it *with* the spoken description to build a richer report.
- **Unified people *and* belongings** — the same pipeline handles lost/found persons and objects (phones, wallets, bags). The agent auto-detects the category; high-value items get the strict claim flow.
- **Semantic cross-lingual matching** with scored, explained candidates (people *and* objects — "dark phone" ≈ "black mobile").
- **Multilingual reunion coordination** — loudspeaker announcements per language + routing + a safety verification checklist.
- **Trust & Safety — AI verification interview** — before any handover, the agent generates private challenge questions only the genuine family/owner could answer (from the found record), scores the claimant's answers with a fraud-risk score, and **refuses to release a child or vulnerable adult on AI alone** (forces human/police sign-off). This is what stops a wrong or fraudulent handover.
- **Proof-of-Reunion anchoring** — each confirmed reunion can be anchored on **Polygon** for a tamper-evident audit trail (`lib/chain.ts`, `app/api/anchor`).
- **Live agent activity trace** — shows the steps the agent took on each report.
- **Provider layer** — Claude by default (what you demo/submit); a clearly-flagged Gemini dev fallback for local testing before you have an Anthropic key. A header badge turns **red** on Gemini so you never demo on the wrong model.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| AI | `@anthropic-ai/sdk` (Claude Opus 4.8), `@google/genai` (dev fallback) |
| Agent interface | `@modelcontextprotocol/sdk` (MCP server) |
| Validation | Zod (forced-tool structured output) |
| On-chain | `ethers` (Polygon anchoring) |
| Styling | Tailwind CSS |

## Run it

```bash
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY (or the Gemini dev fallback)
npm install
npm run dev                        # http://localhost:3000
```

> **Demo on Claude.** Gemini is dev-only — set `LLM_PROVIDER=gemini` + `GEMINI_API_KEY`
> to test the pipeline today, then remove it before the event. The header badge
> shows which provider is live.

## 3-minute demo script

1. The board already shows 3 **found** people filed by volunteers (an elderly
   woman in an orange saree at Ram Ghat, a crying boy "Raju", a man at the
   parking gate).
2. Click **🧓 Lost mother (Hindi)** → **Process report**. Claude structures the
   Hindi input into a clean report and **flags a high-confidence match with
   F001**, explaining *why* ("orange saree ≈ narangi saree, both elderly women
   near Ram Ghat, both speak Bhojpuri").
3. Click **Coordinate reunion** → Claude produces **loudspeaker announcements in
   Hindi + Bhojpuri**, routes to the Ram Ghat center, and lists the
   **verification questions** staff must ask before handover.
4. Click **Mark reunited** → the reunion counter ticks up.
5. (Optional) Hit **🎤 Speak** and say the lost-child case out loud to show live
   voice intake.

> A scene-by-scene recording script for a 30–90s video lives in [`demo-script.md`](./demo-script.md).

---

## MCP server — plug into any Claude client

The whole system is also exposed as a **Model Context Protocol server**
([mcp/server.ts](mcp/server.ts)), so any MCP client — Claude Desktop, a
government control-room agent, an ops dashboard — can run the reunification
system through natural language. Because the tools call the running web app's
API, anything an agent files shows up **live on the control-room board**.

Tools: `file_report`, `find_matches`, `coordinate_reunion`, `list_cases`.

```bash
npm run dev    # the web app must be running (the MCP tools call its API)
npm run mcp    # start the MCP server (stdio)
```

To wire it into **Claude Desktop**, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "khoya-paya": {
      "command": "npx",
      "args": ["tsx", "<absolute-path-to-project>/mcp/server.ts"],
      "env": { "KHOYA_BASE_URL": "http://localhost:3000" }
    }
  }
}
```

Then ask Claude: *"A man at Tapovan parking lost his elderly mother in an orange
saree near Ramkund — file it and find matches,"* and watch the case appear on
the board and a 95% match come back. **This is the deployability story: it drops
straight into a Claude-powered control room.**

## Architecture

```
Browser (voice / text, any language)
        │
        ▼
/api/intake ──► Claude: extract structured report  ──► store
        │
        └────► Claude: semantically match vs open opposite-type reports
                        │
                        ▼
/api/coordinate ──► Claude: multilingual announcements + safety checklist + routing
                        │
                        ▼
/api/anchor ──► Polygon: tamper-evident Proof-of-Reunion
```

| File | Role |
|---|---|
| `lib/prompts.ts` | The three agent prompts + JSON schemas (the core IP) |
| `lib/anthropic.ts` | Claude client + `callStructured` (forced-tool structured output) |
| `lib/store.ts` | In-memory report store, seeded with realistic demo cases |
| `lib/chain.ts` / `lib/audit.ts` | Polygon anchoring + audit trail |
| `mcp/server.ts` | MCP server exposing the pipeline as tools |
| `app/api/*` | Intake, match, coordinate, anchor, verify, board endpoints |
| `app/page.tsx` | Help-booth intake + live control-room board |

> Model: `claude-opus-4-8`. Structured output via forced tool calls for
> reliable JSON on any SDK version.

## 🖼️ Screenshots

> _Add screenshots / GIFs here._
> - `docs/board.png` — live control-room board
> - `docs/intake.png` — multilingual voice/text intake
> - `docs/match.png` — Claude's explained semantic match
> - `docs/coordinate.png` — generated loudspeaker announcements + safety checklist

## 🗺️ Roadmap

**Production path (post-hackathon, via Kumbhathon incubation):**

- [ ] Swap the in-memory store for the government registry
- [ ] Wire announcements to the real loudspeaker/PA and SMS systems
- [ ] Expand photo / face-assisted matching
- [ ] Offline-first mode for low-connectivity ghats
- [ ] Multi-center dashboard with role-based access for staff & police
- [ ] Hosted MCP server so it plugs into a Claude-powered control room out of the box

## 📚 Lessons Learned

- **Structured output is non-negotiable for agents that take real actions.** Forcing Claude through tool calls + Zod schemas (instead of parsing free text) made the pipeline reliable enough to demo live — and would be safe enough to deploy.
- **Designing for *deployability* changes the architecture.** Building around "a phone, a booth, a loudspeaker" instead of fancy infra is what makes this actually runnable at a mela of 80M+ people.
- **Safety is a feature, not an afterthought.** The verification-interview + human-sign-off flow came from asking "what's the worst thing this system could do?" — handing a child to the wrong adult — and designing to prevent it.

## 📬 Contact

Built by **Harsh Agrawal** — [GitHub @callmeharshh](https://github.com/callmeharshh)
Open to Agentic AI / Founder's Office internships. Issues and PRs welcome.

---

> ⚖️ MIT licensed.
