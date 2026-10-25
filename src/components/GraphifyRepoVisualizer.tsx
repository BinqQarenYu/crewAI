import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  GitFork,
  Search,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RotateCcw,
  Code2,
  Cpu,
  Boxes,
  ZoomIn,
  ZoomOut,
  Hand,
  Compass,
  Move,
  Crosshair,
  Network,
  GitMerge,
  Layers,
  UserCheck
} from 'lucide-react';
import { CrewConfig } from '../types';
import { PRESET_CREWS } from './CrewStudio';
import {
  GraphifyAlignedModule,
  WORKFLOW_AUTOSAVE_KEY,
  buildAlignedGraphifyModules
} from '../utils/unifiedGraphEngine';

export type RepoNode = GraphifyAlignedModule;

export interface GraphifyRepoVisualizerProps {
  onTaskJules?: (node: RepoNode) => void;
  selectedRepo: string;
  selectedBranch: string;
  focusedModuleId?: string | null;
  onOpenLangGraphNode?: (langGraphNodeId: string) => void;
  onOpenFlowStep?: (taskId?: string) => void;
  onOpenCrewStudio?: () => void;
}

export const GraphifyRepoVisualizer: React.FC<GraphifyRepoVisualizerProps> = ({
  onTaskJules,
  selectedRepo,
  selectedBranch,
  focusedModuleId,
  onOpenLangGraphNode,
  onOpenFlowStep,
  onOpenCrewStudio
}) => {
  const loadActiveCrew = useCallback((): CrewConfig => {
    try {
      const raw = localStorage.getItem(WORKFLOW_AUTOSAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.crew?.agents?.length > 0) {
          return parsed.crew;
        }
      }
    } catch {
      // ignore
    }
    return PRESET_CREWS.full_stack_app;
  }, []);

  const [activeCrew, setActiveCrew] = useState<CrewConfig>(loadActiveCrew);
  const alignedModules = useMemo(() => buildAlignedGraphifyModules(activeCrew), [activeCrew]);
  const [realDiskAstMode, setRealDiskAstMode] = useState<boolean>(true);
  const [realDiskNodes, setRealDiskNodes] = useState<RepoNode[]>([]);
  const [loadingDiskAst, setLoadingDiskAst] = useState<boolean>(false);

  const fetchRealDiskAst = useCallback(async (forceRescan = false) => {
    setLoadingDiskAst(true);
    try {
      const res = await fetch(forceRescan ? '/api/fullstack/ast/scan' : '/api/fullstack/ast/latest', {
        method: forceRescan ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: forceRescan ? JSON.stringify({ maxFiles: 35 }) : undefined
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.nodes) && data.nodes.length > 0) {
        const rawEdges: Array<{ from: string; to: string }> = Array.isArray(data.edges) ? data.edges : [];
        const mapped: RepoNode[] = data.nodes.map((n: any, i: number) => {
          const outbound = rawEdges.filter((e) => e.from === n.id).map((e) => e.to);
          const inbound = rawEdges.filter((e) => e.to === n.id).map((e) => e.from);
          const assignedAgent = activeCrew.agents[i % Math.max(1, activeCrew.agents.length)];
          const layerMap: Record<string, RepoNode['layer']> = {
            core_runtime: 'data',
            backend_api: 'config',
            ui_component: 'ui',
            utilities: 'types'
          };
          return {
            id: n.id,
            name: n.name,
            path: `/${n.path}`,
            layer: layerMap[n.layer] || 'data',
            layerLabel: n.language === 'python' ? 'Python 3.10 AST' : 'TypeScript AST',
            domainCategory: n.language === 'python' ? 'backend' : 'frontend',
            type: n.layer === 'ui_component' ? 'component' : n.layer === 'backend_api' ? 'config' : 'store',
            loc: Number(n.lines || 0),
            description: `Real parsed ${n.language.toUpperCase()} AST on disk • Cyclomatic Complexity: ${n.complexity} • Classes: ${(n.classes || []).slice(0, 3).join(', ') || 'none'}`,
            inbound,
            outbound,
            exports: [...(n.classes || []), ...(n.functions || [])].slice(0, 8),
            x: Number(n.x || 80 + (i % 5) * 290),
            y: Number(n.y || 80 + Math.floor(i / 5) * 210),
            assignedAgentId: assignedAgent?.id,
            assignedAgentName: assignedAgent?.name,
            assignedAgentRole: assignedAgent?.role
          };
        });
        setRealDiskNodes(mapped);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDiskAst(false);
    }
  }, [activeCrew.agents]);

  useEffect(() => {
    fetchRealDiskAst(false);
  }, [fetchRealDiskAst]);

  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>(focusedModuleId || 'unified-graph-engine-ts');
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLayer, setSelectedLayer] = useState<string>('all');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');

  // Interactive Pan, Zoom & Drag State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 24, y: 18 });
  const [zoom, setZoom] = useState<number>(0.86);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const pointerStartRef = useRef<{
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({
    clientX: 0,
    clientY: 0,
    originX: 0,
    originY: 0,
    moved: false
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Merge base aligned modules (or Real Disk AST modules) with any user drag position overrides
  const nodes: RepoNode[] = useMemo(() => {
    const baseList = realDiskAstMode && realDiskNodes.length > 0 ? realDiskNodes : alignedModules;
    return baseList.map((mod) => {
      const override = positionOverrides[mod.id];
      return override ? { ...mod, x: override.x, y: override.y } : mod;
    });
  }, [alignedModules, realDiskAstMode, realDiskNodes, positionOverrides]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // Sync with active Crew changes across tabs
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.crew) {
        setActiveCrew(detail.crew);
      } else {
        setActiveCrew(loadActiveCrew());
      }
    };
    window.addEventListener('crewai:workflow-synced', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('crewai:workflow-synced', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadActiveCrew]);

  // Focus module when requested from LangGraph or Flow DAG
  useEffect(() => {
    if (focusedModuleId && nodes.some((n) => n.id === focusedModuleId)) {
      setSelectedNodeId(focusedModuleId);
      handleCenterOnNode(focusedModuleId);
    }
  }, [focusedModuleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cursor-centered Mouse Wheel Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(2.4, Math.max(0.35, Number((prevZoom * zoomFactor).toFixed(2))));
        const scaleRatio = nextZoom / prevZoom;
        setPan((prevPan) => ({
          x: Math.round(mouseX - (mouseX - prevPan.x) * scaleRatio),
          y: Math.round(mouseY - (mouseY - prevPan.y) * scaleRatio)
        }));
        return nextZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning && !draggingNodeId) return;

      const dx = e.clientX - pointerStartRef.current.clientX;
      const dy = e.clientY - pointerStartRef.current.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        pointerStartRef.current.moved = true;
      }

      if (isPanning) {
        setPan({
          x: Math.round(pointerStartRef.current.originX + dx),
          y: Math.round(pointerStartRef.current.originY + dy)
        });
      } else if (draggingNodeId) {
        const scaledDx = dx / zoom;
        const scaledDy = dy / zoom;
        const nextX = Math.max(10, Math.min(1650, Math.round(pointerStartRef.current.originX + scaledDx)));
        const nextY = Math.max(10, Math.min(1150, Math.round(pointerStartRef.current.originY + scaledDy)));
        setPositionOverrides((prev) => ({
          ...prev,
          [draggingNodeId]: { x: nextX, y: nextY }
        }));
      }
    },
    [isPanning, draggingNodeId, zoom]
  );

  const handleGlobalMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
  }, []);

  useEffect(() => {
    if (isPanning || draggingNodeId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isPanning, draggingNodeId, handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleMouseDownCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false
    };
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: RepoNode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: node.x,
      originY: node.y,
      moved: false
    };
  };

  const handleZoomBy = (delta: number) => {
    const container = containerRef.current;
    const centerX = container ? container.clientWidth / 2 : 420;
    const centerY = container ? container.clientHeight / 2 : 320;

    setZoom((prevZoom) => {
      const nextZoom = Math.min(2.4, Math.max(0.35, Number((prevZoom + delta).toFixed(2))));
      const scaleRatio = nextZoom / prevZoom;
      setPan((prevPan) => ({
        x: Math.round(centerX - (centerX - prevPan.x) * scaleRatio),
        y: Math.round(centerY - (centerY - prevPan.y) * scaleRatio)
      }));
      return nextZoom;
    });
  };

  const handleFitView = () => {
    setPan({ x: 24, y: 18 });
    setZoom(0.86);
  };

  const handleCenterOnNode = (nodeId?: string) => {
    const target = nodes.find((n) => n.id === (nodeId || selectedNodeId)) || selectedNode;
    const container = containerRef.current;
    if (!target || !container) return;

    const targetZoom = Math.max(zoom, 1.0);
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    setZoom(targetZoom);
    setPan({
      x: Math.round(centerX - (target.x + 100) * targetZoom),
      y: Math.round(centerY - (target.y + 42) * targetZoom)
    });
  };

  const handleResetNodeLayout = () => {
    setPositionOverrides({});
    handleFitView();
  };

  const hasCustomNodePositions = Object.keys(positionOverrides).length > 0;

  // Filtering by layer, assigned agent, and search query
  const filteredNodes = nodes.filter((node) => {
    const matchesLayer = selectedLayer === 'all' || node.layer === selectedLayer;
    const matchesAgent =
      selectedAgentFilter === 'all' || node.assignedAgentId === selectedAgentFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      node.name.toLowerCase().includes(q) ||
      node.path.toLowerCase().includes(q) ||
      node.description.toLowerCase().includes(q) ||
      (node.assignedAgentName || '').toLowerCase().includes(q) ||
      (node.alignedTaskName || '').toLowerCase().includes(q);
    return matchesLayer && matchesAgent && matchesSearch;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'entry':
        return '#EB6658';
      case 'ui':
        return '#38BDF8';
      case 'data':
        return '#34D399';
      case 'types':
        return '#F59E0B';
      case 'config':
        return '#A78BFA';
      default:
        return '#94A3B8';
    }
  };

  const graphifyCliCommand = `git clone https://github.com/Graphify-Labs/graphify.git
pip install -e graphify
python -m graphify scan . --crew "${activeCrew.name}" --output repo_graph.json --visualize`;

  return (
    <div className={`space-y-5 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0B0F19] p-6 overflow-y-auto' : ''}`}>
      {/* Top Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white">
                Graphify Repository Knowledge Graph ({selectedRepo})
              </h2>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-xs font-mono text-emerald-400">
                Aligned with {activeCrew.name} ({activeCrew.agents.length} Agents · {nodes.length} Modules)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Every repository file is mapped to its governing CrewAI Agent, LangGraph Actor node, and Event Flow decorator.
            </p>
          </div>
        </div>

        {/* Filter & Canvas Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter module, agent, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-[#EB6658]"
            />
          </div>

          <select
            aria-label="Filter by Assigned CrewAI Agent / LangGraph Actor"
            value={selectedAgentFilter}
            onChange={(e) => setSelectedAgentFilter(e.target.value)}
            className="bg-slate-950 text-xs text-slate-300 font-medium px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-[#EB6658] cursor-pointer"
          >
            <option value="all">All Assigned Agents ({activeCrew.agents.length})</option>
            {activeCrew.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} — {agent.role}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Architectural Layer"
            value={selectedLayer}
            onChange={(e) => setSelectedLayer(e.target.value)}
            className="bg-slate-950 text-xs text-slate-300 font-medium px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-[#EB6658] cursor-pointer"
          >
            <option value="all">All Layers ({nodes.length})</option>
            <option value="entry">Entry & Bootstrap</option>
            <option value="ui">UI & Graph Views</option>
            <option value="data">Data & Graph Engine</option>
            <option value="types">Types & Contracts</option>
            <option value="config">Backend & Standalone</option>
          </select>

          <button
            onClick={() => setRealDiskAstMode((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              realDiskAstMode
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle between Real Parsed Disk AST (Python 3.10 ast + TS) and Aligned Architecture Modules"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{realDiskAstMode ? `Real Disk AST (${realDiskNodes.length} files)` : 'Aligned Mode'}</span>
          </button>

          {realDiskAstMode && (
            <button
              onClick={() => fetchRealDiskAst(true)}
              disabled={loadingDiskAst}
              className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-xs text-purple-300 hover:bg-purple-600/30 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Run live Python 3.10 ast + TypeScript disk scan and save snapshot to SQLite"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loadingDiskAst ? 'animate-spin' : ''}`} />
              <span>{loadingDiskAst ? 'Scanning...' : 'Rescan Disk'}</span>
            </button>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* Main Graph Grid: Interactive Canvas Left & Inspector Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Dynamic Canvas (8 cols) */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDownCanvas}
          onDoubleClick={handleFitView}
          className={`lg:col-span-8 rounded-2xl border border-slate-800 bg-[#070A12] overflow-hidden flex flex-col relative select-none ${
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          } ${isFullscreen ? 'h-[80vh]' : 'h-[680px]'}`}
        >
          {/* Dynamic Grid Background with Pan & Zoom */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#1e293b 1.25px, transparent 1.25px)',
              backgroundSize: `${Math.max(12, Math.round(24 * zoom))}px ${Math.max(12, Math.round(24 * zoom))}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              opacity: 0.65
            }}
          />

          {/* Top-Left Gesture Hints */}
          <div className="absolute top-3 left-3 z-30 pointer-events-none flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5">
              <Hand className="w-3 h-3 text-[#EB6658]" />
              <span>Drag to Pan</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5 tabular-nums">
              <Compass className="w-3 h-3 text-sky-400" />
              <span>Zoom ({Math.round(zoom * 100)}%)</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5">
              <Move className="w-3 h-3 text-emerald-400" />
              <span>Drag Modules</span>
            </span>
          </div>

          {/* Top-Right Interactive Viewport HUD Controls */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-xl p-1 shadow-xl"
          >
            <button
              onClick={() => handleZoomBy(-0.15)}
              title="Zoom Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              title="Reset Zoom to 100%"
              className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-[#EB6658] hover:bg-slate-800 transition min-w-[46px] text-center cursor-pointer tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => handleZoomBy(0.15)}
              title="Zoom In"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-0.5" />
            <button
              onClick={() => handleCenterOnNode()}
              title="Center on Selected Module"
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitView}
              title="Fit Graph to View"
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {hasCustomNodePositions && (
              <button
                onClick={handleResetNodeLayout}
                title="Reset Dragged Node Layout"
                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition ml-0.5 cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Layout</span>
              </button>
            )}
          </div>

          {/* SVG Connection Lines & Nodes Transformed via Pan & Zoom */}
          <div className="flex-1 w-full h-full relative overflow-hidden">
            <div
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
                left: 0,
                top: 0,
                width: '1800px',
                height: '1200px'
              }}
              className={isPanning || draggingNodeId ? '' : 'transition-transform duration-75 ease-out'}
            >
              {/* Dynamic SVG Edges with Arrow Markers */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                <defs>
                  <marker
                    id="arrow-edge"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
                  </marker>
                  <marker
                    id="arrow-edge-active"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#EB6658" />
                  </marker>
                </defs>

                {nodes.map((source) => {
                  if (!filteredNodeIds.has(source.id)) return null;
                  return source.outbound.map((targetId) => {
                    if (!filteredNodeIds.has(targetId)) return null;
                    const target = nodes.find((n) => n.id === targetId);
                    if (!target) return null;

                    const edgeKey = `${source.id}->${target.id}`;
                    const isHovered = hoveredEdgeKey === edgeKey;
                    const isHighlighted =
                      isHovered || source.id === selectedNodeId || target.id === selectedNodeId;

                    const startX = source.x + 210;
                    const startY = source.y + 42;
                    const endX = target.x;
                    const endY = target.y + 42;
                    const midX = (startX + endX) / 2;
                    const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                    return (
                      <g key={edgeKey} className="pointer-events-auto">
                        <path
                          d={pathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={14}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredEdgeKey(edgeKey)}
                          onMouseLeave={() => setHoveredEdgeKey(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(target.id);
                          }}
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isHighlighted ? '#EB6658' : 'rgba(71, 85, 105, 0.48)'}
                          strokeWidth={isHovered ? 3 : isHighlighted ? 2.4 : 1.4}
                          strokeDasharray={isHighlighted ? 'none' : '4,4'}
                          markerEnd={isHighlighted ? 'url(#arrow-edge-active)' : 'url(#arrow-edge)'}
                          className="transition-colors duration-150 pointer-events-none"
                        />
                      </g>
                    );
                  });
                })}
              </svg>

              {/* Dynamic Interactive Node Cards */}
              {filteredNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isConnected =
                  selectedNode.outbound.includes(node.id) ||
                  selectedNode.inbound.includes(node.id);
                const isBeingDragged = draggingNodeId === node.id;
                const layerColor = getLayerColor(node.layer);

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleCenterOnNode(node.id);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: '210px',
                      cursor: isBeingDragged ? 'grabbing' : 'grab'
                    }}
                    className={`p-3 rounded-xl border select-none ${
                      isBeingDragged ? 'z-30 shadow-2xl scale-[1.04]' : 'transition-shadow duration-150'
                    } ${
                      isSelected
                        ? 'bg-slate-900/95 border-[#EB6658] ring-2 ring-[#EB6658] shadow-2xl shadow-[#EB6658]/30 z-20 scale-105'
                        : isConnected
                        ? 'bg-slate-900/90 border-slate-600 ring-1 ring-slate-500 z-10'
                        : 'bg-slate-950/90 border-slate-800/90 hover:border-slate-600 hover:bg-slate-900/80 z-0'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px] font-mono uppercase font-semibold truncate max-w-[125px]"
                        style={{ color: layerColor }}
                      >
                        {node.layerLabel}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                        {node.loc} LOC
                      </span>
                    </div>

                    <div className="font-mono font-bold text-xs text-white truncate flex items-center justify-between">
                      <span className="truncate">{node.name}</span>
                      <Move className="w-3 h-3 text-slate-500 shrink-0 ml-1" />
                    </div>

                    {/* Aligned Agent & LangGraph Actor Row */}
                    <div className="mt-1.5 pt-1 border-t border-slate-800/70 flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-slate-300 truncate font-medium">
                        {node.assignedAgentName}
                      </span>
                      <span className="font-mono text-[9px] text-sky-400 shrink-0">
                        {node.flowDecorator?.split('(')[0] || '@listen'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas Bottom Legend & Quick Actions */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400 z-20 flex-wrap gap-2"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[#EB6658] font-medium">Entry & Root</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#38BDF8] font-medium">UI & Graph Views</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#34D399] font-medium">Unified Graph & Data</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#F59E0B] font-medium">TypeScript Contracts</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#A78BFA] font-medium">Server & Standalone</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCenterOnNode()}
                className="text-[11px] text-slate-300 hover:text-white px-2.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 transition border border-slate-800 cursor-pointer"
              >
                Focus Selected
              </button>
              <button
                onClick={handleFitView}
                className="text-[11px] text-slate-300 hover:text-white px-2.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 transition border border-slate-800 cursor-pointer"
              >
                Fit View
              </button>
              <span className="font-mono text-slate-500 text-[10px] tabular-nums">
                {filteredNodes.length}/{nodes.length} Modules
              </span>
            </div>
          </div>
        </div>

        {/* Selected Node Inspector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#EB6658]" />
                <h3 className="text-sm font-bold text-white">Module & Graph Alignment Inspector</h3>
              </div>
              <span
                className="text-[10px] font-mono uppercase font-bold"
                style={{ color: getLayerColor(selectedNode.layer) }}
              >
                {selectedNode.layerLabel}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Repository File Path:</span>
              <code className="text-xs font-mono text-emerald-400 bg-slate-950 p-1.5 rounded block border border-slate-800 truncate">
                {selectedNode.path}
              </code>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Architectural Role:</span>
              <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                {selectedNode.description}
              </p>
            </div>

            {/* Aligned CrewAI Agent, LangGraph Node & Flow DAG Step Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#EB6658]" />
                  <span>Aligned Multi-Graph Ownership</span>
                </span>
                <span className="font-mono text-[10px] text-sky-400">
                  {selectedNode.flowDecorator}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">CrewAI Specialist:</span>
                  <span className="font-semibold text-white truncate">
                    {selectedNode.assignedAgentName} ({selectedNode.assignedAgentRole})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">LangGraph Actor Node:</span>
                  <code className="font-mono text-sky-300">{selectedNode.langGraphNodeId}</code>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Task DAG Step:</span>
                  <span className="text-amber-300 font-medium truncate max-w-[180px]">
                    {selectedNode.alignedTaskName}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {onOpenCrewStudio && (
                  <button
                    type="button"
                    onClick={onOpenCrewStudio}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Layers className="w-3 h-3 text-[#EB6658]" />
                    <span>Task DAG</span>
                  </button>
                )}
                {onOpenLangGraphNode && selectedNode.langGraphNodeId && (
                  <button
                    type="button"
                    onClick={() => onOpenLangGraphNode(selectedNode.langGraphNodeId!)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Network className="w-3 h-3 text-sky-400" />
                    <span>LangGraph</span>
                  </button>
                )}
                {onOpenFlowStep && (
                  <button
                    type="button"
                    onClick={() => onOpenFlowStep(selectedNode.alignedTaskId)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <GitMerge className="w-3 h-3 text-amber-400" />
                    <span>Flow Step</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inbound & Outbound Connections */}
            <div className="space-y-3 pt-1 border-t border-slate-800/80">
              <div>
                <span className="text-slate-400 block mb-1.5 font-semibold">
                  Inbound Callers / Imported By ({selectedNode.inbound.length}):
                </span>
                {selectedNode.inbound.length === 0 ? (
                  <span className="text-slate-500 italic">None (Root or Standalone Entry)</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.inbound.map((callerId) => (
                      <button
                        key={callerId}
                        onClick={() => {
                          setSelectedNodeId(callerId);
                          handleCenterOnNode(callerId);
                        }}
                        className="font-mono text-[11px] text-slate-300 bg-slate-900 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition cursor-pointer"
                      >
                        {callerId}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 block mb-1.5 font-semibold">
                  Outbound Dependencies ({selectedNode.outbound.length}):
                </span>
                {selectedNode.outbound.length === 0 ? (
                  <span className="text-slate-500 italic">Leaf node (Zero dependencies)</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.outbound.map((depId) => (
                      <button
                        key={depId}
                        onClick={() => {
                          setSelectedNodeId(depId);
                          handleCenterOnNode(depId);
                        }}
                        className="font-mono text-[11px] text-[#EB6658] bg-[#EB6658]/10 hover:bg-[#EB6658]/20 px-2 py-0.5 rounded border border-[#EB6658]/30 transition cursor-pointer"
                      >
                        {depId}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Google Jules Autonomous Agent Integration */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => onTaskJules?.(selectedNode)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 hover:text-white border border-blue-500/40 transition text-xs font-bold cursor-pointer"
                title="Launch Google Jules Cloud VM to test, refactor, or generate unit tests for this module"
              >
                <Cpu className="w-4 h-4 text-blue-400" />
                <span>Task Google Jules on {selectedNode.name}</span>
              </button>
            </div>
          </div>

          {/* Graphify CLI Integration Box */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>Graphify CLI Command</span>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(graphifyCliCommand);
                  setCopiedCli(true);
                  setTimeout(() => setCopiedCli(false), 2000);
                }}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition cursor-pointer"
              >
                {copiedCli ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy CLI</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-2.5 rounded-lg bg-[#070A12] border border-slate-800 font-mono text-[10px] text-slate-300 leading-relaxed overflow-x-auto">
              <code>{graphifyCliCommand}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
