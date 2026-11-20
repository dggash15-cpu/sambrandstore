import { motion } from 'motion/react';
import type { Product } from '../types';
import { useTranslation } from '../lib/i18n.tsx';

interface CategoryStripProps {
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

interface CategoryCardDef {
  id: string;
  label: string;
  subtitle: string;
  imageUrl: string;
}

const CATEGORY_CARDS: CategoryCardDef[] = [
  {
    id: 'All',
    label: 'All Gear',
    subtitle: 'Full Lineup',
    imageUrl: '/src/assets/images/hero_esports_desk.jpg',
  },
  {
    id: 'Consoles',
    label: 'Consoles',
    subtitle: '4K & Handheld',
    imageUrl: '/src/assets/images/cat_consoles.jpg',
  },
  {
    id: 'Monitors',
    label: 'Monitors',
    subtitle: '240Hz QD-OLED',
    imageUrl: '/src/assets/images/asus_curved_monitor.jpg',
  },
  {
    id: 'Audio',
    label: 'Audio',
    subtitle: 'Spatial & Studio',
    imageUrl: '/src/assets/images/headset_pro.jpg',
  },
  {
    id: 'Peripherals',
    label: 'Peripherals',
    subtitle: 'CNC & 49g Mice',
    imageUrl: '/src/assets/images/keyboard_cnc.jpg',
  },
  {
    id: 'Accessories',
    label: 'Accessories',
    subtitle: 'Pro Docks & Pads',
    imageUrl: '/src/assets/images/controller_dualsense_pro.jpg',
  },
  {
    id: 'Featured',
    label: 'Flagship Picks',
    subtitle: 'Curated Drops',
    imageUrl: '/src/assets/images/handheld_oled_pro.jpg',
  },
  {
    id: 'Deals',
    label: 'Special Offers',
    subtitle: 'Price Drops',
    imageUrl: '/src/assets/images/ultrawide_curved_pro.jpg',
  },
  {
    id: 'Favorites',
    label: 'Saved Gear',
    subtitle: 'Your Favorites',
    imageUrl: '/src/assets/images/mouse_wireless_pro.jpg',
  },
  {
    id: 'Xbox',
    label: 'Console Bundles',
    subtitle: '2TB Editions',
    imageUrl: '/src/assets/images/xbox_galaxy_pro.jpg',
  },
];

const CATEGORY_SUBTITLES_AR: Record<string, string> = {
  All: 'التشكيلة الكاملة',
  Consoles: '4K والمحمولة',
  Monitors: '240 هرتز QD-OLED',
  Audio: 'صوت مكاني واستوديو',
  Peripherals: 'ألمنيوم وفأرة 49غ',
  Accessories: 'قواعد ومنصات احترافية',
  Featured: 'إصدارات منتقاة',
  Deals: 'تخفيضات أسعار',
  Favorites: 'منتجاتك المحفوظة',
  Xbox: 'نسخ 2 تيرابايت',
};

export function CategoryStrip({
  products,
  selectedCategory,
  onSelectCategory,
}: CategoryStripProps) {
  const { translateCategory, lang, isRtl } = useTranslation();
  const countFor = (catId: string): number => {
    const active = products.filter((p) => p.active);
    if (catId === 'All') return active.length;
    if (catId === 'Featured') return active.filter((p) => p.featured).length;
    if (catId === 'Deals') {
      return active.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price).length;
    }
    if (catId === 'Xbox') {
      return active.filter((p) => p.category === 'Consoles').length;
    }
    if (catId === 'Favorites') {
      try {
        const raw = localStorage.getItem('sbs_favorites');
        return raw ? (JSON.parse(raw) as string[]).length : 0;
      } catch {
        return 0;
      }
    }
    return active.filter((p) => p.category === catId).length;
  };

  const handleSelect = (catId: string) => {
    const targetCat = catId === 'Xbox' ? 'Consoles' : catId;
    onSelectCategory(targetCat);
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      aria-label="Product Categories"
      className="bg-gradient-to-b from-[#F7FAFD] to-[#F7FAFD] py-4 sm:py-5"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 2-Line Finger-Swipeable Category Grid (no heading text or arrow buttons) */}
        <div className="grid grid-flow-col grid-rows-2 auto-cols-[minmax(160px,1fr)] sm:auto-cols-[minmax(196px,1fr)] gap-2.5 overflow-x-auto pb-1.5 pt-0.5 touch-pan-x snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORY_CARDS.map((cat, idx) => {
            const targetId = cat.id === 'Xbox' ? 'Consoles' : cat.id;
            const active = selectedCategory === targetId && (cat.id !== 'Xbox' || selectedCategory === 'Consoles');
            const count = countFor(cat.id);

            return (
              <motion.button
                key={cat.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 0.24,
                  delay: Math.min(idx * 0.025, 0.2),
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelect(cat.id)}
                className={`group relative flex shrink-0 snap-start items-center gap-2.5 rounded-xl border p-2 pr-3 transition-all cursor-pointer ${
                  isRtl ? 'text-right' : 'text-left'
                } ${
                  active
                    ? 'border-[#1180E1] bg-white shadow-sm shadow-[#1180E1]/15'
                    : 'border-[#E6ECF4] bg-white/95 hover:border-[#BFD0E6] hover:bg-white'
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#E6ECF4] bg-[#F1F5F9]">
                  <img
                    src={cat.imageUrl}
                    alt={cat.label}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`truncate font-display text-xs font-bold transition-colors ${
                        active ? 'text-[#1180E1]' : 'text-[#0F1B2D] group-hover:text-[#1180E1]'
                      }`}
                    >
                      {translateCategory(cat.id)}
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-[#6B7A8D] tabular-nums">
                      {count}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[#6B7A8D]">
                    {lang === 'ar' ? CATEGORY_SUBTITLES_AR[cat.id] || cat.subtitle : cat.subtitle}
                  </p>
                </div>

                {active && (
                  <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-[#1180E1]" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
