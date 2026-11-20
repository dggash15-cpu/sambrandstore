export type PermissionKey =
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'orders:read'
  | 'orders:manage'
  | 'orders:refund'
  | 'campaigns:manage'
  | 'staff:read'
  | 'staff:manage'
  | 'roles:manage'
  | 'analytics:read'
  | 'audit:read';

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: 'products:read', label: 'View Catalog & Inventory', group: 'Catalog' },
  { key: 'products:write', label: 'Create & Edit Products / Stock', group: 'Catalog' },
  { key: 'products:delete', label: 'Delete Products', group: 'Catalog' },
  { key: 'campaigns:manage', label: 'Manage Marketing Banners & Offers', group: 'Marketing' },
  { key: 'orders:read', label: 'View Customer Orders', group: 'Orders' },
  { key: 'orders:manage', label: 'Update Fulfillment & Shipping', group: 'Orders' },
  { key: 'orders:refund', label: 'Issue Payment Refunds', group: 'Orders' },
  { key: 'analytics:read', label: 'View Revenue & Sales Analytics', group: 'Insights' },
  { key: 'audit:read', label: 'View Security Audit Trail', group: 'Security' },
  { key: 'staff:read', label: 'View Employee Directory', group: 'Team & Rules' },
  { key: 'staff:manage', label: 'Create, Suspend & Edit Employees', group: 'Team & Rules' },
  { key: 'roles:manage', label: 'Edit Role Permissions & Caps', group: 'Team & Rules' },
];

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: PermissionKey[];
  maxDiscountPct: number;
  maxRefundAmount: number;
  isSystem: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: PermissionKey[];
  customPermissions: PermissionKey[];
  departmentScope: string;
  maxDiscountPct: number;
  maxRefundAmount: number;
  status: 'active' | 'suspended';
  lastLoginAt: string | null;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: 'Consoles' | 'Monitors' | 'Audio' | 'Peripherals' | 'Accessories';
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  condition: 'New' | 'Refurbished' | 'Open Box';
  warranty: string;
  weight: string | null;
  dimensions: string | null;
  whatsInBox: string[];
  tags: string[];
  badge: string | null;
  tagline: string;
  description: string;
  specs: Record<string, string>;
  variants: string[];
  visualKey: string;
  imageUrl: string | null;
  images: string[];
  featured: boolean;
  active: boolean;
  averageRating?: number;
  reviewCount?: number;
  flashSale?: ProductFlashSaleInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFlashSaleInfo {
  id: string;
  title: string;
  discountPct: number;
  expiresAt: string;
  originalPrice: number;
}

export interface ProductReview {
  id: string;
  productId: string;
  productName?: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
}

export interface ProductRatingSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface RestockNotification {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variant: string;
  email: string;
  createdAt: string;
}

export type CampaignPlacement = 'hero' | 'offer_strip' | 'banner_grid';
export type CampaignTheme = 'navy' | 'cobalt' | 'obsidian' | 'chalk';
export type CampaignSectionSize = 'full' | 'split' | 'compact';

export interface CampaignBanner {
  id: string;
  placement: CampaignPlacement;
  designTheme: CampaignTheme;
  sectionSize: CampaignSectionSize;
  offerTag: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  promoCode: string | null;
  targetCategory: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  visualKey: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FlashSaleTheme = 'crimson' | 'navy' | 'cobalt' | 'obsidian';
export type FlashSaleCategory =
  | 'All'
  | 'Consoles'
  | 'Monitors'
  | 'Audio'
  | 'Peripherals'
  | 'Accessories';

export interface FlashSale {
  id: string;
  title: string;
  subtitle: string;
  badgeLabel: string;
  targetCategory: FlashSaleCategory;
  discountPct: number;
  designTheme: FlashSaleTheme;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  variant: string;
  quantity: number;
}

export type PaymentMethod = 'card' | 'cod' | 'wallet';
export type PaymentStatus = 'paid' | 'pending_cod' | 'refunded';
export type OrderStatus = 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentLast4: string | null;
  transactionRef: string;
  orderStatus: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  promoCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}
