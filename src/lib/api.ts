import type {
  AuditLog,
  AuthUser,
  CampaignBanner,
  FlashSale,
  Order,
  OrderStatus,
  PaymentMethod,
  PermissionKey,
  Product,
  ProductRatingSummary,
  ProductReview,
  RestockNotification,
  Role,
} from '../types';

const TOKEN_STORAGE_KEY = 'sbs_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  me: () => request<{ user: AuthUser | null }>('/api/auth/me'),
  login: async (email: string, password: string) => {
    const res = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },
  logout: async () => {
    await request('/api/auth/logout', { method: 'POST' });
    setStoredToken(null);
  },
  requestPasswordReset: (email: string) =>
    request<{ ok: boolean; message: string; demoVerificationCode?: string }>(
      '/api/auth/request-reset',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    ),
  resetPassword: (payload: {
    email?: string;
    currentPassword?: string;
    resetCode?: string;
    newPassword: string;
  }) =>
    request<{ ok: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Public Catalog & Campaigns
  getProducts: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request<{ products: Product[] }>(`/api/products${qs ? `?${qs}` : ''}`);
  },

  getCampaigns: () => request<{ campaigns: CampaignBanner[] }>('/api/campaigns'),

  getFlashSales: () =>
    request<{ flashSales: FlashSale[]; serverTime: string }>('/api/flash-sales'),

  notifyWhenAvailable: (productId: string, email: string, variant?: string) =>
    request<{
      ok: boolean;
      alreadySubscribed: boolean;
      message: string;
      entry: RestockNotification;
      totalSubscribers: number;
    }>(`/api/products/${productId}/notify`, {
      method: 'POST',
      body: JSON.stringify({ email, variant }),
    }),

  getProductReviews: (productId: string, sort: 'recent' | 'helpful' | 'highest' | 'lowest' = 'recent') =>
    request<{
      summary: ProductRatingSummary;
      reviews: ProductReview[];
    }>(`/api/products/${productId}/reviews?sort=${sort}`),

  submitProductReview: (
    productId: string,
    payload: {
      authorName: string;
      authorEmail?: string;
      rating: number;
      title?: string;
      comment: string;
    }
  ) =>
    request<{
      review: ProductReview;
      summary: ProductRatingSummary;
      reviews: ProductReview[];
    }>(`/api/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markReviewHelpful: (productId: string, reviewId: string) =>
    request<{ ok: boolean; helpfulCount: number }>(
      `/api/products/${productId}/reviews/${reviewId}/helpful`,
      { method: 'POST' }
    ),

  // Checkout & Orders
  validatePromo: (code: string, subtotal: number) =>
    request<{
      valid: boolean;
      code: string;
      discountAmount: number;
      freeShipping: boolean;
      label: string;
    }>('/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    }),

  createOrder: (payload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    city: string;
    postalCode: string;
    paymentMethod: PaymentMethod;
    cardNumber?: string;
    cardExpiry?: string;
    cardCvc?: string;
    promoCode?: string;
    notes?: string;
    items: Array<{ productId: string; variant: string; quantity: number }>;
  }) =>
    request<{ order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  trackOrder: (orderNumber: string, email: string) =>
    request<{ order: Order }>('/api/orders/track', {
      method: 'POST',
      body: JSON.stringify({ orderNumber, email }),
    }),

  getMyOrders: () => request<{ orders: Order[] }>('/api/orders/my'),

  // Admin & RBAC
  getAdminOverview: () =>
    request<{
      metrics: {
        grossRevenue: number;
        totalOrders: number;
        avgOrderValue: number;
        pendingFulfillment: number;
        lowStockCount: number;
        activeProducts: number;
      };
      inventorySummary: {
        totalSkus: number;
        totalUnits: number;
        retailValue: number;
        outOfStockCount: number;
        lowStockCount: number;
        waitlistCount: number;
      };
      orderStatusBreakdown: Record<OrderStatus, number>;
      topProducts: Array<{
        productId: string;
        productName: string;
        sku: string;
        unitsSold: number;
        revenue: number;
      }>;
      revenueSeries: Array<{ date: string; label: string; revenue: number }>;
      categoryMix: Array<{ category: string; total: number }>;
      lowStockProducts: Product[];
    }>('/api/admin/overview'),

  getAdminAnalytics: (range: '7d' | '30d' | '90d' | '12m' = '30d') =>
    request<{
      range: '7d' | '30d' | '90d' | '12m';
      rangeDays: number;
      cutoffIso: string;
      summary: {
        periodRevenue: number;
        periodOrders: number;
        periodUnits: number;
        avgOrderValue: number;
        avgTurnoverRate: number;
        sellThroughPct: number;
        topCategory: string;
      };
      salesTrend: Array<{
        label: string;
        date: string;
        revenue: number;
        orders: number;
        units: number;
      }>;
      topCategories: Array<{
        category: string;
        revenue: number;
        unitsSold: number;
        ordersCount: number;
        sharePct: number;
      }>;
      inventoryTurnover: Array<{
        category: string;
        unitsSold: number;
        currentStock: number;
        stockValue: number;
        turnoverRate: number;
        daysOfSupply: number;
      }>;
      skuTurnover: Array<{
        id: string;
        sku: string;
        name: string;
        category: string;
        price: number;
        currentStock: number;
        lowStockThreshold: number;
        unitsSold: number;
        revenue: number;
        turnoverRate: number;
        sellThroughPct: number;
        daysOfSupply: number;
        status: 'Fast Mover' | 'Healthy' | 'Slow / Restock';
      }>;
    }>(`/api/admin/analytics?range=${range}`),

  getRestockWaitlist: () => request<{ waitlist: RestockNotification[] }>('/api/admin/restock-waitlist'),

  getAdminReviews: () =>
    request<{ reviews: ProductReview[]; averageRating: number; totalReviews: number }>(
      '/api/admin/reviews'
    ),

  deleteAdminReview: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/reviews/${id}`, { method: 'DELETE' }),

  getAdminProducts: () => request<{ products: Product[] }>('/api/admin/products'),

  createProduct: (payload: Partial<Product>) =>
    request<{ product: Product }>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: string, payload: Partial<Product>) =>
    request<{ product: Product }>(`/api/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' }),

  // Admin Campaigns & Asset Upload
  uploadImage: (dataUrl: string, filename: string) =>
    request<{ url: string }>('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, filename }),
    }),

  getAdminCampaigns: () => request<{ campaigns: CampaignBanner[] }>('/api/admin/campaigns'),

  createCampaign: (payload: Partial<CampaignBanner>) =>
    request<{ campaign: CampaignBanner }>('/api/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCampaign: (id: string, payload: Partial<CampaignBanner>) =>
    request<{ campaign: CampaignBanner }>(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteCampaign: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/campaigns/${id}`, { method: 'DELETE' }),

  // Admin Flash Sales
  getAdminFlashSales: () =>
    request<{ flashSales: FlashSale[]; serverTime: string }>('/api/admin/flash-sales'),

  createFlashSale: (payload: Partial<FlashSale> & { durationMinutes?: number }) =>
    request<{ flashSale: FlashSale }>('/api/admin/flash-sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateFlashSale: (id: string, payload: Partial<FlashSale>) =>
    request<{ flashSale: FlashSale }>(`/api/admin/flash-sales/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteFlashSale: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/flash-sales/${id}`, { method: 'DELETE' }),

  // Orders
  getAdminOrders: () => request<{ orders: Order[] }>('/api/admin/orders'),

  updateOrderStatus: (id: string, orderStatus: OrderStatus) =>
    request<{ order: Order }>(`/api/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ orderStatus }),
    }),

  refundOrder: (id: string) =>
    request<{ order: Order }>(`/api/admin/orders/${id}/refund`, {
      method: 'POST',
    }),

  // Roles & Staff
  getRoles: () => request<{ roles: Role[] }>('/api/admin/roles'),

  createRole: (payload: {
    name: string;
    description: string;
    permissions: PermissionKey[];
    maxDiscountPct: number;
    maxRefundAmount: number;
  }) =>
    request<{ role: Role }>('/api/admin/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRole: (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      permissions: PermissionKey[];
      maxDiscountPct: number;
      maxRefundAmount: number;
    }>
  ) =>
    request<{ role: Role }>(`/api/admin/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getStaff: () => request<{ staff: AuthUser[] }>('/api/admin/staff'),

  createStaff: (payload: {
    name: string;
    email: string;
    password: string;
    roleId: string;
    departmentScope: string;
    customPermissions: PermissionKey[];
  }) =>
    request<{ user: AuthUser }>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStaff: (
    id: string,
    payload: Partial<{
      name: string;
      password: string;
      roleId: string;
      status: 'active' | 'suspended';
      departmentScope: string;
      customPermissions: PermissionKey[];
    }>
  ) =>
    request<{ user: AuthUser }>(`/api/admin/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteStaff: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/staff/${id}`, { method: 'DELETE' }),

  getAuditLogs: () => request<{ logs: AuditLog[] }>('/api/admin/audit-logs'),

  getAdminNotifications: () => request<{ notifications: AuditLog[] }>('/api/admin/notifications'),

  getPublicSettings: () =>
    request<{ whatsappNumber: string; storeName: string; logoUrl?: string }>('/api/settings/public'),

  updateStoreSettings: (payload: { whatsappNumber?: string; logoUrl?: string; storeName?: string } | string) =>
    request<{ whatsappNumber: string; storeName: string; logoUrl?: string }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(typeof payload === 'string' ? { whatsappNumber: payload } : payload),
    }),
};
