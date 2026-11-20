import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { api } from './lib/api';
import {
  appendVisitorLog,
  clearVisitorLog,
  getLocalOrderHistory,
  getRecentSearches,
  getVisitorLog,
  getVisitorMeta,
  recordBrowserSessionVisit,
  recordLocalOrder,
  recordRecentSearch,
  saveVisitorMeta,
  type LocalOrderSnapshot,
  type VisitorLogEntry,
  type VisitorMeta,
} from './lib/visitorHistory';
import type {
  AuthUser,
  CampaignBanner,
  CartItem,
  FlashSale,
  Order,
  Product,
  ProductReview,
} from './types';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { FlashSaleBanner } from './components/FlashSaleBanner';
import { CategoryStrip } from './components/CategoryStrip';
import { SectionDivider } from './components/SectionDivider';
import { CatalogSection } from './components/CatalogSection';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductCompareModal } from './components/ProductCompareModal';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { AuthModal } from './components/AuthModal';
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
import { MessageCircle } from 'lucide-react';
import { Footer } from './components/Footer';
import { useTranslation } from './lib/i18n';

const CART_STORAGE_KEY = 'sbs_shopping_bag';
const FAVORITES_STORAGE_KEY = 'sbs_favorites';
const RECENTLY_VIEWED_STORAGE_KEY = 'sbs_recently_viewed';
const COMPARE_STORAGE_KEY = 'sbs_compare_ids';
const PROMO_STORAGE_KEY = 'sbs_promo_code';

function isHiddenAdminRoute(): boolean {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path === '/sbs-admin' ||
    path === '/admin-portal' ||
    hash === '#sbs-admin' ||
    hash === '#admin'
  );
}

