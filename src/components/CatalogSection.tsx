import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search,
  Plus,
  Check,
  ArrowUpDown,
  Heart,
  GitCompare,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  Images,
  Sparkles,
  ArrowRight,
  Star,
  Share2,
  Zap,
} from 'lucide-react';
import type { Product } from '../types';
import { ProductVisual } from './ProductVisual';
import { useTranslation } from '../lib/i18n.tsx';

interface CatalogSectionProps {
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, variant?: string) => void;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  compareIds: string[];
  onToggleCompare: (productId: string) => void;
  onOpenCompare: () => void;
  onClearCompare: () => void;
  onShareFavorites?: () => string;
}

const CATEGORIES = [
  'All',
  'Consoles',
  'Monitors',
  'Audio',
  'Peripherals',
  'Accessories',
  'Featured',
  'Deals',
  'Favorites',
];

const DEPARTMENT_SECTIONS: Array<{
  key: string;
  title: string;
  subtitle: string;
  categoryTarget: string;
}> = [
  {
    key: 'Featured',
    title: 'Featured Drops',
    subtitle: 'Flagship builds and limited-run hardware curated by Sam Brand.',
    categoryTarget: 'Featured',
  },
  {
    key: 'Consoles',
    title: 'Consoles & Handhelds',
    subtitle: 'Next-gen 4K living-room rigs and OLED portable systems.',
    categoryTarget: 'Consoles',
  },
  {
    key: 'Monitors',
    title: 'OLED & Esports Monitors',
    subtitle: 'High-refresh QD-OLED panels with zero-blur response.',
    categoryTarget: 'Monitors',
  },
  {
    key: 'Audio',
    title: 'Studio Audio & Acoustics',
    subtitle: 'Planar magnetic headsets, DACs, and broadcast condenser mics.',
    categoryTarget: 'Audio',
  },
  {
    key: 'Peripherals',
    title: 'Precision Peripherals',
    subtitle: 'Hall-effect keyboards, carbon mice, and tournament controllers.',
    categoryTarget: 'Peripherals',
  },
  {
    key: 'Accessories',
    title: 'Docks, Cables & Desk Gear',
    subtitle: 'Thunderbolt hubs, studio mats, and workstation power.',
    categoryTarget: 'Accessories',
  },
];

const DEPT_TRANSLATIONS: Record<string, { title: string; subtitle: string }> = {
  Featured: {
    title: 'إصدارات مختارة',
    subtitle: 'أحدث الأجهزة وقطع العتاد المحدودة بإشراف سام ستور.',
  },
  Consoles: {
    title: 'منصات الألعاب والمحمولة',
    subtitle: 'منصات 4K فائقة القوة وأجهزة ألعاب OLED محمولة.',
  },
  Monitors: {
    title: 'شاشات أوليد ورياضات إلكترونية',
    subtitle: 'شاشات QD-OLED سريعة الاستجابة وبمعدل تحديث فائق النعومة.',
  },
  Audio: {
    title: 'صوتيات الاستوديو الاحترافية',
    subtitle: 'سماعات مغناطيسية مستوية ومحولات رقمية وميكروفونات بث.',
  },
  Peripherals: {
    title: 'الملحقات الدقيقة والتحكم',
    subtitle: 'لوحات مفاتيح هول-إيفكت، فارات كربونية خفيفة، وأذرع تحكم بطولات.',
  },
  Accessories: {
    title: 'القواعد والكابلات ومعدات المكتب',
    subtitle: 'قواعد ثندربولت، أسطح مكاتب مريحة، وحلول طاقة متكاملة.',
  },
};

function useResponsivePerSlide() {
  const [perSlide, setPerSlide] = useState(5);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setPerSlide(6);
      else if (w >= 1024) setPerSlide(5);
      else if (w >= 768) setPerSlide(4);
      else if (w >= 640) setPerSlide(3);
      else setPerSlide(2);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return perSlide;
}

