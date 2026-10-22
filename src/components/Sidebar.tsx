import React, { useState, useEffect } from 'react';
import { DocSection, DocPage } from '../types';
import { 
  Rocket, 
  Box, 
  Code, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  Download, 
  Terminal, 
  UserCheck, 
  Users, 
  CheckSquare, 
  GitMerge, 
  Cpu, 
  Database, 
  Activity, 
  Play, 
  FileText,
  Search,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Clock,
  X,
  Trash2,
  Plus
} from 'lucide-react';

export const BOOKMARKS_STORAGE_KEY = 'crewai_docs_bookmarks';
export const RECENTLY_VIEWED_STORAGE_KEY = 'crewai_docs_recently_viewed';
const MAX_RECENT_PAGES = 5;

interface SidebarProps {
  sections: DocSection[];
  selectedPageId: string;
  onSelectPage: (id: string) => void;
  onOpenStudio: () => void;
  bookmarkedIds?: string[];
  onToggleBookmark?: (pageId: string) => void;
  onClearBookmarks?: () => void;
  recentlyViewedIds?: string[];
  onClearRecentlyViewed?: () => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  rocket: Rocket,
  box: Box,
  code: Code,
  sparkles: Sparkles,
  zap: Zap,
  download: Download,
  terminal: Terminal,
  'user-check': UserCheck,
  users: Users,
  'check-square': CheckSquare,
  'git-merge': GitMerge,
  cpu: Cpu,
  database: Database,
  activity: Activity,
  play: Play,
  'file-text': FileText,
  'book-open': BookOpen,
};

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  selectedPageId,
  onSelectPage,
  onOpenStudio,
  bookmarkedIds: externalBookmarkedIds,
  onToggleBookmark: externalToggleBookmark,
  onClearBookmarks: externalClearBookmarks,
  recentlyViewedIds: externalRecentlyViewedIds,
  onClearRecentlyViewed: externalClearRecentlyViewed,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [localBookmarkedIds, setLocalBookmarkedIds] = useState<string[]>(() => {
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

  // Track the last 5 visited pages in a state array
  const [localRecentlyViewedIds, setLocalRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, MAX_RECENT_PAGES);
        }
      }
    } catch {
      // ignore localStorage read errors
    }
    return selectedPageId ? [selectedPageId] : [];
  });

  const bookmarkedIds = externalBookmarkedIds ?? localBookmarkedIds;
  const recentlyViewedIds = externalRecentlyViewedIds ?? localRecentlyViewedIds;

  useEffect(() => {
    if (externalBookmarkedIds === undefined) {
      try {
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(localBookmarkedIds));
      } catch {
        // ignore localStorage write errors
      }
    }
  }, [localBookmarkedIds, externalBookmarkedIds]);

  // Update internal recentlyViewedIds state array whenever selectedPageId changes (capped at 5)
  useEffect(() => {
    if (!selectedPageId) return;
    setLocalRecentlyViewedIds((prev) => {
      const updated = [
        selectedPageId,
        ...prev.filter((id) => id !== selectedPageId),
      ].slice(0, MAX_RECENT_PAGES);
      if (externalRecentlyViewedIds === undefined) {
        try {
          localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore localStorage write errors
        }
      }
      return updated;
    });
  }, [selectedPageId, externalRecentlyViewedIds]);

  const handleToggleBookmark = (pageId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (externalToggleBookmark) {
      externalToggleBookmark(pageId);
    } else {
      setLocalBookmarkedIds((prev) =>
        prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
      );
    }
  };

  const handleClearBookmarks = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (externalClearBookmarks) {
      externalClearBookmarks();
    } else {
      setLocalBookmarkedIds([]);
    }
  };

  const handleClearRecentlyViewed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (externalClearRecentlyViewed) {
      externalClearRecentlyViewed();
    } else {
      const reset = selectedPageId ? [selectedPageId] : [];
      setLocalRecentlyViewedIds(reset);
      try {
        localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(reset));
      } catch {
        // ignore localStorage write errors
      }
    }
  };

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const allPages: DocPage[] = sections.flatMap((sec) => sec.pages);
  const bookmarkedPages: DocPage[] = bookmarkedIds
    .map((id) => allPages.find((p) => p.id === id))
    .filter((p): p is DocPage => Boolean(p))
    .filter(
      (p) =>
        !filterQuery.trim() ||
        p.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase().includes(filterQuery.toLowerCase()))
    );

  const recentlyViewedPages: DocPage[] = recentlyViewedIds
    .slice(0, MAX_RECENT_PAGES)
    .map((id) => allPages.find((p) => p.id === id))
    .filter((p): p is DocPage => Boolean(p))
    .filter(
      (p) =>
        !filterQuery.trim() ||
        p.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase().includes(filterQuery.toLowerCase()))
    );

  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      pages: sec.pages.filter((p) => {
        const matchesQuery =
          !filterQuery.trim() ||
          p.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
          p.tags?.some((t) => t.toLowerCase().includes(filterQuery.toLowerCase()));
        const matchesBookmarkFilter = !showSavedOnly || bookmarkedIds.includes(p.id);
        return matchesQuery && matchesBookmarkFilter;
      }),
    }))
    .filter((sec) => sec.pages.length > 0);

  const isBookmarksCollapsed = collapsedSections['__bookmarks__'] ?? false;
  const isRecentlyViewedCollapsed = collapsedSections['__recently_viewed__'] ?? false;
  const isCurrentPageBookmarked = bookmarkedIds.includes(selectedPageId);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800/80 bg-[#0B0F19]/90 flex flex-col h-[calc(100vh-6.5rem)] sticky top-[6.5rem] select-none">
      {/* Quick Filter & View Switcher */}
      <div className="p-3 border-b border-slate-800/80 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Filter documentation..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-slate-900 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-7 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-[#EB6658] transition"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 transition"
              title="Clear filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* All vs Saved Filter Tabs */}
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-900/90 rounded-lg border border-slate-800/80 text-[11px]">
          <button
            onClick={() => setShowSavedOnly(false)}
            className={`py-1 px-2 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
              !showSavedOnly
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>All Docs</span>
          </button>
          <button
            onClick={() => setShowSavedOnly(true)}
            className={`py-1 px-2 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
              showSavedOnly
                ? 'bg-[#EB6658]/20 text-[#EB6658] border border-[#EB6658]/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className={`w-3 h-3 ${bookmarkedIds.length > 0 ? 'fill-[#EB6658] text-[#EB6658]' : ''}`} />
            <span>Saved</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                bookmarkedIds.length > 0
                  ? 'bg-[#EB6658]/20 text-[#EB6658]'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {bookmarkedIds.length}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Bookmarks Quick-Access Section */}
        {!showSavedOnly && (
          <div className="space-y-1.5 pb-3 border-b border-slate-800/70">
            <div className="flex items-center justify-between px-2 py-1">
              <button
                onClick={() => toggleSection('__bookmarks__')}
                className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-300 hover:text-white transition group"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>Bookmarks</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#EB6658]/15 text-[#EB6658] border border-[#EB6658]/30">
                  {bookmarkedIds.length}
                </span>
              </button>

              <div className="flex items-center gap-1">
                {bookmarkedIds.length > 0 && (
                  <button
                    onClick={handleClearBookmarks}
                    title="Clear all bookmarks"
                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800/60 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => toggleSection('__bookmarks__')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 transition"
                >
                  <ChevronRight
                    className={`w-3 h-3 transition-transform ${
                      isBookmarksCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </button>
              </div>
            </div>

            {!isBookmarksCollapsed && (
              <div className="space-y-1 pl-1">
                {bookmarkedPages.length > 0 ? (
                  bookmarkedPages.map((page) => {
                    const isSelected = page.id === selectedPageId;
                    const PageIcon = page.icon && ICON_MAP[page.icon] ? ICON_MAP[page.icon] : FileText;

                    return (
                      <div
                        key={`bookmark-${page.id}`}
                        onClick={() => onSelectPage(page.id)}
                        className={`group/bm w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#EB6658]/15 text-[#EB6658] font-semibold border-l-2 border-[#EB6658]'
                            : 'text-slate-300 hover:text-white hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PageIcon
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              isSelected ? 'text-[#EB6658]' : 'text-[#EB6658]/70'
                            }`}
                          />
                          <div className="truncate">
                            <div className="truncate">{page.title}</div>
                            <div className="text-[10px] text-slate-500 truncate font-normal">
                              {page.category}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleToggleBookmark(page.id, e)}
                          title="Remove bookmark"
                          className="opacity-70 group-hover/bm:opacity-100 p-1 rounded hover:bg-slate-800 text-[#EB6658] hover:text-rose-400 transition flex-shrink-0"
                        >
                          <Bookmark className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-2.5 rounded-lg bg-slate-900/40 border border-dashed border-slate-800/80 text-[11px] text-slate-400 space-y-2">
                    <p className="leading-relaxed text-slate-500">
                      Save documentation pages here for instant one-click access.
                    </p>
                    {!isCurrentPageBookmarked && (
                      <button
                        onClick={() => handleToggleBookmark(selectedPageId)}
                        className="w-full py-1 px-2 rounded-md bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/60 transition flex items-center justify-center gap-1.5 text-[11px] font-medium"
                      >
                        <Plus className="w-3 h-3 text-[#EB6658]" />
                        <span>Bookmark current page</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recently Viewed Section (Last 5 Visited Pages) */}
        {!showSavedOnly && recentlyViewedPages.length > 0 && (
          <div className="space-y-1.5 pb-3 border-b border-slate-800/70">
            <div className="flex items-center justify-between px-2 py-1">
              <button
                onClick={() => toggleSection('__recently_viewed__')}
                className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-300 hover:text-white transition group"
              >
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Recently Viewed</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  {recentlyViewedPages.length}/{MAX_RECENT_PAGES}
                </span>
              </button>

              <div className="flex items-center gap-1">
                {recentlyViewedIds.length > 1 && (
                  <button
                    onClick={handleClearRecentlyViewed}
                    title="Clear recently viewed history"
                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800/60 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => toggleSection('__recently_viewed__')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 transition"
                >
                  <ChevronRight
                    className={`w-3 h-3 transition-transform ${
                      isRecentlyViewedCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </button>
              </div>
            </div>

            {!isRecentlyViewedCollapsed && (
              <div className="space-y-0.5 pl-1">
                {recentlyViewedPages.map((page, index) => {
                  const isSelected = page.id === selectedPageId;
                  const PageIcon = page.icon && ICON_MAP[page.icon] ? ICON_MAP[page.icon] : FileText;

                  return (
                    <button
                      key={`recent-${page.id}`}
                      onClick={() => onSelectPage(page.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition text-left ${
                        isSelected
                          ? 'bg-[#EB6658]/15 text-[#EB6658] font-semibold border-l-2 border-[#EB6658]'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PageIcon
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isSelected ? 'text-[#EB6658]' : 'text-sky-400/70'
                          }`}
                        />
                        <div className="truncate">
                          <div className="truncate">{page.title}</div>
                          <div className="text-[10px] text-slate-500 truncate font-normal">
                            {page.category}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
                          index === 0
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                            : 'text-slate-500 bg-slate-900/80'
                        }`}
                      >
                        {index === 0 ? 'Now' : `#${index + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Documentation Sections */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => {
            const isCollapsed = collapsedSections[section.title] ?? false;
            const SectionIcon = section.icon && ICON_MAP[section.icon] ? ICON_MAP[section.icon] : BookOpen;

            return (
              <div key={section.title} className="space-y-1">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-slate-400 hover:text-slate-200 transition group"
                >
                  <div className="flex items-center gap-1.5">
                    <SectionIcon className="w-3.5 h-3.5 text-[#EB6658]/80 group-hover:text-[#EB6658]" />
                    <span>{section.title}</span>
                  </div>
                  <ChevronRight
                    className={`w-3 h-3 text-slate-500 transition-transform ${
                      isCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </button>

                {/* Pages */}
                {!isCollapsed && (
                  <div className="space-y-0.5 pl-2">
                    {section.pages.map((page) => {
                      const isSelected = page.id === selectedPageId;
                      const isBookmarked = bookmarkedIds.includes(page.id);
                      const PageIcon = page.icon && ICON_MAP[page.icon] ? ICON_MAP[page.icon] : FileText;

                      return (
                        <div
                          key={page.id}
                          onClick={() => onSelectPage(page.id)}
                          className={`group/item w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#EB6658]/15 text-[#EB6658] font-semibold border-l-2 border-[#EB6658]'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <PageIcon
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isSelected ? 'text-[#EB6658]' : 'text-slate-500'
                              }`}
                            />
                            <span className="truncate">{page.title}</span>
                          </div>

                          <button
                            onClick={(e) => handleToggleBookmark(page.id, e)}
                            title={isBookmarked ? 'Remove from bookmarks' : 'Save to bookmarks'}
                            aria-label={isBookmarked ? `Remove ${page.title} from bookmarks` : `Bookmark ${page.title}`}
                            className={`p-1 rounded transition flex-shrink-0 ${
                              isBookmarked
                                ? 'text-[#EB6658] opacity-100 hover:bg-slate-800/80'
                                : 'text-slate-500 opacity-0 group-hover/item:opacity-100 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                          >
                            <Bookmark
                              className={`w-3 h-3 ${isBookmarked ? 'fill-[#EB6658]' : ''}`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-8 px-4 text-center space-y-2">
            <Bookmark className="w-6 h-6 text-slate-600 mx-auto" />
            <div className="text-xs font-medium text-slate-300">
              {showSavedOnly ? 'No bookmarked pages found' : 'No matching pages'}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {showSavedOnly
                ? 'Click the bookmark icon next to any article in the sidebar to save it for quick access.'
                : 'Try adjusting your search filter query.'}
            </p>
            {showSavedOnly && (
              <button
                onClick={() => setShowSavedOnly(false)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
              >
                View all documentation
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Promo Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#EB6658]/10 to-[#EB6658]/5 border border-[#EB6658]/20 text-xs">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#EB6658]" />
            <span>Interactive Simulator</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
            Configure role-based agents, chain tasks, and execute live runs.
          </p>
          <button
            onClick={onOpenStudio}
            className="w-full py-1.5 px-2 bg-[#EB6658] hover:bg-[#C94C3C] text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 shadow-sm"
          >
            Launch Crew Studio
          </button>
        </div>
      </div>
    </aside>
  );
};