export default function App() {
  const { lang, t, translateProduct, translateProducts } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignBanner[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeView, setActiveView] = useState<'storefront' | 'admin'>('storefront');

  const [visitorMeta, setVisitorMeta] = useState<VisitorMeta>(() => getVisitorMeta());
  const [visitorLog, setVisitorLog] = useState<VisitorLogEntry[]>(() => getVisitorLog());
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [localOrders, setLocalOrders] = useState<LocalOrderSnapshot[]>(() => getLocalOrderHistory());

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => getVisitorMeta().lastCategory || 'All'
  );
  const [searchQuery, setSearchQuery] = useState<string>(() => getVisitorMeta().lastSearch || '');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activePromoCode, setActivePromoCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PROMO_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [storeWhatsapp, setStoreWhatsapp] = useState<string>('96171972495');
  const [storeName, setStoreName] = useState<string>('Sam Brand Store');
  const [storeLogo, setStoreLogo] = useState<string>('');

  const fetchStoreSettings = useCallback(() => {
    api
      .getPublicSettings()
      .then((s) => {
        if (s.whatsappNumber) setStoreWhatsapp(s.whatsappNumber);
        if (s.storeName) setStoreName(s.storeName);
        if (s.logoUrl !== undefined) setStoreLogo(s.logoUrl);
      })
      .catch(() => {});
  }, []);

  const [cartOpen, setCartOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [sharedWishlistIds, setSharedWishlistIds] = useState<string[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackerPreset, setTrackerPreset] = useState<{
    orderNumber: string;
    email: string;
  } | null>(null);

  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]).slice(0, 3) : [];
    } catch {
      return [];
    }
  });
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const { scrollYProgress } = useScroll();
  const scrollBarScale = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  // Record session visit on mount and sync persistent browser metadata
  useEffect(() => {
    const { meta, entries } = recordBrowserSessionVisit();
    setVisitorMeta(meta);
    setVisitorLog(entries);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage errors
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(recentlyViewedIds));
    } catch {
      // Ignore storage errors
    }
  }, [recentlyViewedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareIds));
    } catch {
      // Ignore storage errors
    }
  }, [compareIds]);

  useEffect(() => {
    try {
      if (activePromoCode) {
        localStorage.setItem(PROMO_STORAGE_KEY, activePromoCode);
      } else {
        localStorage.removeItem(PROMO_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [activePromoCode]);

  const searchDebounceRef = useRef<number | null>(null);
  const initialMountRef = useRef(true);

  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    const meta = saveVisitorMeta({ lastCategory: category, lastVisitAt: new Date().toISOString() });
    setVisitorMeta(meta);
    const nextLog = appendVisitorLog({
      kind: 'category',
      summary: `Browsed ${category} department`,
      category,
    });
    setVisitorLog(nextLog);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    const meta = saveVisitorMeta({ lastSearch: query, lastVisitAt: new Date().toISOString() });
    setVisitorMeta(meta);
  }, []);

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    const clean = searchQuery.trim();
    if (clean.length < 2) return;
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = window.setTimeout(() => {
      setRecentSearches(recordRecentSearch(clean));
      setVisitorLog(
        appendVisitorLog({
          kind: 'search',
          summary: `Searched for "${clean}"`,
          searchQuery: clean,
        })
      );
    }, 650);
    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  const toggleFavorite = useCallback(
    (productId: string) => {
      const target = products.find((p) => p.id === productId);
      setFavorites((prev) => {
        const adding = !prev.includes(productId);
        if (target) {
          setVisitorLog(
            appendVisitorLog({
              kind: 'favorite',
              summary: adding
                ? `Saved ${target.name} to favorites`
                : `Removed ${target.name} from favorites`,
              productId: target.id,
              category: target.category,
            })
          );
        }
        return adding ? [...prev, productId] : prev.filter((id) => id !== productId);
      });
    },
    [products]
  );

  const toggleCompare = useCallback(
    (productId: string) => {
      const target = products.find((p) => p.id === productId);
      setCompareIds((prev) => {
        if (prev.includes(productId)) {
          if (target) {
            setVisitorLog(
              appendVisitorLog({
                kind: 'compare',
                summary: `Removed ${target.name} from comparison`,
                productId: target.id,
              })
            );
          }
          return prev.filter((id) => id !== productId);
        }
        if (prev.length >= 3) {
          return prev;
        }
        if (target) {
          setVisitorLog(
            appendVisitorLog({
              kind: 'compare',
              summary: `Added ${target.name} to side-by-side compare`,
              productId: target.id,
            })
          );
        }
        return [...prev, productId];
      });
    },
    [products]
  );

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.getProducts();
      setProducts(res.products);
      setSelectedProduct((prev) =>
        prev ? res.products.find((p) => p.id === prev.id) || prev : null
      );
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Parse incoming ?wishlist=id1,id2,... share URL once products load
  const wishlistParamHandledRef = useRef(false);
  useEffect(() => {
    if (wishlistParamHandledRef.current || products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('wishlist');
    if (!raw) {
      wishlistParamHandledRef.current = true;
      return;
    }
    const validIds = Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter((id) => products.some((p) => p.id === id))
      )
    );
    wishlistParamHandledRef.current = true;
    if (validIds.length > 0) {
      setSharedWishlistIds(validIds);
      setFavoritesOpen(true);
      setVisitorLog(
        appendVisitorLog({
          kind: 'favorite',
          summary: `Opened shared wishlist (${validIds.length} items)`,
        })
      );
    }
  }, [products]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.getCampaigns();
      setCampaigns(res.campaigns);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  }, []);

  const fetchFlashSales = useCallback(async () => {
    try {
      const res = await api.getFlashSales();
      setFlashSales(res.flashSales);
    } catch (err) {
      console.error('Failed to fetch flash sales:', err);
    }
  }, []);

  const handleFlashSaleExpired = useCallback(() => {
    fetchFlashSales();
    fetchProducts();
  }, [fetchFlashSales, fetchProducts]);

  useEffect(() => {
    fetchProducts();
    fetchCampaigns();
    fetchFlashSales();
    fetchStoreSettings();
    api
      .me()
      .then((res) => {
        const staffUser =
          res.user && res.user.roleSlug !== 'customer' ? res.user : null;
        setUser(staffUser);
        if (isHiddenAdminRoute()) {
          if (staffUser) {
            setActiveView('admin');
          } else {
            setAuthOpen(true);
          }
        }
      })
      .catch(() => {
        setUser(null);
        if (isHiddenAdminRoute()) {
          setAuthOpen(true);
        }
      });
  }, [fetchProducts, fetchCampaigns, fetchFlashSales]);

  // Hidden Admin Login routing (/sbs-admin, #sbs-admin, #admin, or Alt+Shift+A) — never shown to regular shoppers
  useEffect(() => {
    const syncHiddenAdminRoute = () => {
      if (isHiddenAdminRoute()) {
        if (user && user.roleSlug !== 'customer') {
          setActiveView('admin');
        } else {
          setAuthOpen(true);
        }
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (user && user.roleSlug !== 'customer') {
          setActiveView('admin');
        } else {
          setAuthOpen(true);
        }
      }
    };
    syncHiddenAdminRoute();
    window.addEventListener('hashchange', syncHiddenAdminRoute);
    window.addEventListener('popstate', syncHiddenAdminRoute);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('hashchange', syncHiddenAdminRoute);
      window.removeEventListener('popstate', syncHiddenAdminRoute);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [user]);

  const handleInspectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setRecentlyViewedIds((prev) =>
      [product.id, ...prev.filter((id) => id !== product.id)].slice(0, 5)
    );
    setVisitorLog(
      appendVisitorLog({
        kind: 'view',
        summary: `Viewed ${product.name}`,
        detail: `${product.category} · $${product.price.toFixed(2)}`,
        productId: product.id,
        category: product.category,
      })
    );
  }, []);

  const localizedProducts = useMemo(
    () => translateProducts(products),
    [products, translateProducts]
  );

  const localizedSelectedProduct = useMemo(
    () => (selectedProduct ? translateProduct(selectedProduct) : null),
    [selectedProduct, translateProduct]
  );

  const localizedCart = useMemo(
    () => cart.map((i) => ({ ...i, product: translateProduct(i.product) })),
    [cart, translateProduct]
  );

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => localizedProducts.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p))
        .slice(0, 5),
    [recentlyViewedIds, localizedProducts]
  );

  const compareProducts = useMemo(
    () =>
      compareIds
        .map((id) => localizedProducts.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p)),
    [compareIds, localizedProducts]
  );

  const favoriteProducts = useMemo(
    () =>
      favorites
        .map((id) => localizedProducts.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p)),
    [favorites, localizedProducts]
  );

  const sharedWishlistProducts = useMemo(
    () =>
      sharedWishlistIds
        .map((id) => localizedProducts.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p)),
    [sharedWishlistIds, localizedProducts]
  );

  const handleGenerateShareUrl = useCallback(() => {
    const ids = favorites.join(',');
    const url = `${window.location.origin}/?wishlist=${encodeURIComponent(ids)}`;
    setVisitorLog(
      appendVisitorLog({
        kind: 'favorite',
        summary: `Generated shareable Favorites URL (${favorites.length} items)`,
      })
    );
    return url;
  }, [favorites]);

  const handleClearWishlistParamFromUrl = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('wishlist')) {
      url.searchParams.delete('wishlist');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  };

  const handleSaveSharedToFavorites = useCallback(() => {
    if (sharedWishlistIds.length === 0) return;
    setFavorites((prev) => Array.from(new Set([...prev, ...sharedWishlistIds])));
    setVisitorLog(
      appendVisitorLog({
        kind: 'favorite',
        summary: `Saved shared wishlist (${sharedWishlistIds.length} items)`,
      })
    );
    setSharedWishlistIds([]);
    handleClearWishlistParamFromUrl();
  }, [sharedWishlistIds]);

  const handleDismissShared = useCallback(() => {
    setSharedWishlistIds([]);
    handleClearWishlistParamFromUrl();
  }, []);

  const handleReviewSubmitted = useCallback(
    (product: Product, review: ProductReview) => {
      fetchProducts();
      setVisitorLog(
        appendVisitorLog({
          kind: 'review',
          summary: `Rated ${product.name} ${review.rating}/5 stars`,
          detail: review.title,
          productId: product.id,
          category: product.category,
        })
      );
    },
    [fetchProducts]
  );

  const handleAddToCart = (product: Product, variant?: string, openDrawer = false) => {
    const chosenVariant = variant || product.variants[0] || 'Standard';
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.product.id === product.id && i.variant === chosenVariant
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: Math.min(product.stock, next[idx].quantity + 1),
        };
        return next;
      }
      return [...prev, { product, variant: chosenVariant, quantity: 1 }];
    });
    setVisitorLog(
      appendVisitorLog({
        kind: 'cart',
        summary: `Added ${product.name} to bag`,
        detail: `Variant: ${chosenVariant} · $${product.price.toFixed(2)}`,
        productId: product.id,
        category: product.category,
      })
    );
    if (openDrawer) {
      setCartOpen(true);
    }
  };

  const handleUpdateQty = (productId: string, variant: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.variant === variant) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...item, quantity: Math.min(item.product.stock, nextQty) };
          }
          return item;
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const handleRemoveItem = (productId: string, variant: string) => {
    const target = cart.find(
      (i) => i.product.id === productId && i.variant === variant
    );
    setCart((prev) =>
      prev.filter((i) => !(i.product.id === productId && i.variant === variant))
    );
    if (target) {
      setVisitorLog(
        appendVisitorLog({
          kind: 'cart',
          summary: `Removed ${target.product.name} from bag`,
          detail: `Variant: ${variant}`,
          productId,
        })
      );
    }
  };

  const handleOrderCompleted = useCallback(
    (order: Order) => {
      fetchProducts();
      const updatedOrders = recordLocalOrder({
        orderNumber: order.orderNumber,
        email: order.customerEmail,
        total: order.total,
        createdAt: order.createdAt,
      });
      setLocalOrders(updatedOrders);
      setVisitorLog(
        appendVisitorLog({
          kind: 'order',
          summary: `Placed order ${order.orderNumber}`,
          detail: `$${order.total.toFixed(2)} · ${order.items.length} item(s)`,
        })
      );
    },
    [fetchProducts]
  );

  const handleClearVisitorHistory = useCallback(() => {
    setVisitorLog(clearVisitorLog());
    setRecentSearches([]);
  }, []);

  const handleCampaignAction = (campaign: CampaignBanner) => {
    if (campaign.promoCode) {
      setActivePromoCode(campaign.promoCode);
    }
    handleSelectCategory(campaign.targetCategory || 'All');
    setTimeout(() => {
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setActiveView('storefront');
    if (isHiddenAdminRoute()) {
      window.history.replaceState(null, '', '/');
    }
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-white text-[#0F1B2D] flex flex-col">
      {/* Subtle Top Scroll Progress Line */}
      {activeView === 'storefront' && (
        <motion.div
          style={{ scaleX: scrollBarScale }}
          className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-[#1180E1] via-[#3C9BF0] to-[#0F1B2D] pointer-events-none"
        />
      )}

      <Navbar
        activeView={activeView}
        onNavigateView={(view) => {
          if (view === 'admin' && (!user || user.roleSlug === 'customer')) {
            setAuthOpen(true);
            return;
          }
          setActiveView(view);
        }}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        cartCount={cartCount}
        favoritesCount={favorites.length}
        onOpenCart={() => setCartOpen(true)}
        onOpenFavorites={() => setFavoritesOpen(true)}
        products={localizedProducts}
        onSelectProduct={handleInspectProduct}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        storeLogo={storeLogo}
        storeName={storeName}
        staffUser={user && user.roleSlug !== 'customer' ? { name: user.name, roleName: user.roleName } : null}
        onLogout={handleLogout}
      />

      <AnimatePresence mode="wait">
        {activeView === 'admin' && user && user.roleSlug !== 'customer' ? (
          <motion.div
            key="admin-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <Suspense
              fallback={
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-6 py-4 shadow-xl backdrop-blur-md">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    <span className="text-sm font-medium tracking-wide text-slate-300">
                      Loading Admin Workspace...
                    </span>
                  </div>
                </div>
              }
            >
              <AdminDashboard
                user={user}
                onBackToStore={() => {
                  setActiveView('storefront');
                  if (isHiddenAdminRoute()) {
                    window.history.replaceState(null, '', '/');
                  }
                }}
                onCatalogChanged={fetchProducts}
                onCampaignsChanged={() => {
                  fetchCampaigns();
                  fetchFlashSales();
                }}
                onSwitchAccount={() => setAuthOpen(true)}
                onLogout={handleLogout}
                onStoreSettingsChanged={fetchStoreSettings}
              />
            </Suspense>
          </motion.div>
        ) : (
          <motion.main
            key="storefront-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <HeroSection
              campaigns={campaigns}
              products={localizedProducts}
              onCampaignAction={handleCampaignAction}
              onSelectProduct={handleInspectProduct}
            />

            <FlashSaleBanner
              flashSales={flashSales}
              onShopCategory={(category) => {
                handleSelectCategory(category);
                setTimeout(() => {
                  document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 60);
              }}
              onSaleExpired={handleFlashSaleExpired}
            />

            <SectionDivider variant="hero-to-categories" />

            <CategoryStrip
              products={localizedProducts}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
            />

            <SectionDivider variant="categories-to-catalog" />

            {loadingProducts ? (
              <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                    <div
                      key={i}
                      className="h-56 animate-pulse rounded-xl border border-[#E6ECF4] bg-[#F7FAFD]"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <CatalogSection
                products={localizedProducts}
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                onSelectProduct={handleInspectProduct}
                onAddToCart={(p, v) => handleAddToCart(p, v, false)}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
                onOpenCompare={() => setCompareModalOpen(true)}
                onClearCompare={() => setCompareIds([])}
                onShareFavorites={handleGenerateShareUrl}
              />
            )}

            <SectionDivider variant="catalog-to-footer" />

            <Footer
              onSelectCategory={handleSelectCategory}
              onOpenTracker={() => {
                setTrackerPreset(null);
                setTrackerOpen(true);
              }}
              recentlyViewed={recentlyViewedProducts}
              onSelectProduct={handleInspectProduct}
              onClearRecentlyViewed={() => setRecentlyViewedIds([])}
              products={localizedProducts}
              visitorMeta={visitorMeta}
              visitorLog={visitorLog}
              recentSearches={recentSearches}
              localOrders={localOrders}
              onSelectRecentSearch={(q) => {
                handleSearchChange(q);
                document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onQuickTrackOrder={(snap) => {
                setTrackerPreset({ orderNumber: snap.orderNumber, email: snap.email });
                setTrackerOpen(true);
              }}
              onClearVisitorLog={handleClearVisitorHistory}
              storeLogo={storeLogo}
              storeName={storeName}
            />
          </motion.main>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp Direct Chat & Contact Button (Storefront) */}
      {activeView === 'storefront' && (
        <a
          href={`https://wa.me/${storeWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
            lang === 'ar'
              ? 'مرحباً سام ستور، لدي استفسار بخصوص المنتجات.'
              : 'Hello Sam Brand Store, I have a question about a product.'
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          title={lang === 'ar' ? 'تواصل مع سام ستور عبر واتساب' : 'Chat with Sam Brand Store on WhatsApp'}
          className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-lg shadow-[#16A34A]/35 transition-transform hover:scale-105 hover:bg-[#15803D] active:scale-95"
        >
          <MessageCircle className="h-6 w-6 fill-white/15" />
        </a>
      )}

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={localizedSelectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        isFavorite={selectedProduct ? favorites.includes(selectedProduct.id) : false}
        onToggleFavorite={toggleFavorite}
        isCompared={selectedProduct ? compareIds.includes(selectedProduct.id) : false}
        onToggleCompare={toggleCompare}
        onReviewSubmitted={handleReviewSubmitted}
      />

      <FavoritesDrawer
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        items={favoriteProducts}
        sharedItems={sharedWishlistProducts}
        compareIds={compareIds}
        onToggleFavorite={toggleFavorite}
        onToggleCompare={toggleCompare}
        onInspectProduct={handleInspectProduct}
        onMoveToCart={(p) => handleAddToCart(p, p.variants[0] || 'Standard', false)}
        onMoveAllToCart={() => {
          favoriteProducts
            .filter((p) => p.stock > 0)
            .forEach((p) => handleAddToCart(p, p.variants[0] || 'Standard', false));
          setFavoritesOpen(false);
          setCartOpen(true);
        }}
        onSaveSharedToFavorites={handleSaveSharedToFavorites}
        onDismissShared={handleDismissShared}
        onGenerateShareUrl={handleGenerateShareUrl}
      />

      <ProductCompareModal
        open={compareModalOpen}
        products={compareProducts}
        onClose={() => setCompareModalOpen(false)}
        onRemoveProduct={(id) =>
          setCompareIds((prev) => prev.filter((item) => item !== id))
        }
        onClearAll={() => setCompareIds([])}
        onAddToCart={(p, v) => handleAddToCart(p, v, false)}
        onInspectProduct={handleInspectProduct}
      />

      <CartCheckoutDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={localizedCart}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
        onOrderCompleted={handleOrderCompleted}
        user={user}
        initialPromoCode={activePromoCode}
      />

      <OrderTrackerModal
        open={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        initialOrder={trackerPreset}
      />

      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          if (isHiddenAdminRoute()) {
            window.history.replaceState(null, '', '/');
          }
        }}
        user={user}
        onAuthenticated={(u) => {
          setUser(u);
          if (u.roleSlug !== 'customer') {
            setActiveView('admin');
          }
        }}
        onLogout={handleLogout}
        onOpenAdmin={() => setActiveView('admin')}
      />
    </div>
  );
}

