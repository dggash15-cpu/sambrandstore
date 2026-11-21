import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  ShoppingBag,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  Check,
  Heart,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Bell,
  Package,
  CheckCircle2,
  Star,
  ThumbsUp,
  MessageSquarePlus,
  ZoomIn,
  ZoomOut,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import type { CartItem, Product, ProductRatingSummary, ProductReview } from '../types';
import { ProductVisual } from './ProductVisual';
import { formatCountdownParts } from './FlashSaleBanner';
import { useTranslation } from '../lib/i18n';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, variant: string, openDrawer?: boolean) => void;
  cartItems?: CartItem[];
  onUpdateCartQty?: (productId: string, variant: string, delta: number) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isCompared?: boolean;
  onToggleCompare?: (productId: string) => void;
  onReviewSubmitted?: (product: Product, review: ProductReview) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Outstanding',
};

const HELPFUL_STORAGE_KEY = 'sbs_helpful_reviews';

function StarRow({
  value,
  size = 'sm',
}: {
  value: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const cls =
    size === 'md' ? 'h-4 w-4' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(rounded) || star - 0.5 <= rounded;
        return (
          <Star
            key={star}
            className={`${cls} ${
              filled ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#CBD5E1]'
            }`}
          />
        );
      })}
    </span>
  );
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  cartItems = [],
  onUpdateCartQty,
  isFavorite = false,
  onToggleFavorite,
  isCompared = false,
  onToggleCompare,
  onReviewSubmitted,
}: ProductDetailModalProps) {
  const { t, isRtl, lang, translateCategory } = useTranslation();
  const [selectedVariant, setSelectedVariant] = useState('');
  const [added, setAdded] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Interactive Image Zoom state
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [zoomPinned, setZoomPinned] = useState(false);
  const [zoomScale, setZoomScale] = useState<2.2 | 3>(2.2);
  const [zoomCoords, setZoomCoords] = useState({ x: 50, y: 50 });
  const [pauseZoom, setPauseZoom] = useState(false);
  const [flashNowMs, setFlashNowMs] = useState(() => Date.now());

  // Out-of-stock "Notify Me When Available" state
  const [notifyFormOpen, setNotifyFormOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);

  // Ratings & Feedback state
  const reviewsSectionRef = useRef<HTMLDivElement | null>(null);
  const [reviewSummary, setReviewSummary] = useState<ProductRatingSummary>({
    averageRating: 0,
    reviewCount: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSort, setReviewSort] = useState<'recent' | 'helpful' | 'highest' | 'lowest'>(
    'recent'
  );
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(HELPFUL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const list = product.images?.length
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : [];
    return Array.from(new Set(list.filter(Boolean)));
  }, [product]);

  const cartQuantity = product
    ? cartItems
        .filter((item) => item.product.id === product.id && item.variant === selectedVariant)
        .reduce((sum, item) => sum + item.quantity, 0)
    : 0;

  useEffect(() => {
    if (product) {
      setSelectedVariant(product.variants[0] || 'Standard');
      setAdded(false);
      setActiveImageIdx(0);
      setIsHoveringImage(false);
      setZoomPinned(false);
      setZoomScale(2.2);
      setZoomCoords({ x: 50, y: 50 });
      setPauseZoom(false);
      setNotifyFormOpen(false);
      setNotifyError(null);
      setNotifySuccess(null);
      setReviewFormOpen(false);
      setRatingValue(5);
      setHoverRating(null);
      setReviewTitle('');
      setReviewComment('');
      setReviewError(null);
      setReviewSuccess(null);
      setStarFilter(null);
      setReviewSummary({
        averageRating: product.averageRating || 0,
        reviewCount: product.reviewCount || 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setReviewsLoading(true);
    api
      .getProductReviews(product.id, reviewSort)
      .then((res) => {
        if (cancelled) return;
        setReviewSummary(res.summary);
        setReviews(res.reviews);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product, reviewSort]);

  useEffect(() => {
    if (!product || galleryImages.length <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveImageIdx((idx) => (idx - 1 + galleryImages.length) % galleryImages.length);
      } else if (e.key === 'ArrowRight') {
        setActiveImageIdx((idx) => (idx + 1) % galleryImages.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [product, galleryImages.length]);

  useEffect(() => {
    if (!product?.flashSale) return;
    setFlashNowMs(Date.now());
    const t = window.setInterval(() => setFlashNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [product?.flashSale]);

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setNotifyLoading(true);
    setNotifyError(null);
    setNotifySuccess(null);
    try {
      const res = await api.notifyWhenAvailable(
        product.id,
        notifyEmail.trim(),
        selectedVariant || product.variants[0]
      );
      setNotifySuccess(res.message);
      setNotifyEmail('');
    } catch (err) {
      setNotifyError(
        err instanceof Error ? err.message : 'Could not register restock alert.'
      );
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const res = await api.submitProductReview(product.id, {
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || undefined,
        rating: ratingValue,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim(),
      });
      setReviewSummary(res.summary);
      setReviews(res.reviews);
      setReviewFormOpen(false);
      setReviewTitle('');
      setReviewComment('');
      setStarFilter(null);
      setReviewSuccess('Thank you! Your rating and feedback are now live.');
      onReviewSubmitted?.(product, res.review);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not publish your review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    if (!product || votedIds.includes(reviewId)) return;
    try {
      const res = await api.markReviewHelpful(product.id, reviewId);
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: res.helpfulCount } : r))
      );
      setVotedIds((prev) => {
        const next = [...prev, reviewId];
        try {
          localStorage.setItem(HELPFUL_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    } catch {
      // Ignore transient vote failure
    }
  };

  const displayedReviews = useMemo(
    () => (starFilter ? reviews.filter((r) => r.rating === starFilter) : reviews),
    [reviews, starFilter]
  );

  const currentImageUrl = galleryImages[activeImageIdx] || product?.imageUrl || null;
  const isOutOfStock = Boolean(product && product.stock <= 0);
  const displayRating = reviewSummary.reviewCount > 0 ? reviewSummary.averageRating : 0;
  const activeZoom = (isHoveringImage || zoomPinned) && !pauseZoom;

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomCoords({ x, y });
  };

  return (
    <AnimatePresence>
      {product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F1B2D]/55 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-h-[94vh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white shadow-2xl sm:w-full"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close product details"
              className="absolute right-4 top-4 z-20 rounded-lg border border-[#E6ECF4] bg-white p-2 text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-12">
              {/* Left Multi-Image Gallery */}
              <div className="flex flex-col justify-between border-b border-[#E6ECF4] bg-[#F7FAFD] p-4 sm:p-6 md:col-span-6 md:border-b-0 md:border-r">
                <div>
                  <div
                    onMouseEnter={() => setIsHoveringImage(true)}
                    onMouseLeave={() => setIsHoveringImage(false)}
                    onMouseMove={handleImageMouseMove}
                    onClick={() => {
                      if (!pauseZoom) setZoomPinned((v) => !v);
                    }}
                    className={`group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#E6ECF4] bg-white ${
                      activeZoom ? 'cursor-zoom-out' : 'cursor-zoom-in'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentImageUrl || product.visualKey}
                        initial={{ opacity: 0.35 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0.35 }}
                        transition={{ duration: 0.2 }}
                        className="h-full w-full"
                      >
                        <div
                          style={{
                            transform: activeZoom ? `scale(${zoomScale})` : 'scale(1)',
                            transformOrigin: `${zoomCoords.x}% ${zoomCoords.y}%`,
                          }}
                          className="h-full w-full transition-transform duration-150 ease-out will-change-transform"
                        >
                          <ProductVisual
                            visualKey={product.visualKey}
                            imageUrl={currentImageUrl}
                            alt={`${product.name} view ${activeImageIdx + 1}`}
                            className="h-full w-full"
                          />
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Precision Magnifier Reticle while zooming */}
                    {activeZoom && (
                      <div
                        aria-hidden="true"
                        style={{
                          left: `${zoomCoords.x}%`,
                          top: `${zoomCoords.y}%`,
                        }}
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full border border-[#1180E1]/65 bg-white/10 shadow-sm"
                      />
                    )}

                    {/* Bottom-Left Interactive Zoom Level Toggle */}
                    <button
                      type="button"
                      onMouseEnter={() => setPauseZoom(true)}
                      onMouseLeave={() => setPauseZoom(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!zoomPinned && !isHoveringImage) {
                          setZoomPinned(true);
                          setZoomScale(2.2);
                        } else if (zoomScale === 2.2) {
                          setZoomPinned(true);
                          setZoomScale(3);
                        } else {
                          setZoomPinned(false);
                          setZoomScale(2.2);
                        }
                      }}
                      title="Toggle hover/click zoom magnification"
                      className="absolute bottom-2.5 left-2.5 z-10 inline-flex items-center gap-1 rounded-md border border-white/15 bg-[#0F1B2D]/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-xs hover:bg-[#1180E1] transition-colors cursor-pointer"
                    >
                      {activeZoom ? (
                        <>
                          <ZoomOut className="h-3 w-3" />
                          <span>{zoomScale}x Zoom</span>
                        </>
                      ) : (
                        <>
                          <ZoomIn className="h-3 w-3" />
                          <span>{t('prod.hoverZoom')}</span>
                        </>
                      )}
                    </button>

                    {galleryImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onMouseEnter={() => setPauseZoom(true)}
                          onMouseLeave={() => setPauseZoom(false)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIdx(
                              (idx) => (idx - 1 + galleryImages.length) % galleryImages.length
                            );
                          }}
                          aria-label="Previous image"
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#E6ECF4] bg-white/95 text-[#0F1B2D] shadow-sm transition-transform hover:scale-105 hover:bg-white cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onMouseEnter={() => setPauseZoom(true)}
                          onMouseLeave={() => setPauseZoom(false)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIdx((idx) => (idx + 1) % galleryImages.length);
                          }}
                          aria-label="Next image"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#E6ECF4] bg-white/95 text-[#0F1B2D] shadow-sm transition-transform hover:scale-105 hover:bg-white cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 rounded-md bg-[#0F1B2D]/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                          {activeImageIdx + 1} / {galleryImages.length}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Switcher Strip */}
                  {galleryImages.length > 1 && (
                    <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                      {galleryImages.map((imgUrl, idx) => (
                        <button
                          key={`${imgUrl}-${idx}`}
                          type="button"
                          onClick={() => setActiveImageIdx(idx)}
                          className={`h-14 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                            idx === activeImageIdx
                              ? 'border-[#1180E1] shadow-xs'
                              : 'border-[#E6ECF4] opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={`${product.name} thumbnail ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* In the Box Section */}
                  {product.whatsInBox && product.whatsInBox.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8D]">
                        <Package className="h-3.5 w-3.5 text-[#1180E1]" />
                        <span>{t('prod.inTheBox')}</span>
                      </div>
                      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 text-[11px] text-[#475569]">
                        {product.whatsInBox.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 shrink-0 text-[#16A34A]" />
                            <span className="truncate">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#475569]">
                  <div className="flex items-center gap-2 rounded-lg border border-[#E6ECF4] bg-white p-3">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#1180E1]" />
                    <span className="truncate">{product.warranty || (lang === 'ar' ? 'ضمان سنتين من سام ستور' : '2-Year Sam Brand Warranty')}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-[#E6ECF4] bg-white p-3">
                    <Truck className="h-4 w-4 shrink-0 text-[#1180E1]" />
                    <span className="truncate">
                      {product.weight
                        ? `${product.weight} · ${lang === 'ar' ? 'نفس اليوم' : 'Same-Day'}`
                        : (lang === 'ar' ? 'شحن فوري في نفس اليوم' : 'Same-Day Dispatch')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Contiguous Purchase Module */}
              <div className={`flex flex-col justify-between p-4 sm:p-6 md:col-span-6 md:p-8 ${isRtl ? 'text-right' : 'text-left'}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6B7A8D]">
                    <span className="uppercase tracking-wider">{product.brand}</span>
                    <span aria-hidden="true">·</span>
                    <span>{translateCategory(product.category)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{product.sku}</span>
                    {product.condition && product.condition !== 'New' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#1180E1]">
                          {product.condition === 'Open Box'
                            ? (lang === 'ar' ? 'صندوق مفتوح' : 'Open Box')
                            : (lang === 'ar' ? 'مجدد معتمد' : product.condition)}
                        </span>
                      </>
                    )}
                  </div>

                  <h2 className="mt-2 font-display text-2xl font-bold text-[#0F1B2D]">
                    {product.name}
                  </h2>

                  {/* Clickable Live Star Summary Line */}
                  <button
                    type="button"
                    onClick={() => {
                      reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="mt-2 inline-flex items-center gap-2 text-xs text-[#475569] hover:text-[#1180E1] transition-colors cursor-pointer"
                  >
                    <StarRow value={displayRating} size="sm" />
                    <span className="font-mono font-bold text-[#0F1B2D] tabular-nums">
                      {displayRating > 0 ? displayRating.toFixed(1) : (lang === 'ar' ? 'جديد' : 'New')}
                    </span>
                    <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                    <span>
                      {reviewSummary.reviewCount > 0
                        ? `${reviewSummary.reviewCount} ${
                            lang === 'ar'
                              ? 'تقييمات من العملاء'
                              : reviewSummary.reviewCount === 1 ? 'customer review' : 'customer reviews'
                          }`
                        : (lang === 'ar' ? 'كن أول من يقيم هذا المنتج' : 'Be the first to rate')}
                    </span>
                  </button>

                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-mono text-2xl font-bold text-[#0F1B2D] tabular-nums">
                      ${product.price.toFixed(2)}
                    </span>
                    {product.compareAtPrice && (
                      <span className="font-mono text-sm text-[#94A3B8] line-through tabular-nums">
                        ${product.compareAtPrice.toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`ml-auto text-xs font-semibold ${
                        product.stock > product.lowStockThreshold
                          ? 'text-[#16A34A]'
                          : product.stock > 0
                          ? 'text-[#D97706]'
                          : 'text-[#DC2626]'
                      }`}
                    >
                      {product.stock > 0
                        ? (lang === 'ar' ? `${product.stock} متوفر في المخزن` : `${product.stock} in stock`)
                        : (lang === 'ar' ? 'نفد من المخزن' : 'Out of stock')}
                    </span>
                  </div>

                  {product.flashSale && (() => {
                    const c = formatCountdownParts(product.flashSale.expiresAt, flashNowMs);
                    if (c.expired) return null;
                    return (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Zap className="h-3.5 w-3.5 fill-current text-[#DC2626]" />
                          <span>
                            {product.flashSale.title} (-{product.flashSale.discountPct}%)
                          </span>
                        </span>
                        <span className="font-mono text-[11px] font-bold tabular-nums">
                          {lang === 'ar' ? 'ينتهي خلال ' : 'Ends in '}
                          {c.days > 0 ? `${c.days}d ` : ''}
                          {c.pad(c.hours)}:{c.pad(c.minutes)}:{c.pad(c.seconds)}
                        </span>
                      </div>
                    );
                  })()}

                  <p className="mt-4 text-sm leading-relaxed text-[#475569]">
                    {product.description}
                  </p>

                  {/* Variant Selector */}
                  {product.variants.length > 0 && (
                    <div className="mt-5">
                      <span className="block text-xs font-semibold text-[#0F1B2D]">
                        {lang === 'ar' ? 'الإصدار / المواصفة' : 'Configuration'}
                      </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {product.variants.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setSelectedVariant(v)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              selectedVariant === v
                                ? 'border-[#1180E1] bg-[#1180E1]/8 text-[#1180E1]'
                                : 'border-[#D4DFEE] bg-white text-[#475569] hover:border-[#0F1B2D]'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Technical Specs Table */}
                  <div className="mt-6 border-t border-[#E6ECF4] pt-4">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-[#6B7A8D]">
                      {t('prod.specs')}
                    </span>
                    <dl className="mt-2 divide-y divide-[#F1F5F9] text-xs">
                      {Object.entries(product.specs).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between py-2 gap-4">
                          <dt className="font-medium text-[#6B7A8D]">{k}</dt>
                          <dd className="text-right font-medium text-[#0F1B2D]">{v}</dd>
                        </div>
                      ))}
                      {product.dimensions && (
                        <div className="flex items-center justify-between py-2 gap-4">
                          <dt className="font-medium text-[#6B7A8D]">{t('prod.dimensions')}</dt>
                          <dd className="text-right font-medium text-[#0F1B2D]">{product.dimensions}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {/* Out-of-Stock Notify Me Form OR In-Stock Purchase CTAs */}
                <div className="mt-6 border-t border-[#E6ECF4] pt-5">
                  {isOutOfStock ? (
                    <div className="space-y-3">
                      {!notifyFormOpen && !notifySuccess && (
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                          {onToggleFavorite && (
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(product.id)}
                              aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                isFavorite
                                  ? 'border-[#FECACA] bg-[#FEF2F2] text-[#EF4444]'
                                  : 'border-[#D4DFEE] bg-white text-[#6B7A8D] hover:text-[#EF4444]'
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-[#EF4444]' : ''}`} />
                            </button>
                          )}
                          {onToggleCompare && (
                            <button
                              type="button"
                              onClick={() => onToggleCompare(product.id)}
                              aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
                              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                                isCompared
                                  ? 'border-[#1180E1] bg-[#EFF6FF] text-[#1180E1]'
                                  : 'border-[#D4DFEE] bg-white text-[#6B7A8D] hover:text-[#1180E1]'
                              }`}
                            >
                              <GitCompare className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setNotifyFormOpen(true)}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F1B2D] px-4 py-3 text-xs font-semibold text-white transition-all hover:bg-[#1180E1] cursor-pointer"
                          >
                            <Bell className="h-4 w-4" />
                            <span>{t('prod.notifyWhenAvailable')}</span>
                          </button>
                        </div>
                      )}

                      {notifyFormOpen && !notifySuccess && (
                        <motion.form
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          onSubmit={handleNotifySubmit}
                          className="rounded-xl border border-[#CBD8EA] bg-[#F7FAFD] p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#0F1B2D]">
                              {lang === 'ar' ? 'تنبيه التوفر بالمخزون' : 'Restock Alert'} · {selectedVariant || 'Standard'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setNotifyFormOpen(false);
                                setNotifyError(null);
                              }}
                              className="text-[11px] font-semibold text-[#6B7A8D] hover:text-[#0F1B2D] cursor-pointer"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                          {notifyError && (
                            <p className="text-[11px] font-medium text-[#DC2626]">{notifyError}</p>
                          )}
                          <div className="flex gap-2">
                            <input
                              required
                              type="email"
                              value={notifyEmail}
                              onChange={(e) => setNotifyEmail(e.target.value)}
                              placeholder="you@example.com"
                              aria-label="Email for restock alert"
                              className="flex-1 rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={notifyLoading}
                              className="rounded-lg bg-[#1180E1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {notifyLoading ? t('common.loading') : t('prod.notifyMe')}
                            </button>
                          </div>
                        </motion.form>
                      )}

                      {notifySuccess && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-xs font-medium text-[#166534]">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                          <span>{notifySuccess}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(product.id)}
                          aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                            isFavorite
                              ? 'border-[#FECACA] bg-[#FEF2F2] text-[#EF4444]'
                              : 'border-[#D4DFEE] bg-white text-[#6B7A8D] hover:text-[#EF4444]'
                          }`}
                        >
                          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-[#EF4444]' : ''}`} />
                        </button>
                      )}

                      {onToggleCompare && (
                        <button
                          type="button"
                          onClick={() => onToggleCompare(product.id)}
                          aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
                          title={isCompared ? 'Remove from comparison' : 'Compare product'}
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                            isCompared
                              ? 'border-[#1180E1] bg-[#EFF6FF] text-[#1180E1]'
                              : 'border-[#D4DFEE] bg-white text-[#6B7A8D] hover:text-[#1180E1]'
                          }`}
                        >
                          <GitCompare className="h-4 w-4" />
                        </button>
                      )}

                      {cartQuantity > 0 ? (
                        <div className="order-first flex basis-full flex-col gap-1.5 sm:order-none sm:basis-auto sm:flex-1">
                          <span className="text-xs font-medium text-[#475569] sm:text-sm">
                            {lang === 'ar' ? 'الكمية' : 'Quantity'}
                          </span>
                          <div className="flex h-11 w-full items-center justify-between rounded-full border border-[#C9D7EA] bg-white px-3 text-[#0F1B2D] shadow-[0_5px_14px_rgba(15,27,45,0.08)] sm:h-12 sm:min-w-[180px] sm:px-4">
                            <button
                              type="button"
                              onClick={() => onUpdateCartQty?.(product.id, selectedVariant, -1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[#0F1B2D] transition-colors hover:bg-[#F1F5F9] cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                            <span className="min-w-10 text-center font-serif text-xl font-semibold text-[#1180E1]">
                              {cartQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateCartQty?.(product.id, selectedVariant, 1)}
                              disabled={cartQuantity >= product.stock}
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[#0F1B2D] transition-colors hover:bg-[#F1F5F9] disabled:opacity-40 cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onAddToCart(product, selectedVariant, false);
                            setAdded(true);
                            setTimeout(() => setAdded(false), 1400);
                          }}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-semibold transition-all cursor-pointer ${
                            added
                              ? 'bg-[#16A34A] text-white'
                              : 'border border-[#D4DFEE] bg-[#F7FAFD] text-[#0F1B2D] hover:bg-[#E6ECF4]'
                          }`}
                        >
                          {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                          <span>{added ? (lang === 'ar' ? 'تمت الإضافة للسلة' : 'Added to Bag') : (lang === 'ar' ? 'إضافة للسلة' : 'Add to Cart')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onAddToCart(product, selectedVariant, true);
                          onClose();
                        }}
                        className="flex-1 inline-flex items-center justify-center rounded-lg bg-[#1180E1] px-4 py-3 text-xs font-semibold text-white transition-all hover:bg-[#0D6BC0] cursor-pointer"
                      >
                        {lang === 'ar' ? 'شراء فوري' : 'Buy Now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Star-Based Ratings & Feedback Section */}
            <div
              ref={reviewsSectionRef}
              id="pdp-reviews-section"
              className="border-t border-[#E6ECF4] bg-[#F7FAFD] p-6 md:p-8"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                {/* Left: Average Score & Distribution */}
                <div className="md:col-span-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7A8D]">
                      {lang === 'ar' ? 'التقييمات الموثقة' : 'Verified Ratings'}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2.5">
                      <span className="font-mono text-3xl font-bold text-[#0F1B2D] tabular-nums">
                        {reviewSummary.reviewCount > 0
                          ? reviewSummary.averageRating.toFixed(1)
                          : '—'}
                      </span>
                      <span className="text-xs text-[#6B7A8D]">/ 5.0</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StarRow value={reviewSummary.averageRating} size="md" />
                      <span className="text-xs text-[#6B7A8D] tabular-nums">
                        {reviewSummary.reviewCount}{' '}
                        {lang === 'ar'
                          ? 'تقييم'
                          : reviewSummary.reviewCount === 1 ? 'rating' : 'ratings'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive 5 -> 1 Star Distribution Filter */}
                  <div className="space-y-1.5 pt-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviewSummary.distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
                      const pct =
                        reviewSummary.reviewCount > 0
                          ? Math.round((count / reviewSummary.reviewCount) * 100)
                          : 0;
                      const active = starFilter === star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setStarFilter((curr) => (curr === star ? null : star))}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer ${
                            isRtl ? 'text-right' : 'text-left'
                          } ${
                            active
                              ? 'bg-[#EFF6FF] text-[#1180E1] font-semibold'
                              : 'text-[#475569] hover:bg-white'
                          }`}
                        >
                          <span className="w-8 font-mono tabular-nums">{star} ★</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]">
                            <div
                              className="h-full rounded-full bg-[#F59E0B] transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`w-8 font-mono text-[11px] text-[#6B7A8D] tabular-nums ${isRtl ? 'text-left' : 'text-right'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                    {starFilter && (
                      <button
                        type="button"
                        onClick={() => setStarFilter(null)}
                        className="mt-1 text-[11px] font-semibold text-[#1180E1] hover:underline cursor-pointer"
                      >
                        {lang === 'ar' ? 'عرض جميع مستويات التقييم' : 'Show all star levels'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: Write Feedback Form + Reviews Feed */}
                <div className="md:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-bold text-[#0F1B2D]">
                        {lang === 'ar' ? 'آراء وملاحظات العملاء' : 'Customer Feedback'}
                      </h3>
                      <select
                        value={reviewSort}
                        onChange={(e) =>
                          setReviewSort(
                            e.target.value as 'recent' | 'helpful' | 'highest' | 'lowest'
                          )
                        }
                        aria-label="Sort reviews"
                        className="rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1 text-xs font-medium text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none cursor-pointer"
                      >
                        <option value="recent">{t('prod.sortRecent')}</option>
                        <option value="helpful">{t('prod.sortHelpful')}</option>
                        <option value="highest">{t('prod.sortHighest')}</option>
                        <option value="lowest">{t('prod.sortLowest')}</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReviewFormOpen((v) => !v);
                        setReviewError(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      <span>
                        {reviewFormOpen
                          ? (lang === 'ar' ? 'إغلاق النموذج' : 'Close Form')
                          : (lang === 'ar' ? 'تقييم وكتابة مراجعة' : 'Rate & Review')}
                      </span>
                    </button>
                  </div>

                  {reviewSuccess && (
                    <div className="flex items-center gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-2.5 text-xs font-medium text-[#166534]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                      <span>{reviewSuccess}</span>
                    </div>
                  )}

                  {/* Interactive Rating & Feedback Submission Form */}
                  <AnimatePresence>
                    {reviewFormOpen && (
                      <motion.form
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        onSubmit={handleReviewSubmit}
                        className="rounded-xl border border-[#D4DFEE] bg-white p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#0F1B2D]">
                            {lang === 'ar' ? 'تقييمك الإجمالي للمنتج' : 'Your Overall Rating'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex items-center gap-1"
                              onMouseLeave={() => setHoverRating(null)}
                            >
                              {[1, 2, 3, 4, 5].map((star) => {
                                const active = star <= (hoverRating ?? ratingValue);
                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    onMouseEnter={() => setHoverRating(star)}
                                    onClick={() => setRatingValue(star)}
                                    aria-label={`Rate ${star} stars`}
                                    className="p-0.5 transition-transform hover:scale-110 cursor-pointer"
                                  >
                                    <Star
                                      className={`h-5 w-5 ${
                                        active
                                          ? 'fill-[#F59E0B] text-[#F59E0B]'
                                          : 'text-[#CBD5E1]'
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                            <span className="w-24 text-right font-mono text-xs font-semibold text-[#0F1B2D]">
                              {RATING_LABELS[hoverRating ?? ratingValue]}
                            </span>
                          </div>
                        </div>

                        {reviewError && (
                          <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                            {reviewError}
                          </p>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-medium text-[#475569]">
                              {lang === 'ar' ? 'الاسم المعروض *' : 'Display Name *'}
                            </label>
                            <input
                              required
                              type="text"
                              value={authorName}
                              onChange={(e) => setAuthorName(e.target.value)}
                              placeholder="Alex M."
                              className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#475569]">
                              {lang === 'ar' ? 'بريد الطلب (اختياري · لتوثيق الشراء)' : 'Order Email (optional · verifies purchase)'}
                            </label>
                            <input
                              type="email"
                              value={authorEmail}
                              onChange={(e) => setAuthorEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#475569]">
                            {lang === 'ar' ? 'عنوان المراجعة' : 'Review Headline'}
                          </label>
                          <input
                            type="text"
                            value={reviewTitle}
                            onChange={(e) => setReviewTitle(e.target.value)}
                            placeholder={lang === 'ar' ? 'لخص تجربتك في سطر واحد' : 'Summarize your experience in one line'}
                            className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#475569]">
                            {lang === 'ar' ? 'التفاصيل والملاحظات *' : 'Detailed Feedback *'}
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder={lang === 'ar' ? 'شارك رأيك في جودة التصنيع، الأداء الصوتي/الحراري، وسهولة الإعداد...' : 'Share build quality, thermal/audio performance, or setup notes...'}
                            className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewFormOpen(false)}
                            className="rounded-lg border border-[#D4DFEE] px-3 py-2 text-xs font-semibold text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                          >
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            type="submit"
                            disabled={submittingReview}
                            className="rounded-lg bg-[#1180E1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] disabled:opacity-50 cursor-pointer"
                          >
                            {submittingReview
                              ? (lang === 'ar' ? 'جارٍ الإرسال...' : 'Submitting...')
                              : (lang === 'ar' ? 'إرسال التقييم' : 'Submit Feedback')}
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Submitted Reviews Feed */}
                  {reviewsLoading ? (
                    <div className="space-y-2.5">
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="h-24 animate-pulse rounded-xl border border-[#E6ECF4] bg-white"
                        />
                      ))}
                    </div>
                  ) : displayedReviews.length === 0 ? (
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-6 text-center text-xs text-[#6B7A8D]">
                      {starFilter
                        ? (lang === 'ar' ? `لا توجد تقييمات بمستوى ${starFilter} نجوم لهذا المنتج بعد.` : `No ${starFilter}-star reviews for this product yet.`)
                        : (lang === 'ar' ? 'لا توجد تقييمات مسجلة بعد. انقر على "تقييم وكتابة مراجعة" أعلاه لمشاركة تجربتك.' : 'No customer reviews yet. Click "Rate & Review" above to share your experience.')}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E6ECF4] rounded-xl border border-[#E6ECF4] bg-white">
                      {displayedReviews.map((rev) => {
                        const alreadyVoted = votedIds.includes(rev.id);
                        return (
                          <article key={rev.id} className="p-4 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <StarRow value={rev.rating} size="xs" />
                                <span className="font-semibold text-[#0F1B2D]">
                                  {rev.authorName}
                                </span>
                                {rev.verifiedPurchase && (
                                  <>
                                    <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                                    <span className="font-medium text-[#16A34A]">
                                      {lang === 'ar' ? 'مشتري موثق' : 'Verified Buyer'}
                                    </span>
                                  </>
                                )}
                              </div>
                              <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                                {new Date(rev.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>

                            <h4 className="font-display text-xs font-bold text-[#0F1B2D]">
                              {rev.title}
                            </h4>
                            <p className="text-xs leading-relaxed text-[#475569]">
                              {rev.comment}
                            </p>

                            <div className="pt-1">
                              <button
                                type="button"
                                disabled={alreadyVoted}
                                onClick={() => handleMarkHelpful(rev.id)}
                                className={`inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-default ${
                                  alreadyVoted
                                    ? 'text-[#1180E1]'
                                    : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                                }`}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                <span>
                                  {lang === 'ar' ? 'مفيد' : 'Helpful'} ({rev.helpfulCount})
                                </span>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
