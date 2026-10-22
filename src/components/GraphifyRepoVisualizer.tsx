import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Crosshair
} from 'lucide-react';

export interface RepoNode {
  id: string;
  name: string;
  path: string;
  layer: 'entry' | 'ui' | 'data' | 'types' | 'config';
  layerLabel: string;
  type: 'component' | 'store' | 'types' | 'config' | 'root';
  loc: number;
  description: string;
  inbound: string[]; // files that import this
  outbound: string[]; // files this imports
  exports: string[];
  x: number;
  y: number;
}

const INITIAL_NODES: RepoNode[] = [
  // Entry & Root
  {
    id: 'index-html',
    name: 'index.html',
    path: '/index.html',
    layer: 'config',
    layerLabel: 'Host & HTML',
    type: 'config',
    loc: 24,
    description: 'HTML5 entry point specifying meta tags, responsive viewport, and dark background styling.',
    inbound: [],
    outbound: ['main-tsx'],
    exports: ['<div id="root">'],
    x: 50,
    y: 160
  },
  {
    id: 'main-tsx',
    name: 'main.tsx',
    path: '/src/main.tsx',
    layer: 'entry',
    layerLabel: 'Bootstrap Entry',
    type: 'root',
    loc: 14,
    description: 'React 19 root bootstrap mounting App inside document.getElementById("root").',
    inbound: ['index-html'],
    outbound: ['app-tsx'],
    exports: ['ReactDOM.render'],
    x: 270,
    y: 160
  },
  {
    id: 'app-tsx',
    name: 'App.tsx',
    path: '/src/App.tsx',
    layer: 'ui',
    layerLabel: 'Root Orchestrator',
    type: 'component',
    loc: 218,
    description: 'Master application component managing tabs, LangGraph & CrewAI studio views, notifications, modals, and responsive layout.',
    inbound: ['main-tsx'],
    outbound: [
      'navbar-tsx',
      'crewstudio-tsx',
      'langgraph-tsx',
      'flowvisualizer-tsx',
      'githubhub-tsx',
      'ollamapool-tsx',
      'docviewer-tsx',
      'toolscatalog-tsx',
      'traceviewer-tsx',
      'notificationcenter-tsx',
      'types-ts',
      'docscontent-ts'
    ],
    exports: ['App (default)'],
    x: 500,
    y: 220
  },

  // Components Layer
  {
    id: 'navbar-tsx',
    name: 'Navbar.tsx',
    path: '/src/components/Navbar.tsx',
    layer: 'ui',
    layerLabel: 'Navigation',
    type: 'component',
    loc: 245,
    description: 'Top header navigation bar featuring CrewStudio, Graphs, Flow & Graphify, PR Notification Center, and Ollama pool controls.',
    inbound: ['app-tsx'],
    outbound: ['types-ts', 'notificationcenter-tsx'],
    exports: ['Navbar'],
    x: 790,
    y: 30
  },
  {
    id: 'crewstudio-tsx',
    name: 'CrewStudio.tsx',
    path: '/src/components/CrewStudio.tsx',
    layer: 'ui',
    layerLabel: 'Studio Engine',
    type: 'component',
    loc: 899,
    description: 'Interactive multi-agent workbench with agent builder, task pipeline, live telemetry simulator, and code exporter.',
    inbound: ['app-tsx'],
    outbound: ['types-ts', 'toolscatalog-ts'],
    exports: ['CrewStudio'],
    x: 790,
    y: 120
  },
  {
    id: 'langgraph-tsx',
    name: 'LangGraphView.tsx',
    path: '/src/components/LangGraphView.tsx',
    layer: 'ui',
    layerLabel: 'Stateful Graphs',
    type: 'component',
    loc: 940,
    description: 'Interactive LangGraph multi-actor state machine topology with dynamic pan/zoom, cyclic feedback routing, and thread checkpoints.',
    inbound: ['app-tsx'],
    outbound: ['types-ts'],
    exports: ['LangGraphView'],
    x: 790,
    y: 210
  },
  {
    id: 'flowvisualizer-tsx',
    name: 'FlowVisualizer.tsx',
    path: '/src/components/FlowVisualizer.tsx',
    layer: 'ui',
    layerLabel: 'Workflow & Graph',
    type: 'component',
    loc: 520,
    description: 'Visual event-driven DAG execution engine supporting @start, @listen, and @router lifecycle steps with Graphify integration.',
    inbound: ['app-tsx'],
    outbound: ['types-ts'],
    exports: ['FlowVisualizer'],
    x: 790,
    y: 300
  },
  {
    id: 'githubhub-tsx',
    name: 'GitHubHub.tsx',
    path: '/src/components/GitHubHub.tsx',
    layer: 'ui',
    layerLabel: 'GitHub Sync Hub',
    type: 'component',
    loc: 480,
    description: 'Complete GitHub access: OAuth popup flow, PAT authentication, Git Pull tree browser, and Git Push commit engine.',
    inbound: ['app-tsx'],
    outbound: [],
    exports: ['GitHubHub'],
    x: 790,
    y: 390
  },
  {
    id: 'ollamapool-tsx',
    name: 'OllamaPoolModal.tsx',
    path: '/src/components/OllamaPoolModal.tsx',
    layer: 'ui',
    layerLabel: 'Ollama Hardware & Cloud',
    type: 'component',
    loc: 460,
    description: 'Local PC Ollama model scanner with /api/tags discovery, hybrid cloud priority failover, and credit flow simulation.',
    inbound: ['app-tsx'],
    outbound: [],
    exports: ['OllamaPoolModal'],
    x: 790,
    y: 480
  },
  {
    id: 'docviewer-tsx',
    name: 'DocViewer.tsx',
    path: '/src/components/DocViewer.tsx',
    layer: 'ui',
    layerLabel: 'Documentation',
    type: 'component',
    loc: 320,
    description: 'Aspen Mintlify-style markdown document renderer with code groups, syntax styling, and breadcrumbs.',
    inbound: ['app-tsx'],
    outbound: ['types-ts'],
    exports: ['DocViewer'],
    x: 790,
    y: 570
  },
  {
    id: 'toolscatalog-tsx',
    name: 'ToolsCatalogView.tsx',
    path: '/src/components/ToolsCatalogView.tsx',
    layer: 'ui',
    layerLabel: 'Tools Directory',
    type: 'component',
    loc: 180,
    description: 'Searchable directory of 18+ CrewAI tools categorized by capability with copyable Python imports.',
    inbound: ['app-tsx'],
    outbound: ['toolscatalog-ts'],
    exports: ['ToolsCatalogView'],
    x: 790,
    y: 660
  },
  {
    id: 'traceviewer-tsx',
    name: 'TraceViewer.tsx',
    path: '/src/components/TraceViewer.tsx',
    layer: 'ui',
    layerLabel: 'Observability',
    type: 'component',
    loc: 240,
    description: 'OpenTelemetry waterfall timeline, token telemetry audits, and sub-millisecond span inspector.',
    inbound: ['app-tsx'],
    outbound: [],
    exports: ['TraceViewer'],
    x: 790,
    y: 750
  },
  {
    id: 'notificationcenter-tsx',
    name: 'NotificationCenter.tsx',
    path: '/src/components/NotificationCenter.tsx',
    layer: 'ui',
    layerLabel: 'PR Toast Center',
    type: 'component',
    loc: 275,
    description: 'Real-time notification center and floating toast stack for Google Jules autonomous PR completions.',
    inbound: ['app-tsx', 'navbar-tsx'],
    outbound: ['types-ts'],
    exports: ['NotificationCenter'],
    x: 790,
    y: 840
  },

  // Data & Contracts Layer
  {
    id: 'docscontent-ts',
    name: 'docsContent.ts',
    path: '/src/data/docsContent.ts',
    layer: 'data',
    layerLabel: 'Content & Knowledge',
    type: 'store',
    loc: 798,
    description: 'Structured documentation chapters covering Getting Started, Concepts, Ollama Pool, Guides, and API Reference.',
    inbound: ['app-tsx'],
    outbound: ['types-ts'],
    exports: ['DOC_SECTIONS'],
    x: 1120,
    y: 160
  },
  {
    id: 'toolscatalog-ts',
    name: 'toolsCatalog.ts',
    path: '/src/data/toolsCatalog.ts',
    layer: 'data',
    layerLabel: 'Tools Specs',
    type: 'store',
    loc: 220,
    description: 'Specifications, environment keys, and execution snippets for Serper, ScrapeWebsite, Firecrawl, CodeInterpreter, etc.',
    inbound: ['crewstudio-tsx', 'toolscatalog-tsx'],
    outbound: [],
    exports: ['TOOLS_CATALOG', 'ToolItem'],
    x: 1120,
    y: 300
  },
  {
    id: 'types-ts',
    name: 'types.ts',
    path: '/src/types.ts',
    layer: 'types',
    layerLabel: 'Type Contracts',
    type: 'types',
    loc: 110,
    description: 'TypeScript domain contracts for Agents, Crews, Tasks, LangGraph State, Execution Logs, Flows, and Doc Pages.',
    inbound: [
      'app-tsx',
      'navbar-tsx',
      'docviewer-tsx',
      'crewstudio-tsx',
      'langgraph-tsx',
      'flowvisualizer-tsx',
      'notificationcenter-tsx',
      'docscontent-ts'
    ],
    outbound: [],
    exports: ['DocTab', 'AgentConfig', 'TaskConfig', 'CrewConfig', 'ExecutionLog', 'FlowNode', 'FlowState'],
    x: 1120,
    y: 440
  },

  // System & Config Layer
  {
    id: 'server-ts',
    name: 'server.ts',
    path: '/server.ts',
    layer: 'config',
    layerLabel: 'Full-Stack Server',
    type: 'config',
    loc: 280,
    description: 'Express backend serving GitHub OAuth, token exchange, file push proxy, Slack/Discord webhook dispatch, and Vite middleware.',
    inbound: [],
    outbound: [],
    exports: ['ExpressServer'],
    x: 270,
    y: 380
  },
  {
    id: 'package-json',
    name: 'package.json',
    path: '/package.json',
    layer: 'config',
    layerLabel: 'Package & Scripts',
    type: 'config',
    loc: 35,
    description: 'Node.js dependency manifest (React 19, Express, Vite 6, Tailwind CSS 4, Lucide React).',
    inbound: [],
    outbound: [],
    exports: ['scripts.dev', 'scripts.build'],
    x: 270,
    y: 490
  },
  {
    id: 'start-bat',
    name: 'start.bat',
    path: '/start.bat',
    layer: 'config',
    layerLabel: 'Automated Launcher',
    type: 'config',
    loc: 54,
    description: '1-click Windows standalone launcher: checks Node.js, configures .env, installs packages, and launches browser.',
    inbound: [],
    outbound: [],
    exports: ['start.bat'],
    x: 270,
    y: 600
  }
];

