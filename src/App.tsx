import React, { useState, useEffect } from 'react';
import { DocTab, LanguageCode, VersionCode, DocPage, JulesContext } from './types';
import { DOC_SECTIONS } from './data/docsContent';
import { Navbar } from './components/Navbar';
import { UnifiedGraphAlignmentBar } from './components/UnifiedGraphAlignmentBar';
import { DocsBreadcrumbBar } from './components/DocsBreadcrumbBar';
import { Sidebar, BOOKMARKS_STORAGE_KEY, RECENTLY_VIEWED_STORAGE_KEY } from './components/Sidebar';
import { DocViewer } from './components/DocViewer';
import { CrewStudio } from './components/CrewStudio';
import { LangGraphView } from './components/LangGraphView';
import { FlowVisualizer } from './components/FlowVisualizer';
import { ToolsCatalogView } from './components/ToolsCatalogView';
import { TraceViewer } from './components/TraceViewer';
import { SearchModal } from './components/SearchModal';
import { AgentPromptModal } from './components/AgentPromptModal';
import { OllamaPoolModal } from './components/OllamaPoolModal';
import { GitHubHub } from './components/GitHubHub';
import { JulesAgentModal } from './components/JulesAgentModal';
import { ApiDiagnosticsModal } from './components/ApiDiagnosticsModal';
import { AntigravityRemoteScanModal } from './components/AntigravityRemoteScanModal';
import { ProModeModal } from './components/ProModeModal';
import { GlobalCardMinMaxEnhancer } from './components/CardMinMaxControl';
import { globalTaskThrottler } from './utils/taskThrottler';

