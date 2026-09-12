import type { Entity, Relationship, RelationshipType } from '../types';

// ---------------------------------------------------------------------------
// What-If Investigation Simulator
// ---------------------------------------------------------------------------
// Pure, read-only graph analysis. A target (an entity or the bundled A↔B
// connection between two entities) is temporarily "removed" from a copy of the
// relationship set. The graph is then re-analyzed: connected components, bridge
// behaviour, severed links and alternative paths are computed so investigators
// can inspect what would break before touching real case data.
//
// This module never mutates the case graph — every simulation works on a copy.
// ---------------------------------------------------------------------------

export type SimTargetKind = 'entity' | 'relationship';

export interface SimTarget {
  kind: SimTargetKind;
  id: string;
  label: string;
}

export interface GroupInfo {
  id: number;
  size: number;
  members: string[];
}

export interface SeveredLink {
  source: string;
  target: string;
  types: RelationshipType[];
  alternativePathExists: boolean;
}

export interface SimulationResult {
  target: SimTarget;
  entityCount: number;
  relationshipCount: number;
  componentCountBefore: number;
  componentCountAfter: number;
  /** How many extra separate groups appear after removal (0 = no split). */
  splitCount: number;
  /** True when removal increases the number of connected groups. */
  isBridge: boolean;
  /** Number of raw relationship records affected by the removal. */
  affectedRelationships: number;
  /** The merged A↔B connections that were removed (each with alt-path status). */
  severedLinks: SeveredLink[];
  /** Entities that lost their previous connection and now sit in a smaller group. */
  disconnectedEntityIds: string[];
  /** Entities left with no remaining connections at all after removal. */
  isolatedEntityIds: string[];
  /** Plain-language explanation sentences shown in the results panel. */
  sentences: string[];
}

export const pairKey = (a: string, b: string): string => [a, b].sort().join('⟷');

const neighborsOf = (rels: Relationship[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    let s = map.get(a);
    if (!s) { s = new Set(); map.set(a, s); }
    s.add(b);
  };
  for (const r of rels) {
    add(r.source, r.target);
    add(r.target, r.source);
  }
  return map;
};

const computeGroups = (adj: Map<string, Set<string>>, ids: string[]): GroupInfo[] => {
  const seen = new Set<string>();
  const groups: GroupInfo[] = [];
  let gid = 0;
  for (const id of ids) {
    if (seen.has(id)) continue;
    const members: string[] = [];
    const queue = [id];
    seen.add(id);
    while (queue.length) {
      const cur = queue.shift()!;
      members.push(cur);
      for (const nb of adj.get(cur) ?? new Set<string>()) {
        if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
      }
    }
    groups.push({ id: gid++, size: members.length, members });
  }
  return groups;
};

const hasPath = (adj: Map<string, Set<string>>, from: string, to: string): boolean => {
  if (from === to) return true;
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? new Set<string>()) {
      if (nb === to) return true;
      if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  return false;
};

const mergePairs = (rels: Relationship[]): Map<string, { source: string; target: string; types: RelationshipType[] }> => {
  const map = new Map<string, { source: string; target: string; types: RelationshipType[] }>();
  for (const r of rels) {
    const key = pairKey(r.source, r.target);
    const existing = map.get(key);
    if (existing) {
      if (!existing.types.includes(r.type)) existing.types.push(r.type);
    } else {
      map.set(key, { source: r.source, target: r.target, types: [r.type] });
    }
  }
  return map;
};

const plural = (n: number) => (n === 1 ? '' : 's');

/**
 * Temporarily removes an entity or the A↔B connection and reports what breaks.
 */
