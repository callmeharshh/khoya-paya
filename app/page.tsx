"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CoordinationPlan,
  MatchCandidate,
  Report,
  VerificationQuestion,
  VerificationVerdict,
} from "@/lib/types";

// Quick-fill demo scripts — let a presenter populate realistic, multilingual
// reports with one click during the live demo.
const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "🧓 Lost mother (Hindi)",
    text: "Meri maa kho gayi hai, woh 70 saal ki hain, narangi rang ki saree pehni hai, lathi lekar chalti hain, theek se sun nahi paati. Ramkund ke paas bichhad gaye. Main Bhojpuri aur Hindi bolta hoon.",
  },
  {
    label: "👦 Lost child (Hindi)",
    text: "Mera beta Raju gum ho gaya, 6 saal ka hai, laal cartoon wali t-shirt aur neeli shorts pehni hai, bायीं भौंह पर छोटा निशान है. Kapila Sangam ke paas bheed mein chhoot gaya.",
  },
  {
    label: "🧔 Found man (Marathi)",
    text: "Ek 40 varshacha manus Tapovan parking javal sapadla, pandhra kurta ghatlay, tyacha group harvla aahe, Gujarati ani Hindi bolto.",
  },
  {
    label: "📱 Lost phone (Hindi)",
    text: "Mera phone kho gaya — kaala Samsung, upar daayein kona thoda toota hua hai, neela cover laga hai. Lock hai, lock screen pe mere bacche ki photo hai. Ramkund ke paas gira.",
  },
];

