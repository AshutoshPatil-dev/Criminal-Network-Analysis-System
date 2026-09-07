import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape, { type Core, type NodeSingular, type EdgeSingular } from 'cytoscape';
import { useApp } from '../store';
import { entityTypeColors, riskColor } from '../utils/theme';
import type { Entity, EntityType, RelationshipType, Relationship, CrimeEvent, Community } from '../types';
import type { TranslationKey } from '../i18n';

const relTypeStyles: Record<RelationshipType, { color: string; dash?: string }> = {
  call: { color: '#64748B' },
  meeting: { color: '#0B3D91', dash: '5,5' },
  transaction: { color: '#16A34A', dash: '2,4' },
  associate: { color: '#F59E0B' },
  'co-accused': { color: '#DC2626', dash: '8,4' },
  ownership: { color: '#7C3AED', dash: '3,3' },
};

const communityColors = ['#0B3D91', '#16A34A', '#F59E0B', '#DC2626'];

interface MergedRel {
  source: string;
  target: string;
  relTypes: RelationshipType[];
  count: number;
  timestamps: string[];
  linkedCrimeEventId?: string;
}

// Merge parallel edges between the same pair into a single edge to declutter.
function aggregateRelationships(rels: Relationship[]): MergedRel[] {
  const map = new Map<string, MergedRel>();
  for (const r of rels) {
    const key = [r.source, r.target].sort().join('⟷');
    const existing = map.get(key);
    if (existing) {
      existing.relTypes.push(r.type);
      existing.count += r.count;
      existing.timestamps = [...existing.timestamps, ...r.timestamps];
      if (r.linkedCrimeEventId) existing.linkedCrimeEventId = r.linkedCrimeEventId;
    } else {
      map.set(key, {
        source: r.source,
        target: r.target,
        relTypes: [r.type],
        count: r.count,
        timestamps: [...r.timestamps],
        linkedCrimeEventId: r.linkedCrimeEventId,
      });
    }
  }
  return Array.from(map.values());
}

const dominantType = (relTypes: RelationshipType[]): RelationshipType =>
  ['call', 'meeting', 'transaction', 'associate', 'co-accused', 'ownership']
    .find(t => relTypes.includes(t as RelationshipType)) as RelationshipType;

interface GraphData {
  entities: Entity[];
  relationships: Relationship[];
  crimeEvents: CrimeEvent[];
  communities: Community[];
}

function getCytoscapeElements(graph: GraphData, expandedIds: string[], dateRange: [string, string]) {
  const { entities, relationships, crimeEvents, communities } = graph;
  const [start, end] = dateRange;
  const startDate = new Date(start);
  const endDate = new Date(end);

  const persistentTypes: RelationshipType[] = ['ownership', 'associate', 'co-accused'];

  const filteredRels = relationships.filter(r => {
    const sourceExpanded = expandedIds.includes(r.source);
    const targetExpanded = expandedIds.includes(r.target);
    if (!(sourceExpanded || targetExpanded)) return false;
    if (persistentTypes.includes(r.type)) return true;
    return r.timestamps.some(ts => {
      const d = new Date(ts);
      return d >= startDate && d <= endDate;
    });
  });

  const merged = aggregateRelationships(filteredRels);

  const involvedIds = new Set<string>();
  merged.forEach(r => { involvedIds.add(r.source); involvedIds.add(r.target); });

  const nodes = entities
    .filter(e => involvedIds.has(e.id))
    .map(e => {
      const community = communities.find(c => c.members.includes(e.id));
      const nodeSize = e.type === 'person' ? 26 + e.riskScore * 0.22 : e.type === 'org' ? 32 : 18 + e.riskScore * 0.12;
      return {
        data: {
          id: e.id,
          label: e.name,
          fullName: e.name,
          type: e.type,
          riskScore: e.riskScore,
          attributes: e.attributes,
          communityId: community?.id ?? -1,
          size: nodeSize,
        },
      };
    });

  const edges = merged.map((r, i) => {
    const relevantTimestamps = r.timestamps.filter(ts => {
      const d = new Date(ts);
      return d >= startDate && d <= endDate;
    });
    const isBeforeCrime = Boolean(r.linkedCrimeEventId && crimeEvents.some(c => c.id === r.linkedCrimeEventId));
    const dominant = dominantType(r.relTypes);
    return {
      data: {
        id: `e${i}`,
        source: r.source,
        target: r.target,
        relTypes: r.relTypes,
        relType: dominant,
        count: r.count,
        timestamps: relevantTimestamps.length > 0 ? relevantTimestamps : r.timestamps,
        linkedCrimeEventId: r.linkedCrimeEventId,
        isBeforeCrime,
        width: Math.min(1.2 + Math.log10(Math.max(r.count, 1)) * 2.2, 6),
      },
    };
  });

  return [...nodes as cytoscape.ElementDefinition[], ...edges];
}

