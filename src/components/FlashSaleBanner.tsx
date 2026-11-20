import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Clock, Zap } from 'lucide-react';
import type { FlashSale, FlashSaleTheme } from '../types';
import { useTranslation } from '../lib/i18n';

interface FlashSaleBannerProps {
  flashSales: FlashSale[];
  onShopCategory: (category: string) => void;
  onSaleExpired: () => void;
}

const FLASH_THEMES: Record<
  FlashSaleTheme,
  {
    container: string;
    badge: string;
    discountPill: string;
    timerBox: string;
    cta: string;
    subtext: string;
  }
> = {
  crimson: {
    container:
      'bg-gradient-to-r from-[#7F1D1D] via-[#991B1B] to-[#0F1B2D] border-[#EF4444]/35 text-white',
    badge: 'bg-white text-[#991B1B]',
    discountPill: 'bg-[#FEF2F2]/15 border-[#FCA5A5]/35 text-[#FECACA]',
    timerBox: 'border-white/20 bg-black/25 text-white',
    cta: 'bg-white text-[#7F1D1D] hover:bg-[#FEF2F2]',
    subtext: 'text-white/85',
  },
  navy: {
    container:
      'bg-gradient-to-r from-[#0F1B2D] via-[#13294B] to-[#0B1524] border-[#3C9BF0]/30 text-white',
    badge: 'bg-[#1180E1] text-white',
    discountPill: 'bg-[#1180E1]/20 border-[#60B2FF]/40 text-[#BAE6FD]',
    timerBox: 'border-white/15 bg-white/8 text-white',
    cta: 'bg-[#1180E1] text-white hover:bg-[#0D6BC0]',
    subtext: 'text-[#CBD5E1]',
  },
  cobalt: {
    container:
      'bg-gradient-to-r from-[#0D4F91] via-[#1180E1] to-[#0F1B2D] border-[#60B2FF]/40 text-white',
    badge: 'bg-white text-[#0D4F91]',
    discountPill: 'bg-[#0F1B2D]/30 border-white/25 text-white',
    timerBox: 'border-white/20 bg-[#0F1B2D]/35 text-white',
    cta: 'bg-white text-[#0F1B2D] hover:bg-[#F1F5F9]',
    subtext: 'text-white/90',
  },
  obsidian: {
    container:
      'bg-gradient-to-r from-[#090D16] via-[#172033] to-[#111827] border-white/15 text-white',
    badge: 'bg-[#F59E0B] text-[#0F1B2D]',
    discountPill: 'bg-[#F59E0B]/15 border-[#FBBF24]/35 text-[#FDE68A]',
    timerBox: 'border-white/15 bg-white/8 text-white',
    cta: 'bg-[#F59E0B] text-[#0F1B2D] hover:bg-[#D97706] hover:text-white',
    subtext: 'text-[#CBD5E1]',
  },
};

