import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Menu,
  ShoppingCart,
  X,
  ChevronDown,
  ArrowRight,
  Search,
  Heart,
  Globe,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import type { Product, StoreCategory } from '../types';
import { ProductVisual } from './ProductVisual';
import { BrandLogo } from './BrandLogo';
import { useTranslation } from '../lib/i18n.tsx';

interface NavbarProps {
  categories: StoreCategory[];
  activeView: 'storefront' | 'admin';
  onNavigateView: (view: 'storefront' | 'admin') => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  cartCount: number;
  favoritesCount: number;
  onOpenCart: () => void;
  onOpenFavorites?: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  storeLogo?: string;
  storeName?: string;
  /** Logged-in staff user (non-customer) — shows Admin & Sign Out controls */
  staffUser?: { name: string; roleName: string } | null;
  onLogout?: () => void;
}


export function Navbar({
  categories,
  activeView,
  onNavigateView,
  selectedCategory,
  onSelectCategory,
  cartCount,
  favoritesCount,
  onOpenCart,
  onOpenFavorites,
  products,
  onSelectProduct,
  searchQuery,
  onSearchChange,
  storeLogo,
  storeName,
  staffUser,
  onLogout,
}: NavbarProps) {
  const { lang, toggleLang, isRtl, t, translateCategory } = useTranslation();
  const [megaDept, setMegaDept] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const megaProducts =
    megaDept && megaDept !== 'All'
      ? products.filter((p) => p.active && p.category === megaDept).slice(0, 4)
      : [];

  const quickSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.active &&
          (p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [products, searchQuery]);

  const handleCategoryClick = (category: string) => {
    onNavigateView('storefront');
    onSelectCategory(category);
    setMegaDept(null);
    setMobileOpen(false);
    setTimeout(() => {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-[#E6ECF4] bg-white/95 backdrop-blur-md"
        onMouseLeave={() => setMegaDept(null)}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: SBS Graphic Logo (Name Removed) */}
          <button
            type="button"
            aria-label="Sam Brand Store Home"
            onClick={() => {
              onNavigateView('storefront');
              onSelectCategory('All');
              onSearchChange('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="shrink-0 cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <BrandLogo variant="dark" showWordmark={false} logoUrl={storeLogo} storeName={storeName} />
          </button>

          {/* Zone 2: Clean single-line category links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#475569]">
            {categories.filter((category) => category.showInMenu).map((category) => {
              const isActive = activeView === 'storefront' && selectedCategory === category.name;
              return (
                <div
                  key={category.id}
                  className="relative py-2"
                >
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(category.name)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#1180E1] font-semibold'
                        : 'text-[#475569] hover:text-[#0F1B2D]'
                    }`}
                  >
                    <span>{category.menuLabel || translateCategory(category.name)}</span>
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Zone 3: Compact Search Icon + Favorites Quick Filter + Cart Icon + Language Switcher + Mobile Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Staff bar: visible when a staff member is browsing the storefront */}
            {staffUser && activeView === 'storefront' && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] px-2.5 py-1.5">
                <span className="text-[11px] font-semibold text-[#475569] truncate max-w-[90px]" title={staffUser.name}>
                  {staffUser.name}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateView('admin')}
                  title="Open Admin Dashboard"
                  aria-label="Open Admin Dashboard"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-[#1180E1] hover:bg-[#1180E1]/10 cursor-pointer transition-colors"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  {t('nav.admin')}
                </button>
                <div className="w-px h-3.5 bg-[#D4DFEE]" />
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('nav.signOut')}
                </button>
              </div>
            )}
            {/* Language Switcher Button with Translate Icon */}
            <button
              type="button"
              onClick={toggleLang}
              aria-label={`Change language to ${lang === 'en' ? 'Arabic' : 'English'}`}
              title={lang === 'en' ? 'تغيير اللغة إلى العربية (RTL)' : 'Switch language to English (LTR)'}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] px-2 sm:px-2.5 text-xs font-bold text-[#0F1B2D] transition-all hover:border-[#1180E1] hover:bg-white hover:text-[#1180E1] active:scale-[0.98] cursor-pointer"
            >
              <Globe className="h-4 w-4 text-[#1180E1]" />
              <span className="text-[11px] font-bold">{lang === 'en' ? 'العربية' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => !v);
                onNavigateView('storefront');
              }}
              aria-label="Search store"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                searchOpen
                  ? 'border-[#1180E1] bg-[#1180E1]/10 text-[#1180E1]'
                  : 'border-[#E6ECF4] bg-white text-[#0F1B2D] hover:border-[#1180E1]/50'
              }`}
            >
              <Search className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => (onOpenFavorites ? onOpenFavorites() : handleCategoryClick('Favorites'))}
              aria-label={`View favorites (${favoritesCount})`}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                selectedCategory === 'Favorites'
                  ? 'border-[#EF4444]/40 bg-[#FEF2F2] text-[#EF4444]'
                  : 'border-[#E6ECF4] bg-white text-[#0F1B2D] hover:border-[#EF4444]/40 hover:text-[#EF4444]'
              }`}
            >
              <Heart
                className={`h-4 w-4 ${selectedCategory === 'Favorites' ? 'fill-[#EF4444]' : ''}`}
              />
              {favoritesCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 font-mono text-[9px] font-bold text-white tabular-nums">
                  {favoritesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`Shopping cart with ${cartCount} items`}
              className="relative inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3 text-xs font-semibold text-white transition-all hover:bg-[#1180E1] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="font-mono tabular-nums">{cartCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6ECF4] bg-white text-[#0F1B2D] md:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Expandable Navbar Search Drawer */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-[#E6ECF4] bg-white px-4 py-3 shadow-md sm:px-6 lg:px-8"
            >
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7A8D]" />
                    <input
                      autoFocus
                      type="search"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSearchOpen(false);
                          document
                            .getElementById('catalog-section')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      placeholder="Search consoles, OLED monitors, headsets, SKUs..."
                      className="h-10 w-full rounded-lg border border-[#D4DFEE] bg-[#F7FAFD] pl-9 pr-3 text-xs text-[#0F1B2D] placeholder:text-[#6B7A8D] focus:border-[#1180E1] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      document
                        .getElementById('catalog-section')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="h-10 rounded-lg bg-[#1180E1] px-4 text-xs font-semibold text-white hover:bg-[#0D6BC0] whitespace-nowrap cursor-pointer"
                  >
                    Filter Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    aria-label="Close search"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E6ECF4] text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {quickSearchResults.length > 0 && (
                  <div className="mt-2.5 divide-y divide-[#F1F5F9] rounded-xl border border-[#E6ECF4] bg-[#F7FAFD]">
                    {quickSearchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          onSelectProduct(p);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white transition-colors cursor-pointer"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-9 w-11 shrink-0 overflow-hidden rounded border border-[#E6ECF4] bg-white">
                            <ProductVisual
                              visualKey={p.visualKey}
                              imageUrl={p.imageUrl}
                              alt={p.name}
                              className="h-full w-full"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[#0F1B2D]">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-[#6B7A8D]">
                              {p.brand} · {p.category}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#1180E1] tabular-nums">
                          ${p.price.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Hover Mega-Menu */}
        <AnimatePresence>
          {megaDept && megaProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="hidden md:block absolute left-0 right-0 top-16 border-b border-[#E6ECF4] bg-white shadow-lg"
            >
              <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-8 py-6">
                <div className="col-span-3 flex flex-col justify-between border-r border-[#E6ECF4] pr-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1180E1]">
                      Department
                    </p>
                    <h3 className="mt-1 font-display text-xl font-bold text-[#0F1B2D]">
                      {megaDept}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#6B7A8D]">
                      {categories.find((category) => category.name === megaDept)?.subtitle || ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(megaDept)}
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1180E1] hover:underline cursor-pointer"
                  >
                    <span>View all {megaDept}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="col-span-9 grid grid-cols-4 gap-4">
                  {megaProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setMegaDept(null);
                        onSelectProduct(p);
                      }}
                      className="group flex flex-col rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3 text-left transition-all hover:border-[#1180E1]/40 hover:bg-white cursor-pointer"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#E6ECF4] bg-white">
                        <ProductVisual
                          visualKey={p.visualKey}
                          imageUrl={p.imageUrl}
                          alt={p.name}
                          className="h-full w-full"
                        />
                      </div>
                      <p className="mt-2.5 font-display text-xs font-semibold text-[#0F1B2D] group-hover:text-[#1180E1] line-clamp-1">
                        {p.name}
                      </p>
                      <span className="mt-0.5 font-mono text-xs font-semibold text-[#1180E1] tabular-nums">
                        ${p.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Slide-Out Menu Drawer mounted outside backdrop-blur header so full-height opaque background renders reliably */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[70] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-[#08101C]/75 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 310 }}
              className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col bg-[#0F1B2D] text-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0B1524] px-5 py-4">
                <BrandLogo variant="light" showWordmark={false} logoUrl={storeLogo} storeName={storeName} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg border border-white/15 bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    toggleLang();
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white mb-3 cursor-pointer hover:bg-white/20"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#1180E1]" />
                    <span>{lang === 'en' ? 'اللغة: العربية' : 'Language: English'}</span>
                  </div>
                  <span className="text-xs font-bold text-[#1180E1] bg-white/10 px-2.5 py-1 rounded">
                    {lang === 'en' ? 'AR' : 'EN'}
                  </span>
                </button>

                {categories.filter((category) => category.showInMenu).map((category) => ({ id: category.name, label: category.menuLabel || translateCategory(category.name) })).map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryClick(cat.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1180E1] text-white shadow-md shadow-[#1180E1]/25'
                          : 'bg-white/5 text-[#E2E8F0] hover:bg-white/12 hover:text-white'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <ArrowRight className={`h-4 w-4 opacity-75 ${isRtl ? 'rotate-180' : ''}`} />
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 bg-[#0B1524] p-4">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onOpenCart();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1180E1] py-3 text-xs font-semibold text-white shadow-lg cursor-pointer"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{t('cart.title')} ({cartCount})</span>
                </button>
                {staffUser && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); onNavigateView('admin'); }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      {t('nav.admin')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMobileOpen(false); onLogout?.(); }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