// Install global API polling coalescer, TTL cache, and background task concurrency throttler
globalTaskThrottler.installGlobalFetchThrottler();

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<DocTab>('studio');
  const [flowSubView, setFlowSubView] = useState<'flow_dag' | 'graphify_repo'>('graphify_repo');
  const [focusedLangGraphNodeId, setFocusedLangGraphNodeId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string>('introduction');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isAgentSetupOpen, setIsAgentSetupOpen] = useState<boolean>(false);
  const [isOllamaPoolOpen, setIsOllamaPoolOpen] = useState<boolean>(false);
  const [isJulesOpen, setIsJulesOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isProModeOpen, setIsProModeOpen] = useState<boolean>(false);
  const [isRemoteScanOpen, setIsRemoteScanOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.search.includes('antigravity_remote');
  });
  const [remoteScanInitialMode] = useState<'pair_qr' | 'camera_scanner' | 'remote_deck'>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('antigravity_remote')) {
      return 'remote_deck';
    }
    return 'pair_qr';
  });
  const [julesContext, setJulesContext] = useState<JulesContext | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [version, setVersion] = useState<VersionCode>('Edge');

  // Lifted GitHub state
  const [selectedRepo, setSelectedRepo] = useState<string>(
    () => localStorage.getItem('crewai_selected_repo') || 'bingkltech/crewAI'
  );
  const [selectedBranch, setSelectedBranch] = useState<string>(
    () => localStorage.getItem('crewai_selected_branch') || 'main'
  );
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore localStorage read errors
    }
    return [];
  });
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 5);
        }
      }
    } catch {
      // ignore localStorage read errors
    }
    return ['introduction'];
  });

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarkedIds));
    } catch {
      // ignore localStorage write errors
    }
  }, [bookmarkedIds]);

  useEffect(() => {
    if (!selectedPageId) return;
    setRecentlyViewedIds((prev) => {
      const updated = [selectedPageId, ...prev.filter((id) => id !== selectedPageId)].slice(0, 5);
      try {
        localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore localStorage write errors
      }
      return updated;
    });
  }, [selectedPageId]);

  // Global keyboard shortcut Cmd/Ctrl + K for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleBookmark = (pageId: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const clearBookmarks = () => {
    setBookmarkedIds([]);
  };

  const clearRecentlyViewed = () => {
    const reset = selectedPageId ? [selectedPageId] : [];
    setRecentlyViewedIds(reset);
    try {
      localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(reset));
    } catch {
      // ignore localStorage write errors
    }
  };

  const allPages: DocPage[] = DOC_SECTIONS.flatMap((sec) => sec.pages);
  const activePage = allPages.find((p) => p.id === selectedPageId) || allPages[0];

  return (
    <div
      className={`min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col ${
        language === 'ar' ? 'font-sans' : ''
      }`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAgentSetup={() => setIsAgentSetupOpen(true)}
        onOpenOllamaPool={() => setIsOllamaPoolOpen(true)}
        onOpenJules={() => {
          setJulesContext(null);
          setIsJulesOpen(true);
        }}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenRemoteScan={() => setIsRemoteScanOpen(true)}
        onOpenProMode={() => setIsProModeOpen(true)}
        selectedRepo={selectedRepo}
        selectedBranch={selectedBranch}
        language={language}
        onLanguageChange={setLanguage}
        version={version}
        onVersionChange={setVersion}
      />

      {/* Unified 4-Graph Architecture Alignment Bar (Task DAG ↔ LangGraph ↔ Flow DAG ↔ Graphify) */}
      <UnifiedGraphAlignmentBar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        selectedRepo={selectedRepo}
        selectedBranch={selectedBranch}
        flowSubView={flowSubView}
        onSelectFlowSubView={(sub) => setFlowSubView(sub)}
      />

      {/* Breadcrumb Navigation Bar below main header in 'docs' view */}
      {currentTab === 'docs' && (
        <DocsBreadcrumbBar
          sections={DOC_SECTIONS}
          activePage={activePage}
          allPages={allPages}
          onSelectPage={(id) => setSelectedPageId(id)}
          language={language}
          version={version}
        />
      )}

      {/* Main Body */}
      <main className="flex-1 flex overflow-hidden">
        {currentTab === 'docs' && (
          <div className="flex-1 flex overflow-hidden">
            <Sidebar
              sections={DOC_SECTIONS}
              selectedPageId={selectedPageId}
              onSelectPage={(id) => setSelectedPageId(id)}
              onOpenStudio={() => setCurrentTab('studio')}
              bookmarkedIds={bookmarkedIds}
              onToggleBookmark={toggleBookmark}
              onClearBookmarks={clearBookmarks}
              recentlyViewedIds={recentlyViewedIds}
              onClearRecentlyViewed={clearRecentlyViewed}
            />
            <DocViewer
              page={activePage}
              onOpenStudio={() => setCurrentTab('studio')}
              onNavigatePage={(id) => setSelectedPageId(id)}
              allPages={allPages}
              isBookmarked={bookmarkedIds.includes(activePage.id)}
              onToggleBookmark={toggleBookmark}
            />
          </div>
        )}

        {currentTab === 'studio' && (
          <CrewStudio
            onOpenOllamaScanner={() => setIsOllamaPoolOpen(true)}
            onNavigateToGitHub={() => setCurrentTab('github')}
            onOpenJules={(ctx) => {
              setJulesContext(ctx || null);
              setIsJulesOpen(true);
            }}
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            onRepoChange={(repo) => {
              setSelectedRepo(repo);
              localStorage.setItem('crewai_selected_repo', repo);
            }}
            onBranchChange={(branch) => {
              setSelectedBranch(branch);
              localStorage.setItem('crewai_selected_branch', branch);
            }}
          />
        )}
        {currentTab === 'graphs' && (
          <LangGraphView
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            focusedNodeId={focusedLangGraphNodeId}
            onOpenStudio={() => setCurrentTab('studio')}
            onOpenJules={(ctx) => {
              setJulesContext(ctx || null);
              setIsJulesOpen(true);
            }}
            onOpenGraphifyModule={() => {
              setFlowSubView('graphify_repo');
              setCurrentTab('flows');
            }}
            onOpenFlowStep={() => {
              setFlowSubView('flow_dag');
              setCurrentTab('flows');
            }}
          />
        )}
        {currentTab === 'flows' && (
          <FlowVisualizer
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            initialSubView={flowSubView}
            onSubViewChange={(sub) => setFlowSubView(sub)}
            onOpenCrewStudio={() => setCurrentTab('studio')}
            onOpenLangGraph={(lgNodeId) => {
              if (lgNodeId) setFocusedLangGraphNodeId(lgNodeId);
              setCurrentTab('graphs');
            }}
            onTaskJules={(node) => {
              setJulesContext({
                targetType: 'module',
                targetName: node.name,
                targetPath: node.path,
                suggestedPrompt: `Task Jules to analyze ${node.name} (${node.path}) in ${selectedRepo}@${selectedBranch}, run test suite, and generate verified GitHub PR.`
              });
              setIsJulesOpen(true);
            }}
          />
        )}
        {currentTab === 'github' && (
          <GitHubHub
            selectedRepo={selectedRepo}
            onRepoChange={(repo) => {
              setSelectedRepo(repo);
              localStorage.setItem('crewai_selected_repo', repo);
            }}
            selectedBranch={selectedBranch}
            onBranchChange={(branch) => {
              setSelectedBranch(branch);
              localStorage.setItem('crewai_selected_branch', branch);
            }}
          />
        )}
        {currentTab === 'tools' && (
          <ToolsCatalogView
            onEquipInStudio={() => setCurrentTab('studio')}
            onUseEmailInStudio={(formattedTopic) => {
              try {
                const raw = localStorage.getItem('crewai_studio_workflow_autosave');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  parsed.runInput = formattedTopic;
                  localStorage.setItem('crewai_studio_workflow_autosave', JSON.stringify(parsed));
                }
              } catch {
                // ignore
              }
              setCurrentTab('studio');
            }}
          />
        )}
        {currentTab === 'traces' && <TraceViewer />}
      </main>

      {/* Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        allPages={allPages}
        onSelectPage={(id) => {
          setSelectedPageId(id);
          setCurrentTab('docs');
        }}
        onOpenTools={() => setCurrentTab('tools')}
      />

      <AgentPromptModal
        isOpen={isAgentSetupOpen}
        onClose={() => setIsAgentSetupOpen(false)}
      />

      <OllamaPoolModal
        isOpen={isOllamaPoolOpen}
        onClose={() => setIsOllamaPoolOpen(false)}
        onSelectPoolModel={() => setCurrentTab('studio')}
      />

      <JulesAgentModal
        isOpen={isJulesOpen}
        onClose={() => setIsJulesOpen(false)}
        context={julesContext}
        selectedRepo={selectedRepo}
        selectedBranch={selectedBranch}
      />

      <ApiDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      <AntigravityRemoteScanModal
        isOpen={isRemoteScanOpen}
        onClose={() => setIsRemoteScanOpen(false)}
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        selectedRepo={selectedRepo}
        selectedBranch={selectedBranch}
        initialMode={remoteScanInitialMode}
      />

      <ProModeModal
        isOpen={isProModeOpen}
        onClose={() => setIsProModeOpen(false)}
        selectedRepo={selectedRepo}
        selectedBranch={selectedBranch}
        onRepoChange={(repo) => {
          setSelectedRepo(repo);
          localStorage.setItem('crewai_selected_repo', repo);
        }}
        onBranchChange={(branch) => {
          setSelectedBranch(branch);
          localStorage.setItem('crewai_selected_branch', branch);
        }}
      />

      <GlobalCardMinMaxEnhancer />
    </div>
  );
};

export default App;