export function simulateRemoval(
  entities: Entity[],
  relationships: Relationship[],
  target: SimTarget,
): SimulationResult {
  const ids = entities.map(e => e.id);
  const names = new Map(entities.map(e => [e.id, e.name]));

  const removed = target.kind === 'entity'
    ? relationships.filter(r => r.source === target.id || r.target === target.id)
    : relationships.filter(r => pairKey(r.source, r.target) === target.id);
  const remaining = relationships.filter(r => !removed.includes(r));

  const afterIds = target.kind === 'entity' ? ids.filter(id => id !== target.id) : ids;

  const beforeAdj = neighborsOf(relationships);
  const afterAdj = neighborsOf(remaining);

  const beforeGroups = computeGroups(beforeAdj, ids);
  const afterGroups = computeGroups(afterAdj, afterIds);

  const componentCountBefore = beforeGroups.length;
  const componentCountAfter = afterGroups.length;
  const splitCount = Math.max(0, componentCountAfter - componentCountBefore);
  const isBridge = splitCount > 0;

  const groupSize = (groups: GroupInfo[]) => {
    const m = new Map<string, number>();
    for (const g of groups) for (const member of g.members) m.set(member, g.size);
    return m;
  };
  const beforeSize = groupSize(beforeGroups);
  const afterSize = groupSize(afterGroups);

  const disconnectedEntityIds = afterIds.filter(id => (afterSize.get(id) ?? 0) < (beforeSize.get(id) ?? 0));
  const isolatedEntityIds = afterIds.filter(id =>
    disconnectedEntityIds.includes(id) && (afterAdj.get(id)?.size ?? 0) === 0);

  const paired = mergePairs(removed);
  const severedLinks: SeveredLink[] = Array.from(paired.values()).map(p => ({
    source: p.source,
    target: p.target,
    types: p.types,
    alternativePathExists: hasPath(afterAdj, p.source, p.target),
  }));

  const nameOf = (id: string) => names.get(id) ?? id;
  const affectedRelationships = removed.length;

  const sentences: string[] = [];
  const altYes = severedLinks.filter(l => l.alternativePathExists).length;
  const altNo = severedLinks.length - altYes;

  if (isBridge) {
    sentences.push(`Removing this ${target.kind === 'entity' ? 'entity' : 'connection'} disconnects ${splitCount} group${plural(splitCount)} and affects ${affectedRelationships} relationship${plural(affectedRelationships)}.`);
  } else {
    sentences.push(`Removing this ${target.kind === 'entity' ? 'entity' : 'connection'} affects ${affectedRelationships} relationship${plural(affectedRelationships)}, but the remaining network stays connected — alternate routes are available.`);
  }
  sentences.push(`Before removal the network has ${componentCountBefore} connected group${plural(componentCountBefore)}; after removal it has ${componentCountAfter}.`);

  if (disconnectedEntityIds.length > 0) {
    sentences.push(`${disconnectedEntityIds.length} entit${plural(disconnectedEntityIds.length) === 's' ? 'ies' : 'y'} lose${plural(disconnectedEntityIds.length) ? '' : 's'} their previous connection${plural(disconnectedEntityIds.length)}: ${disconnectedEntityIds.map(nameOf).join(', ')}.`);
  }
  if (isolatedEntityIds.length > 0) {
    sentences.push(`${isolatedEntityIds.length} of them — ${isolatedEntityIds.map(nameOf).join(', ')} — are left with no remaining connections at all.`);
  }
  if (severedLinks.length > 0) {
    if (altNo === 0) {
      sentences.push(`Alternative paths still exist for every severed direct connection.`);
    } else if (altYes === 0) {
      sentences.push(`No alternative path remains for any of the ${severedLinks.length} severed direct connection${plural(severedLinks.length)}.`);
    } else {
      sentences.push(`Alternative paths remain for ${altYes} of ${severedLinks.length} severed direct connection${plural(severedLinks.length)}${altNo > 0 ? `; no alternative remains for ${altNo}` : ''}.`);
    }
  }

  if (target.kind === 'entity') {
    sentences.push(isBridge
      ? `This entity is acting as a bridge: removing it cuts the network into ${splitCount + 1} separate segment${plural(splitCount + 1)}.`
      : `This is not a bridge node — its removal does not break apart any group.`);
  } else if (target.label) {
    sentences.push(isBridge
      ? `This connection is a critical link: severing it splits the network into ${splitCount + 1} separate segment${plural(splitCount + 1)}.`
      : `This is not a critical connection — its removal does not split the network.`);
  }

  return {
    target,
    entityCount: entities.length,
    relationshipCount: relationships.length,
    componentCountBefore,
    componentCountAfter,
    splitCount,
    isBridge,
    affectedRelationships,
    severedLinks,
    disconnectedEntityIds,
    isolatedEntityIds,
    sentences,
  };
}