import React, { useState, useRef, useEffect } from 'react';
import { DocPage, DocSection, LanguageCode, VersionCode } from '../types';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  FileCode2,
  Check,
  Copy,
  Layers,
  FileText,
  Home
} from 'lucide-react';

interface DocsBreadcrumbBarProps {
  sections: DocSection[];
  activePage: DocPage;
  allPages: DocPage[];
  onSelectPage: (pageId: string) => void;
  language: LanguageCode;
  version: VersionCode;
}

export const DocsBreadcrumbBar: React.FC<DocsBreadcrumbBarProps> = ({
  sections,
  activePage,
  allPages,
  onSelectPage,
  language,
  version,
}) => {
  const [openMenu, setOpenMenu] = useState<'section' | 'page' | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const activeSection =
    sections.find((sec) => sec.pages.some((p) => p.id === activePage.id)) ||
    sections.find((sec) => sec.title === activePage.category) ||
    sections[0];

  const currentIndex = allPages.findIndex((p) => p.id === activePage.id);
  const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

  const sectionPageIndex = activeSection
    ? activeSection.pages.findIndex((p) => p.id === activePage.id)
    : 0;

  const categorySlug = (activeSection?.title || activePage.category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const versionSlug = version === 'Edge' ? 'edge' : version;
  const docFilePath = `docs/${versionSlug}/${language}/${categorySlug}/${activePage.id}.mdx`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(docFilePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1800);
  };

  return (
    <nav
      ref={barRef}
      aria-label="Documentation Breadcrumb"
      className="h-10 bg-[#0d1322]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 select-none z-30 shrink-0"
    >
      {/* Left: Interactive Hierarchy Breadcrumb Trail */}
      <ol className="flex items-center gap-1.5 text-xs min-w-0 overflow-visible">
        {/* Root: Documentation Home */}
        <li className="flex items-center">
          <button
            onClick={() => {
              onSelectPage('introduction');
              setOpenMenu(null);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/70 transition font-medium"
            title="Return to Documentation Introduction"
          >
            <Home className="w-3.5 h-3.5 text-[#EB6658]" />
            <span className="hidden sm:inline">Docs</span>
          </button>
        </li>

        {/* Version / Locale indicator */}
        <li className="hidden md:flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/70 text-[10px] font-mono text-slate-300">
            {versionSlug}/{language}
          </span>
        </li>

        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

        {/* Level 1: Section / Category Dropdown */}
        <li className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'section' ? null : 'section')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition font-medium ${
              openMenu === 'section'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
            title="Switch Documentation Section"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[180px]">
              {activeSection?.title || activePage.category}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-500 transition-transform ${
                openMenu === 'section' ? 'rotate-180 text-slate-300' : ''
              }`}
            />
          </button>

          {openMenu === 'section' && (
            <div className="absolute left-0 mt-1.5 w-64 rounded-xl bg-[#0F1626] border border-slate-800 shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-800/80 mb-1">
                Documentation Sections
              </div>
              {sections.map((sec) => {
                const isCurrentSec = sec.title === activeSection?.title;
                const firstPage = sec.pages[0];
                return (
                  <button
                    key={sec.title}
                    onClick={() => {
                      if (firstPage) onSelectPage(firstPage.id);
                      setOpenMenu(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition text-left ${
                      isCurrentSec
                        ? 'bg-[#EB6658]/15 text-[#EB6658] font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{sec.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                      {sec.pages.length} {sec.pages.length === 1 ? 'page' : 'pages'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </li>

        <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

        {/* Level 2: Active Page Dropdown (Sibling Pages in Current Section) */}
        <li className="relative min-w-0">
          <button
            onClick={() => setOpenMenu(openMenu === 'page' ? null : 'page')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EB6658]/10 hover:bg-[#EB6658]/20 border border-[#EB6658]/25 text-[#EB6658] font-semibold transition max-w-[180px] sm:max-w-[260px]"
            title="Jump to another page in this section"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{activePage.title}</span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${
                openMenu === 'page' ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openMenu === 'page' && activeSection && (
            <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-[#0F1626] border border-slate-800 shadow-2xl py-1.5 z-50">
              <div className="px-3 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-800/80 mb-1">
                <span>{activeSection.title}</span>
                <span className="font-mono text-slate-400">
                  {sectionPageIndex + 1} of {activeSection.pages.length}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {activeSection.pages.map((p, idx) => {
                  const isCurrent = p.id === activePage.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPage(p.id);
                        setOpenMenu(null);
                      }}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-xs transition text-left ${
                        isCurrent
                          ? 'bg-[#EB6658]/15 text-[#EB6658] font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-500 mt-0.5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{p.title}</div>
                        <div className="text-[10px] text-slate-500 truncate font-normal">
                          {p.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </li>
      </ol>

      {/* Right: MDX Source Path & Quick Hierarchy Pagination */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Copyable MDX file path */}
        <button
          onClick={handleCopyPath}
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition"
          title="Copy documentation file path"
        >
          <FileCode2 className="w-3 h-3 text-slate-500" />
          <span className="truncate max-w-[240px]">{docFilePath}</span>
          {copiedPath ? (
            <Check className="w-3 h-3 text-emerald-400 ml-1" />
          ) : (
            <Copy className="w-3 h-3 text-slate-500 ml-1" />
          )}
        </button>

        {/* Hierarchy position & Prev/Next buttons */}
        <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => prevPage && onSelectPage(prevPage.id)}
            disabled={!prevPage}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            title={prevPage ? `Previous: ${prevPage.title}` : 'First page'}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 text-[10px] font-mono text-slate-400">
            {currentIndex + 1} / {allPages.length}
          </span>
          <button
            onClick={() => nextPage && onSelectPage(nextPage.id)}
            disabled={!nextPage}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            title={nextPage ? `Next: ${nextPage.title}` : 'Last page'}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
};
