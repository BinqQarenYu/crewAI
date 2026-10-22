import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Network,
  Play,
  StepForward,
  RotateCcw,
  Pause,
  GitFork,
  History,
  Database,
  Cpu,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  Sparkles,
  Terminal,
  GitBranch,
  AlertTriangle,
  Eye,
  Edit3,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Move,
  Crosshair,
  Map
} from 'lucide-react';
import { CrewConfig, AgentConfig, TaskConfig, JulesContext } from '../types';
import { PRESET_CREWS } from './CrewStudio';

const AUTOSAVE_STORAGE_KEY = 'crewai_studio_workflow_autosave';

export type GraphTopologyPattern = 'cyclic_reflection' | 'supervisor_star' | 'sequential_gated';

export type LangGraphNodeKind =
  | 'start'
  | 'supervisor'
  | 'actor'
  | 'tool_node'
  | 'router'
  | 'human_gate'
  | 'end';

export interface LangGraphNode {
  id: string;
  label: string;
  sublabel: string;
  kind: LangGraphNodeKind;
  x: number;
  y: number;
  agentId?: string;
  taskId?: string;
  model?: string;
  tools?: string[];
  interruptBefore: boolean;
  maxRetries: number;
  stateWrites: string[];
  description: string;
}

export interface LangGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'normal' | 'conditional' | 'cyclic';
  conditionLabel?: string;
}

export interface StateChannelSpec {
  key: string;
  typeAnnotation: string;
  reducer: 'add_messages' | 'operator.add' | 'merge_dict' | 'last_value';
  description: string;
  defaultValue: unknown;
}

export interface GraphCheckpoint {
  checkpointId: string;
  threadId: string;
  step: number;
  timestamp: string;
  nodeId: string;
  nodeLabel: string;
  nextNodes: string[];
  status: 'completed' | 'interrupted' | 'forked';
  channelValues: Record<string, unknown>;
  deltaSummary: string;
  tokensUsed: number;
  durationMs: number;
}

interface LangGraphViewProps {
  selectedRepo: string;
  selectedBranch: string;
  onOpenStudio?: () => void;
  onOpenJules?: (ctx?: JulesContext) => void;
}

const DEFAULT_CHANNELS: StateChannelSpec[] = [
  {
    key: 'messages',
    typeAnnotation: 'Annotated[list[AnyMessage], add_messages]',
    reducer: 'add_messages',
    description: 'Append-only multi-actor message history (collapsed via message_content_text)',
    defaultValue: []
  },
  {
    key: 'current_actor',
    typeAnnotation: 'str',
    reducer: 'last_value',
    description: 'Active CrewAI actor node currently holding execution control',
    defaultValue: '__start__'
  },
  {
    key: 'task_artifacts',
    typeAnnotation: 'Annotated[dict[str, Any], operator.ior]',
    reducer: 'merge_dict',
    description: 'Merged dictionary of structured outputs from each CrewAI TaskConfig',
    defaultValue: {}
  },
  {
    key: 'revision_count',
    typeAnnotation: 'Annotated[int, operator.add]',
    reducer: 'operator.add',
    description: 'Monotonic counter tracking cyclic reflection/self-correction loops',
    defaultValue: 0
  },
  {
    key: 'quality_score',
    typeAnnotation: 'float',
    reducer: 'last_value',
    description: 'Evaluator confidence score (0.0 - 1.0) governing conditional router edge',
    defaultValue: 0.0
  },
  {
    key: 'human_approval',
    typeAnnotation: 'Optional[str]',
    reducer: 'last_value',
    description: 'Human-in-the-loop interrupt decision ("approved" | "revise" | "pending")',
    defaultValue: 'pending'
  }
];