interface CompactProductCardProps {
  product: Product;
  indexInSlide: number;
  isAdded: boolean;
  isFav: boolean;
  isCompared: boolean;
  compareAtLimit: boolean;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (e: React.MouseEvent, product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
}

function CompactProductCard({
  product,
  indexInSlide,
  isAdded,
  isFav,
  isCompared,
  compareAtLimit,
  onSelectProduct,
  onQuickAdd,
  onToggleFavorite,
  onToggleCompare,
}: CompactProductCardProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const prefersReduced = useReducedMotion();

  const gallery = useMemo(
    () =>
      Array.from(
        new Set([...(product.images || []), ...(product.imageUrl ? [product.imageUrl] : [])].filter(Boolean))
      ),
    [product.images, product.imageUrl]
  );

  const primaryImage = gallery[0] || product.imageUrl;
  const secondaryImage = gallery.length > 1 ? gallery[1] : null;
  const activePreviewImage = hovered && secondaryImage ? secondaryImage : primaryImage;

  const outOfStock = product.stock <= 0;
  const discountPct =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

  const topSpecEntry = useMemo(() => {
    const entries = Object.entries(product.specs || {});
    return entries[0] || null;
  }, [product.specs]);

  return (
    <motion.article
      initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 360,
        damping: 28,
        delay: prefersReduced ? 0 : Math.min(indexInSlide * 0.035, 0.2),
      }}
      whileHover={prefersReduced ? undefined : { y: -3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelectProduct(product)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow] duration-200 hover:shadow-md hover:shadow-[#0F1B2D]/10 cursor-pointer ${
        isCompared
          ? 'border-[#1180E1] ring-1 ring-[#1180E1]/30'
          : 'border-[#E6ECF4] hover:border-[#1180E1]/45'
      }`}
    >
      {/* Sleek Compact Visual Frame with Smooth Multi-Image Hover Crossfade */}
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-[#F1F5F9] bg-[#F7FAFD]">
        <motion.div
          animate={{ scale: hovered && !prefersReduced ? 1.05 : 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="h-full w-full"
        >
          <ProductVisual
            visualKey={product.visualKey}
            imageUrl={activePreviewImage}
            alt={product.name}
            className="h-full w-full"
          />
        </motion.div>

        {/* Top-Left Compare Control */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          disabled={compareAtLimit}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare(product.id);
          }}
          title={
            compareAtLimit
              ? 'Maximum 3 products selected for comparison'
              : isCompared
              ? 'Remove from compare'
              : 'Compare side-by-side'
          }
          aria-label={isCompared ? `Remove ${product.name} from compare` : `Compare ${product.name}`}
          className={`absolute left-1.5 top-1.5 flex h-5 items-center gap-1 rounded border px-1.5 text-[9px] font-semibold backdrop-blur-xs transition-colors cursor-pointer disabled:opacity-45 ${
            isCompared
              ? 'border-[#1180E1] bg-[#1180E1] text-white shadow-xs'
              : 'border-[#E6ECF4] bg-white/92 text-[#475569] hover:border-[#1180E1]/50 hover:text-[#1180E1]'
          }`}
        >
          {isCompared ? <Check className="h-2.5 w-2.5" /> : <GitCompare className="h-2.5 w-2.5" />}
          <span className="hidden xl:inline">{isCompared ? 'Added' : 'Compare'}</span>
        </motion.button>

        {/* Top-Right Favorite Heart */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.82 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          aria-label={isFav ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
          className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border backdrop-blur-xs transition-colors cursor-pointer ${
            isFav
              ? 'border-[#FECACA] bg-white text-[#EF4444] shadow-xs'
              : 'border-[#E6ECF4] bg-white/92 text-[#6B7A8D] hover:text-[#EF4444]'
          }`}
        >
          <Heart className={`h-2.5 w-2.5 ${isFav ? 'fill-[#EF4444]' : ''}`} />
        </motion.button>

        {/* Bottom Micro-Indicators */}
        <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
          {gallery.length > 1 ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-[#0F1B2D]/75 px-1 py-0.5 font-mono text-[9px] font-semibold text-white">
              <Images className="h-2.5 w-2.5" />
              {gallery.length}
            </span>
          ) : (
            <span />
          )}

          {outOfStock ? (
            <span className="rounded bg-[#DC2626] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Sold Out
            </span>
          ) : product.flashSale ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-[#B91C1C] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white tabular-nums">
              <Zap className="h-2.5 w-2.5 fill-current" />
              -{product.flashSale.discountPct}%
            </span>
          ) : discountPct ? (
            <span className="rounded bg-[#1180E1] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white tabular-nums">
              -{discountPct}%
            </span>
          ) : null}
        </div>
      </div>