export interface GraphifyRepoVisualizerProps {
  onTaskJules?: (node: RepoNode) => void;
  selectedRepo: string;
  selectedBranch: string;
}

export const GraphifyRepoVisualizer: React.FC<GraphifyRepoVisualizerProps> = ({ 
  onTaskJules,
  selectedRepo,
  selectedBranch
}) => {
  const [nodes, setNodes] = useState<RepoNode[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('app-tsx');
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLayer, setSelectedLayer] = useState<string>('all');
  
  // Interactive Pan, Zoom & Drag State (matching LangGraphView)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 24, y: 18 });
  const [zoom, setZoom] = useState<number>(0.88);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [hasCustomNodePositions, setHasCustomNodePositions] = useState<boolean>(false);

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
    moved: false,
  });

  // Fullscreen & CLI state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[2];

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

  // Global Mouse Move / Mouse Up for smooth canvas panning and node dragging
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning && !draggingNodeId) return;

    const dx = e.clientX - pointerStartRef.current.clientX;
    const dy = e.clientY - pointerStartRef.current.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      pointerStartRef.current.moved = true;
    }

    if (isPanning) {
      setPan({
        x: Math.round(pointerStartRef.current.originX + dx),
        y: Math.round(pointerStartRef.current.originY + dy),
      });
    } else if (draggingNodeId) {
      const scaledDx = dx / zoom;
      const scaledDy = dy / zoom;
      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === draggingNodeId
            ? {
                ...node,
                x: Math.max(10, Math.min(1650, Math.round(pointerStartRef.current.originX + scaledDx))),
                y: Math.max(10, Math.min(1150, Math.round(pointerStartRef.current.originY + scaledDy))),
              }
            : node
        )
      );
      setHasCustomNodePositions(true);
    }
  }, [isPanning, draggingNodeId, zoom]);

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

  // Start Canvas Panning on Background MouseDown
  const handleMouseDownCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
  };

  // Start Node Dragging on Node MouseDown
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
      moved: false,
    };
  };

  // Viewport Helpers
  const handleZoomBy = (delta: number) => {
    const container = containerRef.current;
    const centerX = container ? container.clientWidth / 2 : 420;
    const centerY = container ? container.clientHeight / 2 : 320;

    setZoom((prevZoom) => {
      const nextZoom = Math.min(2.4, Math.max(0.35, Number((prevZoom + delta).toFixed(2))));
      const scaleRatio = nextZoom / prevZoom;
      setPan((prevPan) => ({
        x: Math.round(centerX - (centerX - prevPan.x) * scaleRatio),
        y: Math.round(centerY - (centerY - prevPan.y) * scaleRatio),
      }));
      return nextZoom;
    });
  };

  const handleFitView = () => {
    setPan({ x: 24, y: 18 });
    setZoom(0.88);
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
      x: Math.round(centerX - (target.x + 95) * targetZoom),
      y: Math.round(centerY - (target.y + 38) * targetZoom),
    });
  };

  const handleResetNodeLayout = () => {
    setNodes(INITIAL_NODES);
    setHasCustomNodePositions(false);
    handleFitView();
  };

  // Filtering
  const filteredNodes = nodes.filter((node) => {
    const matchesLayer = selectedLayer === 'all' || node.layer === selectedLayer;
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLayer && matchesSearch;
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
python -m graphify scan . --output repo_graph.json --visualize`;

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0B0F19] p-6 overflow-y-auto' : ''}`}>
      {/* Top Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#EB6658]/20 to-[#EB6658]/5 text-[#EB6658] border border-[#EB6658]/30">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Graphify: {selectedRepo} Architecture</h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30 font-semibold">
                Branch: {selectedBranch}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Drag background to pan, scroll wheel to zoom toward cursor, or drag any module card to reorganize the architecture graph.
            </p>
          </div>
        </div>

        {/* Filter & Canvas Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter file / module..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-[#EB6658]"
            />
          </div>

          <select
            value={selectedLayer}
            onChange={(e) => setSelectedLayer(e.target.value)}
            className="bg-slate-950 text-xs text-slate-300 font-medium px-3 py-1.5 rounded-lg border border-slate-700 outline-none"
          >
            <option value="all">All Layers ({nodes.length})</option>
            <option value="entry">Entry & Bootstrap</option>
            <option value="ui">UI Components</option>
            <option value="data">Data & Knowledge</option>
            <option value="types">Types & Contracts</option>
            <option value="config">Config & Build</option>
          </select>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
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
          } ${isFullscreen ? 'h-[80vh]' : 'h-[660px]'}`}
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
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5 shadow-md backdrop-blur-sm">
              <Hand className="w-3 h-3 text-[#EB6658]" />
              <span>Drag Canvas to Pan</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5 shadow-md backdrop-blur-sm">
              <Compass className="w-3 h-3 text-sky-400" />
              <span>Wheel to Zoom ({Math.round(zoom * 100)}%)</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5 shadow-md backdrop-blur-sm">
              <Move className="w-3 h-3 text-emerald-400" />
              <span>Drag Any Module Card</span>
            </span>
          </div>

          {/* Top-Right Interactive Viewport HUD Controls */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-slate-900/95 border border-slate-800 rounded-xl p-1 shadow-xl backdrop-blur-md"
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
              className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-[#EB6658] hover:bg-slate-800 transition min-w-[46px] text-center cursor-pointer"
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
              title="Fit Graph to View (or Double-Click Canvas)"
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

                    // Dynamic start and end connection coordinates based on live node x, y
                    const startX = source.x + 190;
                    const startY = source.y + 36;
                    const endX = target.x;
                    const endY = target.y + 36;
                    const midX = (startX + endX) / 2;
                    const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                    return (
                      <g key={edgeKey} className="pointer-events-auto">
                        {/* Invisible wide hit-area so user can hover/click edges */}
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
                      width: '190px',
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
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: layerColor }}
                        />
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold truncate max-w-[110px]">
                          {node.layerLabel}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {node.loc} LOC
                      </span>
                    </div>

                    <div className="font-mono font-bold text-xs text-white truncate flex items-center justify-between">
                      <span className="truncate">{node.name}</span>
                      <Move className="w-3 h-3 text-slate-500 shrink-0 ml-1" />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-800/60 pt-1">
                      <span>In: {node.inbound.length}</span>
                      <span>Out: {node.outbound.length}</span>
                      <span className="text-[9px] text-slate-600">({node.x},{node.y})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Canvas Bottom Legend & Quick Actions */}
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400 z-20 backdrop-blur-sm flex-wrap gap-2"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EB6658]"></span>
                <span>Entry & Root</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]"></span>
                <span>UI Components</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]"></span>
                <span>Data & Knowledge</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
                <span>Types</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]"></span>
                <span>Config & Server</span>
              </span>
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
              <span className="font-mono text-slate-500 text-[10px]">
                {filteredNodes.length}/{nodes.length} Nodes • Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})
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
                <h3 className="text-sm font-bold text-white">Module Inspector</h3>
              </div>
              <span
                className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold"
                style={{
                  backgroundColor: `${getLayerColor(selectedNode.layer)}20`,
                  color: getLayerColor(selectedNode.layer)
                }}
              >
                {selectedNode.layerLabel}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">File Path:</span>
              <code className="text-xs font-mono text-emerald-400 bg-slate-950 p-1.5 rounded block border border-slate-800 truncate">
                {selectedNode.path}
              </code>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Role & Responsibility:</span>
              <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                {selectedNode.description}
              </p>
            </div>

            {/* Inbound & Outbound Connections */}
            <div className="space-y-3 pt-1 border-t border-slate-800/80">
              <div>
                <span className="text-slate-400 block mb-1.5 font-semibold">
                  Inbound Callers / Imported By ({selectedNode.inbound.length}):
                </span>
                {selectedNode.inbound.length === 0 ? (
                  <span className="text-slate-500 italic">None (Root or Standalone)</span>
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

            {/* Exports */}
            {selectedNode.exports.length > 0 && (
              <div className="pt-1 border-t border-slate-800/80">
                <span className="text-slate-400 block mb-1 font-semibold">Public Exports:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.exports.map((exp) => (
                    <span
                      key={exp}
                      className="text-[10px] font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800"
                    >
                      {exp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Google Jules Autonomous Agent Integration */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => onTaskJules?.(selectedNode)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-blue-600/30 hover:from-blue-600/40 hover:to-indigo-600/40 text-blue-300 hover:text-white border border-blue-500/40 transition text-xs font-bold shadow-md shadow-blue-500/10 cursor-pointer"
                title="Launch Google Jules Cloud VM to test, refactor, or generate unit tests for this module"
              >
                <Cpu className="w-4 h-4 text-blue-400" />
                <span>Task Google Jules on this Module</span>
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
