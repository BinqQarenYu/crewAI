import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DocPage } from '../types';
import { 
  Check, 
  Copy, 
  ChevronRight, 
  ChevronDown,
  Play, 
  Code2, 
  ArrowRight,
  Bookmark,
  ListFilter,
  ArrowUp,
  Hash
} from 'lucide-react';

interface DocViewerProps {
  page: DocPage;
  onOpenStudio: () => void;
  onNavigatePage: (pageId: string) => void;
  allPages: DocPage[];
  isBookmarked?: boolean;
  onToggleBookmark?: (pageId: string) => void;
}

interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

const slugifyHeading = (text: string, lineIndex: number): string => {
  const clean = text
    .replace(/[`*]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `section-${clean || 'heading'}-${lineIndex}`;
};

export const DocViewer: React.FC<DocViewerProps> = ({
  page,
  onOpenStudio,
  onNavigatePage,
  allPages,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamically extract H2 and H3 headings from the current documentation page
  const tocHeadings = useMemo<TocHeading[]>(() => {
    const lines = page.content.trim().split('\n');
    const extracted: TocHeading[] = [];
    let inCodeBlock = false;

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        return;
      }
      if (inCodeBlock) return;

      if (line.startsWith('## ')) {
        const rawText = line.replace('## ', '').trim();
        const displayText = rawText.replace(/[`*]/g, '');
        extracted.push({
          id: slugifyHeading(rawText, idx),
          text: displayText,
          level: 2,
        });
      } else if (line.startsWith('### ')) {
        const rawText = line.replace('### ', '').trim();
        const displayText = rawText.replace(/[`*]/g, '');
        extracted.push({
          id: slugifyHeading(rawText, idx),
          text: displayText,
          level: 3,
        });
      }
    });

    if (page.codeSnippets && page.codeSnippets.length > 0) {
      extracted.push({
        id: 'section-interactive-code-examples',
        text: 'Interactive Code Examples',
        level: 3,
      });
    }

    return extracted;
  }, [page.content, page.codeSnippets]);

  // Reset scroll progress and set initial active heading when page changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      setScrollProgress(0);
    }
    setActiveHeadingId(tocHeadings[0]?.id || '');
    setIsMobileTocOpen(false);
  }, [page.id, tocHeadings]);

  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const totalScrollableHeight = scrollHeight - clientHeight;
    const progress = totalScrollableHeight > 0 ? (scrollTop / totalScrollableHeight) * 100 : 0;
    setScrollProgress(progress);

    // Scroll-spy for H2 / H3 headings
    if (tocHeadings.length > 0) {
      // If scrolled to the very bottom, activate the last heading
      if (totalScrollableHeight > 0 && scrollTop >= totalScrollableHeight - 24) {
        setActiveHeadingId(tocHeadings[tocHeadings.length - 1].id);
        return;
      }

      const containerTop = scrollRef.current.getBoundingClientRect().top;
      let currentId = tocHeadings[0].id;

      for (const heading of tocHeadings) {
        const el = document.getElementById(heading.id);
        if (el) {
          const offsetTop = el.getBoundingClientRect().top - containerTop;
          if (offsetTop <= 120) {
            currentId = heading.id;
          } else {
            break;
          }
        }
      }
      setActiveHeadingId(currentId);
    }
  };

  const scrollToSection = (headingId: string) => {
    const el = document.getElementById(headingId);
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(headingId);
      setIsMobileTocOpen(false);
    }
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const currentIndex = allPages.findIndex((p) => p.id === page.id);
  const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

  // Simple clean markdown-like parser for rendering formatted headings, paragraphs, and tables
  const renderFormattedContent = (content: string) => {
    const lines = content.trim().split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];

    const flushTable = (key: number) => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(2); // skip separator line
        elements.push(
          <div key={`table-${key}`} className="my-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700/60">
                <tr>
                  {header.map((col, idx) => (
                    <th key={idx} className="p-3 whitespace-nowrap">{col.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {body.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/30 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3">{cell.trim()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    const flushCode = (key: number) => {
      if (codeBlockLines.length > 0) {
        const codeText = codeBlockLines.join('\n');
        elements.push(
          <div key={`inline-code-${key}`} className="my-4 rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800/80 text-xs">
              <span className="font-mono text-slate-400 font-medium">{codeBlockLang || 'code'}</span>
              <button
                onClick={() => copyToClipboard(codeText, `code-${key}`)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
              >
                {copiedSnippet === `code-${key}` ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
              <code>{codeText}</code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      }
    };

    lines.forEach((line, idx) => {
      // Code block start/end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.trim().replace('```', '');
          return;
        } else {
          flushCode(idx);
          return;
        }
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      // Markdown tables
      if (line.trim().startsWith('|')) {
        inTable = true;
        const cols = line.trim().split('|').filter((_, cIdx, arr) => cIdx > 0 && cIdx < arr.length - 1);
        tableRows.push(cols);
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      // Headings
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={idx} className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 mb-4">
            {line.replace('# ', '')}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        const rawText = line.replace('## ', '').trim();
        const headingId = slugifyHeading(rawText, idx);
        elements.push(
          <h2
            key={idx}
            id={headingId}
            onClick={() => scrollToSection(headingId)}
            className="group scroll-mt-6 text-xl sm:text-2xl font-bold text-slate-100 tracking-tight mt-8 mb-3 pb-2 border-b border-slate-800 flex items-center gap-2 cursor-pointer"
          >
            <span>{renderInlineMarkdown(rawText)}</span>
            <Hash className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-[#EB6658] transition" />
          </h2>
        );
      } else if (line.startsWith('### ')) {
        const rawText = line.replace('### ', '').trim();
        const headingId = slugifyHeading(rawText, idx);
        elements.push(
          <h3
            key={idx}
            id={headingId}
            onClick={() => scrollToSection(headingId)}
            className="group scroll-mt-6 text-base sm:text-lg font-semibold text-slate-200 mt-6 mb-2 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{renderInlineMarkdown(rawText)}</span>
            <Hash className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-[#EB6658] transition" />
          </h3>
        );
      } else if (line.startsWith('---')) {
        elements.push(<hr key={idx} className="my-6 border-slate-800" />);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points with bold support
        const contentStr = line.substring(2);
        elements.push(
          <li key={idx} className="ml-4 list-disc text-sm text-slate-300 my-1 leading-relaxed">
            {renderInlineMarkdown(contentStr)}
          </li>
        );
      } else if (/^\d+\.\s/.test(line)) {
        // Numbered list
        const match = line.match(/^(\d+)\.\s(.*)/);
        if (match) {
          elements.push(
            <div key={idx} className="flex gap-2 text-sm text-slate-300 my-1.5 leading-relaxed">
              <span className="font-mono text-[#EB6658] font-bold text-xs mt-0.5">{match[1]}.</span>
              <span>{renderInlineMarkdown(match[2])}</span>
            </div>
          );
        }
      } else if (line.trim() !== '') {
        elements.push(
          <p key={idx} className="text-sm text-slate-300 my-3 leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        );
      }
    });

    if (inTable) flushTable(lines.length);
    if (inCodeBlock) flushCode(lines.length);

    return elements;
  };

  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Basic bold and code backticks rendering
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-[#EB6658] font-mono text-xs border border-slate-700/60">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const activeHeadingObj = tocHeadings.find((h) => h.id === activeHeadingId) || tocHeadings[0];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0B0F19]">
      {/* Scroll Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-[2px] z-50 pointer-events-none bg-slate-800/30">
        <div 
          className="h-full bg-gradient-to-r from-[#EB6658] to-[#C94C3C] transition-all duration-150 ease-out shadow-[0_0_8px_rgba(235,102,88,0.4)]" 
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Scrollable Article Column */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-10 py-8 scroll-smooth"
        >
          {/* Inline Article Breadcrumb Navigation */}
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <button
                onClick={() => onNavigatePage('introduction')}
                className="hover:text-white transition"
              >
                Docs
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <button
                onClick={() => {
                  const firstInCategory = allPages.find((p) => p.category === page.category);
                  if (firstInCategory) onNavigatePage(firstInCategory.id);
                }}
                className="text-slate-300 hover:text-white transition"
              >
                {page.category}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-[#EB6658] font-semibold">{page.title}</span>
            </div>

            {/* Mobile / Tablet Floating 'On This Page' Selector */}
            {tocHeadings.length > 0 && (
              <div className="relative xl:hidden">
                <button
                  onClick={() => setIsMobileTocOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition"
                >
                  <ListFilter className="w-3.5 h-3.5 text-[#EB6658]" />
                  <span className="font-medium">On this page</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                      isMobileTocOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isMobileTocOpen && (
                  <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-40 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 pb-1.5 border-b border-slate-800">
                      On This Page ({tocHeadings.length})
                    </div>
                    {tocHeadings.map((heading) => {
                      const isActive = heading.id === activeHeadingId;
                      return (
                        <button
                          key={`mobile-toc-${heading.id}`}
                          onClick={() => scrollToSection(heading.id)}
                          className={`w-full text-left py-1.5 px-2.5 rounded-lg text-xs transition flex items-center gap-2 ${
                            heading.level === 3 ? 'pl-6 text-[11px]' : 'font-medium'
                          } ${
                            isActive
                              ? 'bg-[#EB6658]/15 text-[#EB6658] font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <span className="truncate">{heading.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                {page.title}
              </h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {page.description}
              </p>
              {page.tags && page.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {page.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/50"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions: Bookmark & Studio Playground */}
            <div className="self-start sm:self-center flex items-center gap-2 shrink-0">
              {onToggleBookmark && (
                <button
                  onClick={() => onToggleBookmark(page.id)}
                  title={isBookmarked ? 'Remove from saved bookmarks' : 'Save page to bookmarks'}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    isBookmarked
                      ? 'bg-[#EB6658]/15 text-[#EB6658] border-[#EB6658]/40 hover:bg-[#EB6658]/25'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-[#EB6658] text-[#EB6658]' : ''}`} />
                  <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>
              )}
              <button
                onClick={onOpenStudio}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#EB6658] to-[#C94C3C] text-white text-xs font-semibold hover:shadow-lg hover:shadow-[#EB6658]/20 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Interactive Playground</span>
              </button>
            </div>
          </div>

          {/* Document Content */}
          <div className="prose prose-invert max-w-none text-slate-300">
            {renderFormattedContent(page.content)}
          </div>

          {/* Code Snippets Section if present */}
          {page.codeSnippets && page.codeSnippets.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3
                id="section-interactive-code-examples"
                onClick={() => scrollToSection('section-interactive-code-examples')}
                className="group scroll-mt-6 text-base font-semibold text-white flex items-center gap-2 cursor-pointer"
              >
                <Code2 className="w-4 h-4 text-[#EB6658]" />
                <span>Interactive Code Examples</span>
                <Hash className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-[#EB6658] transition" />
              </h3>

              <div className="space-y-4">
                {page.codeSnippets.map((snippet, sIdx) => {
                  const snippetId = `snippet-${sIdx}`;
                  return (
                    <div
                      key={snippetId}
                      className="rounded-xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-sm"
                    >
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{snippet.title}</span>
                          <span className="font-mono text-[10px] uppercase text-[#EB6658] bg-[#EB6658]/10 px-1.5 py-0.5 rounded border border-[#EB6658]/20">
                            {snippet.language}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(snippet.code, snippetId)}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                        >
                          {copiedSnippet === snippetId ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy code</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed bg-[#0d131f]">
                        <code>{snippet.code}</code>
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination Navigation */}
          <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between">
            {prevPage ? (
              <button
                onClick={() => onNavigatePage(prevPage.id)}
                className="flex flex-col items-start gap-1 p-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-800/40 transition text-left max-w-[45%]"
              >
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Previous</span>
                <span className="text-xs font-medium text-slate-200 truncate">{prevPage.title}</span>
              </button>
            ) : <div />}

            {nextPage ? (
              <button
                onClick={() => onNavigatePage(nextPage.id)}
                className="flex flex-col items-end gap-1 p-3 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-800/40 transition text-right max-w-[45%]"
              >
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Next</span>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-200 truncate">
                  <span>{nextPage.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#EB6658]" />
                </div>
              </button>
            ) : <div />}
          </div>
        </div>

        {/* Dynamic 'On This Page' Right Sidebar */}
        {tocHeadings.length > 0 && (
          <aside
            aria-label="On this page"
            className="hidden xl:flex xl:flex-col w-64 shrink-0 border-l border-slate-800/80 bg-[#0B0F19]/60 p-5 overflow-y-auto select-none"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                <ListFilter className="w-3.5 h-3.5 text-[#EB6658]" />
                <span>On This Page</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                {tocHeadings.length}
              </span>
            </div>

            <nav className="relative border-l border-slate-800/80 space-y-0.5">
              {tocHeadings.map((heading) => {
                const isActive = heading.id === activeHeadingId;
                return (
                  <button
                    key={heading.id}
                    onClick={() => scrollToSection(heading.id)}
                    title={heading.text}
                    className={`w-full text-left py-1.5 pr-2 transition-all duration-150 block border-l-2 -ml-[1px] ${
                      heading.level === 3 ? 'pl-6 text-[11px]' : 'pl-3 text-xs'
                    } ${
                      isActive
                        ? 'border-[#EB6658] text-[#EB6658] font-semibold bg-[#EB6658]/10 rounded-r-md'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="line-clamp-2 leading-snug">{heading.text}</span>
                  </button>
                );
              })}
            </nav>

            {/* Reading Progress & Back to Top Footer */}
            <div className="mt-6 pt-4 border-t border-slate-800/70 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Reading progress</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {Math.round(scrollProgress)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#EB6658] to-[#C94C3C] transition-all duration-150"
                  style={{ width: `${scrollProgress}%` }}
                />
              </div>

              {activeHeadingObj && (
                <div className="text-[10px] text-slate-500 truncate">
                  Current: <span className="text-slate-300">{activeHeadingObj.text}</span>
                </div>
              )}

              {scrollProgress > 5 && (
                <button
                  onClick={scrollToTop}
                  className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
                >
                  <ArrowUp className="w-3 h-3 text-[#EB6658]" />
                  <span>Back to top</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

