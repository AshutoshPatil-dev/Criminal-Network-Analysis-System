import type { Entity, Relationship, CrimeEvent, CentralityScore, Community, Anomaly } from '../types';

interface Graph {
  entities: Entity[];
  relationships: Relationship[];
  crimeEvents: CrimeEvent[];
}

const neighborsOf = (relationships: Relationship[]) => {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    let s = map.get(a);
    if (!s) { s = new Set(); map.set(a, s); }
    s.add(b);
  };
  for (const r of relationships) {
    add(r.source, r.target);
    add(r.target, r.source);
  }
  return map;
};

const daysBetween = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;

const inWindow = (ts: string, date: string, hours: number) => {
  const t = new Date(ts).getTime();
  const d = new Date(date).getTime();
  return t >= d - hours * 3600000 && t <= d + 3600000;
};

// ---------------------------------------------------------------------------
// Centrality (degree, eigenvector, PageRank, betweenness) — computed live,
// purely client-side, from the current case graph.
// ---------------------------------------------------------------------------
export function computeCentrality(graph: Graph): CentralityScore[] {
  const { entities, relationships } = graph;
  const ids = entities.map(e => e.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const adj = neighborsOf(relationships);
  const deg = ids.map(id => adj.get(id)?.size ?? 0);
  const maxDeg = Math.max(1, ...deg);

  // Eigenvector centrality via power iteration.
  let ev = new Array(n).fill(1 / Math.max(1, n));
  for (let iter = 0; iter < 40; iter++) {
const next = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (const nb of adj.get(ids[i]) ?? new Set<string>()) {
          const j = index.get(nb);
          if (j !== undefined) next[i] += ev[j];
        }
      }
      const scale = Math.max(1e-9, ...next.map(Math.abs));
    ev = next.map(v => v / scale);
  }

  // PageRank via power iteration.
  const pr = new Array(n).fill(1 / Math.max(1, n));
  const dmp = 0.85;
  for (let iter = 0; iter < 40; iter++) {
    const next = new Array(n).fill((1 - dmp) / Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const neighbors = adj.get(ids[i]) ?? new Set<string>();
      if (neighbors.size === 0) continue;
      for (const nb of neighbors) {
        const j = index.get(nb);
        if (j !== undefined) next[j] += (dmp * pr[i]) / neighbors.size;
      }
    }
    pr.splice(0, pr.length, ...next);
  }

  // Betweenness via Brandes (unweighted, bounded to n <= 2000).
  const between = new Array(n).fill(0);
  if (n <= 2000) {
    for (let s = 0; s < n; s++) {
      const stack: number[] = [];
      const pred: number[][] = ids.map(() => []);
      const sigma = new Array(n).fill(0);
      sigma[s] = 1;
      const dist = new Array(n).fill(-1);
      dist[s] = 0;
      const queue: number[] = [s];
      while (queue.length) {
        const v = queue.shift()!;
        stack.push(v);
        for (const nb of adj.get(ids[v]) ?? new Set<string>()) {
          const w = index.get(nb)!;
          if (dist[w] < 0) {
            dist[w] = dist[v] + 1;
            queue.push(w);
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            pred[w].push(v);
          }
        }
      }
      const delta = new Array(n).fill(0);
      while (stack.length) {
        const w = stack.pop()!;
        for (const v of pred[w]) {
          delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        }
        if (w !== s) between[w] += delta[w];
      }
    }
  }
  const maxBetween = Math.max(1e-9, ...between);

  const prMax = Math.max(1e-9, ...pr);
  const betBetween = between.map(v => v / maxBetween);

  // Fuse attention: degree & eigenvector & PageRank & betweenness.
  return ids.map((id, i) => ({
    entityId: id,
    degree: deg[i] / maxDeg,
    eigenvector: ev[i],
    betweenness: betBetween[i],
    pageRank: pr[i] / prMax,
  })).sort((a, b) => b.pageRank - a.pageRank);
}