export const LangGraphView: React.FC<LangGraphViewProps> = ({
  selectedRepo,
  selectedBranch,
  onOpenStudio,
  onOpenJules
}) => {
  // Load baseline CrewConfig from CrewStudio autosave or fallback to tech_research
  const loadBaselineCrew = useCallback((): { presetKey: string; crew: CrewConfig; topic: string } => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.crew?.agents?.length > 0) {
          return {
            presetKey: parsed.activePreset || 'tech_research',
            crew: parsed.crew,
            topic: parsed.runInput || 'Stateful Multi-Actor Agentic Systems'
          };
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return {
      presetKey: 'tech_research',
      crew: PRESET_CREWS.tech_research,
      topic: 'Stateful Multi-Actor Agentic Systems'
    };
  }, []);

  const initialBaseline = useMemo(() => loadBaselineCrew(), [loadBaselineCrew]);

  const [presetKey, setPresetKey] = useState<string>(initialBaseline.presetKey);
  const [baselineCrew, setBaselineCrew] = useState<CrewConfig>(initialBaseline.crew);
  const [inputTopic, setInputTopic] = useState<string>(initialBaseline.topic);
  const [topologyPattern, setTopologyPattern] = useState<GraphTopologyPattern>(
    initialBaseline.crew.process === 'hierarchical' ? 'supervisor_star' : 'cyclic_reflection'
  );

  // Node-level customizations (breakpoints, retries)
  const [interruptNodeIds, setInterruptNodeIds] = useState<Record<string, boolean>>({
    human_gate: true
  });
  const [nodeRetries, setNodeRetries] = useState<Record<string, number>>({});
  const [maxRevisions, setMaxRevisions] = useState<number>(2);
  const [simulateCycleOnce, setSimulateCycleOnce] = useState<boolean>(true);

  // State Channels
  const [channels, setChannels] = useState<StateChannelSpec[]>(DEFAULT_CHANNELS);
  const [newChannelKey, setNewChannelKey] = useState<string>('');
  const [newChannelReducer, setNewChannelReducer] = useState<StateChannelSpec['reducer']>('last_value');

  // Graph execution & checkpointer state
  const [threadId, setThreadId] = useState<string>('thread-lg-904a');
  const [checkpoints, setCheckpoints] = useState<GraphCheckpoint[]>([]);
  const [activeCheckpointIdx, setActiveCheckpointIdx] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isInterrupted, setIsInterrupted] = useState<boolean>(false);
  const [humanFeedbackInput, setHumanFeedbackInput] = useState<string>(
    'Approved: State artifacts verified against repository schema.'
  );
  const [statePatchJson, setStatePatchJson] = useState<string>('{"quality_score": 0.98}');
  const [statePatchError, setStatePatchError] = useState<string | null>(null);

  // Selected node & panel tab
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'state' | 'checkpoints' | 'code'>('inspector');
  const [codeLang, setCodeLang] = useState<'python' | 'typescript'>('python');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);

  // New Actor modal/inline form state
  const [showAddActorForm, setShowAddActorForm] = useState<boolean>(false);
  const [newActorName, setNewActorName] = useState<string>('');
  const [newActorRole, setNewActorRole] = useState<string>('');
  const [newActorGoal, setNewActorGoal] = useState<string>('');
  const [newActorModel, setNewActorModel] = useState<string>('gemini/gemini-3-flash-preview');
  const [newActorTool, setNewActorTool] = useState<string>('SerperDevTool');

  const triggerBanner = (msg: string) => {
    setSyncBanner(msg);
    setTimeout(() => setSyncBanner(null), 3200);
  };

  const handleSyncFromCrewStudio = () => {
    const fresh = loadBaselineCrew();
    setPresetKey(fresh.presetKey);
    setBaselineCrew(fresh.crew);
    setInputTopic(fresh.topic);
    triggerBanner(`Synced ${fresh.crew.agents.length} agents & ${fresh.crew.tasks.length} tasks from Crew Studio`);
  };

  const handlePresetChange = (newPresetKey: string) => {
    const preset = PRESET_CREWS[newPresetKey];
    if (!preset) return;
    setPresetKey(newPresetKey);
    setBaselineCrew(preset);
    setCheckpoints([]);
    setActiveCheckpointIdx(-1);
    setIsInterrupted(false);
    // Also persist to CrewStudio autosave so both tabs stay synchronized
    try {
      localStorage.setItem(
        AUTOSAVE_STORAGE_KEY,
        JSON.stringify({
          activePreset: newPresetKey,
          crew: preset,
          selectedAgentId: preset.agents[0]?.id || '',
          runInput: inputTopic,
          savedAt: new Date().toISOString()
        })
      );
    } catch {
      // ignore
    }
    triggerBanner(`Loaded baseline "${preset.name}" into LangGraph StateGraph`);
  };

  // Build LangGraph Nodes & Edges dynamically from baselineCrew + topologyPattern
  const { nodes, edges } = useMemo(() => {
    const builtNodes: LangGraphNode[] = [];
    const builtEdges: LangGraphEdge[] = [];

    const agents = baselineCrew.agents;
    const tasks = baselineCrew.tasks;

    // 1. __start__ node
    builtNodes.push({
      id: '__start__',
      label: '__start__',
      sublabel: 'Entry Point',
      kind: 'start',
      x: 60,
      y: 230,
      interruptBefore: false,
      maxRetries: 1,
      stateWrites: ['messages', 'current_actor'],
      description: 'Initializes CrewGraphState channels and dispatches the input topic into the multi-actor graph.'
    });

    if (topologyPattern === 'supervisor_star') {
      // Supervisor node in center-left
      builtNodes.push({
        id: 'supervisor_router',
        label: 'Supervisor Router',
        sublabel: baselineCrew.managerModel || 'gemini/gemini-4-argon',
        kind: 'supervisor',
        x: 240,
        y: 230,
        model: baselineCrew.managerModel || 'gemini/gemini-4-argon',
        interruptBefore: !!interruptNodeIds['supervisor_router'],
        maxRetries: nodeRetries['supervisor_router'] || 2,
        stateWrites: ['current_actor', 'messages'],
        description:
          'LangGraph Supervisor node using Command(goto=next_actor, update={...}) to dynamically delegate across CrewAI specialists.'
      });

      builtEdges.push({
        id: 'e-start-sup',
        source: '__start__',
        target: 'supervisor_router',
        kind: 'normal'
      });

      // Actor nodes arranged vertically on column x=500
      const count = Math.max(1, agents.length);
      const spacing = Math.min(130, 360 / count);
      const startY = 230 - ((count - 1) * spacing) / 2;

      agents.forEach((agent, idx) => {
        const assignedTask = tasks.find((t) => t.agentId === agent.id) || tasks[idx];
        const actorNodeId = `actor_${agent.id}`;
        const yPos = Math.round(startY + idx * spacing);

        builtNodes.push({
          id: actorNodeId,
          label: agent.name,
          sublabel: agent.role,
          kind: 'actor',
          x: 500,
          y: yPos,
          agentId: agent.id,
          taskId: assignedTask?.id,
          model: agent.model,
          tools: agent.tools,
          interruptBefore: !!interruptNodeIds[actorNodeId],
          maxRetries: nodeRetries[actorNodeId] || 3,
          stateWrites: ['messages', 'task_artifacts', 'revision_count'],
          description: `CrewAI Agent node executing "${assignedTask?.name || agent.goal}". Emits Command(goto="supervisor_router") on completion.`
        });

        // Conditional edge from supervisor -> actor
        builtEdges.push({
          id: `e-sup-${actorNodeId}`,
          source: 'supervisor_router',
          target: actorNodeId,
          kind: 'conditional',
          conditionLabel: `next == "${agent.name.split(' ')[0].toLowerCase()}"`
        });

        // Cyclic return edge from actor -> supervisor
        builtEdges.push({
          id: `e-${actorNodeId}-sup`,
          source: actorNodeId,
          target: 'supervisor_router',
          kind: 'cyclic',
          conditionLabel: 'Command(goto="supervisor")'
        });
      });

      // Human gate & __end__
      builtNodes.push({
        id: 'human_gate',
        label: 'Human Review Gate',
        sublabel: 'interrupt_before',
        kind: 'human_gate',
        x: 760,
        y: 230,
        interruptBefore: interruptNodeIds['human_gate'] ?? true,
        maxRetries: 1,
        stateWrites: ['human_approval'],
        description:
          'Checkpointer interrupt gate. Pauses graph execution before final commit so operators can inspect or patch state.'
      });

      builtNodes.push({
        id: '__end__',
        label: '__end__',
        sublabel: 'Terminal State',
        kind: 'end',
        x: 940,
        y: 230,
        interruptBefore: false,
        maxRetries: 1,
        stateWrites: [],
        description: 'Finalizes the MemorySaver checkpoint tuple and returns the synthesized CrewGraphState.'
      });

      builtEdges.push({
        id: 'e-sup-human',
        source: 'supervisor_router',
        target: 'human_gate',
        kind: 'conditional',
        conditionLabel: 'next == "FINISH"'
      });

      builtEdges.push({
        id: 'e-human-end',
        source: 'human_gate',
        target: '__end__',
        kind: 'normal'
      });
    } else {
      // cyclic_reflection or sequential_gated
      const stepX = agents.length > 2 ? 190 : 220;
      let prevNodeId = '__start__';

      agents.forEach((agent, idx) => {
        const assignedTask = tasks.find((t) => t.agentId === agent.id) || tasks[idx];
        const actorNodeId = `actor_${agent.id}`;
        const xPos = 220 + idx * stepX;
        const yPos = 200;

        builtNodes.push({
          id: actorNodeId,
          label: agent.name,
          sublabel: agent.role,
          kind: 'actor',
          x: xPos,
          y: yPos,
          agentId: agent.id,
          taskId: assignedTask?.id,
          model: agent.model,
          tools: agent.tools,
          interruptBefore: !!interruptNodeIds[actorNodeId],
          maxRetries: nodeRetries[actorNodeId] || 3,
          stateWrites: ['messages', 'task_artifacts', 'current_actor'],
          description: `CrewAI Actor Node bound to Task "${assignedTask?.name || 'Specialist Execution'}". Updates shared state channels.`
        });

        builtEdges.push({
          id: `e-${prevNodeId}-${actorNodeId}`,
          source: prevNodeId,
          target: actorNodeId,
          kind: 'normal'
        });

        // Attach a ToolNode below the actor if it has tools
        if (agent.tools && agent.tools.length > 0) {
          const toolNodeId = `tools_${agent.id}`;
          builtNodes.push({
            id: toolNodeId,
            label: `ToolNode (${agent.tools.length})`,
            sublabel: agent.tools.slice(0, 2).join(', '),
            kind: 'tool_node',
            x: xPos,
            y: 365,
            tools: agent.tools,
            interruptBefore: !!interruptNodeIds[toolNodeId],
            maxRetries: 2,
            stateWrites: ['messages'],
            description: `LangGraph prebuilt ToolNode executing [${agent.tools.join(', ')}] via tools_condition edge.`
          });

          builtEdges.push({
            id: `e-${actorNodeId}-${toolNodeId}`,
            source: actorNodeId,
            target: toolNodeId,
            kind: 'conditional',
            conditionLabel: 'tools_condition'
          });

          builtEdges.push({
            id: `e-${toolNodeId}-${actorNodeId}`,
            source: toolNodeId,
            target: actorNodeId,
            kind: 'cyclic',
            conditionLabel: 'tool_output'
          });
        }

        prevNodeId = actorNodeId;
      });

      const lastX = 220 + Math.max(0, agents.length - 1) * stepX;

      if (topologyPattern === 'cyclic_reflection') {
        const routerX = lastX + 185;
        builtNodes.push({
          id: 'quality_router',
          label: 'Reflection Router',
          sublabel: 'should_continue()',
          kind: 'router',
          x: routerX,
          y: 200,
          interruptBefore: !!interruptNodeIds['quality_router'],
          maxRetries: 1,
          stateWrites: ['quality_score', 'revision_count'],
          description:
            'Evaluates output schema & quality_score. Routes back to the lead CrewAI actor if revision_count < max_revisions.'
        });

        builtEdges.push({
          id: `e-${prevNodeId}-router`,
          source: prevNodeId,
          target: 'quality_router',
          kind: 'normal'
        });

        const firstActorId = agents[0] ? `actor_${agents[0].id}` : '__start__';
        builtEdges.push({
          id: 'e-router-cycle',
          source: 'quality_router',
          target: firstActorId,
          kind: 'cyclic',
          conditionLabel: `score < 0.85 (rev < ${maxRevisions})`
        });

        builtNodes.push({
          id: 'human_gate',
          label: 'Human Interrupt',
          sublabel: 'interrupt_before',
          kind: 'human_gate',
          x: routerX + 165,
          y: 200,
          interruptBefore: interruptNodeIds['human_gate'] ?? true,
          maxRetries: 1,
          stateWrites: ['human_approval'],
          description: 'Human-in-the-loop breakpoint prior to finalizing the StateGraph execution.'
        });

        builtEdges.push({
          id: 'e-router-human',
          source: 'quality_router',
          target: 'human_gate',
          kind: 'conditional',
          conditionLabel: 'score >= 0.85'
        });

        builtNodes.push({
          id: '__end__',
          label: '__end__',
          sublabel: 'Terminal State',
          kind: 'end',
          x: routerX + 315,
          y: 200,
          interruptBefore: false,
          maxRetries: 1,
          stateWrites: [],
          description: 'Terminal StateGraph sink node.'
        });

        builtEdges.push({
          id: 'e-human-end',
          source: 'human_gate',
          target: '__end__',
          kind: 'normal'
        });
      } else {
        // sequential_gated
        const gateX = lastX + 185;
        builtNodes.push({
          id: 'human_gate',
          label: 'Human Review Gate',
          sublabel: 'interrupt_before',
          kind: 'human_gate',
          x: gateX,
          y: 200,
          interruptBefore: interruptNodeIds['human_gate'] ?? true,
          maxRetries: 1,
          stateWrites: ['human_approval'],
          description: 'Pauses execution before __end__ for human state verification.'
        });

        builtEdges.push({
          id: `e-${prevNodeId}-human`,
          source: prevNodeId,
          target: 'human_gate',
          kind: 'normal'
        });

        builtNodes.push({
          id: '__end__',
          label: '__end__',
          sublabel: 'Terminal State',
          kind: 'end',
          x: gateX + 175,
          y: 200,
          interruptBefore: false,
          maxRetries: 1,
          stateWrites: [],
          description: 'Terminal StateGraph sink node.'
        });

        builtEdges.push({
          id: 'e-human-end',
          source: 'human_gate',
          target: '__end__',
          kind: 'normal'
        });
      }
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [baselineCrew, topologyPattern, interruptNodeIds, nodeRetries, maxRevisions]);

  // Dynamic Pan, Zoom, Smooth Camera Transition & Minimap State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningCanvas, setIsPanningCanvas] = useState<boolean>(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isDraggingMinimap, setIsDraggingMinimap] = useState<boolean>(false);
  const [isSmoothTransitioning, setIsSmoothTransitioning] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [viewportDims, setViewportDims] = useState<{ width: number; height: number }>({
    width: 780,
    height: 470
  });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [nodePositionOverrides, setNodePositionOverrides] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const minimapSvgRef = useRef<SVGSVGElement | null>(null);
  const smoothTransitionTimerRef = useRef<number | null>(null);
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

  const triggerSmoothTransition = useCallback(() => {
    setIsSmoothTransitioning(true);
    if (smoothTransitionTimerRef.current) {
      window.clearTimeout(smoothTransitionTimerRef.current);
    }
    smoothTransitionTimerRef.current = window.setTimeout(() => {
      setIsSmoothTransitioning(false);
    }, 340);
  }, []);

  // Track viewport container dimensions for accurate Zoom-to-Fit and Minimap camera frame
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const updateDims = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportDims({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };
    updateDims();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateDims);
      observer.observe(viewport);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateDims);
      return () => window.removeEventListener('resize', updateDims);
    }
  }, []);

  // Apply interactive node drag position overrides
  const positionedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const override = nodePositionOverrides[node.id];
        return override ? { ...node, x: override.x, y: override.y } : node;
      }),
    [nodes, nodePositionOverrides]
  );

  // Compute bounding box of all positioned nodes for Smooth Zoom-to-Fit
  const computeFitTransform = useCallback(
    (targetNodes: LangGraphNode[]) => {
      const viewport = canvasViewportRef.current;
      const vw = viewport ? viewport.clientWidth || viewportDims.width : viewportDims.width;
      const vh = viewport ? viewport.clientHeight || viewportDims.height : viewportDims.height;

      if (!targetNodes.length || vw <= 0 || vh <= 0) {
        return { zoom: 1, pan: { x: 0, y: 0 } };
      }

      const topArcPadding = topologyPattern === 'cyclic_reflection' ? 135 : 55;
      const minX = Math.min(...targetNodes.map((n) => n.x - 84));
      const maxX = Math.max(...targetNodes.map((n) => n.x + 84));
      const minY = Math.min(...targetNodes.map((n) => n.y - topArcPadding));
      const maxY = Math.max(...targetNodes.map((n) => n.y + 65));

      const graphWidth = Math.max(240, maxX - minX);
      const graphHeight = Math.max(160, maxY - minY);

      const horizontalPadding = 64;
      const verticalPadding = 84;
      const scaleX = (vw - horizontalPadding) / graphWidth;
      const scaleY = (vh - verticalPadding) / graphHeight;
      const optimalZoom = Math.min(1.25, Math.max(0.45, Number(Math.min(scaleX, scaleY).toFixed(2))));

      const graphCenterX = (minX + maxX) / 2;
      const graphCenterY = (minY + maxY) / 2;

      return {
        zoom: optimalZoom,
        pan: {
          x: Math.round(vw / 2 - graphCenterX * optimalZoom),
          y: Math.round(vh / 2 - graphCenterY * optimalZoom)
        }
      };
    },
    [topologyPattern, viewportDims.height, viewportDims.width]
  );

  // Smooth Zoom-to-Fit handler
  const handleFitView = useCallback(() => {
    triggerSmoothTransition();
    const { zoom, pan } = computeFitTransform(positionedNodes);
    setZoomLevel(zoom);
    setPanOffset(pan);
  }, [computeFitTransform, positionedNodes, triggerSmoothTransition]);

  // Reset custom node overrides and smoothly fit view when switching topology pattern or preset
  useEffect(() => {
    setNodePositionOverrides({});
    const timer = window.setTimeout(() => {
      triggerSmoothTransition();
      const { zoom, pan } = computeFitTransform(nodes);
      setZoomLevel(zoom);
      setPanOffset(pan);
    }, 20);
    return () => window.clearTimeout(timer);
  }, [topologyPattern, presetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Non-passive wheel listener for smooth cursor-centered zoom inside the topology canvas
  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setIsSmoothTransitioning(false);
      const rect = viewport.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoomLevel((prevZoom) => {
        const nextZoom = Math.min(2.2, Math.max(0.4, Number((prevZoom * zoomFactor).toFixed(3))));
        const scaleRatio = nextZoom / prevZoom;
        setPanOffset((prevPan) => ({
          x: Math.round(cursorX - (cursorX - prevPan.x) * scaleRatio),
          y: Math.round(cursorY - (cursorY - prevPan.y) * scaleRatio)
        }));
        return nextZoom;
      });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  // Pan main viewport camera to a world coordinate clicked/dragged inside the Minimap
  const panCameraToMinimapEvent = useCallback(
    (clientX: number, clientY: number, animate: boolean) => {
      const svg = minimapSvgRef.current;
      const viewport = canvasViewportRef.current;
      if (!svg || !viewport) return;

      const rect = svg.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

      const worldX = relX * 1400;
      const worldY = relY * 560;

      if (animate) {
        triggerSmoothTransition();
      } else {
        setIsSmoothTransitioning(false);
      }

      const vw = viewport.clientWidth || viewportDims.width;
      const vh = viewport.clientHeight || viewportDims.height;

      setPanOffset({
        x: Math.round(vw / 2 - worldX * zoomLevel),
        y: Math.round(vh / 2 - worldY * zoomLevel)
      });
    },
    [triggerSmoothTransition, viewportDims.height, viewportDims.width, zoomLevel]
  );

  // Global mousemove / mouseup listeners for smooth canvas panning, node dragging, and minimap scrubbing
  useEffect(() => {
    if (!isPanningCanvas && !draggingNodeId && !isDraggingMinimap) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingMinimap) {
        panCameraToMinimapEvent(e.clientX, e.clientY, false);
        return;
      }

      const dx = e.clientX - pointerStartRef.current.clientX;
      const dy = e.clientY - pointerStartRef.current.clientY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        pointerStartRef.current.moved = true;
      }

      if (isPanningCanvas) {
        setPanOffset({
          x: pointerStartRef.current.originX + dx,
          y: pointerStartRef.current.originY + dy
        });
      } else if (draggingNodeId) {
        const scaledDx = dx / zoomLevel;
        const scaledDy = dy / zoomLevel;
        setNodePositionOverrides((prev) => ({
          ...prev,
          [draggingNodeId]: {
            x: Math.max(70, Math.min(1350, Math.round(pointerStartRef.current.originX + scaledDx))),
            y: Math.max(45, Math.min(520, Math.round(pointerStartRef.current.originY + scaledDy)))
          }
        }));
      }
    };

    const handleMouseUp = () => {
      setIsPanningCanvas(false);
      setDraggingNodeId(null);
      setIsDraggingMinimap(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanningCanvas, draggingNodeId, isDraggingMinimap, zoomLevel, panCameraToMinimapEvent]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsSmoothTransitioning(false);
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
      moved: false
    };
    setIsPanningCanvas(true);
  };

  const handleNodeMouseDown = (e: React.MouseEvent<HTMLButtonElement>, node: LangGraphNode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setIsSmoothTransitioning(false);
    pointerStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      originX: node.x,
      originY: node.y,
      moved: false
    };
    setDraggingNodeId(node.id);
  };

  const handleZoomIn = () => {
    triggerSmoothTransition();
    const vw = canvasViewportRef.current?.clientWidth || viewportDims.width;
    const vh = canvasViewportRef.current?.clientHeight || viewportDims.height;
    const centerX = vw / 2;
    const centerY = vh / 2;
    setZoomLevel((prevZoom) => {
      const nextZoom = Math.min(2.2, Number((prevZoom + 0.15).toFixed(2)));
      const scaleRatio = nextZoom / prevZoom;
      setPanOffset((prevPan) => ({
        x: Math.round(centerX - (centerX - prevPan.x) * scaleRatio),
        y: Math.round(centerY - (centerY - prevPan.y) * scaleRatio)
      }));
      return nextZoom;
    });
  };

  const handleZoomOut = () => {
    triggerSmoothTransition();
    const vw = canvasViewportRef.current?.clientWidth || viewportDims.width;
    const vh = canvasViewportRef.current?.clientHeight || viewportDims.height;
    const centerX = vw / 2;
    const centerY = vh / 2;
    setZoomLevel((prevZoom) => {
      const nextZoom = Math.max(0.4, Number((prevZoom - 0.15).toFixed(2)));
      const scaleRatio = nextZoom / prevZoom;
      setPanOffset((prevPan) => ({
        x: Math.round(centerX - (centerX - prevPan.x) * scaleRatio),
        y: Math.round(centerY - (centerY - prevPan.y) * scaleRatio)
      }));
      return nextZoom;
    });
  };

  const handleResetZoom100 = () => {
    triggerSmoothTransition();
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCenterOnActiveNode = () => {
    const targetId = currentCheckpoint?.nodeId || selectedNodeId;
    const target = positionedNodes.find((n) => n.id === targetId) || positionedNodes[0];
    if (!target || !canvasViewportRef.current) return;
    triggerSmoothTransition();
    const rect = canvasViewportRef.current.getBoundingClientRect();
    setPanOffset({
      x: Math.round(rect.width / 2 - target.x * zoomLevel),
      y: Math.round(rect.height / 2 - target.y * zoomLevel)
    });
  };

  // Keep selectedNodeId valid
  useEffect(() => {
    if (!selectedNodeId || !nodes.some((n) => n.id === selectedNodeId)) {
      const firstActor = nodes.find((n) => n.kind === 'actor') || nodes[0];
      if (firstActor) setSelectedNodeId(firstActor.id);
    }
  }, [nodes, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || nodes[0],
    [nodes, selectedNodeId]
  );

  const selectedAgent = useMemo(
    () => baselineCrew.agents.find((a) => a.id === selectedNode?.agentId) || null,
    [baselineCrew.agents, selectedNode]
  );

  const selectedTask = useMemo(
    () => baselineCrew.tasks.find((t) => t.id === selectedNode?.taskId) || null,
    [baselineCrew.tasks, selectedNode]
  );

  // Build ordered execution plan of super-steps for simulation
  const buildExecutionSequence = useCallback((): LangGraphNode[] => {
    const seq: LangGraphNode[] = [];
    const startNode = nodes.find((n) => n.id === '__start__');
    if (startNode) seq.push(startNode);

    const actors = nodes.filter((n) => n.kind === 'actor');
    const sup = nodes.find((n) => n.id === 'supervisor_router');
    const router = nodes.find((n) => n.id === 'quality_router');
    const humanGate = nodes.find((n) => n.id === 'human_gate');
    const endNode = nodes.find((n) => n.id === '__end__');

    if (topologyPattern === 'supervisor_star' && sup) {
      actors.forEach((actor) => {
        seq.push(sup);
        seq.push(actor);
      });
      seq.push(sup);
    } else {
      actors.forEach((actor) => {
        seq.push(actor);
        const attachedTool = nodes.find((n) => n.id === `tools_${actor.agentId}`);
        if (attachedTool) {
          seq.push(attachedTool);
          seq.push(actor);
        }
      });

      if (router) {
        seq.push(router);
        if (simulateCycleOnce && actors.length > 0) {
          // Simulate 1 cyclic reflection loop back to first actor
          seq.push(actors[0]);
          seq.push(router);
        }
      }
    }

    if (humanGate) seq.push(humanGate);
    if (endNode) seq.push(endNode);
    return seq;
  }, [nodes, topologyPattern, simulateCycleOnce]);

  // Compute initial state object from channels
  const buildInitialChannelValues = useCallback((): Record<string, unknown> => {
    const base: Record<string, unknown> = {};
    channels.forEach((c) => {
      base[c.key] = Array.isArray(c.defaultValue)
        ? [...c.defaultValue]
        : typeof c.defaultValue === 'object' && c.defaultValue !== null
        ? { ...(c.defaultValue as Record<string, unknown>) }
        : c.defaultValue;
    });
    base.messages = [
      {
        role: 'user',
        content: `Execute multi-actor graph for topic: "${inputTopic}" on ${selectedRepo}@${selectedBranch}`
      }
    ];
    base.current_actor = '__start__';
    return base;
  }, [channels, inputTopic, selectedRepo, selectedBranch]);

  // Create a checkpoint for a given step in the sequence
  const createCheckpointForNode = useCallback(
    (
      stepIdx: number,
      targetNode: LangGraphNode,
      nextNode: LangGraphNode | undefined,
      prevValues: Record<string, unknown>,
      interrupted: boolean
    ): GraphCheckpoint => {
      const nextVals: Record<string, unknown> = {
        ...prevValues,
        current_actor: targetNode.id
      };

      const prevMsgs = Array.isArray(prevValues.messages) ? [...(prevValues.messages as unknown[])] : [];
      const prevArtifacts =
        typeof prevValues.task_artifacts === 'object' && prevValues.task_artifacts !== null
          ? { ...(prevValues.task_artifacts as Record<string, unknown>) }
          : {};
      let deltaSummary = `Transitioned to ${targetNode.label}`;

      if (targetNode.kind === 'start') {
        deltaSummary = `Initialized StateGraph thread ${threadId} with topic "${inputTopic}"`;
      } else if (targetNode.kind === 'supervisor') {
        const nextActorLabel = nextNode?.label || 'FINISH';
        prevMsgs.push({
          role: 'supervisor',
          node: targetNode.id,
          content: `[Supervisor Command] Routing execution to "${nextActorLabel}"`
        });
        nextVals.messages = prevMsgs;
        deltaSummary = `Command(goto="${nextNode?.id || '__end__'}")`;
      } else if (targetNode.kind === 'actor') {
        const agent = baselineCrew.agents.find((a) => a.id === targetNode.agentId);
        const task = baselineCrew.tasks.find((t) => t.id === targetNode.taskId);
        const artifactKey = task?.name
          ? task.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
          : targetNode.id;
        prevArtifacts[artifactKey] = {
          actor: agent?.name || targetNode.label,
          role: agent?.role || targetNode.sublabel,
          model: agent?.model || 'gemini/gemini-3-flash-preview',
          summary: `Verified deliverable for "${task?.expectedOutput || inputTopic}"`,
          timestamp: new Date().toLocaleTimeString()
        };
        prevMsgs.push({
          role: 'assistant',
          actor: targetNode.label,
          content: `${targetNode.label} (${targetNode.sublabel}) completed state mutation for "${
            task?.name || inputTopic
          }".`
        });
        nextVals.messages = prevMsgs;
        nextVals.task_artifacts = prevArtifacts;
        deltaSummary = `Updated task_artifacts["${artifactKey}"] & appended AIMessage`;
      } else if (targetNode.kind === 'tool_node') {
        const toolName = targetNode.tools?.[0] || 'SerperDevTool';
        prevMsgs.push({
          role: 'tool',
          tool_name: toolName,
          content: `ToolNode [${toolName}] returned 6 structured citations for "${inputTopic}".`
        });
        nextVals.messages = prevMsgs;
        deltaSummary = `Executed ${toolName} -> returned ToolMessage to actor`;
      } else if (targetNode.kind === 'router') {
        const prevRev = typeof prevValues.revision_count === 'number' ? prevValues.revision_count : 0;
        const isLooping = nextNode?.kind === 'actor';
        nextVals.revision_count = isLooping ? prevRev + 1 : prevRev;
        nextVals.quality_score = isLooping ? 0.76 : 0.96;
        deltaSummary = isLooping
          ? `Quality score 0.76 < 0.85 -> Cyclic edge back to ${nextNode?.label} (rev #${prevRev + 1})`
          : `Quality score 0.96 >= 0.85 -> Proceeding to ${nextNode?.label || '__end__'}`;
      } else if (targetNode.kind === 'human_gate') {
        nextVals.human_approval = interrupted ? 'awaiting_human_input' : 'approved';
        deltaSummary = interrupted
          ? 'Interrupted before Human Review Gate (awaiting operator Command(resume=...))'
          : `Human Review Gate approved: "${humanFeedbackInput}"`;
      } else if (targetNode.kind === 'end') {
        nextVals.human_approval = 'approved';
        deltaSummary = 'StateGraph reached __end__ terminal state (checkpoint persisted)';
      }

      return {
        checkpointId: `ckpt-${stepIdx + 1}-${Math.random().toString(36).substring(2, 6)}`,
        threadId,
        step: stepIdx + 1,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        nodeId: targetNode.id,
        nodeLabel: targetNode.label,
        nextNodes: nextNode ? [nextNode.id] : [],
        status: interrupted ? 'interrupted' : 'completed',
        channelValues: nextVals,
        deltaSummary,
        tokensUsed: targetNode.kind === 'actor' ? 420 + stepIdx * 65 : 95,
        durationMs: targetNode.kind === 'actor' ? 380 + stepIdx * 40 : 60
      };
    },
    [baselineCrew, humanFeedbackInput, inputTopic, threadId]
  );

  // Step forward 1 super-step
  const handleStepForward = useCallback(() => {
    const seq = buildExecutionSequence();
    const nextStepIndex = activeCheckpointIdx + 1;
    if (nextStepIndex >= seq.length) return;

    const targetNode = seq[nextStepIndex];
    const nextNode = seq[nextStepIndex + 1];
    const prevVals =
      activeCheckpointIdx >= 0 && checkpoints[activeCheckpointIdx]
        ? checkpoints[activeCheckpointIdx].channelValues
        : buildInitialChannelValues();

    // Check if targetNode has interruptBefore enabled and we haven't already paused on it
    const currentCkpt = activeCheckpointIdx >= 0 ? checkpoints[activeCheckpointIdx] : null;
    if (targetNode.interruptBefore && !isInterrupted && currentCkpt?.nodeId !== targetNode.id) {
      const interruptCkpt = createCheckpointForNode(
        nextStepIndex,
        targetNode,
        nextNode,
        prevVals,
        true
      );
      const updated = [...checkpoints.slice(0, activeCheckpointIdx + 1), interruptCkpt];
      setCheckpoints(updated);
      setActiveCheckpointIdx(updated.length - 1);
      setIsInterrupted(true);
      setIsRunning(false);
      setSelectedNodeId(targetNode.id);
      return;
    }

    // If resuming from an interrupt on the current node
    if (isInterrupted && currentCkpt) {
      const resumedNode = seq.find((n) => n.id === currentCkpt.nodeId) || targetNode;
      const resumedIdx = seq.findIndex((n) => n.id === resumedNode.id);
      const followingNode = seq[resumedIdx + 1];
      const resumedVals = {
        ...currentCkpt.channelValues,
        human_approval: `Approved: ${humanFeedbackInput}`
      };
      const resumedCkpt = createCheckpointForNode(
         currentCkpt.step,
        resumedNode,
        followingNode,
        resumedVals,
        false
      );
      const updated = [...checkpoints.slice(0, activeCheckpointIdx), resumedCkpt];
      setCheckpoints(updated);
      setActiveCheckpointIdx(updated.length - 1);
      setIsInterrupted(false);
      return;
    }

    const newCkpt = createCheckpointForNode(nextStepIndex, targetNode, nextNode, prevVals, false);
    const updated = [...checkpoints.slice(0, activeCheckpointIdx + 1), newCkpt];
    setCheckpoints(updated);
    setActiveCheckpointIdx(updated.length - 1);
    setSelectedNodeId(targetNode.id);
  }, [
    activeCheckpointIdx,
    buildExecutionSequence,
    buildInitialChannelValues,
    checkpoints,
    createCheckpointForNode,
    humanFeedbackInput,
    isInterrupted
  ]);

  // Continuous execution effect when isRunning is true
  useEffect(() => {
    if (!isRunning) return;
    const seq = buildExecutionSequence();
    if (activeCheckpointIdx >= seq.length - 1) {
      setIsRunning(false);
      return;
    }
    const timer = setTimeout(() => {
      handleStepForward();
    }, 650);
    return () => clearTimeout(timer);
  }, [isRunning, activeCheckpointIdx, buildExecutionSequence, handleStepForward]);

  const handleRunGraph = () => {
    if (isInterrupted) {
      // Resume from interrupt and continue running
      handleStepForward();
      setIsRunning(true);
      return;
    }
    const seq = buildExecutionSequence();
    if (activeCheckpointIdx >= seq.length - 1) {
      // Restart from beginning
      setCheckpoints([]);
      setActiveCheckpointIdx(-1);
    }
    setIsRunning(true);
  };

  const handleResetGraph = () => {
    setIsRunning(false);
    setIsInterrupted(false);
    setCheckpoints([]);
    setActiveCheckpointIdx(-1);
    setThreadId(`thread-lg-${Math.random().toString(36).substring(2, 6)}`);
  };

  // Fork / Time-travel to an earlier checkpoint
  const handleTimeTravelToCheckpoint = (idx: number) => {
    const target = checkpoints[idx];
    if (!target) return;
    setIsRunning(false);
    setIsInterrupted(target.status === 'interrupted');
    setActiveCheckpointIdx(idx);
    setSelectedNodeId(target.nodeId);
    triggerBanner(`Time-traveled to Checkpoint #${target.step} (${target.checkpointId}) at ${target.nodeLabel}`);
  };

  // Apply live state patch (graph.update_state)
  const handleApplyStatePatch = () => {
    setStatePatchError(null);
    try {
      const parsed = JSON.parse(statePatchJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setStatePatchError('State update must be a JSON object.');
        return;
      }
      const baseVals =
        activeCheckpointIdx >= 0 && checkpoints[activeCheckpointIdx]
          ? checkpoints[activeCheckpointIdx].channelValues
          : buildInitialChannelValues();
      const mergedVals = { ...baseVals, ...parsed };
      const forkedCkpt: GraphCheckpoint = {
        checkpointId: `fork-${checkpoints.length + 1}-${Math.random().toString(36).substring(2, 5)}`,
        threadId,
        step: checkpoints.length + 1,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        nodeId: selectedNode?.id || '__start__',
        nodeLabel: `${selectedNode?.label || 'State'} (Forked)`,
        nextNodes: [],
        status: 'forked',
        channelValues: mergedVals,
        deltaSummary: `graph.update_state(values=${ JSON.stringify(parsed) }, as_node="${
          selectedNode?.id || 'operator'
        }")`,
        tokensUsed: 0,
        durationMs: 12
      };
      const nextList = [...checkpoints.slice(0, activeCheckpointIdx + 1), forkedCkpt];
      setCheckpoints(nextList);
      setActiveCheckpointIdx(nextList.length - 1);
      triggerBanner(`Applied graph.update_state() and forked checkpoint ${forkedCkpt.checkpointId}`);
    } catch (e: any) {
      setStatePatchError(e?.message || 'Invalid JSON syntax');
    }
  };

  // Toggle interruptBefore breakpoint on a node
  const toggleNodeInterrupt = (nodeId: string) => {
    setInterruptNodeIds((prev) => ({
      ...prev,
      [nodeId]: !(prev[nodeId] ?? (nodeId === 'human_gate'))
    }));
  };

  // Add a new CrewAI Actor Node to the graph & baseline CrewConfig
  const handleAddActorNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActorName.trim() || !newActorRole.trim()) return;
    const newId = `agent-${Date.now().toString().slice(-4)}`;
    const newTaskId = `task-${Date.now().toString().slice(-4)}`;
    const newAgent: AgentConfig = {
      id: newId,
      name: newActorName.trim(),
      role: newActorRole.trim(),
      goal: newActorGoal.trim() || `Execute specialized stateful analysis for ${newActorRole.trim()}`,
      backstory: 'Stateful LangGraph + CrewAI specialist actor configured with durable checkpoint memory.',
      model: newActorModel,
      tools: newActorTool ? [newActorTool] : [],
      verbose: true,
      memory: true,
      maxIter: 8,
      allowDelegation: true
    };
    const newTask: TaskConfig = {
      id: newTaskId,
      name: `${newActorRole.trim()} Execution`,
      description: newActorGoal.trim() || `Perform multi-actor synthesis for ${inputTopic}`,
      expectedOutput: 'Structured state artifact dictionary update',
      agentId: newId,
      outputFormat: 'json'
    };

    const updatedCrew: CrewConfig = {
      ...baselineCrew,
      agents: [...baselineCrew.agents, newAgent],
      tasks: [...baselineCrew.tasks, newTask]
    };
    setBaselineCrew(updatedCrew);
    try {
      localStorage.setItem(
        AUTOSAVE_STORAGE_KEY,
        JSON.stringify({
          activePreset: presetKey,
          crew: updatedCrew,
          selectedAgentId: newId,
          runInput: inputTopic,
          savedAt: new Date().toISOString()
        })
      );
    } catch {
      // ignore
    }
    setNewActorName('');
    setNewActorRole('');
    setNewActorGoal('');
    setShowAddActorForm(false);
    setSelectedNodeId(`actor_${newId}`);
    triggerBanner(`Added Actor "${newAgent.name}" to LangGraph & synced with Crew Studio baseline`);
  };

  // Remove custom actor node if > 1 agent
  const handleRemoveActorNode = (agentId: string) => {
    if (baselineCrew.agents.length <= 1) return;
    const updatedCrew: CrewConfig = {
      ...baselineCrew,
      agents: baselineCrew.agents.filter((a) => a.id !== agentId),
      tasks: baselineCrew.tasks.filter((t) => t.agentId !== agentId)
    };
    setBaselineCrew(updatedCrew);
    try {
      localStorage.setItem(
        AUTOSAVE_STORAGE_KEY,
        JSON.stringify({
          activePreset: presetKey,
          crew: updatedCrew,
          selectedAgentId: updatedCrew.agents[0]?.id || '',
          runInput: inputTopic,
          savedAt: new Date().toISOString()
        })
      );
    } catch {
      // ignore
    }
    triggerBanner('Removed actor node and synced baseline CrewConfig');
  };

  // Add custom StateChannelSpec
  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newChannelKey.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleanKey || channels.some((c) => c.key === cleanKey)) return;
    const typeMap: Record<StateChannelSpec['reducer'], string> = {
      add_messages: 'Annotated[list[AnyMessage], add_messages]',
      'operator.add': 'Annotated[int, operator.add]',
      merge_dict: 'Annotated[dict[str, Any], operator.ior]',
      last_value: 'Any'
    };
    const defaultMap: Record<StateChannelSpec['reducer'], unknown> = {
      add_messages: [],
      'operator.add': 0,
      merge_dict: {},
      last_value: null
    };
    setChannels((prev) => [
      ...prev,
      {
        key: cleanKey,
        typeAnnotation: typeMap[newChannelReducer],
        reducer: newChannelReducer,
        description: `Custom state channel (${newChannelReducer} reducer)`,
        defaultValue: defaultMap[newChannelReducer]
      }
    ]);
    setNewChannelKey('');
    triggerBanner(`Added state channel "${cleanKey}" to CrewGraphState`);
  };

  const currentCheckpoint = activeCheckpointIdx >= 0 ? checkpoints[activeCheckpointIdx] : null;
  const activeChannelValues = useMemo(
    () => (currentCheckpoint ? currentCheckpoint.channelValues : buildInitialChannelValues()),
    [currentCheckpoint, buildInitialChannelValues]
  );

  // Generate runnable Python LangGraph + CrewAI hybrid code (compliant with AGENTS.md message_content_text)
  const generatedPythonCode = useMemo(() => {
    const interruptList = nodes
      .filter((n) => n.interruptBefore)
      .map((n) => `"${n.id}"`)
      .join(', ');

    return `"""
LangGraph Stateful Multi-Actor Orchestrator built on CrewAI Baseline Architecture
Baseline Crew: ${baselineCrew.name} (${topologyPattern})
Repository Context: ${selectedRepo}@${selectedBranch}
"""
import operator
from typing import Annotated, Any, Literal, Optional, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command, RetryPolicy
from crewai import Agent, Task, LLM
from crewai.utilities.agent_utils import message_content_text


# 1. Shared Multi-Actor StateGraph Schema & Channel Reducers
class CrewGraphState(TypedDict):
${channels
  .map((c) => `    ${c.key}: ${c.typeAnnotation}  # ${c.description}`)
  .join('\n')}


# 2. Baseline CrewAI Agents Wrapped as Stateful LangGraph Actor Nodes
${baselineCrew.agents
  .map((a, idx) => {
    const pyVar = a.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const assignedTask = baselineCrew.tasks.find((t) => t.agentId === a.id) || baselineCrew.tasks[idx];
    return `${pyVar}_agent = Agent(
    role="${a.role}",
    goal="${a.goal}",
    backstory="""${a.backstory}""",
    llm=LLM(model="${a.model}", temperature=0.2),
    verbose=${a.verbose ? 'True' : 'False'},
    memory=${a.memory ? 'True' : 'False'}
)

def actor_${pyVar}_node(state: CrewGraphState) -> Command[Literal["${
      topologyPattern === 'supervisor_star' ? 'supervisor_router' : 'quality_router'
    }"]]:
    """Executes CrewAI Agent '${a.name}' and collapses multimodal content safely."""
    last_msg = state["messages"][-1] if state.get("messages") else None
    prompt_context = message_content_text(last_msg) if last_msg else "${inputTopic}"
    task = Task(
        description=f"""${assignedTask?.description || a.goal}\\nContext: {prompt_context}""",
        expected_output="""${assignedTask?.expectedOutput || 'Structured state update'}""",
        agent=${pyVar}_agent
    )
    raw_output = task.execute_sync()
    # AGENTS.md Rule: Never str() LLMMessage.content; always collapse via message_content_text
    clean_text = message_content_text(raw_output)
    return Command(
        update={
            "messages": [{"role": "assistant", "content": clean_text, "name": "${a.id}"}],
            "current_actor": "actor_${a.id}",
            "task_artifacts": {"${a.id}": clean_text},
        },
        goto="${topologyPattern === 'supervisor_star' ? 'supervisor_router' : 'quality_router'}"
    )`;
  })
  .join('\n\n')}


# 3. Conditional Reflection / Supervisor Routing Logic
def should_continue(state: CrewGraphState) -> Literal["actor_${
      baselineCrew.agents[0]?.id || 'agent_1'
    }", "human_gate"]:
    if state.get("quality_score", 0.9) < 0.85 and state.get("revision_count", 0) < ${maxRevisions}:
        return "actor_${baselineCrew.agents[0]?.id || 'agent_1'}"
    return "human_gate"


# 4. Compile StateGraph with MemorySaver Checkpointer & Breakpoints
builder = StateGraph(CrewGraphState)
${baselineCrew.agents
  .map((a) => {
    const pyVar = a.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const retries = nodeRetries[`actor_${a.id}`] || 3;
    return `builder.add_node("actor_${a.id}", actor_${pyVar}_node, retry=RetryPolicy(max_attempts=${retries}))`;
  })
  .join('\n')}
builder.add_node("quality_router", lambda state: {"quality_score": 0.95, "revision_count": 1})
builder.add_node("human_gate", lambda state: {"human_approval": "approved"})

builder.add_edge(START, "actor_${baselineCrew.agents[0]?.id || 'agent_1'}")
builder.add_conditional_edges("quality_router", should_continue)
builder.add_edge("human_gate", END)

checkpointer = MemorySaver()
graph = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=[${interruptList}]
)

