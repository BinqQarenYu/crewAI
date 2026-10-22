import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  GitMerge, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight, 
  Copy, 
  Check, 
  Database, 
  Terminal,
  GitFork,
  ZoomIn,
  ZoomOut,
  Hand,
  Compass,
  Move,
  Crosshair,
  Maximize2
} from 'lucide-react';
import { GraphifyRepoVisualizer } from './GraphifyRepoVisualizer';

interface FlowStepDef {
  id: string;
  type: 'start' | 'listen' | 'router' | 'and_step';
  title: string;
  decorator: string;
  description: string;
  outputStateChange: Record<string, any>;
  nextNodes?: string[];
  x: number;
  y: number;
}

const INITIAL_DEMO_FLOW: FlowStepDef[] = [
  {
    id: 'step_strategy',
    type: 'start',
    title: 'define_strategy()',
    decorator: '@start()',
    description: 'Product Lead (Alex): Scans market trends and generates the Product Requirement Document (PRD) with user stories.',
    outputStateChange: {
      prd_status: 'drafted',
      user_stories_count: 12,
      target_tech_stack: 'React/Vite/Express',
      strategy_ready: true
    },
    nextNodes: ['step_architecture'],
    x: 40,
    y: 40
  },
  {
    id: 'step_architecture',
    type: 'router',
    title: 'architect_system()',
    decorator: '@router(define_strategy)',
    description: 'Senior Dev (Jordan): Designs the database schema, ERDs, and modular API route structure based on Alex\'s PRD.',
    outputStateChange: {
      schema_defined: true,
      api_routes_count: 8,
      frontend_components: ['Navbar', 'Dashboard', 'AuthGuard'],
      architecture_complete: true
    },
    nextNodes: ['step_security'],
    x: 380,
    y: 40
  },
  {
    id: 'step_security',
    type: 'listen',
    title: 'audit_security()',
    decorator: '@listen(architect_system)',
    description: 'Security Auditor (Sam): Performs threat modeling and configures the CI/CD pipeline and Docker environment.',
    outputStateChange: {
      vulnerabilities_checked: 0,
      docker_image_built: true,
      cicd_pipeline: 'GitHub Actions',
      security_verified: true
    },
    nextNodes: ['step_graphify'],
    x: 380,
    y: 230
  },
  {
    id: 'step_graphify',
    type: 'listen',
    title: 'sync_graphify_knowledge()',
    decorator: '@listen(audit_security)',
    description: 'Graphify Engine: Automatically updates the whole-repository knowledge graph with new modules, imports, and cross-file dependencies.',
    outputStateChange: {
      graphify_sync_status: 'synced',
      knowledge_graph_nodes: 18,
      entry_points_detected: ['main.tsx', 'server.ts'],
      last_architectural_audit: new Date().toISOString().split('T')[0]
    },
    nextNodes: ['step_release'],
    x: 40,
    y: 230
  },
  {
    id: 'step_release',
    type: 'listen',
    title: 'release_production()',
    decorator: '@listen(sync_graphify_knowledge)',
    description: 'Final Deployment: Orchestrates the production push to Google Cloud / Vercel with zero-downtime cutover.',
    outputStateChange: {
      deployment_url: 'https://ais-production-deploy-2026.run.app',
      uptime_sla: '99.9%',
      project_live: true
    },
    nextNodes: [],
    x: 210,
    y: 410
  }
];

interface FlowVisualizerProps {
  onTaskJules?: (node: any) => void;
  selectedRepo: string;
  selectedBranch: string;
}