interface NodeTooltipData {
  name: string;
  id: string;
  type: string;
  role?: string;
  riskScore: string | number;
  connectionCount: number;
  top3Associates: string[];
  communityId: number;
}

interface EdgeTooltipData {
  relTypes: string;
  count: string | number;
  timestamps: string[];
  isBeforeCrime: boolean;
  firNumber?: string;
  crimeDate?: string;
  source?: string;
  target?: string;
}

interface TooltipData {
  x: number; y: number;
  payload: NodeTooltipData | EdgeTooltipData;
  kind: 'node' | 'edge';
}

export default function NetworkGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<cytoscape.Layouts | null>(null);
  const { t, expandedNodeIds, setExpandedNodeIds, dateRange, setDateRange, openProfile, setSelectedEntityId, entities, relationships, crimeEvents, communities, centralityScores } = useApp();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [colorBy, setColorBy] = useState<'type' | 'community' | 'risk'>('type');
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const bounds = useMemo(() => {
    const dates: number[] = [];
    for (const r of relationships) for (const ts of r.timestamps) {
      const t = new Date(ts).getTime();
      if (!Number.isNaN(t)) dates.push(t);
    }
    for (const ce of crimeEvents) {
      const t = new Date(ce.date).getTime();
      if (!Number.isNaN(t)) dates.push(t);
    }
    if (dates.length === 0) return { min: new Date('2000-01-01'), max: new Date('2099-12-31') };
    return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
  }, [relationships, crimeEvents]);

  const pct = (dateStr: string) => {
    const span = bounds.max.getTime() - bounds.min.getTime();
    if (span <= 0) return 0;
    return ((new Date(dateStr).getTime() - bounds.min.getTime()) / span) * 100;
  };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const dayOffset = (days: number) => iso(new Date(bounds.max.getTime() - days * 86400000));
  const TIMELINE_PRESETS = [
    { label: 'Full', range: [iso(bounds.min), iso(bounds.max)] as [string, string] },
    { label: t('last90Days'), range: [dayOffset(90), iso(bounds.max)] as [string, string] },
    { label: t('last30Days'), range: [dayOffset(30), iso(bounds.max)] as [string, string] },
  ];

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ entities, relationships, crimeEvents }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-network-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleNode = useCallback((id: string) => {
    setExpandedNodeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, [setExpandedNodeIds]);

  const buildGraph = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Definitively fill the wrapper regardless of stylesheet timing.
    el.style.position = 'absolute';
    el.style.inset = '0';
    if (layoutRef.current) layoutRef.current.stop();
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

    const parent = el.parentElement;
    const px = parent ? parent.clientWidth : el.clientWidth;
    const py = parent ? parent.clientHeight : el.clientHeight;
    if (py > 0) {
      el.style.width = `${px}px`;
      el.style.height = `${py}px`;
    }

    const elements = getCytoscapeElements({ entities, relationships, crimeEvents, communities }, expandedNodeIds, dateRange);

    const cy = cytoscape({
      container: el,
      elements,
      boxSelectionEnabled: true,
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 700,
        fit: true,
        padding: 60,
        nodeDimensionsIncludeLabels: true,
        randomize: true,
        nodeRepulsion: (node: NodeSingular) => 10000 + Math.pow(node.data('size') as number, 2.2),
        idealEdgeLength: () => 190,
        edgeElasticity: () => 12,
        gravity: 0.4,
        numIter: 1500,
        coolingFactor: 0.92,
        componentSpacing: 160,
      },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': (ele: NodeSingular) => {
              const cid = ele.data('communityId') as number;
              const score = ele.data('riskScore') as number;
              if (colorBy === 'community') return cid >= 0 ? communityColors[cid % communityColors.length] : '#94A3B8';
              if (colorBy === 'risk') return score >= 70 ? '#DC2626' : score >= 40 ? '#F59E0B' : '#16A34A';
              return entityTypeColors[ele.data('type') as EntityType] || '#94A3B8';
            },
            'background-opacity': 0.9,
            color: '#334155',
            'font-size': '11px',
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'text-halign': 'center',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-opacity': 0,
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': (ele: NodeSingular) => (ele.data('riskScore') as number) >= 70 ? 'rgba(220,38,38,0.55)' : 'rgba(255,255,255,0.9)',
            'overlay-padding': '5px',
            'overlay-opacity': 0.12,
            'z-index': 10,
          },
        },
        {
          selector: 'node[type = "person"]',
          style: { 'shape': 'ellipse' },
        },
        {
          selector: 'node[type = "phone"]',
          style: { 'shape': 'round-rectangle', 'width': 16, 'height': 16 },
        },
        {
          selector: 'node[type = "vehicle"]',
          style: { 'shape': 'diamond', 'width': 20, 'height': 20 },
        },
        {
          selector: 'node[type = "location"]',
          style: { 'shape': 'hexagon', 'width': 20, 'height': 20 },
        },
        {
          selector: 'node[type = "org"]',
          style: { 'shape': 'round-rectangle', 'width': 26, 'height': 26 },
        },
        {
          selector: 'edge',
          style: {
            width: 'data(width)',
            'line-color': (ele: EdgeSingular) => relTypeStyles[ele.data('relType') as RelationshipType]?.color || '#CBD5E1',
            'line-style': (ele: EdgeSingular) => (relTypeStyles[ele.data('relType') as RelationshipType]?.dash ? 'dashed' : 'solid'),
            'curve-style': 'bezier',
            'target-arrow-color': '#CBD5E1',
            'target-arrow-shape': 'none',
            'line-opacity': 0.55,
            'z-index': 1,
          },
        },
        {
          selector: 'edge[isBeforeCrime = true]',
          style: { 'line-color': '#DC2626', 'line-opacity': 0.95, 'z-index': 20 },
        },
        {
          selector: 'node.focused',
          style: {
            'text-opacity': 1,
            'font-size': '12px',
            'font-weight': 700,
            'background-opacity': 1,
            'z-index': 500,
          },
        },
        {
          selector: 'node.selected',
          style: {
            'border-width': 4,
            'border-color': '#0B3D91',
            'text-opacity': 1,
            'z-index': 600,
            'background-opacity': 1,
          },
        },
        {
          selector: 'edge.selected',
          style: { width: 5, 'line-color': '#0B3D91', 'line-opacity': 1, 'z-index': 600 },
        },
        {
          selector: 'node.faded',
          style: { 'opacity': 0.18 },
        },
        {
          selector: 'edge.faded',
          style: { 'opacity': 0.06 },
        },
        {
          selector: 'node.unfaded',
          style: { 'opacity': 1 },
        },
        {
          selector: 'edge.unfaded',
          style: { 'opacity': 1 },
        },
      ],
      minZoom: 0.2,
      maxZoom: 4,
    });

    // Node hover → reveal name + neighborhood, show tooltip
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      cy.elements().removeClass('faded unfaded');
      const hood = node.neighborhood();
      node.addClass('focused');
      hood.addClass('unfaded');
      const rest = cy.elements().not(node.union(hood));
      rest.addClass('faded');

      const connectedEdges = node.connectedEdges();
      const neighborArr = node.neighborhood('node').toArray() as NodeSingular[];
      const top3 = neighborArr
        .sort((a, b) => (b.data('riskScore') as number) - (a.data('riskScore') as number))
        .slice(0, 3)
        .map(n => n.data('fullName') as string);

      const pos = node.renderedPosition();
      const r = containerRef.current!.getBoundingClientRect();
      setTooltip({
        x: r.left + pos.x,
        y: r.top + pos.y,
        kind: 'node',
        payload: {
          name: node.data('fullName'),
          id: node.data('id'),
          type: node.data('type'),
          role: (node.data('attributes') as Partial<Entity['attributes']>)?.role,
          riskScore: node.data('riskScore'),
          connectionCount: connectedEdges.length,
          top3Associates: top3,
          communityId: node.data('communityId'),
        },
      });
    });

    cy.on('mouseout', 'node', () => {
      cy.elements().removeClass('faded unfaded focused');
      const sel = cy.$('node.selected');
      if (sel.nonempty()) {
        sel.addClass('focused');
      }
      setTooltip(null);
    });

    // Edge hover → tooltip
    cy.on('mouseover', 'edge', (evt) => {
      const edge = evt.target as EdgeSingular;
      const crimeId = edge.data('linkedCrimeEventId') as string | undefined;
      const crime = crimeId ? crimeEvents.find(c => c.id === crimeId) : null;
      const pos = evt.originalEvent as MouseEvent;
      const container = containerRef.current!.getBoundingClientRect();
      const relTypesArr = (edge.data('relTypes') as RelationshipType[] | undefined) ?? [edge.data('relType')];

      setTooltip({
        x: container.left + (pos.clientX - container.left),
        y: container.top + (pos.clientY - container.top),
        kind: 'edge',
        payload: {
          relTypes: relTypesArr.join(', '),
          count: edge.data('count'),
          timestamps: edge.data('timestamps') as string[],
          isBeforeCrime: Boolean(edge.data('isBeforeCrime')),
          firNumber: crime?.firNumber,
          crimeDate: crime?.date,
          source: edge.data('source'),
          target: edge.data('target'),
        },
      });
    });

    cy.on('mouseout', 'edge', () => setTooltip(null));

    // Single click → select + side panel; double click → open dossier
    let lastTap = { id: '', t: 0 };
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      const nodeId = node.data('id') as string;
      const now = performance.now();
      if (lastTap.id === nodeId && now - lastTap.t < 380) {
        openProfile(nodeId);
        lastTap = { id: '', t: 0 };
        return;
      }
      lastTap = { id: nodeId, t: now };
      setSelectedNodeId(nodeId);
      cy.$('node.selected, edge.selected').removeClass('selected');
      node.addClass('selected');
    });

    // Tap background → deselect + close panel
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNodeId(null);
        cy.$('node.selected, edge.selected').removeClass('selected');
      }
    });

    // Native double-click/double-tap → open dossier
    const openDossier = (id: string) => {
      openProfile(id);
    };
    cy.on('dbltap', 'node', (evt) => {
      openDossier(evt.target.data('id') as string);
    });

    cy.resize();

    cyRef.current = cy;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__nexusCy = cy;
  }, [expandedNodeIds, dateRange, colorBy, filterType, t, openProfile, setSelectedEntityId, setExpandedNodeIds, toggleNode, entities, relationships, crimeEvents, communities]);

  useEffect(() => {
    buildGraph();
    // Keep cytoscape in sync if the canvas wrapper is resized.
    const ro = new ResizeObserver(() => { cyRef.current?.resize(); });
    const parentEl = containerRef.current?.parentElement ?? null;
    if (parentEl) ro.observe(parentEl);
    return () => {
      ro.disconnect();
      if (layoutRef.current) layoutRef.current.stop();
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [buildGraph]);

  // Dim non-matching types when filtered
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('faded unfaded');
    if (filterType !== 'all') {
      cy.nodes().forEach(n => {
        if (n.data('type') !== filterType) n.addClass('faded');
      });
    }
  }, [filterType]);

  // Escape closes the side panel · Enter opens the dossier of the selected node
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        cyRef.current?.$('node.selected, edge.selected').removeClass('selected');
      } else if (e.key === 'Enter' && selectedNodeId) {
        openProfile(selectedNodeId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, openProfile]);

  const selectedNode = selectedNodeId ? entities.find(e => e.id === selectedNodeId) ?? null : null;
  const selectedCy = selectedNodeId && cyRef.current ? cyRef.current.getElementById(selectedNodeId) : null;
  const neighbors: { id: string; name: string; type: EntityType; riskScore: number }[] = selectedCy && selectedCy.nonempty()
    ? selectedCy.neighborhood('node').toArray()
        .sort((a, b) => (b.data('riskScore') as number) - (a.data('riskScore') as number))
        .map(n => ({ id: n.data('id') as string, name: n.data('fullName') as string, type: n.data('type') as EntityType, riskScore: n.data('riskScore') as number }))
    : [];
  const selectedCs = selectedNode ? centralityScores.find(c => c.entityId === selectedNode.id) : null;

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col gap-3 max-w-screen-2xl mx-auto min-h-[600px]">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl lg:text-2xl font-bold text-nexus-text">{t('graph')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-nexus-text-secondary hidden sm:inline">{t('colorBy')}</span>
            <select
              value={colorBy}
              onChange={e => setColorBy(e.target.value as typeof colorBy)}
              className="border border-nexus-border rounded-md px-2 py-1 text-sm bg-white"
              aria-label={t('colorBy')}
            >
              <option value="type">{t('type')}</option>
              <option value="community">{t('community')}</option>
              <option value="risk">{t('riskLevel')}</option>
            </select>
          </label>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value as EntityType | 'all'); }}
            className="border border-nexus-border rounded-md px-2 py-1 text-sm bg-white"
            aria-label={t('filterByType')}
          >
            <option value="all">{t('all')}</option>
            <option value="person">{t('persons')}</option>
            <option value="phone">{t('phones')}</option>
            <option value="vehicle">{t('vehicles')}</option>
            <option value="location">{t('locations')}</option>
            <option value="org">{t('organizations')}</option>
          </select>
          <button onClick={() => cyRef.current?.fit(undefined, 40)} className="text-sm px-3 py-1.5 border border-nexus-border rounded-md hover:bg-nexus-surface">{t('resetZoom')}</button>
          <button onClick={() => setExpandedNodeIds(entities.map(e => e.id))} className="text-sm px-3 py-1.5 border border-nexus-border rounded-md hover:bg-nexus-surface">{t('expandAll')}</button>
          <button onClick={() => setExpandedNodeIds([])} className="text-sm px-3 py-1.5 border border-nexus-border rounded-md hover:bg-nexus-surface">{t('collapseAll')}</button>
          <button onClick={handleExport} className="text-sm px-3 py-1.5 bg-nexus-blue text-white rounded-md hover:bg-nexus-blue-light">{t('exportGraph')}</button>
        </div>
      </div>

      {/* Timeline filter */}
      <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-3 lg:p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <label className="text-sm font-medium text-nexus-text-secondary">{t('timeline')}</label>
          <div className="flex gap-1.5" role="group" aria-label="Timeline presets">
            {TIMELINE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setDateRange(p.range)}
                className={`text-xs px-2 py-1 rounded-md border transition ${dateRange[0] === p.range[0] && dateRange[1] === p.range[1] ? 'bg-nexus-blue text-white border-nexus-blue' : 'border-nexus-border text-nexus-text-secondary hover:bg-nexus-surface'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateRange[0]}
            onChange={e => setDateRange([e.target.value, dateRange[1]])}
            className="border border-nexus-border rounded-md px-2.5 py-1.5 text-sm"
            aria-label="Start date"
          />
          <div className="flex-1 relative h-6 flex items-center">
            <div className="w-full h-1 bg-nexus-border rounded-full" />
            <div
              className="absolute h-1 bg-nexus-blue rounded-full"
              style={{
                left: `${pct(dateRange[0])}%`,
                width: `${pct(dateRange[1]) - pct(dateRange[0])}%`,
              }}
            />
            {crimeEvents.map(ce => (
              <button
                key={ce.id}
                className="absolute w-3.5 h-3.5 bg-nexus-risk-high rounded-full border-2 border-white -translate-x-1/2 cursor-pointer hover:scale-150 transition focus-visible:outline focus-visible:outline-2"
                style={{ left: `${pct(ce.date)}%` }}
                title={`FIR ${ce.firNumber} — ${ce.date}`}
                aria-label={`Focus on crime FIR ${ce.firNumber} (${ce.date})`}
                onClick={() => setDateRange([iso(new Date(new Date(ce.date).getTime() - 7 * 86400000)), ce.date])}
              />
            ))}
          </div>
          <input
            type="date"
            value={dateRange[1]}
            onChange={e => setDateRange([dateRange[0], e.target.value])}
            className="border border-nexus-border rounded-md px-2.5 py-1.5 text-sm"
            aria-label="End date"
          />
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-nexus-border overflow-hidden relative min-h-[420px]">
        <div ref={containerRef} className="absolute inset-0" aria-label="Network graph visualization" role="img" />

        {/* Legend */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-lg border border-nexus-border p-3 text-xs space-y-1.5 z-10" role="complementary" aria-label="Graph legend">
          {Object.entries(entityTypeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="capitalize">{type === 'org' ? t('organizations') : type === 'person' ? t('persons') : t(pluralKey(type))}</span>
            </div>
          ))}
          <div className="border-t border-nexus-border pt-1 mt-1">
            <p className="font-medium mb-1">Edge Types</p>
            {Object.entries(relTypeStyles).map(([type, style]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="w-4 border-t-2" style={{ borderColor: style.color, borderStyle: style.dash ? 'dashed' : 'solid' }} aria-hidden="true" />
                <span className="capitalize">{type.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-nexus-border pt-1 mt-1 text-nexus-text-secondary">
            <p className="font-medium mb-1">Size ∝ centrality · Red ring = high risk</p>
          </div>
        </div>

        {/* Selection side panel */}
        {selectedNode && (
          <aside
            className="absolute right-3 top-3 w-64 bg-white rounded-xl shadow-xl border border-nexus-border p-4 z-20 text-sm max-h-[calc(100%-1.5rem)] overflow-y-auto"
            aria-label={`Selected entity: ${selectedNode.name}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: entityTypeColors[selectedNode.type] }}
                  aria-hidden="true"
                >
                  {selectedNode.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="font-bold truncate">{selectedNode.name}</p>
                  <p className="text-xs text-nexus-text-secondary capitalize">{selectedNode.type} · {selectedNode.id}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedNodeId(null); cyRef.current?.$('node.selected').removeClass('selected'); }}
                className="text-nexus-text-secondary hover:text-nexus-text p-1 rounded hover:bg-nexus-surface flex-shrink-0"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedNode.riskScore >= 70 ? 'bg-red-100 text-nexus-risk-high' : selectedNode.riskScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}
              >
                {t('riskLevel')}: {selectedNode.riskScore}/100
              </span>
              <span className="text-xs text-nexus-text-secondary">{neighbors.length} {t('connections')}</span>
            </div>

            {selectedCs && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-nexus-text-secondary">{t('influence')} (PageRank)</span>
                  <span className="font-mono">{(selectedCs.pageRank * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-nexus-surface rounded-full overflow-hidden">
                  <div className="h-full bg-nexus-blue rounded-full" style={{ width: `${Math.min(selectedCs.pageRank * 500, 100)}%` }} />
                </div>
              </div>
            )}

            {neighbors.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-nexus-text-secondary mb-1.5">{t('associatedNodes')}</p>
                <ul className="space-y-0.5">
                  {neighbors.slice(0, 6).map(n => (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          setSelectedNodeId(n.id);
                          cyRef.current?.$('node.selected').removeClass('selected');
                          cyRef.current?.getElementById(n.id).addClass('selected');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-nexus-surface text-left"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entityTypeColors[n.type] }} aria-hidden="true" />
                        <span className="text-xs font-medium truncate flex-1">{n.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: riskColor(n.riskScore) }} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => toggleNode(selectedNode.id)}
                className="flex-1 text-xs px-2 py-1.5 bg-nexus-blue text-white rounded-md hover:bg-nexus-blue-light"
              >
                {expandedNodeIds.includes(selectedNode.id) ? t('collapse') : t('expandNeighborhood')}
              </button>
              <button
                onClick={() => { openProfile(selectedNode.id); }}
                className="flex-1 text-xs px-2 py-1.5 border border-nexus-blue text-nexus-blue rounded-md hover:bg-nexus-blue/5"
              >
                Dossier
              </button>
            </div>
          </aside>
        )}

        {/* Hint bar */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full border border-nexus-border px-3 py-1 text-[11px] text-nexus-text-secondary z-10">
          Hover = details · Click = select + panel · Enter = dossier · Esc = close · Drag = move · Scroll = zoom
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 16, window.innerWidth - 320),
            top: Math.max(tooltip.y - 8, 8),
          }}
          role="tooltip"
        >
          {tooltip.kind === 'node' && (
            <NodeTooltipView data={tooltip.payload as NodeTooltipData} t={t} />
          )}
          {tooltip.kind === 'edge' && (
            <EdgeTooltipView data={tooltip.payload as EdgeTooltipData} t={t} />
          )}
        </div>
      )}
    </div>
  );
}

