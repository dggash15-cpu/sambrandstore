import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Tag,
  ArrowUpRight,
} from 'lucide-react';
import type { CampaignBanner, Product } from '../types';
import { ProductVisual } from './ProductVisual';
import { useTranslation } from '../lib/i18n.tsx';

interface HeroSectionProps {
  campaigns: CampaignBanner[];
  products: Product[];
  onCampaignAction: (campaign: CampaignBanner) => void;
  onSelectProduct: (product: Product) => void;
}

const SLIDE_DURATION_MS = 6500;

const THEME_STYLES: Record<
  CampaignBanner['designTheme'],
  {
    card: string;
    glow: string;
    tag: string;
    title: string;
    subtitle: string;
    cta: string;
    visualSurface: boolean;
  }
> = {
  navy: {
    card: 'bg-gradient-to-br from-[#0F1B2D] via-[#13243E] to-[#0B1524] border-white/10 text-white',
    glow: 'radial-gradient(circle at 75% 30%, rgba(17,128,225,0.28), transparent 58%)',
    tag: 'text-[#60B2FF]',
    title: 'text-white',
    subtitle: 'text-white/90',
    cta: 'bg-[#1180E1] text-white hover:bg-[#0D6BC0] shadow-lg shadow-[#1180E1]/25',
    visualSurface: true,
  },
  cobalt: {
    card: 'bg-gradient-to-br from-[#0D4F91] via-[#10386B] to-[#0B1524] border-[#3C9BF0]/25 text-white',
    glow: 'radial-gradient(circle at 72% 28%, rgba(96,178,255,0.34), transparent 58%)',
    tag: 'text-[#BAE6FD]',
    title: 'text-white',
    subtitle: 'text-white/95',
    cta: 'bg-white text-[#0F1B2D] hover:bg-[#F1F5F9] shadow-lg shadow-black/20',
    visualSurface: true,
  },
  obsidian: {
    card: 'bg-gradient-to-br from-[#111827] via-[#172033] to-[#090F1A] border-white/10 text-white',
    glow: 'radial-gradient(circle at 75% 35%, rgba(56,189,248,0.22), transparent 55%)',
    tag: 'text-[#60A5FA]',
    title: 'text-white',
    subtitle: 'text-white/90',
    cta: 'bg-[#1180E1] text-white hover:bg-[#0D6BC0] shadow-lg shadow-[#1180E1]/20',
    visualSurface: true,
  },
  chalk: {
    card: 'bg-gradient-to-br from-[#FFFFFF] via-[#F7FAFD] to-[#EBF2FA] border-[#D4DFEE] text-[#0F1B2D]',
    glow: 'radial-gradient(circle at 78% 28%, rgba(17,128,225,0.12), transparent 55%)',
    tag: 'text-[#1180E1]',
    title: 'text-[#0F1B2D]',
    subtitle: 'text-[#475569]',
    cta: 'bg-[#0F1B2D] text-white hover:bg-[#1180E1] shadow-md shadow-[#0F1B2D]/15',
    visualSurface: false,
  },
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 56 : -56,
    opacity: 0,
    scale: 0.965,
    filter: 'blur(6px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -56 : 56,
    opacity: 0,
    scale: 0.965,
    filter: 'blur(6px)',
  }),
};

