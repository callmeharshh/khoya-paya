#!/usr/bin/env node
/**
 * Khoya-Paya MCP server.
 *
 * Exposes the reunification system as Model Context Protocol tools so ANY Claude
 * client — Claude Desktop, a government control-room agent, an ops dashboard —
 * can file reports, search for matches, and coordinate reunions through natural
 * language. It drives the running web app's API, so anything filed here shows up
 * live on the control-room board.
 *
 * Run (with the web app running on :3000):
 *   npm run mcp
 *
 * Or point a Claude Desktop config at it — see README "MCP server".
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.KHOYA_BASE_URL || "http://localhost:3000";

async function api(path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request to ${path} failed (${res.status})`);
  }
  return data;
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

const server = new McpServer({ name: "khoya-paya", version: "1.0.0" });

// 1. File a report (lost or found) from free-form, multilingual text. The system
//    extracts a structured report AND returns likely matches in one step.
server.tool(
  "file_report",
  "File a lost-person or found-person report at the Kumbh Mela from free-form text in any language (Hindi, Marathi, Bhojpuri, English). Returns the structured report plus likely matches among open cases.",
  {
    text: z
      .string()
      .describe(
        "What the person at the help booth said, in their own words / language."
      ),
  },
  async ({ text: reportText }) => {
    const data = await api("/api/intake", { text: reportText });
    const r = data.report;
    const lines: string[] = [];
    lines.push(`Filed ${r.id} (${r.reportType.toUpperCase()}, ${r.urgency} urgency).`);
    lines.push(`Summary: ${r.summary}`);
    lines.push(`Sector: ${r.lastSeen.sector ?? "unspecified"}`);
    if (data.matches?.length) {
      lines.push(`\nLikely matches:`);
      for (const m of data.matches) {
        lines.push(
          `- ${m.reportId}: ${m.score}% (${m.confidence}) — ${m.reasoning}`
        );
      }
    } else {
      lines.push(`\nNo likely matches yet; report is on the board.`);
    }
    return text(lines.join("\n"));
  }
);

// 2. Re-run matching for an existing case at any time.
server.tool(
  "find_matches",
  "Search for likely matches for an existing report (by id) against open reports of the opposite type.",
  {
    reportId: z.string().describe("The report id, e.g. L004 or F001."),
  },
  async ({ reportId }) => {
    const data = await api("/api/match", { reportId });
    if (!data.matches?.length) return text(`No likely matches for ${reportId}.`);
    return text(
      `Matches for ${reportId}:\n` +
        data.matches
          .map(
            (m: any) =>
              `- ${m.reportId}: ${m.score}% (${m.confidence}) — ${m.reasoning}`
          )
          .join("\n")
    );
  }
);

// 3. Coordinate a reunion: multilingual announcements, routing, safety checks.
server.tool(
  "coordinate_reunion",
  "Generate a reunion plan for a matched pair: multilingual loudspeaker announcements, the center to route to, and a safety verification checklist to confirm before handover.",
  {
    lostId: z.string().describe("Id of the LOST report."),
    foundId: z.string().describe("Id of the FOUND report."),
  },
  async ({ lostId, foundId }) => {
    const { plan } = await api("/api/coordinate", { lostId, foundId });
    const lines: string[] = [];
    lines.push(`Routed to: ${plan.routedCenter}`);
    lines.push(`\nAnnouncements:`);
    for (const a of plan.announcements) lines.push(`[${a.language}] ${a.text}`);
    lines.push(`\nVerify before handover:`);
    for (const c of plan.verificationChecklist) lines.push(`- ${c}`);
    lines.push(`\nHandover note: ${plan.handoverNote}`);
    return text(lines.join("\n"));
  }
);

// 4. List the live board.
server.tool(
  "list_cases",
  "List all reports on the control-room board (open and reunited).",
  {},
  async () => {
    const data = await api("/api/reports");
    if (!data.reports?.length) return text("No cases on the board.");
    return text(
      data.reports
        .map(
          (r: any) =>
            `${r.id} [${r.reportType}/${r.urgency}/${r.status}] ${r.summary} (${
              r.lastSeen.sector ?? "?"
            })`
        )
        .join("\n")
    );
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Khoya-Paya MCP server running (API: ${BASE_URL})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
