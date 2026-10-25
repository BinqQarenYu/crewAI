import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Network,
  GitMerge,
  GitFork,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { CrewConfig, DocTab } from '../types';
import { PRESET_CREWS } from './CrewStudio';
import {
  WORKFLOW_AUTOSAVE_KEY,
  GRAPHIFY_BASE_MODULES,
  buildAlignedFlowStepsFromCrew,
  broadcastWorkflowSync
} from '../utils/unifiedGraphEngine';
import { TargetRepoSelector } from './TargetRepoSelector';

interface UnifiedGraphAlignmentBarProps {
  currentTab: DocTab;
  onTabChange: (tab: DocTab) => void;
  selectedRepo: string;
  selectedBranch: string;
  onRepoChange?: (repo: string) => void;
  onBranchChange?: (branch: string) => void;
  flowSubView?: 'flow_dag' | 'graphify_repo';
  onSelectFlowSubView?: (view: 'flow_dag' | 'graphify_repo') => void;
}

export const UnifiedGraphAlignmentBar: React.FC<UnifiedGraphAlignmentBarProps> = ({
  currentTab,
  onTabChange,
  selectedRepo,
  selectedBranch,
  onRepoChange,
  onBranchChange,
  flowSubView = 'graphify_repo',
  onSelectFlowSubView
}) => {
  const loadActiveWorkflow = (): { activePreset: string; crew: CrewConfig; runInput: string } => {
    try {
      const raw = localStorage.getItem(WORKFLOW_AUTOSAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.crew?.agents?.length > 0) {
          return {
            activePreset: parsed.activePreset || 'full_stack_app',
            crew: parsed.crew,
            runInput: parsed.runInput || 'Build an Enterprise SaaS Multi-Agent Control Plane'
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      activePreset: 'full_stack_app',
      crew: PRESET_CREWS.full_stack_app,
      runInput: 'Build an Enterprise SaaS Multi-Agent Control Plane'
    };
  };

  const [workflow, setWorkflow] = useState(loadActiveWorkflow);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.crew) {
        setWorkflow({
          activePreset: detail.activePreset || 'full_stack_app',
          crew: detail.crew,
          runInput: detail.runInput || 'Build an Enterprise SaaS Multi-Agent Control Plane'
        });
      } else {
        setWorkflow(loadActiveWorkflow());
      }
    };
    window.addEventListener('crewai:workflow-synced', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('crewai:workflow-synced', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const metrics = useMemo(() => {
    const crew = workflow.crew;
    const agentsCount = crew.agents?.length || 0;
    const tasksCount = crew.tasks?.length || 0;
    const explicitEdgesCount = (crew.tasks || []).reduce(
      (sum, t, idx) =>
        sum +
        (t.dependsOnTaskIds && t.dependsOnTaskIds.length > 0
          ? t.dependsOnTaskIds.length
          : idx > 0
          ? 1
          : 0),
      0
    );
    const controllerGatesCount = (crew.tasks || []).filter((t) => Boolean(t.controllerAgentId)).length;
    const toolNodesCount = (crew.agents || []).filter((a) => a.tools && a.tools.length > 0).length;
    const langGraphNodesCount = 1 + agentsCount + toolNodesCount + 2 + 1; // __start__ + actors + tool_nodes + router/human_gate + __end__
    const alignedFlowSteps = buildAlignedFlowStepsFromCrew(crew, selectedRepo);
    return {
      agentsCount,
      tasksCount,
      explicitEdgesCount,
      controllerGatesCount,
      langGraphNodesCount,
      flowStepsCount: alignedFlowSteps.length,
      graphifyModulesCount: GRAPHIFY_BASE_MODULES.length
    };
  }, [workflow.crew, selectedRepo]);

  const handlePresetChange = (presetKey: string) => {
    const nextCrew = PRESET_CREWS[presetKey];
    if (!nextCrew) return;
    setWorkflow((prev) => ({
      ...prev,
      activePreset: presetKey,
      crew: nextCrew
    }));
    broadcastWorkflowSync({
      activePreset: presetKey,
      crew: nextCrew,
      selectedAgentId: nextCrew.agents[0]?.id || '',
      runInput: workflow.runInput
    });
  };

  if (currentTab === 'docs' || currentTab === 'tools' || currentTab === 'traces') {
    return null;
  }

  return (
    <div className="border-b border-slate-800/80 bg-[#080C15]/95 px-4 sm:px-8 py-2.5">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Unified Architecture Identity & Preset Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-white whitespace-nowrap">
              Unified 4-Graph Architecture
            </span>
          </div>

          {onRepoChange ? (
            <TargetRepoSelector
              selectedRepo={selectedRepo}
              selectedBranch={selectedBranch}
              onSelectRepo={onRepoChange}
              onSelectBranch={onBranchChange}
              variant="inline"
              label="Target Repository"
            />
          ) : (
            <span className="text-slate-400 font-mono text-[11px] tabular-nums whitespace-nowrap">
              {selectedRepo}@{selectedBranch}
            </span>
          )}

          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Sliders className="w-3.5 h-3.5 text-[#EB6658] shrink-0" />
            <span className="text-slate-400 text-[11px] whitespace-nowrap">Active Blueprint:</span>
            <select
              aria-label="Select Unified Graph Crew Preset"
              value={PRESET_CREWS[workflow.activePreset] ? workflow.activePreset : 'full_stack_app'}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs outline-none cursor-pointer pr-1"
            >
              <option value="full_stack_app" className="bg-slate-950 text-white">
                Full-Stack App Development (8 Agents · 8 Tasks)
              </option>
              <option value="tech_research" className="bg-slate-950 text-white">
                Deep Tech Research Crew (2 Agents · 2 Tasks)
              </option>
              <option value="code_audit" className="bg-slate-950 text-white">
                Security & Code Audit Crew (2 Agents · 2 Tasks)
              </option>
              <option value="growth_marketing" className="bg-slate-950 text-white">
                Growth & Launch Strategy (2 Agents · 2 Tasks)
              </option>
            </select>
          </div>
        </div>

        {/* Right: 4 Synchronized Graph Lenses Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 xl:pb-0">
          {/* Lens 1: Crew Studio & Task Dependency DAG */}
          <button
            type="button"
            onClick={() => onTabChange('studio')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 border ${
              currentTab === 'studio'
                ? 'bg-[#EB6658]/15 text-white border-[#EB6658]/50'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#EB6658]" />
            <span>01. Task Dependency DAG</span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {metrics.tasksCount} tasks · {metrics.explicitEdgesCount} edges
            </span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block" />

          {/* Lens 2: LangGraph StateGraph */}
          <button
            type="button"
            onClick={() => onTabChange('graphs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 border ${
              currentTab === 'graphs'
                ? 'bg-[#EB6658]/15 text-white border-[#EB6658]/50'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-sky-400" />
            <span>02. LangGraph StateGraph</span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {metrics.langGraphNodesCount} nodes · cyclic
            </span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block" />

          {/* Lens 3: Event Flow DAG (@start / @listen / @router) */}
          <button
            type="button"
            onClick={() => {
              onSelectFlowSubView?.('flow_dag');
              onTabChange('flows');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 border ${
              currentTab === 'flows' && flowSubView === 'flow_dag'
                ? 'bg-[#EB6658]/15 text-white border-[#EB6658]/50'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5 text-amber-400" />
            <span>03. Event Flow DAG</span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {metrics.flowStepsCount} @flow steps
            </span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0 hidden sm:block" />

          {/* Lens 4: Graphify Whole-Repo Knowledge Graph */}
          <button
            type="button"
            onClick={() => {
              onSelectFlowSubView?.('graphify_repo');
              onTabChange('flows');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 border ${
              currentTab === 'flows' && flowSubView === 'graphify_repo'
                ? 'bg-[#EB6658]/15 text-white border-[#EB6658]/50'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <GitFork className="w-3.5 h-3.5 text-emerald-400" />
            <span>04. Graphify Repo Map</span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {metrics.graphifyModulesCount} modules
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