// ---------------------------------------------------------------------------
// Communities via label propagation (deterministic, order-independent enough).
// ---------------------------------------------------------------------------
export function computeCommunities(graph: Graph): Community[] {
  const { entities, relationships } = graph;
  const adj = neighborsOf(relationships);
  const labels = new Map<string, number>(entities.map((e, i) => [e.id, i]));
  for (let iter = 0; iter < 25; iter++) {
    for (const e of entities) {
      const nbs = adj.get(e.id) ?? new Set<string>();
      if (nbs.size === 0) continue;
      const counts = new Map<number, number>();
      for (const nb of nbs) {
        const l = labels.get(nb);
        if (l !== undefined) counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      if (counts.size === 0) continue;
      let best = -1;
      let bestCount = -1;
      for (const [l, c] of counts) {
        if (c > bestCount || (c === bestCount && (best === -1 || l < best))) {
          best = l;
          bestCount = c;
        }
      }
      labels.set(e.id, best);
    }
  }
  const groups = new Map<number, string[]>();
  for (const e of entities) {
    const l = labels.get(e.id) ?? 0;
    const list = groups.get(l) ?? [];
    list.push(e.id);
    groups.set(l, list);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([, members], i) => ({ id: i, members }));
}

// ---------------------------------------------------------------------------
// Anomaly detection on the live graph.
// ---------------------------------------------------------------------------
export function detectAnomalies(graph: Graph): Anomaly[] {
  const { entities, relationships, crimeEvents } = graph;
  const name = (id: string) => entities.find(e => e.id === id)?.name ?? id;
  const anomalies: Anomaly[] = [];
  let seq = 0;
  const push = (a: Omit<Anomaly, 'id'>) => {
    anomalies.push({ ...a, id: `an-${++seq}` });
  };

  const relPairs = new Map<string, Relationship[]>();
  for (const r of relationships) {
    const key = [r.source, r.target].sort().join('|');
    const list = relPairs.get(key) ?? [];
    list.push(r);
    relPairs.set(key, list);
  }
  const allTimestampsOfPair = (a: string, b: string) => {
    const key = [a, b].sort().join('|');
    return (relPairs.get(key) ?? []).flatMap(r => r.timestamps);
  };

  for (const r of relationships) {
    if (!r.linkedCrimeEventId) continue;
    if (!r.timestamps.length) continue;
    const ce = crimeEvents.find(c => c.id === r.linkedCrimeEventId);
    if (!ce) continue;

    // New contact immediately before a FIR.
    const beforeFir = r.timestamps.filter(ts => inWindow(ts, ce.date, 72));
    if (beforeFir.length >= 2) {
      const earlier = allTimestampsOfPair(r.source, r.target).some(ts => new Date(ts).getTime() < new Date(beforeFir[0]).getTime() - 72 * 3600000);
      if (!earlier) {
        push({
          type: 'new_contact_before_crime',
          severity: beforeFir.length >= 5 ? 'high' : 'medium',
          description: `${name(r.source)} and ${name(r.target)} first established contact ${beforeFir.length} times in the 72 hours before FIR #${ce.firNumber}. The pairing had not contacted before.`,
          entityIds: [r.source, r.target],
          crimeEventId: ce.id,
        });
      }
    }

    // Frequency spike vs the pair's own baseline.
    const dayAvg = allTimestampsOfPair(r.source, r.target)
      .filter(ts => new Date(ts).getTime() < new Date(ce.date).getTime() - 72 * 3600000);
    if (dayAvg.length > 0) {
      const spike = beforeFir.length / Math.max(dayAvg.length, 1);
      if (spike > 3) {
        push({
          type: 'unusual_pattern',
          severity: spike > 6 ? 'high' : 'medium',
          description: `Contact frequency between ${name(r.source)} and ${name(r.target)} spiked ${Math.round(spike * 100)}% in the three days before FIR #${ce.firNumber} compared with their prior baseline.`,
          entityIds: [r.source, r.target],
          crimeEventId: ce.id,
        });
      }
    }
  }

  // Burner phones: small active window, then silent.
  for (const e of entities) {
    if (e.type !== 'phone') continue;
    const rels = relationships.filter(r => r.source === e.id || r.target === e.id);
    const actives = rels.flatMap(r => r.timestamps).filter(Boolean).sort();
    if (actives.length === 0 || daysBetween(actives[0], actives[actives.length - 1]) > 14) continue;
    const owner = e.attributes.registeredTo;
    push({
      type: 'burner_phone',
      severity: actives.length >= 5 ? 'high' : 'medium',
      description: `Phone ${e.name.replace(/\+91-?/, '')} was active for only ${Math.max(1, Math.round(daysBetween(actives[0], actives[actives.length - 1])))} day(s) (${actives[actives.length - 1]} last contact)${owner && owner !== 'Unknown' ? ' (registered: ' + owner + ')' : ''}, then went silent. Potential burner device.`,
      entityIds: [e.id, ...rels.map(r => (r.source === e.id ? r.target : r.source)).slice(0, 2)],
    });
  }

  // Bridge nodes: person whose removal disconnects the graph.
  const adj = neighborsOf(relationships);
  const adjOf = (id: string) => adj.get(id) ?? new Set<string>();
  const bridgeCandidates = entities.filter(e => e.type === 'person');
  const components = (removedId: string | null) => {
    const seen = new Set<string>();
    let count = 0;
    for (const e of entities) {
      if (e.id === removedId || seen.has(e.id)) continue;
      count++;
      const queue = [e.id];
      seen.add(e.id);
      while (queue.length) {
        const cur = queue.shift()!;
        for (const nb of adjOf(cur)) {
          if (nb === removedId || seen.has(nb)) continue;
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    return count;
  };
  const base = components(null);
  const bridges = bridgeCandidates
    .filter(e => components(e.id) > base)
    .map(e => ({ id: e.id, gain: components(e.id) - base }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 4);
  for (const b of bridges) {
    push({
      type: 'bridge_node',
      severity: b.gain > 1 ? 'medium' : 'low',
      description: `${name(b.id)} is a bridge node: removing this individual splits the case network into ${base + b.gain} separate groups.`,
      entityIds: [b.id],
    });
  }

  return anomalies;
}

export interface GraphDerived {
  centralityScores: CentralityScore[];
  communities: Community[];
  anomalies: Anomaly[];
}

export function deriveGraph(graph: Graph): GraphDerived {
  if (graph.entities.length === 0) {
    return { centralityScores: [], communities: [], anomalies: [] };
  }
  return {
    centralityScores: computeCentrality(graph),
    communities: computeCommunities(graph),
    anomalies: detectAnomalies(graph),
  };
}