export function HeroSection({
  campaigns,
  products,
  onCampaignAction,
  onSelectProduct,
}: HeroSectionProps) {
  const { isRtl, t } = useTranslation();
  const slides = useMemo(() => campaigns.filter((c) => c.active), [campaigns]);
  const [[activeIdx, direction], setSlideState] = useState<[number, number]>([0, 1]);
  const [isPaused, setIsPaused] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const stageParallaxY = useTransform(scrollYProgress, [0, 1], [0, 22]);
  const visualParallaxY = useTransform(scrollYProgress, [0, 1], [0, -16]);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(useTransform(pointerY, [-0.5, 0.5], [4, -4]), {
    stiffness: 180,
    damping: 22,
  });
  const tiltY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-5, 5]), {
    stiffness: 180,
    damping: 22,
  });

  useEffect(() => {
    setSlideState([0, 1]);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setSlideState(([prev]) => [(prev + 1) % slides.length, 1]);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const goToSlide = (targetIdx: number) => {
    if (slides.length <= 1) return;
    const safeIdx = ((targetIdx % slides.length) + slides.length) % slides.length;
    setSlideState(([prev]) => {
      const dir = safeIdx >= prev ? 1 : -1;
      return [safeIdx, dir];
    });
  };

  const stepSlide = (delta: number) => {
    if (slides.length <= 1) return;
    setSlideState(([prev]) => {
      const next = (prev + delta + slides.length) % slides.length;
      return [next, delta >= 0 ? 1 : -1];
    });
  };

  const current: CampaignBanner = slides[activeIdx] || {
    id: 'default-hero',
    placement: 'hero',
    designTheme: 'navy',
    sectionSize: 'split',
    offerTag: 'Flagship Collection',
    title: 'Next-Gen Consoles & 240Hz OLED Displays',
    subtitle:
      'Tournament-grade gaming hardware, studio audio, and precision CNC peripherals with express WhatsApp checkout.',
    ctaLabel: 'Shop Flagship Drops',
    promoCode: 'SAM10',
    targetCategory: 'All',
    desktopImageUrl: '/src/assets/images/hero_esports_desk.jpg',
    mobileImageUrl: '/src/assets/images/hero_esports_desk.jpg',
    visualKey: 'console-pro',
    sortOrder: 1,
    active: true,
    createdAt: '',
    updatedAt: '',
  };

  const spotlightProduct = useMemo(() => {
    const activeProds = products.filter((p) => p.active && p.stock > 0);
    if (activeProds.length === 0) return null;
    if (current.targetCategory && current.targetCategory !== 'All') {
      const match = activeProds.find(
        (p) => p.category.toLowerCase() === current.targetCategory.toLowerCase()
      );
      if (match) return match;
    }
    return activeProds.find((p) => p.visualKey === current.visualKey) || activeProds[0];
  }, [products, current.targetCategory, current.visualKey]);

  const theme = THEME_STYLES[current.designTheme] || THEME_STYLES.navy;
  const isCompact = current.sectionSize === 'compact';
  const isFull = current.sectionSize === 'full';
  const isLightTheme = current.designTheme === 'chalk';

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(nx);
    pointerY.set(ny);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <section
      ref={sectionRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        resetPointer();
      }}
      className="relative overflow-hidden bg-gradient-to-b from-[#08101C] via-[#0F1B2D] to-[#0B1524] pt-4 pb-5 sm:pt-6 sm:pb-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(17,128,225,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.10),transparent_55%)]"
      />

      <motion.div
        style={{ y: stageParallaxY }}
        className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B1524] shadow-2xl shadow-black/40">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
              style={{ backgroundImage: theme.glow }}
              className={`relative border-0 ${theme.card} ${
                isCompact ? 'p-4 sm:p-6 lg:p-8' : 'p-4 sm:p-7 lg:p-10'
              }`}
            >
              {isFull ? (
                <div className="flex flex-col gap-5 sm:gap-6">
                  <motion.div
                    style={{ y: visualParallaxY }}
                    className="order-1 relative overflow-hidden rounded-xl border border-white/15 bg-[#08101C]"
                  >
                    <div className="block md:hidden aspect-[4/3] w-full">
                      <ProductVisual
                        visualKey={current.visualKey}
                        imageUrl={current.mobileImageUrl || current.desktopImageUrl}
                        alt={current.title}
                        darkSurface={theme.visualSurface}
                        className="h-full w-full"
                      />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.035, 1] }}
                      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                      className="hidden md:block aspect-[21/8] w-full"
                    >
                      <ProductVisual
                        visualKey={current.visualKey}
                        imageUrl={current.desktopImageUrl || current.mobileImageUrl}
                        alt={current.title}
                        darkSurface={theme.visualSurface}
                        className="h-full w-full"
                      />
                    </motion.div>

                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
                    />
                  </motion.div>

                  <div className="order-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.34, delay: 0.08 }}
                      className="max-w-2xl"
                    >
                      <p className={`text-xs font-semibold uppercase tracking-wider ${theme.tag}`}>
                        {current.offerTag}
                      </p>
                      <h1
                        className={`mt-1.5 font-display font-bold tracking-tight [text-wrap:balance] ${
                          isCompact
                            ? 'text-2xl sm:text-3xl'
                            : 'text-[clamp(1.65rem,3.3vw,2.65rem)] leading-[1.08]'
                        } ${theme.title}`}
                      >
                        {current.title}
                      </h1>
                      <p className={`mt-2 text-sm leading-relaxed ${theme.subtitle}`}>
                        {current.subtitle}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.34, delay: 0.14 }}
                      className="flex flex-wrap items-center gap-3 shrink-0"
                    >
                      {current.promoCode && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-current/20 px-3 py-2 font-mono text-xs font-semibold opacity-90">
                          <Tag className="h-3.5 w-3.5" />
                          <span>{t('hero.code')} {current.promoCode}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onCampaignAction(current)}
                        className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${theme.cta}`}
                      >
                        <span>{current.ctaLabel}</span>
                        <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                      </button>
                    </motion.div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-10">
                  {/* Visual Block: order-1 on mobile, order-2 on desktop */}
                  <div
                    onPointerMove={handlePointerMove}
                    onPointerLeave={resetPointer}
                    className="order-1 lg:order-2 lg:col-span-6 [perspective:1100px]"
                  >
                    <div className="block md:hidden overflow-hidden rounded-xl border border-white/15 aspect-[4/3] w-full shadow-lg">
                      <ProductVisual
                        visualKey={current.visualKey}
                        imageUrl={current.mobileImageUrl || current.desktopImageUrl}
                        alt={current.title}
                        darkSurface={theme.visualSurface}
                        className="h-full w-full"
                      />
                    </div>

                    <motion.div
                      style={{
                        rotateX: tiltX,
                        rotateY: tiltY,
                        y: visualParallaxY,
                        transformStyle: 'preserve-3d',
                      }}
                      className={`hidden md:block relative overflow-hidden rounded-xl border border-white/15 w-full shadow-2xl ${
                        isCompact ? 'aspect-[16/9]' : 'aspect-[16/10]'
                      }`}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.045, 1] }}
                        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                        className="h-full w-full"
                      >
                        <ProductVisual
                          visualKey={current.visualKey}
                          imageUrl={current.desktopImageUrl || current.mobileImageUrl}
                          alt={current.title}
                          darkSurface={theme.visualSurface}
                          className="h-full w-full"
                        />
                      </motion.div>

                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08101C]/70 via-transparent to-transparent"
                      />

                      {spotlightProduct && (
                        <button
                          type="button"
                          onClick={() => onSelectProduct(spotlightProduct)}
                          className="group absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-[#0B1524]/80 px-3.5 py-2.5 text-left backdrop-blur-md transition-all hover:border-[#3C9BF0]/60 hover:bg-[#0B1524]/95 cursor-pointer"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-white">
                              <ProductVisual
                                visualKey={spotlightProduct.visualKey}
                                imageUrl={spotlightProduct.imageUrl}
                                alt={spotlightProduct.name}
                                className="h-full w-full"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-display text-xs font-bold text-white group-hover:text-[#60B2FF]">
                                {spotlightProduct.name}
                              </p>
                              <p className="text-[11px] text-[#CBD5E1]">
                                {spotlightProduct.brand} ·{' '}
                                <span className="font-mono font-bold text-white tabular-nums">
                                  ${spotlightProduct.price.toFixed(2)}
                                </span>
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white group-hover:bg-[#1180E1]">
                            <span>{t('hero.inspect')}</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      )}
                    </motion.div>
                  </div>

                  {/* Text + CTA Block: order-2 on mobile (under image), order-1 on desktop */}
                  <div className="order-2 lg:order-1 lg:col-span-6 flex flex-col justify-center">
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.06 }}
                      className={`text-xs font-semibold uppercase tracking-wider ${theme.tag}`}
                    >
                      {current.offerTag}
                    </motion.p>

                    <motion.h1
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.34, delay: 0.12 }}
                      className={`mt-2 max-w-xl font-display font-bold tracking-tight [text-wrap:balance] ${
                        isCompact
                          ? 'text-2xl sm:text-3xl leading-[1.12]'
                          : 'text-[clamp(1.75rem,3.5vw,2.95rem)] leading-[1.06]'
                      } ${theme.title}`}
                    >
                      {current.title}
                    </motion.h1>

                    <motion.p
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.34, delay: 0.18 }}
                      className={`mt-3 max-w-lg text-sm sm:text-base leading-relaxed ${theme.subtitle}`}
                    >
                      {current.subtitle}
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.34, delay: 0.24 }}
                      className="mt-6 flex flex-wrap items-center gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onCampaignAction(current)}
                        className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${theme.cta}`}
                      >
                        <span>{current.ctaLabel}</span>
                        <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                      </button>

                      {current.promoCode && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 font-mono text-xs font-semibold ${
                            isLightTheme
                              ? 'border-[#0F1B2D]/20 text-[#0F1B2D] bg-white/70'
                              : 'border-white/20 text-white/95 bg-white/5'
                          }`}
                        >
                          <Tag className="h-3.5 w-3.5 text-[#3C9BF0]" />
                          <span>{t('hero.useCode')} {current.promoCode}</span>
                        </span>
                      )}
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Animated Auto-Advance Progress Line */}
              {slides.length > 1 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
                  {!isPaused && (
                    <motion.div
                      key={`${current.id}-${activeIdx}-progress`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: SLIDE_DURATION_MS / 1000, ease: 'linear' }}
                      style={{ transformOrigin: '0% 50%' }}
                      className="h-full w-full bg-gradient-to-r from-[#1180E1] via-[#3C9BF0] to-[#60B2FF]"
                    />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Interactive Slide Deck Selector Rail */}
          {slides.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0A1423]/95 px-3 py-2.5 sm:px-4">
              <div className="flex flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {slides.map((s, idx) => {
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToSlide(idx)}
                      className={`group relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-lg border px-2.5 py-1.5 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-[#3C9BF0]/60 bg-[#132540] text-white'
                          : 'border-transparent bg-white/5 text-[#94A3B8] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="h-7 w-10 shrink-0 overflow-hidden rounded border border-white/10 bg-[#0F1B2D]">
                        <ProductVisual
                          visualKey={s.visualKey}
                          imageUrl={s.desktopImageUrl || s.mobileImageUrl}
                          alt={s.title}
                          darkSurface
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 max-w-[140px]">
                        <p className="font-mono text-[10px] font-semibold text-[#60B2FF]">
                          0{idx + 1} · {s.targetCategory}
                        </p>
                        <p className="truncate text-[11px] font-medium">{s.title}</p>
                      </div>
                      {active && (
                        <motion.span
                          layoutId="hero-rail-active"
                          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                          className="absolute inset-x-0 bottom-0 h-0.5 bg-[#3C9BF0]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-[#CBD5E1] hover:border-[#3C9BF0] hover:text-white cursor-pointer"
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => stepSlide(-1)}
                  aria-label="Previous slide"
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-[#CBD5E1] hover:border-[#3C9BF0] hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => stepSlide(1)}
                  aria-label="Next slide"
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-[#CBD5E1] hover:border-[#3C9BF0] hover:text-white cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