export const FlowVisualizer: React.FC<FlowVisualizerProps> = ({ 
  onTaskJules,
  selectedRepo,
  selectedBranch
}) => {
  const [activeView, setActiveView] = useState<'flow_dag' | 'graphify_repo'>('graphify_repo');
  const [flowSteps, setFlowSteps] = useState<FlowStepDef[]>(INITIAL_DEMO_FLOW);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [selectedStepId, setSelectedStepId] = useState<string>('step_strategy');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [, setStateHistory] = useState<Array<Record<string, any>>>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Interactive Pan, Zoom & Drag State for Workflow DAG Canvas
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 24, y: 20 });
  const [zoom, setZoom] = useState<number>(0.92);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [hasCustomPositions, setHasCustomPositions] = useState<boolean>(false);

  const dagContainerRef = useRef<HTMLDivElement>(null);
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

  // Cursor-centered wheel zoom for Workflow DAG
  useEffect(() => {
    const container = dagContainerRef.current;
    if (!container || activeView !== 'flow_dag') return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(2.2, Math.max(0.4, Number((prevZoom * zoomFactor).toFixed(2))));
        const scaleRatio = nextZoom / prevZoom;
        setPan((prevPan) => ({
          x: Math.round(mouseX - (mouseX - prevPan.x) * scaleRatio),
          y: Math.round(mouseY - (mouseY - prevPan.y) * scaleRatio),
        }));
        return nextZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [activeView]);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning && !draggingStepId) return;

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
    } else if (draggingStepId) {
      const scaledDx = dx / zoom;
      const scaledDy = dy / zoom;
      setFlowSteps((prev) =>
        prev.map((step) =>
          step.id === draggingStepId
            ? {
                ...step,
                x: Math.max(10, Math.min(1100, Math.round(pointerStartRef.current.originX + scaledDx))),
                y: Math.max(10, Math.min(900, Math.round(pointerStartRef.current.originY + scaledDy))),
              }
            : step
        )
      );
      setHasCustomPositions(true);
    }
  }, [isPanning, draggingStepId, zoom]);

  const handleGlobalMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingStepId(null);
  }, []);

  useEffect(() => {
    if (isPanning || draggingStepId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isPanning, draggingStepId, handleGlobalMouseMove, handleGlobalMouseUp]);

  const handleDagCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const handleStepNodeMouseDown = (e: React.MouseEvent, step: FlowStepDef, index: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedStepId(step.id);
    setCurrentStepIndex(index);
    setDraggingStepId(step.id);
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: step.x,
      originY: step.y,
      moved: false,
    };
  };

  const handleZoomBy = (delta: number) => {
    const container = dagContainerRef.current;
    const centerX = container ? container.clientWidth / 2 : 340;
    const centerY = container ? container.clientHeight / 2 : 280;

    setZoom((prevZoom) => {
      const nextZoom = Math.min(2.2, Math.max(0.4, Number((prevZoom + delta).toFixed(2))));
      const scaleRatio = nextZoom / prevZoom;
      setPan((prevPan) => ({
        x: Math.round(centerX - (centerX - prevPan.x) * scaleRatio),
        y: Math.round(centerY - (centerY - prevPan.y) * scaleRatio),
      }));
      return nextZoom;
    });
  };

  const handleFitDagView = () => {
    setPan({ x: 24, y: 20 });
    setZoom(0.92);
  };

  const handleCenterOnStep = (stepId?: string) => {
    const target = flowSteps.find((s) => s.id === (stepId || selectedStepId)) || flowSteps[0];
    const container = dagContainerRef.current;
    if (!target || !container) return;

    const targetZoom = Math.max(zoom, 0.95);
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    setZoom(targetZoom);
    setPan({
      x: Math.round(centerX - (target.x + 140) * targetZoom),
      y: Math.round(centerY - (target.y + 65) * targetZoom),
    });
  };

  const handleResetStepLayout = () => {
    setFlowSteps(INITIAL_DEMO_FLOW);
    setHasCustomPositions(false);
    handleFitDagView();
  };

  // Compute accumulated state up to currentStepIndex
  const currentMergedState = () => {
    let state: Record<string, any> = {
      project_name: selectedRepo.split('/')[1] || 'crewai_app',
      repository: selectedRepo,
      branch: selectedBranch,
      timestamp: new Date().toISOString()
    };
    for (let i = 0; i <= currentStepIndex; i++) {
      if (flowSteps[i]) {
        state = { ...state, ...flowSteps[i].outputStateChange };
      }
    }
    
    // Graphify Alignment: Add derived metadata if synced
    if (state.graphify_sync_status === 'synced') {
      state.graphify_context = {
        primary_layer: 'ui',
        active_modules: ['CrewStudio', 'LangGraphView', 'FlowVisualizer', 'GraphifyRepo'],
        dependency_depth: 3
      };
    }
    
    return state;
  };

  const handleStepForward = () => {
    if (currentStepIndex < flowSteps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      setSelectedStepId(flowSteps[nextIdx].id);
      setStateHistory((prev) => [...prev, flowSteps[nextIdx].outputStateChange]);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(-1);
    setIsPlaying(false);
    setStateHistory([]);
  };

  const handleRunAll = async () => {
    setIsPlaying(true);
    for (let i = 0; i < flowSteps.length; i++) {
      setCurrentStepIndex(i);
      setSelectedStepId(flowSteps[i].id);
      await new Promise((r) => setTimeout(r, 900));
    }
    setIsPlaying(false);
  };

  const flowPythonCode = `from crewai.flow.flow import Flow, start, listen, router
from pydantic import BaseModel

class AppState(BaseModel):
    project_name: str = "${selectedRepo.split('/')[1] || 'crewai_app'}"
    prd_status: str = "pending"
    architecture_complete: bool = False
    security_verified: bool = False
    project_live: bool = False

class FullStackFlow(Flow[AppState]):

    @start()
    def define_strategy(self):
        # Alex (Product Lead) generates the PRD
        print(f"Planning {self.state.project_name}...")
        self.state.prd_status = "drafted"
        return "strategy_complete"

    @router(define_strategy)
    def architect_system(self):
        # Jordan (Senior Dev) builds the schema
        self.state.architecture_complete = True
        return "architecture_verified"

    @listen("architecture_verified")
    def audit_security(self):
        # Sam (Security Auditor) verifies the stack
        self.state.security_verified = True
        return "audit_passed"

    @listen(audit_security)
    def release_production(self):
        # Final production handoff
        self.state.project_live = True
        print(f"Project {self.state.project_name} is LIVE!")

flow = FullStackFlow()
flow.kickoff()`;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
      {/* Visualizer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#EB6658]/10 text-[#EB6658] border border-[#EB6658]/30">
              {activeView === 'flow_dag' ? <GitMerge className="w-5 h-5" /> : <GitFork className="w-5 h-5" />}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {activeView === 'flow_dag'
                ? 'CrewAI Flow Visualizer & State Inspector'
                : 'Graphify: Whole Repository Architecture Diagram'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {activeView === 'flow_dag'
              ? 'Event-driven deterministic state machine visualizer featuring @start, @router, and @listen lifecycle nodes with dynamic pan, zoom, and drag.'
              : 'Interactive codebase knowledge graph & dependency map with dynamic pan, cursor-centered wheel zoom, and draggable modules.'}
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setActiveView('graphify_repo')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              activeView === 'graphify_repo'
                ? 'bg-[#EB6658] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Graphify Repo Diagram</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
              Whole App
            </span>
          </button>

          <button
            onClick={() => setActiveView('flow_dag')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              activeView === 'flow_dag'
                ? 'bg-[#EB6658] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Workflow DAG</span>
          </button>
        </div>
      </div>

      {/* Conditionally Render Graphify View vs Workflow DAG View */}
      {activeView === 'graphify_repo' ? (
        <GraphifyRepoVisualizer 
          onTaskJules={onTaskJules} 
          selectedRepo={selectedRepo}
          selectedBranch={selectedBranch}
        />
      ) : (
        <>
          {/* Flow Controls Bar */}
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex-wrap gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span>Graph Lifecycle: <strong className="text-white">{flowSteps.length} Steps</strong></span>
              <span>Active Step: <strong className="text-[#EB6658]">{currentStepIndex >= 0 ? flowSteps[currentStepIndex].title : 'Not Started'}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset State</span>
              </button>
              <button
                onClick={handleStepForward}
                disabled={isPlaying || currentStepIndex >= flowSteps.length - 1}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRunAll}
                disabled={isPlaying}
                className="px-4 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#C94C3C] disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPlaying ? 'Running Flow...' : 'Auto-Play Flow'}</span>
              </button>
            </div>
          </div>

          {/* Visual Interactive DAG Canvas & State Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Pan/Zoom/Drag Workflow DAG Canvas (7 cols) */}
            <div
              ref={dagContainerRef}
              onMouseDown={handleDagCanvasMouseDown}
              onDoubleClick={handleFitDagView}
              className={`lg:col-span-7 rounded-2xl border border-slate-800 bg-[#070A12] overflow-hidden flex flex-col relative select-none h-[620px] ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {/* Dynamic Grid Background */}
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
                  <span>Drag to Pan</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5 shadow-md backdrop-blur-sm">
                  <Compass className="w-3 h-3 text-sky-400" />
                  <span>Wheel Zoom ({Math.round(zoom * 100)}%)</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1.5 shadow-md backdrop-blur-sm">
                  <Move className="w-3 h-3 text-emerald-400" />
                  <span>Drag Lifecycle Nodes</span>
                </span>
              </div>

              {/* Top-Right Viewport Controls HUD */}
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
                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-[#EB6658] hover:bg-slate-800 transition min-w-[44px] text-center cursor-pointer"
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
                  onClick={() => handleCenterOnStep()}
                  title="Center on Selected Step"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFitDagView}
                  title="Fit View"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                {hasCustomPositions && (
                  <button
                    onClick={handleResetStepLayout}
                    title="Reset Dragged Layout"
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition ml-0.5 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Layout</span>
                  </button>
                )}
              </div>

              {/* Transformed DAG World */}
              <div className="flex-1 w-full h-full relative overflow-hidden">
                <div
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: '0 0',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '1200px',
                    height: '900px'
                  }}
                  className={isPanning || draggingStepId ? '' : 'transition-transform duration-75 ease-out'}
                >
                  {/* SVG Directed Edges */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                    <defs>
                      <marker
                        id="flow-arrow"
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
                        id="flow-arrow-active"
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

                    {flowSteps.map((step, idx) =>
                      (step.nextNodes || []).map((targetId) => {
                        const target = flowSteps.find((s) => s.id === targetId);
                        if (!target) return null;

                        const isEdgePassed = idx <= currentStepIndex;
                        const sx = step.x + 140;
                        const sy = step.y + 70;
                        const tx = target.x + 140;
                        const ty = target.y + 70;
                        const midY = (sy + ty) / 2;
                        const pathD = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

                        return (
                          <path
                            key={`${step.id}->${target.id}`}
                            d={pathD}
                            fill="none"
                            stroke={isEdgePassed ? '#EB6658' : 'rgba(71, 85, 105, 0.55)'}
                            strokeWidth={isEdgePassed ? 2.6 : 1.6}
                            strokeDasharray={isEdgePassed ? 'none' : '5,5'}
                            markerEnd={isEdgePassed ? 'url(#flow-arrow-active)' : 'url(#flow-arrow)'}
                          />
                        );
                      })
                    )}
                  </svg>

                  {/* Draggable Flow Step Cards */}
                  {flowSteps.map((node, index) => {
                    const isActive = index === currentStepIndex;
                    const isPast = index < currentStepIndex;
                    const isSelected = selectedStepId === node.id;
                    const isBeingDragged = draggingStepId === node.id;

                    return (
                      <div
                        key={node.id}
                        onMouseDown={(e) => handleStepNodeMouseDown(e, node, index)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleCenterOnStep(node.id);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${node.x}px`,
                          top: `${node.y}px`,
                          width: '280px',
                          cursor: isBeingDragged ? 'grabbing' : 'grab'
                        }}
                        className={`p-3.5 rounded-2xl border select-none ${
                          isBeingDragged ? 'z-30 shadow-2xl scale-[1.03]' : 'transition-shadow'
                        } ${
                          isActive
                            ? 'bg-slate-900/95 border-[#EB6658] shadow-xl shadow-[#EB6658]/20 ring-2 ring-[#EB6658] z-20'
                            : isSelected
                            ? 'bg-slate-900/95 border-indigo-500/70 ring-1 ring-indigo-500/40 z-10'
                            : isPast
                            ? 'bg-slate-900/85 border-emerald-500/40 z-10'
                            : 'bg-slate-950/90 border-slate-800/90 hover:border-slate-700 z-0'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] mt-0.5 shrink-0 ${
                              isActive
                                ? 'bg-[#EB6658] text-white animate-pulse'
                                : isPast
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-bold text-xs text-white truncate">
                                {node.title}
                              </span>
                              <Move className="w-3 h-3 text-slate-500 shrink-0" />
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30 font-semibold">
                                {node.decorator}
                              </span>
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {node.type}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                              {node.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* State Inspector & Python Script (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Pydantic State Inspector */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#EB6658]" />
                    <h3 className="text-sm font-bold text-white">Flow State (Durable Store)</h3>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Pydantic Serializable
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#080C14] p-3 overflow-hidden">
                  <pre className="text-[11px] font-mono text-slate-200 h-60 overflow-y-auto leading-relaxed">
                    <code>{JSON.stringify(currentMergedState(), null, 2)}</code>
                  </pre>
                </div>
              </div>

              {/* Flow Code */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#EB6658]" />
                    <h3 className="text-sm font-bold text-white">Flow Python Implementation</h3>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(flowPythonCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 transition cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#080C14] p-3 overflow-hidden">
                  <pre className="text-[11px] font-mono text-slate-300 h-60 overflow-y-auto leading-relaxed">
                    <code>{flowPythonCode}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