if __name__ == "__main__":
    thread_config = {"configurable": {"thread_id": "${threadId}"}}
    final_state = graph.invoke(
        {"messages": [{"role": "user", "content": "${inputTopic}"}], "revision_count": 0},
        config=thread_config
    )
    print("Completed Graph Checkpoints:", len(list(graph.get_state_history(thread_config))))
`;
  }, [
    baselineCrew,
    channels,
    inputTopic,
    maxRevisions,
    nodeRetries,
    nodes,
    selectedBranch,
    selectedRepo,
    threadId,
    topologyPattern
  ]);

  const generatedTsCode = useMemo(() => {
    const interruptList = nodes
      .filter((n) => n.interruptBefore)
      .map((n) => `"${n.id}"`)
      .join(', ');

    return `import { Annotation, StateGraph, START, END, MemorySaver, Command } from "@langchain/langgraph";

// 1. StateGraph Annotation Root derived from CrewAI Baseline (${baselineCrew.name})
const CrewGraphAnnotation = Annotation.Root({
  messages: Annotation<Array<{ role: string; content: string }>>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  current_actor: Annotation<string>({
    reducer: (_, right) => right,
    default: () => "__start__",
  }),
  task_artifacts: Annotation<Record<string, unknown>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  revision_count: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0,
  }),
});

