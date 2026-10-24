import React from 'react';
import {
  Sparkles,
  Upload,
  FolderOpen,
  Play,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  HelpCircle,
  GitBranch,
  Cpu,
  ListOrdered,
  Layers,
  Rocket
} from 'lucide-react';
import { CardMinMaxButtons } from './CardMinMaxControl';

export type SpoonFeedStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface SpoonFeedStepMeta {
  step: SpoonFeedStep;
  shortLabel: string;
  actionTag: string;
  title: string;
  plainEnglish: string;
  whatToClick: string[];
}

export const SPOON_FEED_STEPS: SpoonFeedStepMeta[] = [
  {
    step: 1,
    shortLabel: '1. Open / Start Project',
    actionTag: '👉 CLICK ME HERE FIRST!',
    title: 'Step 1: Open a Project or Create a Brand-New One',
    plainEnglish:
      'New to CrewAI? Think of a "Crew" as your own small company of AI workers. First, choose what project you want to work on:',
    whatToClick: [
      'Click "Start Fresh Blank Project" below to build a new AI team from scratch.',
      'Or click "Import Project Folder" / "Import JSON" right below to load a project from your computer.',
      'Or pick a ready-made template from the "Preset" dropdown!'
    ]
  },
  {
    step: 2,
    shortLabel: '2 & 2.1. Name & Pull Target',
    actionTag: '✏️ CLICK & PULL TARGET (2.1)',
    title: 'Step 2 & 2.1: Name Your Project, Pull Project Target (2.1) & Choose Team Mode',
    plainEnglish:
      'Every project needs a name, a pulled target repository (Step 2.1), and a teamwork style ("Process Mode"):',
    whatToClick: [
      'Type your project name in the "Project / Crew Name" box directly below this bubble.',
      'Step 2.1: Click "2.1 Pull Project Target" to pull the target repository tree, commits, and AST into your workspace.',
      'Click "Sequential" (Recommended!) or "Hierarchical" to choose how your AI team collaborates.'
    ]
  },
  {
    step: 3,
    shortLabel: '3. AI Workers (Agents)',
    actionTag: '🤖 CLICK & DO THIS',
    title: 'Step 3: Meet & Customize Your AI Workers ("Agents")',
    plainEnglish:
      'An "Agent" is simply one AI employee on your team. You don\'t need to write code—just tell each worker who they are in plain English:',
    whatToClick: [
      'Click an Agent tab below (or click "+ Add Agent" to hire a new AI teammate).',
      'Fill in "Role" (their job title, like "Senior Python & React Coder") and "Goal" (what you want them to achieve).',
      'Click any "Equipped Tools" buttons at the bottom (like SerperDevTool for web search or FileWriteTool to save code).'
    ]
  },
  {
    step: 4,
    shortLabel: '4. To-Do List (Tasks)',
    actionTag: '📋 DO THIS NEXT',
    title: 'Step 4: Give Your AI Workers a Step-by-Step To-Do List ("Tasks")',
    plainEnglish:
      'AI workers won\'t do anything until you give them a "Task" (a specific assignment on their checklist):',
    whatToClick: [
      'Click inside the Task Description box below and type what you want done in plain English.',
      'Click the "Assign: ..." dropdown on the right side of the task to pick which AI worker should do that job.',
      'Need another step? Click "+ Add Task" at the top-right of the Tasks card!'
    ]
  },
  {
    step: 5,
    shortLabel: '5. Focus Topic & Run!',
    actionTag: '🚀 CLICK ME TO LAUNCH!',
    title: 'Step 5: Type What Project to Focus On & Click "Run"!',
    plainEnglish:
      'Now tell your Crew the exact topic, feature, or app you want them to build today, and watch them work:',
    whatToClick: [
      'Type your project focus in the Mission Input box below (or click one of the 1-Click Starter Ideas inside this bubble!).',
      'Click the orange "Run 4-Stage Loop" button (or click "Launch My Crew Now" below) to watch your AI team research, write code, test it in Jules VM, and prepare a PR!'
    ]
  },
  {
    step: 6,
    shortLabel: '6. Push to GitHub / 24-7',
    actionTag: '🎉 CLICK TO PUSH VIA PAT!',
    title: 'Step 6: Push Your Project to GitHub (via .env PAT) or Run 24/7',
    plainEnglish:
      'Awesome! Your Crew has generated the code and workflow. Now you can push it straight to GitHub using your Personal Access Token (PAT) or let it run 24/7:',
    whatToClick: [
      'Click "Push Project to GitHub (via .env PAT)" below to commit your Crew directly to your GitHub repository.',
      'If your .env file was cleared earlier, click "Upload .env & Auto-Push" to pick your .env file from your computer.',
      'Or click "Enable 24/7 Zero-Supervision Daemon" so your Crew keeps working autonomously!'
    ]
  }
];

