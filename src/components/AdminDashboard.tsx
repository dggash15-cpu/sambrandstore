import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Package,
  ShoppingCart,
  Users,
  ShieldAlert,
  Plus,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Check,
  AlertTriangle,
  Pencil,
  X,
  Megaphone,
  Upload,
  Monitor,
  Smartphone,
  Bell,
  UserPlus,
  Boxes,
  Eye,
  Shield,
  ChevronLeft,
  ChevronRight,
  Lock,
  Sparkles,
  Tag,
  Layers,
  TrendingUp,
  Star,
  Zap,
  Clock,
  Play,
  Pause,
  LogOut,
  Search,
  Image,
  Globe,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../lib/api';
import {
  ALL_PERMISSIONS,
  type AuditLog,
  type AuthUser,
  type CampaignBanner,
  type CampaignPlacement,
  type CampaignSectionSize,
  type CampaignTheme,
  type FlashSale,
  type FlashSaleCategory,
  type FlashSaleTheme,
  type Order,
  type OrderStatus,
  type PermissionKey,
  type Product,
  type ProductReview,
  type RestockNotification,
  type Role,
  type StoreCategory,
} from '../types';
import { BrandLogo } from './BrandLogo';
import { useTranslation, PRODUCT_AR_MAP } from '../lib/i18n';

interface AdminDashboardProps {
  user: AuthUser;
  onBackToStore: () => void;
  onCatalogChanged: () => void;
  onCampaignsChanged: () => void;
  onSwitchAccount: () => void;
  onLogout: () => void;
  onStoreSettingsChanged?: () => void;
  onTabChange?: (tab: AdminTab) => void;
  initialTab?: AdminTab;
}

export type AdminTab =
  | 'overview'
  | 'analytics'
  | 'campaigns'
  | 'flash_sales'
  | 'catalog'
  | 'categories'
  | 'orders'
  | 'rbac'
  | 'audit';

interface ToastAlert {
  id: string;
  kind: 'staff' | 'inventory' | 'order' | 'info';
  title: string;
  message: string;
  actor: string;
  timestamp: string;
}