      {/* Tight, Refined Card Body */}
      <div className="flex flex-1 flex-col justify-between p-2">
        <div>
          <div className="flex items-center justify-between gap-1 text-[9px] text-[#6B7A8D]">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate font-semibold uppercase tracking-wider">{product.brand}</span>
              {product.condition && product.condition !== 'New' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0 font-semibold text-[#1180E1]">{product.condition}</span>
                </>
              )}
            </div>
            {(product.reviewCount || 0) > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-mono font-semibold text-[#0F1B2D] tabular-nums">
                <Star className="h-2.5 w-2.5 fill-[#F59E0B] text-[#F59E0B]" />
                {(product.averageRating || 0).toFixed(1)}
              </span>
            )}
          </div>

          <h3 className="mt-0.5 font-display text-[11px] font-semibold leading-tight text-[#0F1B2D] group-hover:text-[#1180E1] transition-colors line-clamp-1">
            {product.name}
          </h3>

          {topSpecEntry && (
            <p className="mt-0.5 truncate text-[10px] text-[#6B7A8D]">
              <span className="font-medium text-[#475569]">{topSpecEntry[0]}:</span> {topSpecEntry[1]}
            </p>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-1.5 border-t border-[#F1F5F9] pt-1.5">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-bold text-[#0F1B2D] tabular-nums">
              ${product.price.toFixed(0)}
            </span>
            {product.compareAtPrice && (
              <span className="ml-1 hidden sm:inline font-mono text-[9px] text-[#94A3B8] line-through tabular-nums">
                ${product.compareAtPrice.toFixed(0)}
              </span>
            )}
          </div>

          {outOfStock ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectProduct(product);
              }}
              aria-label={`Notify me when ${product.name} is available`}
              className="inline-flex items-center gap-1 rounded border border-[#CBD8EA] bg-[#F7FAFD] px-1.5 py-0.5 text-[10px] font-semibold text-[#0F1B2D] transition-colors hover:border-[#1180E1] hover:text-[#1180E1] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className="h-2.5 w-2.5" />
              <span>{t('prod.notifyMe')}</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => onQuickAdd(e, product)}
              aria-label={`Add ${product.name} to cart`}
              className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isAdded
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-[#0F1B2D] text-white hover:bg-[#1180E1]'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="h-2.5 w-2.5" />
                  <span>{t('compare.added')}</span>
                </>
              ) : (
                <>
                  <Plus className="h-2.5 w-2.5" />
                  <span>{t('catalog.addToCart')}</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

interface ProductSlideSectionProps {
  title: string;
  subtitle?: string;
  items: Product[];
  perSlide: number;
  sortKey?: string;
  isFeaturedSection?: boolean;
  onViewSection?: () => void;
  recentlyAddedId: string | null;
  favorites: string[];
  compareIds: string[];
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (e: React.MouseEvent, product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
}

function ProductSlideSection({
  title,
  subtitle,
  items,
  perSlide,
  sortKey,
  isFeaturedSection,
  onViewSection,
  recentlyAddedId,
  favorites,
  compareIds,
  onSelectProduct,
  onQuickAdd,
  onToggleFavorite,
  onToggleCompare,
}: ProductSlideSectionProps) {
  const { lang, isRtl } = useTranslation();
  const [page, setPage] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const trackContainerRef = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  const slides = useMemo(() => {
    const chunks: Product[][] = [];
    for (let i = 0; i < items.length; i += perSlide) {
      chunks.push(items.slice(i, i + perSlide));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [items, perSlide]);

  const totalPages = slides.length;
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    setPage(0);
  }, [items.length, perSlide, sortKey]);

  useEffect(() => {
    const el = trackContainerRef.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goTo = (nextPage: number) => {
    if (totalPages <= 1) return;
    const wrapped = (nextPage + totalPages) % totalPages;
    setPage(wrapped);
  };

  const progressPct = ((safePage + 1) / totalPages) * 100;
  const maxDragOffset = viewportWidth > 0 ? -(totalPages - 1) * viewportWidth : 0;

  return (
    <div className="space-y-3">
      {/* Section Header + Slide Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {isFeaturedSection && <Sparkles className="h-4 w-4 text-[#1180E1]" />}
            <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-[#0F1B2D]">
              {title}
            </h2>
            <span className="font-mono text-[11px] font-semibold text-[#6B7A8D] tabular-nums">
              {items.length}
            </span>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-[#6B7A8D]">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {onViewSection && (
            <button
              type="button"
              onClick={onViewSection}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#1180E1] hover:bg-[#EFF6FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{lang === 'ar' ? 'تصفية هذا القسم' : 'Filter Section'}</span>
              <ArrowRight className={`h-3 w-3 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          )}

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="mr-1 font-mono text-[11px] font-semibold text-[#6B7A8D] tabular-nums">
                {safePage + 1}/{totalPages}
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => goTo(safePage - 1)}
                aria-label={`Previous ${title} slide`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4DFEE] bg-white text-[#0F1B2D] shadow-2xs transition-colors hover:border-[#1180E1] hover:text-[#1180E1] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => goTo(safePage + 1)}
                aria-label={`Next ${title} slide`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4DFEE] bg-white text-[#0F1B2D] shadow-2xs transition-colors hover:border-[#1180E1] hover:text-[#1180E1] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Touch-Enabled Framer Motion Carousel Viewport */}
      <div
        ref={trackContainerRef}
        tabIndex={totalPages > 1 ? 0 : undefined}
        onKeyDown={(e) => {
          if (totalPages <= 1) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            goTo(safePage + 1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goTo(safePage - 1);
          }
        }}
        aria-roledescription="carousel"
        aria-label={title}
        className="relative overflow-hidden py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1180E1]/40 rounded-xl"
      >
        <motion.div
          animate={{
            x: viewportWidth > 0 ? -safePage * viewportWidth : `-${safePage * 100}%`,
          }}
          transition={
            prefersReduced
              ? { duration: 0.15 }
              : {
                  type: 'spring',
                  stiffness: 300,
                  damping: 32,
                  mass: 0.85,
                }
          }
          drag={totalPages > 1 && viewportWidth > 0 ? 'x' : false}
          dragConstraints={{ left: maxDragOffset, right: 0 }}
          dragElastic={0.22}
          dragMomentum={false}
          whileDrag={prefersReduced ? undefined : { cursor: 'grabbing' }}
          onDragEnd={(_, info) => {
            if (totalPages <= 1) return;
            const threshold = Math.min(72, Math.max(36, viewportWidth * 0.12));
            if (info.offset.x < -threshold || info.velocity.x < -320) {
              goTo(Math.min(totalPages - 1, safePage + 1));
            } else if (info.offset.x > threshold || info.velocity.x > 320) {
              goTo(Math.max(0, safePage - 1));
            }
          }}
          style={{ touchAction: 'pan-y' }}
          className={`flex items-stretch ${totalPages > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {slides.map((slideItems, slideIdx) => {
            const isCurrent = slideIdx === safePage;
            return (
              <motion.div
                key={`${title}-page-${slideIdx}-${perSlide}`}
                animate={
                  prefersReduced
                    ? { opacity: 1 }
                    : {
                        opacity: isCurrent ? 1 : 0.45,
                        scale: isCurrent ? 1 : 0.975,
                      }
                }
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="w-full shrink-0 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                {slideItems.map((product, idx) => {
                  const isAdded = recentlyAddedId === product.id;
                  const isFav = favorites.includes(product.id);
                  const isCompared = compareIds.includes(product.id);
                  const compareAtLimit = !isCompared && compareIds.length >= 3;
                  return (
                    <CompactProductCard
                      key={product.id}
                      product={product}
                      indexInSlide={idx}
                      isAdded={isAdded}
                      isFav={isFav}
                      isCompared={isCompared}
                      compareAtLimit={compareAtLimit}
                      onSelectProduct={onSelectProduct}
                      onQuickAdd={onQuickAdd}
                      onToggleFavorite={onToggleFavorite}
                      onToggleCompare={onToggleCompare}
                    />
                  );
                })}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Slide Progress Rail + Segmented Slide Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#E6ECF4]">
            <motion.div
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="h-full rounded-full bg-gradient-to-r from-[#1180E1] to-[#0F1B2D]"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {slides.map((_, idx) => {
              const active = idx === safePage;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`Go to ${title} slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    active ? 'w-5 bg-[#1180E1]' : 'w-2 bg-[#CBD8EA] hover:bg-[#94A3B8]'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CatalogSection({
  products,
  selectedCategory,
  onSelectCategory,
  onSelectProduct,
  onAddToCart,
  favorites,
  onToggleFavorite,
  searchQuery,
  onSearchChange,
  compareIds,
  onToggleCompare,
  onOpenCompare,
  onClearCompare,
  onShareFavorites,
}: CatalogSectionProps) {
  const { t, translateCategory, isRtl, lang } = useTranslation();
  const [sortBy, setSortBy] = useState<
    'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'rating-desc'
  >('featured');
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const perSlide = useResponsivePerSlide();

  const sortItems = (list: Product[]) => {
    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    }
    if (sortBy === 'name-asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    if (sortBy === 'name-desc') {
      return [...list].sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
    }
    if (sortBy === 'rating-desc') {
      return [...list].sort(
        (a, b) =>
          (b.averageRating || 0) - (a.averageRating || 0) ||
          (b.reviewCount || 0) - (a.reviewCount || 0) ||
          a.name.localeCompare(b.name)
      );
    }
    return [...list].sort(
      (a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name)
    );
  };

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = activeProducts.filter((p) => {
      if (selectedCategory === 'Featured') {
        if (!p.featured) return false;
      } else if (selectedCategory === 'Deals') {
        if (!(p.compareAtPrice && p.compareAtPrice > p.price)) return false;
      } else if (selectedCategory === 'Favorites') {
        if (!favorites.includes(p.id)) return false;
      } else if (selectedCategory !== 'All' && p.category !== selectedCategory) {
        return false;
      }
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return sortItems(list);
  }, [activeProducts, selectedCategory, favorites, searchQuery, sortBy]);

  // Build per-department slide sections when viewing "All" without search filter
  const sectionDecks = useMemo(() => {
    if (selectedCategory !== 'All' || searchQuery.trim()) return [];
    return DEPARTMENT_SECTIONS.map((sec) => {
      const items =
        sec.key === 'Featured'
          ? sortItems(activeProducts.filter((p) => p.featured))
          : sortItems(activeProducts.filter((p) => p.category === sec.key));
      return { ...sec, items };
    }).filter((sec) => sec.items.length > 0);
  }, [activeProducts, selectedCategory, searchQuery, sortBy]);

  const compareProducts = useMemo(
    () =>
      compareIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p)),
    [compareIds, products]
  );

  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    onAddToCart(product, product.variants[0] || 'Standard');
    setRecentlyAddedId(product.id);
    setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === product.id ? null : curr));
    }, 1100);
  };

  const showSectionSlides = selectedCategory === 'All' && !searchQuery.trim();

  return (
    <section id="catalog-section" className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8 lg:py-9">
      {/* Unified Single-Line Toolbar: Category Filter Tabs + Compact Search + Sort */}
      <div className="flex flex-col gap-2.5 border-b border-[#E6ECF4] pb-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-1">
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onSelectCategory(category)}
                  className={`relative rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-[#0F1B2D]' : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="catalog-category-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-lg border border-[#E6ECF4] bg-white shadow-xs"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1">
                    {category === 'Favorites' && (
                      <Heart className="h-3 w-3 text-[#EF4444] fill-[#EF4444]" />
                    )}
                    <span>{translateCategory(category)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-48 sm:flex-initial">
            <Search className={`pointer-events-none absolute ${isRtl ? 'right-2.5' : 'left-2.5'} top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7A8D]`} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('catalog.search')}
              aria-label="Search products"
              className={`h-8 w-full rounded-lg border border-[#D4DFEE] bg-[#F7FAFD] ${isRtl ? 'pr-8 pl-2.5' : 'pl-8 pr-2.5'} text-xs text-[#0F1B2D] placeholder:text-[#6B7A8D] focus:border-[#1180E1] focus:bg-white focus:outline-none`}
            />
          </div>

          <div className="relative flex items-center shrink-0">
            <ArrowUpDown className={`pointer-events-none absolute ${isRtl ? 'right-2.5' : 'left-2.5'} h-3.5 w-3.5 text-[#6B7A8D]`} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort products"
              className={`h-8 appearance-none rounded-lg border border-[#D4DFEE] bg-white ${isRtl ? 'pr-7 pl-7' : 'pl-7 pr-7'} text-xs font-semibold text-[#0F1B2D] transition-colors hover:border-[#1180E1]/60 focus:border-[#1180E1] focus:outline-none cursor-pointer`}
            >
              <option value="featured">{t('catalog.sortFeatured')}</option>
              <option value="price-asc">{t('catalog.sortPriceLow')}</option>
              <option value="price-desc">{t('catalog.sortPriceHigh')}</option>
              <option value="name-asc">{t('catalog.sortName')}</option>
              <option value="rating-desc">{t('catalog.sortFeatured')} (Rating)</option>
            </select>
            <ChevronDown className={`pointer-events-none absolute ${isRtl ? 'left-2' : 'right-2'} h-3.5 w-3.5 text-[#6B7A8D]`} />
          </div>

          {selectedCategory === 'Favorites' && favorites.length > 0 && onShareFavorites && (
            <button
              type="button"
              onClick={async () => {
                const url = onShareFavorites();
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  // Ignore clipboard restrictions
                }
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2200);
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                copiedShare
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-[#0F1B2D] text-white hover:bg-[#1180E1]'
              }`}
            >
              {copiedShare ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copiedShare ? 'Link Copied' : 'Share List'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Product Sections as Interactive Slides */}
      {showSectionSlides ? (
        <div className="mt-6 space-y-10">
          {sectionDecks.map((sec) => (
            <ProductSlideSection
              key={sec.key}
              title={lang === 'ar' ? DEPT_TRANSLATIONS[sec.key]?.title || sec.title : sec.title}
              subtitle={lang === 'ar' ? DEPT_TRANSLATIONS[sec.key]?.subtitle || sec.subtitle : sec.subtitle}
              items={sec.items}
              perSlide={perSlide}
              sortKey={sortBy}
              isFeaturedSection={sec.key === 'Featured'}
              onViewSection={() => onSelectCategory(sec.categoryTarget)}
              recentlyAddedId={recentlyAddedId}
              favorites={favorites}
              compareIds={compareIds}
              onSelectProduct={onSelectProduct}
              onQuickAdd={handleQuickAdd}
              onToggleFavorite={onToggleFavorite}
              onToggleCompare={onToggleCompare}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[#E6ECF4] bg-[#F7FAFD] p-8 text-center">
          <p className="font-display text-sm font-semibold text-[#0F1B2D]">
            {selectedCategory === 'Favorites'
              ? 'No favorite hardware saved yet'
              : 'No products matched your filter'}
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onSelectCategory('All');
            }}
            className="mt-3 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
          >
            Show All Sections
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <ProductSlideSection
            title={searchQuery.trim() ? `Results for "${searchQuery.trim()}"` : selectedCategory}
            subtitle="Swipe or use slide arrows to browse matching hardware"
            items={filtered}
            perSlide={perSlide}
            sortKey={sortBy}
            isFeaturedSection={selectedCategory === 'Featured'}
            recentlyAddedId={recentlyAddedId}
            favorites={favorites}
            compareIds={compareIds}
            onSelectProduct={onSelectProduct}
            onQuickAdd={handleQuickAdd}
            onToggleFavorite={onToggleFavorite}
            onToggleCompare={onToggleCompare}
          />
        </div>
      )}

      {/* Floating Side-by-Side Compare Tray */}
      <AnimatePresence>
        {compareProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-4 z-30 flex items-center gap-2.5 rounded-2xl border border-[#CBD8EA] bg-[#0F1B2D] px-3 py-2 text-white shadow-2xl shadow-black/30 max-w-[calc(100vw-5.5rem)]"
          >
            <div className="flex items-center gap-1.5">
              {compareProducts.map((cp) => (
                <div
                  key={cp.id}
                  className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white"
                >
                  <ProductVisual
                    visualKey={cp.visualKey}
                    imageUrl={cp.imageUrl}
                    alt={cp.name}
                    className="h-full w-full"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleCompare(cp.id)}
                    aria-label={`Remove ${cp.name}`}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-white cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="hidden sm:block text-xs">
              <p className="font-semibold text-white">{compareProducts.length}/3 Selected</p>
              <p className="text-[10px] text-[#94A3B8]">
                {compareProducts.length < 2 ? 'Pick 1 more to compare' : 'Ready to compare'}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenCompare}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1180E1] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] whitespace-nowrap cursor-pointer"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>{t('catalog.compare')} ({compareProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={onClearCompare}
              aria-label="Clear comparison tray"
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

