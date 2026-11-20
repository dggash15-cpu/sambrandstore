import { AnimatePresence, motion } from 'motion/react';
import { X, Plus, Trash2, GitCompare, Check, ShieldCheck, Star } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../types';
import { ProductVisual } from './ProductVisual';
import { useTranslation } from '../lib/i18n';

interface ProductCompareModalProps {
  open: boolean;
  products: Product[];
  onClose: () => void;
  onRemoveProduct: (productId: string) => void;
  onClearAll: () => void;
  onAddToCart: (product: Product, variant?: string) => void;
  onInspectProduct: (product: Product) => void;
}

export function ProductCompareModal({
  open,
  products,
  onClose,
  onRemoveProduct,
  onClearAll,
  onAddToCart,
  onInspectProduct,
}: ProductCompareModalProps) {
  const { t } = useTranslation();
  const [addedId, setAddedId] = useState<string | null>(null);

  // Collect all unique technical specification keys across the selected products
  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.specs || {})))
  );

  const lowestPrice = products.length > 0 ? Math.min(...products.map((p) => p.price)) : 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#08101C]/65 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E6ECF4] bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6ECF4] bg-[#0F1B2D] px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <GitCompare className="h-5 w-5 text-[#3C9BF0]" />
                <div>
                  <h2 className="font-display text-base font-bold tracking-tight">
                    Side-by-Side Hardware Comparison ({products.length}/3)
                  </h2>
                  <p className="text-[11px] text-[#94A3B8]">
                    Compare technical specs, pricing, savings, and live stock availability
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      onClose();
                    }}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#CBD5E1] hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    {t('fav.clear')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close comparison"
                  className="rounded-lg p-1.5 text-[#CBD5E1] hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              {products.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="font-display text-base font-semibold text-[#0F1B2D]">
                    Select up to 3 items from the catalog to compare
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                  >
                    {t('cart.browseGear')}
                  </button>
                </div>
              ) : (
                <div className="min-w-[540px]">
                  {/* Product Overview Columns */}
                  <div
                    className="grid gap-3 border-b border-[#E6ECF4] pb-5"
                    style={{
                      gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <div className="flex flex-col justify-end pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A8D]">
                        Selected Models
                      </span>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        Best value highlighted automatically
                      </p>
                    </div>

                    {products.map((p) => {
                      const isLowest = products.length > 1 && p.price === lowestPrice;
                      const discountPct =
                        p.compareAtPrice && p.compareAtPrice > p.price
                          ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
                          : null;

                      return (
                        <div
                          key={p.id}
                          className={`relative flex flex-col justify-between rounded-xl border p-3.5 ${
                            isLowest
                              ? 'border-[#1180E1]/50 bg-[#F7FAFD]'
                              : 'border-[#E6ECF4] bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onRemoveProduct(p.id)}
                            aria-label={`Remove ${p.name} from comparison`}
                            className="absolute right-2.5 top-2.5 z-10 rounded-lg border border-[#E6ECF4] bg-white p-1.5 text-[#6B7A8D] hover:border-[#FECACA] hover:text-[#DC2626] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onInspectProduct(p);
                              }}
                              className="block w-full aspect-[4/3] overflow-hidden rounded-lg border border-[#E6ECF4] bg-white cursor-pointer"
                            >
                              <ProductVisual
                                visualKey={p.visualKey}
                                imageUrl={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full"
                              />
                            </button>

                            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-[#1180E1]">
                              {p.brand} · {p.category}
                            </p>
                            <h3 className="mt-0.5 font-display text-sm font-bold text-[#0F1B2D] line-clamp-2">
                              {p.name}
                            </h3>
                          </div>

                          <div className="mt-3 pt-3 border-t border-[#E6ECF4]">
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono text-lg font-bold text-[#0F1B2D] tabular-nums">
                                ${p.price.toFixed(2)}
                              </span>
                              {p.compareAtPrice && (
                                <span className="font-mono text-xs text-[#94A3B8] line-through tabular-nums">
                                  ${p.compareAtPrice.toFixed(2)}
                                </span>
                              )}
                              {discountPct && (
                                <span className="font-mono text-[11px] font-bold text-[#16A34A]">
                                  -{discountPct}%
                                </span>
                              )}
                            </div>

                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={p.stock <= 0}
                                onClick={() => {
                                  onAddToCart(p, p.variants[0] || 'Standard');
                                  setAddedId(p.id);
                                  setTimeout(() => {
                                    setAddedId((curr) => (curr === p.id ? null : curr));
                                  }, 1100);
                                }}
                                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                                  addedId === p.id
                                    ? 'bg-[#16A34A] text-white'
                                    : 'bg-[#0F1B2D] text-white hover:bg-[#1180E1]'
                                }`}
                              >
                                {addedId === p.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>{t('compare.added')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>{p.stock > 0 ? t('catalog.addToCart') : t('catalog.outOfStock')}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Comparative Rows: Rating, Availability, Variants, and Technical Specs */}
                  <div className="divide-y divide-[#F1F5F9] text-xs">
                    {/* Customer Rating */}
                    <div
                      className="grid items-center gap-3 py-3"
                      style={{
                        gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <span className="font-semibold text-[#6B7A8D]">{t('compare.customerRating')}</span>
                      {products.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                          <Star
                            className={`h-3.5 w-3.5 ${
                              (p.reviewCount || 0) > 0
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-[#CBD5E1]'
                            }`}
                          />
                          <span className="font-bold text-[#0F1B2D]">
                            {(p.reviewCount || 0) > 0 ? (p.averageRating || 0).toFixed(1) : 'No ratings'}
                          </span>
                          {(p.reviewCount || 0) > 0 && (
                            <span className="font-sans text-[11px] text-[#6B7A8D]">
                              ({p.reviewCount})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Availability */}
                    <div
                      className="grid items-center gap-3 py-3"
                      style={{
                        gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <span className="font-semibold text-[#6B7A8D]">{t('compare.availability')}</span>
                      {products.map((p) => (
                        <span
                          key={p.id}
                          className={`font-semibold ${
                            p.stock > p.lowStockThreshold
                              ? 'text-[#16A34A]'
                              : p.stock > 0
                              ? 'text-[#D97706]'
                              : 'text-[#DC2626]'
                          }`}
                        >
                          {p.stock > 0 ? `${p.stock} ${t('catalog.unitsLeft')}` : t('catalog.outOfStock')}
                        </span>
                      ))}
                    </div>

                    {/* SKU */}
                    <div
                      className="grid items-center gap-3 py-3"
                      style={{
                        gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <span className="font-semibold text-[#6B7A8D]">{t('compare.modelSku')}</span>
                      {products.map((p) => (
                        <span key={p.id} className="font-mono text-[#0F1B2D]">
                          {p.sku}
                        </span>
                      ))}
                    </div>

                    {/* Editions / Variants */}
                    <div
                      className="grid items-center gap-3 py-3"
                      style={{
                        gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <span className="font-semibold text-[#6B7A8D]">{t('compare.configurations')}</span>
                      {products.map((p) => (
                        <span key={p.id} className="text-[#475569]">
                          {p.variants.join(' · ')}
                        </span>
                      ))}
                    </div>

                    {/* Dynamic Technical Specs Union */}
                    {allSpecKeys.map((specKey) => (
                      <div
                        key={specKey}
                        className="grid items-center gap-3 py-3"
                        style={{
                          gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                        }}
                      >
                        <span className="font-semibold text-[#6B7A8D]">{specKey}</span>
                        {products.map((p) => (
                          <span key={p.id} className="font-medium text-[#0F1B2D]">
                            {p.specs?.[specKey] || '—'}
                          </span>
                        ))}
                      </div>
                    ))}

                    {/* Store Protection */}
                    <div
                      className="grid items-center gap-3 py-3"
                      style={{
                        gridTemplateColumns: `160px repeat(${products.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <span className="font-semibold text-[#6B7A8D]">{t('compare.warranty')}</span>
                      {products.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1.5 font-medium text-[#1180E1]"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                          <span>2-Year Sam Brand Coverage</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