function pluralKey(type: string) {
  switch (type) {
    case 'phone': return 'phones' as const;
    case 'vehicle': return 'vehicles' as const;
    case 'location': return 'locations' as const;
    default: return 'persons' as const;
  }
}

function NodeTooltipView({ data, t }: { data: NodeTooltipData; t: (k: TranslationKey) => string }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-nexus-border p-4 w-64 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entityTypeColors[data.type as EntityType] }} aria-hidden="true" />
        <span className="font-bold text-base">{data.name}</span>
      </div>
      <div className="space-y-1 text-xs text-nexus-text-secondary">
        <p><span className="font-medium text-nexus-text">ID:</span> {data.id}</p>
        <p><span className="font-medium text-nexus-text">{t('type')}:</span> {data.type}</p>
        {data.role && <p><span className="font-medium text-nexus-text">{t('role')}:</span> {data.role}</p>}
        <p>
          <span className="font-medium text-nexus-text">{t('riskLevel')}:</span>{' '}
          <span className="font-semibold" style={{ color: Number(data.riskScore) >= 70 ? '#DC2626' : Number(data.riskScore) >= 40 ? '#F59E0B' : '#16A34A' }}>
            {data.riskScore}/100
          </span>
        </p>
        <p><span className="font-medium text-nexus-text">{t('connections')}:</span> {data.connectionCount}</p>
        <p><span className="font-medium text-nexus-text">{t('community')}:</span> #{data.communityId}</p>
        {data.top3Associates.length > 0 && (
          <div>
            <p className="font-medium text-nexus-text">{t('associatedNodes')}:</p>
            <ul className="ml-2 list-disc">
              {data.top3Associates.map((a, i) => <li key={i} className="break-words">{a}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function EdgeTooltipView({ data, t }: { data: EdgeTooltipData; t: (k: TranslationKey) => string }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-nexus-border p-4 w-72 text-sm">
      <p className="font-bold mb-2 capitalize">{t('relationshipType')}: {data.relTypes.replace('-', ' ')}</p>
      <div className="space-y-1 text-xs text-nexus-text-secondary">
        <p><span className="font-medium text-nexus-text">{t('contactCount')}:</span> {data.count}</p>
        {data.source && <p><span className="font-medium text-nexus-text">Between:</span> {data.source} ↔ {data.target}</p>}
        <p><span className="font-medium text-nexus-text">{t('connections')}:</span></p>
        <p className="ml-2">{(data.timestamps || []).slice(-3).join(', ') || '—'}</p>
        {data.isBeforeCrime && (
          <div className="mt-2 p-2 bg-red-50 rounded-md border border-red-200">
            <p className="text-nexus-risk-high font-semibold text-xs">
              FLAGGED — {data.count || ''} contacts in the 72 hours before FIR #{data.firNumber} ({data.crimeDate})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}