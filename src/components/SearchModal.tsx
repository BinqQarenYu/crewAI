import React, { useState, useEffect } from 'react';
import { DocPage } from '../types';
import { Search, X, ChevronRight, FileText, Wrench } from 'lucide-react';
import { TOOLS_CATALOG } from '../data/toolsCatalog';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPages: DocPage[];
  onSelectPage: (pageId: string) => void;
  onOpenTools: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  allPages,
  onSelectPage,
  onOpenTools
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchedPages = allPages.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const matchedTools = TOOLS_CATALOG.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase()) ||
      t.categoryLabel.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0d131f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            type="text"
            placeholder="Search documentation, guides, tools, and concepts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {matchedPages.length === 0 && matchedTools.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No results found for "{query}". Try searching for "agents", "flows", "tools", or "memory".
            </div>
          ) : (
            <>
              {matchedPages.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 block mb-1">
                    Documentation & Guides
                  </span>
                  <div className="space-y-1">
                    {matchedPages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => {
                          onSelectPage(page.id);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-slate-800/60 transition group"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-slate-500 group-hover:text-[#EB6658] transition" />
                          <div>
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                              {page.title}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {page.description}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded bg-slate-900">
                          {page.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchedTools.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 block mb-1">
                    Tools Ecosystem
                  </span>
                  <div className="space-y-1">
                    {matchedTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          onOpenTools();
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-slate-800/60 transition group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Wrench className="w-4 h-4 text-[#EB6658]" />
                          <div>
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                              {tool.name}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {tool.description}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#EB6658] bg-[#EB6658]/10 px-2 py-0.5 rounded font-mono">
                          {tool.categoryLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900/60 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Navigation: <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">↑</kbd> <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">↓</kbd></span>
            <span>Select: <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">Enter</kbd></span>
          </div>
          <span>Close: <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400">Esc</kbd></span>
        </div>
      </div>
    </div>
  );
};