interface SpoonFeedTopBarProps {
  isActive: boolean;
  currentStep: SpoonFeedStep;
  onToggleActive: () => void;
  onSelectStep: (step: SpoonFeedStep) => void;
  onStartFreshProject: () => void;
  onOpenFolderPicker: () => void;
  onPushWithPat: () => void;
  isPushingPat: boolean;
  hasGithubPat: boolean;
  onUploadEnvClick: () => void;
}

export const SpoonFeedTopBar: React.FC<SpoonFeedTopBarProps> = ({
  isActive,
  currentStep,
  onToggleActive,
  onSelectStep,
  onStartFreshProject,
  onOpenFolderPicker,
  onPushWithPat,
  isPushingPat,
  hasGithubPat,
  onUploadEnvClick
}) => {
  if (!isActive) {
    return (
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#EB6658]/15 via-amber-500/10 to-slate-900 border border-[#EB6658]/40 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-[#EB6658] text-white shadow-sm animate-bounce">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Beginner Spoon-Feed Guide ("Click Me Here" Interactive Coach)</span>
            </div>
            <p className="text-[11px] text-slate-300">
              New to CrewAI? Turn on interactive guide bubbles that point to each button and show you exactly what to click step-by-step.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPushWithPat}
            disabled={isPushingPat}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isPushingPat ? 'Pushing via PAT...' : 'Push to GitHub (PAT)'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            className="px-4 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Start Interactive "Click Me" Guide</span>
          </button>
          <CardMinMaxButtons
            isMinimized={true}
            onMinimize={() => {}}
            onExpand={onToggleActive}
            title="Interactive Beginner Guide"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#151C2C] to-slate-900 border-2 border-[#EB6658]/60 shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#EB6658] text-white shadow-md shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Interactive Beginner Guide — Follow the Orange "Click Me Here" Bubbles Below!
              </h2>
              <span className="text-[11px] font-mono text-amber-300">
                · Step {currentStep} of 6 Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Click any step below to jump straight to that section with a floating guide bubble, or use the 1-click shortcut buttons.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <button
            type="button"
            onClick={onStartFreshProject}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Create a clean beginner project and start Step 1"
          >
            <Layers className="w-3.5 h-3.5 text-amber-300" />
            <span>New Blank Project</span>
          </button>

          <button
            type="button"
            onClick={onOpenFolderPicker}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Select a project folder from your computer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-300" />
            <span>Open Local Project</span>
          </button>

          <button
            type="button"
            onClick={onPushWithPat}
            disabled={isPushingPat}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Push current Crew configuration directly to GitHub using your PAT from .env"
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isPushingPat ? 'Pushing to GitHub...' : 'Push Now (via .env PAT)'}</span>
          </button>

          {!hasGithubPat && (
            <button
              type="button"
              onClick={onUploadEnvClick}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Re-attach your .env file containing GITHUB_TOKEN or GITHUB_PAT"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Attach .env PAT</span>
            </button>
          )}

          <CardMinMaxButtons
            isMinimized={false}
            onMinimize={onToggleActive}
            onExpand={() => {}}
            title="Interactive Beginner Guide"
          />
        </div>
      </div>

      {/* 6-Step Interactive Progress Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/90">
        {SPOON_FEED_STEPS.map((item) => {
          const isCurrent = item.step === currentStep;
          const isDone = item.step < currentStep;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => onSelectStep(item.step)}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                isCurrent
                  ? 'bg-[#EB6658] border-amber-300 text-white shadow-lg ring-2 ring-[#EB6658]/40'
                  : isDone
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 hover:bg-emerald-950/60'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                <span>STEP {item.step}</span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <span className="px-1.5 py-0.2 rounded bg-black/30 text-amber-200 animate-pulse">
                    HERE
                  </span>
                ) : null}
              </div>
              <div className="text-xs font-bold truncate">{item.shortLabel.replace(/^\d+\.\s*/, '')}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ContextualGuideBubbleProps {
  step: SpoonFeedStep;
  currentStep: SpoonFeedStep;
  isActive: boolean;
  pointerDirection?: 'down' | 'up';
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
  customActions?: React.ReactNode;
}

