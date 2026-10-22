import React, { useEffect } from 'react';

interface CardMinMaxButtonsProps {
  isMinimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  title?: string;
  className?: string;
}

/**
 * Clean, single stateful toggle button: shows (-) when expanded to minimize, and (+) when minimized to expand.
 */
export const CardMinMaxButtons: React.FC<CardMinMaxButtonsProps> = ({
  isMinimized,
  onMinimize,
  onExpand,
  title = 'Card',
  className = ''
}) => {
  return (
    <div
      data-card-minmax-react="true"
      className={`inline-flex items-center shrink-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={isMinimized ? onExpand : onMinimize}
        aria-label={isMinimized ? `Expand ${title}` : `Minimize ${title}`}
        title={isMinimized ? `Expand ${title} (+)` : `Minimize ${title} (-)`}
        className={`px-2 h-6 rounded-lg text-xs font-mono font-extrabold transition flex items-center justify-center cursor-pointer leading-none shadow-sm ${
          isMinimized
            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
            : 'bg-slate-950/90 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700/90 hover:border-amber-500/40'
        }`}
      >
        {isMinimized ? '(+)' : '(-)'}
      </button>
    </div>
  );
};

/**
 * Global enhancer that ensures top-level cards across all tabs (Documentation, Crew Studio,
 * Graphs, Flow & Graphify, GitHub Hub, Tools Catalog, Observability) have a single
 * stateful (-) / (+) toggle button at their top-right corner without duplicating React-managed controls.
 */
export const GlobalCardMinMaxEnhancer: React.FC = () => {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let isMutating = false;

    const updateBarButtonState = (bar: Element, isMinimized: boolean) => {
      const toggleBtn = bar.querySelector('[data-action="toggle"]') as HTMLButtonElement | null;
      if (!toggleBtn) return;
      toggleBtn.textContent = isMinimized ? '(+)' : '(-)';
      toggleBtn.title = isMinimized ? 'Expand card (+)' : 'Minimize card (-)';
      toggleBtn.setAttribute('aria-label', isMinimized ? 'Expand card' : 'Minimize card');
      toggleBtn.className = isMinimized
        ? 'px-2 h-6 rounded-lg text-xs font-mono font-extrabold transition flex items-center justify-center cursor-pointer leading-none shadow-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
        : 'px-2 h-6 rounded-lg text-xs font-mono font-extrabold transition flex items-center justify-center cursor-pointer leading-none shadow-sm bg-slate-950/90 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700/90 hover:border-amber-500/40';
    };

    const collapseCardElement = (card: HTMLElement, minimize: boolean) => {
      isMutating = true;
      try {
        card.setAttribute('data-universal-minimized', minimize ? 'true' : 'false');

        const children = Array.from(card.children) as HTMLElement[];
        const headerEl = children.find(
          (ch) => !ch.hasAttribute('data-universal-minmax-bar') && !ch.hasAttribute('data-universal-collapsed-note')
        );

        children.forEach((child) => {
          if (
            child.hasAttribute('data-universal-minmax-bar') ||
            child.hasAttribute('data-universal-collapsed-note')
          ) {
            return;
          }
          if (child === headerEl) {
            return;
          }
          if (minimize) {
            if (!child.hasAttribute('data-prev-display')) {
              child.setAttribute('data-prev-display', child.style.display || '');
            }
            child.style.display = 'none';
          } else {
            const prev = child.getAttribute('data-prev-display');
            child.style.display = prev !== null ? prev : '';
            child.removeAttribute('data-prev-display');
          }
        });

        if (
          children.filter(
            (c) => !c.hasAttribute('data-universal-minmax-bar') && !c.hasAttribute('data-universal-collapsed-note')
          ).length <= 1 &&
          headerEl
        ) {
          const innerChildren = Array.from(headerEl.children) as HTMLElement[];
          if (innerChildren.length > 1) {
            innerChildren.slice(1).forEach((ic) => {
              if (minimize) {
                if (!ic.hasAttribute('data-prev-display')) {
                  ic.setAttribute('data-prev-display', ic.style.display || '');
                }
                ic.style.display = 'none';
              } else {
                const prev = ic.getAttribute('data-prev-display');
                ic.style.display = prev !== null ? prev : '';
                ic.removeAttribute('data-prev-display');
              }
            });
          }
        }

        const bar = card.querySelector('[data-universal-minmax-bar="true"]');
        if (bar) {
          updateBarButtonState(bar, minimize);
        }
      } finally {
        isMutating = false;
      }
    };

    const enhanceCardsInDOM = () => {
      if (isMutating || document.hidden) return;
      const mainEl = document.querySelector('main');
      if (!mainEl) return;

      isMutating = true;
      try {
        // Only query cards that have not been checked yet
        const candidates = mainEl.querySelectorAll<HTMLElement>(
          'div.rounded-2xl.border:not([data-universal-card-checked]), div.rounded-3xl.border:not([data-universal-card-checked]), section.rounded-2xl.border:not([data-universal-card-checked])'
        );

        candidates.forEach((card) => {
          if (card.querySelector('[data-card-minmax-react="true"]')) {
            const oldBar = card.querySelector(':scope > [data-universal-minmax-bar="true"]');
            if (oldBar) oldBar.remove();
            card.setAttribute('data-universal-card-checked', 'react-managed');
            return;
          }

          if (
            card.parentElement?.closest(
              '[data-universal-card-checked="react-managed"], [data-universal-card-checked="enhanced"]'
            )
          ) {
            card.setAttribute('data-universal-card-checked', 'nested-skip');
            return;
          }

          // Pure class & DOM check — no getBoundingClientRect() layout thrashing
          const cls = card.className || '';
          const hasCardPadding = /\bp-[456]\b|\bpx-[456]\b/.test(cls);
          const hasHeading = Boolean(card.querySelector('h1, h2, h3, h4'));
          if (!hasCardPadding || !hasHeading) {
            card.setAttribute('data-universal-card-checked', 'skip');
            return;
          }

          card.setAttribute('data-universal-card-checked', 'enhanced');
          if (!card.classList.contains('relative') && !card.classList.contains('sticky') && !card.classList.contains('fixed')) {
            card.classList.add('relative');
          }

          const bar = document.createElement('div');
          bar.setAttribute('data-universal-minmax-bar', 'true');
          bar.className = 'inline-flex items-center z-10';
          bar.style.position = 'absolute';
          bar.style.top = '10px';
          bar.style.right = '12px';

          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.setAttribute('data-action', 'toggle');

          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentlyMinimized = card.getAttribute('data-universal-minimized') === 'true';
            collapseCardElement(card, !currentlyMinimized);
          });

          bar.appendChild(toggleBtn);
          updateBarButtonState(bar, false);
          card.appendChild(bar);
        });
      } finally {
        isMutating = false;
      }
    };

    const scheduleEnhance = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(enhanceCardsInDOM, 350);
    };

    scheduleEnhance();

    observer = new MutationObserver((mutations) => {
      if (isMutating || document.hidden) return;
      // Only schedule if element nodes were actually added (ignore text/timer updates)
      const hasAddedElements = mutations.some((m) =>
        Array.from(m.addedNodes).some((n) => n.nodeType === 1 && !(n as HTMLElement).hasAttribute?.('data-universal-minmax-bar'))
      );
      if (hasAddedElements) {
        scheduleEnhance();
      }
    });

    const mainTarget = document.querySelector('main') || document.body;
    observer.observe(mainTarget, {
      childList: true,
      subtree: true
    });

    const handleGlobalToggleAll = (e: Event) => {
      const detail = (e as CustomEvent<{ minimized: boolean }>).detail;
      if (!detail || typeof detail.minimized !== 'boolean') return;
      const allEnhanced = document.querySelectorAll<HTMLElement>('[data-universal-card-checked="enhanced"]');
      allEnhanced.forEach((card) => {
        collapseCardElement(card, detail.minimized);
      });
    };

    window.addEventListener('crewai:toggle-all-cards', handleGlobalToggleAll);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer?.disconnect();
      window.removeEventListener('crewai:toggle-all-cards', handleGlobalToggleAll);
    };
  }, []);

  return null;
};

