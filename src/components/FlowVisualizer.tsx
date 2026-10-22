import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Maximize2,
  Network,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { GraphifyRepoVisualizer } from './GraphifyRepoVisualizer';
import { CrewConfig } from '../types';
import { PRESET_CREWS } from './CrewStudio';
import {
  AlignedFlowStepDef,
  WORKFLOW_AUTOSAVE_KEY,
  buildAlignedFlowStepsFromCrew,
  generateAlignedFlowPythonCode
} from '../utils/unifiedGraphEngine';

interface FlowVisualizerProps {
  onTaskJules?: (node: any) => void;
  selectedRepo: string;
  selectedBranch: string;
  initialSubView?: 'flow_dag' | 'graphify_repo';
  onSubViewChange?: (view: 'flow_dag' | 'graphify_repo') => void;
  onOpenLangGraph?: (langGraphNodeId?: string) => void;
  onOpenCrewStudio?: () => void;
}

export const FlowVisualizer: React.FC<FlowVisualizerProps> = ({
  onTaskJules,
  selectedRepo,
  selectedBranch,
  initialSubView = 'graphify_repo',
  onSubViewChange,
  onOpenLangGraph,
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

  const [activeView, setActiveView] = useState<'flow_dag' | 'graphify_repo'>(initialSubView);
  const [activeCrew, setActiveCrew] = useState<CrewConfig>(loadActiveCrew);
  const [focusedGraphifyModuleId, setFocusedGraphifyModuleId] = useState<string | null>(null);

  useEffect(() => {
    setActiveView(initialSubView);
  }, [initialSubView]);

  const switchSubView = (next: 'flow_dag' | 'graphify_repo') => {
    setActiveView(next);
    onSubViewChange?.(next);
  };

  // Keep synced with CrewStudio & LangGraph changes
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

  const baseFlowSteps = useMemo(
    () => buildAlignedFlowStepsFromCrew(activeCrew, selectedRepo),
    [activeCrew, selectedRepo]
  );

  const [stepPositionOverrides, setStepPositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const flowSteps: AlignedFlowStepDef[] = useMemo(() => {
    return baseFlowSteps.map((s) => {
      const over = stepPositionOverrides[s.id];
      return over ? { ...s, x: over.x, y: over.y } : s;
    });
  }, [baseFlowSteps, stepPositionOverrides]);

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [selectedStepId, setSelectedStepId] = useState<string>(
    () => baseFlowSteps[0]?.id || 'flow_sync_graphify'
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    if (flowSteps.length > 0 && !flowSteps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(flowSteps[0].id);
      setCurrentStepIndex(0);
    }
  }, [flowSteps, selectedStepId]);

  const selectedStep =
    flowSteps.find((s) => s.id === selectedStepId) || flowSteps[0];

  // Interactive Pan, Zoom & Drag State for Workflow DAG Canvas
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 24, y: 20 });
  const [zoom, setZoom] = useState<number>(0.88);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);

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
    moved: false
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
          y: Math.round(mouseY - (mouseY - prevPan.y) * scaleRatio)
        }));
        return nextZoom;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [activeView]);

  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning && !draggingStepId) return;

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
      } else if (draggingStepId) {
        const scaledDx = dx / zoom;
        const scaledDy = dy / zoom;
        const nextX = Math.max(10, Math.min(1150, Math.round(pointerStartRef.current.originX + scaledDx)));
        const nextY = Math.max(10, Math.min(950, Math.round(pointerStartRef.current.originY + scaledDy)));
        setStepPositionOverrides((prev) => ({
          ...prev,
          [draggingStepId]: { x: nextX, y: nextY }
        }));
      }
    },
    [isPanning, draggingStepId, zoom]
  );

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
      moved: false
    };
  };

  const handleStepNodeMouseDown = (e: React.MouseEvent, step: AlignedFlowStepDef, index: number) => {
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
      moved: false
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
        y: Math.round(centerY - (centerY - prevPan.y) * scaleRatio)
      }));
      return nextZoom;
    });
  };

  const handleFitDagView = () => {
    setPan({ x: 24, y: 20 });
    setZoom(0.88);
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
      x: Math.round(centerX - (target.x + 150) * targetZoom),
      y: Math.round(centerY - (target.y + 70) * targetZoom)
    });
  };

  const handleResetStepLayout = () => {
    setStepPositionOverrides({});
    handleFitDagView();
  };

  const hasCustomPositions = Object.keys(stepPositionOverrides).length > 0;

  // Compute accumulated Pydantic Flow State up to currentStepIndex
  const currentMergedState = useMemo(() => {
    const touchedModules = new Set<string>();
    const completedSteps: string[] = [];
    let state: Record<string, any> = {
      project_name: selectedRepo.split('/')[1] || 'crewai_app',
      repository: selectedRepo,
      branch: selectedBranch,
      aligned_crew: activeCrew.name,
      process_mode: activeCrew.process,
      langgraph_thread_synced: true
    };
    for (let i = 0; i <= currentStepIndex; i++) {
      const s = flowSteps[i];
      if (s) {
        completedSteps.push(s.title.replace(/\(\)$/, ''));
        s.graphifyModuleIds.forEach((m) => touchedModules.add(m));
        state = { ...state, ...s.outputStateChange };
      }
    }
    state.completed_flow_steps = completedSteps;
    state.graphify_touched_modules = Array.from(touchedModules);
    return state;
  }, [selectedRepo, selectedBranch, activeCrew, currentStepIndex, flowSteps]);

  const handleStepForward = () => {
    if (currentStepIndex < flowSteps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      setSelectedStepId(flowSteps[nextIdx].id);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    if (flowSteps[0]) setSelectedStepId(flowSteps[0].id);
    setIsPlaying(false);
  };

  const handleRunAll = async () => {
    setIsPlaying(true);
    for (let i = 0; i < flowSteps.length; i++) {
      setCurrentStepIndex(i);
      setSelectedStepId(flowSteps[i].id);
      await new Promise((r) => setTimeout(r, 750));
    }
    setIsPlaying(false);
  };

  const flowPythonCode = useMemo(
    () => generateAlignedFlowPythonCode(activeCrew, flowSteps, selectedRepo),
    [activeCrew, flowSteps, selectedRepo]
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-6 space-y-6">
      {/* Visualizer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-[#EB6658]/10 text-[#EB6658] border border-[#EB6658]/30">
              {activeView === 'flow_dag' ? (
                <GitMerge className="w-5 h-5" />
              ) : (
                <GitFork className="w-5 h-5" />
              )}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {activeView === 'flow_dag'
                ? 'Aligned Event Flow DAG (@start · @listen · @router)'
                : 'Graphify: Whole Repository Architecture Graph'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {activeView === 'flow_dag'
              ? `Dynamically compiled from "${activeCrew.name}" (${activeCrew.tasks.length} tasks + Graphify sync gate) — 100% aligned with Crew Studio Task DAG and LangGraph StateGraph.`
              : `Interactive codebase knowledge graph mapping all 22 repository modules to their governing CrewAI Specialist, LangGraph Actor node, and Flow Decorator.`}
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => switchSubView('graphify_repo')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeView === 'graphify_repo'
                ? 'bg-[#EB6658] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Graphify Repo Map (22 Modules)</span>
          </button>

          <button
            onClick={() => switchSubView('flow_dag')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeView === 'flow_dag'
                ? 'bg-[#EB6658] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Event Flow DAG ({flowSteps.length} Steps)</span>
          </button>
        </div>
      </div>

      {/* Conditionally Render Graphify View vs Event Flow DAG View */}
      {activeView === 'graphify_repo' ? (
        <GraphifyRepoVisualizer
          onTaskJules={onTaskJules}
          selectedRepo={selectedRepo}
          selectedBranch={selectedBranch}
          focusedModuleId={focusedGraphifyModuleId}
          onOpenLangGraphNode={(lgNodeId) => onOpenLangGraph?.(lgNodeId)}
          onOpenFlowStep={(taskId) => {
            if (taskId) {
              const targetStep = flowSteps.find((s) => s.taskId === taskId);
              if (targetStep) {
                const idx = flowSteps.indexOf(targetStep);
                setSelectedStepId(targetStep.id);
                setCurrentStepIndex(idx >= 0 ? idx : 0);
              }
            }
            switchSubView('flow_dag');
          }}
          onOpenCrewStudio={onOpenCrewStudio}
        />
      ) : (
        <>
          {/* Flow Controls Bar */}
          <div className="flex items-center justify-between bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex-wrap gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
              <span>
                Aligned Crew: <strong className="text-white">{activeCrew.name}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Lifecycle: <strong className="text-white">{flowSteps.length} Event Steps</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Active Step:{' '}
                <strong className="text-[#EB6658] font-mono">
                  {flowSteps[currentStepIndex]?.title || 'Ready'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onOpenCrewStudio && (
                <button
                  onClick={onOpenCrewStudio}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Layers className="w-3.5 h-3.5 text-[#EB6658]" />
                  <span>Edit Task DAG</span>
                </button>
              )}
              {onOpenLangGraph && (
                <button
                  onClick={() => onOpenLangGraph(selectedStep?.langGraphNodeId)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-sky-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Network className="w-3.5 h-3.5 text-sky-400" />
                  <span>Inspect in LangGraph</span>
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                onClick={handleStepForward}
                disabled={isPlaying || currentStepIndex >= flowSteps.length - 1}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRunAll}
                disabled={isPlaying}
                className="px-4 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#C94C3C] disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
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
              className={`lg:col-span-7 rounded-2xl border border-slate-800 bg-[#070A12] overflow-hidden flex flex-col relative select-none h-[660px] ${
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
                  <span>Drag Flow Steps</span>
                </span>
              </div>

              {/* Top-Right Viewport Controls HUD */}
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
                  className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-[#EB6658] hover:bg-slate-800 transition min-w-[44px] text-center cursor-pointer tabular-nums"
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
                    width: '1300px',
                    height: '1050px'
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
                        const sx = step.x + 150;
                        const sy = step.y + 75;
                        const tx = target.x + 150;
                        const ty = target.y + 75;
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
                          width: '305px',
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
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] mt-0.5 shrink-0 tabular-nums ${
                              isActive
                                ? 'bg-[#EB6658] text-white'
                                : isPast
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-bold text-xs text-white truncate">
                                {node.title}
                              </span>
                              <Move className="w-3 h-3 text-slate-500 shrink-0" />
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono truncate">
                              <span className="text-[#EB6658] font-semibold">{node.decorator}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-sky-400">{node.langGraphNodeId}</span>
                            </div>

                            <div className="text-[11px] text-slate-200 font-semibold truncate">
                              {node.agentName} — <span className="text-slate-400 font-normal">{node.agentRole}</span>
                            </div>

                            {node.controllerAgentName && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                                <ShieldCheck className="w-3 h-3 shrink-0" />
                                <span className="truncate">Gate: {node.controllerAgentName}</span>
                              </div>
                            )}

                            {/* Linked Graphify Modules */}
                            <div className="pt-1 border-t border-slate-800/80 flex items-center gap-1 flex-wrap">
                              {node.graphifyModuleIds.slice(0, 3).map((modId) => (
                                <button
                                  key={modId}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFocusedGraphifyModuleId(modId);
                                    switchSubView('graphify_repo');
                                  }}
                                  className="text-[9px] font-mono text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded px-1.5 py-0.5 transition cursor-pointer"
                                  title="Click to inspect this module in Graphify Repo Diagram"
                                >
                                  {modId}
                                </button>
                              ))}
                              {node.graphifyModuleIds.length > 3 && (
                                <span className="text-[9px] font-mono text-slate-500">
                                  +{node.graphifyModuleIds.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* State Inspector & Python Script (5 cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Selected Step & Graphify Alignment Inspector */}
              {selectedStep && (
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="text-[10px] font-mono text-[#EB6658] uppercase font-bold">
                        {selectedStep.phase}
                      </span>
                      <h3 className="text-sm font-bold text-white font-mono">
                        {selectedStep.title}
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] text-sky-400">
                      {selectedStep.decorator}
                    </span>
                  </div>

                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {selectedStep.description}
                  </p>

                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                      Aligned Graphify Repository Modules ({selectedStep.graphifyModuleIds.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStep.graphifyModuleIds.map((modId) => (
                        <button
                          key={modId}
                          type="button"
                          onClick={() => {
                            setFocusedGraphifyModuleId(modId);
                            switchSubView('graphify_repo');
                          }}
                          className="font-mono text-[11px] text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
                        >
                          <GitFork className="w-3 h-3" />
                          <span>{modId}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pydantic State Inspector */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#EB6658]" />
                    <h3 className="text-sm font-bold text-white">Aligned Flow State (Pydantic Store)</h3>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    Synced with LangGraph
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#080C14] p-3 overflow-hidden">
                  <pre className="text-[11px] font-mono text-slate-200 h-48 overflow-y-auto leading-relaxed">
                    <code>{JSON.stringify(currentMergedState, null, 2)}</code>
                  </pre>
                </div>
              </div>

              {/* Flow Code */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#EB6658]" />
                    <h3 className="text-sm font-bold text-white">Aligned Flow Python Implementation</h3>
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
                  <pre className="text-[11px] font-mono text-slate-300 h-52 overflow-y-auto leading-relaxed">
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