export default function Home() {
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<Report | null>(null);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [trace, setTrace] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [plan, setPlan] = useState<CoordinationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Trust & Safety: claimant verification
  const [activeFoundId, setActiveFoundId] = useState<string | null>(null);
  const [vQuestions, setVQuestions] = useState<VerificationQuestion[]>([]);
  const [vAnswers, setVAnswers] = useState<Record<string, string>>({});
  const [vRelation, setVRelation] = useState("");
  const [vVerdict, setVVerdict] = useState<VerificationVerdict | null>(null);
  const [vLoading, setVLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Anti-spam device id, optional reporter phone, conversational follow-ups
  const [deviceId, setDeviceId] = useState("");
  const [phone, setPhone] = useState("");
  const [completeness, setCompleteness] = useState<{
    total: number;
    filledCount: number;
    complete: boolean;
    captured: string[];
    missing: { field: string; label: string; question: string }[];
  } | null>(null);
  const [refineText, setRefineText] = useState("");
  const [activeLostId, setActiveLostId] = useState<string | null>(null);

  // Audit trail
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<{
    entries: any[];
    chainValid: boolean;
    anchors?: any[];
    chainConfigured?: boolean;
    network?: string;
  }>({ entries: [], chainValid: true });
  const [anchoring, setAnchoring] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState<string | null>(null);

  async function anchorChain() {
    setAnchoring(true);
    setAnchorMsg(null);
    try {
      const res = await fetch("/api/anchor", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.result?.configured === false) {
        setAnchorMsg(data.result.error);
      } else if (data.result?.error) {
        setAnchorMsg("On-chain error: " + data.result.error);
      } else {
        setAnchorMsg(`✅ Anchored on-chain in block ${data.result.blockNumber}`);
      }
      await loadAudit();
    } catch (e) {
      setAnchorMsg(e instanceof Error ? e.message : "Anchor failed");
    } finally {
      setAnchoring(false);
    }
  }

  // Stable per-browser device id for rate-limiting (persisted locally).
  useEffect(() => {
    let id = localStorage.getItem("khoya-device");
    if (!id) {
      id = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("khoya-device", id);
    }
    setDeviceId(id);
  }, []);

  async function loadAudit() {
    const res = await fetch("/api/audit");
    setAudit(await res.json());
  }

  function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function loadReports() {
    const res = await fetch("/api/reports");
    const data = await res.json();
    setReports(data.reports);
    setProvider(data.provider);
    if (data.model) setModel(data.model);
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function submit() {
    if (!text.trim() && !photoUrl) return;
    setLoading(true);
    setError(null);
    setMatches([]);
    setLastReport(null);
    setTrace([]);
    setCompleteness(null);
    setRefineText("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageDataUrl: photoUrl, deviceId, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLastReport(data.report);
      setMatches(data.matches);
      setTrace(data.trace || []);
      setCompleteness(data.completeness || null);
      setModel(data.model || null);
      setText("");
      setPhotoUrl(null);
      loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Conversational refine: append the reporter's extra detail and re-extract the
  // SAME report in place (no duplicate), then re-match.
  async function refine() {
    if (!lastReport || !refineText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const combined = `${lastReport.originalText}\n\nAdditional details: ${refineText}`;
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combined, replaceId: lastReport.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLastReport(data.report);
      setMatches(data.matches);
      setTrace(data.trace || []);
      setCompleteness(data.completeness || null);
      setRefineText("");
      loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refine failed");
    } finally {
      setLoading(false);
    }
  }

  function resetVerification() {
    setVQuestions([]);
    setVAnswers({});
    setVRelation("");
    setVVerdict(null);
  }

  function closePlan() {
    setPlan(null);
    setActiveFoundId(null);
    resetVerification();
  }

  async function genQuestions() {
    if (!activeFoundId) return;
    setVLoading(true);
    setVVerdict(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: activeFoundId, stage: "questions" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setVQuestions(data.questions || []);
      setVAnswers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVLoading(false);
    }
  }

  async function runVerification() {
    if (!activeFoundId) return;
    setVLoading(true);
    try {
      const answers = vQuestions.map((q) => ({
        question: q.question,
        answer: vAnswers[q.id] || "",
      }));
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: activeFoundId,
          stage: "score",
          answers,
          claimantRelation: vRelation,
          claimantReportId: activeLostId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setVVerdict(data.verdict);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVLoading(false);
    }
  }

  async function coordinate(match: MatchCandidate) {
    if (!lastReport) return;
    setPlanLoading(true);
    setPlan(null);
    resetVerification();
    const lostId =
      lastReport.reportType === "lost" ? lastReport.id : match.reportId;
    const foundId =
      lastReport.reportType === "found" ? lastReport.id : match.reportId;
    setActiveFoundId(foundId);
    setActiveLostId(lostId);
    try {
      const res = await fetch("/api/coordinate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lostId, foundId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coordination failed");
    } finally {
      setPlanLoading(false);
    }
  }

  async function reunite(id: string) {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reunite" }),
    });
    setPlan(null);
    loadReports();
  }

  // Browser speech-to-text — works offline-ish for the demo. Falls back to text.
  function toggleVoice() {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      setError("Voice input isn't supported in this browser — type instead.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "hi-IN"; // Hindi; the model handles any language regardless
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setText(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const openCount = reports.filter((r) => r.status === "open").length;
  const reunitedCount = reports.filter((r) => r.status === "reunited").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="font-display text-4xl font-bold text-kumbh-deep">
            Khoya<span className="text-kumbh-saffron">·</span>Paya
          </h1>
          <div className="flex items-center gap-4 text-sm">
            {provider && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  provider === "claude"
                    ? "bg-kumbh-saffron/15 text-kumbh-saffron"
                    : "bg-red-100 text-red-700"
                }`}
                title={
                  provider === "claude"
                    ? "Running on Claude — ready to demo"
                    : "DEV MODE: Gemini. Switch LLM_PROVIDER=claude before the event!"
                }
              >
                {provider === "claude"
                  ? `⚡ Claude`
                  : `⚠ Gemini (dev)`}
              </span>
            )}
            <Stat label="Open cases" value={openCount} />
            <Stat label="Reunited today" value={reunitedCount} accent />
            <button
              onClick={() => {
                loadAudit();
                setAuditOpen(true);
              }}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
              title="Tamper-evident, hash-chained record of every action"
            >
              🔗 Audit trail
            </button>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-kumbh-deep/70">
          A multilingual reunification agent for Simhastha Kumbh 2027. Describe a
          lost or found person in any language — Claude structures it, finds
          matches across the mela, and coordinates the reunion.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT — intake */}
        <section className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-1 font-display text-lg font-semibold">
              Report at the help booth
            </h2>
            <p className="mb-3 text-sm text-kumbh-deep/60">
              Speak or type in Hindi, Marathi, Bhojpuri, or English.
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setText(ex.text)}
                  className="rounded-full border border-black/10 bg-kumbh-sand px-3 py-1 text-xs hover:bg-black/5"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="e.g. Meri maa kho gayi hai, narangi saree, 70 saal..."
              className="w-full resize-none rounded-lg border border-black/15 bg-white p-3 text-sm outline-none focus:border-kumbh-saffron"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your phone (optional — adds accountability, curbs spam)"
              className="mt-2 w-full rounded-lg border border-black/15 bg-white p-2 text-sm outline-none focus:border-kumbh-saffron"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={submit}
                disabled={loading || (!text.trim() && !photoUrl)}
                className="rounded-lg bg-kumbh-saffron px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {loading ? "Processing…" : "Process report"}
              </button>
              <button
                onClick={toggleVoice}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  listening
                    ? "border-red-400 bg-red-50 text-red-600"
                    : "border-black/15"
                }`}
              >
                {listening ? "● Listening…" : "🎤 Speak"}
              </button>
              <label className="cursor-pointer rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-black/5">
                📷 Attach photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhotoPick}
                  className="hidden"
                />
              </label>
              {photoUrl && (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt="attached"
                    className="h-10 w-10 rounded object-cover"
                  />
                  <button
                    onClick={() => setPhotoUrl(null)}
                    className="text-xs text-red-600"
                  >
                    remove
                  </button>
                </div>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          {/* Agent activity trace */}
          {trace.length > 0 && (
            <div className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Agent activity</h3>
                {model && (
                  <span className="rounded bg-black/5 px-2 py-0.5 font-mono text-[10px] text-kumbh-deep/60">
                    {model}
                  </span>
                )}
              </div>
              <ol className="space-y-1.5">
                {trace.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-kumbh-deep/30">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Structured extraction result */}
          {lastReport && (
            <div className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Structured report</h3>
                <Badge type={lastReport.reportType} urgency={lastReport.urgency} />
              </div>
              {lastReport.trustFlags && lastReport.trustFlags.length > 0 && (
                <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  🚩 Flagged for review: {lastReport.trustFlags.join(" ")}
                </p>
              )}
              <ReportCard report={lastReport} />
            </div>
          )}

          {/* Structured appearance profile — loop until all params captured */}
          {lastReport && completeness && (
            <div
              className={`card border-l-4 p-5 ${
                completeness.complete
                  ? "border-l-green-500"
                  : "border-l-kumbh-river"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">
                  📋 Appearance profile
                </h3>
                <span
                  className={`text-sm font-semibold ${
                    completeness.complete ? "text-green-600" : "text-kumbh-river"
                  }`}
                >
                  {completeness.filledCount}/{completeness.total} captured
                </span>
              </div>

              {/* progress bar */}
              <div className="mb-3 h-2 w-full overflow-hidden rounded bg-black/10">
                <div
                  className={`h-full rounded ${
                    completeness.complete ? "bg-green-500" : "bg-kumbh-river"
                  }`}
                  style={{
                    width: `${(completeness.filledCount / completeness.total) * 100}%`,
                  }}
                />
              </div>

              {completeness.complete ? (
                <p className="text-sm text-green-700">
                  ✅ Complete description — all {completeness.total} core details
                  captured. Ready to match with confidence.
                </p>
              ) : (
                <>
                  <p className="mb-1 text-sm text-kumbh-deep/70">
                    Still need:{" "}
                    <span className="font-medium">
                      {completeness.missing.map((m) => m.label).join(", ")}
                    </span>
                  </p>
                  <ul className="mb-3 list-inside list-disc space-y-1 text-sm">
                    {completeness.missing.map((m) => (
                      <li key={m.field}>{m.question}</li>
                    ))}
                  </ul>
                  <textarea
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    rows={2}
                    placeholder="Answer here (any language) — e.g. orange saree, ~70, walks with a stick…"
                    className="w-full resize-none rounded-lg border border-black/15 p-2 text-sm outline-none focus:border-kumbh-river"
                  />
                  <button
                    onClick={refine}
                    disabled={loading || !refineText.trim()}
                    className="mt-2 rounded-lg bg-kumbh-river px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {loading ? "Updating…" : "Add details & continue"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Match suggestions */}
          {lastReport && (
            <div className="card p-5">
              <h3 className="mb-3 font-semibold">
                Match suggestions{" "}
                <span className="text-sm font-normal text-kumbh-deep/50">
                  ({matches.length})
                </span>
              </h3>
              {matches.length === 0 && (
                <p className="text-sm text-kumbh-deep/60">
                  No likely matches among open reports yet. This report is now on
                  the board.
                </p>
              )}
              <div className="space-y-3">
                {matches.map((m) => (
                  <MatchCardView
                    key={m.reportId}
                    match={m}
                    candidate={reports.find((r) => r.id === m.reportId)}
                    onCoordinate={() => coordinate(m)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT — control room board */}
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">
            Control room — live board
          </h2>

          <SectorHotspots reports={reports} />

          <div className="space-y-2 max-h-[64vh] overflow-y-auto pr-1">
            {reports.map((r) => (
              <div
                key={r.id}
                className={`rounded-lg border p-3 text-sm ${
                  r.status === "reunited"
                    ? "border-green-300 bg-green-50 opacity-70"
                    : "border-black/10 bg-kumbh-sand"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-kumbh-deep/50">
                    {r.id}
                  </span>
                  <Badge type={r.reportType} urgency={r.urgency} small />
                </div>
                <div className="mt-1 flex gap-2">
                  {r.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photoUrl}
                      alt=""
                      className="h-12 w-12 flex-shrink-0 rounded object-cover"
                    />
                  )}
                  <p>
                    <span className="mr-1">
                      {r.category === "object" ? "📦" : "🧍"}
                    </span>
                    {r.summary}
                  </p>
                </div>
                <p className="mt-1 text-xs text-kumbh-deep/50">
                  📍 {r.lastSeen.location ?? "unknown"} · 🗣 {r.detectedLanguage}
                  {r.status === "reunited" && " · ✅ reunited"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Coordination plan overlay */}
      {(plan || planLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">
                Reunion coordination plan
              </h3>
              <button
                onClick={closePlan}
                className="text-kumbh-deep/40 hover:text-kumbh-deep"
              >
                ✕
              </button>
            </div>

            {planLoading && (
              <p className="text-sm text-kumbh-deep/60">
                Drafting multilingual announcements and a safety checklist…
              </p>
            )}

            {plan && (
              <div className="space-y-5">
                <div className="rounded-lg bg-kumbh-sand p-3 text-sm">
                  <span className="font-semibold">Routed to:</span>{" "}
                  {plan.routedCenter}
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">📢 Loudspeaker announcements</h4>
                  <div className="space-y-2">
                    {plan.announcements.map((a, i) => (
                      <div key={i} className="rounded-lg border border-black/10 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-kumbh-river">
                          {a.language}
                        </div>
                        <p className="text-sm">{a.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    ✅ Verification before handover
                  </h4>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {plan.verificationChecklist.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <p className="rounded-lg bg-amber-50 p-3 text-sm">
                  <span className="font-semibold">Handover note:</span>{" "}
                  {plan.handoverNote}
                </p>

                {/* Trust & Safety: claimant verification */}
                <div className="rounded-lg border-2 border-kumbh-river/30 p-4">
                  <h4 className="mb-1 font-semibold">
                    🛡 Step 2 — Verify the claimant before handover
                  </h4>
                  <p className="mb-3 text-xs text-kumbh-deep/60">
                    Confirm the person claiming this match is the genuine family /
                    owner. The agent asks private questions only they could
                    answer — preventing a wrong or unsafe handover.
                  </p>

                  {vQuestions.length === 0 && !vVerdict && (
                    <button
                      onClick={genQuestions}
                      disabled={vLoading}
                      className="rounded-lg bg-kumbh-river px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {vLoading ? "Generating…" : "Generate verification questions"}
                    </button>
                  )}

                  {vQuestions.length > 0 && (
                    <div className="space-y-3">
                      <input
                        value={vRelation}
                        onChange={(e) => setVRelation(e.target.value)}
                        placeholder="Claimant's stated relationship (e.g. son, owner)"
                        className="w-full rounded border border-black/15 p-2 text-sm outline-none focus:border-kumbh-river"
                      />
                      {vQuestions.map((q) => (
                        <div key={q.id}>
                          <label className="flex items-center gap-2 text-sm font-medium">
                            {q.question}
                            {q.critical && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                CRITICAL
                              </span>
                            )}
                          </label>
                          <input
                            value={vAnswers[q.id] || ""}
                            onChange={(e) =>
                              setVAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                            }
                            placeholder="Claimant's answer…"
                            className="mt-1 w-full rounded border border-black/15 p-2 text-sm outline-none focus:border-kumbh-river"
                          />
                        </div>
                      ))}
                      <button
                        onClick={runVerification}
                        disabled={vLoading}
                        className="rounded-lg bg-kumbh-river px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        {vLoading ? "Verifying…" : "Run verification"}
                      </button>
                    </div>
                  )}

                  {vVerdict && <VerdictBanner v={vVerdict} />}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closePlan}
                    className="rounded-lg border border-black/15 px-4 py-2 text-sm"
                  >
                    Close
                  </button>
                  {lastReport &&
                    (vVerdict?.verdict === "approve" ? (
                      <button
                        onClick={() => reunite(lastReport.id)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Approve handover & mark reunited ✅
                      </button>
                    ) : vVerdict?.verdict === "escalate" ? (
                      <button
                        onClick={() => reunite(lastReport.id)}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                        title="Requires senior-staff / police sign-off"
                      >
                        Override with staff sign-off →
                      </button>
                    ) : (
                      <button
                        disabled
                        className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-white"
                        title={
                          vVerdict
                            ? "Handover blocked — verification failed"
                            : "Verify the claimant first"
                        }
                      >
                        {vVerdict ? "Handover blocked 🚫" : "Verify before handover"}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit trail overlay */}
      {auditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">
                🔗 Audit trail
              </h3>
              <button
                onClick={() => setAuditOpen(false)}
                className="text-kumbh-deep/40 hover:text-kumbh-deep"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-kumbh-deep/60">
              Every action is a hash-chained, tamper-evident entry. Each hash can
              be anchored to a public chain (e.g. Polygon) for on-chain proof —
              without putting any personal data on the ledger.
            </p>
            <div
              className={`mb-3 inline-block rounded px-2 py-1 text-xs font-semibold ${
                audit.chainValid
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {audit.chainValid
                ? "✅ Chain verified — no tampering"
                : "❌ Chain broken — tampering detected"}
            </div>

            {/* Polygon anchoring — notarize the chain head on-chain */}
            <div className="mb-4 rounded-lg border border-kumbh-river/30 bg-kumbh-sand p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  ⛓ Polygon anchor{" "}
                  <span className="font-normal text-kumbh-deep/50">
                    ({audit.network || "testnet"})
                  </span>
                </span>
                <button
                  onClick={anchorChain}
                  disabled={anchoring}
                  className="rounded-lg bg-kumbh-river px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {anchoring ? "Anchoring…" : "Anchor chain on-chain"}
                </button>
              </div>
              <p className="mt-1 text-xs text-kumbh-deep/60">
                Writes only the chain&apos;s head hash to Polygon — public,
                tamper-proof proof, with zero personal data on-chain.
              </p>
              {audit.chainConfigured === false && (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  Not configured — set <code>POLYGON_PRIVATE_KEY</code> (a funded
                  Amoy testnet wallet) in <code>.env.local</code> to enable.
                </p>
              )}
              {anchorMsg && (
                <p className="mt-2 text-xs font-medium text-kumbh-deep/80">
                  {anchorMsg}
                </p>
              )}
              {audit.anchors && audit.anchors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {audit.anchors.map((a: any, i: number) => (
                    <li key={i} className="text-xs">
                      🔗{" "}
                      <a
                        href={a.explorer}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-kumbh-river underline"
                      >
                        {a.txHash.slice(0, 18)}…
                      </a>{" "}
                      <span className="text-kumbh-deep/50">
                        block {a.blockNumber ?? "pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ol className="space-y-2">
              {audit.entries.length === 0 && (
                <li className="text-sm text-kumbh-deep/50">
                  No activity yet — file a report to start the chain.
                </li>
              )}
              {[...audit.entries].reverse().map((e) => (
                <li
                  key={e.seq}
                  className="rounded-lg border border-black/10 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wide text-kumbh-river">
                      #{e.seq} · {e.type}
                    </span>
                    <span className="text-kumbh-deep/40">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-0.5">{e.summary}</p>
                  <p className="mt-1 font-mono text-[10px] text-kumbh-deep/40">
                    hash {e.entryHash.slice(0, 24)}… · prev {e.prevHash.slice(0, 12)}…
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </main>
  );
}

function VerdictBanner({ v }: { v: VerificationVerdict }) {
  const style =
    v.verdict === "approve"
      ? { box: "border-green-300 bg-green-50", label: "text-green-700", title: "✅ APPROVE — answers verified" }
      : v.verdict === "deny"
      ? { box: "border-red-300 bg-red-50", label: "text-red-700", title: "🚫 DENY — verification failed" }
      : { box: "border-amber-300 bg-amber-50", label: "text-amber-700", title: "⚠ ESCALATE — needs human sign-off" };
  return (
    <div className={`mt-3 rounded-lg border-2 p-3 ${style.box}`}>
      <div className="flex items-center justify-between">
        <span className={`text-base font-bold ${style.label}`}>{style.title}</span>
        <span className="text-xs text-kumbh-deep/60">
          fraud risk {v.riskScore}/100 · {v.confidence} confidence
        </span>
      </div>
      <p className="mt-1 text-sm">{v.reasoning}</p>
      {v.photoComparison && (
        <p className="mt-2 rounded bg-black/5 px-2 py-1 text-xs">
          📷 <span className="font-semibold">Photo check:</span>{" "}
          {v.photoComparison}
        </p>
      )}
      {v.requiresHumanSignoff && (
        <p className="mt-2 rounded bg-black/5 px-2 py-1 text-xs font-semibold">
          🔒 Mandatory: senior-staff / police sign-off required before handover
          {v.escalationReason ? ` — ${v.escalationReason}` : ""}
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {v.answerAssessments.map((a, i) => (
          <li key={i} className="text-xs">
            <span className={a.matched ? "text-green-700" : "text-red-700"}>
              {a.matched ? "✓" : "✗"}
            </span>{" "}
            <span className="text-kumbh-deep/70">{a.question}</span> — {a.assessment}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectorHotspots({ reports }: { reports: Report[] }) {
  const open = reports.filter((r) => r.status === "open");
  const counts = new Map<string, number>();
  for (const r of open) {
    const s = r.lastSeen.sector || "Unspecified";
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (rows.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-black/10 bg-kumbh-sand p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-kumbh-deep/50">
        Open cases by sector
      </div>
      <div className="space-y-1.5">
        {rows.map(([sector, n]) => (
          <div key={sector} className="flex items-center gap-2 text-xs">
            <span className="w-40 truncate text-kumbh-deep/70">{sector}</span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-black/5">
              <div
                className="h-full rounded bg-kumbh-saffron"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
            <span className="w-5 text-right font-semibold">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`text-2xl font-bold ${
          accent ? "text-green-600" : "text-kumbh-deep"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-kumbh-deep/50">{label}</div>
    </div>
  );
}

function Badge({
  type,
  urgency,
  small,
}: {
  type: "lost" | "found";
  urgency: "high" | "medium" | "low";
  small?: boolean;
}) {
  const urgencyColor =
    urgency === "high"
      ? "bg-red-100 text-red-700"
      : urgency === "medium"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-600";
  return (
    <div className={`flex gap-1 ${small ? "text-[10px]" : "text-xs"}`}>
      <span
        className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
          type === "lost"
            ? "bg-kumbh-river/15 text-kumbh-river"
            : "bg-kumbh-saffron/15 text-kumbh-saffron"
        }`}
      >
        {type}
      </span>
      <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${urgencyColor}`}>
        {urgency}
      </span>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const o = report.object;
  const p = report.person;
  const rows: [string, string | null][] =
    report.category === "object" && o
      ? [
          ["Item", o.itemType],
          ["Brand", o.brand],
          ["Color", o.color],
          ["Material", o.material],
          ["Size", o.size],
          ["Marks", o.distinguishingMarks.join(", ") || null],
          ["Contents", o.contents.join(", ") || null],
          ["Serial/ID", o.serialOrIdentifier],
          ["Lock", o.lockOrSecurity],
          ["Value", o.estimatedValue],
          ["Last seen", report.lastSeen.location],
          ["When", report.lastSeen.time],
        ]
      : [
          ["Name", p?.nameIfKnown ?? null],
          ["Age", p?.ageApprox ?? null],
          ["Gender", p?.gender ?? null],
          ["Build", p?.heightBuild ?? null],
          ["Clothing", p?.clothing.join(", ") || null],
          ["Features", p?.distinguishingFeatures.join(", ") || null],
          ["Languages", p?.languagesSpoken.join(", ") || null],
          ["Medical", p?.medicalNotes ?? null],
          ["Last seen", report.lastSeen.location],
          ["When", report.lastSeen.time],
        ];
  return (
    <div className="text-sm">
      {report.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.photoUrl}
          alt="reported person"
          className="mb-3 max-h-48 w-full rounded-lg object-cover"
        />
      )}
      <dl className="grid grid-cols-[90px_1fr] gap-y-1">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-kumbh-deep/50">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-3 rounded bg-kumbh-sand p-2 text-xs italic text-kumbh-deep/60">
        “{report.originalText}”
      </p>
    </div>
  );
}

function MatchCardView({
  match,
  candidate,
  onCoordinate,
}: {
  match: MatchCandidate;
  candidate?: Report;
  onCoordinate: () => void;
}) {
  const scoreColor =
    match.score >= 75
      ? "text-green-600"
      : match.score >= 50
      ? "text-amber-600"
      : "text-gray-500";
  return (
    <div className="rounded-lg border border-black/10 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {match.score}
          </span>
          <div>
            <span className="font-mono text-xs text-kumbh-deep/50">
              {match.reportId}
            </span>
            <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              {match.confidence} confidence
            </span>
          </div>
        </div>
        {match.score >= 50 && (
          <button
            onClick={onCoordinate}
            className="rounded-lg bg-kumbh-river px-3 py-1.5 text-xs font-semibold text-white"
          >
            Coordinate reunion →
          </button>
        )}
      </div>
      {candidate && (
        <p className="mt-1 text-xs text-kumbh-deep/60">{candidate.summary}</p>
      )}
      <p className="mt-2 text-sm">{match.reasoning}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {match.matchingFeatures.map((f, i) => (
          <span
            key={`m${i}`}
            className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700"
          >
            ✓ {f}
          </span>
        ))}
        {match.conflictingFeatures.map((f, i) => (
          <span
            key={`c${i}`}
            className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700"
          >
            ✗ {f}
          </span>
        ))}
      </div>
    </div>
  );
}
