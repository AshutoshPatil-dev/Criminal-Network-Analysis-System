import type { Entity, Relationship, CrimeEvent, SubmittedReport, ReportDetail } from '../types';

export type FindingKind = 'identity_match' | 'mastermind_link' | 'crime_link' | 'risk_signal' | 'cross_report' | 'network_surfaced';

export interface AnalysisFinding {
  id: string;
  subject: string;
  sourceRef: string;
  kind: FindingKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  evidence: string[];
  linkedEntityId?: string;
  linkedEntityName?: string;
  confidence: number;
  action: string;
}

export interface MastermindRow {
  entityId: string;
  name: string;
  role: string;
  riskScore: number;
  pageRank: number;
  links: number;
  inCrimes: number;
}

export interface LinkAnalysisResult {
  findings: AnalysisFinding[];
  masterminds: MastermindRow[];
  brief: string;
}

const normPhone = (s: string) => s.replace(/\D/g, '');
const kingpinSeeds = ['p1', 'p5', 'p7', 'p12', 'p13', 'p2', 'ph6'];

interface Ctx {
  entities: Entity[];
  relationships: Relationship[];
  crimeEvents: CrimeEvent[];
  centrality: Record<string, number>;
  reports: SubmittedReport[];
}

const tokenOverlap = (a: string, b: string) =>
  a.toLowerCase().split(/[\s,.-]+/).filter(x => x.length > 2).some(t => b.toLowerCase().includes(t)) ||
  b.toLowerCase().split(/[\s,.-]+/).filter(x => x.length > 2).some(t => a.toLowerCase().includes(t));

const closestSeed = (relationships: Relationship[], start: string, seeds: string[]): { seed: string; hop: number | null } => {
  const queue: string[] = [start];
  const dist = new Map<string, number>([[start, 0]]);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    if (seeds.includes(cur) && cur !== start) return { seed: cur, hop: d };
    for (const r of relationships) {
      const nxt = r.source === cur ? r.target : r.target === cur ? r.source : null;
      if (nxt === null || dist.has(nxt)) continue;
      dist.set(nxt, d + 1);
      queue.push(nxt);
      if (seeds.includes(nxt)) return { seed: nxt, hop: d + 1 };
    }
  }
  return { seed: seeds[0], hop: null };
};