export function AdminDashboard({
  user,
  onBackToStore,
  onCatalogChanged,
  onCampaignsChanged,
  onSwitchAccount,
  onLogout,
  onStoreSettingsChanged,
  onTabChange,
  initialTab,
}: AdminDashboardProps) {
  const {
    t,
    lang,
    toggleLang,
    translateCategory,
    translateStatus,
    translateRole,
    translateScope,
    isRtl,
  } = useTranslation();
  const can = useCallback((p: PermissionKey) => user.permissions.includes(p), [user.permissions]);

  const defaultTab: AdminTab = initialTab ?? (can('analytics:read')
    ? 'overview'
    : can('campaigns:manage')
    ? 'campaigns'
    : can('orders:read')
    ? 'orders'
    : can('products:read')
    ? 'catalog'
    : can('staff:read') || can('roles:manage')
    ? 'rbac'
    : 'audit');

  const [activeTab, setActiveTab] = useState<AdminTab>(defaultTab);
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.getAdminOverview>> | null>(
    null
  );
  const [analyticsRange, setAnalyticsRange] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [analyticsData, setAnalyticsData] = useState<Awaited<
    ReturnType<typeof api.getAdminAnalytics>
  > | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignBanner[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [flashNowMs, setFlashNowMs] = useState(() => Date.now());
  const [orders, setOrders] = useState<Order[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staff, setStaff] = useState<AuthUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [restockWaitlist, setRestockWaitlist] = useState<RestockNotification[]>([]);
  const [adminReviews, setAdminReviews] = useState<ProductReview[]>([]);
  const [adminReviewAvg, setAdminReviewAvg] = useState(0);
  const [categoryEditing, setCategoryEditing] = useState<StoreCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', subtitle: '', imageUrl: '', sortOrder: 0, active: true, showInMenu: true, menuLabel: '' });

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  // Filters & Modals
  const [productSearch, setProductSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('all');
  const [catalogStockFilter, setCatalogStockFilter] = useState<
    'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'inactive'
  >('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');

  const [productModal, setProductModal] = useState<{
    open: boolean;
    editing: Product | null;
  }>({ open: false, editing: null });
  const [prodFormTab, setProdFormTab] = useState<'basics' | 'media' | 'specs' | 'shipping'>(
    'basics'
  );
  const [prodModalError, setProdModalError] = useState<string | null>(null);
  const [prodFieldErrors, setProdFieldErrors] = useState<Record<string, string>>({});
  const [prodFormSaving, setProdFormSaving] = useState(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  const [campaignModal, setCampaignModal] = useState<{
    open: boolean;
    editing: CampaignBanner | null;
  }>({ open: false, editing: null });
  const [uploadingSlot, setUploadingSlot] = useState<'desktop' | 'mobile' | 'product' | null>(null);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AuthUser | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: '',
    password: '',
    roleId: 'role_inventory',
    departmentScope: 'all',
    customPermissions: [] as PermissionKey[],
  });
  const [roleModal, setRoleModal] = useState<{ open: boolean; editing: Role | null }>({
    open: false,
    editing: null,
  });

  // Form state: Product (Advanced Complete Builder)
  const [prodForm, setProdForm] = useState({
    sku: '',
    slug: '',
    name: '',
    brand: 'Sam Brand',
    category: 'Peripherals' as Product['category'],
    price: 149,
    compareAtPrice: '',
    costPrice: '',
    stock: 15,
    lowStockThreshold: 5,
    condition: 'New' as Product['condition'],
    warranty: '2-Year Official Sam Brand Warranty',
    weight: '',
    dimensions: '',
    badge: '',
    tagline: '',
    description: '',
    visualKey: 'mechanical-keyboard',
    imageUrl: '',
    images: [] as string[],
    variants: ['Standard Edition'] as string[],
    whatsInBox: ['Main Hardware Unit', 'Quick Start Guide'] as string[],
    tags: [] as string[],
    specsList: [{ key: 'Warranty', value: '2-Year Official Sam Brand Warranty' }] as Array<{
      key: string;
      value: string;
    }>,
    featured: false,
    active: true,
  });
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [newVariantInput, setNewVariantInput] = useState('');
  const [newBoxItemInput, setNewBoxItemInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // Form state: Campaign Banner
  const [campForm, setCampForm] = useState<{
    placement: CampaignPlacement;
    designTheme: CampaignTheme;
    sectionSize: CampaignSectionSize;
    offerTag: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    promoCode: string;
    targetCategory: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    visualKey: string;
    sortOrder: number;
    active: boolean;
  }>({
    placement: 'hero',
    designTheme: 'navy',
    sectionSize: 'split',
    offerTag: 'Limited Offer',
    title: '',
    subtitle: '',
    ctaLabel: 'Shop Offer',
    promoCode: 'SAM10',
    targetCategory: 'All',
    desktopImageUrl: '',
    mobileImageUrl: '',
    visualKey: 'console-pro',
    sortOrder: 1,
    active: true,
  });

  // Form state: Flash Sale Modal
  const [flashSaleModal, setFlashSaleModal] = useState<{
    open: boolean;
    editing: FlashSale | null;
  }>({ open: false, editing: null });
  const [flashSaleSaving, setFlashSaleSaving] = useState(false);
  const [flashSaleError, setFlashSaleError] = useState<string | null>(null);
  const [flashForm, setFlashForm] = useState<{
    title: string;
    subtitle: string;
    badgeLabel: string;
    targetCategory: FlashSaleCategory;
    discountPct: number;
    designTheme: FlashSaleTheme;
    expiresLocal: string;
    active: boolean;
  }>({
    title: '',
    subtitle: '',
    badgeLabel: 'FLASH SALE',
    targetCategory: 'Monitors',
    discountPct: 15,
    designTheme: 'crimson',
    expiresLocal: '',
    active: true,
  });

  // Form state: Staff
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: 'StaffUser2026!',
    roleId: 'role_inventory',
    departmentScope: 'all',
    customPermissions: [] as PermissionKey[],
  });

  // Form state: Role
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    permissions: PermissionKey[];
    maxDiscountPct: number;
    maxRefundAmount: number;
  }>({
    name: '',
    description: '',
    permissions: ['products:read', 'orders:read'],
    maxDiscountPct: 10,
    maxRefundAmount: 200,
  });

  const [storeWhatsapp, setStoreWhatsapp] = useState('96171972495');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [storeLogo, setStoreLogo] = useState('');
  const [storeNameInput, setStoreNameInput] = useState('Sam Brand Store');
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Real-time Toast Alert System for Staff Registrations & Inventory Updates
  const [toastAlerts, setToastAlerts] = useState<ToastAlert[]>([]);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const seededNotifsRef = useRef(false);
  const lastLocalMutationAtRef = useRef<number>(0);

  const dismissToast = useCallback((id: string) => {
    setToastAlerts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (alert: Omit<ToastAlert, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => {
      const id = alert.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: ToastAlert = {
        id,
        kind: alert.kind,
        title: alert.title,
        message: alert.message,
        actor: alert.actor,
        timestamp: alert.timestamp || new Date().toISOString(),
      };
      setToastAlerts((prev) => [entry, ...prev].slice(0, 4));
      setTimeout(() => {
        setToastAlerts((prev) => prev.filter((t) => t.id !== id));
      }, 6500);
    },
    []
  );

  const notify = (msg: string, isError = false) => {
    if (isError) {
      setBannerError(msg);
      setBannerSuccess(null);
    } else {
      setBannerSuccess(msg);
      setBannerError(null);
    }
    setTimeout(() => {
      setBannerError(null);
      setBannerSuccess(null);
    }, 4500);
  };

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [];
      if (can('analytics:read')) {
        tasks.push(api.getAdminOverview().then(setOverview));
        tasks.push(api.getAdminAnalytics(analyticsRange).then(setAnalyticsData));
      }
      if (can('campaigns:manage')) {
        tasks.push(api.getAdminCampaigns().then((r) => setCampaigns(r.campaigns)));
        tasks.push(api.getAdminFlashSales().then((r) => setFlashSales(r.flashSales)));
      }
      if (can('products:read')) {
        tasks.push(api.getAdminProducts().then((r) => setProducts(r.products)));
        tasks.push(api.getAdminCategories().then((r) => setCategories(r.categories)));
        tasks.push(api.getRestockWaitlist().then((r) => setRestockWaitlist(r.waitlist)));
        tasks.push(
          api.getAdminReviews().then((r) => {
            setAdminReviews(r.reviews);
            setAdminReviewAvg(r.averageRating);
          })
        );
      }
      if (can('orders:read')) {
        tasks.push(api.getAdminOrders().then((r) => setOrders(r.orders)));
      }
      if (can('staff:read') || can('roles:manage')) {
        tasks.push(api.getRoles().then((r) => setRoles(r.roles)));
      }
      if (can('staff:read')) {
        tasks.push(api.getStaff().then((r) => setStaff(r.staff)));
      }
      if (can('audit:read')) {
        tasks.push(api.getAuditLogs().then((r) => setAuditLogs(r.logs)));
      }
      tasks.push(
        api.getPublicSettings().then((s) => {
          setStoreWhatsapp(s.whatsappNumber);
          if (s.storeName) setStoreNameInput(s.storeName);
          if (s.logoUrl !== undefined) setStoreLogo(s.logoUrl);
        })
      );
      await Promise.all(tasks);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load workspace.', true);
    } finally {
      setLoading(false);
    }
  }, [can, analyticsRange]);

  const openCategoryForm = (category?: StoreCategory) => {
    setCategoryEditing(category || null);
    setCategoryForm({
      name: category?.name || '',
      subtitle: category?.subtitle || '',
      imageUrl: category?.imageUrl || '',
      sortOrder: category?.sortOrder || 0,
      active: category?.active ?? true,
      showInMenu: category?.showInMenu ?? true,
      menuLabel: category?.menuLabel || category?.name || '',
    });
  };

  const saveCategory = async () => {
    try {
      const payload = {
        name: categoryForm.name,
        subtitle: categoryForm.subtitle,
        imageUrl: categoryForm.imageUrl || null,
        sortOrder: Number(categoryForm.sortOrder),
        active: categoryForm.active,
        showInMenu: categoryForm.showInMenu,
        menuLabel: categoryForm.menuLabel || categoryForm.name,
      };
      if (categoryEditing) {
        await api.updateCategory(categoryEditing.id, payload);
      } else {
        await api.createCategory(payload);
      }
      notify(categoryEditing ? 'Category updated.' : 'Category created.');
      openCategoryForm();
      await loadWorkspaceData();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save category.', true);
    }
  };

  const deleteCategory = async (category: StoreCategory) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try {
      await api.deleteCategory(category.id);
      notify(`Deleted category "${category.name}".`);
      await loadWorkspaceData();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to delete category.', true);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleChangeAnalyticsRange = async (nextRange: '7d' | '30d' | '90d' | '12m') => {
    setAnalyticsRange(nextRange);
    if (!can('analytics:read')) return;
    setAnalyticsLoading(true);
    try {
      const data = await api.getAdminAnalytics(nextRange);
      setAnalyticsData(data);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load analytics.', true);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Poll /api/admin/notifications every 5s so admins/staff receive live toast alerts
  // when a new user/employee is created or when an employee updates product inventory.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await api.getAdminNotifications();
        if (!active) return;

        if (!seededNotifsRef.current) {
          res.notifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
          seededNotifsRef.current = true;
          return;
        }

        const fresh = res.notifications.filter((n) => !seenNotifIdsRef.current.has(n.id));
        if (fresh.length === 0) return;

        fresh.reverse().forEach((n) => {
          seenNotifIdsRef.current.add(n.id);
          const isRecentSelfMutation =
            n.actorId === user.id && Date.now() - lastLocalMutationAtRef.current < 7000;
          if (isRecentSelfMutation) return;

          const isStaffEvent =
            n.action.includes('STAFF') || n.action.includes('USER') || n.action.includes('REGISTER');
          const isInventoryEvent = n.action.includes('PRODUCT');
          const isOrderEvent = n.action.includes('ORDER');

          pushToast({
            id: n.id,
            kind: isStaffEvent
              ? 'staff'
              : isInventoryEvent
              ? 'inventory'
              : isOrderEvent
              ? 'order'
              : 'info',
            title: isStaffEvent
              ? 'New Account Activity'
              : isInventoryEvent
              ? 'Inventory Updated'
              : isOrderEvent
              ? 'Order Activity'
              : 'Workspace Event',
            message: n.details,
            actor: n.actorName,
            timestamp: n.createdAt,
          });
        });
      } catch {
        // Ignore transient background poll failures
      }
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user.id, pushToast]);

  const handleImageFileSelect = async (
    file: File | undefined,
    slot: 'desktop' | 'mobile' | 'product'
  ) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notify('Image size must be under 4 MB.', true);
      return;
    }
    setUploadingSlot(slot);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
      const res = await api.uploadImage(dataUrl, file.name);
      if (slot === 'desktop') {
        setCampForm((prev) => ({ ...prev, desktopImageUrl: res.url }));
      } else if (slot === 'mobile') {
        setCampForm((prev) => ({ ...prev, mobileImageUrl: res.url }));
      } else {
        setProdForm((prev) => {
          const nextImages = prev.images.includes(res.url)
            ? prev.images
            : [...prev.images, res.url];
          return {
            ...prev,
            imageUrl: prev.imageUrl || res.url,
            images: nextImages,
          };
        });
      }
      notify(`Uploaded ${slot} image successfully.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed.', true);
    } finally {
      setUploadingSlot(null);
    }
  };

  const MAX_PRODUCT_IMAGES = 10;

  const handleMultiProductImagesSelect = async (files: FileList | File[] | null) => {
    const fileArr = files ? Array.from(files) : [];
    if (fileArr.length === 0) return;

    const remainingSlots = Math.max(0, MAX_PRODUCT_IMAGES - prodForm.images.length);
    if (remainingSlots <= 0) {
      const msg = `Gallery limit reached: maximum ${MAX_PRODUCT_IMAGES} images allowed per product.`;
      setProdModalError(msg);
      setProdFieldErrors((prev) => ({ ...prev, images: msg }));
      return;
    }

    setProdModalError(null);
    setProdFieldErrors((prev) => {
      const next = { ...prev };
      delete next.images;
      return next;
    });

    setUploadingSlot('product');
    const skippedReasons: string[] = [];
    const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const filesToProcess = fileArr.slice(0, remainingSlots);
    if (fileArr.length > remainingSlots) {
      skippedReasons.push(
        `Only ${remainingSlots} slot(s) remaining (max ${MAX_PRODUCT_IMAGES} gallery images).`
      );
    }

    try {
      const uploadedUrls: string[] = [];
      for (const file of filesToProcess) {
        if (!allowedMime.has(file.type)) {
          skippedReasons.push(`${file.name}: only PNG, JPG, and WEBP images are supported.`);
          continue;
        }
        if (file.size > 4 * 1024 * 1024) {
          skippedReasons.push(`${file.name}: exceeds 4 MB limit.`);
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
          reader.readAsDataURL(file);
        });
        const res = await api.uploadImage(dataUrl, file.name);
        uploadedUrls.push(res.url);
      }

      if (uploadedUrls.length > 0) {
        setProdForm((prev) => {
          const merged = Array.from(new Set([...prev.images, ...uploadedUrls])).slice(
            0,
            MAX_PRODUCT_IMAGES
          );
          return {
            ...prev,
            images: merged,
            imageUrl: merged[0] || prev.imageUrl,
          };
        });
        notify(`Added ${uploadedUrls.length} product image${uploadedUrls.length > 1 ? 's' : ''}.`);
      }

      if (skippedReasons.length > 0) {
        const msg = skippedReasons.join(' ');
        setProdModalError(msg);
        setProdFieldErrors((prev) => ({ ...prev, images: msg }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image upload failed.';
      setProdModalError(msg);
      notify(msg, true);
    } finally {
      setUploadingSlot(null);
    }
  };

  // Campaign CRUD
  const openCreateCampaign = () => {
    setCampForm({
      placement: 'hero',
      designTheme: 'navy',
      sectionSize: 'split',
      offerTag: 'Special Offer',
      title: '',
      subtitle: '',
      ctaLabel: 'Shop Offer',
      promoCode: 'SAM10',
      targetCategory: 'All',
      desktopImageUrl: '',
      mobileImageUrl: '',
      visualKey: 'console-pro',
      sortOrder: campaigns.length + 1,
      active: true,
    });
    setCampaignModal({ open: true, editing: null });
  };

  const openEditCampaign = (c: CampaignBanner) => {
    setCampForm({
      placement: c.placement,
      designTheme: c.designTheme,
      sectionSize: c.sectionSize,
      offerTag: c.offerTag,
      title: c.title,
      subtitle: c.subtitle,
      ctaLabel: c.ctaLabel,
      promoCode: c.promoCode || '',
      targetCategory: c.targetCategory,
      desktopImageUrl: c.desktopImageUrl || '',
      mobileImageUrl: c.mobileImageUrl || '',
      visualKey: c.visualKey,
      sortOrder: c.sortOrder,
      active: c.active,
    });
    setCampaignModal({ open: true, editing: c });
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        placement: campForm.placement,
        designTheme: campForm.designTheme,
        sectionSize: campForm.sectionSize,
        offerTag: campForm.offerTag.trim() || 'Offer',
        title: campForm.title.trim(),
        subtitle: campForm.subtitle.trim(),
        ctaLabel: campForm.ctaLabel.trim(),
        promoCode: campForm.promoCode.trim() || null,
        targetCategory: campForm.targetCategory,
        desktopImageUrl: campForm.desktopImageUrl.trim() || null,
        mobileImageUrl: campForm.mobileImageUrl.trim() || null,
        visualKey: campForm.visualKey,
        sortOrder: Number(campForm.sortOrder),
        active: campForm.active,
      };
      if (campaignModal.editing) {
        await api.updateCampaign(campaignModal.editing.id, payload);
        notify(`Updated banner "${payload.title}".`);
      } else {
        await api.createCampaign(payload);
        notify(`Published banner "${payload.title}".`);
      }
      setCampaignModal({ open: false, editing: null });
      await loadWorkspaceData();
      onCampaignsChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to save banner.', true);
    }
  };

  const handleToggleCampaignActive = async (c: CampaignBanner) => {
    try {
      await api.updateCampaign(c.id, { active: !c.active });
      notify(`${c.title} is now ${!c.active ? 'visible' : 'hidden'}.`);
      await loadWorkspaceData();
      onCampaignsChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to toggle banner.', true);
    }
  };

  const handleDeleteCampaign = async (c: CampaignBanner) => {
    try {
      await api.deleteCampaign(c.id);
      notify(`Deleted banner "${c.title}".`);
      await loadWorkspaceData();
      onCampaignsChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to delete banner.', true);
    }
  };

  // Flash Sale Live Tick + CRUD Helpers
  useEffect(() => {
    if (activeTab !== 'flash_sales' && !flashSaleModal.open) return;
    setFlashNowMs(Date.now());
    const t = window.setInterval(() => setFlashNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [activeTab, flashSaleModal.open]);

  const toLocalDateTimeInput = (isoOrDate: string | Date): string => {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    const valid = Number.isFinite(d.getTime()) ? d : new Date(Date.now() + 6 * 3600_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}T${pad(
      valid.getHours()
    )}:${pad(valid.getMinutes())}`;
  };

  const applyFlashDurationPreset = (minutes: number) => {
    setFlashForm((prev) => ({
      ...prev,
      expiresLocal: toLocalDateTimeInput(new Date(Date.now() + minutes * 60_000)),
    }));
  };

  const openCreateFlashSale = () => {
    const cappedDefault = Math.min(15, Math.max(1, user.maxDiscountPct || 15));
    setFlashSaleError(null);
    setFlashForm({
      title: '',
      subtitle: '',
      badgeLabel: 'FLASH SALE',
      targetCategory: 'Monitors',
      discountPct: cappedDefault,
      designTheme: 'crimson',
      expiresLocal: toLocalDateTimeInput(new Date(Date.now() + 6 * 3600_000)),
      active: true,
    });
    setFlashSaleModal({ open: true, editing: null });
  };

  const openEditFlashSale = (fs: FlashSale) => {
    setFlashSaleError(null);
    const futureFallback =
      new Date(fs.expiresAt).getTime() > Date.now()
        ? fs.expiresAt
        : new Date(Date.now() + 6 * 3600_000).toISOString();
    setFlashForm({
      title: fs.title,
      subtitle: fs.subtitle,
      badgeLabel: fs.badgeLabel,
      targetCategory: fs.targetCategory,
      discountPct: fs.discountPct,
      designTheme: fs.designTheme,
      expiresLocal: toLocalDateTimeInput(futureFallback),
      active: fs.active,
    });
    setFlashSaleModal({ open: true, editing: fs });
  };

  const handleSaveFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlashSaleError(null);

    if (flashForm.title.trim().length < 3) {
      setFlashSaleError('Please enter a flash sale headline (at least 3 characters).');
      return;
    }

    const pct = Math.round(Number(flashForm.discountPct));
    if (!Number.isFinite(pct) || pct < 1 || pct > 90) {
      setFlashSaleError('Discount percentage must be between 1% and 90%.');
      return;
    }
    if (pct > user.maxDiscountPct) {
      setFlashSaleError(
        `Role discount cap exceeded: ${user.roleName} can set up to ${user.maxDiscountPct}% off.`
      );
      return;
    }

    const expDate = new Date(flashForm.expiresLocal);
    if (!Number.isFinite(expDate.getTime()) || expDate.getTime() <= Date.now()) {
      setFlashSaleError('Expiration date and time must be in the future.');
      return;
    }

    setFlashSaleSaving(true);
    try {
      const payload = {
        title: flashForm.title.trim(),
        subtitle:
          flashForm.subtitle.trim() ||
          `Temporary ${pct}% category-wide markdown on ${flashForm.targetCategory}.`,
        badgeLabel: flashForm.badgeLabel.trim().toUpperCase() || 'FLASH SALE',
        targetCategory: flashForm.targetCategory,
        discountPct: pct,
        designTheme: flashForm.designTheme,
        expiresAt: expDate.toISOString(),
        active: flashForm.active,
      };
      if (flashSaleModal.editing) {
        await api.updateFlashSale(flashSaleModal.editing.id, payload);
        notify(`Updated flash sale "${payload.title}" (-${pct}% on ${payload.targetCategory}).`);
      } else {
        await api.createFlashSale(payload);
        notify(`Launched ${pct}% flash sale for ${payload.targetCategory}.`);
      }
      setFlashSaleModal({ open: false, editing: null });
      await loadWorkspaceData();
      onCampaignsChanged();
      onCatalogChanged();
    } catch (err) {
      setFlashSaleError(err instanceof Error ? err.message : 'Unable to save flash sale.');
    } finally {
      setFlashSaleSaving(false);
    }
  };

  const handleQuickExtendFlashSale = async (fs: FlashSale, addMinutes: number) => {
    try {
      const baseMs = Math.max(Date.now(), new Date(fs.expiresAt).getTime());
      const nextExpires = new Date(baseMs + addMinutes * 60_000).toISOString();
      await api.updateFlashSale(fs.id, { expiresAt: nextExpires, active: true });
      notify(`Extended "${fs.title}" and reactivated countdown.`);
      await loadWorkspaceData();
      onCampaignsChanged();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to extend flash sale.', true);
    }
  };

  const handleToggleFlashSaleActive = async (fs: FlashSale) => {
    try {
      await api.updateFlashSale(fs.id, { active: !fs.active });
      notify(`"${fs.title}" is now ${!fs.active ? 'active' : 'paused'}.`);
      await loadWorkspaceData();
      onCampaignsChanged();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update flash sale.', true);
    }
  };

  const handleExpireNowFlashSale = async (fs: FlashSale) => {
    try {
      await api.updateFlashSale(fs.id, {
        active: false,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      notify(`Expired "${fs.title}" and restored regular category pricing.`);
      await loadWorkspaceData();
      onCampaignsChanged();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to expire flash sale.', true);
    }
  };

  const handleDeleteFlashSale = async (fs: FlashSale) => {
    try {
      await api.deleteFlashSale(fs.id);
      notify(`Deleted flash sale "${fs.title}".`);
      await loadWorkspaceData();
      onCampaignsChanged();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to delete flash sale.', true);
    }
  };

  const ALL_DEPARTMENTS: string[] = categories.map((category) => category.name);

  const allowedProductCategories = ALL_DEPARTMENTS.filter(
    (cat) => user.departmentScope === 'all' || user.departmentScope.split(',').includes(cat)
  );

  const isCategoryInScope = (cat: Product['category']) =>
    user.departmentScope === 'all' || user.departmentScope.split(',').includes(cat);

  const CATEGORY_SPEC_TEMPLATES: Record<
    string,
    Array<{ key: string; value: string }>
  > = {
    Consoles: [
      { key: 'Resolution', value: '4K @ 120Hz' },
      { key: 'Storage', value: '1TB NVMe SSD' },
      { key: 'HDMI', value: 'HDMI 2.1' },
      { key: 'Wireless', value: 'Wi-Fi 6E / Bluetooth 5.3' },
    ],
    Monitors: [
      { key: 'Panel', value: '32" QD-OLED' },
      { key: 'Refresh', value: '240Hz' },
      { key: 'Response', value: '0.03ms GtG' },
      { key: 'Ports', value: '2x HDMI 2.1, DP 1.4, USB-C' },
    ],
    Audio: [
      { key: 'Drivers', value: '50mm Planar Magnetic' },
      { key: 'Connectivity', value: '2.4GHz Lossless + Bluetooth 5.3' },
      { key: 'Battery', value: '45 Hours' },
      { key: 'Microphone', value: 'Detachable Cardioid Boom' },
    ],
    Peripherals: [
      { key: 'Switch / Sensor', value: 'Hall-Effect / 30K Optical' },
      { key: 'Polling Rate', value: '8000Hz' },
      { key: 'Connectivity', value: 'USB-C / 2.4GHz Wireless' },
      { key: 'Chassis', value: 'CNC Aluminum' },
    ],
    Accessories: [
      { key: 'Interface', value: 'Thunderbolt 4 / USB-C' },
      { key: 'Power Delivery', value: '100W PD' },
      { key: 'Material', value: 'Anodized Alloy' },
      { key: 'Compatibility', value: 'PC, Mac & Console' },
    ],
  };

  const isValidProductMediaUrl = (url: string) =>
    url.startsWith('/') ||
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('data:image/');

  const clearProdFieldError = (field: string) => {
    setProdFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Product CRUD
  const openCreateProduct = () => {
    const defaultCat = allowedProductCategories[0] || '';
    setProdForm({
      sku: `SBS-${defaultCat.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      slug: '',
      name: '',
      brand: 'Sam Brand',
      category: defaultCat,
      price: 149,
      compareAtPrice: '',
      costPrice: '',
      stock: 15,
      lowStockThreshold: 5,
      condition: 'New',
      warranty: '2-Year Official Sam Brand Warranty',
      weight: '',
      dimensions: '',
      badge: 'New Arrival',
      tagline: '',
      description: '',
      visualKey:
        defaultCat === 'Consoles'
          ? 'console-pro'
          : defaultCat === 'Monitors'
          ? 'oled-monitor'
          : defaultCat === 'Audio'
          ? 'wireless-headset'
          : defaultCat === 'Accessories'
          ? 'thunderbolt-dock'
          : 'mechanical-keyboard',
      imageUrl: '',
      images: [],
      variants: ['Standard Edition'],
      whatsInBox: ['Main Hardware Unit', 'Braided USB-C Cable', '2-Year Warranty Card'],
      tags: [defaultCat.toLowerCase()],
      specsList: (CATEGORY_SPEC_TEMPLATES[defaultCat] || []).map((r) => ({ ...r })),
      featured: false,
      active: true,
    });
    setNewImageUrlInput('');
    setNewVariantInput('');
    setNewBoxItemInput('');
    setNewTagInput('');
    setProdModalError(null);
    setProdFieldErrors({});
    setProdFormTab('basics');
    setProductModal({ open: true, editing: null });
  };

  const openEditProduct = (p: Product) => {
    const gallery = Array.from(
      new Set([...(p.images || []), ...(p.imageUrl ? [p.imageUrl] : [])].filter(Boolean))
    );
    const specEntries = Object.entries(p.specs || {}).map(([key, value]) => ({ key, value }));
    setProdForm({
      sku: p.sku,
      slug: p.slug || '',
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
      costPrice: p.costPrice !== null && p.costPrice !== undefined ? String(p.costPrice) : '',
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      condition: p.condition || 'New',
      warranty: p.warranty || '2-Year Official Sam Brand Warranty',
      weight: p.weight || '',
      dimensions: p.dimensions || '',
      badge: p.badge || '',
      tagline: p.tagline,
      description: p.description,
      visualKey: p.visualKey,
      imageUrl: gallery[0] || p.imageUrl || '',
      images: gallery,
      variants: p.variants?.length ? p.variants : ['Standard Edition'],
      whatsInBox: p.whatsInBox?.length ? p.whatsInBox : [],
      tags: p.tags?.length ? p.tags : [],
      specsList: specEntries.length
        ? specEntries
        : CATEGORY_SPEC_TEMPLATES[p.category].map((r) => ({ ...r })),
      featured: p.featured,
      active: p.active,
    });
    setNewImageUrlInput('');
    setNewVariantInput('');
    setNewBoxItemInput('');
    setNewTagInput('');
    setProdModalError(null);
    setProdFieldErrors({});
    setProdFormTab('basics');
    setProductModal({ open: true, editing: p });
  };

  const validateProductForm = (): {
    errors: Record<string, string>;
    firstTab: 'basics' | 'media' | 'specs' | 'shipping';
    firstMessage: string | null;
  } => {
    const errors: Record<string, string> = {};
    let firstTab: 'basics' | 'media' | 'specs' | 'shipping' = 'basics';
    let firstTabSet = false;

    const mark = (
      tab: 'basics' | 'media' | 'specs' | 'shipping',
      field: string,
      message: string
    ) => {
      if (!errors[field]) errors[field] = message;
      if (!firstTabSet) {
        firstTab = tab;
        firstTabSet = true;
      }
    };

    const cleanSku = prodForm.sku.trim().toUpperCase();
    if (!cleanSku || !/^[A-Z0-9_-]{3,32}$/.test(cleanSku)) {
      mark('basics', 'sku', 'SKU must be 3–32 characters using letters, numbers, dashes, or underscores.');
    } else if (
      products.some(
        (existing) =>
          existing.sku.toUpperCase() === cleanSku && existing.id !== productModal.editing?.id
      )
    ) {
      mark('basics', 'sku', `SKU "${cleanSku}" is already assigned to another product.`);
    }

    if (!isCategoryInScope(prodForm.category)) {
      mark(
        'basics',
        'category',
        `Your account scope (${user.departmentScope}) cannot publish items in ${prodForm.category}.`
      );
    }

    if (prodForm.name.trim().length < 3) {
      mark('basics', 'name', 'Product name must be at least 3 characters.');
    }

    if (prodForm.brand.trim().length < 2) {
      mark('basics', 'brand', 'Brand name must be at least 2 characters.');
    }

    const priceNum = Number(prodForm.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      mark('basics', 'price', 'Sale price must be greater than $0.00.');
    }

    if (prodForm.compareAtPrice.trim() !== '') {
      const compareNum = Number(prodForm.compareAtPrice);
      if (!Number.isFinite(compareNum) || compareNum <= priceNum) {
        mark('basics', 'compareAtPrice', 'Compare-at MSRP must be higher than the sale price.');
      } else {
        const markdownPct = Math.round(((compareNum - priceNum) / compareNum) * 100);
        if (markdownPct > user.maxDiscountPct) {
          mark(
            'basics',
            'compareAtPrice',
            `Discount (${markdownPct}% off) exceeds your role limit of ${user.maxDiscountPct}%.`
          );
        }
      }
    }

    if (prodForm.costPrice.trim() !== '') {
      const costNum = Number(prodForm.costPrice);
      if (!Number.isFinite(costNum) || costNum < 0) {
        mark('basics', 'costPrice', 'Unit cost price cannot be negative.');
      }
    }

    const stockNum = Number(prodForm.stock);
    if (!Number.isFinite(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
      mark('basics', 'stock', 'Stock quantity must be a whole number (0 or higher).');
    }

    const thresholdNum = Number(prodForm.lowStockThreshold);
    if (!Number.isFinite(thresholdNum) || !Number.isInteger(thresholdNum) || thresholdNum < 1) {
      mark('basics', 'lowStockThreshold', 'Low stock alert threshold must be at least 1 unit.');
    }

    if (prodForm.tagline.trim().length < 5) {
      mark('basics', 'tagline', 'Please enter a concise tagline (at least 5 characters).');
    }

    if (prodForm.description.trim().length < 10) {
      mark('basics', 'description', 'Please provide a hardware description (at least 10 characters).');
    }

    if (prodForm.images.length > MAX_PRODUCT_IMAGES) {
      mark('media', 'images', `Maximum ${MAX_PRODUCT_IMAGES} images allowed per product.`);
    } else if (prodForm.images.some((u) => !isValidProductMediaUrl(u.trim()))) {
      mark('media', 'images', 'One or more gallery image URLs are invalid.');
    }

    const cleanVariants = prodForm.variants.map((v) => v.trim()).filter(Boolean);
    if (cleanVariants.length === 0) {
      mark('specs', 'variants', 'Add at least one hardware configuration or variant.');
    }

    const seenSpecKeys = new Set<string>();
    let validSpecCount = 0;
    for (let i = 0; i < prodForm.specsList.length; i++) {
      const k = prodForm.specsList[i].key.trim();
      const v = prodForm.specsList[i].value.trim();
      if ((k && !v) || (!k && v)) {
        mark('specs', 'specs', `Spec row #${i + 1} needs both a specification name and a value.`);
        break;
      }
      if (k && v) {
        const lower = k.toLowerCase();
        if (seenSpecKeys.has(lower)) {
          mark('specs', 'specs', `Duplicate technical specification key "${k}".`);
          break;
        }
        seenSpecKeys.add(lower);
        validSpecCount += 1;
      }
    }
    if (!errors.specs && validSpecCount === 0) {
      mark('specs', 'specs', 'Add at least one technical specification row for product comparison.');
    }

    if (prodForm.warranty.trim().length < 3) {
      mark('shipping', 'warranty', 'Warranty coverage description is required.');
    }

    if (prodForm.slug.trim() !== '' && !/^[a-z0-9-]+$/i.test(prodForm.slug.trim())) {
      mark('shipping', 'slug', 'URL slug may only contain letters, numbers, and hyphens.');
    }

    const firstMessage = Object.values(errors)[0] || null;
    return { errors, firstTab, firstMessage };
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { errors, firstTab, firstMessage } = validateProductForm();
    if (Object.keys(errors).length > 0) {
      setProdFieldErrors(errors);
      setProdModalError(firstMessage || 'Please fix the highlighted product fields before saving.');
      setProdFormTab(firstTab);
      return;
    }

    setProdModalError(null);
    setProdFieldErrors({});
    setProdFormSaving(true);
    try {
      const specsObj: Record<string, string> = {};
      for (const row of prodForm.specsList) {
        const k = row.key.trim();
        const v = row.value.trim();
        if (k && v) specsObj[k] = v;
      }

      const cleanGallery = Array.from(
        new Set(
          [
            ...prodForm.images.map((u) => u.trim()),
            ...(prodForm.imageUrl.trim() ? [prodForm.imageUrl.trim()] : []),
          ].filter(Boolean)
        )
      ).slice(0, MAX_PRODUCT_IMAGES);

      const cleanVariants = prodForm.variants.map((v) => v.trim()).filter(Boolean);
      const cleanBox = prodForm.whatsInBox.map((v) => v.trim()).filter(Boolean);
      const cleanTags = prodForm.tags.map((v) => v.trim().toLowerCase()).filter(Boolean);

      const payload: Partial<Product> = {
        sku: prodForm.sku.trim().toUpperCase(),
        slug: prodForm.slug.trim().toLowerCase() || undefined,
        name: prodForm.name.trim(),
        brand: prodForm.brand.trim(),
        category: prodForm.category,
        price: Number(prodForm.price),
        compareAtPrice: prodForm.compareAtPrice ? Number(prodForm.compareAtPrice) : null,
        costPrice: prodForm.costPrice ? Number(prodForm.costPrice) : null,
        stock: Math.floor(Number(prodForm.stock)),
        lowStockThreshold: Math.floor(Number(prodForm.lowStockThreshold)),
        condition: prodForm.condition,
        warranty: prodForm.warranty.trim() || '2-Year Official Sam Brand Warranty',
        weight: prodForm.weight.trim() || null,
        dimensions: prodForm.dimensions.trim() || null,
        whatsInBox: cleanBox,
        tags: cleanTags,
        badge: prodForm.badge.trim() || null,
        tagline: prodForm.tagline.trim(),
        description: prodForm.description.trim(),
        specs: specsObj,
        variants: cleanVariants.length ? cleanVariants : ['Standard Edition'],
        visualKey: prodForm.visualKey,
        imageUrl: cleanGallery[0] || null,
        images: cleanGallery,
        featured: prodForm.featured,
        active: prodForm.active,
      };
      lastLocalMutationAtRef.current = Date.now();
      if (productModal.editing) {
        await api.updateProduct(productModal.editing.id, payload);
        notify(`Updated ${prodForm.name.trim()}.`);
        pushToast({
          kind: 'inventory',
          title: 'Inventory Updated',
          message: `${prodForm.name.trim()} (${payload.stock} units in stock)`,
          actor: user.name,
        });
      } else {
        await api.createProduct(payload);
        notify(`Created ${prodForm.name.trim()}.`);
        pushToast({
          kind: 'inventory',
          title: 'New Product Added',
          message: `${prodForm.name.trim()} published with ${payload.stock} units`,
          actor: user.name,
        });
      }
      setProductModal({ open: false, editing: null });
      await loadWorkspaceData();
      onCatalogChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save product.';
      setProdModalError(msg);
      notify(msg, true);
    } finally {
      setProdFormSaving(false);
    }
  };

  const handleToggleProductFlag = async (
    p: Product,
    field: 'active' | 'featured'
  ) => {
    try {
      lastLocalMutationAtRef.current = Date.now();
      await api.updateProduct(p.id, { [field]: !p[field] });
      notify(`${p.name} ${field === 'active' ? (!p.active ? 'activated' : 'hidden') : (!p.featured ? 'featured' : 'unfeatured')}.`);
      await loadWorkspaceData();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Flag update denied.', true);
    }
  };

  const handleAdjustStock = async (p: Product, delta: number) => {
    try {
      const nextStock = Math.max(0, p.stock + delta);
      lastLocalMutationAtRef.current = Date.now();
      await api.updateProduct(p.id, { stock: nextStock });
      pushToast({
        kind: 'inventory',
        title: 'Product Inventory Updated',
        message: `${p.name} stock adjusted to ${nextStock} units`,
        actor: user.name,
      });
      await loadWorkspaceData();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Stock adjustment denied.', true);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    try {
      await api.deleteProduct(p.id);
      notify(`Deleted ${p.name}.`);
      await loadWorkspaceData();
      onCatalogChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete denied.', true);
    }
  };

  // Order actions
  const handleOrderStatus = async (orderId: string, orderStatus: OrderStatus) => {
    try {
      await api.updateOrderStatus(orderId, orderStatus);
      notify(`Order moved to ${orderStatus}.`);
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Status update failed.', true);
    }
  };

  const handleRefundOrder = async (order: Order) => {
    try {
      await api.refundOrder(order.id);
      notify(`Refunded $${order.total.toFixed(2)} for ${order.orderNumber}.`);
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Refund denied.', true);
    }
  };

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notify('Logo image size must be under 4 MB.', true);
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read logo file.'));
        reader.readAsDataURL(file);
      });
      const res = await api.uploadImage(dataUrl, file.name);
      setStoreLogo(res.url);
      notify('Uploaded logo image. Click "Save Branding & Logo" to apply.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Logo upload failed.', true);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    try {
      const updated = await api.updateStoreSettings({
        storeName: storeNameInput.trim() || 'Sam Brand Store',
        logoUrl: storeLogo.trim(),
      });
      if (updated.storeName) setStoreNameInput(updated.storeName);
      if (updated.logoUrl !== undefined) setStoreLogo(updated.logoUrl);
      notify('Store branding & logo saved successfully!');
      onStoreSettingsChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save store branding.', true);
    } finally {
      setSavingBranding(false);
    }
  };

  const handleResetLogo = async () => {
    setSavingBranding(true);
    try {
      const updated = await api.updateStoreSettings({
        logoUrl: '',
      });
      setStoreLogo('');
      notify('Restored default SVG vector store logo.');
      onStoreSettingsChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reset store logo.', true);
    } finally {
      setSavingBranding(false);
    }
  };

  // Staff & Roles
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      lastLocalMutationAtRef.current = Date.now();
      await api.createStaff(staffForm);
      const roleLabel = roles.find((r) => r.id === staffForm.roleId)?.name || 'Staff';
      notify(`Added employee ${staffForm.name}.`);
      pushToast({
        kind: 'staff',
        title: 'New User Registered',
        message: `${staffForm.name} (${staffForm.email}) added as ${roleLabel}`,
        actor: user.name,
      });
      setStaffModalOpen(false);
      setStaffForm({
        name: '',
        email: '',
        password: 'StaffUser2026!',
        roleId: 'role_inventory',
        departmentScope: 'all',
        customPermissions: [],
      });
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add employee.', true);
    }
  };

  const handleToggleStaffStatus = async (member: AuthUser) => {
    try {
      const next = member.status === 'active' ? 'suspended' : 'active';
      await api.updateStaff(member.id, { status: next });
      notify(`${member.name} is now ${next}.`);
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update status.', true);
    }
  };

  const handleChangeStaffRole = async (member: AuthUser, roleId: string) => {
    try {
      await api.updateStaff(member.id, { roleId });
      notify(`Updated role for ${member.name}.`);
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update role.', true);
    }
  };

  const openEditStaffModal = (member: AuthUser) => {
    setEditingStaff(member);
    setEditStaffForm({
      name: member.name,
      password: '',
      roleId: member.roleId,
      departmentScope: member.departmentScope,
      customPermissions: member.customPermissions || [],
    });
  };

  const handleSaveEditedStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await api.updateStaff(editingStaff.id, {
        name: editStaffForm.name.trim(),
        roleId: editStaffForm.roleId,
        departmentScope: editStaffForm.departmentScope.trim() || 'all',
        customPermissions: editStaffForm.customPermissions,
        ...(editStaffForm.password.trim()
          ? { password: editStaffForm.password.trim() }
          : {}),
      });
      notify(`Updated employee account ${editStaffForm.name}.`);
      setEditingStaff(null);
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update employee.', true);
    }
  };

  const handleDeleteStaff = async (member: AuthUser) => {
    try {
      await api.deleteStaff(member.id);
      notify(`Removed staff account ${member.name}.`);
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to remove staff member.', true);
    }
  };

  const openEditRole = (role: Role) => {
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      maxDiscountPct: role.maxDiscountPct,
      maxRefundAmount: role.maxRefundAmount,
    });
    setRoleModal({ open: true, editing: role });
  };

  const openCreateRole = () => {
    setRoleForm({
      name: '',
      description: '',
      permissions: ['products:read', 'orders:read'],
      maxDiscountPct: 5,
      maxRefundAmount: 100,
    });
    setRoleModal({ open: true, editing: null });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (roleModal.editing) {
        await api.updateRole(roleModal.editing.id, roleForm);
        notify(`Saved rules for role ${roleForm.name}.`);
      } else {
        await api.createRole(roleForm);
        notify(`Created role ${roleForm.name}.`);
      }
      setRoleModal({ open: false, editing: null });
      await loadWorkspaceData();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save role rules.', true);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof BarChart3; allowed: boolean }> = [
    { id: 'overview', label: t('admin.navOverview', 'Overview'), icon: BarChart3, allowed: can('analytics:read') },
    { id: 'analytics', label: t('admin.navAnalytics', 'Analytics'), icon: TrendingUp, allowed: can('analytics:read') },
    {
      id: 'flash_sales',
      label: t('admin.navFlashSales', 'Flash Sales'),
      icon: Zap,
      allowed: can('campaigns:manage'),
    },
    {
      id: 'campaigns',
      label: t('admin.navCampaigns', 'Marketing & Banners'),
      icon: Megaphone,
      allowed: can('campaigns:manage'),
    },
    { id: 'catalog', label: t('admin.navCatalog', 'Catalog & Stock'), icon: Package, allowed: can('products:read') },
    { id: 'categories', label: 'Categories', icon: Layers, allowed: can('products:read') },
    { id: 'orders', label: t('admin.navOrders', 'Orders & Fulfillment'), icon: ShoppingCart, allowed: can('orders:read') },
    {
      id: 'rbac',
      label: t('admin.navRbac', 'Employees & Rules'),
      icon: Users,
      allowed: can('staff:read') || can('roles:manage'),
    },
    { id: 'audit', label: t('admin.navAudit', 'Security Audit Log'), icon: ShieldAlert, allowed: can('audit:read') },
  ];

  const maxRev = overview
    ? Math.max(100, ...overview.revenueSeries.map((d) => d.revenue))
    : 1000;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F7FAFD]">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* 240px Sidebar */}
        <aside className="w-full shrink-0 border-b border-[#E6ECF4] bg-white p-4 lg:min-h-[calc(100vh-4rem)] lg:w-60 lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-5 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1180E1]">
              {translateRole(user.roleName)}
            </p>
            <p className="mt-0.5 font-display text-sm font-bold text-[#0F1B2D] truncate">
              {user.name}
            </p>
            <p className="mt-1 font-mono text-[11px] text-[#6B7A8D]">
              {t('admin.scope', 'Scope')}: {translateScope(user.departmentScope)}
            </p>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="mt-2.5 text-xs font-semibold text-[#1180E1] hover:underline cursor-pointer"
            >
              {t('admin.switchRole', 'Switch Employee Role')}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 lg:hidden cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('admin.signOut', 'Sign Out')}
            </button>
          </div>

          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {navItems
              .filter((n) => n.allowed)
              .map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#0F1B2D] text-white'
                        : 'text-[#475569] hover:bg-[#F7FAFD] hover:text-[#0F1B2D]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </nav>

          <div className="mt-6 hidden border-t border-[#E6ECF4] pt-4 lg:block">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#475569] hover:text-[#1180E1] cursor-pointer"
            >
              <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
              <span>{t('admin.returnStore', 'Return to Storefront')}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-700 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t('admin.signOut', 'Sign Out')}</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-5 sm:p-7">
          {/* Top Breadcrumb Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#E6ECF4] pb-4">
            <div>
              <p className="text-xs text-[#6B7A8D]">
                Sam Brand Store / {t('admin.workspace', 'Admin Workspace')} /{' '}
                <span className="font-semibold text-[#0F1B2D]">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </span>
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-[#0F1B2D]">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLang}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
                title={lang === 'en' ? 'Switch to Arabic' : 'التحويل للإنجليزية'}
              >
                <Globe className="h-3.5 w-3.5 text-[#1180E1]" />
                <span>{lang === 'en' ? 'العربية' : 'English'}</span>
              </button>
              <button
                type="button"
                onClick={loadWorkspaceData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{t('admin.refresh', 'Refresh')}</span>
              </button>
            </div>
          </div>

          {bannerError && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs font-medium text-[#991B1B]">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#DC2626]" />
              <span>{bannerError}</span>
            </div>
          )}

          {bannerSuccess && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-xs font-medium text-[#166534]">
              <Check className="h-4 w-4 shrink-0 text-[#16A34A]" />
              <span>{bannerSuccess}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && overview && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                  <span className="text-xs text-[#6B7A8D]">{t('admin.overview.grossRevenue', 'Gross Revenue')}</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0F1B2D] tabular-nums">
                    ${overview.metrics.grossRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                  <span className="text-xs text-[#6B7A8D]">{t('admin.overview.totalOrders', 'Total Orders')}</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0F1B2D] tabular-nums">
                    {overview.metrics.totalOrders}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                  <span className="text-xs text-[#6B7A8D]">{t('admin.analytics.avgOrderValue', 'Average Order Value')}</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0F1B2D] tabular-nums">
                    ${overview.metrics.avgOrderValue.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                  <span className="text-xs text-[#6B7A8D]">{t('admin.overview.pendingFulfillment', 'Pending Fulfillment')}</span>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#1180E1] tabular-nums">
                    {overview.metrics.pendingFulfillment}
                  </p>
                </div>
              </div>

              {/* Inventory Health & Waitlist Summary Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                  <span className="text-[11px] font-medium text-[#6B7A8D]">{t('admin.overview.totalCatalogSkus', 'Total Catalog SKUs')}</span>
                  <p className="mt-1 font-mono text-lg font-bold text-[#0F1B2D] tabular-nums">
                    {overview.inventorySummary.totalSkus}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                  <span className="text-[11px] font-medium text-[#6B7A8D]">{t('admin.overview.unitsInStock', 'Units in Stock')}</span>
                  <p className="mt-1 font-mono text-lg font-bold text-[#0F1B2D] tabular-nums">
                    {overview.inventorySummary.totalUnits}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                  <span className="text-[11px] font-medium text-[#6B7A8D]">{t('admin.overview.inventoryValue', 'Inventory Value')}</span>
                  <p className="mt-1 font-mono text-lg font-bold text-[#16A34A] tabular-nums">
                    ${overview.inventorySummary.retailValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                  <span className="text-[11px] font-medium text-[#6B7A8D]">{t('admin.overview.outLowStock', 'Out / Low Stock')}</span>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                    <span className="text-[#DC2626]">{overview.inventorySummary.outOfStockCount}</span>
                    <span className="mx-1 text-[#CBD5E1]">/</span>
                    <span className="text-[#D97706]">{overview.inventorySummary.lowStockCount}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5 col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-medium text-[#6B7A8D]">{t('admin.overview.restockWaitlist', 'Restock Waitlist')}</span>
                  <p className="mt-1 font-mono text-lg font-bold text-[#1180E1] tabular-nums">
                    {overview.inventorySummary.waitlistCount} Alerts
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* 7-Day Revenue Bar Chart */}
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-5 lg:col-span-8">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {t('admin.overview.revenueVelocity', '7-Day Revenue Velocity')}
                    </h2>
                    <span className="font-mono text-xs text-[#6B7A8D]">USD</span>
                  </div>
                  <div className="mt-6 flex h-48 items-end gap-3">
                    {overview.revenueSeries.map((day) => {
                      const heightPct = Math.max(6, Math.round((day.revenue / maxRev) * 100));
                      return (
                        <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                          <span className="font-mono text-[10px] text-[#6B7A8D] tabular-nums">
                            {day.revenue > 0 ? `$${Math.round(day.revenue)}` : '—'}
                          </span>
                          <div className="flex h-36 w-full items-end rounded-lg bg-[#F7FAFD] p-1">
                            <div
                              className="w-full rounded-md bg-[#1180E1] transition-all duration-300"
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-[#475569]">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category Mix & Order Pipeline */}
                <div className="space-y-5 lg:col-span-4">
                  <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                    <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {t('admin.overview.salesByDept', 'Sales by Department')}
                    </h2>
                    <div className="mt-4 space-y-3">
                      {overview.categoryMix.map((c) => {
                        const pct = overview.metrics.grossRevenue
                          ? Math.min(100, Math.round((c.total / overview.metrics.grossRevenue) * 100))
                          : 0;
                        return (
                          <div key={c.category}>
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-[#0F1B2D]">{translateCategory(c.category)}</span>
                              <span className="font-mono text-[#475569] tabular-nums">
                                ${Number(c.total).toFixed(0)}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-[#F1F5F9]">
                              <div
                                className="h-full rounded-full bg-[#0F1B2D]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                    <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {t('admin.overview.pipeline', 'Order Fulfillment Pipeline')}
                    </h2>
                    <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-[11px]">
                      {(
                        ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]
                      ).map((st) => (
                        <div key={st} className="rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-2">
                          <p className="font-mono text-sm font-bold text-[#0F1B2D] tabular-nums">
                            {overview.orderStatusBreakdown?.[st] || 0}
                          </p>
                          <p className="mt-0.5 truncate capitalize text-[10px] text-[#6B7A8D]">
                            {translateStatus(st)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Selling Products + Employee Active Access Rules */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-5 lg:col-span-7">
                  <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                    {t('admin.overview.topPerforming', 'Top Performing Hardware')}
                  </h2>
                  {overview.topProducts.length === 0 ? (
                    <p className="mt-3 text-xs text-[#6B7A8D]">{t('admin.overview.noSales', 'No completed sales recorded yet.')}</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                        <thead className="border-b border-[#E6ECF4] text-[#6B7A8D]">
                          <tr>
                            <th className="py-2 font-medium">SKU</th>
                            <th className="py-2 font-medium">{t('admin.catalog.productHeader', 'Product')}</th>
                            <th className={`py-2 font-medium ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.overview.unitsSold', 'Units Sold')}</th>
                            <th className={`py-2 font-medium ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.overview.grossRevenue', 'Revenue')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {overview.topProducts.map((tp) => (
                            <tr key={tp.productId}>
                              <td className="py-2 font-mono text-[#6B7A8D]">{tp.sku}</td>
                              <td className="py-2 font-semibold text-[#0F1B2D]">
                                {PRODUCT_AR_MAP[tp.productId]?.name || tp.productName}
                              </td>
                              <td className={`py-2 font-mono font-semibold text-[#0F1B2D] tabular-nums ${isRtl ? 'text-left' : 'text-right'}`}>
                                {tp.unitsSold}
                              </td>
                              <td className={`py-2 font-mono font-bold text-[#16A34A] tabular-nums ${isRtl ? 'text-left' : 'text-right'}`}>
                                ${Number(tp.revenue).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Employee Active Role Rules Card */}
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-5 lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#1180E1]" />
                      <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                        {t('admin.overview.roleRules', 'Your Access & Rules')}
                      </h2>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-[#1180E1]">
                      {translateRole(user.roleName)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-2">
                      <p className="text-[#6B7A8D]">{t('admin.scope', 'Scope')}</p>
                      <p className="mt-0.5 font-mono font-bold text-[#0F1B2D] truncate">
                        {translateScope(user.departmentScope)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-2">
                      <p className="text-[#6B7A8D]">{t('admin.flash.discountPct', 'Max Discount')}</p>
                      <p className="mt-0.5 font-mono font-bold text-[#0F1B2D] tabular-nums">
                        {user.maxDiscountPct}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-2">
                      <p className="text-[#6B7A8D]">{t('admin.orders.processRefund', 'Refund Cap')}</p>
                      <p className="mt-0.5 font-mono font-bold text-[#0F1B2D] tabular-nums">
                        ${user.maxRefundAmount}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {user.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="rounded border border-[#E6ECF4] bg-[#F7FAFD] px-1.5 py-0.5 font-mono text-[10px] text-[#475569]"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Low Stock & Out-of-Stock Replenishment Table */}
              {overview.lowStockProducts.length > 0 && (
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                  <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                    {lang === 'ar' ? 'تنبيهات انخفاض ونفاد المخزون' : 'Out-of-Stock & Low Stock Replenishment Alerts'}
                  </h2>
                  <div className="mt-3 overflow-x-auto">
                    <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                      <thead className="border-b border-[#E6ECF4] text-[#6B7A8D]">
                        <tr>
                          <th className="py-2 font-medium">SKU</th>
                          <th className="py-2 font-medium">{t('admin.catalog.productHeader', 'Product')}</th>
                          <th className="py-2 font-medium">{t('admin.catalog.categoryHeader', 'Department')}</th>
                          <th className={`py-2 font-medium ${isRtl ? 'text-left' : 'text-right'}`}>{lang === 'ar' ? 'المتبقي' : 'Remaining'}</th>
                          {can('products:write') && <th className={`py-2 ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.actions', 'Action')}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {overview.lowStockProducts.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 font-mono text-[#6B7A8D]">{p.sku}</td>
                            <td className="py-2.5 font-semibold text-[#0F1B2D]">
                              {PRODUCT_AR_MAP[p.id]?.name || p.name}
                            </td>
                            <td className="py-2.5 text-[#475569]">{translateCategory(p.category)}</td>
                            <td
                              className={`py-2.5 font-mono font-bold tabular-nums ${isRtl ? 'text-left' : 'text-right'} ${
                                p.stock <= 0 ? 'text-[#DC2626]' : 'text-[#D97706]'
                              }`}
                            >
                              {p.stock <= 0 ? (lang === 'ar' ? '0 (نفد المخزون)' : '0 (Sold Out)') : p.stock}
                            </td>
                            {can('products:write') && (
                              <td className={`py-2.5 ${isRtl ? 'text-left' : 'text-right'}`}>
                                <button
                                  type="button"
                                  disabled={!isCategoryInScope(p.category)}
                                  onClick={() => handleAdjustStock(p, 10)}
                                  className="rounded-md bg-[#0F1B2D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1180E1] disabled:opacity-40 cursor-pointer"
                                >
                                  +10 Stock
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: RECHARTS ANALYTICS */}
          {activeTab === 'analytics' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Header & Timeframe Selector */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E6ECF4] bg-white p-4">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                    {lang === 'ar' ? 'حركة المبيعات، توزيع الأقسام، ودوران المخزون' : 'Sales Velocity, Category Mix & Inventory Turnover'}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6B7A8D]">
                    {lang === 'ar' ? 'بيانات وإحصائيات مباشرة وفورية لحركة الطلبات والمبيعات عبر فترات زمنية محددة.' : 'Live MySQL-backed order & SKU movement telemetry across selectable time horizons.'}
                  </p>
                </div>
                <div className="inline-flex items-center rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-1">
                  {(
                    [
                      { key: '7d', label: '7D' },
                      { key: '30d', label: '30D' },
                      { key: '90d', label: '90D' },
                      { key: '12m', label: '12M' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleChangeAnalyticsRange(opt.key)}
                      className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                        analyticsRange === opt.key
                          ? 'bg-[#0F1B2D] text-white'
                          : 'text-[#475569] hover:text-[#0F1B2D]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {analyticsLoading && !analyticsData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-20 animate-pulse rounded-xl border border-[#E6ECF4] bg-white"
                      />
                    ))}
                  </div>
                  <div className="h-80 animate-pulse rounded-xl border border-[#E6ECF4] bg-white" />
                </div>
              ) : analyticsData ? (
                <>
                  {/* Period Summary KPI Strip */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                      <span className="text-[11px] font-medium text-[#6B7A8D]">
                        {lang === 'ar' ? `إيرادات الفترة (${analyticsData.range.toUpperCase()})` : `Period Revenue (${analyticsData.range.toUpperCase()})`}
                      </span>
                      <p className="mt-1 font-mono text-xl font-bold text-[#0F1B2D] tabular-nums">
                        $
                        {analyticsData.summary.periodRevenue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                      <span className="text-[11px] font-medium text-[#6B7A8D]">{lang === 'ar' ? 'الطلبات المكتملة' : 'Valid Orders'}</span>
                      <p className="mt-1 font-mono text-xl font-bold text-[#0F1B2D] tabular-nums">
                        {analyticsData.summary.periodOrders}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                      <span className="text-[11px] font-medium text-[#6B7A8D]">{t('admin.overview.unitsSold', 'Units Moved')}</span>
                      <p className="mt-1 font-mono text-xl font-bold text-[#1180E1] tabular-nums">
                        {analyticsData.summary.periodUnits}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                      <span className="text-[11px] font-medium text-[#6B7A8D]">
                        {lang === 'ar' ? 'معدل دوران المخزون' : 'Avg Turnover Rate'}
                      </span>
                      <p className="mt-1 font-mono text-xl font-bold text-[#16A34A] tabular-nums">
                        {analyticsData.summary.avgTurnoverRate.toFixed(2)}x
                      </p>
                    </div>
                    <div className="col-span-2 rounded-xl border border-[#E6ECF4] bg-white p-4 sm:col-span-1">
                      <span className="text-[11px] font-medium text-[#6B7A8D]">
                        {lang === 'ar' ? 'القسم الأكثر طلباً' : 'Top Department'}
                      </span>
                      <p className="mt-1 truncate font-display text-lg font-bold text-[#0F1B2D]">
                        {translateCategory(analyticsData.summary.topCategory)}
                      </p>
                    </div>
                  </div>

                  {/* Chart 1: Sales Trend AreaChart + Chart 2: Top-Selling Categories */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-5 lg:col-span-7">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                            Sales Revenue Trend
                          </h3>
                          <p className="text-[11px] text-[#6B7A8D]">
                            Completed order revenue across the last {analyticsData.rangeDays} days
                          </p>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[#1180E1] tabular-nums">
                          AOV ${analyticsData.summary.avgOrderValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={analyticsData.salesTrend}
                            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="sbsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1180E1" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#1180E1" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF4" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fill: '#6B7A8D', fontSize: 11 }}
                              axisLine={{ stroke: '#E6ECF4' }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: '#6B7A8D', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0F1B2D',
                                borderColor: '#1E293B',
                                borderRadius: '10px',
                                color: '#FFFFFF',
                                fontSize: '12px',
                              }}
                              itemStyle={{ color: '#FFFFFF' }}
                              labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                              formatter={(val, name) => {
                                if (name === 'revenue') {
                                  return [`$${Number(val || 0).toFixed(2)}`, 'Revenue'];
                                }
                                return [String(val ?? 0), String(name)];
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              name="revenue"
                              stroke="#1180E1"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#sbsRevenueFill)"
                              activeDot={{ r: 5, fill: '#0F1B2D', stroke: '#FFFFFF', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-5 lg:col-span-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                            Top-Selling Categories
                          </h3>
                          <p className="text-[11px] text-[#6B7A8D]">
                            Department revenue &amp; share breakdown
                          </p>
                        </div>
                        <span className="font-mono text-[11px] text-[#6B7A8D]">USD</span>
                      </div>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analyticsData.topCategories}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF4" vertical={false} />
                            <XAxis
                              dataKey="category"
                              tick={{ fill: '#475569', fontSize: 11 }}
                              axisLine={{ stroke: '#E6ECF4' }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: '#6B7A8D', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `$${Number(v)}`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0F1B2D',
                                borderColor: '#1E293B',
                                borderRadius: '10px',
                                color: '#FFFFFF',
                                fontSize: '12px',
                              }}
                              itemStyle={{ color: '#FFFFFF' }}
                              formatter={(val, name) => {
                                if (name === 'revenue') {
                                  return [`$${Number(val || 0).toFixed(2)}`, 'Revenue'];
                                }
                                return [String(val ?? 0), String(name)];
                              }}
                            />
                            <Bar
                              dataKey="revenue"
                              name="revenue"
                              fill="#0F1B2D"
                              radius={[6, 6, 0, 0]}
                              maxBarSize={42}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 space-y-2 border-t border-[#E6ECF4] pt-3">
                        {analyticsData.topCategories.map((cat) => (
                          <div key={cat.category} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-[#0F1B2D]">{cat.category}</span>
                            <div className="flex items-center gap-3 font-mono tabular-nums">
                              <span className="text-[#6B7A8D]">{cat.unitsSold} units</span>
                              <span className="font-semibold text-[#0F1B2D]">
                                ${cat.revenue.toFixed(0)}
                              </span>
                              <span className="w-12 text-right text-[#1180E1]">{cat.sharePct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chart 3: Inventory Turnover ComposedChart */}
                  <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                          Inventory Turnover vs. On-Hand Stock by Category
                        </h3>
                        <p className="text-[11px] text-[#6B7A8D]">
                          Compares period units sold and current warehouse units against turnover ratio (Sold / Avg Stock).
                        </p>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-[#16A34A] tabular-nums">
                        Sell-Through {analyticsData.summary.sellThroughPct}%
                      </span>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={analyticsData.inventoryTurnover}
                          margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF4" vertical={false} />
                          <XAxis
                            dataKey="category"
                            tick={{ fill: '#475569', fontSize: 11 }}
                            axisLine={{ stroke: '#E6ECF4' }}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="units"
                            tick={{ fill: '#6B7A8D', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="rate"
                            orientation="right"
                            tick={{ fill: '#16A34A', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${Number(v).toFixed(2)}x`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0F1B2D',
                              borderColor: '#1E293B',
                              borderRadius: '10px',
                              color: '#FFFFFF',
                              fontSize: '12px',
                            }}
                            itemStyle={{ color: '#FFFFFF' }}
                            formatter={(val, name) => {
                              if (name === 'Turnover Rate') {
                                return [`${Number(val || 0).toFixed(2)}x`, 'Turnover Rate'];
                              }
                              return [String(val ?? 0), String(name)];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar
                            yAxisId="units"
                            dataKey="currentStock"
                            name="On-Hand Stock"
                            fill="#CBD5E1"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={36}
                          />
                          <Bar
                            yAxisId="units"
                            dataKey="unitsSold"
                            name="Units Sold"
                            fill="#1180E1"
                            radius={[5, 5, 0, 0]}
                            maxBarSize={36}
                          />
                          <Line
                            yAxisId="rate"
                            type="monotone"
                            dataKey="turnoverRate"
                            name="Turnover Rate"
                            stroke="#16A34A"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#16A34A', stroke: '#FFFFFF', strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* SKU Turnover Velocity Table */}
                  <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                        SKU-Level Inventory Turnover Ledger
                      </h3>
                      <span className="font-mono text-[11px] text-[#6B7A8D] tabular-nums">
                        {analyticsData.skuTurnover.length} Active SKUs
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-[#E6ECF4] text-[#6B7A8D]">
                          <tr>
                            <th className="py-2 pr-3 font-medium">SKU</th>
                            <th className="py-2 pr-3 font-medium">Product</th>
                            <th className="py-2 pr-3 font-medium">Category</th>
                            <th className="py-2 px-3 font-medium text-right">Stock</th>
                            <th className="py-2 px-3 font-medium text-right">Sold</th>
                            <th className="py-2 px-3 font-medium text-right">Revenue</th>
                            <th className="py-2 px-3 font-medium text-right">Turnover</th>
                            <th className="py-2 px-3 font-medium text-right">Days Supply</th>
                            <th className="py-2 pl-3 font-medium text-right">Velocity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {analyticsData.skuTurnover.map((row) => (
                            <tr key={row.id} className="hover:bg-[#F7FAFD]">
                              <td className="py-2.5 pr-3 font-mono text-[#6B7A8D]">{row.sku}</td>
                              <td className="py-2.5 pr-3 font-semibold text-[#0F1B2D]">{row.name}</td>
                              <td className="py-2.5 pr-3 text-[#475569]">{row.category}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#0F1B2D]">
                                {row.currentStock}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-[#1180E1]">
                                {row.unitsSold}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#0F1B2D]">
                                ${row.revenue.toFixed(0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-[#0F1B2D]">
                                {row.turnoverRate.toFixed(2)}x
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B7A8D]">
                                {row.daysOfSupply >= 999 ? '999+ d' : `${row.daysOfSupply} d`}
                              </td>
                              <td className="py-2.5 pl-3 text-right">
                                <span
                                  className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                    row.status === 'Fast Mover'
                                      ? 'bg-[#DCFCE7] text-[#166534]'
                                      : row.status === 'Slow / Restock'
                                      ? 'bg-[#FEF3C7] text-[#92400E]'
                                      : 'bg-[#EFF6FF] text-[#1D4ED8]'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          )}

          {/* TAB: MARKETING & DUAL-SIZE BANNERS */}
          {activeTab === 'campaigns' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6ECF4] bg-white p-4">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                    {lang === 'ar' ? 'عروض الواجهة واللافتات الترويجية (الحاسوب + الجوال)' : 'Hero Showcase & Store Offer Slides (PC + Mobile)'}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6B7A8D]">
                    {lang === 'ar'
                      ? 'تدور جميع اللافتات النشطة في شريط العروض الرئيسية أعلى المتجر. يمكنك رفع صور وتصميمات مخصصة للحاسوب والجوال.'
                      : 'All active banners rotate inside the top Hero Showcase Slider. Upload separate PC (16:9) & Mobile (4:3) creative, section size, and theme.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateCampaign}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1180E1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('admin.campaigns.newBanner', 'Add Offer / Banner')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className={`flex flex-col justify-between rounded-xl border bg-white p-4 transition-opacity ${
                      c.active ? 'border-[#E6ECF4]' : 'border-[#E6ECF4] opacity-65'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                            <span className="rounded bg-[#0F1B2D] px-2 py-0.5 uppercase text-white">
                              {c.placement === 'hero'
                                ? 'Hero'
                                : c.placement === 'offer_strip'
                                ? 'Offer Strip'
                                : 'Banner Grid'}
                            </span>
                            <span className="rounded border border-[#D4DFEE] bg-[#F7FAFD] px-2 py-0.5 uppercase text-[#475569]">
                              Size: {c.sectionSize}
                            </span>
                            <span className="rounded border border-[#D4DFEE] bg-[#F7FAFD] px-2 py-0.5 capitalize text-[#475569]">
                              Theme: {c.designTheme}
                            </span>
                            {c.promoCode && (
                              <span className="font-mono text-[#1180E1]">{c.promoCode}</span>
                            )}
                          </div>
                          <h3 className="mt-2 font-display text-base font-bold text-[#0F1B2D]">
                            {c.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#6B7A8D] line-clamp-2">{c.subtitle}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleCampaignActive(c)}
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                            c.active
                              ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                              : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
                          }`}
                        >
                          {c.active ? 'Active' : 'Hidden'}
                        </button>
                      </div>

                      {/* PC & Mobile Preview Boxes */}
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-2">
                          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#475569]">
                            <Monitor className="h-3 w-3 text-[#1180E1]" />
                            <span>PC Banner (16:9)</span>
                          </div>
                          {c.desktopImageUrl ? (
                            <img
                              src={c.desktopImageUrl}
                              alt={`${c.title} PC`}
                              className="aspect-[16/9] w-full rounded object-cover"
                            />
                          ) : (
                            <div className="flex aspect-[16/9] w-full items-center justify-center rounded border border-dashed border-[#CBD8EA] text-[10px] text-[#6B7A8D]">
                              Vector ({c.visualKey})
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-2">
                          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#475569]">
                            <Smartphone className="h-3 w-3 text-[#1180E1]" />
                            <span>Mobile Banner (4:3)</span>
                          </div>
                          {c.mobileImageUrl ? (
                            <img
                              src={c.mobileImageUrl}
                              alt={`${c.title} Mobile`}
                              className="aspect-[4/3] w-full rounded object-cover"
                            />
                          ) : (
                            <div className="flex aspect-[4/3] w-full items-center justify-center rounded border border-dashed border-[#CBD8EA] text-[10px] text-[#6B7A8D]">
                              {c.desktopImageUrl ? 'Uses PC Fallback' : `Vector (${c.visualKey})`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#E6ECF4] pt-3 text-xs">
                      <span className="font-mono text-[11px] text-[#6B7A8D]">
                        Sort #{c.sortOrder} · Dept: {c.targetCategory}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCampaign(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#D4DFEE] px-2.5 py-1 text-[11px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: FLASH SALES (TIME-BOUND CATEGORY DISCOUNTS) */}
          {activeTab === 'flash_sales' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Top Action Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6ECF4] bg-white p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#DC2626]" />
                    <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {lang === 'ar' ? 'العروض الخاطفة والخصومات التلقائية للأقسام' : 'Category Flash Sale Banners & Auto-Expiring Discounts'}
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B7A8D]">
                    {lang === 'ar'
                      ? 'إطلاق خصومات محددة بالوقت لأقسام معينة. تختفي لافتات العروض وتعود الأسعار الأصلية تلقائياً عند انتهاء العداد.'
                      : 'Launch time-bound percentage discounts for specific categories. Storefront banners hide automatically and base SKU prices restore the instant a timer ends.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateFlashSale}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('admin.flash.newDrop', 'New Flash Sale')}</span>
                </button>
              </div>

              {/* KPI Strip */}
              {(() => {
                const liveFlash = flashSales.filter(
                  (f) => f.active && new Date(f.expiresAt).getTime() > flashNowMs
                );
                const expiredOrPaused = flashSales.filter(
                  (f) => !f.active || new Date(f.expiresAt).getTime() <= flashNowMs
                );
                const impactedSkus = products.filter(
                  (p) =>
                    p.active &&
                    liveFlash.some(
                      (f) => f.targetCategory === 'All' || f.targetCategory === p.category
                    )
                ).length;

                return (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                      <p className="text-[11px] font-semibold text-[#6B7A8D]">{lang === 'ar' ? 'العروض النشطة المباشرة' : 'Live Flash Sales'}</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-[#DC2626] tabular-nums">
                        {liveFlash.length}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7A8D]">{lang === 'ar' ? 'لافتات نشطة بالمتجر' : 'Active banners on store'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                      <p className="text-[11px] font-semibold text-[#6B7A8D]">{lang === 'ar' ? 'المنتجات المشمولة بالخصم' : 'Discounted SKUs'}</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-[#0F1B2D] tabular-nums">
                        {impactedSkus}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7A8D]">{lang === 'ar' ? 'مسعرة تلقائياً بالكتالوج' : 'Auto-priced in catalog'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                      <p className="text-[11px] font-semibold text-[#6B7A8D]">{lang === 'ar' ? 'الحد الأقصى للخصم المسموح' : 'Role Discount Cap'}</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-[#1180E1] tabular-nums">
                        {user.maxDiscountPct}%
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7A8D]">{translateRole(user.roleName)}</p>
                    </div>
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                      <p className="text-[11px] font-semibold text-[#6B7A8D]">{lang === 'ar' ? 'متوقف / منتهي' : 'Paused / Expired'}</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-[#475569] tabular-nums">
                        {expiredOrPaused.length}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#6B7A8D]">{lang === 'ar' ? 'جاهز لإعادة الإطلاق' : 'Ready to relaunch'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Flash Sales Cards */}
              {flashSales.length === 0 ? (
                <div className="rounded-xl border border-[#E6ECF4] bg-white p-10 text-center">
                  <Zap className="mx-auto h-8 w-8 text-[#CBD5E1]" />
                  <p className="mt-2 font-display text-sm font-bold text-[#0F1B2D]">
                    {lang === 'ar' ? 'لا توجد عروض خاطفة مضافة بعد' : 'No Flash Sales configured yet'}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7A8D]">
                    {lang === 'ar'
                      ? 'قم بإنشاء عرض خاطف للأقسام لتطبيق خصم تلقائي وعرض عداد زمني مباشر على واجهة المتجر.'
                      : 'Create a category flash drop to automatically discount products and show a live countdown banner on the storefront.'}
                  </p>
                  <button
                    type="button"
                    onClick={openCreateFlashSale}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('admin.flash.newDrop', 'Launch First Flash Sale')}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {flashSales.map((fs) => {
                    const remainingMs = Math.max(0, new Date(fs.expiresAt).getTime() - flashNowMs);
                    const isExpired = remainingMs <= 0;
                    const isLive = fs.active && !isExpired;
                    const totalSec = Math.floor(remainingMs / 1000);
                    const days = Math.floor(totalSec / 86400);
                    const hrs = Math.floor((totalSec % 86400) / 3600);
                    const mins = Math.floor((totalSec % 3600) / 60);
                    const secs = totalSec % 60;
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const matchingSkus = products.filter(
                      (p) => p.active && (fs.targetCategory === 'All' || fs.targetCategory === p.category)
                    );

                    return (
                      <div
                        key={fs.id}
                        className={`flex flex-col justify-between rounded-xl border bg-white p-4 transition-opacity ${
                          isLive
                            ? 'border-[#FCA5A5] shadow-xs'
                            : 'border-[#E6ECF4] opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  isLive
                                    ? 'bg-[#DC2626] text-white'
                                    : isExpired
                                    ? 'bg-[#F1F5F9] text-[#64748B]'
                                    : 'bg-[#FEF3C7] text-[#92400E]'
                                }`}
                              >
                                <Zap className="h-3 w-3" />
                                <span>{fs.badgeLabel}</span>
                              </span>
                              <span className="rounded border border-[#D4DFEE] bg-[#F7FAFD] px-2 py-0.5 font-mono text-[11px] font-bold text-[#0F1B2D]">
                                -{fs.discountPct}% OFF
                              </span>
                              <span className="rounded border border-[#D4DFEE] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
                                {fs.targetCategory === 'All' ? t('admin.all', 'All Categories') : translateCategory(fs.targetCategory)}
                              </span>
                            </div>

                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                isLive
                                  ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                                  : isExpired
                                  ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                                  : 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]'
                              }`}
                            >
                              {isLive ? (lang === 'ar' ? 'مباشر نشط' : 'Live') : isExpired ? (lang === 'ar' ? 'منتهي' : 'Expired') : (lang === 'ar' ? 'متوقف مؤقتاً' : 'Paused')}
                            </span>
                          </div>

                          <h3 className="mt-2.5 font-display text-base font-bold text-[#0F1B2D]">
                            {fs.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#6B7A8D]">{fs.subtitle}</p>

                          {/* Live Timer & Impact Box */}
                          <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-lg border border-[#E6ECF4] bg-[#F7FAFD] p-3 text-xs">
                            <div>
                              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#6B7A8D]">
                                <Clock className="h-3 w-3 text-[#1180E1]" />
                                <span>{isExpired ? 'Ended At' : 'Auto-Expires In'}</span>
                              </span>
                              <p
                                className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                                  isLive ? 'text-[#DC2626]' : 'text-[#475569]'
                                }`}
                              >
                                {isExpired
                                  ? new Date(fs.expiresAt).toLocaleString()
                                  : `${days > 0 ? `${days}d ` : ''}${pad(hrs)}:${pad(mins)}:${pad(secs)}`}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A8D]">
                                Category Coverage
                              </span>
                              <p className="mt-0.5 font-mono text-sm font-bold text-[#0F1B2D] tabular-nums">
                                {matchingSkus.length} SKUs
                              </p>
                              <p className="truncate text-[10px] text-[#6B7A8D]">
                                Theme: {fs.designTheme} · By {fs.createdBy}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6ECF4] pt-3 text-[11px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickExtendFlashSale(fs, 60)}
                              className="rounded-md border border-[#D4DFEE] bg-[#F7FAFD] px-2 py-1 font-semibold text-[#0F1B2D] hover:border-[#1180E1] hover:text-[#1180E1] cursor-pointer"
                            >
                              +1 Hr
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickExtendFlashSale(fs, 1440)}
                              className="rounded-md border border-[#D4DFEE] bg-[#F7FAFD] px-2 py-1 font-semibold text-[#0F1B2D] hover:border-[#1180E1] hover:text-[#1180E1] cursor-pointer"
                            >
                              +24 Hrs
                            </button>
                            {!isExpired && (
                              <button
                                type="button"
                                onClick={() => handleToggleFlashSaleActive(fs)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#D4DFEE] bg-white px-2 py-1 font-semibold text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                              >
                                {fs.active ? (
                                  <>
                                    <Pause className="h-3 w-3" />
                                    <span>Pause</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3 w-3" />
                                    <span>Resume</span>
                                  </>
                                )}
                              </button>
                            )}
                            {isLive && (
                              <button
                                type="button"
                                onClick={() => handleExpireNowFlashSale(fs)}
                                className="rounded-md border border-[#FED7AA] bg-[#FFFBEB] px-2 py-1 font-semibold text-[#B45309] hover:bg-[#FEF3C7] cursor-pointer"
                              >
                                Expire Now
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditFlashSale(fs)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#D4DFEE] px-2.5 py-1 font-semibold text-[#0F1B2D] hover:border-[#1180E1] cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFlashSale(fs)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: CATALOG & RESTOCK WAITLIST */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0F1B2D]">Store Categories</h2>
                  <p className="mt-1 text-xs text-[#6B7A8D]">Create, reorder, update images, and remove catalog categories.</p>
                </div>
                <button type="button" onClick={() => openCategoryForm()} className="inline-flex items-center gap-2 rounded-lg bg-[#1180E1] px-3 py-2 text-xs font-semibold text-white cursor-pointer">
                  <Plus className="h-4 w-4" /> Add Category
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="overflow-hidden rounded-xl border border-[#E6ECF4] bg-white">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-3 border-b border-[#EDF2F7] p-3 last:border-b-0">
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-[#F1F5F9]">
                        {category.imageUrl && <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0F1B2D]">{category.name}</p>
                        <p className="truncate text-xs text-[#6B7A8D]">{category.subtitle || 'No subtitle'}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${category.active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                        {category.active ? 'Active' : 'Hidden'}
                      </span>
                      <button type="button" onClick={() => openCategoryForm(category)} className="rounded-lg border border-[#D4DFEE] p-2 text-[#475569] cursor-pointer" aria-label={`Edit ${category.name}`}><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteCategory(category)} className="rounded-lg border border-[#FECACA] p-2 text-[#DC2626] cursor-pointer" aria-label={`Delete ${category.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {categories.length === 0 && <div className="p-8 text-center text-sm text-[#6B7A8D]">No categories yet. Add the first category to start building the catalog.</div>}
                </div>

                <div className="rounded-xl border border-[#E6ECF4] bg-white p-4">
                  <h3 className="font-display text-sm font-bold text-[#0F1B2D]">{categoryEditing ? 'Edit Category' : 'New Category'}</h3>
                  <div className="mt-3 space-y-3">
                    <input value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} placeholder="Category name" className="w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm" />
                    <input value={categoryForm.menuLabel} onChange={(e) => setCategoryForm((p) => ({ ...p, menuLabel: e.target.value }))} placeholder="Main menu label" className="w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm" />
                    <input value={categoryForm.subtitle} onChange={(e) => setCategoryForm((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Subtitle" className="w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm" />
                    <input value={categoryForm.imageUrl} onChange={(e) => setCategoryForm((p) => ({ ...p, imageUrl: e.target.value }))} placeholder="Image URL" className="w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          try {
                            const uploaded = await api.uploadImage(String(reader.result), file.name);
                            setCategoryForm((previous) => ({ ...previous, imageUrl: uploaded.url }));
                          } catch (error) {
                            notify(error instanceof Error ? error.message : 'Unable to upload category image.', true);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="w-full text-xs text-[#64748B]"
                    />
                    <input type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} placeholder="Sort order" className="w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm" />
                    <label className="flex items-center gap-2 text-xs text-[#475569]"><input type="checkbox" checked={categoryForm.active} onChange={(e) => setCategoryForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>
                    <label className="flex items-center gap-2 text-xs text-[#475569]"><input type="checkbox" checked={categoryForm.showInMenu} onChange={(e) => setCategoryForm((p) => ({ ...p, showInMenu: e.target.checked }))} /> Show in main menu</label>
                    <button type="button" onClick={saveCategory} disabled={!categoryForm.name.trim()} className="w-full rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer">
                      {categoryEditing ? 'Save Changes' : 'Create Category'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalog' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border border-[#D4DFEE] bg-white overflow-hidden shadow-xs focus-within:border-[#1180E1] focus-within:ring-1 focus-within:ring-[#1180E1]">
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder={t('admin.catalog.searchPlaceholder', 'Search SKUs, brands, names...')}
                      className="h-9 w-48 sm:w-60 bg-transparent px-3 text-xs text-[#0F1B2D] placeholder-[#94A3B8] focus:outline-none"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        title="Clear product search"
                        className="px-2 text-[#94A3B8] hover:text-[#0F1B2D] cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Search products"
                      className="flex h-9 items-center gap-1.5 bg-[#0F1B2D] px-3 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>{t('admin.search', 'Search')}</span>
                    </button>
                  </div>
                  <select
                    value={catalogCategoryFilter}
                    onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                    aria-label="Filter by department"
                    className="h-9 rounded-lg border border-[#D4DFEE] bg-white px-3 text-xs font-semibold text-[#0F1B2D] cursor-pointer"
                  >
                    <option value="all">{t('admin.all', 'All Departments')}</option>
                    {ALL_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {translateCategory(d)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={catalogStockFilter}
                    onChange={(e) =>
                      setCatalogStockFilter(e.target.value as typeof catalogStockFilter)
                    }
                    aria-label="Filter by stock status"
                    className="h-9 rounded-lg border border-[#D4DFEE] bg-white px-3 text-xs font-semibold text-[#0F1B2D] cursor-pointer"
                  >
                    <option value="all">{lang === 'ar' ? 'جميع حالات المخزون' : 'All Stock Status'}</option>
                    <option value="in_stock">{lang === 'ar' ? 'متوفر' : 'In Stock'}</option>
                    <option value="low_stock">{lang === 'ar' ? 'مخزون منخفض' : 'Low Stock'}</option>
                    <option value="out_of_stock">{lang === 'ar' ? 'نفد المخزون' : 'Out of Stock'}</option>
                    <option value="inactive">{lang === 'ar' ? 'مخفي / مسودة' : 'Hidden / Draft'}</option>
                  </select>
                </div>

                {can('products:write') && (
                  <button
                    type="button"
                    onClick={openCreateProduct}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1180E1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('admin.catalog.newProduct', 'Add Complete Product')}</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E6ECF4] bg-white">
                <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="border-b border-[#E6ECF4] bg-[#F7FAFD] text-[#6B7A8D]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('admin.catalog.productHeader', 'Product')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.catalog.categoryHeader', 'Department')}</th>
                      <th className={`px-4 py-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>{lang === 'ar' ? 'السعر / الهامش' : 'Price / Margin'}</th>
                      <th className={`px-4 py-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.catalog.stockHeader', 'Stock')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.status', 'Status')}</th>
                      <th className={`px-4 py-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {products
                      .filter((p) => {
                        const q = productSearch.trim().toLowerCase();
                        if (
                          q &&
                          !p.name.toLowerCase().includes(q) &&
                          !p.sku.toLowerCase().includes(q) &&
                          !p.brand.toLowerCase().includes(q)
                        ) {
                          return false;
                        }
                        if (catalogCategoryFilter !== 'all' && p.category !== catalogCategoryFilter) {
                          return false;
                        }
                        if (catalogStockFilter === 'in_stock' && p.stock <= p.lowStockThreshold) {
                          return false;
                        }
                        if (
                          catalogStockFilter === 'low_stock' &&
                          !(p.stock > 0 && p.stock <= p.lowStockThreshold)
                        ) {
                          return false;
                        }
                        if (catalogStockFilter === 'out_of_stock' && p.stock > 0) {
                          return false;
                        }
                        if (catalogStockFilter === 'inactive' && p.active) {
                          return false;
                        }
                        return true;
                      })
                      .map((p) => {
                        const inScope = isCategoryInScope(p.category);
                        const imgCount = Array.from(
                          new Set([...(p.images || []), ...(p.imageUrl ? [p.imageUrl] : [])].filter(Boolean))
                        ).length;
                        const margin =
                          p.costPrice !== null && p.costPrice !== undefined && p.price > 0
                            ? Math.round(((p.price - p.costPrice) / p.price) * 100)
                            : null;
                        return (
                          <tr key={p.id} className="hover:bg-[#F7FAFD]">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-12 shrink-0 overflow-hidden rounded-lg border border-[#E6ECF4] bg-[#F7FAFD]">
                                  {p.imageUrl ? (
                                    <img
                                      src={p.imageUrl}
                                      alt={p.name}
                                      referrerPolicy="no-referrer"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center font-mono text-[9px] text-[#94A3B8]">
                                      {p.category.slice(0, 3).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#0F1B2D] truncate">
                                    {PRODUCT_AR_MAP[p.id]?.name || p.name}
                                  </p>
                                  <p className="font-mono text-[10px] text-[#6B7A8D]">
                                    {p.sku} · {p.brand} · {imgCount} {lang === 'ar' ? 'صور' : `photo${imgCount === 1 ? '' : 's'}`}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#475569]">
                              <span>{translateCategory(p.category)}</span>
                              {!inScope && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#D97706]">
                                  <Lock className="h-2.5 w-2.5" />
                                  {lang === 'ar' ? 'مقيد بالنطاق' : 'Scoped'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                              <p className="font-semibold text-[#0F1B2D]">${p.price.toFixed(2)}</p>
                              {margin !== null && (
                                <p className="text-[10px] text-[#16A34A]">{margin}% margin</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {can('products:write') && inScope && (
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustStock(p, -1)}
                                    className="h-6 w-6 rounded border border-[#D4DFEE] bg-white font-mono hover:bg-[#E6ECF4] cursor-pointer"
                                  >
                                    -
                                  </button>
                                )}
                                <span
                                  className={`w-8 text-center font-mono font-semibold tabular-nums ${
                                    p.stock <= 0
                                      ? 'text-[#DC2626]'
                                      : p.stock <= p.lowStockThreshold
                                      ? 'text-[#D97706]'
                                      : 'text-[#0F1B2D]'
                                  }`}
                                >
                                  {p.stock}
                                </span>
                                {can('products:write') && inScope && (
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustStock(p, 1)}
                                    className="h-6 w-6 rounded border border-[#D4DFEE] bg-white font-mono hover:bg-[#E6ECF4] cursor-pointer"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={!can('products:write') || !inScope}
                                  onClick={() => handleToggleProductFlag(p, 'active')}
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold border cursor-pointer disabled:opacity-50 ${
                                    p.active
                                      ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
                                      : 'border-[#CBD5E1] bg-[#F1F5F9] text-[#64748B]'
                                  }`}
                                >
                                  {p.active ? 'Live' : 'Hidden'}
                                </button>
                                <button
                                  type="button"
                                  disabled={!can('products:write') || !inScope}
                                  onClick={() => handleToggleProductFlag(p, 'featured')}
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold border cursor-pointer disabled:opacity-50 ${
                                    p.featured
                                      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1180E1]'
                                      : 'border-[#E6ECF4] bg-white text-[#94A3B8]'
                                  }`}
                                >
                                  Featured
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {can('products:write') && (
                                  <button
                                    type="button"
                                    disabled={!inScope}
                                    onClick={() => openEditProduct(p)}
                                    title={
                                      inScope
                                        ? 'Edit complete product'
                                        : `Locked: requires ${p.category} scope`
                                    }
                                    className="rounded p-1.5 text-[#475569] hover:bg-[#E6ECF4] hover:text-[#0F1B2D] disabled:opacity-35 cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {can('products:delete') && (
                                  <button
                                    type="button"
                                    disabled={!inScope}
                                    onClick={() => handleDeleteProduct(p)}
                                    title="Delete product"
                                    className="rounded p-1.5 text-[#6B7A8D] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-35 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Restock Waitlist ("Notify Me When Available" Subscribers) */}
              <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#1180E1]" />
                    <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {lang === 'ar' ? 'قائمة انتظار التوفر بالمخزون' : 'Back-in-Stock Waitlist'} ({restockWaitlist.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-[#6B7A8D]">
                    {lang === 'ar' ? 'المتسوقون المشتركون عبر "أعلمني عند توفره"' : 'Shoppers subscribed via “Notify Me When Available”'}
                  </span>
                </div>

                {restockWaitlist.length === 0 ? (
                  <p className="mt-3 text-xs text-[#6B7A8D]">
                    {lang === 'ar' ? 'لم يتم تقديم أي طلبات تنبيه بالتوفر بعد.' : 'No restock alert emails submitted yet.'}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                      <thead className="border-b border-[#E6ECF4] text-[#6B7A8D]">
                        <tr>
                          <th className="py-2 font-medium">{lang === 'ar' ? 'بريد العميل' : 'Customer Email'}</th>
                          <th className="py-2 font-medium">{t('admin.catalog.productHeader', 'Product')}</th>
                          <th className="py-2 font-medium">{lang === 'ar' ? 'المواصفة / الإصدار' : 'Configuration'}</th>
                          <th className="py-2 font-medium">{lang === 'ar' ? 'تاريخ الطلب' : 'Requested'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {restockWaitlist.map((entry) => (
                          <tr key={entry.id}>
                            <td className="py-2 font-semibold text-[#0F1B2D]">{entry.email}</td>
                            <td className="py-2 text-[#475569]">
                              {PRODUCT_AR_MAP[entry.sku]?.name || entry.productName}{' '}
                              <span className="font-mono text-[10px] text-[#94A3B8]">
                                ({entry.sku})
                              </span>
                            </td>
                            <td className="py-2 font-mono text-[11px] text-[#475569]">
                              {entry.variant}
                            </td>
                            <td className="py-2 font-mono text-[11px] text-[#6B7A8D]">
                              {new Date(entry.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Customer Ratings & Feedback Moderation */}
              <div className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                    <h2 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {lang === 'ar' ? 'تقييمات ومراجعات العملاء' : 'Customer Ratings & Reviews'} ({adminReviews.length})
                    </h2>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#0F1B2D] tabular-nums">
                    {lang === 'ar' ? 'متوسط التقييم العام:' : 'Store Avg:'} {adminReviewAvg > 0 ? `${adminReviewAvg.toFixed(2)} / 5.0` : '—'}
                  </span>
                </div>

                {adminReviews.length === 0 ? (
                  <p className="mt-3 text-xs text-[#6B7A8D]">
                    {lang === 'ar' ? 'لا توجد تقييمات مسجلة للمنتجات بعد.' : 'No product ratings submitted yet.'}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                      <thead className="border-b border-[#E6ECF4] text-[#6B7A8D]">
                        <tr>
                          <th className="py-2 pr-3 font-medium">{t('admin.catalog.productHeader', 'Product')}</th>
                          <th className="py-2 pr-3 font-medium">{t('admin.orders.customer', 'Customer')}</th>
                          <th className="py-2 pr-3 font-medium">{lang === 'ar' ? 'التقييم' : 'Rating'}</th>
                          <th className="py-2 pr-3 font-medium">{lang === 'ar' ? 'الملاحظات' : 'Feedback'}</th>
                          <th className={`py-2 pr-3 font-medium ${isRtl ? 'text-left' : 'text-right'}`}>{lang === 'ar' ? 'مفيد' : 'Helpful'}</th>
                          {can('products:write') && (
                            <th className={`py-2 pl-3 font-medium ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.actions', 'Action')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {adminReviews.map((rev) => (
                          <tr key={rev.id} className="hover:bg-[#F7FAFD]">
                            <td className="py-2.5 pr-3 font-semibold text-[#0F1B2D]">
                              {rev.productName || rev.productId}
                            </td>
                            <td className="py-2.5 pr-3 text-[#475569]">
                              {rev.authorName}
                              {rev.verifiedPurchase && (
                                <span className="ml-1.5 text-[10px] font-semibold text-[#16A34A]">
                                  · {lang === 'ar' ? 'مشتري مؤكد' : 'Verified'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 font-mono font-bold text-[#0F1B2D] tabular-nums">
                              {rev.rating}.0 ★
                            </td>
                            <td className="max-w-xs py-2.5 pr-3 text-[#475569]">
                              <p className="truncate font-medium text-[#0F1B2D]">{rev.title}</p>
                              <p className="truncate text-[11px] text-[#6B7A8D]">{rev.comment}</p>
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono text-[#6B7A8D] tabular-nums">
                              {rev.helpfulCount}
                            </td>
                            {can('products:write') && (
                              <td className="py-2.5 pl-3 text-right">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await api.deleteAdminReview(rev.id);
                                      notify(`Removed review by ${rev.authorName}.`);
                                      await loadWorkspaceData();
                                      onCatalogChanged();
                                    } catch (err) {
                                      notify(
                                        err instanceof Error ? err.message : 'Delete failed.',
                                        true
                                      );
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] px-2 py-1 text-[11px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Remove</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: ORDERS */}
          {activeTab === 'orders' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border border-[#D4DFEE] bg-white overflow-hidden shadow-xs focus-within:border-[#1180E1] focus-within:ring-1 focus-within:ring-[#1180E1]">
                    <input
                      type="search"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder={t('admin.orders.searchPlaceholder', 'Search order #, customer, email, phone, tx ref...')}
                      className="h-9 w-60 sm:w-80 bg-transparent px-3 text-xs text-[#0F1B2D] placeholder-[#94A3B8] focus:outline-none"
                    />
                    {orderSearch && (
                      <button
                        type="button"
                        onClick={() => setOrderSearch('')}
                        title="Clear order search"
                        className="px-2 text-[#94A3B8] hover:text-[#0F1B2D] cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Search orders"
                      className="flex h-9 items-center gap-1.5 bg-[#0F1B2D] px-3 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>{t('admin.search', 'Search')}</span>
                    </button>
                  </div>
                  {orderSearch && (
                    <span className="text-[11px] font-semibold text-[#6B7A8D]">
                      {lang === 'ar' ? `نتائج البحث عن "${orderSearch}"` : `Filtered by "${orderSearch}"`}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {['all', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatusFilter(st)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize cursor-pointer transition-colors ${
                        orderStatusFilter === st
                          ? 'bg-[#0F1B2D] text-white shadow-xs'
                          : 'border border-[#E6ECF4] bg-white text-[#475569] hover:bg-[#F7FAFD] hover:text-[#0F1B2D]'
                      }`}
                    >
                      {st === 'all' ? t('admin.all', 'All') : translateStatus(st)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E6ECF4] bg-white">
                <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="border-b border-[#E6ECF4] bg-[#F7FAFD] text-[#6B7A8D]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('admin.orders.orderNumber', 'Order #')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.orders.customer', 'Customer')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.orders.paymentMethod', 'Payment')}</th>
                      <th className={`px-4 py-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.orders.total', 'Total')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.orders.fulfillmentStatus', 'Fulfillment')}</th>
                      <th className={`px-4 py-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(() => {
                      const list = orders.filter((o) => {
                        if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter) {
                          return false;
                        }
                        const q = orderSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          o.orderNumber.toLowerCase().includes(q) ||
                          o.customerName.toLowerCase().includes(q) ||
                          o.customerEmail.toLowerCase().includes(q) ||
                          (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
                          o.transactionRef.toLowerCase().includes(q) ||
                          (o.shippingAddress && o.shippingAddress.toLowerCase().includes(q)) ||
                          (o.city && o.city.toLowerCase().includes(q)) ||
                          (o.items &&
                            o.items.some(
                              (item) =>
                                item.productName.toLowerCase().includes(q) ||
                                item.sku.toLowerCase().includes(q) ||
                                item.variantLabel.toLowerCase().includes(q)
                            ))
                        );
                      });

                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-[#6B7A8D]">
                              <p className="font-semibold text-sm text-[#0F1B2D]">
                                No orders match your criteria
                              </p>
                              <p className="text-xs text-[#6B7A8D] mt-1">
                                Try searching for a different order #, customer name, email or resetting filters.
                              </p>
                              {(orderSearch || orderStatusFilter !== 'all') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderSearch('');
                                    setOrderStatusFilter('all');
                                  }}
                                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer"
                                >
                                  Reset Filters
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return list.map((o) => (
                        <tr key={o.id} className="hover:bg-[#F7FAFD]">
                          <td className="px-4 py-3">
                            <p className="font-mono font-bold text-[#0F1B2D]">{o.orderNumber}</p>
                            <p className="font-mono text-[10px] text-[#6B7A8D]">{o.transactionRef}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0F1B2D]">{o.customerName}</p>
                            <p className="text-[11px] text-[#6B7A8D]">{o.customerEmail}</p>
                          </td>
                          <td className="px-4 py-3 font-mono uppercase">
                            <span
                              className={
                                o.paymentStatus === 'refunded'
                                  ? 'text-[#DC2626] font-semibold'
                                  : o.paymentStatus === 'paid'
                                  ? 'text-[#16A34A] font-semibold'
                                  : 'text-[#D97706] font-semibold'
                              }
                            >
                              {o.paymentMethod} · {o.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[#0F1B2D] tabular-nums">
                            ${o.total.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            {can('orders:manage') ? (
                              <select
                                value={o.orderStatus}
                                onChange={(e) =>
                                  handleOrderStatus(o.id, e.target.value as OrderStatus)
                                }
                                className="rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1 text-xs font-semibold text-[#0F1B2D] cursor-pointer"
                              >
                                <option value="confirmed">{translateStatus('confirmed')}</option>
                                <option value="packed">{translateStatus('packed')}</option>
                                <option value="shipped">{translateStatus('shipped')}</option>
                                <option value="delivered">{translateStatus('delivered')}</option>
                                <option value="cancelled">{translateStatus('cancelled')}</option>
                              </select>
                            ) : (
                              <span className="font-semibold text-[#0F1B2D]">
                                {translateStatus(o.orderStatus)}
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-3 ${isRtl ? 'text-left' : 'text-right'}`}>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(o)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] cursor-pointer"
                              >
                                <Eye className="h-3 w-3" />
                                <span>{t('admin.orders.items', 'Items')}</span>
                              </button>
                              {can('orders:refund') && o.paymentStatus !== 'refunded' ? (
                                <button
                                  type="button"
                                  onClick={() => handleRefundOrder(o)}
                                  className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors cursor-pointer"
                                >
                                  {t('admin.orders.processRefund', 'Refund')}
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#94A3B8]">
                                  {o.paymentStatus === 'refunded' ? t('admin.orders.refunded', 'Refunded') : ''}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* TAB 4: EMPLOYEES & RBAC RULES */}
          {activeTab === 'rbac' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {can('roles:manage') && (
                <>
                  {/* Store Branding & Custom Logo Manager */}
                  <section className="rounded-xl border border-[#E6ECF4] bg-white p-5 shadow-xs">
                    <div className="border-b border-[#E6ECF4] pb-4 mb-5">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-[#1180E1]" />
                        <h2 className="font-display text-base font-bold text-[#0F1B2D]">
                          {t('admin.overview.changeLogo', 'Store Logo & Visual Identity')}
                        </h2>
                      </div>
                      <p className="text-xs text-[#6B7A8D] mt-1">
                        {t('admin.overview.changeLogoDesc', 'Change your storefront logo dynamically without touching code. The updated logo immediately applies across the navigation bar, footer, and brand touchpoints.')}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Live Logo Preview Box */}
                      <div className="lg:col-span-4 rounded-xl border border-[#D4DFEE] bg-[#F7FAFD] p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-[11px] font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2.5">
                          {lang === 'ar' ? 'معاينة الشعار المباشرة' : 'Active Logo Preview'}
                        </span>
                        <div className="flex h-16 w-full items-center justify-center rounded-lg bg-white border border-[#E6ECF4] p-2.5 shadow-2xs">
                          <BrandLogo variant="dark" showWordmark={true} logoUrl={storeLogo} storeName={storeNameInput} />
                        </div>
                        <div className="mt-2.5 flex h-14 w-full items-center justify-center rounded-lg bg-[#0F1B2D] p-2.5">
                          <BrandLogo variant="light" showWordmark={true} logoUrl={storeLogo} storeName={storeNameInput} />
                        </div>
                        <span className="text-[10px] font-medium text-[#6B7A8D] mt-2">
                          {storeLogo ? (lang === 'ar' ? 'شعار مخصص قيد الاستخدام' : 'Custom image logo active') : (lang === 'ar' ? 'الشعار الافتراضي قيد الاستخدام' : 'Default SBS vector emblem active')}
                        </span>
                      </div>

                      {/* Logo Control Form */}
                      <form onSubmit={handleSaveBranding} className="lg:col-span-8 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#0F1B2D] mb-1">
                            {t('admin.settings.storeName', 'Store Display Name')}
                          </label>
                          <input
                            type="text"
                            value={storeNameInput}
                            onChange={(e) => setStoreNameInput(e.target.value)}
                            placeholder="Sam Brand Store"
                            className="h-9 w-full rounded-lg border border-[#D4DFEE] px-3 text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#0F1B2D] mb-1">
                            {lang === 'ar' ? 'صورة الشعار المخصص (رفع ملف أو رابط مباشر)' : 'Custom Logo Image (Upload or Direct URL)'}
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-3 text-xs font-semibold text-[#0F1B2D] hover:border-[#1180E1] hover:text-[#1180E1] cursor-pointer transition-colors shadow-2xs">
                              <Upload className="h-3.5 w-3.5 text-[#1180E1]" />
                              <span>{uploadingLogo ? (lang === 'ar' ? 'جارٍ الرفع...' : 'Uploading...') : t('admin.settings.uploadLogo', 'Upload Logo File')}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                                disabled={uploadingLogo}
                                className="hidden"
                              />
                            </label>

                            <div className="flex-1 min-w-[200px]">
                              <input
                                type="text"
                                value={storeLogo}
                                onChange={(e) => setStoreLogo(e.target.value)}
                                placeholder={t('admin.settings.logoUrlPlaceholder', 'Paste image URL (e.g. https://... or /uploads/...)')}
                                className="h-9 w-full rounded-lg border border-[#D4DFEE] px-3 font-mono text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-[#6B7A8D]">
                            {lang === 'ar'
                              ? 'الموصى به: PNG أو WebP أو SVG بخلفية شفافة (ارتفاع تقريبي 32-40 بكسل). الحجم الأقصى 4 ميجابايت.'
                              : 'Recommended: PNG, WebP, or SVG with transparent background (height ~32–40px). Max 4 MB.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="submit"
                            disabled={savingBranding || uploadingLogo}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-4 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{savingBranding ? t('admin.settings.saving', 'Saving...') : t('admin.settings.saveBranding', 'Save Branding & Logo')}</span>
                          </button>

                          {storeLogo && (
                            <button
                              type="button"
                              onClick={handleResetLogo}
                              disabled={savingBranding}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-3 text-xs font-semibold text-[#6B7A8D] hover:border-red-300 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('admin.settings.resetLogo', 'Reset to Default Logo')}</span>
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  </section>
                </>
              )}
              {can('roles:manage') && (
                <section className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#0F1B2D]">
                        {lang === 'ar' ? 'توجيه طلبات الدفع عبر واتساب' : 'WhatsApp Checkout Order Routing'}
                      </h2>
                      <p className="text-xs text-[#6B7A8D]">
                        {lang === 'ar'
                          ? 'يتم تحويل العملاء عند إتمام الطلب إلى رقم واتساب التجاري هذا مع فاتورة الطلب المنسقة.'
                          : 'Customers completing checkout are redirected to this WhatsApp Business number with their formatted order invoice.'}
                      </p>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setSavingWhatsapp(true);
                        try {
                          const updated = await api.updateStoreSettings(storeWhatsapp);
                          setStoreWhatsapp(updated.whatsappNumber);
                          notify(lang === 'ar' ? `تم تحديث رقم واتساب إلى ${updated.whatsappNumber}` : `Updated WhatsApp routing to ${updated.whatsappNumber}.`);
                        } catch (err) {
                          notify(
                            err instanceof Error ? err.message : (lang === 'ar' ? 'تعذر حفظ رقم واتساب.' : 'Unable to save WhatsApp number.'),
                            true
                          );
                        } finally {
                          setSavingWhatsapp(false);
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={storeWhatsapp}
                        onChange={(e) => setStoreWhatsapp(e.target.value)}
                        placeholder="96171972495"
                        className="h-9 w-48 rounded-lg border border-[#D4DFEE] px-3 font-mono text-xs text-[#0F1B2D] focus:border-[#1180E1] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={savingWhatsapp}
                        className="h-9 rounded-lg bg-[#0F1B2D] px-4 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer"
                      >
                        {savingWhatsapp
                          ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
                          : (lang === 'ar' ? 'حفظ الرقم' : 'Save Number')}
                      </button>
                    </form>
                  </div>
                </section>
              )}

              {/* Employee Directory */}
              {can('staff:read') && (
                <section className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6ECF4] pb-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#0F1B2D]">
                        {t('admin.rbac.staffMembers', 'Employee Accounts & Department Rules')}
                      </h2>
                      <p className="text-xs text-[#6B7A8D]">
                        {lang === 'ar'
                          ? 'تعيين الأدوار، تقييد صلاحيات الأقسام، أو إيقاف الحسابات فورياً.'
                          : 'Assign roles, restrict department scopes, or suspend access instantly.'}
                      </p>
                    </div>
                    {can('staff:manage') && (
                      <button
                        type="button"
                        onClick={() => setStaffModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1180E1] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>{t('admin.rbac.addStaff', 'Add Employee')}</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                      <thead className="border-b border-[#E6ECF4] text-[#6B7A8D]">
                        <tr>
                          <th className="py-2.5 font-semibold">{t('admin.rbac.employeeName', 'Employee')}</th>
                          <th className="py-2.5 font-semibold">{t('admin.rbac.roleName', 'Assigned Role')}</th>
                          <th className="py-2.5 font-semibold">{t('admin.scope', 'Dept Scope')}</th>
                          <th className="py-2.5 font-semibold">{t('admin.status', 'Status')}</th>
                          {can('staff:manage') && (
                            <th className={`py-2.5 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>{t('admin.actions', 'Access')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {staff.map((m) => (
                          <tr key={m.id}>
                            <td className="py-3">
                              <p className="font-semibold text-[#0F1B2D]">{m.name}</p>
                              <p className="text-[11px] text-[#6B7A8D]">{m.email}</p>
                            </td>
                            <td className="py-3">
                              {can('staff:manage') ? (
                                <select
                                  value={m.roleId}
                                  disabled={m.id === user.id}
                                  onChange={(e) => handleChangeStaffRole(m, e.target.value)}
                                  className="rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1 text-xs font-semibold text-[#0F1B2D] disabled:opacity-50 cursor-pointer"
                                >
                                  {roles
                                    .filter((r) => r.slug !== 'customer')
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {translateRole(r.name)}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span className="font-semibold text-[#0F1B2D]">{translateRole(m.roleName)}</span>
                              )}
                            </td>
                            <td className="py-3 font-mono text-[#475569]">
                              <span>{translateScope(m.departmentScope)}</span>
                              {m.customPermissions && m.customPermissions.length > 0 && (
                                <p className="text-[10px] text-[#1180E1]">
                                  +{m.customPermissions.length} {lang === 'ar' ? 'صلاحيات مخصصة' : 'custom rules'}
                                </p>
                              )}
                            </td>
                            <td className="py-3">
                              <span
                                className={`font-semibold capitalize ${
                                  m.status === 'active' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                                }`}
                              >
                                {m.status === 'active' ? t('admin.active', 'Active') : t('admin.inactive', 'Suspended')}
                              </span>
                            </td>
                            {can('staff:manage') && (
                              <td className="py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditStaffModal(m)}
                                    className="rounded-lg border border-[#D4DFEE] px-2.5 py-1 text-[11px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'تعديل / الصلاحيات' : 'Edit / Rules'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={m.id === user.id}
                                    onClick={() => handleToggleStaffStatus(m)}
                                    className="rounded-lg border border-[#D4DFEE] px-2.5 py-1 text-[11px] font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] disabled:opacity-40 cursor-pointer"
                                  >
                                    {m.status === 'active'
                                      ? (lang === 'ar' ? 'إيقاف' : 'Suspend')
                                      : (lang === 'ar' ? 'تفعيل' : 'Activate')}
                                  </button>
                                  {m.roleSlug !== 'owner' && m.id !== user.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStaff(m)}
                                      aria-label={`Remove ${m.name}`}
                                      className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-1.5 text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Role Permission Matrix */}
              <section className="rounded-xl border border-[#E6ECF4] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6ECF4] pb-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0F1B2D]">
                      {lang === 'ar' ? 'قواعد صلاحيات الأدوار والحدود المالية' : 'Role Permission Rules & Financial Caps'}
                    </h2>
                    <p className="text-xs text-[#6B7A8D]">
                      {lang === 'ar'
                        ? 'تخصيص الصلاحيات المطبقة، الحد الأقصى لنسبة الخصم، وحدود الموافقة على الاسترداد المالي.'
                        : 'Configure exact server-enforced capabilities, max discount percentages, and refund authorization limits.'}
                    </p>
                  </div>
                  {can('roles:manage') && (
                    <button
                      type="button"
                      onClick={openCreateRole}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('admin.rbac.createRole', 'Create Custom Role')}</span>
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {roles
                    .filter((r) => r.slug !== 'customer')
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-col justify-between rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-4"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                                {translateRole(r.name)}
                              </h3>
                              <p className="mt-0.5 text-xs text-[#6B7A8D]">{r.description}</p>
                            </div>
                            {can('roles:manage') && r.slug !== 'owner' && (
                              <button
                                type="button"
                                onClick={() => openEditRole(r)}
                                className="rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] cursor-pointer"
                              >
                                {lang === 'ar' ? 'تعديل القواعد' : 'Edit Rules'}
                              </button>
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-4 border-y border-[#E6ECF4] py-2 font-mono text-[11px] text-[#475569]">
                            <span>{lang === 'ar' ? 'أقصى خصم:' : 'Max Discount:'} {r.maxDiscountPct}%</span>
                            <span aria-hidden="true">·</span>
                            <span>{lang === 'ar' ? 'أقصى استرداد:' : 'Max Refund:'} ${r.maxRefundAmount}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {r.permissions.map((perm) => (
                              <span
                                key={perm}
                                className="font-mono text-[11px] text-[#0F1B2D] bg-white border border-[#E6ECF4] rounded px-2 py-0.5"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </motion.div>
          )}

          {/* TAB 5: AUDIT LOG */}
          {activeTab === 'audit' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="search"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث باسم الموظف، الإجراء، أو التفاصيل...' : 'Search actor, action, or details...'}
                  className="h-9 w-64 rounded-lg border border-[#D4DFEE] bg-white px-3 text-xs focus:border-[#1180E1] focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: lang === 'ar' ? 'جميع الأحداث' : 'All Events' },
                    { id: 'PRODUCT', label: lang === 'ar' ? 'المنتجات' : 'Products' },
                    { id: 'ORDER', label: lang === 'ar' ? 'الطلبات' : 'Orders' },
                    { id: 'STAFF', label: lang === 'ar' ? 'الموظفون والأدوار' : 'Staff & Roles' },
                    { id: 'RESTOCK', label: lang === 'ar' ? 'تنبيهات التوفر' : 'Restock Alerts' },
                    { id: 'CAMPAIGN', label: lang === 'ar' ? 'الحملات الإعلانية' : 'Campaigns' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAuditActionFilter(f.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer ${
                        auditActionFilter === f.id
                          ? 'bg-[#0F1B2D] text-white'
                          : 'border border-[#E6ECF4] bg-white text-[#475569] hover:text-[#0F1B2D]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E6ECF4] bg-white">
                <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="border-b border-[#E6ECF4] bg-[#F7FAFD] text-[#6B7A8D]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('admin.audit.timestamp', 'Timestamp')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.audit.actor', 'Actor')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.audit.action', 'Action')}</th>
                      <th className="px-4 py-3 font-semibold">{t('admin.audit.details', 'Details')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {auditLogs
                      .filter((log) => {
                        if (auditActionFilter !== 'all') {
                          if (auditActionFilter === 'STAFF') {
                            if (
                              !log.action.includes('STAFF') &&
                              !log.action.includes('ROLE') &&
                              !log.action.includes('PASSWORD')
                            ) {
                              return false;
                            }
                          } else if (!log.action.includes(auditActionFilter)) {
                            return false;
                          }
                        }
                        const q = auditSearch.trim().toLowerCase();
                        if (q) {
                          return (
                            log.actorName.toLowerCase().includes(q) ||
                            log.action.toLowerCase().includes(q) ||
                            log.details.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((log) => (
                        <tr key={log.id}>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#6B7A8D] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#0F1B2D]">{log.actorName}</span>
                            <span className="ml-1.5 text-[11px] text-[#6B7A8D]">
                              ({log.actorRole})
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-[#1180E1]">
                            {log.action}
                          </td>
                          <td className="px-4 py-3 text-[#475569]">{log.details}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Order Details Inspector Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/55 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F1B2D]">
                  {t('admin.orders.orderNumber', 'Order')} {selectedOrder.orderNumber}
                </h3>
                <p className="font-mono text-[11px] text-[#6B7A8D]">
                  {selectedOrder.transactionRef} · {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-[#6B7A8D] hover:text-[#0F1B2D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={`mt-4 space-y-4 text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5 space-y-1">
                <p className="font-semibold text-[#0F1B2D]">{selectedOrder.customerName}</p>
                <p className="text-[#475569]">
                  {selectedOrder.customerEmail} · {selectedOrder.customerPhone}
                </p>
                <p className="text-[#475569]">
                  {selectedOrder.shippingAddress}, {selectedOrder.city} {selectedOrder.postalCode}
                </p>
                {selectedOrder.notes && (
                  <p className="pt-1 text-[#1180E1]">
                    {lang === 'ar' ? 'ملاحظة: ' : 'Note: '}
                    {selectedOrder.notes}
                  </p>
                )}
              </div>

              <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E6ECF4] p-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 gap-3">
                    <div>
                      <p className="font-semibold text-[#0F1B2D]">
                        {PRODUCT_AR_MAP[item.sku]?.name || item.productName}
                      </p>
                      <p className="font-mono text-[10px] text-[#6B7A8D]">
                        {item.sku} · {item.variantLabel} · {lang === 'ar' ? 'الكمية' : 'Qty'} {item.quantity}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-[#0F1B2D] tabular-nums">
                      ${item.lineTotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-t border-[#E6ECF4] pt-3 font-mono text-[11px]">
                <div className="flex justify-between text-[#6B7A8D]">
                  <span>{t('cart.subtotal', 'Subtotal')}</span>
                  <span>${selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#6B7A8D]">
                  <span>{t('cart.shipping', 'Shipping')}</span>
                  <span>${selectedOrder.shippingCost.toFixed(2)}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#16A34A]">
                    <span>{t('cart.discount', 'Discount')} ({selectedOrder.promoCode})</span>
                    <span>-${selectedOrder.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#6B7A8D]">
                  <span>{t('cart.tax', 'Tax')}</span>
                  <span>${selectedOrder.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E6ECF4] pt-2 text-sm font-bold text-[#0F1B2D]">
                  <span>{t('cart.total', 'Total')}</span>
                  <span>${selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Advanced Product Modal (Admin & Limited-Access Managers) */}
      {productModal.open && (() => {
        const priceNum = Number(prodForm.price) || 0;
        const stockNum = Number.isFinite(Number(prodForm.stock)) ? Math.max(0, Math.floor(Number(prodForm.stock))) : 0;
        const thresholdNum = Number.isFinite(Number(prodForm.lowStockThreshold))
          ? Math.max(1, Math.floor(Number(prodForm.lowStockThreshold)))
          : 5;
        const costNum = prodForm.costPrice.trim() !== '' ? Number(prodForm.costPrice) : null;
        const compareNum = prodForm.compareAtPrice.trim() !== '' ? Number(prodForm.compareAtPrice) : null;
        const marginDollars = costNum !== null && priceNum > 0 ? priceNum - costNum : null;
        const marginPct =
          marginDollars !== null && priceNum > 0 ? Math.round((marginDollars / priceNum) * 100) : null;
        const markdownPct =
          compareNum && compareNum > priceNum
            ? Math.round(((compareNum - priceNum) / compareNum) * 100)
            : 0;
        const exceedsMarkdownCap = markdownPct > user.maxDiscountPct;
        const stockHealth =
          stockNum <= 0
            ? { label: 'Out of Stock', tone: 'text-[#DC2626]' }
            : stockNum <= thresholdNum
            ? { label: `Low Stock Alert (<= ${thresholdNum})`, tone: 'text-[#D97706]' }
            : { label: 'Healthy Stock', tone: 'text-[#16A34A]' };

        const tabErrors = {
          basics: ['sku', 'category', 'name', 'brand', 'price', 'compareAtPrice', 'costPrice', 'stock', 'lowStockThreshold', 'tagline', 'description'].filter(
            (k) => Boolean(prodFieldErrors[k])
          ).length,
          media: prodFieldErrors.images ? 1 : 0,
          specs: ['variants', 'specs'].filter((k) => Boolean(prodFieldErrors[k])).length,
          shipping: ['warranty', 'slug'].filter((k) => Boolean(prodFieldErrors[k])).length,
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/55 p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-[#E6ECF4] pb-3 gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F1B2D]">
                    {productModal.editing
                      ? (lang === 'ar'
                          ? `تعديل بيانات المنتج · ${productModal.editing.sku}`
                          : `Edit Complete Product · ${productModal.editing.sku}`)
                      : (lang === 'ar'
                          ? 'إضافة منتج عتاد كامل'
                          : 'Add Complete Hardware Product')}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#6B7A8D]">
                    {user.departmentScope === 'all'
                      ? (lang === 'ar' ? 'صلاحية كتابة كاملة في الكتالوج' : 'Full catalog write access')
                      : (lang === 'ar' ? `الأقسام المصرح بها: ${translateScope(user.departmentScope)}` : `Scoped Departments: ${user.departmentScope}`)}{' '}
                    · {lang === 'ar' ? 'سقف خصم الدور:' : 'Role Discount Cap:'}{' '}
                    <span className="font-mono font-semibold text-[#0F1B2D] tabular-nums">
                      {user.maxDiscountPct}%
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProductModal({ open: false, editing: null })}
                  aria-label="Close product modal"
                  className="p-1 text-[#6B7A8D] hover:text-[#0F1B2D] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {prodModalError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#DC2626]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">{lang === 'ar' ? 'خطأ في التحقق أو الحفظ' : 'Validation or Save Error'}</p>
                    <p className="mt-0.5">{prodModalError}</p>
                  </div>
                </div>
              )}

              {/* Section Navigation Tabs */}
              <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-1 sm:grid-cols-4">
                {(
                  [
                    {
                      id: 'basics',
                      label: lang === 'ar' ? '1. الهوية والمخزون' : '1. Identity & Inventory',
                      icon: Tag,
                      errs: tabErrors.basics,
                    },
                    {
                      id: 'media',
                      label: lang === 'ar'
                        ? `2. الصور (${prodForm.images.length}/${MAX_PRODUCT_IMAGES})`
                        : `2. Multi-Images (${prodForm.images.length}/${MAX_PRODUCT_IMAGES})`,
                      icon: Upload,
                      errs: tabErrors.media,
                    },
                    {
                      id: 'specs',
                      label: lang === 'ar' ? '3. المواصفات والخيارات' : '3. Specs, Variants & Box',
                      icon: Layers,
                      errs: tabErrors.specs,
                    },
                    {
                      id: 'shipping',
                      label: lang === 'ar' ? '4. الشحن والبيانات' : '4. Shipping & Metadata',
                      icon: Sparkles,
                      errs: tabErrors.shipping,
                    },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const active = prodFormTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setProdFormTab(t.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white text-[#0F1B2D] shadow-xs border border-[#E6ECF4]'
                          : t.errs > 0
                          ? 'text-[#DC2626] bg-[#FEF2F2]/70'
                          : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${t.errs > 0 ? 'text-[#DC2626]' : 'text-[#1180E1]'}`} />
                      <span className="truncate">{t.label}</span>
                      {t.errs > 0 && (
                        <span className="font-mono text-[10px] font-bold text-[#DC2626]">
                          ({t.errs})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <form noValidate onSubmit={handleSaveProduct} className="mt-4 space-y-4 text-xs">
                {/* SECTION 1: IDENTITY, PRICING & INVENTORY MANAGEMENT */}
                {prodFormTab === 'basics' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-[#475569]">SKU *</label>
                          {!productModal.editing && (
                            <button
                              type="button"
                              onClick={() => {
                                clearProdFieldError('sku');
                                setProdForm((prev) => ({
                                  ...prev,
                                  sku: `SBS-${prev.category.slice(0, 3).toUpperCase()}-${Math.floor(
                                    100 + Math.random() * 900
                                  )}`,
                                }));
                              }}
                              className="text-[10px] font-semibold text-[#1180E1] hover:underline cursor-pointer"
                            >
                              {lang === 'ar' ? 'توليد تلقائي' : 'Auto-SKU'}
                            </button>
                          )}
                        </div>
                        <input
                          disabled={Boolean(productModal.editing)}
                          value={prodForm.sku}
                          onChange={(e) => {
                            clearProdFieldError('sku');
                            setProdForm({ ...prodForm, sku: e.target.value.toUpperCase() });
                          }}
                          placeholder="SBS-PER-904"
                          className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono disabled:bg-[#F7FAFD] ${
                            prodFieldErrors.sku ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#D4DFEE]'
                          }`}
                        />
                        {prodFieldErrors.sku && (
                          <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.sku}</p>
                        )}
                      </div>
                      <div>
                        <label className="font-semibold text-[#475569]">{t('admin.catalog.categoryHeader', 'Department')} *</label>
                        <select
                          value={prodForm.category}
                          onChange={(e) => {
                            clearProdFieldError('category');
                            setProdForm({
                              ...prodForm,
                              category: e.target.value as Product['category'],
                            });
                          }}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                            prodFieldErrors.category ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                          }`}
                        >
                          {(allowedProductCategories.length > 0
                            ? allowedProductCategories
                            : ALL_DEPARTMENTS
                          ).map((cat) => (
                            <option key={cat} value={cat}>
                              {translateCategory(cat)}
                            </option>
                          ))}
                        </select>
                        {prodFieldErrors.category && (
                          <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.category}</p>
                        )}
                      </div>
                      <div>
                        <label className="font-semibold text-[#475569]">{lang === 'ar' ? 'الشارة (اختياري)' : 'Badge (Optional)'}</label>
                        <input
                          value={prodForm.badge}
                          onChange={(e) => setProdForm({ ...prodForm, badge: e.target.value })}
                          placeholder={lang === 'ar' ? 'مميز / الأكثر مبيعاً / جديد' : 'Flagship / Best Seller / New'}
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="font-semibold text-[#475569]">{t('admin.catalog.productName', 'Product Name')} *</label>
                        <input
                          value={prodForm.name}
                          onChange={(e) => {
                            clearProdFieldError('name');
                            setProdForm({ ...prodForm, name: e.target.value });
                          }}
                          placeholder="ApexBlade 27 OLED 240Hz Monitor"
                          className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                            prodFieldErrors.name ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#D4DFEE]'
                          }`}
                        />
                        {prodFieldErrors.name && (
                          <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="font-semibold text-[#475569]">{t('admin.catalog.brandHeader', 'Brand')} *</label>
                        <input
                          value={prodForm.brand}
                          onChange={(e) => {
                            clearProdFieldError('brand');
                            setProdForm({ ...prodForm, brand: e.target.value });
                          }}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                            prodFieldErrors.brand ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#D4DFEE]'
                          }`}
                        />
                        {prodFieldErrors.brand && (
                          <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.brand}</p>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Pricing & Inventory Control Panel */}
                    <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#0F1B2D]">
                          {lang === 'ar' ? 'التحكم بالأسعار والهامش والمخزون' : 'Pricing, Margin & Inventory Control'}
                        </p>
                        <span className={`font-mono text-[11px] font-semibold ${stockHealth.tone}`}>
                          {stockHealth.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <div>
                          <label className="font-semibold text-[#475569]">{t('admin.catalog.priceHeader', 'Sale Price')} ($) *</label>
                          <input
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={prodForm.price}
                            onChange={(e) => {
                              clearProdFieldError('price');
                              clearProdFieldError('compareAtPrice');
                              setProdForm({ ...prodForm, price: Number(e.target.value) });
                            }}
                            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono tabular-nums ${
                              prodFieldErrors.price ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                            }`}
                          />
                          {prodFieldErrors.price && (
                            <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.price}</p>
                          )}
                        </div>
                        <div>
                          <label className="font-semibold text-[#475569]">{t('admin.catalog.comparePrice', 'Compare-At')} ($)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={prodForm.compareAtPrice}
                            onChange={(e) => {
                              clearProdFieldError('compareAtPrice');
                              setProdForm({ ...prodForm, compareAtPrice: e.target.value });
                            }}
                            placeholder="MSRP"
                            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono tabular-nums ${
                              prodFieldErrors.compareAtPrice ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                            }`}
                          />
                          {prodFieldErrors.compareAtPrice && (
                            <p className="mt-1 text-[10px] font-medium text-[#DC2626]">
                              {prodFieldErrors.compareAtPrice}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="font-semibold text-[#475569]">{lang === 'ar' ? 'تكلفة الوحدة ($)' : 'Unit Cost ($)'}</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={prodForm.costPrice}
                            onChange={(e) => {
                              clearProdFieldError('costPrice');
                              setProdForm({ ...prodForm, costPrice: e.target.value });
                            }}
                            placeholder="Cost"
                            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono tabular-nums ${
                              prodFieldErrors.costPrice ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                            }`}
                          />
                          {prodFieldErrors.costPrice && (
                            <p className="mt-1 text-[10px] font-medium text-[#DC2626]">
                              {prodFieldErrors.costPrice}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="font-semibold text-[#475569]">{t('admin.catalog.stockQty', 'Stock Qty')} *</label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={prodForm.stock}
                            onChange={(e) => {
                              clearProdFieldError('stock');
                              setProdForm({ ...prodForm, stock: Number(e.target.value) });
                            }}
                            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono tabular-nums ${
                              prodFieldErrors.stock ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                            }`}
                          />
                          {prodFieldErrors.stock && (
                            <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.stock}</p>
                          )}
                        </div>
                        <div>
                          <label className="font-semibold text-[#475569]">{t('admin.catalog.lowStockThreshold', 'Low Alert At')} *</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={prodForm.lowStockThreshold}
                            onChange={(e) => {
                              clearProdFieldError('lowStockThreshold');
                              setProdForm({
                                ...prodForm,
                                lowStockThreshold: Number(e.target.value),
                              });
                            }}
                            className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono tabular-nums ${
                              prodFieldErrors.lowStockThreshold ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                            }`}
                          />
                          {prodFieldErrors.lowStockThreshold && (
                            <p className="mt-1 text-[10px] font-medium text-[#DC2626]">
                              {prodFieldErrors.lowStockThreshold}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick Stock Presets */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6ECF4] pt-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-[#6B7A8D] mr-1">
                            {lang === 'ar' ? 'تعديل سريع للمخزون:' : 'Quick Stock Adjust:'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              clearProdFieldError('stock');
                              setProdForm((prev) => ({ ...prev, stock: 0 }));
                            }}
                            className="rounded-md border border-[#FECACA] bg-white px-2 py-1 text-[10px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                          >
                            {lang === 'ar' ? 'تصفير (نفد)' : 'Set 0 (Sold Out)'}
                          </button>
                          {[10, 25, 50].map((qty) => (
                            <button
                              key={qty}
                              type="button"
                              onClick={() => {
                                clearProdFieldError('stock');
                                setProdForm((prev) => ({
                                  ...prev,
                                  stock: Math.max(0, Math.floor(Number(prev.stock) || 0)) + qty,
                                }));
                              }}
                              className="rounded-md border border-[#D4DFEE] bg-white px-2 py-1 font-mono text-[10px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] hover:text-[#1180E1] cursor-pointer"
                            >
                              +{qty}
                            </button>
                          ))}
                        </div>

                        <div className="font-mono text-[11px] text-[#475569] tabular-nums">
                          {lang === 'ar' ? 'قيمة المخزون:' : 'Stock Value:'}{' '}
                          <strong className="text-[#0F1B2D]">
                            ${(priceNum * stockNum).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </strong>
                          {costNum !== null && (
                            <span className="ml-2 text-[#6B7A8D]">
                              ({lang === 'ar' ? 'التكلفة:' : 'Cost:'} ${(costNum * stockNum).toLocaleString(undefined, { maximumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Live Margin & Role Cap Feedback */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6ECF4] pt-2 font-mono text-[11px] tabular-nums">
                        <span>
                          {lang === 'ar' ? 'هامش ربح الوحدة:' : 'Unit Profit Margin:'}{' '}
                          <strong
                            className={
                              marginDollars !== null && marginDollars <= 0
                                ? 'text-[#DC2626]'
                                : 'text-[#16A34A]'
                            }
                          >
                            {marginDollars !== null
                              ? `$${marginDollars.toFixed(2)} (${marginPct}%)${
                                  marginDollars <= 0 ? (lang === 'ar' ? ' — هامش صفري/سلبي' : ' — Zero/Negative Margin') : ''
                                }`
                              : (lang === 'ar' ? 'أدخل سعر التكلفة لحساب الهامش' : 'Enter Unit Cost to compute')}
                          </strong>
                        </span>
                        <span className={exceedsMarkdownCap ? 'font-bold text-[#DC2626]' : 'text-[#475569]'}>
                          {lang === 'ar' ? 'الخصم:' : 'Markdown:'} {markdownPct}% ({lang === 'ar' ? 'سقف الدور:' : 'Role Limit:'} {user.maxDiscountPct}%)
                          {exceedsMarkdownCap ? (lang === 'ar' ? ' — يتجاوز الحد!' : ' — Exceeds Cap!') : ''}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-[#475569]">{lang === 'ar' ? 'العنوان الترويجي القصير *' : 'Short Tagline *'}</label>
                      <input
                        value={prodForm.tagline}
                        onChange={(e) => {
                          clearProdFieldError('tagline');
                          setProdForm({ ...prodForm, tagline: e.target.value });
                        }}
                        placeholder={lang === 'ar' ? 'وصف تسويقي موجز للعتاد في سطر واحد...' : 'Crisp one-line hardware summary...'}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                          prodFieldErrors.tagline ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#D4DFEE]'
                        }`}
                      />
                      {prodFieldErrors.tagline && (
                        <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.tagline}</p>
                      )}
                    </div>

                    <div>
                      <label className="font-semibold text-[#475569]">{t('admin.catalog.productDesc', 'Full Product Description')} *</label>
                      <textarea
                        rows={3}
                        value={prodForm.description}
                        onChange={(e) => {
                          clearProdFieldError('description');
                          setProdForm({ ...prodForm, description: e.target.value });
                        }}
                        placeholder={lang === 'ar' ? 'الميزات بالتفصيل، المواد المستخدمة، ومواصفات الأداء...' : 'Detailed product features, materials, and performance highlights...'}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                          prodFieldErrors.description ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#D4DFEE]'
                        }`}
                      />
                      {prodFieldErrors.description && (
                        <p className="mt-1 text-[10px] font-medium text-[#DC2626]">
                          {prodFieldErrors.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION 2: MULTI-IMAGE GALLERY MANAGER */}
                {prodFormTab === 'media' && (
                  <div className="space-y-4">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingMedia(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingMedia(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingMedia(false);
                        void handleMultiProductImagesSelect(e.dataTransfer.files);
                      }}
                      className={`rounded-xl border-2 border-dashed p-4 space-y-3 transition-colors ${
                        isDraggingMedia
                          ? 'border-[#1180E1] bg-[#EFF6FF]'
                          : 'border-[#CBD8EA] bg-[#F7FAFD]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#0F1B2D]">
                            {lang === 'ar' ? 'معرض صور المنتج' : 'Product Multi-Image Gallery'} ({prodForm.images.length}/{MAX_PRODUCT_IMAGES})
                          </p>
                          <p className="text-[11px] text-[#6B7A8D]">
                            {lang === 'ar'
                              ? 'اسحب وأفلت صور PNG أو JPG أو WEBP (بحد أقصى 4 ميجابايت)، أو ارفع ملفات، أو أضف روابط الصور. الصورة الأولى ستكون الغلاف.'
                              : 'Drag & drop multiple PNG, JPG, or WEBP files (max 4 MB each), upload, or add image URLs. First photo is catalog cover.'}
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1180E1] cursor-pointer whitespace-nowrap shrink-0">
                          <Upload className="h-3.5 w-3.5" />
                          <span>
                            {uploadingSlot === 'product'
                              ? (lang === 'ar' ? 'جارٍ الرفع...' : 'Uploading...')
                              : (lang === 'ar' ? 'اختيار عدة صور' : 'Select Multi-Images')}
                          </span>
                          <input
                            type="file"
                            multiple
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              void handleMultiProductImagesSelect(e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newImageUrlInput}
                          onChange={(e) => {
                            clearProdFieldError('images');
                            setNewImageUrlInput(e.target.value);
                          }}
                          placeholder={lang === 'ar' ? 'أدخل رابط الصورة (/uploads/... أو https://...) واضغط إضافة' : 'Paste image URL (/uploads/... or https://...) and click Add'}
                          className="flex-1 rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1.5 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = newImageUrlInput.trim();
                            if (!url) return;
                            if (!isValidProductMediaUrl(url)) {
                              const msg = lang === 'ar' ? 'يجب أن يبدأ الرابط بـ https:// أو http:// أو /.' : 'Image URL must start with https://, http://, or /.';
                              setProdModalError(msg);
                              setProdFieldErrors((prev) => ({ ...prev, images: msg }));
                              return;
                            }
                            if (prodForm.images.length >= MAX_PRODUCT_IMAGES) {
                              const msg = lang === 'ar' ? `الحد الأقصى المسموح به هو ${MAX_PRODUCT_IMAGES} صور لكل منتج.` : `Maximum ${MAX_PRODUCT_IMAGES} images allowed per product.`;
                              setProdModalError(msg);
                              setProdFieldErrors((prev) => ({ ...prev, images: msg }));
                              return;
                            }
                            setProdModalError(null);
                            clearProdFieldError('images');
                            setProdForm((prev) => {
                              const next = Array.from(new Set([...prev.images, url]));
                              return { ...prev, images: next, imageUrl: next[0] || url };
                            });
                            setNewImageUrlInput('');
                          }}
                          className="rounded-lg border border-[#D4DFEE] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {lang === 'ar' ? '+ إضافة الرابط' : '+ Add URL'}
                        </button>
                      </div>

                      {prodFieldErrors.images && (
                        <p className="text-[11px] font-medium text-[#DC2626]">{prodFieldErrors.images}</p>
                      )}

                      {prodForm.images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {prodForm.images.map((imgUrl, idx) => (
                            <div
                              key={`${imgUrl}-${idx}`}
                              className={`overflow-hidden rounded-lg border bg-white p-1.5 ${
                                idx === 0
                                  ? 'border-[#1180E1] ring-1 ring-[#1180E1]/30'
                                  : 'border-[#D4DFEE]'
                              }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`Product view ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="aspect-[4/3] w-full rounded object-cover"
                              />
                              <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px]">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      setProdForm((prev) => {
                                        const arr = [...prev.images];
                                        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                        return { ...prev, images: arr, imageUrl: arr[0] || '' };
                                      });
                                    }}
                                    aria-label="Move image left"
                                    className="rounded border border-[#E6ECF4] p-0.5 text-[#475569] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === prodForm.images.length - 1}
                                    onClick={() => {
                                      setProdForm((prev) => {
                                        const arr = [...prev.images];
                                        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                        return { ...prev, images: arr, imageUrl: arr[0] || '' };
                                      });
                                    }}
                                    aria-label="Move image right"
                                    className="rounded border border-[#E6ECF4] p-0.5 text-[#475569] disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </div>

                                {idx === 0 ? (
                                  <span className="font-bold text-[#1180E1]">
                                    {lang === 'ar' ? 'الغلاف' : 'Cover'}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProdForm((prev) => {
                                        const reordered = [
                                          imgUrl,
                                          ...prev.images.filter((_, i) => i !== idx),
                                        ];
                                        return {
                                          ...prev,
                                          images: reordered,
                                          imageUrl: reordered[0] || '',
                                        };
                                      });
                                    }}
                                    className="font-semibold text-[#475569] hover:text-[#1180E1] cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'تعيين كغلاف' : 'Set Cover'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setProdForm((prev) => {
                                      const next = prev.images.filter((_, i) => i !== idx);
                                      return {
                                        ...prev,
                                        images: next,
                                        imageUrl: next[0] || '',
                                      };
                                    });
                                  }}
                                  className="text-[#DC2626] hover:underline cursor-pointer"
                                >
                                  {lang === 'ar' ? 'إزالة' : 'Remove'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-[#CBD8EA] bg-white py-6 text-center text-[11px] text-[#6B7A8D]">
                          {lang === 'ar'
                            ? `اسحب الملفات هنا أو اضغط لاختيار الصور — سيظهر الرسم البديل (${prodForm.visualKey}) حتى تتم إضافة صور.`
                            : `Drop files above or click Select Multi-Images — fallback vector artwork (${prodForm.visualKey}) shows until photos are added.`}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="font-semibold text-[#475569]">
                        {lang === 'ar' ? 'الرسم الهندسي البديل' : 'Fallback Hardware Artwork'}
                      </label>
                      <select
                        value={prodForm.visualKey}
                        onChange={(e) => setProdForm({ ...prodForm, visualKey: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2"
                      >
                        <option value="console-pro">Pro Console</option>
                        <option value="oled-monitor">OLED Monitor</option>
                        <option value="mechanical-keyboard">Mechanical Keyboard</option>
                        <option value="wireless-headset">Wireless Headset</option>
                        <option value="handheld-console">Handheld OLED</option>
                        <option value="esports-mouse">Esports Mouse</option>
                        <option value="pro-controller">Pro Controller</option>
                        <option value="ultrawide-monitor">Ultrawide Monitor</option>
                        <option value="thunderbolt-dock">Thunderbolt Dock</option>
                        <option value="studio-mic">Studio Mic</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* SECTION 3: SPECS, VARIANTS & WHAT'S IN THE BOX */}
                {prodFormTab === 'specs' && (
                  <div className="space-y-4">
                    {/* Variants */}
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5 space-y-2.5">
                      <p className="font-semibold text-[#0F1B2D]">
                        {lang === 'ar' ? 'الإصدارات والخيارات *' : 'Configurations / Variants *'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {prodForm.variants.map((variant, idx) => (
                          <span
                            key={`${variant}-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-[#F7FAFD] px-2.5 py-1 text-[11px] font-semibold text-[#0F1B2D]"
                          >
                            <span>{variant}</span>
                            {prodForm.variants.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setProdForm((prev) => ({
                                    ...prev,
                                    variants: prev.variants.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="text-[#6B7A8D] hover:text-[#DC2626] cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newVariantInput}
                          onChange={(e) => setNewVariantInput(e.target.value)}
                          placeholder={lang === 'ar' ? 'مثال: أبيض جليدي / 2 تيرابايت' : 'e.g. Arctic White / 2TB Edition'}
                          className="flex-1 rounded-lg border border-[#D4DFEE] px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newVariantInput.trim();
                            if (!val) return;
                            clearProdFieldError('variants');
                            setProdForm((prev) => ({
                              ...prev,
                              variants: Array.from(new Set([...prev.variants, val])),
                            }));
                            setNewVariantInput('');
                          }}
                          className="rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                        >
                          {lang === 'ar' ? '+ إضافة خيار' : '+ Add Variant'}
                        </button>
                      </div>
                      {prodFieldErrors.variants && (
                        <p className="text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.variants}</p>
                      )}
                    </div>

                    {/* Specs Builder + Category Template */}
                    <div
                      className={`rounded-xl border bg-white p-3.5 space-y-2.5 ${
                        prodFieldErrors.specs ? 'border-[#DC2626]' : 'border-[#E6ECF4]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#0F1B2D]">
                          {lang === 'ar'
                            ? 'المواصفات التقنية (جدول المقارنة والتفاصيل) *'
                            : 'Technical Specifications (Comparison & Detail Sheet) *'}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              clearProdFieldError('specs');
                              setProdForm((prev) => ({
                                ...prev,
                                specsList: CATEGORY_SPEC_TEMPLATES[prev.category].map((r) => ({ ...r })),
                              }));
                            }}
                            className="text-[11px] font-semibold text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                          >
                            {lang === 'ar' ? `تحميل نموذج ${translateCategory(prodForm.category)}` : `Load ${prodForm.category} Template`}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearProdFieldError('specs');
                              setProdForm((prev) => ({
                                ...prev,
                                specsList: [...prev.specsList, { key: '', value: '' }],
                              }));
                            }}
                            className="text-[11px] font-semibold text-[#1180E1] hover:underline cursor-pointer"
                          >
                            {lang === 'ar' ? '+ إضافة سطر مواصفة' : '+ Add Spec Row'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {prodForm.specsList.map((row, idx) => {
                          const incomplete =
                            (row.key.trim() !== '' && row.value.trim() === '') ||
                            (row.key.trim() === '' && row.value.trim() !== '');
                          return (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                              <input
                                type="text"
                                value={row.key}
                                onChange={(e) => {
                                  clearProdFieldError('specs');
                                  const next = [...prodForm.specsList];
                                  next[idx] = { ...next[idx], key: e.target.value };
                                  setProdForm({ ...prodForm, specsList: next });
                                }}
                                placeholder={lang === 'ar' ? 'اسم الخاصية (مثال: الشاشة)' : 'Spec Name (e.g. Refresh)'}
                                className={`col-span-5 rounded-lg border px-2.5 py-1.5 text-xs ${
                                  incomplete && !row.key.trim()
                                    ? 'border-[#DC2626] bg-[#FEF2F2]/40'
                                    : 'border-[#D4DFEE]'
                                }`}
                              />
                              <input
                                type="text"
                                value={row.value}
                                onChange={(e) => {
                                  clearProdFieldError('specs');
                                  const next = [...prodForm.specsList];
                                  next[idx] = { ...next[idx], value: e.target.value };
                                  setProdForm({ ...prodForm, specsList: next });
                                }}
                                placeholder={lang === 'ar' ? 'القيمة (مثال: 240 هرتز)' : 'Spec Value (e.g. 240Hz)'}
                                className={`col-span-6 rounded-lg border px-2.5 py-1.5 text-xs ${
                                  incomplete && !row.value.trim()
                                    ? 'border-[#DC2626] bg-[#FEF2F2]/40'
                                    : 'border-[#D4DFEE]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  clearProdFieldError('specs');
                                  setProdForm((prev) => ({
                                    ...prev,
                                    specsList: prev.specsList.filter((_, i) => i !== idx),
                                  }));
                                }}
                                aria-label="Remove spec row"
                                className="col-span-1 flex justify-center text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {prodFieldErrors.specs && (
                        <p className="text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.specs}</p>
                      )}
                    </div>

                    {/* What's in the Box */}
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5 space-y-2.5">
                      <p className="font-semibold text-[#0F1B2D]">What&apos;s in the Box</p>
                      <div className="flex flex-wrap gap-1.5">
                        {prodForm.whatsInBox.map((item, idx) => (
                          <span
                            key={`${item}-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-[#F7FAFD] px-2.5 py-1 text-[11px] font-medium text-[#0F1B2D]"
                          >
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setProdForm((prev) => ({
                                  ...prev,
                                  whatsInBox: prev.whatsInBox.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-[#6B7A8D] hover:text-[#DC2626] cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newBoxItemInput}
                          onChange={(e) => setNewBoxItemInput(e.target.value)}
                          placeholder="e.g. HDMI 2.1 Ultra High Speed Cable"
                          className="flex-1 rounded-lg border border-[#D4DFEE] px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newBoxItemInput.trim();
                            if (!val) return;
                            setProdForm((prev) => ({
                              ...prev,
                              whatsInBox: Array.from(new Set([...prev.whatsInBox, val])),
                            }));
                            setNewBoxItemInput('');
                          }}
                          className="rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                        >
                          + Add Item
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 4: SHIPPING, WARRANTY, CONDITION & TAGS */}
                {prodFormTab === 'shipping' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="font-semibold text-[#475569]">Hardware Condition</label>
                        <select
                          value={prodForm.condition}
                          onChange={(e) =>
                            setProdForm({
                              ...prodForm,
                              condition: e.target.value as Product['condition'],
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                        >
                          <option value="New">Brand New (Factory Sealed)</option>
                          <option value="Refurbished">Certified Refurbished</option>
                          <option value="Open Box">Open Box Verified</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-[#475569]">Warranty Plan *</label>
                        <input
                          value={prodForm.warranty}
                          onChange={(e) => {
                            clearProdFieldError('warranty');
                            setProdForm({ ...prodForm, warranty: e.target.value });
                          }}
                          placeholder="2-Year Official Sam Brand Warranty"
                          className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                            prodFieldErrors.warranty ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                          }`}
                        />
                        {prodFieldErrors.warranty && (
                          <p className="mt-1 text-[10px] font-medium text-[#DC2626]">
                            {prodFieldErrors.warranty}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="font-semibold text-[#475569]">Weight</label>
                        <input
                          value={prodForm.weight}
                          onChange={(e) => setProdForm({ ...prodForm, weight: e.target.value })}
                          placeholder="e.g. 1.25 kg"
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-[#475569]">Dimensions</label>
                        <input
                          value={prodForm.dimensions}
                          onChange={(e) => setProdForm({ ...prodForm, dimensions: e.target.value })}
                          placeholder="e.g. 360 x 140 x 38 mm"
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-[#475569]">URL Slug (Optional)</label>
                        <input
                          value={prodForm.slug}
                          onChange={(e) => {
                            clearProdFieldError('slug');
                            setProdForm({ ...prodForm, slug: e.target.value });
                          }}
                          placeholder="auto-generated-from-name"
                          className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono ${
                            prodFieldErrors.slug ? 'border-[#DC2626]' : 'border-[#D4DFEE]'
                          }`}
                        />
                        {prodFieldErrors.slug && (
                          <p className="mt-1 text-[10px] font-medium text-[#DC2626]">{prodFieldErrors.slug}</p>
                        )}
                      </div>
                    </div>

                    {/* Search Tags */}
                    <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5 space-y-2.5">
                      <p className="font-semibold text-[#0F1B2D]">Search &amp; Discovery Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {prodForm.tags.map((tag, idx) => (
                          <span
                            key={`${tag}-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-[#F7FAFD] px-2.5 py-1 font-mono text-[11px] text-[#0F1B2D]"
                          >
                            <span>#{tag}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setProdForm((prev) => ({
                                  ...prev,
                                  tags: prev.tags.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-[#6B7A8D] hover:text-[#DC2626] cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="e.g. esports, wireless, 240hz"
                          className="flex-1 rounded-lg border border-[#D4DFEE] px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newTagInput.trim().toLowerCase();
                            if (!val) return;
                            setProdForm((prev) => ({
                              ...prev,
                              tags: Array.from(new Set([...prev.tags, val])),
                            }));
                            setNewTagInput('');
                          }}
                          className="rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                        >
                          + Add Tag
                        </button>
                      </div>
                    </div>

                    {/* Visibility Flags */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5">
                      <label className="flex items-center gap-2 font-semibold text-[#0F1B2D] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodForm.featured}
                          onChange={(e) => setProdForm({ ...prodForm, featured: e.target.checked })}
                          className="accent-[#1180E1]"
                        />
                        <span>Featured Product (Shown in Featured Drops Slide)</span>
                      </label>

                      <label className="flex items-center gap-2 font-semibold text-[#0F1B2D] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodForm.active}
                          onChange={(e) => setProdForm({ ...prodForm, active: e.target.checked })}
                          className="accent-[#1180E1]"
                        />
                        <span>Active &amp; Published on Storefront</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-[#E6ECF4] pt-4">
                  <div className="flex items-center gap-2">
                    {prodFormTab !== 'basics' && (
                      <button
                        type="button"
                        onClick={() =>
                          setProdFormTab(
                            prodFormTab === 'shipping'
                              ? 'specs'
                              : prodFormTab === 'specs'
                              ? 'media'
                              : 'basics'
                          )
                        }
                        className="rounded-lg border border-[#D4DFEE] px-3.5 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
                      >
                        Previous Step
                      </button>
                    )}
                    {prodFormTab !== 'shipping' && (
                      <button
                        type="button"
                        onClick={() =>
                          setProdFormTab(
                            prodFormTab === 'basics'
                              ? 'media'
                              : prodFormTab === 'media'
                              ? 'specs'
                              : 'shipping'
                          )
                        }
                        className="rounded-lg border border-[#D4DFEE] px-3.5 py-2 text-xs font-semibold text-[#1180E1] hover:bg-[#EFF6FF] cursor-pointer"
                      >
                        Next Step
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={exceedsMarkdownCap || prodFormSaving}
                    className="rounded-lg bg-[#1180E1] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0D6BC0] disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {prodFormSaving
                      ? 'Saving...'
                      : productModal.editing
                      ? 'Save Complete Product'
                      : 'Publish Complete Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Campaign / Dual-Size Banner Modal */}
      {campaignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-3">
              <h3 className="font-display text-lg font-bold text-[#0F1B2D]">
                {campaignModal.editing ? 'Edit Marketing Banner' : 'New Marketing Offer / Banner'}
              </h3>
              <button
                type="button"
                onClick={() => setCampaignModal({ open: false, editing: null })}
                className="p-1 text-[#6B7A8D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-semibold text-[#475569]">Placement</label>
                  <select
                    value={campForm.placement}
                    onChange={(e) =>
                      setCampForm({
                        ...campForm,
                        placement: e.target.value as CampaignPlacement,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  >
                    <option value="hero">Hero Banner (Top)</option>
                    <option value="offer_strip">Offer Strip (Full Row)</option>
                    <option value="banner_grid">Promo Banner Grid</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#475569]">Section Size</label>
                  <select
                    value={campForm.sectionSize}
                    onChange={(e) =>
                      setCampForm({
                        ...campForm,
                        sectionSize: e.target.value as CampaignSectionSize,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  >
                    <option value="full">Full Width (12-Col)</option>
                    <option value="split">Split (6-Col / 50-50)</option>
                    <option value="compact">Compact (Slim Height)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#475569]">Design Theme</label>
                  <select
                    value={campForm.designTheme}
                    onChange={(e) =>
                      setCampForm({
                        ...campForm,
                        designTheme: e.target.value as CampaignTheme,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  >
                    <option value="navy">Navy Dark (#0F1B2D)</option>
                    <option value="cobalt">Cobalt Blue (#1180E1)</option>
                    <option value="obsidian">Obsidian Dark (#111827)</option>
                    <option value="chalk">Light Surface (#F7FAFD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#475569]">Offer Tag / Eyebrow</label>
                  <input
                    required
                    value={campForm.offerTag}
                    onChange={(e) => setCampForm({ ...campForm, offerTag: e.target.value })}
                    placeholder="Weekend Flash Offer"
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Banner Title</label>
                  <input
                    required
                    value={campForm.title}
                    onChange={(e) => setCampForm({ ...campForm, title: e.target.value })}
                    placeholder="Save 15% on Pro OLED Monitors"
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#475569]">Subtitle / Offer Details</label>
                <textarea
                  rows={2}
                  value={campForm.subtitle}
                  onChange={(e) => setCampForm({ ...campForm, subtitle: e.target.value })}
                  placeholder="Describe the promotion, discount, or featured hardware bundle..."
                  className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="font-semibold text-[#475569]">CTA Button Text</label>
                  <input
                    required
                    value={campForm.ctaLabel}
                    onChange={(e) => setCampForm({ ...campForm, ctaLabel: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Promo Code</label>
                  <input
                    value={campForm.promoCode}
                    onChange={(e) =>
                      setCampForm({ ...campForm, promoCode: e.target.value.toUpperCase() })
                    }
                    placeholder="SAM10"
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Target Dept</label>
                  <select
                    value={campForm.targetCategory}
                    onChange={(e) => setCampForm({ ...campForm, targetCategory: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  >
                    <option value="All">All</option>
                    {allowedProductCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Sort Order</label>
                  <input
                    type="number"
                    min={1}
                    value={campForm.sortOrder}
                    onChange={(e) =>
                      setCampForm({ ...campForm, sortOrder: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              {/* Dual-Size Banner Upload Slots: PC Desktop + Mobile */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F1B2D]">
                      <Monitor className="h-3.5 w-3.5 text-[#1180E1]" />
                      <span>1. PC / Desktop Banner (16:9)</span>
                    </span>
                    <label className="inline-flex items-center gap-1 font-semibold text-[#1180E1] hover:underline cursor-pointer">
                      <Upload className="h-3 w-3" />
                      <span>{uploadingSlot === 'desktop' ? 'Uploading...' : 'Upload PC'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageFileSelect(e.target.files?.[0], 'desktop')}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={campForm.desktopImageUrl}
                    onChange={(e) => setCampForm({ ...campForm, desktopImageUrl: e.target.value })}
                    placeholder="Upload or paste PC banner URL..."
                    className="mt-2 w-full rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1.5 font-mono text-[11px]"
                  />
                  {campForm.desktopImageUrl && (
                    <img
                      src={campForm.desktopImageUrl}
                      alt="PC Banner Preview"
                      className="mt-2 aspect-[16/9] w-full rounded-lg border border-[#D4DFEE] object-cover"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F1B2D]">
                      <Smartphone className="h-3.5 w-3.5 text-[#1180E1]" />
                      <span>2. Mobile Banner (4:3)</span>
                    </span>
                    <label className="inline-flex items-center gap-1 font-semibold text-[#1180E1] hover:underline cursor-pointer">
                      <Upload className="h-3 w-3" />
                      <span>{uploadingSlot === 'mobile' ? 'Uploading...' : 'Upload Mobile'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleImageFileSelect(e.target.files?.[0], 'mobile')}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={campForm.mobileImageUrl}
                    onChange={(e) => setCampForm({ ...campForm, mobileImageUrl: e.target.value })}
                    placeholder="Upload or paste Mobile banner URL..."
                    className="mt-2 w-full rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1.5 font-mono text-[11px]"
                  />
                  {campForm.mobileImageUrl && (
                    <img
                      src={campForm.mobileImageUrl}
                      alt="Mobile Banner Preview"
                      className="mt-2 aspect-[4/3] w-full rounded-lg border border-[#D4DFEE] object-cover"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="font-semibold text-[#475569]">Fallback Hardware Art</label>
                  <select
                    value={campForm.visualKey}
                    onChange={(e) => setCampForm({ ...campForm, visualKey: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  >
                    <option value="console-pro">Pro Console</option>
                    <option value="oled-monitor">OLED Monitor</option>
                    <option value="mechanical-keyboard">Mechanical Keyboard</option>
                    <option value="headset-anc">Wireless Headset</option>
                    <option value="handheld-oled">Handheld OLED</option>
                    <option value="mouse-carbon">Carbon Mouse</option>
                  </select>
                </div>

                <label className="mt-5 flex items-center gap-2 font-semibold text-[#0F1B2D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campForm.active}
                    onChange={(e) => setCampForm({ ...campForm, active: e.target.checked })}
                    className="accent-[#1180E1]"
                  />
                  <span>Published &amp; Visible on Storefront</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-[#1180E1] py-2.5 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
              >
                {campaignModal.editing ? 'Save Banner Changes' : 'Publish Marketing Banner'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Flash Sale Create / Edit Modal */}
      {flashSaleModal.open && (() => {
        const previewSamples = products
          .filter(
            (p) =>
              p.active &&
              (flashForm.targetCategory === 'All' || flashForm.targetCategory === p.category)
          )
          .slice(0, 3);
        const cap = Math.max(1, user.maxDiscountPct || 25);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/55 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#DC2626]" />
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#0F1B2D]">
                      {flashSaleModal.editing
                        ? 'Edit Category Flash Sale'
                        : 'Launch Category Flash Sale'}
                    </h3>
                    <p className="text-[11px] text-[#6B7A8D]">
                      {user.roleName} discount cap: up to {user.maxDiscountPct}% off
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFlashSaleModal({ open: false, editing: null })}
                  className="p-1 text-[#6B7A8D] hover:text-[#0F1B2D] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {flashSaleError && (
                <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs font-medium text-[#991B1B]">
                  {flashSaleError}
                </div>
              )}

              <form onSubmit={handleSaveFlashSale} className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-[#475569]">Flash Sale Headline</label>
                    <input
                      required
                      value={flashForm.title}
                      onChange={(e) => setFlashForm({ ...flashForm, title: e.target.value })}
                      placeholder="6-Hour OLED Monitor Flash Drop"
                      className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 focus:border-[#1180E1] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#475569]">Badge Label</label>
                    <input
                      value={flashForm.badgeLabel}
                      onChange={(e) =>
                        setFlashForm({ ...flashForm, badgeLabel: e.target.value.toUpperCase() })
                      }
                      placeholder="FLASH SALE"
                      maxLength={24}
                      className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono uppercase focus:border-[#1180E1] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#475569]">Promotional Subtitle</label>
                  <input
                    value={flashForm.subtitle}
                    onChange={(e) => setFlashForm({ ...flashForm, subtitle: e.target.value })}
                    placeholder="Temporary markdown automatically restores original prices when countdown expires."
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 focus:border-[#1180E1] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-semibold text-[#475569]">Target Category</label>
                    <select
                      value={flashForm.targetCategory}
                      onChange={(e) =>
                        setFlashForm({
                          ...flashForm,
                          targetCategory: e.target.value as FlashSaleCategory,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 focus:border-[#1180E1] focus:outline-none"
                    >
                      {allowedProductCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                      <option value="All">All Categories</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-[#475569]">
                      Discount % (Max {user.maxDiscountPct}%)
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={cap}
                        value={Math.min(cap, Math.max(1, flashForm.discountPct))}
                        onChange={(e) =>
                          setFlashForm({ ...flashForm, discountPct: Number(e.target.value) })
                        }
                        className="flex-1 accent-[#DC2626]"
                      />
                      <input
                        type="number"
                        min={1}
                        max={90}
                        required
                        value={flashForm.discountPct}
                        onChange={(e) =>
                          setFlashForm({ ...flashForm, discountPct: Number(e.target.value) })
                        }
                        className="w-16 rounded-lg border border-[#D4DFEE] px-2 py-1.5 text-center font-mono font-bold text-[#DC2626]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[#475569]">Banner Theme</label>
                    <select
                      value={flashForm.designTheme}
                      onChange={(e) =>
                        setFlashForm({
                          ...flashForm,
                          designTheme: e.target.value as FlashSaleTheme,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 focus:border-[#1180E1] focus:outline-none"
                    >
                      <option value="crimson">Crimson Flash</option>
                      <option value="navy">Midnight Navy</option>
                      <option value="cobalt">Electric Cobalt</option>
                      <option value="obsidian">Obsidian Amber</option>
                    </select>
                  </div>
                </div>

                {/* Duration Quick Presets + Exact Expiry Date/Time */}
                <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#0F1B2D]">
                      Expiration Timer (Auto-Reverts Prices)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '15m', mins: 15 },
                        { label: '1h', mins: 60 },
                        { label: '6h', mins: 360 },
                        { label: '24h', mins: 1440 },
                        { label: '48h', mins: 2880 },
                        { label: '7d', mins: 10080 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyFlashDurationPreset(preset.mins)}
                          className="rounded-md border border-[#D4DFEE] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-[#0F1B2D] hover:border-[#DC2626] hover:text-[#DC2626] cursor-pointer"
                        >
                          +{preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-center">
                    <div>
                      <label className="text-[11px] font-medium text-[#475569]">
                        Exact Expiration Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={flashForm.expiresLocal}
                        onChange={(e) =>
                          setFlashForm({ ...flashForm, expiresLocal: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 font-mono text-xs"
                      />
                    </div>

                    <label className="mt-4 flex items-center gap-2 font-semibold text-[#0F1B2D] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flashForm.active}
                        onChange={(e) => setFlashForm({ ...flashForm, active: e.target.checked })}
                        className="accent-[#DC2626]"
                      />
                      <span>Active immediately on Storefront</span>
                    </label>
                  </div>
                </div>

                {/* Live Category Price Impact Preview */}
                {previewSamples.length > 0 && (
                  <div className="rounded-xl border border-[#E6ECF4] bg-white p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A8D]">
                      Live Price Impact Preview ({flashForm.targetCategory})
                    </p>
                    <div className="mt-2 divide-y divide-[#F1F5F9]">
                      {previewSamples.map((p) => {
                        const discounted = Number(
                          Math.max(0.01, p.price * (1 - flashForm.discountPct / 100)).toFixed(2)
                        );
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 py-1.5 text-xs"
                          >
                            <span className="truncate font-medium text-[#0F1B2D]">{p.name}</span>
                            <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                              <span className="text-[#94A3B8] line-through">
                                ${p.price.toFixed(2)}
                              </span>
                              <span className="font-bold text-[#DC2626]">
                                ${discounted.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={flashSaleSaving}
                  className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 cursor-pointer"
                >
                  {flashSaleSaving
                    ? 'Saving Flash Sale...'
                    : flashSaleModal.editing
                    ? 'Save Flash Sale Changes'
                    : 'Publish Flash Sale Banner'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Add Staff Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-3">
              <h3 className="font-display text-lg font-bold text-[#0F1B2D]">Add Employee Account</h3>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="p-1 text-[#6B7A8D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateStaff} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#475569]">Full Name</label>
                  <input
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Work Email</label>
                  <input
                    required
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#475569]">Temporary Password</label>
                  <input
                    required
                    type="text"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Role</label>
                  <select
                    value={staffForm.roleId}
                    onChange={(e) => setStaffForm({ ...staffForm, roleId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  >
                    {roles
                      .filter((r) => r.slug !== 'customer')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Department Scope Checkboxes */}
              <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F1B2D]">Department Scope</span>
                  <button
                    type="button"
                    onClick={() => setStaffForm({ ...staffForm, departmentScope: 'all' })}
                    className={`text-[11px] font-semibold cursor-pointer ${
                      staffForm.departmentScope === 'all' ? 'text-[#1180E1]' : 'text-[#6B7A8D]'
                    }`}
                  >
                    All Departments
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_DEPARTMENTS.map((dept) => {
                    const selected =
                      staffForm.departmentScope === 'all'
                        ? false
                        : staffForm.departmentScope.split(',').includes(dept);
                    return (
                      <label
                        key={dept}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 cursor-pointer ${
                          selected
                            ? 'border-[#1180E1] bg-white text-[#1180E1] font-semibold'
                            : 'border-[#D4DFEE] bg-white text-[#475569]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const current =
                              staffForm.departmentScope === 'all'
                                ? []
                                : staffForm.departmentScope.split(',').filter(Boolean);
                            const next = selected
                              ? current.filter((d) => d !== dept)
                              : [...current, dept];
                            setStaffForm({
                              ...staffForm,
                              departmentScope: next.length ? next.join(',') : 'all',
                            });
                          }}
                          className="accent-[#1180E1]"
                        />
                        <span>{dept}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Custom Per-Employee Permission Overrides */}
              <div className="rounded-xl border border-[#E6ECF4] bg-white p-3">
                <p className="font-semibold text-[#0F1B2D]">
                  Extra Permission Overrides (In addition to role)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = staffForm.customPermissions.includes(perm.key);
                    return (
                      <label key={perm.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? staffForm.customPermissions.filter((p) => p !== perm.key)
                              : [...staffForm.customPermissions, perm.key];
                            setStaffForm({ ...staffForm, customPermissions: next });
                          }}
                          className="accent-[#1180E1]"
                        />
                        <span className="truncate">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-[#1180E1] py-2.5 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
              >
                Create Employee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee / Rules & Password Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F1B2D]">
                  Edit Employee &amp; Rules
                </h3>
                <p className="text-xs text-[#6B7A8D]">{editingStaff.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1 text-[#6B7A8D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedStaff} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#475569]">Employee Name</label>
                  <input
                    required
                    value={editStaffForm.name}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Role</label>
                  <select
                    value={editStaffForm.roleId}
                    disabled={editingStaff.id === user.id}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, roleId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 disabled:opacity-50"
                  >
                    {roles
                      .filter((r) => r.slug !== 'customer')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Department Scope Checkboxes */}
              <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F1B2D]">Department Scope</span>
                  <button
                    type="button"
                    onClick={() => setEditStaffForm({ ...editStaffForm, departmentScope: 'all' })}
                    className={`text-[11px] font-semibold cursor-pointer ${
                      editStaffForm.departmentScope === 'all' ? 'text-[#1180E1]' : 'text-[#6B7A8D]'
                    }`}
                  >
                    All Departments
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_DEPARTMENTS.map((dept) => {
                    const selected =
                      editStaffForm.departmentScope === 'all'
                        ? false
                        : editStaffForm.departmentScope.split(',').includes(dept);
                    return (
                      <label
                        key={dept}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 cursor-pointer ${
                          selected
                            ? 'border-[#1180E1] bg-white text-[#1180E1] font-semibold'
                            : 'border-[#D4DFEE] bg-white text-[#475569]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const current =
                              editStaffForm.departmentScope === 'all'
                                ? []
                                : editStaffForm.departmentScope.split(',').filter(Boolean);
                            const next = selected
                              ? current.filter((d) => d !== dept)
                              : [...current, dept];
                            setEditStaffForm({
                              ...editStaffForm,
                              departmentScope: next.length ? next.join(',') : 'all',
                            });
                          }}
                          className="accent-[#1180E1]"
                        />
                        <span>{dept}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Custom Permission Overrides */}
              <div className="rounded-xl border border-[#E6ECF4] bg-white p-3">
                <p className="font-semibold text-[#0F1B2D]">
                  Extra Permission Overrides
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = editStaffForm.customPermissions.includes(perm.key);
                    return (
                      <label key={perm.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? editStaffForm.customPermissions.filter((p) => p !== perm.key)
                              : [...editStaffForm.customPermissions, perm.key];
                            setEditStaffForm({ ...editStaffForm, customPermissions: next });
                          }}
                          className="accent-[#1180E1]"
                        />
                        <span className="truncate">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#475569]">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="text"
                  minLength={6}
                  value={editStaffForm.password}
                  onChange={(e) =>
                    setEditStaffForm({ ...editStaffForm, password: e.target.value })
                  }
                  placeholder="Enter new 6+ char password..."
                  className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#0F1B2D] py-2.5 text-xs font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
              >
                Save Employee Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Role Rule Editor Modal */}
      {roleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-3">
              <h3 className="font-display text-lg font-bold text-[#0F1B2D]">
                {roleModal.editing ? `Edit Role Rules: ${roleModal.editing.name}` : 'New Custom Role'}
              </h3>
              <button
                type="button"
                onClick={() => setRoleModal({ open: false, editing: null })}
                className="p-1 text-[#6B7A8D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveRole} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#475569]">Role Title</label>
                  <input
                    required
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Description</label>
                  <input
                    required
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#475569]">Max Discount Rule (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={roleForm.maxDiscountPct}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, maxDiscountPct: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#475569]">Max Refund Cap ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={roleForm.maxRefundAmount}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, maxRefundAmount: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <p className="font-semibold text-[#0F1B2D]">Permission Rule Matrix</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = roleForm.permissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer ${
                          checked
                            ? 'border-[#1180E1] bg-[#F7FAFD]'
                            : 'border-[#E6ECF4] bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? roleForm.permissions.filter((p) => p !== perm.key)
                              : [...roleForm.permissions, perm.key];
                            setRoleForm({ ...roleForm, permissions: next });
                          }}
                          className="mt-0.5 accent-[#1180E1]"
                        />
                        <div>
                          <p className="font-semibold text-[#0F1B2D]">{perm.label}</p>
                          <p className="font-mono text-[10px] text-[#6B7A8D]">{perm.key}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-[#1180E1] py-2.5 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
              >
                Save Role Rules
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Live Toast Notification Stack */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5"
      >
        <AnimatePresence>
          {toastAlerts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto relative overflow-hidden rounded-xl border border-[#CBD8EA] bg-white p-3.5 shadow-xl shadow-[#0F1B2D]/15"
            >
              <div
                className={`absolute inset-y-0 left-0 w-1 ${
                  toast.kind === 'staff'
                    ? 'bg-[#16A34A]'
                    : toast.kind === 'inventory'
                    ? 'bg-[#1180E1]'
                    : 'bg-[#0F1B2D]'
                }`}
              />
              <div className="flex items-start gap-2.5 pl-1.5">
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    toast.kind === 'staff'
                      ? 'bg-[#F0FDF4] text-[#16A34A]'
                      : toast.kind === 'inventory'
                      ? 'bg-[#EFF6FF] text-[#1180E1]'
                      : 'bg-[#F1F5F9] text-[#0F1B2D]'
                  }`}
                >
                  {toast.kind === 'staff' ? (
                    <UserPlus className="h-3.5 w-3.5" />
                  ) : toast.kind === 'inventory' ? (
                    <Boxes className="h-3.5 w-3.5" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-xs font-bold text-[#0F1B2D] truncate">
                      {toast.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => dismissToast(toast.id)}
                      aria-label="Dismiss notification"
                      className="rounded p-0.5 text-[#94A3B8] hover:text-[#0F1B2D] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#475569]">{toast.message}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#94A3B8]">
                    By {toast.actor} · {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
