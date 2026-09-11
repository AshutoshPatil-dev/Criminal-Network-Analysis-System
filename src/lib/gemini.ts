import type { Entity, Relationship, CrimeEvent, SubmittedReport, FirDocument, Anomaly } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface CopilotMessage {
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
}

export async function askNexusCopilot(
  userQuery: string,
  context: {
    entities: Entity[];
    relationships: Relationship[];
    crimes: CrimeEvent[];
    submittedReports?: SubmittedReport[];
    firDocuments?: FirDocument[];
    anomalies?: Anomaly[];
  }
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return 'Notice: Gemini API key not configured in system environment.';
  }

  // 1. Entities context
  const entitySummary = context.entities
    .slice(0, 45)
    .map(e => `[${e.type.toUpperCase()}] ID: ${e.id} | Name: ${e.name} | Threat Score: ${e.riskScore}/100 | Role: ${e.attributes.role || 'N/A'} | Phone/Plate: ${e.attributes.phone || e.attributes.vehicleNumber || 'N/A'}`)
    .join('\n');

  // 2. Crime Events & Detailed FIRs
  const crimeSummary = context.crimes
    .map(c => `FIR Ref: ${c.firNumber} | Incident Date: ${c.date} | Jurisdiction: ${c.location} | Linked Suspect IDs: ${c.involvedEntityIds.join(', ')}`)
    .join('\n');

  // 3. User Submitted & Verification Reports
  const reportsSummary = (context.submittedReports || [])
    .map(r => `Report Ref: ${r.id} | FIR: ${r.firNumber} | Subject: ${r.subjectName} | Location: ${r.incidentLocation || 'Unknown'} | Attached Evidences: ${r.detailCount} | Submitter: ${r.submittedBy}`)
    .join('\n');

  // 4. Saved Official FIR Documents (Complainant vs Accused details)
  const firDocsSummary = (context.firDocuments || [])
    .map(f => `FIR: ${f.firNumber} | Police Station: ${f.policeStation}, ${f.district} | Complainant: ${f.complainantName} | Accused: ${f.subjectName} (${f.accusedDetails || 'None'}) | Narrative Summary: ${f.incidentDescription.slice(0, 140)}... | Evidences: ${f.attachments.length} files`)
    .join('\n');

  // 5. Pre-computed Network Anomalies
  const anomaliesSummary = (context.anomalies || [])
    .map(a => `[${a.severity.toUpperCase()} ALERT] Type: ${a.type} | Details: ${a.description} | Target Entities: ${a.entityIds.join(', ')}`)
    .join('\n');

  const systemPrompt = `You are the NEXUS Forensic Intelligence & Network Analysis Engine for the Ministry of Home Affairs (MHA) and National Crime Records Bureau (NCRB) - Women Safety & Anti-Organized Crime Division.

CRITICAL OPERATIONAL DIRECTIVES:
1. Maintain an uncompromisingly authoritative, forensic, and court-admissible law-enforcement tone.
2. STRICT RULE: NEVER output emojis, casual chit-chat, or apologies.
3. STRICT RULE: NEVER reply with "Not Applicable" or refuse to analyze. If data is incomplete, execute a FORENSIC PLAUSIBILITY & DISCREPANCY AUDIT.
4. When asked to "find fake reports", "detect false FIRs", or "audit suspicious filings":
   - Cross-reference complainant narratives against CDR tower logs, timestamps, and suspect alibis.
   - Detect False Filing / Perjury indicators under Section 217 Bharatiya Nyaya Sanhita (BNS) / Section 182 & 211 IPC.
   - Highlight unverified reports lacking forensic checksums or CDR corroboration.
   - Flag contradictions: e.g., suspect's phone active in another district during alleged incident time, or identical narrative templates used across unrelated complaints.
5. Structure your output under these formal headers:
   - EXECUTIVE INTELLIGENCE SUMMARY
   - REPORT CREDIBILITY & DISCREPANCY AUDIT (Rank each audited FIR as: HIGH CREDIBILITY, UNVERIFIED / QUESTIONABLE, or HIGH DISCREPANCY RISK)
   - FORENSIC RED FLAGS & ALIBI CONTRADICTIONS
   - STATUTORY & INVESTIGATIVE DIRECTIVES (Precise action items for the Investigating Officer)

DATA REPOSITORY:
=== REGISTERED ENTITIES & ATTRIBUTES ===
${entitySummary || 'No entities on record.'}

=== CRIME EVENTS (FIRS) ===
${crimeSummary || 'No crime events recorded.'}

=== REGISTERED FIR CASE DOCUMENTS ===
${firDocsSummary || 'No case documents filed.'}

=== SUBMITTED INTELLIGENCE REPORTS ===
${reportsSummary || 'No submitted reports currently pending.'}

=== NETWORK ANOMALIES & CDR RED FLAGS ===
${anomaliesSummary || 'No active anomalies detected.'}
`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userQuery }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return `Intelligence Engine Error (${response.status}): ${err}`;
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || 'No actionable intelligence returned from system engine.';
  } catch (error) {
    return `Connection Error: Unable to establish secure channel with intelligence engine: ${String(error)}`;
  }
}