export const ContextualGuideBubble: React.FC<ContextualGuideBubbleProps> = ({
  step,
  currentStep,
  isActive,
  pointerDirection = 'down',
  onNext,
  onPrev,
  onDismiss,
  customActions
}) => {
  if (!isActive || step !== currentStep) return null;

  const meta = SPOON_FEED_STEPS.find((s) => s.step === step);
  if (!meta) return null;

  return (
    <div className="relative z-20 my-3 animate-fadeIn">
      {pointerDirection === 'up' && (
        <div className="flex items-center gap-2 mb-1.5 pl-6">
          <div className="px-3 py-1 rounded-lg bg-[#EB6658] text-white text-xs font-extrabold tracking-wide shadow-md flex items-center gap-1.5 animate-bounce">
            <span>▲ CLICK THE BUTTONS RIGHT ABOVE THIS BUBBLE!</span>
          </div>
        </div>
      )}

      <div
        data-universal-card-checked="react-managed"
        className="p-4 sm:p-5 rounded-2xl bg-[#131B2E] border-2 border-[#EB6658] shadow-2xl space-y-3"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-[#EB6658] text-white text-xs font-extrabold tracking-wide shadow-sm">
              STEP {meta.step} OF 6 • {meta.actionTag}
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-white">
              {meta.title}
            </h3>
          </div>

          <CardMinMaxButtons
            isMinimized={false}
            onMinimize={onDismiss}
            onExpand={() => {}}
            title="Step Guide Bubble"
            className="ml-auto"
          />
        </div>

        <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed font-medium">
          {meta.plainEnglish}
        </p>

        {/* Bulleted "Click Me / Do This" Instructions */}
        <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#EB6658]">
            What to Click & Do Right Now:
          </div>
          <ul className="space-y-1.5 text-xs text-slate-200">
            {meta.whatToClick.map((instruction, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-mono font-bold text-amber-400 shrink-0">
                  {idx + 1}.
                </span>
                <span>{instruction}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Optional Step-Specific 1-Click Spoon-Feed Action Buttons */}
        {customActions && (
          <div className="pt-1 flex flex-wrap items-center gap-2">
            {customActions}
          </div>
        )}

        {/* Step Navigation Footer */}
        <div className="pt-2 border-t border-slate-800/90 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 6 ? (
              <button
                type="button"
                onClick={onNext}
                className="px-4 py-2 rounded-xl bg-[#EB6658] hover:bg-[#d95547] text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <span>Done! Take Me to Step {step + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish Beginner Guide</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {pointerDirection === 'down' && (
        <div className="flex items-center gap-2 mt-1.5 pl-6">
          <div className="px-3 py-1 rounded-lg bg-[#EB6658] text-white text-xs font-extrabold tracking-wide shadow-md flex items-center gap-1.5 animate-bounce">
            <span>▼ CLICK & DO THIS IN THE HIGHLIGHTED BOX RIGHT BELOW!</span>
          </div>
        </div>
      )}
    </div>
  );
};