export function runLinkAnalysis(ctx: Ctx): LinkAnalysisResult {
  const { entities, relationships, crimeEvents, centrality, reports } = ctx;
  const findings: AnalysisFinding[] = [];
  const linksPerMastermind = new Map<string, number>();
  const entityById = new Map(entities.map(e => [e.id, e]));

  const ownerOf = (e: Entity): Entity | undefined => {
    const reg = e.attributes.registeredTo;
    if (!reg || reg === 'Unknown') return undefined;
    const candidate = entities.find(x => x.id === reg.toLowerCase()) ||
      entities.find(x => x.name.toLowerCase().includes(reg.toLowerCase()) && x.type === 'person');
    return candidate && candidate.type === 'person' ? candidate : undefined;
  };

  const push = (f: Omit<AnalysisFinding, 'id'>) => {
    findings.push({ ...f, id: `f-${findings.length + 1}` });
    if (f.linkedEntityId) linksPerMastermind.set(f.linkedEntityId, (linksPerMastermind.get(f.linkedEntityId) || 0) + 1);
  };

  const matchDetail = (d: ReportDetail, subject: string, ref: string) => {
    const { kind, value, tags = [], note } = d;

    if (kind === 'phone') {
      const phone = entities.find(e => e.type === 'phone' && normPhone(e.name) === normPhone(value));
      if (phone) {
        const owner = ownerOf(phone);
        const target = owner || phone;
        push({
          subject, sourceRef: ref, kind: 'identity_match',
          severity: owner ? 'high' : 'medium',
          title: owner ? `Phone ${phone.name} is already linked to ${owner.name}` : `Phone ${phone.name} is already in the case graph`,
          detail: owner
            ? `${value} matches a known number registered to ${owner.name} (${owner.attributes.role || 'role unknown'}). The report subject is a direct link to an existing persona.`
            : `${value} exists in the case graph but has no registered owner on file.`,
          evidence: [ref, phone.name, phone.id.toUpperCase()],
          linkedEntityId: target.id,
          linkedEntityName: target.name,
          confidence: owner ? 96 : 78,
          action: owner ? `Open ${owner.name}'s profile and prioritise verification.` : 'Flag for ownership investigation.',
        });
      }
    } else if (kind === 'vehicle') {
      const vehicle = entities.find(e => e.type === 'vehicle' && e.name.toLowerCase() === value.toLowerCase());
      if (vehicle) {
        const owner = ownerOf(vehicle);
        push({
          subject, sourceRef: ref, kind: 'identity_match', severity: owner ? 'high' : 'medium',
          title: owner ? `Vehicle ${vehicle.name} registered to ${owner.name}` : `Vehicle ${vehicle.name} already recorded`,
          detail: owner
            ? `${value} is registered to ${owner.name}. This creates a direct ownership link between the subject and the case graph.`
            : `${value} matches a vehicle already present in case data.`,
          evidence: [ref, vehicle.name, vehicle.id.toUpperCase()],
          linkedEntityId: (owner || vehicle).id,
          linkedEntityName: (owner || vehicle).name,
          confidence: owner ? 92 : 70,
          action: owner ? `Verify whether the subject has access to ${owner.name}'s vehicle.` : 'Re-confirm plate against RTO records.',
        });
      }
    } else if (kind === 'address') {
      const location = entities.find(e =>
        e.type === 'location' && (tokenOverlap(e.name, value) || tokenOverlap(Object.values(e.attributes).join(' '), value))
      );
      if (location) {
        push({
          subject, sourceRef: ref, kind: 'identity_match', severity: 'medium',
          title: `Address overlaps with ${location.name}`,
          detail: `The reported address shares terms with a known location node (${location.name}, risk ${location.riskScore}). AI suggests geospatial cross-referencing.`,
          evidence: [ref, location.name],
          linkedEntityId: location.id,
          linkedEntityName: location.name,
          confidence: 58,
          action: 'Run district-level lookups around this address.',
        });
      }
    } else if (kind === 'email' || kind === 'social') {
      const hit = entities.find(e => Object.values(e.attributes).some(v => v.toLowerCase().includes(value.toLowerCase())));
      if (hit) {
        push({
          subject, sourceRef: ref, kind: 'identity_match', severity: 'high',
          title: `${kind === 'email' ? 'Email' : 'Social handle'} matches ${hit.name}`,
          detail: `${value} was previously recorded on ${hit.name} (${hit.attributes.role || 'role unknown'}). The subject is strongly associated with an existing persona.`,
          evidence: [ref, hit.name, hit.id.toUpperCase()],
          linkedEntityId: hit.id,
          linkedEntityName: hit.name,
          confidence: 88,
          action: `Pull digital footprint trail for ${hit.name}.`,
        });
      }
    } else if (kind === 'employer') {
      const org = entities.find(e => e.type === 'org' && tokenOverlap(e.name, value));
      if (org) {
        push({
          subject, sourceRef: ref, kind: 'identity_match', severity: 'medium',
          title: `Employer matches ${org.name}`,
          detail: `${value} corresponds to known entity ${org.name} (sector: ${org.attributes.sector || 'unknown'}). This ties the subject to an organisation node in the case.`,
          evidence: [ref, org.name],
          linkedEntityId: org.id,
          linkedEntityName: org.name,
          confidence: 70,
          action: 'Audit employment records against case participation.',
        });
      }
    } else if (kind === 'alias') {
      const person = entities.find(e => e.type === 'person' &&
        (e.name.toLowerCase() === value.toLowerCase() || (e.attributes.aliases || '').toLowerCase().includes(value.toLowerCase())));
      if (person) {
        push({
          subject, sourceRef: ref, kind: 'identity_match', severity: 'high',
          title: `Alias “${value}” resolves to ${person.name}`,
          detail: `The alias is already recorded against ${person.name} (${person.attributes.role || 'role unknown'}, risk ${person.riskScore}). The subject may be the same individual.`,
          evidence: [ref, person.name, person.id.toUpperCase()],
          linkedEntityId: person.id,
          linkedEntityName: person.name,
          confidence: 94,
          action: `Validate identity via biometrics/linked records for ${person.name}.`,
        });
      }
    }

    if (tags.includes('burner') || tags.includes('suspicious')) {
      push({
        subject, sourceRef: ref, kind: 'risk_signal', severity: 'high',
        title: `${tags.includes('burner') ? 'Burner' : 'Suspicious'} indicator on ${kind.replace('_', ' ')}`,
        detail: `The entry was tagged ${tags.join(', ')}${note ? ` — note: “${note}”` : ''}. AI recommends elevating this entry to a watch-list trigger.`,
        evidence: [ref, ...tags],
        confidence: 82,
        action: 'Auto-create a watch trigger and notify the investigating officer.',
      });
    }
  };

  reports.forEach(report => {
    const ref = report.id;
    const subject = report.subjectName;
    const details = report.details || [];

    // Enumeration: several entries of the same kind for one subject
    const byKind = new Map<string, ReportDetail[]>();
    details.forEach(d => {
      const list = byKind.get(d.kind) || [];
      list.push(d);
      byKind.set(d.kind, list);
    });
    byKind.forEach((list, kind) => {
      if (list.length > 1) {
        push({
          subject, sourceRef: ref, kind: 'cross_report', severity: 'medium',
          title: `${list.length} entries of the same type (${kind}) for one subject`,
          detail: `Multiple ${kind} entries were recorded. AI flags enumeration — possible multiple identities or shared/secondary devices.`,
          evidence: [ref, `${list.length}× ${kind}`],
          confidence: 65,
          action: 'Cluster all values and check overlap with burner databases.',
        });
      }
    });

    details.forEach(d => matchDetail(d, subject, ref));

    // Name resolution against known persons
    const known = entities.find(e => e.type === 'person' &&
      (e.name.toLowerCase().includes(subject.toLowerCase()) ||
        (e.attributes.aliases || '').toLowerCase().split(',').some(a => a.trim() && subject.toLowerCase().includes(a.trim().toLowerCase()))));
    if (known) {
      push({
        subject, sourceRef: ref, kind: 'identity_match', severity: 'high',
        title: `“${subject}” matches ${known.name}`,
        detail: `The report's subject name resolves to an existing tracked persona ${known.name} (${known.attributes.role || 'role unknown'}, risk ${known.riskScore}).`,
        evidence: [ref, known.name, known.id.toUpperCase()],
        linkedEntityId: known.id,
        linkedEntityName: known.name,
        confidence: 90,
        action: `Consolidate the new report into ${known.name}'s dossier.`,
      });

      const { seed, hop } = closestSeed(relationships, known.id, kingpinSeeds);
      if (hop !== null && hop <= 3) {
        const kingpin = entityById.get(seed);
        if (kingpin) {
          push({
            subject, sourceRef: ref, kind: 'mastermind_link', severity: hop === 1 ? 'high' : hop === 2 ? 'medium' : 'low',
            title: `${known.name} sits ${hop} hop${hop === 1 ? '' : 's'} from the leadership`,
            detail: `Graph traversal places ${known.name} ${hop} connection${hop === 1 ? '' : 's'} away from ${kingpin.name}, a commanding figure in the network. This suggests proximity to organised leadership.`,
            evidence: [ref, `${hop}-hop chain → ${kingpin.name}`],
            linkedEntityId: known.id,
            linkedEntityName: known.name,
            confidence: hop === 1 ? 88 : hop === 2 ? 76 : 60,
            action: `Map the ${hop}-hop chain and check recent activity across the path.`,
          });
        }
      }

      const crimes = crimeEvents.filter(c => c.involvedEntityIds.includes(known.id));
      if (crimes.length > 0) {
        push({
          subject, sourceRef: ref, kind: 'crime_link', severity: 'high',
          title: `${known.name} is already linked to ${crimes.length} FIR${crimes.length === 1 ? '' : 's'}`,
          detail: `The matched persona appears in ${crimes.map(c => c.firNumber).join(', ')}. The new report extends the existing crime trail.`,
          evidence: [ref, ...crimes.map(c => c.firNumber)],
          linkedEntityId: known.id,
          linkedEntityName: known.name,
          confidence: 95,
          action: 'Merge the new report into the active FIR thread.',
        });
      }

      // Network surfacing: assets the persona controls and people they stand beside
      const assets = entities.filter(e =>
        (e.type === 'vehicle' || e.type === 'phone') &&
        e.attributes.registeredTo?.toLowerCase() === known.id.toLowerCase());
      assets.forEach(a => {
        push({
          subject, sourceRef: ref, kind: 'network_surfaced', severity: 'medium',
          title: `${known.name} controls ${a.type === 'vehicle' ? 'vehicle' : 'phone'} ${a.name}`,
          detail: `The matched persona is the registered owner of ${a.name} (risk ${a.riskScore}). The new report's context widens the set of assets tied to this individual.`,
          evidence: [ref, a.name, a.type],
          linkedEntityId: a.id,
          linkedEntityName: a.name,
          confidence: 84,
          action: `Watch ${a.name} for movement or further linkage in incoming reports.`,
        });
      });

      const neighbors = new Set<Entity>();
      relationships.forEach(r => {
        if (r.source === known.id) {
          const n = entityById.get(r.target);
          if (n && n.type === 'person') neighbors.add(n);
        } else if (r.target === known.id) {
          const n = entityById.get(r.source);
          if (n && n.type === 'person') neighbors.add(n);
        }
      });
      neighbors.forEach(n => {
        const rel = relationships.find(r =>
          (r.source === known.id && r.target === n.id) || (r.target === known.id && r.source === n.id));
        push({
          subject, sourceRef: ref, kind: 'network_surfaced', severity: n.riskScore >= 75 ? 'high' : 'medium',
          title: `${known.name} associates with ${n.name}`,
          detail: `Graph traversal places ${n.name} (${n.attributes.role || 'role unknown'}, risk ${n.riskScore}) in direct contact with the matched persona via ${rel ? rel.type : 'a recorded'} relationship.`,
          evidence: [ref, `${known.name} ↔ ${n.name}`, rel ? rel.type : 'contact'],
          linkedEntityId: n.id,
          linkedEntityName: n.name,
          confidence: 72,
          action: `Cross-check ${n.name}'s activities within the same period covered by ${ref}.`,
        });
      });
    }

    // Incident location against case geography
    if (report.incidentLocation) {
      const loc = report.incidentLocation;
      const ce = crimeEvents.find(c => tokenOverlap(`${c.location}`, loc) || tokenOverlap(loc, c.location));
      const place = entities.find(e => e.type === 'location' && (tokenOverlap(e.name, loc) || tokenOverlap(Object.values(e.attributes).join(' '), loc)));
      if (ce || place) {
        const linkedName = ce ? ce.location : place!.name;
        push({
          subject, sourceRef: ref, kind: 'crime_link', severity: ce ? 'high' : 'medium',
          title: ce ? `Incident location matches FIR ${ce.firNumber}` : `Incident location overlaps ${place!.name}`,
          detail: ce
            ? `The reported incident site shares terms with ${ce.location}, where FIR ${ce.firNumber} (${ce.date}) is registered. The report may belong to a connected spree.`
            : `The reported site shares terms with known location node ${place!.name} (risk ${place!.riskScore}).`,
          evidence: [ref, (ce ? ce.firNumber : place!.name), (ce ? ce.location : loc)],
          linkedEntityId: (ce || place!).id,
          linkedEntityName: linkedName,
          confidence: ce ? 94 : 62,
          action: ce ? `Compare suspect lists of ${ref} and ${ce.firNumber}.` : 'Geocode the site and map surrounding incidents.',
        });
      }
    }

    if (report.firNumber && report.firNumber !== '—') {
      const ce = crimeEvents.find(c => c.firNumber === report.firNumber);
      if (ce) {
        push({
          subject, sourceRef: ref, kind: 'crime_link', severity: 'high',
          title: `Report references known FIR ${ce.firNumber}`,
          detail: `${report.firNumber} (${ce.location}, ${ce.date}) is already recorded. The subject is implicated in an active case.`,
          evidence: [ref, ce.firNumber, ce.location],
          linkedEntityId: ce.involvedEntityIds[0],
          linkedEntityName: ce.involvedEntityIds[0] ? entityById.get(ce.involvedEntityIds[0])?.name : undefined,
          confidence: 99,
          action: "Contrast the new details against the FIR's current suspect list.",
        });
      }
    }
  });

  // Cross-report shared financial values (different subjects, same bank/account)
  const byValue = new Map<string, { subject: string; ref: string; kind: string }[]>();
  reports.forEach(r => {
    (r.details || []).forEach(d => {
      if (d.kind === 'bank' || d.kind === 'transaction_history') {
        const key = d.value.toLowerCase();
        if (!byValue.has(key)) byValue.set(key, []);
        byValue.get(key)!.push({ subject: r.subjectName, ref: r.id, kind: d.kind });
      }
    });
  });
  byValue.forEach((occurrences, value) => {
    const subjects = [...new Set(occurrences.map(o => o.subject))];
    if (subjects.length > 1) {
      push({
        subject: subjects.join(' & '), sourceRef: [...new Set(occurrences.map(o => o.ref))].join(', '),
        kind: 'cross_report', severity: 'high',
        title: `Shared ${occurrences[0].kind.replace('_', ' ')} among ${subjects.length} subjects`,
        detail: `The same ${occurrences[0].kind.replace('_', ' ')} (${value}) appears across separate reports for: ${subjects.join(', ')}. This is a strong co-conspirator signal.`,
        evidence: [...new Set(occurrences.map(o => o.ref))],
        confidence: 91,
        action: 'Merge the subjects into one intelligence thread and check joint activity.',
      });
    }
  });

  // Mastermind leaderboard surfaced by the scan
  const masterminds: MastermindRow[] = entities
    .filter(e => e.type === 'person')
    .map(e => ({
      entityId: e.id,
      name: e.name,
      role: e.attributes.role || '',
      riskScore: e.riskScore,
      pageRank: centrality[e.id] || 0,
      links: linksPerMastermind.get(e.id) || 0,
      inCrimes: crimeEvents.filter(c => c.involvedEntityIds.includes(e.id)).length,
    }))
    .sort((a, b) => (b.links + b.inCrimes) - (a.links + a.inCrimes) || b.pageRank - a.pageRank)
    .slice(0, 6)
    .filter(m => m.links > 0 || m.inCrimes > 0);

  const brief = buildBrief(findings, masterminds);
  return { findings, masterminds, brief };
}

