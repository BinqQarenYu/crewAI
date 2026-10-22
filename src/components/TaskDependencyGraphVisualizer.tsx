import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Link2,
  Unlink,
  Sparkles,
  CheckCircle2,
  Play,
  ShieldCheck,
  UserCheck,
  Layers,
  Shuffle,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { AgentConfig, TaskConfig } from '../types';
import { CardMinMaxButtons } from './CardMinMaxControl';
import { LiveTaskExecutionItem } from './CrewExecutionProgressBar';

export interface TaskDependencyGraphVisualizerProps {
  tasks: TaskConfig[];
  agents: AgentConfig[];
  processMode: 'sequential' | 'hierarchical';
  isRunning: boolean;
  activeTaskId?: string | null;
  taskExecutions?: Record<string, LiveTaskExecutionItem>;
  onUpdateTasks: (updatedTasks: TaskConfig[]) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

interface PositionedTaskNode {
  task: TaskConfig;
  index: number;
  layer: number;
  rowInLayer: number;
  totalInLayer: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DependencyEdge {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  fromIndex: number;
  toIndex: number;
  isExplicitContext: boolean;
  isSequentialDefault: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Checks if adding an edge `fromId -> toId` would create a cycle in the dependency graph.
 */
function wouldCreateCycle(
  tasks: TaskConfig[],
  fromId: string,
  toId: string,
  getDeps: (t: TaskConfig, idx: number) => string[]
): boolean {
  if (fromId === toId) return true;
  const adj = new Map<string, string[]>();
  tasks.forEach((t, idx) => {
    const deps = getDeps(t, idx);
    deps.forEach((depId) => {
      const list = adj.get(depId) || [];
      list.push(t.id);
      adj.set(depId, list);
    });
  });

  // Add proposed edge fromId -> toId
  const existing = adj.get(fromId) || [];
  adj.set(fromId, [...existing, toId]);

  // DFS from `toId` to see if `fromId` is reachable
  const visited = new Set<string>();
  const stack = [toId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === fromId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) stack.push(next);
    }
  }
  return false;
}

export const TaskDependencyGraphVisualizer: React.FC<TaskDependencyGraphVisualizerProps> = ({
  tasks,
  agents,
  processMode,
  isRunning,
  activeTaskId,
  taskExecutions = {},
  onUpdateTasks,
  onNotify
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<'dag' | 'sequence'>('dag');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.id || null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [connectingFromTaskId, setConnectingFromTaskId] = useState<string | null>(null);
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);

  const effectiveSelectedTaskId = useMemo(() => {
    if (selectedTaskId && tasks.some((t) => t.id === selectedTaskId)) {
      return selectedTaskId;
    }
    return tasks[0]?.id || null;
  }, [selectedTaskId, tasks]);

  // Resolve effective dependencies for each task:
  // If `dependsOnTaskIds` is defined on the task, use it; otherwise default to intelligent DAG / sequential chain
  const getEffectiveDependencies = (task: TaskConfig, index: number): string[] => {
    const validTaskIds = new Set(tasks.map((t) => t.id));
    if (Array.isArray(task.dependsOnTaskIds)) {
      return task.dependsOnTaskIds.filter((id) => validTaskIds.has(id) && id !== task.id);
    }
    // Default intelligent dependency mapping when not explicitly customized yet:
    if (index === 0) return [];
    // For an 8-task full-stack workflow, provide a realistic multi-branch DAG out of the box
    if (tasks.length >= 6) {
      if (index === 1 || index === 3) return [tasks[0].id]; // Research (#2) and Database (#4) depend on PRD (#1)
      if (index === 2) return [tasks[0].id, tasks[1].id]; // UI/UX (#3) depends on PRD (#1) + Research (#2)
      if (index === 4) return [tasks[0].id, tasks[3].id]; // Backend (#5) depends on PRD (#1) + Database (#4)
      if (index === 5) return [tasks[2].id, tasks[4].id]; // Frontend (#6) depends on UI/UX (#3) + Backend (#5)
      if (index === tasks.length - 1) {
        // Final Task Controller gate depends on immediately preceding build/devops tasks
        return tasks.slice(Math.max(0, tasks.length - 3), tasks.length - 1).map((t) => t.id);
      }
    }
    return [tasks[index - 1].id];
  };

  // Compute topological layers & node coordinates for SVG + interactive cards
  const { positionedNodes, edges, canvasWidth, canvasHeight, maxLayer } = useMemo(() => {
    const n = tasks.length;
    if (n === 0) {
      return { positionedNodes: [], edges: [], canvasWidth: 900, canvasHeight: 260, maxLayer: 0 };
    }

    const idToIndex = new Map<string, number>();
    tasks.forEach((t, i) => idToIndex.set(t.id, i));

    const depsMap = new Map<string, string[]>();
    tasks.forEach((t, i) => {
      depsMap.set(t.id, getEffectiveDependencies(t, i));
    });

    // Compute layer per node
    const layers = new Map<string, number>();
    const visiting = new Set<string>();

    const computeLayer = (taskId: string): number => {
      if (layers.has(taskId)) return layers.get(taskId)!;
      if (visiting.has(taskId)) return 0;
      visiting.add(taskId);
      const deps = depsMap.get(taskId) || [];
      let dLayer = 0;
      for (const depId of deps) {
        if (idToIndex.has(depId)) {
          dLayer = Math.max(dLayer, computeLayer(depId) + 1);
        }
      }
      visiting.delete(taskId);
      layers.set(taskId, dLayer);
      return dLayer;
    };

    tasks.forEach((t, idx) => {
      if (layoutMode === 'sequence') {
        layers.set(t.id, idx);
      } else {
        computeLayer(t.id);
      }
    });

    const nodeW = 216;
    const nodeH = 112;

    if (layoutMode === 'sequence') {
      // Multi-row serpentine timeline (up to 4 nodes per row)
      const cols = Math.min(4, Math.max(2, n));
      const rows = Math.ceil(n / cols);
      const colGap = 68;
      const rowGap = 64;
      const padX = 32;
      const padY = 36;

      const totalW = Math.max(880, padX * 2 + cols * nodeW + (cols - 1) * colGap);
      const totalH = Math.max(220, padY * 2 + rows * nodeH + (rows - 1) * rowGap);

      const pNodes: PositionedTaskNode[] = tasks.map((task, idx) => {
        const row = Math.floor(idx / cols);
        const colInRow = idx % cols;
        // Left-to-right on even rows, right-to-left on odd rows for clean snake flow
        const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;
        const x = padX + col * (nodeW + colGap);
        const y = padY + row * (nodeH + rowGap);
        return {
          task,
          index: idx,
          layer: idx,
          rowInLayer: 0,
          totalInLayer: 1,
          x,
          y,
          width: nodeW,
          height: nodeH
        };
      });

      const nodeById = new Map<string, PositionedTaskNode>();
      pNodes.forEach((pn) => nodeById.set(pn.task.id, pn));

      const builtEdges: DependencyEdge[] = [];
      pNodes.forEach((targetNode) => {
        const deps = depsMap.get(targetNode.task.id) || [];
        deps.forEach((depId) => {
          const sourceNode = nodeById.get(depId);
          if (!sourceNode) return;
          const sameRow = Math.floor(sourceNode.index / cols) === Math.floor(targetNode.index / cols);
          const goingRight = sourceNode.x <= targetNode.x;
          const x1 = sameRow
            ? goingRight
              ? sourceNode.x + sourceNode.width
              : sourceNode.x
            : sourceNode.x + sourceNode.width / 2;
          const y1 = sameRow
            ? sourceNode.y + sourceNode.height / 2
            : sourceNode.y + sourceNode.height;
          const x2 = sameRow
            ? goingRight
              ? targetNode.x
              : targetNode.x + targetNode.width
            : targetNode.x + targetNode.width / 2;
          const y2 = sameRow ? targetNode.y + targetNode.height / 2 : targetNode.y;

          builtEdges.push({
            id: `${sourceNode.task.id}->${targetNode.task.id}`,
            fromTaskId: sourceNode.task.id,
            toTaskId: targetNode.task.id,
            fromIndex: sourceNode.index,
            toIndex: targetNode.index,
            isExplicitContext: Array.isArray(targetNode.task.dependsOnTaskIds),
            isSequentialDefault: targetNode.index === sourceNode.index + 1,
            x1,
            y1,
            x2,
            y2
          });
        });
      });

      return {
        positionedNodes: pNodes,
        edges: builtEdges,
        canvasWidth: totalW,
        canvasHeight: totalH,
        maxLayer: n - 1
      };
    }

    // Layered DAG Layout (Columns = topological layers, Rows = parallel tasks in that layer)
    const layerBuckets = new Map<number, TaskConfig[]>();
    let highestLayer = 0;
    tasks.forEach((t) => {
      const l = layers.get(t.id) ?? 0;
      highestLayer = Math.max(highestLayer, l);
      const bucket = layerBuckets.get(l) || [];
      bucket.push(t);
      layerBuckets.set(l, bucket);
    });

    let maxNodesInAnyLayer = 1;
    layerBuckets.forEach((bucket) => {
      maxNodesInAnyLayer = Math.max(maxNodesInAnyLayer, bucket.length);
    });

    const colGap = 76;
    const rowGap = 32;
    const padX = 32;
    const padY = 36;

    const numCols = highestLayer + 1;
    const totalW = Math.max(880, padX * 2 + numCols * nodeW + Math.max(0, numCols - 1) * colGap);
    const totalH = Math.max(
      250,
      padY * 2 + maxNodesInAnyLayer * nodeH + Math.max(0, maxNodesInAnyLayer - 1) * rowGap
    );

    const pNodes: PositionedTaskNode[] = [];
    tasks.forEach((task, idx) => {
      const l = layers.get(task.id) ?? 0;
      const bucket = layerBuckets.get(l) || [task];
      const rowInLayer = bucket.findIndex((b) => b.id === task.id);
      const totalInLayer = bucket.length;

      const columnHeight = totalInLayer * nodeH + Math.max(0, totalInLayer - 1) * rowGap;
      const startY = Math.max(padY, (totalH - columnHeight) / 2);

      const x = padX + l * (nodeW + colGap);
      const y = startY + rowInLayer * (nodeH + rowGap);

      pNodes.push({
        task,
        index: idx,
        layer: l,
        rowInLayer,
        totalInLayer,
        x,
        y,
        width: nodeW,
        height: nodeH
      });
    });

    const nodeById = new Map<string, PositionedTaskNode>();
    pNodes.forEach((pn) => nodeById.set(pn.task.id, pn));

    const builtEdges: DependencyEdge[] = [];
    pNodes.forEach((targetNode) => {
      const deps = depsMap.get(targetNode.task.id) || [];
      deps.forEach((depId) => {
        const sourceNode = nodeById.get(depId);
        if (!sourceNode) return;
        const x1 = sourceNode.x + sourceNode.width;
        const y1 = sourceNode.y + sourceNode.height / 2;
        const x2 = targetNode.x;
        const y2 = targetNode.y + targetNode.height / 2;

        builtEdges.push({
          id: `${sourceNode.task.id}->${targetNode.task.id}`,
          fromTaskId: sourceNode.task.id,
          toTaskId: targetNode.task.id,
          fromIndex: sourceNode.index,
          toIndex: targetNode.index,
          isExplicitContext: Array.isArray(targetNode.task.dependsOnTaskIds),
          isSequentialDefault: targetNode.index === sourceNode.index + 1,
          x1,
          y1,
          x2,
          y2
        });
      });
    });

    return {
      positionedNodes: pNodes,
      edges: builtEdges,
      canvasWidth: totalW,
      canvasHeight: totalH,
      maxLayer: highestLayer
    };
  }, [tasks, layoutMode]);

  const showTempWarning = (msg: string) => {
    setInlineWarning(msg);
    setTimeout(() => setInlineWarning(null), 4000);
  };

  // Toggle dependency edge `sourceTaskId -> targetTaskId`
  const handleToggleDependency = (sourceTaskId: string, targetTaskId: string) => {
    if (sourceTaskId === targetTaskId) return;

    const targetIndex = tasks.findIndex((t) => t.id === targetTaskId);
    if (targetIndex === -1) return;
    const targetTask = tasks[targetIndex];
    const currentDeps = getEffectiveDependencies(targetTask, targetIndex);
    const exists = currentDeps.includes(sourceTaskId);

    if (!exists) {
      if (wouldCreateCycle(tasks, sourceTaskId, targetTaskId, getEffectiveDependencies)) {
        const msg = 'Cannot add dependency line: that connection would create a circular execution loop.';
        showTempWarning(msg);
        if (onNotify) onNotify('error', msg);
        return;
      }
    }

    const updatedTasks = tasks.map((t, i) => {
      const effective = getEffectiveDependencies(t, i);
      if (t.id === targetTaskId) {
        const nextDeps = exists
          ? effective.filter((id) => id !== sourceTaskId)
          : [...effective, sourceTaskId];
        return { ...t, dependsOnTaskIds: nextDeps };
      }
      return { ...t, dependsOnTaskIds: effective };
    });

    onUpdateTasks(updatedTasks);
    const srcName = tasks.find((t) => t.id === sourceTaskId)?.name || sourceTaskId;
    const tgtName = targetTask.name;
    if (onNotify) {
      onNotify(
        'success',
        exists
          ? `Removed dependency line: "${srcName}" ↛ "${tgtName}"`
          : `Connected execution dependency: "${srcName}" → "${tgtName}"`
      );
    }
  };

  // Move a task earlier or later in the execution sequence
  const handleMoveTaskInSequence = (taskId: string, direction: 'earlier' | 'later') => {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const swapIdx = direction === 'earlier' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;

    const materialized = tasks.map((t, i) => ({
      ...t,
      dependsOnTaskIds: getEffectiveDependencies(t, i)
    }));

    const copy = [...materialized];
    const temp = copy[idx];
    copy[idx] = copy[swapIdx];
    copy[swapIdx] = temp;

    onUpdateTasks(copy);
    if (onNotify) {
      onNotify('success', `Moved "${temp.name}" to Step #${swapIdx + 1} in the execution sequence.`);
    }
  };

  // Auto-sort the execution sequence topologically based on dependency lines
  const handleTopologicalSortSequence = () => {
    const materialized = tasks.map((t, i) => ({
      ...t,
      dependsOnTaskIds: getEffectiveDependencies(t, i)
    }));

    const visited = new Set<string>();
    const sorted: TaskConfig[] = [];
    const byId = new Map<string, TaskConfig>();
    materialized.forEach((t) => byId.set(t.id, t));

    const visit = (t: TaskConfig) => {
      if (visited.has(t.id)) return;
      visited.add(t.id);
      const deps = t.dependsOnTaskIds || [];
      deps.forEach((depId) => {
        const parent = byId.get(depId);
        if (parent && !visited.has(parent.id)) {
          visit(parent);
        }
      });
      sorted.push(t);
    };

    materialized.forEach((t) => visit(t));
    onUpdateTasks(sorted);
    if (onNotify) {
      onNotify('success', 'Execution sequence topologically sorted to match all task dependency lines!');
    }
  };

  // Apply 1-click preset dependency topologies
  const handleApplyTopologyPreset = (preset: 'linear_chain' | 'fullstack_dag' | 'controller_hub') => {
    if (tasks.length === 0) return;

    const updated = tasks.map((t, idx) => {
      if (preset === 'linear_chain') {
        return {
          ...t,
          dependsOnTaskIds: idx === 0 ? [] : [tasks[idx - 1].id]
        };
      }
      if (preset === 'controller_hub') {
        if (idx === 0) return { ...t, dependsOnTaskIds: [] };
        if (idx === tasks.length - 1) {
          return {
            ...t,
            dependsOnTaskIds: tasks.slice(0, tasks.length - 1).map((prev) => prev.id)
          };
        }
        return {
          ...t,
          dependsOnTaskIds: [tasks[0].id]
        };
      }
      // 'fullstack_dag' (Parallel Fan-Out & Converge)
      if (idx === 0) return { ...t, dependsOnTaskIds: [] };
      if (tasks.length >= 6) {
        if (idx === 1 || idx === 3) return { ...t, dependsOnTaskIds: [tasks[0].id] };
        if (idx === 2) return { ...t, dependsOnTaskIds: [tasks[0].id, tasks[1].id] };
        if (idx === 4) return { ...t, dependsOnTaskIds: [tasks[0].id, tasks[3].id] };
        if (idx === 5) return { ...t, dependsOnTaskIds: [tasks[2].id, tasks[4].id] };
        if (idx === 6 && tasks.length >= 7) return { ...t, dependsOnTaskIds: [tasks[4].id, tasks[5].id] };
        if (idx === tasks.length - 1) {
          return {
            ...t,
            dependsOnTaskIds: tasks
              .slice(Math.max(0, tasks.length - 3), tasks.length - 1)
              .map((prev) => prev.id)
          };
        }
      }
      return {
        ...t,
        dependsOnTaskIds: [tasks[Math.max(0, idx - 1)].id]
      };
    });

    onUpdateTasks(updated);
    if (onNotify) {
      const label =
        preset === 'linear_chain'
          ? 'Sequential Relay Chain (1 → 2 → 3...)'
          : preset === 'fullstack_dag'
          ? 'Parallel Fan-Out & Converge DAG'
          : 'Task Maker → Parallel Specialists → Controller Hub Gate';
      onNotify('success', `Applied "${label}" dependency topology across ${tasks.length} tasks.`);
    }
  };

  const activeFocusId = hoveredTaskId || effectiveSelectedTaskId;
  const selectedTaskIndex = tasks.findIndex((t) => t.id === effectiveSelectedTaskId);
  const selectedTask = selectedTaskIndex >= 0 ? tasks[selectedTaskIndex] : null;
  const selectedTaskDeps =
    selectedTask && selectedTaskIndex >= 0
      ? getEffectiveDependencies(selectedTask, selectedTaskIndex)
      : [];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="p-2 rounded-xl bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
            <GitBranch className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Task Dependency & Agent Execution Sequence Graph
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                · {tasks.length} Nodes · {edges.length} Dependency Lines · {maxLayer + 1} Execution Stages
              </span>
            </div>
            {!isMinimized && (
              <p className="text-xs text-slate-400 mt-0.5">
                Interactive DAG visualization connecting upstream prerequisite tasks to downstream agents. Click any node to configure its execution order, assigned agent, or connect/disconnect dependency lines.
              </p>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Layout Mode Toggle */}
          {!isMinimized && (
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('dag')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  layoutMode === 'dag'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Layered DAG View
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('sequence')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  layoutMode === 'sequence'
                    ? 'bg-[#EB6658] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sequence Snake View
              </button>
            </div>
          )}

          <CardMinMaxButtons
            isMinimized={isMinimized}
            onMinimize={() => setIsMinimized(true)}
            onExpand={() => setIsMinimized(false)}
            title="Task Dependency & Agent Execution Sequence Graph"
          />
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Topology Presets & Quick Sequence Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Topology Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyTopologyPreset('fullstack_dag')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                title="Parallel fan-out from Task Maker into Research/Design & DB/Backend, converging into Frontend, DevOps, and Task Controller QA Gate"
              >
                <Sparkles className="w-3 h-3 text-[#EB6658]" />
                <span>Parallel Fan-Out & Converge DAG</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyTopologyPreset('linear_chain')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                title="Connect tasks in a strict 1 -> 2 -> 3 sequential chain"
              >
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                <span>Linear Relay (1 → 2 → 3)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyTopologyPreset('controller_hub')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                title="Task #1 fans out to all specialists in parallel, all converging into the final Task Controller QA Gate"
              >
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>Hub & Controller Gate</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {connectingFromTaskId ? (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold">
                  <Link2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>
                    Click any target node to connect from "
                    {tasks.find((t) => t.id === connectingFromTaskId)?.name.slice(0, 26)}"
                  </span>
                  <button
                    type="button"
                    onClick={() => setConnectingFromTaskId(null)}
                    className="underline text-amber-200 hover:text-white ml-1 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleTopologicalSortSequence}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  title="Automatically reorder the task list so every prerequisite task executes before its dependent tasks"
                >
                  <Shuffle className="w-3 h-3 text-emerald-400" />
                  <span>Auto-Sort Sequence by Lines</span>
                </button>
              )}
            </div>
          </div>

          {inlineWarning && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{inlineWarning}</span>
            </div>
          )}

          {/* Interactive SVG + Node Canvas */}
          <div className="relative rounded-2xl bg-[#070B14] border border-slate-800/90 overflow-x-auto overflow-y-hidden">
            {/* Subtle Dot Grid Background */}
            <div
              className="relative"
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                backgroundImage:
                  'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            >
              {/* SVG Layer for Connecting Dependency Lines */}
              <svg
                width={canvasWidth}
                height={canvasHeight}
                className="absolute inset-0 pointer-events-none"
              >
                <defs>
                  <marker
                    id="dep-arrow-default"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#64748b" />
                  </marker>
                  <marker
                    id="dep-arrow-upstream"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6.5"
                    markerHeight="6.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f59e0b" />
                  </marker>
                  <marker
                    id="dep-arrow-downstream"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6.5"
                    markerHeight="6.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#EB6658" />
                  </marker>
                  <marker
                    id="dep-arrow-completed"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6.5"
                    markerHeight="6.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
                  </marker>
                </defs>

                {edges.map((edge) => {
                  const isIncomingToFocused = activeFocusId === edge.toTaskId;
                  const isOutgoingFromFocused = activeFocusId === edge.fromTaskId;
                  const fromExec = taskExecutions[edge.fromTaskId];
                  const toExec = taskExecutions[edge.toTaskId];
                  const isLiveActiveEdge =
                    isRunning &&
                    (activeTaskId === edge.toTaskId ||
                      (fromExec?.status === 'completed' &&
                        toExec &&
                        toExec.status !== 'queued' &&
                        toExec.status !== 'completed'));
                  const isCompletedEdge =
                    fromExec?.status === 'completed' && toExec?.status === 'completed';

                  // Calculate smooth cubic Bezier control points
                  const dx = Math.abs(edge.x2 - edge.x1);
                  const dy = Math.abs(edge.y2 - edge.y1);
                  let pathD = '';
                  if (layoutMode === 'sequence' && edge.x1 === edge.x2) {
                    // Vertical row transition in snake layout
                    const midY = (edge.y1 + edge.y2) / 2;
                    pathD = `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`;
                  } else if (edge.x2 >= edge.x1) {
                    const curvature = Math.max(36, dx * 0.48);
                    pathD = `M ${edge.x1} ${edge.y1} C ${edge.x1 + curvature} ${edge.y1}, ${
                      edge.x2 - curvature
                    } ${edge.y2}, ${edge.x2} ${edge.y2}`;
                  } else {
                    // Backward or right-to-left curve
                    const curvature = Math.max(40, dx * 0.45 + dy * 0.25);
                    pathD = `M ${edge.x1} ${edge.y1} C ${edge.x1 - curvature} ${edge.y1}, ${
                      edge.x2 + curvature
                    } ${edge.y2}, ${edge.x2} ${edge.y2}`;
                  }

                  let strokeColor = '#475569';
                  let strokeWidth = 1.75;
                  let markerEnd = 'url(#dep-arrow-default)';
                  let dashArray: string | undefined = undefined;

                  if (isLiveActiveEdge) {
                    strokeColor = '#EB6658';
                    strokeWidth = 2.75;
                    markerEnd = 'url(#dep-arrow-downstream)';
                    dashArray = '6 4';
                  } else if (isIncomingToFocused) {
                    strokeColor = '#f59e0b';
                    strokeWidth = 2.5;
                    markerEnd = 'url(#dep-arrow-upstream)';
                    dashArray = '6 4';
                  } else if (isOutgoingFromFocused) {
                    strokeColor = '#EB6658';
                    strokeWidth = 2.5;
                    markerEnd = 'url(#dep-arrow-downstream)';
                  } else if (isCompletedEdge) {
                    strokeColor = '#10b981';
                    strokeWidth = 2.1;
                    markerEnd = 'url(#dep-arrow-completed)';
                  }

                  const midX = (edge.x1 + edge.x2) / 2;
                  const midY = (edge.y1 + edge.y2) / 2;

                  return (
                    <g key={edge.id}>
                      {/* Subtle Highlight Glow for Active / Focused Dependency Lines */}
                      {(isIncomingToFocused || isOutgoingFromFocused || isLiveActiveEdge) && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth + 4}
                          strokeOpacity={0.18}
                        />
                      )}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashArray}
                        markerEnd={markerEnd}
                        className="transition-all duration-200"
                      />
                      {/* Step-to-Step Handoff Label on Hovered/Selected Edges */}
                      {(isIncomingToFocused || isOutgoingFromFocused) && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-22"
                            y="-9"
                            width="44"
                            height="18"
                            rx="5"
                            fill="#0f172a"
                            stroke={strokeColor}
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize="9"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            #{edge.fromIndex + 1}→#{edge.toIndex + 1}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Positioned Task Nodes */}
              {positionedNodes.map((node) => {
                const { task, index, layer, x, y, width, height } = node;
                const assignedAgent =
                  agents.find((a) => a.id === task.agentId) ||
                  agents[index % Math.max(1, agents.length)];
                const controllerAgent = task.controllerAgentId
                  ? agents.find((a) => a.id === task.controllerAgentId)
                  : agents.find((a) => a.category === 'task_controller');

                const isSelected = effectiveSelectedTaskId === task.id;
                const isConnectingSource = connectingFromTaskId === task.id;
                const deps = getEffectiveDependencies(task, index);
                const isUpstreamOfFocus =
                  activeFocusId !== null &&
                  tasks
                    .findIndex((t) => t.id === activeFocusId) >= 0 &&
                  getEffectiveDependencies(
                    tasks.find((t) => t.id === activeFocusId)!,
                    tasks.findIndex((t) => t.id === activeFocusId)
                  ).includes(task.id);
                const isDownstreamOfFocus =
                  activeFocusId !== null && deps.includes(activeFocusId);

                const liveExec = taskExecutions[task.id];
                const isCurrentlyExecuting =
                  isRunning &&
                  (activeTaskId === task.id ||
                    liveExec?.status === 'reasoning' ||
                    liveExec?.status === 'tool_exec' ||
                    liveExec?.status === 'controller_gate');
                const isCompleted = liveExec?.status === 'completed';

                return (
                  <div
                    key={task.id}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onClick={() => {
                      if (connectingFromTaskId && connectingFromTaskId !== task.id) {
                        handleToggleDependency(connectingFromTaskId, task.id);
                        setConnectingFromTaskId(null);
                        setSelectedTaskId(task.id);
                      } else {
                        setSelectedTaskId(task.id);
                      }
                    }}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${width}px`,
                      height: `${height}px`
                    }}
                    className={`absolute rounded-xl p-2.5 flex flex-col justify-between cursor-pointer select-none transition-all duration-150 border ${
                      isConnectingSource
                        ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                        : isCurrentlyExecuting
                        ? 'bg-slate-900 border-[#EB6658] ring-2 ring-[#EB6658]/50 shadow-xl shadow-[#EB6658]/20'
                        : isSelected
                        ? 'bg-slate-900 border-[#EB6658] ring-1 ring-[#EB6658]/40 shadow-lg'
                        : isUpstreamOfFocus
                        ? 'bg-slate-900/95 border-amber-400/70'
                        : isDownstreamOfFocus
                        ? 'bg-slate-900/95 border-[#EB6658]/70'
                        : isCompleted
                        ? 'bg-slate-900/85 border-emerald-500/40'
                        : 'bg-slate-900/85 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Left Input Dependency Port */}
                    <span
                      title={`Prerequisite Input Port (${deps.length} upstream dependencies)`}
                      className={`w-2.5 h-2.5 rounded-full border absolute -left-1.5 top-1/2 -translate-y-1/2 ${
                        deps.length > 0
                          ? 'bg-amber-400 border-slate-950'
                          : 'bg-slate-700 border-slate-950'
                      }`}
                    />

                    {/* Right Output Handoff Port (Click to start drawing a dependency line) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectingFromTaskId((prev) => (prev === task.id ? null : task.id));
                      }}
                      title="Click to connect or disconnect this task's output to another task"
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 transition cursor-pointer ${
                        isConnectingSource
                          ? 'bg-amber-400 text-slate-950 border-white scale-125'
                          : 'bg-[#EB6658] hover:bg-amber-400 text-white border-slate-950'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    </button>

                    {/* Top Row: Step Sequence Number + Stage Layer + Connect Action */}
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-[#EB6658]/20 text-[#EB6658] font-bold">
                          #{index + 1}
                        </span>
                        <span className="text-slate-400">Stage {layer + 1}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCurrentlyExecuting && (
                          <RotateCcw className="w-3 h-3 text-[#EB6658] animate-spin" />
                        )}
                        {!isCurrentlyExecuting && isCompleted && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnectingFromTaskId((prev) => (prev === task.id ? null : task.id));
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition cursor-pointer ${
                            isConnectingSource
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                          title="Connect this task to a downstream dependent task"
                        >
                          {isConnectingSource ? 'Linking...' : '+ Link'}
                        </button>
                      </div>
                    </div>

                    {/* Middle: Task Title */}
                    <div className="text-[11px] font-bold text-white leading-tight line-clamp-2 my-0.5">
                      {task.name.replace(/^\d+\.\s*/, '')}
                    </div>

                    {/* Bottom Row: Assigned Executor Agent & Upstream Prerequisite Summary */}
                    <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
                      <span
                        className="text-emerald-400 font-medium truncate max-w-[125px]"
                        title={`Executor Agent: ${assignedAgent?.name || 'Unassigned'}`}
                      >
                        {assignedAgent?.name.replace(/\s*\(.*\)/, '') || 'Agent'}
                      </span>
                      <span className="font-mono text-slate-400 shrink-0">
                        {deps.length === 0
                          ? 'Entry'
                          : `Deps: ${deps
                              .map((dId) => `#${tasks.findIndex((t) => t.id === dId) + 1}`)
                              .join(',')}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend & Selected Node Sequence / Dependency Editor */}
          {selectedTask && (
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-[#EB6658] text-white font-mono font-bold text-[11px]">
                    Step #{selectedTaskIndex + 1} of {tasks.length}
                  </span>
                  <span className="font-bold text-white text-xs sm:text-sm">
                    {selectedTask.name}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-[11px] text-slate-400">
                    Configure execution order, assigned agent, and prerequisite dependency lines
                  </span>
                </div>

                {/* Sequence Order Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={selectedTaskIndex <= 0}
                    onClick={() => handleMoveTaskInSequence(selectedTask.id, 'earlier')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Move task earlier in execution sequence"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Move Earlier</span>
                  </button>
                  <button
                    type="button"
                    disabled={selectedTaskIndex >= tasks.length - 1}
                    onClick={() => handleMoveTaskInSequence(selectedTask.id, 'later')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Move task later in execution sequence"
                  >
                    <span>Move Later</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Agent Assignment & Upstream Prerequisites Toggle Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-800/80 items-start">
                {/* Executor & Controller Agent Selectors (5 cols) */}
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-emerald-400 mb-1">
                      Assigned Executor Agent
                    </label>
                    <select
                      aria-label="Assigned Executor Agent for Selected Task"
                      value={selectedTask.agentId}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateTasks(
                          tasks.map((t) => (t.id === selectedTask.id ? { ...t, agentId: val } : t))
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#EB6658]"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.role.slice(0, 26)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-purple-300 mb-1">
                      Task Controller Gatekeeper
                    </label>
                    <select
                      aria-label="Assigned Task Controller Gatekeeper for Selected Task"
                      value={
                        selectedTask.controllerAgentId ||
                        agents.find((a) => a.category === 'task_controller')?.id ||
                        agents[0]?.id ||
                        ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateTasks(
                          tasks.map((t) =>
                            t.id === selectedTask.id ? { ...t, controllerAgentId: val } : t
                          )
                        );
                      }}
                      className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs text-purple-200 outline-none focus:border-purple-400"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Upstream Prerequisite Task Lines Selector (7 cols) */}
                <div className="lg:col-span-7 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="uppercase text-amber-400">
                      Upstream Prerequisite Tasks (Click to Toggle Connecting Lines → Step #{selectedTaskIndex + 1})
                    </span>
                    <span className="text-slate-400">
                      {selectedTaskDeps.length} connected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tasks.map((candidate, cIdx) => {
                      if (candidate.id === selectedTask.id) return null;
                      const isConnected = selectedTaskDeps.includes(candidate.id);
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => handleToggleDependency(candidate.id, selectedTask.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border transition cursor-pointer ${
                            isConnected
                              ? 'bg-amber-500/15 text-amber-200 border-amber-400/50 font-semibold'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
                          }`}
                          title={
                            isConnected
                              ? `Disconnect line from Step #${cIdx + 1} (${candidate.name})`
                              : `Connect prerequisite line from Step #${cIdx + 1} (${candidate.name})`
                          }
                        >
                          {isConnected ? (
                            <Link2 className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Unlink className="w-3 h-3 text-slate-500" />
                          )}
                          <span>
                            #{cIdx + 1} {candidate.name.replace(/^\d+\.\s*/, '').slice(0, 22)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
