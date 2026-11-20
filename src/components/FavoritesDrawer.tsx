import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Heart,
  ShoppingBag,
  Trash2,
  GitCompare,
  ArrowRight,
  Share2,
  Copy,
  Check,
  BookmarkPlus,
  MessageCircle,
} from 'lucide-react';
import type { Product } from '../types';
import { ProductVisual } from './ProductVisual';
import { useTranslation } from '../lib/i18n';

interface FavoritesDrawerProps {
  open: boolean;
  onClose: () => void;
  items: Product[];
  sharedItems?: Product[];
  compareIds: string[];
  onToggleFavorite: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
  onInspectProduct: (product: Product) => void;
  onMoveToCart: (product: Product) => void;
  onMoveAllToCart: () => void;
  onSaveSharedToFavorites?: () => void;
  onDismissShared?: () => void;
  onGenerateShareUrl?: () => string;
}

export function FavoritesDrawer({
  open,
  onClose,
  items,
  sharedItems = [],
  compareIds,
  onToggleFavorite,
  onToggleCompare,
  onInspectProduct,
  onMoveToCart,
  onMoveAllToCart,
  onSaveSharedToFavorites,
  onDismissShared,
  onGenerateShareUrl,
}: FavoritesDrawerProps) {
  const { t, isRtl } = useTranslation();
  const [activeList, setActiveList] = useState<'mine' | 'shared'>('mine');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (sharedItems.length > 0) {
      setActiveList('shared');
    } else {
      setActiveList('mine');
    }
  }, [sharedItems.length]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    } else if (items.length === 0) {
      setShareUrl(null);
    }
  }, [open, items.length]);

  const showingShared = activeList === 'shared' && sharedItems.length > 0;
  const visibleItems = showingShared ? sharedItems : items;
  const inStockCount = visibleItems.filter((p) => p.stock > 0).length;

  const handleCopyShareLink = async () => {
    const generated =
      onGenerateShareUrl?.() ||
      `${window.location.origin}/?wishlist=${items.map((i) => i.id).join(',')}`;
    setShareUrl(generated);
    try {
      await navigator.clipboard.writeText(generated);
    } catch {
      // Fallback handled by visible URL input below
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F1B2D]/45 backdrop-blur-xs"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#E6ECF4] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E6ECF4] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Heart className="h-5 w-5 text-[#EF4444] fill-[#EF4444]" />
                <div>
                  <h2 className="font-display text-base font-bold text-[#0F1B2D]">
                    {showingShared
                      ? `Shared Wishlist (${sharedItems.length})`
                      : `Saved Wishlist (${items.length})`}
                  </h2>
                  <p className="text-[11px] text-[#6B7A8D]">
                    {showingShared
                      ? 'Sent via shareable favorites link'
                      : 'Synced locally · Generate a link to share with family or friends'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close wishlist"
                className="rounded-lg p-1.5 text-[#475569] hover:bg-[#F7FAFD] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sharedItems.length > 0 && (
              <div className="border-b border-[#E6ECF4] bg-[#F7FAFD] px-5 py-3 space-y-2.5">
                <div className="flex items-center gap-1 rounded-lg border border-[#E6ECF4] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setActiveList('shared')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      activeList === 'shared'
                        ? 'bg-[#0F1B2D] text-white'
                        : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                    }`}
                  >
                    Shared With You ({sharedItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveList('mine')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      activeList === 'mine'
                        ? 'bg-[#0F1B2D] text-white'
                        : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                    }`}
                  >
                    My Favorites ({items.length})
                  </button>
                </div>

                {showingShared && (
                  <div className="flex items-center gap-2">
                    {onSaveSharedToFavorites && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveSharedToFavorites();
                          setActiveList('mine');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1180E1] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        <span>{t('fav.saveAll')}</span>
                      </button>
                    )}
                    {onDismissShared && (
                      <button
                        type="button"
                        onClick={onDismissShared}
                        className="rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs font-semibold text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5">
              {visibleItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Heart className="h-10 w-10 text-[#CBD5E1]" />
                  <p className="mt-3 font-display text-base font-semibold text-[#0F1B2D]">
                    {t('fav.empty')}
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-[#6B7A8D]">
                    {t('fav.emptyDesc')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E6ECF4]">
                  {visibleItems.map((item) => {
                    const isCompared = compareIds.includes(item.id);
                    const outOfStock = item.stock <= 0;
                    const isAlreadySaved = items.some((mine) => mine.id === item.id);
                    return (
                      <div key={item.id} className="flex gap-3 py-3.5 first:pt-0">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onInspectProduct(item);
                          }}
                          className="h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] cursor-pointer"
                        >
                          <ProductVisual
                            visualKey={item.visualKey}
                            imageUrl={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full"
                          />
                        </button>

                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onInspectProduct(item);
                                }}
                                className="truncate text-left font-display text-xs font-bold text-[#0F1B2D] hover:text-[#1180E1] cursor-pointer"
                              >
                                {item.name}
                              </button>
                              {showingShared ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isAlreadySaved) onToggleFavorite(item.id);
                                  }}
                                  title={isAlreadySaved ? 'Already in your favorites' : 'Save to my favorites'}
                                  className={`shrink-0 text-xs font-semibold cursor-pointer ${
                                    isAlreadySaved
                                      ? 'text-[#EF4444]'
                                      : 'text-[#6B7A8D] hover:text-[#EF4444]'
                                  }`}
                                >
                                  <Heart
                                    className={`h-3.5 w-3.5 ${isAlreadySaved ? 'fill-[#EF4444]' : ''}`}
                                  />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onToggleFavorite(item.id)}
                                  aria-label={`Remove ${item.name} from wishlist`}
                                  className="text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6B7A8D]">
                              <span>{item.category}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  outOfStock ? 'font-semibold text-[#DC2626]' : 'text-[#16A34A]'
                                }
                              >
                                {outOfStock ? 'Out of stock' : `${item.stock} available`}
                              </span>
                            </p>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="font-mono text-xs font-bold text-[#0F1B2D] tabular-nums">
                              ${item.price.toFixed(2)}
                              {item.compareAtPrice && (
                                <span className="ml-1.5 text-[10px] font-normal text-[#94A3B8] line-through">
                                  ${item.compareAtPrice.toFixed(2)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onToggleCompare(item.id)}
                                title={isCompared ? 'Remove from compare' : 'Add to compare'}
                                className={`rounded-lg border p-1.5 transition-colors cursor-pointer ${
                                  isCompared
                                    ? 'border-[#1180E1] bg-[#EFF6FF] text-[#1180E1]'
                                    : 'border-[#D4DFEE] text-[#6B7A8D] hover:text-[#1180E1]'
                                }`}
                              >
                                <GitCompare className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={() => onMoveToCart(item)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#0F1B2D] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1180E1] disabled:opacity-40 cursor-pointer"
                              >
                                <ShoppingBag className="h-3 w-3" />
                                <span>{outOfStock ? 'Sold Out' : 'Add to Bag'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {visibleItems.length > 0 && (
              <div className="border-t border-[#E6ECF4] bg-[#F7FAFD] p-4 space-y-2.5">
                {!showingShared && items.length > 0 && (
                  <div className="rounded-xl border border-[#D4DFEE] bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F1B2D]">
                        <Share2 className="h-3.5 w-3.5 text-[#1180E1]" />
                        <span>{t('fav.shareLink')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                          copied
                            ? 'bg-[#16A34A] text-white'
                            : 'bg-[#0F1B2D] text-white hover:bg-[#1180E1]'
                        }`}
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copied ? 'Copied URL' : 'Copy Share Link'}</span>
                      </button>
                    </div>

                    {shareUrl && (
                      <div className="flex items-center gap-1.5">
                        <input
                          readOnly
                          value={shareUrl}
                          onFocus={(e) => e.currentTarget.select()}
                          aria-label="Shareable wishlist URL"
                          className="flex-1 rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] px-2.5 py-1.5 font-mono text-[11px] text-[#475569] focus:outline-none"
                        />
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Check out my Sam Brand Store favorites list: ${shareUrl}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send via WhatsApp"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {!showingShared && (
                  <button
                    type="button"
                    disabled={inStockCount === 0}
                    onClick={onMoveAllToCart}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1180E1] py-2.5 text-xs font-semibold text-white hover:bg-[#0D6BC0] disabled:opacity-45 cursor-pointer"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>{t('fav.moveInStock')} ({inStockCount})</span>
                    <ArrowRight className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

