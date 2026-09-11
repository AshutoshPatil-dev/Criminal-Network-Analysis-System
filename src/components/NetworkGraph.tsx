import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import cytoscape, { type Core, type EventObject, type LayoutOptions } from 'cytoscape';
import { useApp } from '../store';
import type { EntityType, RelationshipType } from '../types';

// Crisp White & Navy Blue Police Vector Badges (No Grey Boxes)
function createTacticalSvgUri(type: EntityType, riskScore: number): string {
  const isHighRisk = riskScore >= 70;
  const isKingpin = riskScore >= 85;
  const strokeColor = isKingpin ? '#F59E0B' : isHighRisk ? '#DC2626' : '#FFFFFF';
  const strokeWidth = isHighRisk || isKingpin ? '3.5' : '2';

  let innerSvg = '';

  switch (type) {
    case 'person':
      innerSvg = `
        <circle cx="32" cy="32" r="29" fill="#0B3D91" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <circle cx="32" cy="24" r="7" fill="#FFFFFF" />
        <path d="M19 46c0-6 6.5-9 13-9s13 3 13 9v2H19v-2z" fill="#FFFFFF" />
        ${isHighRisk ? '<circle cx="50" cy="14" r="5" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5" />' : ''}
      `;
      break;

    case 'phone':
      innerSvg = `
        <rect x="5" y="5" width="54" height="54" rx="14" fill="#312E81" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <rect x="22" y="14" width="20" height="36" rx="4" fill="#FFFFFF" fill-opacity="0.15" stroke="#FFFFFF" stroke-width="2" />
        <circle cx="32" cy="44" r="2" fill="#FFFFFF" />
        <line x1="28" y1="18" x2="36" y2="18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
        <path d="M44 24a8 8 0 0 1 0 16m4-20a14 14 0 0 1 0 24" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" fill="none" />
      `;
      break;

    case 'vehicle':
      innerSvg = `
        <polygon points="32,4 60,32 32,60 4,32" fill="#0284C7" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <path d="M22 36l2.5-6h15l2.5 6H44v4h-2v-1H22v1h-2v-4h2zm4-1.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm16 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="#FFFFFF" />
      `;
      break;

    case 'location':
      innerSvg = `
        <circle cx="32" cy="32" r="29" fill="#059669" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <path d="M32 16c-5.5 0-10 4.5-10 10 0 7.5 10 18 10 18s10-10.5 10-18c0-5.5-4.5-10-10-10zm0 13.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" fill="#FFFFFF" />
      `;
      break;

    case 'org':
    default:
      innerSvg = `
        <rect x="6" y="6" width="52" height="52" rx="12" fill="#6B21A8" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <path d="M18 46V22l14-8 14 8v24H34V34h-4v12H18zm4-16h4v-4h-4v4zm16 0h4v-4h-4v4z" fill="#FFFFFF" />
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${innerSvg}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Edge colors by relationship
function getEdgeColor(type: RelationshipType): string {
  switch (type) {
    case 'call': return '#2563EB';         // Electric Blue
    case 'transaction': return '#D97706';  // Amber Gold
    case 'meeting': return '#7C3AED';      // Purple
    case 'co-accused': return '#DC2626';   // Crimson Alert
    case 'ownership': return '#059669';    // Emerald Green
    case 'associate':
    default: return '#64748B';            // Slate
  }
}

export default function NetworkGraph() {
  const {
    entities,
    relationships,
    selectedEntityId,
    setSelectedEntityId,
    openProfile,
    dateRange,
  } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [layoutName, setLayoutName] = useState<'cose' | 'concentric' | 'breadthfirst'>('cose');
  const [sourcePathId, setSourcePathId] = useState<string>('');
  const [targetPathId, setTargetPathId] = useState<string>('');
  const [pathResult, setPathResult] = useState<string | null>(null);
  const [spacingMultiplier, setSpacingMultiplier] = useState<number>(1.6); // Spacing controller

  // Selected Entity Details
  const selectedEntity = useMemo(
    () => entities.find(e => e.id === selectedEntityId) || null,
    [entities, selectedEntityId]
  );

  // Filter entities by date and type
  const filteredRelationships = useMemo(() => {
    return relationships.filter(rel => {
      if (!rel.timestamps || rel.timestamps.length === 0) return true;
      return rel.timestamps.some(ts => ts >= dateRange[0] && ts <= dateRange[1]);
    });
  }, [relationships, dateRange]);

  const activeEntityIds = useMemo(() => {
    const ids = new Set<string>();
    filteredRelationships.forEach(r => {
      ids.add(r.source);
      ids.add(r.target);
    });
    return ids;
  }, [filteredRelationships]);

  const filteredEntities = useMemo(() => {
    return entities.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      return activeEntityIds.size === 0 || activeEntityIds.has(e.id);
    });
  }, [entities, typeFilter, activeEntityIds]);

  // Convert to Cytoscape Elements
  const elements = useMemo(() => {
    const nodes = filteredEntities.map(e => {
      const size = e.riskScore >= 80 ? 52 : e.riskScore >= 50 ? 44 : 38;
      return {
        data: {
          id: e.id,
          name: e.name,
          type: e.type,
          role: e.attributes.role || e.type.toUpperCase(),
          riskScore: e.riskScore,
          image: createTacticalSvgUri(e.type, e.riskScore),
          size,
        },
      };
    });

    const validNodeIds = new Set(filteredEntities.map(e => e.id));

    const edges = filteredRelationships
      .filter(r => validNodeIds.has(r.source) && validNodeIds.has(r.target))
      .map((r, i) => ({
        data: {
          id: `e-${r.source}-${r.target}-${i}`,
          source: r.source,
          target: r.target,
          type: r.type,
          label: r.count > 1 ? `${r.count}x` : '',
          color: getEdgeColor(r.type),
          width: Math.min(Math.max(r.count * 0.9, 1.8), 4),
          lineStyle: r.type === 'call' && r.count < 3 ? 'dashed' : 'solid',
        },
      }));

    return [...nodes, ...edges];
  }, [filteredEntities, filteredRelationships]);

  // Apply Shortest Path
  const handleFindPath = useCallback(() => {
    if (!cyRef.current || !sourcePathId || !targetPathId) return;
    const cy = cyRef.current;

    const startNode = cy.$(`#${sourcePathId}`);
    const endNode = cy.$(`#${targetPathId}`);

    if (startNode.length === 0 || endNode.length === 0) {
      setPathResult('Selected nodes not visible in current filter.');
      return;
    }

    const aStar = cy.elements().aStar({
      root: startNode,
      goal: endNode,
      directed: false,
    });

    if (aStar.found) {
      cy.elements().removeClass('highlighted').addClass('dimmed');
      aStar.path.removeClass('dimmed').addClass('highlighted');
      setPathResult(`Connection Verified (${aStar.distance} Hops)`);
    } else {
      setPathResult('No direct or intermediary path found.');
    }
  }, [sourcePathId, targetPathId]);

  const handleResetPath = () => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass('dimmed').removeClass('highlighted');
    setSourcePathId('');
    setTargetPathId('');
    setPathResult(null);
  };

  // High-Separation Layout Configuration (Anti-Clumping)
  const layoutConfig: LayoutOptions = useMemo(() => {
    if (layoutName === 'concentric') {
      return {
        name: 'concentric',
        animate: true,
        animationDuration: 600,
        concentric: (node: cytoscape.NodeSingular) => (node.data('riskScore') as number) || 0,
        levelWidth: () => 20,
        minNodeSpacing: 80 * spacingMultiplier,
        spacingFactor: spacingMultiplier,
      } as unknown as LayoutOptions;
    }

    if (layoutName === 'breadthfirst') {
      return {
        name: 'breadthfirst',
        directed: false,
        animate: true,
        animationDuration: 600,
        spacingFactor: spacingMultiplier * 1.3,
        circle: false,
      } as unknown as LayoutOptions;
    }

    // High-Repulsion Organic COSE (Spacious & Clean)
    return {
      name: 'cose',
      animate: true,
      animationDuration: 700,
      nodeDimensionsIncludeLabels: true, // Crucial: Engine accounts for label size
      idealEdgeLength: () => 110 * spacingMultiplier,
      nodeRepulsion: () => 18000 * spacingMultiplier,
      nodeOverlap: 2,
      gravity: 0.18, // Reduced gravity prevents central crunch
      componentSpacing: 140 * spacingMultiplier,
      edgeElasticity: () => 32,
      nestingFactor: 1.2,
      numIter: 1000,
      coolingFactor: 0.99,
      minTemp: 1.0,
    } as unknown as LayoutOptions;
  }, [layoutName, spacingMultiplier]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: 'node',
          style: {
            'width': 'data(size)',
            'height': 'data(size)',
            'background-image': 'data(image)',
            'background-fit': 'contain',
            'background-opacity': 0,
            'border-width': 0,
            'label': 'data(name)',
            'font-family': 'Inter, system-ui, sans-serif',
            'font-size': '10.5px',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'color': '#0F172A',
            'text-background-color': '#FFFFFF',
            'text-background-opacity': 0.96,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-border-color': '#CBD5E1',
            'text-border-width': 1,
            'text-border-opacity': 0.85,
            'text-max-width': '110px',
            'text-wrap': 'ellipsis',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#0B3D91',
            'border-opacity': 1,
            'underlay-color': '#0B3D91',
            'underlay-padding': '6px',
            'underlay-opacity': 0.25,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(width)',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'control-point-step-size': 35, // Curved edges don't stack on each other
            'line-style': 'solid',
            'opacity': 0.75,
            'label': 'data(label)',
            'font-size': '8.5px',
            'font-weight': 'bold',
            'color': '#475569',
            'text-background-color': '#FFFFFF',
            'text-background-opacity': 0.88,
            'text-background-padding': '2px',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'node.spotlight',
          style: {
            'opacity': 1,
            'underlay-color': '#0B3D91',
            'underlay-padding': '8px',
            'underlay-opacity': 0.35,
          },
        },
        {
          selector: 'edge.spotlight',
          style: {
            'opacity': 1,
            'width': 3.5,
          },
        },
        {
          selector: '.spotlight-dim',
          style: {
            'opacity': 0.15,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'opacity': 1,
            'underlay-color': '#D97706',
            'underlay-padding': '8px',
            'underlay-opacity': 0.45,
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'opacity': 1,
            'line-color': '#D97706',
            'target-arrow-color': '#D97706',
            'width': 4.5,
          },
        },
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.12,
          },
        },
      ],
      layout: layoutConfig,
    });

    // Select Entity on tap
    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      setSelectedEntityId(node.id());
    });

    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        setSelectedEntityId(null);
      }
    });

    // Palantir Hover Spotlight: Focus on hovered node & direct contacts only!
    cy.on('mouseover', 'node', (evt: EventObject) => {
      const target = evt.target;
      cy.elements().addClass('spotlight-dim');
      target.removeClass('spotlight-dim').addClass('spotlight');
      target.neighborhood().removeClass('spotlight-dim').addClass('spotlight');
    });

    cy.on('mouseout', 'node', () => {
      cy.elements().removeClass('spotlight-dim').removeClass('spotlight');
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [elements, layoutConfig, setSelectedEntityId]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 font-sans">
      {/* Top Intelligence Action Bar (Crisp White / Police Navy) */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Left: Filters & Layouts */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter:</span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Entities ({entities.length})</option>
            <option value="person">Suspects ({entities.filter(e => e.type === 'person').length})</option>
            <option value="phone">Phones ({entities.filter(e => e.type === 'phone').length})</option>
            <option value="vehicle">Vehicles ({entities.filter(e => e.type === 'vehicle').length})</option>
            <option value="location">Locations ({entities.filter(e => e.type === 'location').length})</option>
          </select>

          {/* Layout Presets */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setLayoutName('cose')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${layoutName === 'cose' ? 'bg-[#0B3D91] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              title="Physics layout with anti-collision spacing"
            >
              Organic
            </button>
            <button
              onClick={() => setLayoutName('concentric')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${layoutName === 'concentric' ? 'bg-[#0B3D91] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              title="Kingpins in center, associates in outer orbit"
            >
              Orbit Hierarchy
            </button>
            <button
              onClick={() => setLayoutName('breadthfirst')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${layoutName === 'breadthfirst' ? 'bg-[#0B3D91] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              title="Clean tree layout"
            >
              Command Tree
            </button>
          </div>

          {/* Node Spacing Slider */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
            <span className="text-[11px] font-medium">Spacing:</span>
            <input
              type="range"
              min="1.0"
              max="2.4"
              step="0.2"
              value={spacingMultiplier}
              onChange={e => setSpacingMultiplier(parseFloat(e.target.value))}
              className="w-16 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-[#0B3D91]"
              title="Adjust node spacing to de-clutter"
            />
          </div>
        </div>

        {/* Center: Find Connection (Shortest Path) */}
        <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200 px-3 py-1 rounded-xl">
          <span className="text-xs font-bold text-[#0B3D91] flex items-center gap-1">
            Trace Path:
          </span>
          <select
            value={sourcePathId}
            onChange={e => setSourcePathId(e.target.value)}
            className="text-xs bg-white border border-blue-200 rounded-md px-2 py-1 max-w-[130px] truncate text-slate-800"
          >
            <option value="">Suspect A...</option>
            {entities.filter(e => e.type === 'person').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <span className="text-slate-400 text-xs">➔</span>

          <select
            value={targetPathId}
            onChange={e => setTargetPathId(e.target.value)}
            className="text-xs bg-white border border-blue-200 rounded-md px-2 py-1 max-w-[130px] truncate text-slate-800"
          >
            <option value="">Suspect B...</option>
            {entities.filter(e => e.type === 'person').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={handleFindPath}
            disabled={!sourcePathId || !targetPathId}
            className="bg-[#0B3D91] hover:bg-[#1A52B8] disabled:opacity-40 text-white font-semibold px-2.5 py-1 rounded-md text-xs shadow-xs cursor-pointer"
          >
            Trace
          </button>
          {pathResult && (
            <button
              onClick={handleResetPath}
              className="text-slate-500 hover:text-slate-800 text-xs px-1 cursor-pointer"
              title="Reset Path Trace"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => cyRef.current?.fit(undefined, 50)}
            className="text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
          >
            Reset View
          </button>
          <button
            onClick={() => {
              if (!cyRef.current) return;
              const png = cyRef.current.png({ full: true, scale: 2 });
              const link = document.createElement('a');
              link.href = png;
              link.download = `nexus-intelligence-graph-${new Date().toISOString().slice(0, 10)}.png`;
              link.click();
            }}
            className="text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-[#0B3D91] px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
          >
            Export PNG
          </button>
        </div>
      </header>

      {/* Path result banner if any */}
      {pathResult && (
        <div className="bg-[#0B3D91] text-white text-xs px-4 py-1.5 font-medium flex items-center justify-between shadow-xs">
          <span>{pathResult}</span>
          <button onClick={handleResetPath} className="underline text-blue-200 hover:text-white cursor-pointer">
            Clear highlight
          </button>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-[#F8FAFC]">
        {/* Tactical Dot Grid Pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-35"
          style={{
            backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Cytoscape Container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Bottom-Left Legend */}
        <aside className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-2 z-10">
          <div className="font-bold text-slate-700 border-b border-slate-200 pb-1 text-[11px] uppercase tracking-wider">
            Network Entities
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0B3D91]" /> Suspect
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#312E81]" /> Phone SIM
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rotate-45 bg-[#0284C7]" /> Vehicle
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#059669]" /> Location
            </div>
          </div>
          <div className="border-t border-slate-100 pt-1 text-[10px] text-slate-500">
            Hover over any node to highlight its direct contacts
          </div>
        </aside>

        {/* Right Slide-over Inspector Card for Selected Suspect */}
        {selectedEntity && (
          <aside className="absolute top-4 right-4 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 text-slate-800 z-20 animate-in fade-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-[#0B3D91]">
                  {selectedEntity.type}
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">
                  {selectedEntity.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedEntity.attributes.role || 'Unspecified Role'}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntityId(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Risk Score Gauge */}
            <div className="my-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Threat Score</div>
                <div className={`text-lg font-black ${selectedEntity.riskScore >= 70 ? 'text-red-600' : selectedEntity.riskScore >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {selectedEntity.riskScore} / 100
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${selectedEntity.riskScore >= 70 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                {selectedEntity.riskScore >= 70 ? 'HIGH RISK' : 'MEDIUM'}
              </span>
            </div>

            {/* Entity Attributes */}
            <div className="space-y-1.5 text-xs text-slate-600 mb-4">
              {Object.entries(selectedEntity.attributes).map(([key, val]) => (
                <div key={key} className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="capitalize text-slate-400 font-medium">{key}:</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[170px]">{val}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => openProfile(selectedEntity.id)}
                className="flex-1 bg-[#0B3D91] hover:bg-[#1A52B8] text-white py-2 rounded-xl text-xs font-bold shadow-xs text-center cursor-pointer"
              >
                Full Dossier
              </button>
              <button
                onClick={() => setSourcePathId(selectedEntity.id)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                title="Set as starting point for path trace"
              >
                Set Trace A
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}