export function formatCountdownParts(expiresAtIso: string, nowMs: number) {
  const diff = Math.max(0, new Date(expiresAtIso).getTime() - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return {
    expired: diff <= 0,
    days,
    hours,
    minutes,
    seconds,
    pad: (n: number) => String(n).padStart(2, '0'),
  };
}

export function FlashSaleBanner({
  flashSales,
  onShopCategory,
  onSaleExpired,
}: FlashSaleBannerProps) {
  const { t, isRtl, translateCategory } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const expiredNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (flashSales.length === 0) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [flashSales.length]);

  const liveSales = useMemo(
    () =>
      flashSales.filter((s) => {
        if (!s.active) return false;
        const startMs = new Date(s.startsAt).getTime();
        const expMs = new Date(s.expiresAt).getTime();
        return Number.isFinite(expMs) && expMs > nowMs && (!Number.isFinite(startMs) || startMs <= nowMs);
      }),
    [flashSales, nowMs]
  );

  useEffect(() => {
    let triggered = false;
    for (const s of flashSales) {
      const expMs = new Date(s.expiresAt).getTime();
      if (s.active && Number.isFinite(expMs) && expMs <= nowMs && !expiredNotifiedRef.current.has(s.id)) {
        expiredNotifiedRef.current.add(s.id);
        triggered = true;
      }
    }
    if (triggered) {
      onSaleExpired();
    }
  }, [flashSales, nowMs, onSaleExpired]);

  useEffect(() => {
    if (selectedIdx >= liveSales.length) {
      setSelectedIdx(0);
    }
  }, [liveSales.length, selectedIdx]);

  if (liveSales.length === 0) return null;

  const activeSale = liveSales[selectedIdx] || liveSales[0];
  const theme = FLASH_THEMES[activeSale.designTheme] || FLASH_THEMES.crimson;
  const countdown = formatCountdownParts(activeSale.expiresAt, nowMs);

  return (
    <section aria-label="Active Flash Sales" className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`relative overflow-hidden rounded-2xl border shadow-lg ${theme.container}`}
      >
        {liveSales.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/15 bg-black/20 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 shrink-0 mr-1">
              {liveSales.length} Live Flash Drops:
            </span>
            {liveSales.map((s, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'bg-white text-[#0F1B2D]' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  <span>
                    -{s.discountPct}% {s.targetCategory}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSale.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 px-4 py-3.5 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between"
          >
            {/* Left Copy & Category Discount Chip */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${theme.badge}`}
                >
                  <Zap className="h-3 w-3 fill-current" />
                  <span>{activeSale.badgeLabel || 'FLASH SALE'}</span>
                </span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums whitespace-nowrap ${theme.discountPill}`}
                >
                  -{activeSale.discountPct}% OFF{' '}
                  {activeSale.targetCategory === 'All'
                    ? 'ALL HARDWARE'
                    : activeSale.targetCategory.toUpperCase()}
                </span>
              </div>

              <h2 className="mt-1.5 font-display text-base sm:text-lg font-bold tracking-tight text-white">
                {activeSale.title}
              </h2>
              {activeSale.subtitle && (
                <p className={`mt-0.5 text-xs leading-relaxed line-clamp-2 ${theme.subtext}`}>
                  {activeSale.subtitle}
                </p>
              )}
            </div>

            {/* Right Live Countdown + CTA */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-white/80 hidden sm:block mr-0.5" />
                {countdown.days > 0 && (
                  <div
                    className={`flex min-w-[44px] flex-col items-center rounded-lg border px-2 py-1 ${theme.timerBox}`}
                  >
                    <span className="font-mono text-sm font-bold leading-none tabular-nums">
                      {countdown.pad(countdown.days)}
                    </span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-75">
                      {t('flash.days')}
                    </span>
                  </div>
                )}
                <div
                  className={`flex min-w-[44px] flex-col items-center rounded-lg border px-2 py-1 ${theme.timerBox}`}
                >
                  <span className="font-mono text-sm font-bold leading-none tabular-nums">
                    {countdown.pad(countdown.hours)}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-75">
                    {t('flash.hours')}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-white/60">:</span>
                <div
                  className={`flex min-w-[44px] flex-col items-center rounded-lg border px-2 py-1 ${theme.timerBox}`}
                >
                  <span className="font-mono text-sm font-bold leading-none tabular-nums">
                    {countdown.pad(countdown.minutes)}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-75">
                    {t('flash.minutes')}
                  </span>
                </div>
                <span className="font-mono text-sm font-bold text-white/60">:</span>
                <div
                  className={`flex min-w-[44px] flex-col items-center rounded-lg border px-2 py-1 ${theme.timerBox}`}
                >
                  <span className="font-mono text-sm font-bold leading-none tabular-nums">
                    {countdown.pad(countdown.seconds)}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-75">
                    {t('flash.seconds')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onShopCategory(activeSale.targetCategory)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${theme.cta}`}
              >
                <span>
                  {t('flash.claimDeal')} · {translateCategory(activeSale.targetCategory)}
                </span>
                <ArrowRight className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
