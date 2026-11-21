import { useState } from 'react';
import { Clock, History, Search, Receipt, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Product, StoreCategory } from '../types';
import type { LocalOrderSnapshot, VisitorLogEntry, VisitorMeta } from '../lib/visitorHistory';
import { BrandLogo } from './BrandLogo';
import { ProductVisual } from './ProductVisual';
import { useTranslation } from '../lib/i18n.tsx';

interface FooterProps {
  categories: StoreCategory[];
  onSelectCategory: (cat: string) => void;
  onOpenTracker: () => void;
  recentlyViewed: Product[];
  onSelectProduct: (product: Product) => void;
  onClearRecentlyViewed?: () => void;
  products?: Product[];
  visitorMeta?: VisitorMeta;
  visitorLog?: VisitorLogEntry[];
  recentSearches?: string[];
  localOrders?: LocalOrderSnapshot[];
  onSelectRecentSearch?: (query: string) => void;
  onQuickTrackOrder?: (order: LocalOrderSnapshot) => void;
  onClearVisitorLog?: () => void;
  storeLogo?: string;
  storeName?: string;
}

export function Footer({
  categories,
  onSelectCategory,
  onOpenTracker,
  recentlyViewed,
  onSelectProduct,
  onClearRecentlyViewed,
  products = [],
  visitorMeta,
  visitorLog = [],
  recentSearches = [],
  localOrders = [],
  onSelectRecentSearch,
  onQuickTrackOrder,
  onClearVisitorLog,
  storeLogo,
  storeName,
}: FooterProps) {
  const { t, translateCategory } = useTranslation();
  const [logExpanded, setLogExpanded] = useState(false);

  const handleEntryClick = (entry: VisitorLogEntry) => {
    if (entry.productId) {
      const found = products.find((p) => p.id === entry.productId);
      if (found) {
        onSelectProduct(found);
        return;
      }
    }
    if (entry.searchQuery && onSelectRecentSearch) {
      onSelectRecentSearch(entry.searchQuery);
      return;
    }
    if (entry.category) {
      onSelectCategory(entry.category);
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="border-t border-[#E6ECF4] bg-[#0F1B2D] text-white">
      {/* Recently Viewed (Last 5 Products Tracked Locally) */}
      {recentlyViewed.length > 0 && (
        <div className="border-b border-white/10 bg-[#0B1524]">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#60B2FF]">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('footer.recentlyViewed')} ({Math.min(5, recentlyViewed.length)})</span>
              </div>
              {onClearRecentlyViewed && (
                <button
                  type="button"
                  onClick={onClearRecentlyViewed}
                  className="text-[11px] font-medium text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
                >
                  Clear recent items
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
              {recentlyViewed.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectProduct(item)}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#132238] p-2 text-left transition-all hover:border-[#3C9BF0]/60 hover:bg-[#182B47] cursor-pointer"
                >
                  <div className="h-11 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white">
                    <ProductVisual
                      visualKey={item.visualKey}
                      imageUrl={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[11px] font-semibold text-white group-hover:text-[#60B2FF]">
                      {item.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#94A3B8] tabular-nums">
                      <span>${item.price.toFixed(2)}</span>
                      <span aria-hidden="true" className="text-white/25">·</span>
                      <span className="font-sans text-[10px] font-normal text-[#64748B] truncate">
                        {item.category}
                      </span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Browser History & Activity Log Band */}
      {(visitorMeta || visitorLog.length > 0 || recentSearches.length > 0 || localOrders.length > 0) && (
        <div className="border-b border-white/10 bg-[#0A1320]">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#60B2FF]">
                  <History className="h-3.5 w-3.5" />
                  <span>{t('footer.browserHistory')}</span>
                </span>
                {visitorMeta && (
                  <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                    Visit #{visitorMeta.visitCount} · Dept: {visitorMeta.lastCategory}
                  </span>
                )}
                {recentSearches.length > 0 && onSelectRecentSearch && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Search className="h-3 w-3 text-[#64748B]" />
                    {recentSearches.slice(0, 4).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onSelectRecentSearch(q)}
                        className="rounded-md border border-white/15 bg-[#132238] px-2 py-0.5 text-[11px] text-[#CBD5E1] hover:border-[#3C9BF0] hover:text-white transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {localOrders.length > 0 && onQuickTrackOrder && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Receipt className="h-3 w-3 text-[#64748B]" />
                    {localOrders.slice(0, 3).map((ord) => (
                      <button
                        key={ord.orderNumber}
                        type="button"
                        onClick={() => onQuickTrackOrder(ord)}
                        className="rounded-md border border-[#3C9BF0]/30 bg-[#132238] px-2 py-0.5 font-mono text-[11px] text-[#60B2FF] hover:border-[#60B2FF] hover:text-white transition-colors cursor-pointer"
                      >
                        {ord.orderNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                {visitorLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLogExpanded((v) => !v)}
                    className="inline-flex items-center gap-1 font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
                  >
                    <span>
                      {logExpanded ? 'Hide Activity Log' : `View Activity Log (${visitorLog.length})`}
                    </span>
                    {logExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {visitorLog.length > 0 && onClearVisitorLog && (
                  <button
                    type="button"
                    onClick={onClearVisitorLog}
                    className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#FCA5A5] transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t('footer.clearLog')}</span>
                  </button>
                )}
              </div>
            </div>

            {logExpanded && visitorLog.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0F1B2D] divide-y divide-white/5">
                {visitorLog.slice(0, 25).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleEntryClick(entry)}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-xs hover:bg-[#132238] transition-colors cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-16 shrink-0 rounded border border-white/10 bg-[#132238] px-1.5 py-0.5 text-center font-mono text-[10px] uppercase text-[#60B2FF]">
                        {entry.kind}
                      </span>
                      <span className="truncate font-medium text-white">{entry.summary}</span>
                      {entry.detail && (
                        <span className="hidden truncate text-[11px] text-[#94A3B8] sm:inline">
                          {entry.detail}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-[#64748B] tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:grid-cols-12 lg:px-8">
        <div className="md:col-span-5">
          <BrandLogo variant="light" showWordmark={true} logoUrl={storeLogo} storeName={storeName} />
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-[#94A3B8]">
            {t('footer.tagline')}
          </p>
        </div>

        <div className="md:col-span-3 space-y-2 text-xs">
          <p className="font-semibold uppercase tracking-wider text-[#94A3B8]">Categories</p>
          <ul className="space-y-1.5 text-[#CBD5E1]">
            {categories.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(category.name);
                    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hover:text-[#3C9BF0] transition-colors cursor-pointer"
                >
                  {translateCategory(category.name)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-4 space-y-2 text-xs">
          <p className="font-semibold uppercase tracking-wider text-[#94A3B8]">{t('footer.support')}</p>
          <ul className="space-y-1.5 text-[#CBD5E1]">
            <li>
              <button
                type="button"
                onClick={onOpenTracker}
                className="hover:text-[#3C9BF0] transition-colors cursor-pointer"
              >
                {t('nav.trackOrder')}
              </button>
            </li>
            <li>
              <a
                href="https://wa.me/96171972495"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#3C9BF0] transition-colors"
              >
                WhatsApp Concierge (+961 71 972 495)
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs text-[#94A3B8] sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Sam Brand Store. {t('footer.rights')}</span>
          <span>{t('footer.techStack')}</span>
        </div>
      </div>
    </footer>
  );
}