// 2. Define CrewAI Actor Nodes (${baselineCrew.agents.map((a) => a.name).join(', ')})
const workflow = new StateGraph(CrewGraphAnnotation)
${baselineCrew.agents
  .map(
    (a) => `  .addNode("actor_${a.id}", async (state) => {
    return new Command({
      update: {
        current_actor: "actor_${a.id}",
        task_artifacts: { "${a.id}": "Synthesized output by ${a.name} (${a.role})" },
      },
      goto: "human_gate",
    });
  })`
  )
  .join('\n')}
  .addNode("human_gate", async () => ({ current_actor: "human_gate" }))
  .addEdge(START, "actor_${baselineCrew.agents[0]?.id || 'agent-1'}")
  .addEdge("human_gate", END);

export const appGraph = workflow.compile({
  checkpointer: new MemorySaver(),
  interruptBefore: [${interruptList}],
});
`;
  }, [baselineCrew, nodes]);

  const handleCopyCode = () => {
    const text = codeLang === 'python' ? generatedPythonCode : generatedTsCode;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 bg-[#0B0F19]">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
              <Network className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              LangGraph Stateful Multi-Actor Studio
            </h1>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              CrewAI Baseline Connected
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-3xl">
            Visualize, orchestrate, and time-travel through cyclic, stateful multi-actor <code className="text-slate-200 font-mono">StateGraph</code> topologies compiled directly from your active CrewAI <code className="text-[#EB6658] font-mono">CrewConfig</code> agents, tools, and tasks.
          </p>
        </div>

        {/* Controls & Baseline Sync */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5">
            <Layers className="w-3.5 h-3.5 text-[#EB6658]" />
            <span className="text-xs text-slate-400">CrewAI Baseline:</span>
            <select
              aria-label="Select CrewAI Baseline Preset"
              value={presetKey}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-slate-950 text-xs text-white font-semibold px-2.5 py-1 rounded-lg border border-slate-800 outline-none focus:border-[#EB6658] cursor-pointer"
            >
              <option value="tech_research">AI & Tech Research Crew</option>
              <option value="full_stack_app">Full Stack App Development</option>
              <option value="financial_audit">FinTech Risk & Audit Crew</option>
              <option value="devops_deployment">Autonomous DevOps & SRE Crew</option>
              <option value="content_strategy">Multi-Channel Content Synthesis</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSyncFromCrewStudio}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition cursor-pointer"
            title="Pull latest live edits from Crew Studio autosave"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync from Crew Studio</span>
          </button>

          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/30 text-xs font-semibold transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Baseline in Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Toast Banner */}
      {syncBanner && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncBanner}</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80">StateGraph Recompiled</span>
        </div>
      )}

      {/* Architectural Mapping Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 flex items-start justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              CrewAI Baseline Actors
            </span>
            <div className="text-lg font-bold text-white mt-0.5">
              {baselineCrew.agents.length} Actor Nodes • {baselineCrew.tasks.length} Tasks
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Mapped to <code className="text-slate-300">StateGraph.add_node()</code>
            </p>
          </div>
          <Cpu className="w-4 h-4 text-[#EB6658] shrink-0 mt-1" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 flex items-start justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Graph Topology Pattern
            </span>
            <div className="text-lg font-bold text-white mt-0.5">
              {topologyPattern === 'cyclic_reflection'
                ? 'Cyclic Reflection + Tools'
                : topologyPattern === 'supervisor_star'
                ? 'Supervisor Command Star'
                : 'Sequential Interrupt Gated'}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {nodes.length} total nodes • {edges.length} stateful edges
            </p>
          </div>
          <GitFork className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 flex items-start justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              State Channels & Reducers
            </span>
            <div className="text-lg font-bold text-white mt-0.5">
              {channels.length} TypedDict Channels
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              <code className="text-emerald-400">add_messages</code> + <code className="text-emerald-400">message_content_text</code>
            </p>
          </div>
          <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 flex items-start justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              MemorySaver Checkpointer
            </span>
            <div className="text-lg font-bold text-white mt-0.5">
              {checkpoints.length} Snapshots ({threadId})
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {Object.values(interruptNodeIds).filter(Boolean).length} active <code className="text-amber-400">interrupt_before</code> gates
            </p>
          </div>
          <History className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
        </div>
      </div>

      {/* Execution Control Bar & Topology Selector */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left: Topology & Topic Input */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setTopologyPattern('cyclic_reflection')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                topologyPattern === 'cyclic_reflection'
                  ? 'bg-[#EB6658] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cyclic Reflection & ToolNode
            </button>
            <button
              type="button"
              onClick={() => setTopologyPattern('supervisor_star')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                topologyPattern === 'supervisor_star'
                  ? 'bg-[#EB6658] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Supervisor Multi-Actor Star
            </button>
            <button
              type="button"
              onClick={() => setTopologyPattern('sequential_gated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                topologyPattern === 'sequential_gated'
                  ? 'bg-[#EB6658] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sequential Interrupt Pipeline
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <span className="text-[11px] font-mono text-slate-400">Topic:</span>
            <input
              type="text"
              value={inputTopic}
              onChange={(e) => setInputTopic(e.target.value)}
              className="bg-transparent text-xs text-white outline-none w-48 sm:w-64 font-medium"
              placeholder="Enter graph invocation topic..."
            />
          </div>
        </div>

        {/* Right: Super-Step Execution Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRunGraph}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] disabled:opacity-50 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isInterrupted ? 'Approve & Resume Graph' : 'Invoke StateGraph'}</span>
          </button>

          <button
            type="button"
            onClick={handleStepForward}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            title="Execute 1 LangGraph Super-Step and record checkpoint"
          >
            <StepForward className="w-3.5 h-3.5 text-sky-400" />
            <span>Step Super-Step</span>
          </button>

          {isRunning && (
            <button
              type="button"
              onClick={() => setIsRunning(false)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetGraph}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thread</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddActorForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Actor Node</span>
          </button>
        </div>
      </div>

      {/* Optional Add Actor Node Inline Form */}
      {showAddActorForm && (
        <form
          onSubmit={handleAddActorNode}
          className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Add New CrewAI Actor Node to StateGraph
            </span>
            <button
              type="button"
              onClick={() => setShowAddActorForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              type="text"
              required
              placeholder="Actor Name (e.g. Elena Rostova)"
              value={newActorName}
              onChange={(e) => setNewActorName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
            />
            <input
              type="text"
              required
              placeholder="Role (e.g. State Verifier)"
              value={newActorRole}
              onChange={(e) => setNewActorRole(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
            />
            <input
              type="text"
              placeholder="Goal / Task Objective"
              value={newActorGoal}
              onChange={(e) => setNewActorGoal(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
            />
            <select
              aria-label="Actor LLM Model"
              value={newActorModel}
              onChange={(e) => setNewActorModel(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
            >
              <option value="gemini/gemini-3-flash-preview">gemini/gemini-3-flash-preview</option>
              <option value="gemini/gemini-4-argon">gemini/gemini-4-argon</option>
              <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
              <option value="gpt-4o">gpt-4o</option>
            </select>
            <div className="flex items-center gap-2">
              <select
                aria-label="Equipped ToolNode"
                value={newActorTool}
                onChange={(e) => setNewActorTool(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-400"
              >
                <option value="SerperDevTool">SerperDevTool</option>
                <option value="GithubSearchTool">GithubSearchTool</option>
                <option value="FileWriteTool">FileWriteTool</option>
                <option value="ScrapeWebsiteTool">ScrapeWebsiteTool</option>
                <option value="">No ToolNode</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Human-in-the-Loop Interrupt Banner when Paused at Breakpoint */}
      {isInterrupted && currentCheckpoint && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                LangGraph Execution Paused at Breakpoint: <code className="font-mono">{currentCheckpoint.nodeId}</code>
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Checkpointer <code className="font-mono text-amber-300">{currentCheckpoint.checkpointId}</code> is waiting for <code className="font-mono">Command(resume=...)</code> or human state override before proceeding.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={humanFeedbackInput}
              onChange={(e) => setHumanFeedbackInput(e.target.value)}
              className="bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white w-64 outline-none"
              placeholder="Enter human review feedback..."
            />
            <button
              type="button"
              onClick={handleStepForward}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              Approve & Step Past Breakpoint
            </button>
          </div>
        </div>
      )}

      {/* Main Split Workspace: Left Interactive Graph Canvas (7 cols) + Right Management Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive StateGraph Topology Canvas */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white">
                Compiled <code className="text-[#EB6658] font-mono">StateGraph(CrewGraphState)</code> Topology
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block" /> Direct Edge
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-sky-400 inline-block" /> Conditional Edge
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Cyclic Loop
              </span>
            </div>
          </div>

          {/* Interactive Pan, Zoom & Draggable Node Topology Viewport */}
          <div
            ref={canvasViewportRef}
            onMouseDown={handleCanvasMouseDown}
            onDoubleClick={handleFitView}
            style={{
              backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
              backgroundSize: `${Math.max(12, Math.round(24 * zoomLevel))}px ${Math.max(
                12,
                Math.round(24 * zoomLevel)
              )}px`,
              backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
            }}
            className={`relative overflow-hidden bg-[#080B12] h-[470px] select-none ${
              isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Floating Interactive Viewport HUD Controls (Top-Right) */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-xl"
            >
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out (or scroll wheel down)"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom100}
                title="Click to reset zoom to 100%"
                className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-slate-200 hover:text-white cursor-pointer min-w-[52px] text-center"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In (or scroll wheel up)"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-slate-800 mx-0.5" />
              <button
                type="button"
                onClick={handleFitView}
                title="Smoothly Zoom & Center to Fit All Topology Nodes (or double-click canvas)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EB6658]/15 hover:bg-[#EB6658]/25 text-[#EB6658] border border-[#EB6658]/30 text-[11px] font-semibold transition cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Zoom to Fit</span>
              </button>
              <button
                type="button"
                onClick={handleCenterOnActiveNode}
                title="Center viewport on active/selected node"
                className="p-1.5 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowMinimap((v) => !v)}
                title={showMinimap ? 'Hide Topology Minimap' : 'Show Topology Minimap'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  showMinimap
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
              </button>
              {Object.keys(nodePositionOverrides).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setNodePositionOverrides({});
                    window.setTimeout(() => handleFitView(), 10);
                  }}
                  title="Reset dragged nodes to default layout"
                  className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-semibold transition cursor-pointer"
                >
                  Reset Layout
                </button>
              )}
            </div>

            {/* Interactive Mouse Hint Pill (Bottom-Left) */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400 pointer-events-none"
            >
              <Move className="w-3 h-3 text-[#EB6658]" />
              <span>Drag canvas to pan • Scroll wheel to zoom • Drag any node to reposition</span>
            </div>

            {/* Interactive Topology Minimap (Bottom-Right) */}
            {showMinimap ? (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleFitView();
                }}
                className="absolute bottom-3 right-3 z-20 w-52 rounded-xl bg-slate-950/95 backdrop-blur-md border border-slate-700/90 shadow-2xl overflow-hidden"
              >
                <div className="px-2.5 py-1.5 border-b border-slate-800/90 flex items-center justify-between bg-slate-900/90">
                  <div className="flex items-center gap-1.5">
                    <Map className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200">
                      Minimap
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      ({positionedNodes.length}n • {edges.length}e)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleFitView}
                      title="Zoom to Fit"
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMinimap(false)}
                      title="Collapse Minimap"
                      className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Minimize2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Minimap Interactive World Surface */}
                <svg
                  ref={minimapSvgRef}
                  viewBox="0 0 1400 560"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    setIsDraggingMinimap(true);
                    panCameraToMinimapEvent(e.clientX, e.clientY, true);
                  }}
                  className="w-full h-[84px] bg-[#060911] cursor-crosshair block"
                >
                  {/* Subtle world grid lines */}
                  <line x1="0" y1="280" x2="1400" y2="280" stroke="#1e293b" strokeWidth="4" strokeDasharray="16 16" />
                  <line x1="700" y1="0" x2="700" y2="560" stroke="#1e293b" strokeWidth="4" strokeDasharray="16 16" />

                  {/* Minimap Edges */}
                  {edges.map((edge) => {
                    const s = positionedNodes.find((n) => n.id === edge.source);
                    const t = positionedNodes.find((n) => n.id === edge.target);
                    if (!s || !t) return null;
                    const stroke =
                      edge.kind === 'cyclic'
                        ? '#f59e0b'
                        : edge.kind === 'conditional'
                        ? '#38bdf8'
                        : '#475569';
                    return (
                      <line
                        key={`mm-${edge.id}`}
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={stroke}
                        strokeWidth={10}
                        opacity={0.75}
                      />
                    );
                  })}

                  {/* Minimap Nodes */}
                  {positionedNodes.map((n) => {
                    const isCurrent = currentCheckpoint?.nodeId === n.id;
                    const isSel = selectedNode?.id === n.id;
                    const hasExec = checkpoints
                      .slice(0, activeCheckpointIdx + 1)
                      .some((c) => c.nodeId === n.id);

                    const fill = isCurrent
                      ? '#EB6658'
                      : isSel
                      ? '#38bdf8'
                      : hasExec
                      ? '#10b981'
                      : n.interruptBefore
                      ? '#f59e0b'
                      : '#475569';

                    return (
                      <g
                        key={`mm-node-${n.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(n.id);
                          triggerSmoothTransition();
                          const vw = canvasViewportRef.current?.clientWidth || viewportDims.width;
                          const vh = canvasViewportRef.current?.clientHeight || viewportDims.height;
                          setPanOffset({
                            x: Math.round(vw / 2 - n.x * zoomLevel),
                            y: Math.round(vh / 2 - n.y * zoomLevel)
                          });
                        }}
                        className="cursor-pointer"
                      >
                        <rect
                          x={n.x - 56}
                          y={n.y - 26}
                          width={112}
                          height={52}
                          rx={14}
                          fill={fill}
                          stroke="#0f172a"
                          strokeWidth={8}
                        />
                      </g>
                    );
                  })}

                  {/* Live Viewport Camera Frame */}
                  <rect
                    x={Math.round(-panOffset.x / zoomLevel)}
                    y={Math.round(-panOffset.y / zoomLevel)}
                    width={Math.round(viewportDims.width / zoomLevel)}
                    height={Math.round(viewportDims.height / zoomLevel)}
                    rx={12}
                    fill="rgba(235, 102, 88, 0.12)"
                    stroke="#EB6658"
                    strokeWidth={14}
                    className="pointer-events-none"
                  />
                </svg>
              </div>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setShowMinimap(true)}
                className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-[10px] font-mono text-slate-300 hover:text-white shadow-xl cursor-pointer"
              >
                <Map className="w-3 h-3 text-emerald-400" />
                <span>Show Minimap</span>
              </button>
            )}

            {/* Transformed Pan/Zoom World Layer */}
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: '0 0',
                width: '1400px',
                height: '560px',
                transition: isSmoothTransitioning
                  ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none'
              }}
              className="relative"
            >
              {/* SVG Edges Layer */}
              <svg
                className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                viewBox="0 0 1400 560"
              >
                <defs>
                  <marker
                    id="arrow-normal"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                  </marker>
                  <marker
                    id="arrow-conditional"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker
                    id="arrow-cyclic"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                </defs>

                {edges.map((edge) => {
                  const s = positionedNodes.find((n) => n.id === edge.source);
                  const t = positionedNodes.find((n) => n.id === edge.target);
                  if (!s || !t) return null;

                  // Determine path geometry dynamically from positionedNodes
                  let pathD = '';
                  let labelX = (s.x + t.x) / 2;
                  let labelY = (s.y + t.y) / 2 - 10;

                  if (edge.id === 'e-router-cycle') {
                    const midX = (s.x + t.x) / 2;
                    const topArcY = Math.min(s.y, t.y) - 135;
                    pathD = `M ${s.x} ${s.y - 36} C ${midX + 60} ${topArcY}, ${
                      midX - 60
                    } ${topArcY}, ${t.x} ${t.y - 36}`;
                    labelX = midX;
                    labelY = topArcY + 26;
                  } else if (Math.abs(s.x - t.x) < 35) {
                    const offset = edge.kind === 'cyclic' ? 22 : -22;
                    pathD = `M ${s.x + offset} ${s.y + (t.y > s.y ? 34 : -34)} L ${t.x + offset} ${
                      t.y + (t.y > s.y ? -34 : 34)
                    }`;
                    labelX = (s.x + t.x) / 2 + (edge.kind === 'cyclic' ? 56 : -56);
                    labelY = (s.y + t.y) / 2;
                  } else if (topologyPattern === 'supervisor_star' && edge.kind === 'cyclic') {
                    const midX = (s.x + t.x) / 2;
                    pathD = `M ${s.x - 65} ${s.y + 12} Q ${midX} ${s.y + 42} ${t.x + 65} ${t.y + 12}`;
                    labelY = (s.y + t.y) / 2 + 24;
                  } else {
                    const sx = s.x + (t.x >= s.x ? 68 : -68);
                    const sy = s.y;
                    const tx = t.x + (t.x >= s.x ? -68 : 68);
                    const ty = t.y;
                    const cX = (sx + tx) / 2;
                    pathD = `M ${sx} ${sy} C ${cX} ${sy}, ${cX} ${ty}, ${tx} ${ty}`;
                  }

                  const strokeColor =
                    edge.kind === 'cyclic'
                      ? '#f59e0b'
                      : edge.kind === 'conditional'
                      ? '#38bdf8'
                      : '#64748b';
                  const marker =
                    edge.kind === 'cyclic'
                      ? 'url(#arrow-cyclic)'
                      : edge.kind === 'conditional'
                      ? 'url(#arrow-conditional)'
                      : 'url(#arrow-normal)';

                  const isEdgeActive =
                    hoveredEdgeId === edge.id ||
                    Boolean(
                      currentCheckpoint &&
                        (currentCheckpoint.nodeId === edge.source ||
                          currentCheckpoint.nodeId === edge.target)
                    );

                  return (
                    <g
                      key={edge.id}
                      className="pointer-events-auto cursor-pointer"
                      onMouseEnter={() => setHoveredEdgeId(edge.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(edge.target);
                        setRightPanelTab('inspector');
                      }}
                    >
                      <path
                        d={pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isEdgeActive ? 2.8 : 1.75}
                        strokeDasharray={edge.kind === 'normal' ? undefined : '5 4'}
                        markerEnd={marker}
                        opacity={isEdgeActive ? 1 : 0.72}
                      />
                      {edge.conditionLabel && (
                        <g transform={`translate(${labelX}, ${labelY})`}>
                          <rect
                            x={-56}
                            y={-9}
                            width={112}
                            height={18}
                            rx={4}
                            fill="#0f172a"
                            stroke={strokeColor}
                            strokeWidth={isEdgeActive ? 1.4 : 0.8}
                          />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {edge.conditionLabel.slice(0, 20)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Interactive Draggable HTML Nodes Layer */}
              {positionedNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isCurrentStep = currentCheckpoint?.nodeId === node.id;
                const isDraggingThis = draggingNodeId === node.id;
                const hasExecuted = checkpoints
                  .slice(0, activeCheckpointIdx + 1)
                  .some((c) => c.nodeId === node.id);

                const borderStyle = isCurrentStep
                  ? 'border-[#EB6658] ring-2 ring-[#EB6658]/40 bg-slate-900'
                  : isSelected
                  ? 'border-sky-400 ring-2 ring-sky-400/30 bg-slate-900'
                  : hasExecuted
                  ? 'border-emerald-500/60 bg-slate-900/95'
                  : 'border-slate-700/90 bg-slate-900/90 hover:border-slate-500';

                return (
                  <button
                    key={node.id}
                    type="button"
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!pointerStartRef.current.moved) {
                        setSelectedNodeId(node.id);
                        setRightPanelTab('inspector');
                      }
                    }}
                    style={{
                      left: `${node.x - 68}px`,
                      top: `${node.y - 34}px`,
                      width: '136px'
                    }}
                    className={`absolute rounded-xl border p-2.5 text-left transition-shadow shadow-md ${
                      isDraggingThis ? 'cursor-grabbing ring-2 ring-sky-400 z-30 shadow-2xl' : 'cursor-grab'
                    } ${borderStyle}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {node.kind === 'actor'
                          ? 'Crew Actor'
                          : node.kind === 'tool_node'
                          ? 'ToolNode'
                          : node.kind === 'supervisor'
                          ? 'Supervisor'
                          : node.kind === 'router'
                          ? 'Cond Router'
                          : node.kind === 'human_gate'
                          ? 'Interrupt'
                          : node.kind}
                      </span>
                      <div className="flex items-center gap-1">
                        {node.interruptBefore && (
                          <span
                            title="interrupt_before breakpoint active"
                            className="w-2 h-2 rounded-full bg-amber-400"
                          />
                        )}
                        {isCurrentStep && (
                          <span className="w-2 h-2 rounded-full bg-[#EB6658] animate-ping" />
                        )}
                        {!isCurrentStep && hasExecuted && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-1">{node.label}</div>
                    <div className="text-[10px] text-slate-400 truncate font-mono">{node.sublabel}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Bar of Canvas: Super-Step Progress Strip */}
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">Active Super-Step:</span>
              {currentCheckpoint ? (
                <span className="font-mono text-white font-semibold">
                  Step #{currentCheckpoint.step} • {currentCheckpoint.nodeLabel} (
                  <span className="text-emerald-400">{currentCheckpoint.deltaSummary}</span>)
                </span>
              ) : (
                <span className="text-slate-500 font-mono">
                  Idle — Click "Invoke StateGraph" or "Step Super-Step" to start
                </span>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={simulateCycleOnce}
                onChange={(e) => setSimulateCycleOnce(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-[#EB6658]"
              />
              <span>Simulate cyclic reflection loop on first pass</span>
            </label>
          </div>
        </div>

        {/* Right: Multi-Tab State, Node Inspector, Checkpoints & Code Manager (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col">
          {/* Sub-Navigation Tabs */}
          <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRightPanelTab('inspector')}
              className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                rightPanelTab === 'inspector'
                  ? 'border-[#EB6658] text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Node</span>
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('state')}
              className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                rightPanelTab === 'state'
                  ? 'border-[#EB6658] text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>State ({channels.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('checkpoints')}
              className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                rightPanelTab === 'checkpoints'
                  ? 'border-[#EB6658] text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({checkpoints.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setRightPanelTab('code')}
              className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                rightPanelTab === 'code'
                  ? 'border-[#EB6658] text-white bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SDK Code</span>
            </button>
          </div>

          {/* Tab 1: Node & CrewAI Actor Inspector */}
          {rightPanelTab === 'inspector' && selectedNode && (
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30 font-semibold">
                    {selectedNode.kind.toUpperCase()} NODE
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{selectedNode.label}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedNode.sublabel}</p>
                </div>
                {selectedNode.kind === 'actor' &&
                  selectedNode.agentId &&
                  baselineCrew.agents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveActorNode(selectedNode.agentId!)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs flex items-center gap-1 cursor-pointer"
                      title="Remove actor node from graph and baseline CrewConfig"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                {selectedNode.description}
              </p>

              {/* LangGraph Node Controls: Breakpoint & Retry Policy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Interrupt Before</div>
                    <div className="text-[11px] text-slate-400">Pause for human review</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleNodeInterrupt(selectedNode.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      selectedNode.interruptBefore
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedNode.interruptBefore ? 'ENABLED' : 'OFF'}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">RetryPolicy Attempts</div>
                    <div className="text-[11px] text-slate-400">Auto-heal node failures</div>
                  </div>
                  <select
                    aria-label="Node RetryPolicy max attempts"
                    value={nodeRetries[selectedNode.id] || selectedNode.maxRetries}
                    onChange={(e) =>
                      setNodeRetries((prev) => ({
                        ...prev,
                        [selectedNode.id]: Number(e.target.value)
                      }))
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  >
                    <option value={1}>1 attempt</option>
                    <option value={2}>2 attempts</option>
                    <option value={3}>3 attempts</option>
                    <option value={5}>5 attempts</option>
                  </select>
                </div>
              </div>

              {/* Underlying CrewAI Agent & Task Baseline Details */}
              {selectedAgent && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Baseline CrewAI Agent & Task Binding
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Agent Role:</span>
                      <span className="text-white font-semibold">{selectedAgent.role}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">LLM Model:</span>
                      <span className="font-mono text-emerald-400">{selectedAgent.model}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Agent Goal:</span>
                      <p className="text-slate-300 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                        {selectedAgent.goal}
                      </p>
                    </div>
                    {selectedTask && (
                      <div>
                        <span className="text-slate-400 block mb-1">
                          Bound Task (<code className="text-[#EB6658]">{selectedTask.name}</code>):
                        </span>
                        <p className="text-slate-300 bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
                          {selectedTask.description}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">Equipped ToolNode:</span>
                      <span className="font-mono text-sky-400">
                        {selectedAgent.tools.length > 0 ? selectedAgent.tools.join(', ') : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* State Channels Mutated by this Node */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  State Channels Written (<code className="font-mono">Command.update</code>)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.stateWrites.length > 0 ? (
                    selectedNode.stateWrites.map((ch) => (
                      <span
                        key={ch}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400"
                      >
                        {ch}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">Read-only terminal sink node</span>
                  )}
                </div>
              </div>

              {onOpenJules && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenJules({
                        targetType: 'crew',
                        targetName: `${baselineCrew.name} (${selectedNode.label})`,
                        suggestedPrompt: `Verify LangGraph StateGraph node "${selectedNode.id}" and run pytest suite on ${selectedRepo}@${selectedBranch}.`
                      })
                    }
                    className="w-full py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Verify Node in Google Jules Cloud VM</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Shared State Schema & Live Channel Values */}
          {rightPanelTab === 'state' && (
            <div className="p-5 space-y-4 max-h-[520px] overflow-y-auto">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Live <code className="text-[#EB6658] font-mono">CrewGraphState</code> Channel Values
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect current state reducer values or inject a state patch to fork the active thread.
                </p>
              </div>

              {/* Live JSON State Snapshot */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-48">
                <pre>{JSON.stringify(activeChannelValues, null, 2)}</pre>
              </div>

              {/* Live State Override / Patch (graph.update_state) */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-white flex items-center justify-between">
                  <span>Mutate / Fork State (<code className="text-sky-400 font-mono">graph.update_state</code>)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={statePatchJson}
                    onChange={(e) => setStatePatchJson(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-[#EB6658]"
                    placeholder='{"quality_score": 0.99}'
                  />
                  <button
                    type="button"
                    onClick={handleApplyStatePatch}
                    className="px-3 py-1.5 rounded-lg bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition cursor-pointer"
                  >
                    Patch & Fork
                  </button>
                </div>
                {statePatchError && <p className="text-[11px] text-red-400">{statePatchError}</p>}
              </div>

              {/* Schema Channels & Reducers List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Configured Channels & Reducers
                </div>
                {channels.map((ch) => (
                  <div
                    key={ch.key}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{ch.key}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {ch.reducer}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ch.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Custom Channel Form */}
              <form onSubmit={handleAddChannel} className="pt-2 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="New channel key..."
                  value={newChannelKey}
                  onChange={(e) => setNewChannelKey(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                />
                <select
                  aria-label="New channel reducer"
                  value={newChannelReducer}
                  onChange={(e) => setNewChannelReducer(e.target.value as StateChannelSpec['reducer'])}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono"
                >
                  <option value="last_value">last_value</option>
                  <option value="merge_dict">merge_dict</option>
                  <option value="operator.add">operator.add</option>
                  <option value="add_messages">add_messages</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  + Channel
                </button>
              </form>
            </div>
          )}

          {/* Tab 3: Time-Travel Checkpointer History */}
          {rightPanelTab === 'checkpoints' && (
            <div className="p-5 space-y-3 max-h-[520px] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    MemorySaver Time-Travel Checkpoints
                  </h3>
                  <p className="text-xs text-slate-400">
                    Click any historical super-step to rewind and fork graph state.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{threadId}</span>
              </div>

              {checkpoints.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                  <History className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No checkpoints recorded yet. Click <strong>Invoke StateGraph</strong> or{' '}
                    <strong>Step Super-Step</strong> above to execute the graph.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checkpoints.map((ckpt, idx) => {
                    const isCurrent = idx === activeCheckpointIdx;
                    return (
                      <div
                        key={ckpt.checkpointId}
                        className={`p-3 rounded-xl border transition ${
                          isCurrent
                            ? 'bg-slate-900 border-[#EB6658] ring-1 ring-[#EB6658]/30'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-white">
                              Step #{ckpt.step}
                            </span>
                            <span className="text-xs font-bold text-white">{ckpt.nodeLabel}</span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                ckpt.status === 'interrupted'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : ckpt.status === 'forked'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {ckpt.status}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {ckpt.checkpointId}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 font-mono">{ckpt.deltaSummary}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                          <span className="text-slate-400 font-mono">
                            {ckpt.durationMs}ms • {ckpt.tokensUsed} tokens
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTimeTravelToCheckpoint(idx)}
                            className="text-xs font-semibold text-[#EB6658] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <GitFork className="w-3 h-3" />
                            <span>{isCurrent ? 'Active Snapshot' : 'Time-Travel Here'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: LangGraph + CrewAI Hybrid Code Export */}
          {rightPanelTab === 'code' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCodeLang('python')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                      codeLang === 'python'
                        ? 'bg-[#EB6658] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Python (langgraph + crewai)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeLang('typescript')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                      codeLang === 'typescript'
                        ? 'bg-[#EB6658] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    TypeScript (@langchain/langgraph)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-[420px]">
                <pre>{codeLang === 'python' ? generatedPythonCode : generatedTsCode}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