function buildBrief(findings: AnalysisFinding[], masterminds: MastermindRow[]): string {
  const high = findings.filter(f => f.severity === 'high');
  const links = findings.filter(f => f.kind === 'mastermind_link');
  const identities = findings.filter(f => f.kind === 'identity_match');
  const surfaced = findings.filter(f => f.kind === 'network_surfaced');
  const top = masterminds[0];

  const sentences: string[] = [];
  if (findings.length === 0) sentences.push('No cross-links were identified between the current reports and the case graph.');
  if (identities.length > 0) sentences.push(`${identities.length} subject${identities.length === 1 ? '' : 's'} resolved to persona${identities.length === 1 ? '' : 's'} already present in case data.`);
  if (surfaced.length > 0) sentences.push(`The network was broadened by ${surfaced.length} surfaced link${surfaced.length === 1 ? '' : 's'} — associated persons and controlled assets tied to matched personas.`);
  if (links.length > 0) sentences.push(`The analysis surfaced ${links.length} proximity link${links.length === 1 ? '' : 's'} toward known leadership clusters.`);
  if (top) sentences.push(`${top.name} emerges as the most connected individual, with ${top.links} surfaced link${top.links === 1 ? '' : 's'} and ${top.inCrimes} FIR association${top.inCrimes === 1 ? '' : 's'}.`);
  if (high.length > 0) sentences.push(`${high.length} high-severity finding${high.length === 1 ? '' : 's'} should be prioritised for verification by the investigation team.`);
  sentences.push('All conclusions are derived from the current case graph and submitted reports; verification is required before any enforcement action.');
  return sentences.join(' ');
}