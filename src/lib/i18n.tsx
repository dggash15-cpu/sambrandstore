import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { Product } from '../types';

export type Language = 'en' | 'ar';

export interface I18nContextValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
  translateCategory: (category: string) => string;
  translateStatus: (status: string) => string;
  translateRole: (role: string) => string;
  translateScope: (scope: string) => string;
  translateProduct: (product: Product) => Product;
  translateProducts: (products: Product[]) => Product[];
}

const STORAGE_KEY = 'sbs_lang';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Announcements
    'nav.announcement': 'Free Express Delivery across Lebanon & MENA for orders over $150',
    'nav.allGear': 'All Gear',
    'nav.consoles': 'Consoles',
    'nav.monitors': 'Monitors',
    'nav.audio': 'Audio',
    'nav.peripherals': 'Peripherals',
    'nav.accessories': 'Accessories',
    'nav.favorites': 'Favorites',
    'nav.trackOrder': 'Track Order',
    'nav.signIn': 'Sign In',
    'nav.portal': 'Staff Portal',
    'nav.cart': 'Cart',
    'nav.search': 'Search',
    'nav.searchPlaceholder': 'Search consoles, OLED monitors, headsets, SKUs...',
    'nav.filterGrid': 'Filter Grid',
    'nav.switchLang': 'العربية',
    'nav.langName': 'English',

    // Hero Section
    'hero.flagshipHardware': 'Flagship Gaming Gear',
    'hero.title': 'Next-Gen Hardware Engineered for Victory',
    'hero.subtitle':
      'Tournament-grade peripherals, 240Hz QD-OLED monitors, and custom consoles with guaranteed warranty.',
    'hero.exploreCatalog': 'Explore Catalog',
    'hero.limitedDeals': 'Special Offers',
    'hero.fastShipping': 'Express Dispatch',
    'hero.officialWarranty': 'Official 2-Year Warranty',
    'hero.authenticGuarantee': '100% Genuine Certified',

    // Category Strip
    'cat.all': 'All Gear',
    'cat.consoles': 'Consoles',
    'cat.monitors': 'Displays',
    'cat.audio': 'Studio Audio',
    'cat.peripherals': 'Peripherals',
    'cat.accessories': 'Accessories',

    // Catalog & Filters
    'catalog.title': 'High-Performance Collection',
    'catalog.subtitle': 'Curated tournament hardware, certified genuine with live stock allocation.',
    'catalog.search': 'Search products, brands, SKUs...',
    'catalog.sortBy': 'Sort By',
    'catalog.sortFeatured': 'Featured Gear',
    'catalog.sortPriceLow': 'Price: Low to High',
    'catalog.sortPriceHigh': 'Price: High to Low',
    'catalog.sortName': 'Product Name',
    'catalog.allStock': 'All Stock',
    'catalog.inStockOnly': 'In Stock Only',
    'catalog.outOfStock': 'Out of Stock',
    'catalog.inStock': 'In Stock',
    'catalog.lowStock': 'Low Stock',
    'catalog.unitsLeft': 'units left',
    'catalog.addToCart': 'Add to Cart',
    'catalog.notifyRestock': 'Notify When Available',
    'catalog.compare': 'Compare',
    'catalog.viewDetails': 'Quick View',
    'catalog.showing': 'Showing',
    'catalog.of': 'of',
    'catalog.products': 'products',
    'catalog.noProducts': 'No products found matching your filter criteria.',
    'catalog.resetFilters': 'Reset All Filters',

    // Flash Sale
    'flash.badge': 'LIMITED FLASH DROP',
    'flash.endsIn': 'OFFER ENDS IN',
    'flash.claimDeal': 'Shop Deal Now',
    'flash.days': 'd',
    'flash.hours': 'h',
    'flash.minutes': 'm',
    'flash.seconds': 's',

    // Cart & Checkout
    'cart.title': 'Shopping Bag',
    'cart.empty': 'Your shopping bag is empty',
    'cart.emptySubtitle': 'Explore our flagship gaming gear and add items to your cart.',
    'cart.browseGear': 'Browse Gear',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Shipping',
    'cart.free': 'FREE',
    'cart.discount': 'Discount',
    'cart.total': 'Total',
    'cart.promoCode': 'Promo Code',
    'cart.apply': 'Apply',
    'cart.promoApplied': 'Promo Applied',
    'cart.promoInvalid': 'Invalid promo code',
    'cart.checkoutInfo': 'Shipping & Contact Details',
    'cart.fullName': 'Full Name',
    'cart.email': 'Email Address',
    'cart.phone': 'Phone Number',
    'cart.address': 'Delivery Address',
    'cart.city': 'City / Area',
    'cart.orderNotes': 'Special Delivery Instructions (Optional)',
    'cart.paymentMethod': 'Payment Method',
    'cart.cod': 'Cash on Delivery (COD)',
    'cart.card': 'Credit / Debit Card',
    'cart.placeOrder': 'Confirm & Place Order',
    'cart.whatsappCheckout': 'Order via WhatsApp',
    'cart.secureNotice': '256-Bit SSL Encrypted & Inspected Packaging',

    // Product Modal & Reviews
    'prod.specs': 'Technical Specifications',
    'prod.box': "What's in the Box",
    'prod.warranty': 'Warranty & Support',
    'prod.reviews': 'Verified Customer Reviews',
    'prod.writeReview': 'Write a Review',
    'prod.yourRating': 'Your Rating',
    'prod.yourName': 'Your Name',
    'prod.yourReview': 'Share your experience with this product...',
    'prod.submitReview': 'Submit Review',
    'prod.helpful': 'Helpful',
    'prod.verified': 'Verified Purchase',
    'prod.selectVariant': 'Select Hardware Edition',
    'prod.waitlistTitle': 'Out of Stock - Get Alerted',
    'prod.waitlistDesc': 'Leave your email or WhatsApp number to be alerted as soon as fresh units land.',
    'prod.notifyMe': 'Notify Me',
    'prod.subscribed': "You're on the priority notification list!",

    // Order Tracker Modal
    'track.title': 'Track Your Order',
    'track.subtitle': 'Real-time order inspection, packing, and courier updates.',
    'track.orderNum': 'Order Number (e.g. SBS-1059)',
    'track.emailOrPhone': 'Email or Phone used at checkout',
    'track.button': 'Track Status',
    'track.recent': 'Recent Orders on this Device',
    'track.items': 'Order Items',
    'track.deliveryTo': 'Delivery To',
    'track.payment': 'Payment',

    // Order Statuses
    'status.confirmed': 'Order Confirmed',
    'status.packed': 'Packed & Inspected',
    'status.shipped': 'Shipped with Courier',
    'status.delivered': 'Delivered',
    'status.cancelled': 'Cancelled',

    // Favorites Drawer
    'fav.title': 'Saved Favorites',
    'fav.empty': 'No items saved to favorites yet',
    'fav.emptyDesc': 'Click the heart icon on any product to save it for later.',
    'fav.share': 'Share Wishlist',
    'fav.clear': 'Clear All',
    'fav.copied': 'Wishlist link copied to clipboard!',

    // Footer
    'footer.tagline': 'Official distributor of tournament-grade hardware, 240Hz OLEDs, and studio audio.',
    'footer.fastDelivery': 'Express Regional Delivery',
    'footer.fastDeliveryDesc': 'Same-day dispatch for confirmed in-stock items.',
    'footer.warranty': '2-Year Official Warranty',
    'footer.warrantyDesc': 'Direct manufacturer warranty with replacement support.',
    'footer.support': 'Direct WhatsApp Concierge',
    'footer.supportDesc': 'Speak with specialized hardware engineers 7 days a week.',
    'footer.secure': 'Guaranteed Safe Delivery',
    'footer.secureDesc': 'Reinforced shock-proof packaging for fragile hardware.',
    'footer.rights': 'All rights reserved.',

    // Common Buttons
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.clear': 'Clear',
    'common.loading': 'Loading...',
    'common.signOut': 'Sign Out',
    'common.returnToStore': 'Return to Storefront',

    // CartCheckoutDrawer
    'cart.remove': 'Remove',
    'cart.promoPlaceholder': 'Promo code (try SAM10 or PROSETUP)',
    'cart.applyBtn': 'Apply',
    'cart.step1Title': '1. Delivery & Contact Verification',
    'cart.fullNameLabel': 'Full Name',
    'cart.emailLabel': 'Email for Receipt',
    'cart.phoneLabel': 'Mobile Phone',
    'cart.addressLabel': 'Street Address',
    'cart.cityLabel': 'City',
    'cart.postalCodeLabel': 'Postal Code',
    'cart.notesLabel': 'Delivery Notes / Landmark (Optional)',
    'cart.step2Title': '2. Payment Method',
    'cart.payCard': 'Card',
    'cart.payWallet': 'Express Pay',
    'cart.payCod': 'Cash on Delivery',
    'cart.fillTestVisa': 'Fill Test Visa',
    'cart.cardNumber': 'Card Number',
    'cart.cardExpiry': 'Expiry (MM/YY)',
    'cart.cardCvc': 'CVC / CVV',
    'cart.walletTitle': 'Express Digital Wallet Authorization',
    'cart.walletDesc': 'One-tap tokenized settlement for Apple Pay & Google Pay. Redirects to secure wallet gateway.',
    'cart.codTitle': 'Cash on Delivery (Verified Courier)',
    'cart.codDesc': 'Pay upon doorstep inspection. Courier verifies packaging integrity before handoff.',
    'cart.codFee': 'COD Handling Fee',
    'cart.codFreeNotice': 'Free COD delivery applied',
    'cart.preparingOrder': 'Preparing Order...',
    'cart.formattingInvoice': 'Formatting WhatsApp Invoice...',
    'cart.orderConfirmed': 'Order Confirmed!',
    'cart.reservingItems': 'Reserving your items & verifying stock...',
    'cart.redirectingWhatsapp': 'Redirecting to WhatsApp...',
    'cart.stepInventory': 'Inventory',
    'cart.stepInvoice': 'Invoice',
    'cart.stepWhatsapp': 'WhatsApp',
    'cart.receiptTitle': 'Your order has been prepared!',
    'cart.receiptDesc': 'Send it on WhatsApp to complete your purchase. Our team will confirm within minutes.',
    'cart.sendWhatsapp': 'Send Order on WhatsApp Now',
    'cart.invoicePng': 'Invoice PNG',
    'cart.savePdf': 'Save PDF',
    'cart.copyText': 'Copy Text',
    'cart.copied': 'Copied',
    'cart.invoiceHeader': 'CUSTOMER ORDER INVOICE',
    'cart.customerLocation': 'Customer & Location',
    'cart.nameLabel': 'Name:',
    'cart.phoneLabelInv': 'Phone:',
    'cart.emailLabelInv': 'Email:',
    'cart.locationLabel': 'Location:',
    'cart.notesLabelInv': 'Notes:',
    'cart.itemHeader': 'Item',
    'cart.qtyPrice': 'Qty × Price',
    'cart.subtotalLine': 'Subtotal',
    'cart.discountLine': 'Discount',
    'cart.shippingLine': 'Shipping',
    'cart.taxLine': 'Tax (8%)',
    'cart.totalLine': 'TOTAL',
    'cart.expressShipping': 'Express Shipping',
    'cart.estimatedTax': 'Estimated Tax (8%)',
    'cart.promoAppliedLine': 'Promo Applied',
    'cart.proceedCheckout': 'Proceed to Checkout',
    'cart.submitting': 'Confirming & Preparing WhatsApp...',
    'cart.completeOrder': 'Complete & Send to WhatsApp',

    // ProductDetailModal
    'prod.hoverZoom': 'Hover to Zoom',
    'prod.inTheBox': 'In the Box',
    'prod.dimensions': 'Dimensions',
    'prod.notifyWhenAvailable': 'Notify Me When Available',
    'prod.sortRecent': 'Most Recent',
    'prod.sortHelpful': 'Most Helpful',
    'prod.sortHighest': 'Highest Rating',
    'prod.sortLowest': 'Lowest Rating',

    // FavoritesDrawer
    'fav.saveAll': 'Save All to My Favorites',
    'fav.shareLink': 'Share Favorites Link',
    'fav.moveInStock': 'Move In-Stock Items to Bag',

    // OrderTrackerModal
    'track.orderNumLabel': 'Order Number',
    'track.emailLabel': 'Order Email',
    'track.totalLabel': 'Total',
    'track.refunded': 'Refunded',

    // ProductCompareModal
    'compare.added': 'Added',
    'compare.customerRating': 'Customer Rating',
    'compare.availability': 'Availability',
    'compare.modelSku': 'Model SKU',
    'compare.configurations': 'Configurations',
    'compare.warranty': 'Warranty',

    // Footer extras
    'footer.recentlyViewed': 'Recently Viewed',
    'footer.browserHistory': 'Your Browser History',
    'footer.clearLog': 'Clear Log',
    'footer.techStack': 'Direct WhatsApp Checkout · Fast Node & MySQL Hosting',

    // HeroSection extras
    'hero.inspect': 'Inspect',
    'hero.useCode': 'Use',
    'hero.code': 'Code',

    // Navbar staff bar
    'nav.admin': 'Admin',
    'nav.signOut': 'Sign Out',

    // Admin Dashboard Navigation & Common
    'admin.navOverview': 'Overview',
    'admin.navAnalytics': 'Analytics',
    'admin.navFlashSales': 'Flash Sales',
    'admin.navCampaigns': 'Marketing & Banners',
    'admin.navCatalog': 'Product Catalog',
    'admin.navOrders': 'Orders & Fulfillment',
    'admin.navRbac': 'Roles & Staff Access',
    'admin.navAudit': 'Audit Log',
    'admin.navSettings': 'Store Settings',
    'admin.switchRole': 'Switch Employee Role',
    'admin.signOut': 'Sign Out',
    'admin.returnStore': 'Return to Storefront',
    'admin.refresh': 'Refresh',
    'admin.scope': 'Scope',
    'admin.workspace': 'Admin Workspace',
    'admin.actions': 'Actions',
    'admin.status': 'Status',
    'admin.edit': 'Edit',
    'admin.delete': 'Delete',
    'admin.save': 'Save',
    'admin.cancel': 'Cancel',
    'admin.close': 'Close',
    'admin.create': 'Create',
    'admin.loading': 'Loading...',
    'admin.active': 'Active',
    'admin.inactive': 'Inactive',
    'admin.filter': 'Filter',
    'admin.all': 'All',
    'admin.search': 'Search',

    // Overview Tab
    'admin.overview.totalRevenue': 'Total Revenue',
    'admin.overview.grossProfit': 'Gross Profit',
    'admin.overview.totalOrders': 'Total Orders',
    'admin.overview.activeSkus': 'Active SKUs',
    'admin.overview.lowStockAlerts': 'Low Stock Alerts',
    'admin.overview.waitlistInquiries': 'Waitlist Inquiries',
    'admin.overview.revenueTrend': 'Revenue Velocity (7 Days)',
    'admin.overview.topProducts': 'Top Velocity Products',
    'admin.overview.recentOrders': 'Recent Live Orders',
    'admin.overview.viewAllOrders': 'View All Orders',
    'admin.overview.inventoryAlerts': 'Inventory Action Required',

    // Analytics Tab
    'admin.analytics.range7d': 'Last 7 Days',
    'admin.analytics.range30d': 'Last 30 Days',
    'admin.analytics.range90d': 'Last 90 Days',
    'admin.analytics.range12m': 'Last 12 Months',
    'admin.analytics.revenueVolume': 'Gross Sales Volume',
    'admin.analytics.avgOrderValue': 'Average Order Value (AOV)',
    'admin.analytics.netProfit': 'Estimated Gross Profit',
    'admin.analytics.categoryShare': 'Revenue Share by Category',
    'admin.analytics.skuPerformance': 'Product SKU Performance',

    // Catalog Tab
    'admin.catalog.newProduct': 'New Product',
    'admin.catalog.searchPlaceholder': 'Search products by title, brand, or SKU...',
    'admin.catalog.productHeader': 'Product',
    'admin.catalog.brandHeader': 'Brand',
    'admin.catalog.categoryHeader': 'Category',
    'admin.catalog.priceHeader': 'Price',
    'admin.catalog.stockHeader': 'Stock',
    'admin.catalog.conditionHeader': 'Condition',
    'admin.catalog.reviewsTab': 'Customer Reviews',
    'admin.catalog.waitlistTab': 'Restock Waitlist',
    'admin.catalog.editProduct': 'Edit Product',
    'admin.catalog.createProduct': 'Create New Product',
    'admin.catalog.productName': 'Product Name',
    'admin.catalog.productDesc': 'Description',
    'admin.catalog.comparePrice': 'Compare-At Price',
    'admin.catalog.stockQty': 'Stock Quantity',
    'admin.catalog.lowStockThreshold': 'Low Stock Alert Threshold',
    'admin.catalog.imageUpload': 'Product Image / Upload',

    // Orders Tab
    'admin.orders.searchPlaceholder': 'Search by order #, customer name, email...',
    'admin.orders.orderNumber': 'Order #',
    'admin.orders.customer': 'Customer',
    'admin.orders.date': 'Date',
    'admin.orders.items': 'Items',
    'admin.orders.total': 'Total',
    'admin.orders.paymentMethod': 'Payment',
    'admin.orders.fulfillmentStatus': 'Fulfillment Status',
    'admin.orders.updateStatus': 'Update Status',
    'admin.orders.processRefund': 'Process Refund',
    'admin.orders.refunded': 'Refunded',
    'admin.orders.orderDetails': 'Order Inspection & Details',

    // Campaigns & Flash Sales
    'admin.campaigns.newBanner': 'New Campaign Banner',
    'admin.campaigns.title': 'Campaign Title',
    'admin.campaigns.subtitle': 'Subtitle',
    'admin.campaigns.ctaLabel': 'CTA Button Label',
    'admin.flash.newDrop': 'New Flash Drop',
    'admin.flash.discountPct': 'Discount Percentage (%)',
    'admin.flash.theme': 'Visual Theme',
    'admin.flash.countdown': 'Timer / Expiry',

    // RBAC & Staff
    'admin.rbac.staffMembers': 'Staff Members & Accounts',
    'admin.rbac.rolesMatrix': 'Roles & Permissions Matrix',
    'admin.rbac.addStaff': 'Add Staff Member',
    'admin.rbac.createRole': 'Create New Role',
    'admin.rbac.roleName': 'Role Name',
    'admin.rbac.employeeName': 'Employee Name',
    'admin.rbac.employeeEmail': 'Email Address',
    'admin.rbac.employeePhone': 'Mobile Phone',
    'admin.rbac.temporaryPassword': 'Password',
    'admin.rbac.permissions': 'Permissions',

    // Audit Log
    'admin.audit.title': 'Activity & Security Audit Trail',
    'admin.audit.actor': 'Staff Member',
    'admin.audit.action': 'Action Performed',
    'admin.audit.entity': 'Target Entity',
    'admin.audit.timestamp': 'Timestamp',
    'admin.audit.details': 'Details / Payload',

    // Store Settings
    'admin.settings.storeName': 'Storefront Name',
    'admin.settings.whatsapp': 'Store WhatsApp Concierge Number',
    'admin.settings.logo': 'Store Branding Logo',
    'admin.settings.saveBtn': 'Save Store Settings',
    'admin.settings.savedSuccess': 'Store settings updated successfully',
    'admin.overview.grossRevenue': 'Gross Revenue',
    'admin.overview.pendingFulfillment': 'Pending Fulfillment',
    'admin.overview.totalCatalogSkus': 'Total Catalog SKUs',
    'admin.overview.unitsInStock': 'Units in Stock',
    'admin.overview.inventoryValue': 'Inventory Value',
    'admin.overview.outLowStock': 'Out / Low Stock',
    'admin.overview.restockWaitlist': 'Restock Waitlist',
    'admin.overview.revenueVelocity': '7-Day Revenue Velocity',
    'admin.overview.salesByDept': 'Sales by Department',
    'admin.overview.pipeline': 'Order Fulfillment Pipeline',
    'admin.overview.topPerforming': 'Top Performing Hardware',
    'admin.overview.unitsSold': 'Units Sold',
    'admin.overview.noSales': 'No completed sales recorded yet.',
    'admin.overview.roleRules': 'Active Access & Security Rules',
    'admin.overview.changeLogo': 'Store Branding & Logo',
    'admin.overview.changeLogoDesc': 'Customize the store name and upload an image logo without touching code.',
    'admin.settings.uploadLogo': 'Upload New Logo',
    'admin.settings.resetLogo': 'Reset to Default Vector Emblem',
    'admin.settings.logoUrlPlaceholder': 'Or enter image URL (https://... or data:image/...)',
    'admin.settings.saveBranding': 'Save Branding & Logo',
    'admin.settings.saving': 'Saving...',
  },
  ar: {
    // Navigation & Announcements
    'nav.announcement': 'توصيل سريع مجاني لجميع الطلبات في لبنان والشرق الأوسط التي تتجاوز 150 دولاراً',
    'nav.allGear': 'جميع المنتجات',
    'nav.consoles': 'منصات الألعاب',
    'nav.monitors': 'شاشات العرض',
    'nav.audio': 'الصوتيات الاحترافية',
    'nav.peripherals': 'الملحقات والطرفيات',
    'nav.accessories': 'الإكسسوارات',
    'nav.favorites': 'المفضلة',
    'nav.trackOrder': 'تتبع طلبك',
    'nav.signIn': 'تسجيل الدخول',
    'nav.portal': 'بوابة الإدارة',
    'nav.cart': 'السلة',
    'nav.search': 'بحث',
    'nav.searchPlaceholder': 'ابحث عن أجهزة ألعاب، شاشات أوليد، سماعات، أو الرمز...',
    'nav.filterGrid': 'تصفية المنتجات',
    'nav.switchLang': 'English',
    'nav.langName': 'العربية',

    // Hero Section
    'hero.flagshipHardware': 'أحدث عتاد الألعاب الاحترافي',
    'hero.title': 'عتاد ألعاب احترافي من الجيل القادم صُمم للنصر',
    'hero.subtitle':
      'طرفيات مخصصة للبطولات العالمية، شاشات QD-OLED بتردد 240 هرتز، وأجهزة ألعاب مع ضمان رسمي معتمد.',
    'hero.exploreCatalog': 'تصفح المتجر',
    'hero.limitedDeals': 'العروض الحصرية',
    'hero.fastShipping': 'شحن فوري سريع',
    'hero.officialWarranty': 'ضمان رسمي لمدة سنتين',
    'hero.authenticGuarantee': 'أصلي ومعتمد 100%',

    // Category Strip
    'cat.all': 'الكل',
    'cat.consoles': 'أجهزة الألعاب',
    'cat.monitors': 'الشاشات',
    'cat.audio': 'الصوتيات',
    'cat.peripherals': 'الملحقات',
    'cat.accessories': 'الإكسسوارات',

    // Catalog & Filters
    'catalog.title': 'تشكيلة الأداء الفائق',
    'catalog.subtitle': 'أجهزة وعتاد ألعاب عالي المستوى، مضمون مع تخصيص فوري ومباشر للمخزون.',
    'catalog.search': 'ابحث عن منتج، علامة تجارية، رمز...',
    'catalog.sortBy': 'ترتيب حسب',
    'catalog.sortFeatured': 'المنتجات المميزة',
    'catalog.sortPriceLow': 'السعر: من الأقل للأعلى',
    'catalog.sortPriceHigh': 'السعر: من الأعلى للأقل',
    'catalog.sortName': 'الاسم أبجدياً',
    'catalog.allStock': 'كافة الحالات',
    'catalog.inStockOnly': 'المتوفر في المخزون فقط',
    'catalog.outOfStock': 'نفد المخزون',
    'catalog.inStock': 'متوفر',
    'catalog.lowStock': 'كمية محدودة',
    'catalog.unitsLeft': 'قطع متبقية',
    'catalog.addToCart': 'أضف إلى السلة',
    'catalog.notifyRestock': 'أعلمني فور التوفر',
    'catalog.compare': 'مقارنة',
    'catalog.viewDetails': 'نظرة سريعة',
    'catalog.showing': 'عرض',
    'catalog.of': 'من',
    'catalog.products': 'منتج',
    'catalog.noProducts': 'لم يتم العثور على منتجات مطابقة لمعايير البحث.',
    'catalog.resetFilters': 'إعادة ضبط التصفية',

    // Flash Sale
    'flash.badge': 'عرض خاطف ومحدود',
    'flash.endsIn': 'ينتهي العرض خلال',
    'flash.claimDeal': 'اغتنم العرض الآن',
    'flash.days': 'يوم',
    'flash.hours': 'ساعة',
    'flash.minutes': 'دقيقة',
    'flash.seconds': 'ثانية',

    // Cart & Checkout
    'cart.title': 'حقيبة التسوق',
    'cart.empty': 'حقيبة التسوق فارغة حالياً',
    'cart.emptySubtitle': 'استكشف عتاد الألعاب وأضف ما يناسبك إلى السلة.',
    'cart.browseGear': 'تصفح المتجر',
    'cart.subtotal': 'المجموع الفرعي',
    'cart.shipping': 'الشحن',
    'cart.free': 'مجاني',
    'cart.discount': 'الخصم',
    'cart.total': 'المجموع الإجمالي',
    'cart.promoCode': 'كود الخصم',
    'cart.apply': 'تطبيق',
    'cart.promoApplied': 'تم تطبيق كود الخصم',
    'cart.promoInvalid': 'كود الخصم غير صالح',
    'cart.checkoutInfo': 'بيانات الشحن والمشتري',
    'cart.fullName': 'الاسم الكامل',
    'cart.email': 'البريد الإلكتروني',
    'cart.phone': 'رقم الهاتف',
    'cart.address': 'عنوان التوصيل بالتفصيل',
    'cart.city': 'المدينة / المنطقة',
    'cart.orderNotes': 'ملاحظات إضافية للتوصيل (اختياري)',
    'cart.paymentMethod': 'طريقة الدفع',
    'cart.cod': 'الدفع نقدًا عند الاستلام (COD)',
    'cart.card': 'بطاقة بنكية / ائتمان',
    'cart.placeOrder': 'تأكيد وإتمام الطلب',
    'cart.whatsappCheckout': 'إتمام الطلب عبر واتساب',
    'cart.secureNotice': 'دفع آمن ومحمي 256-Bit وتغليف متين ومقاوم للصدمات',

    // Product Modal & Reviews
    'prod.specs': 'المواصفات التقنية',
    'prod.box': 'محتويات الصندوق',
    'prod.warranty': 'الضمان والأصالة',
    'prod.reviews': 'تقييمات وآراء العملاء',
    'prod.writeReview': 'أضف تقييمك للمنتج',
    'prod.yourRating': 'تقييمك',
    'prod.yourName': 'اسمك',
    'prod.yourReview': 'شاركنا رأيك وتجربتك بالتفصيل...',
    'prod.submitReview': 'إرسال التقييم',
    'prod.helpful': 'مفيد',
    'prod.verified': 'شراء مؤكد',
    'prod.selectVariant': 'اختر الطراز أو النسخة',
    'prod.waitlistTitle': 'نفد المخزون - تنبيه فوري بالتوفر',
    'prod.waitlistDesc': 'أدخل بريدك الإلكتروني أو رقم هاتفك ليصلك إشعار فوري عند وصول دفعات جديدة.',
    'prod.notifyMe': 'أعلمني فور التوفر',
    'prod.subscribed': 'تم تسجيلك بنجاح في قائمة التنبيه بالأولوية!',

    // Order Tracker Modal
    'track.title': 'تتبع حالة طلبك المباشر',
    'track.subtitle': 'تابع مراحل الفحص، التغليف، والشحن مع المندوب خطوة بخطوة.',
    'track.orderNum': 'رقم الطلب (مثال: SBS-1059)',
    'track.emailOrPhone': 'البريد أو الهاتف المسجل',
    'track.button': 'تتبع الآن',
    'track.recent': 'الطلبات الأخيرة على هذا الجهاز',
    'track.items': 'المنتجات المطلوبة',
    'track.deliveryTo': 'عنوان التوصيل',
    'track.payment': 'طريقة الدفع',

    // Order Statuses
    'status.confirmed': 'تم تأكيد الطلب',
    'status.packed': 'تم الفحص والتجهيز',
    'status.shipped': 'في الطريق مع مندوب الشحن',
    'status.delivered': 'تم التسليم بنجاح',
    'status.cancelled': 'تم إلغاء الطلب',

    // Favorites Drawer
    'fav.title': 'قائمة الرغبات والمفضلة',
    'fav.empty': 'لا توجد منتجات محفوظة في المفضلة حالياً',
    'fav.emptyDesc': 'انقر على أيقونة القلب على أي منتج لحفظه لوقت لاحق.',
    'fav.share': 'مشاركة القائمة',
    'fav.clear': 'إفراغ القائمة',
    'fav.copied': 'تم نسخ رابط القائمة إلى الحافظة!',

    // Footer
    'footer.tagline': 'الموزع المعتمد لأحدث عتاد الألعاب الاحترافي، شاشات العرض الفائقة ومعدات الاستوديو.',
    'footer.fastDelivery': 'توصيل إقليمي فوري',
    'footer.fastDeliveryDesc': 'شحن في نفس اليوم لكافة الطلبات المؤكدة المتوفرة بالمخزون.',
    'footer.warranty': 'ضمان رسمي معتمد لمدة عامين',
    'footer.warrantyDesc': 'ضمان مباشر من المصنع مع خدمة استبدال فوري ودعم فني متواصل.',
    'footer.support': 'خدمة عملاء مباشرة عبر واتساب',
    'footer.supportDesc': 'تواصل مباشرة مع مهندسي وخبراء العتاد على مدار الأسبوع.',
    'footer.secure': 'توصيل آمن ومضمون 100%',
    'footer.secureDesc': 'تغليف خاص ومقاوم للصدمات لجميع الأجهزة والقطع الحساسة.',
    'footer.rights': 'جميع الحقوق محفوظة.',

    // Common Buttons
    'common.close': 'إغلاق',
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.search': 'بحث',
    'common.clear': 'مسح',
    'common.loading': 'جارٍ التحميل...',
    'common.signOut': 'تسجيل الخروج',
    'common.returnToStore': 'العودة للمتجر',

    // CartCheckoutDrawer
    'cart.remove': 'إزالة',
    'cart.promoPlaceholder': 'رمز الخصم (جرب SAM10 أو PROSETUP)',
    'cart.applyBtn': 'تطبيق',
    'cart.step1Title': '١. بيانات التوصيل والتواصل',
    'cart.fullNameLabel': 'الاسم الكامل',
    'cart.emailLabel': 'البريد الإلكتروني للإيصال',
    'cart.phoneLabel': 'رقم الجوال',
    'cart.addressLabel': 'العنوان التفصيلي',
    'cart.cityLabel': 'المدينة',
    'cart.postalCodeLabel': 'الرمز البريدي',
    'cart.notesLabel': 'ملاحظات التوصيل / معلم مميز (اختياري)',
    'cart.step2Title': '٢. طريقة الدفع',
    'cart.payCard': 'بطاقة بنكية',
    'cart.payWallet': 'دفع سريع',
    'cart.payCod': 'الدفع عند الاستلام',
    'cart.fillTestVisa': 'ملء بيانات تجريبية',
    'cart.cardNumber': 'رقم البطاقة',
    'cart.cardExpiry': 'تاريخ الانتهاء (شهر/سنة)',
    'cart.cardCvc': 'رمز الأمان CVC',
    'cart.walletTitle': 'تفويض المحفظة الرقمية السريعة',
    'cart.walletDesc': 'تسوية فورية عبر Apple Pay وGoogle Pay. يعيد توجيهك إلى بوابة الدفع الآمنة.',
    'cart.codTitle': 'الدفع عند الاستلام (مندوب موثوق)',
    'cart.codDesc': 'ادفع عند استلام طلبك. يتحقق المندوب من سلامة التغليف قبل التسليم.',
    'cart.codFee': 'رسوم خدمة الدفع عند الاستلام',
    'cart.codFreeNotice': 'تم تطبيق توصيل مجاني للدفع عند الاستلام',
    'cart.preparingOrder': 'جاري تحضير الطلب...',
    'cart.formattingInvoice': 'جاري إعداد فاتورة واتساب...',
    'cart.orderConfirmed': 'تم تأكيد الطلب!',
    'cart.reservingItems': 'جاري حجز منتجاتك والتحقق من المخزون...',
    'cart.redirectingWhatsapp': 'جاري التوجيه إلى واتساب...',
    'cart.stepInventory': 'المخزون',
    'cart.stepInvoice': 'الفاتورة',
    'cart.stepWhatsapp': 'واتساب',
    'cart.receiptTitle': 'تم تحضير طلبك!',
    'cart.receiptDesc': 'أرسله عبر واتساب لإتمام عملية الشراء. سيؤكد فريقنا خلال دقائق.',
    'cart.sendWhatsapp': 'إرسال الطلب عبر واتساب الآن',
    'cart.invoicePng': 'صورة الفاتورة',
    'cart.savePdf': 'حفظ PDF',
    'cart.copyText': 'نسخ النص',
    'cart.copied': 'تم النسخ',
    'cart.invoiceHeader': 'فاتورة طلب العميل',
    'cart.customerLocation': 'العميل والموقع',
    'cart.nameLabel': 'الاسم:',
    'cart.phoneLabelInv': 'الهاتف:',
    'cart.emailLabelInv': 'البريد:',
    'cart.locationLabel': 'الموقع:',
    'cart.notesLabelInv': 'ملاحظات:',
    'cart.itemHeader': 'المنتج',
    'cart.qtyPrice': 'الكمية × السعر',
    'cart.subtotalLine': 'المجموع الجزئي',
    'cart.discountLine': 'الخصم',
    'cart.shippingLine': 'الشحن',
    'cart.taxLine': 'الضريبة (8٪)',
    'cart.totalLine': 'الإجمالي',
    'cart.expressShipping': 'الشحن السريع',
    'cart.estimatedTax': 'ضريبة تقديرية (8٪)',
    'cart.promoAppliedLine': 'تم تطبيق الكود',
    'cart.proceedCheckout': 'المتابعة للدفع',
    'cart.submitting': 'جاري التأكيد وإعداد واتساب...',
    'cart.completeOrder': 'إتمام الطلب وإرساله عبر واتساب',

    // ProductDetailModal
    'prod.hoverZoom': 'مرر لتكبير الصورة',
    'prod.inTheBox': 'محتويات العبوة',
    'prod.dimensions': 'الأبعاد',
    'prod.notifyWhenAvailable': 'أعلمني عند التوفر',
    'prod.sortRecent': 'الأحدث',
    'prod.sortHelpful': 'الأكثر فائدة',
    'prod.sortHighest': 'أعلى تقييم',
    'prod.sortLowest': 'أدنى تقييم',

    // FavoritesDrawer
    'fav.saveAll': 'حفظ الكل في المفضلة',
    'fav.shareLink': 'مشاركة رابط المفضلة',
    'fav.moveInStock': 'نقل المتوفر إلى السلة',

    // OrderTrackerModal
    'track.orderNumLabel': 'رقم الطلب',
    'track.emailLabel': 'بريد الطلب',
    'track.totalLabel': 'الإجمالي',
    'track.refunded': 'مسترد',

    // ProductCompareModal
    'compare.added': 'تمت الإضافة',
    'compare.customerRating': 'تقييم العملاء',
    'compare.availability': 'التوفر',
    'compare.modelSku': 'رمز الطراز',
    'compare.configurations': 'المواصفات',
    'compare.warranty': 'الضمان',

    // Footer extras
    'footer.recentlyViewed': 'المُشاهَد مؤخراً',
    'footer.browserHistory': 'سجل تصفحك',
    'footer.clearLog': 'مسح السجل',
    'footer.techStack': 'دفع مباشر عبر واتساب · استضافة Node وMySQL سريعة',

    // HeroSection extras
    'hero.inspect': 'معاينة',
    'hero.useCode': 'استخدم',
    'hero.code': 'الكود',

    // Navbar staff bar
    'nav.admin': 'مدير',
    'nav.signOut': 'تسجيل خروج',

    // Admin Dashboard Navigation & Common
    'admin.navOverview': 'نظرة عامة',
    'admin.navAnalytics': 'التحليلات والمبيعات',
    'admin.navFlashSales': 'العروض الخاطفة',
    'admin.navCampaigns': 'الحملات والتسويق',
    'admin.navCatalog': 'كتالوج المنتجات',
    'admin.navOrders': 'إدارة الطلبات والشحن',
    'admin.navRbac': 'الموظفون والصلاحيات',
    'admin.navAudit': 'سجل التدقيق والعمليات',
    'admin.navSettings': 'إعدادات المتجر والهوية',
    'admin.switchRole': 'تبديل حساب الموظف',
    'admin.signOut': 'تسجيل الخروج',
    'admin.returnStore': 'العودة للمتجر',
    'admin.refresh': 'تحديث البيانات',
    'admin.scope': 'النطاق',
    'admin.workspace': 'لوحة تحكم الإدارة',
    'admin.actions': 'الإجراءات',
    'admin.status': 'الحالة',
    'admin.edit': 'تعديل',
    'admin.delete': 'حذف',
    'admin.save': 'حفظ',
    'admin.cancel': 'إلغاء',
    'admin.close': 'إغلاق',
    'admin.create': 'إنشاء',
    'admin.loading': 'جارٍ التحميل...',
    'admin.active': 'نشط',
    'admin.inactive': 'غير نشط',
    'admin.filter': 'تصفية',
    'admin.all': 'الكل',
    'admin.search': 'بحث',

    // Overview Tab
    'admin.overview.totalRevenue': 'إجمالي الإيرادات',
    'admin.overview.grossProfit': 'صافي الأرباح',
    'admin.overview.totalOrders': 'إجمالي الطلبات',
    'admin.overview.activeSkus': 'المنتجات النشطة',
    'admin.overview.lowStockAlerts': 'تنبيهات انخفاض المخزون',
    'admin.overview.waitlistInquiries': 'طلبات قائمة الانتظار',
    'admin.overview.revenueTrend': 'مسار الإيرادات (آخر 7 أيام)',
    'admin.overview.topProducts': 'المنتجات الأكثر مبيعاً',
    'admin.overview.recentOrders': 'أحدث الطلبات المؤكدة',
    'admin.overview.viewAllOrders': 'عرض كافة الطلبات',
    'admin.overview.inventoryAlerts': 'منتجات تتطلب اتخاذ إجراء فوري',

    // Analytics Tab
    'admin.analytics.range7d': 'آخر 7 أيام',
    'admin.analytics.range30d': 'آخر 30 يوماً',
    'admin.analytics.range90d': 'آخر 90 يوماً',
    'admin.analytics.range12m': 'آخر 12 شهراً',
    'admin.analytics.revenueVolume': 'حجم المبيعات الإجمالي',
    'admin.analytics.avgOrderValue': 'متوسط قيمة الطلب (AOV)',
    'admin.analytics.netProfit': 'هامش الربح التقديري',
    'admin.analytics.categoryShare': 'توزيع المبيعات حسب القسم',
    'admin.analytics.skuPerformance': 'أداء المنتجات والمبيعات',

    // Catalog Tab
    'admin.catalog.newProduct': 'إضافة منتج جديد',
    'admin.catalog.searchPlaceholder': 'ابحث باسم المنتج، الماركة، أو الرمز...',
    'admin.catalog.productHeader': 'المنتج',
    'admin.catalog.brandHeader': 'الماركة',
    'admin.catalog.categoryHeader': 'القسم',
    'admin.catalog.priceHeader': 'السعر',
    'admin.catalog.stockHeader': 'المخزون',
    'admin.catalog.conditionHeader': 'الحالة',
    'admin.catalog.reviewsTab': 'تقييمات العملاء',
    'admin.catalog.waitlistTab': 'قائمة انتظار التوفر',
    'admin.catalog.editProduct': 'تعديل المنتج',
    'admin.catalog.createProduct': 'إنشاء منتج جديد',
    'admin.catalog.productName': 'اسم المنتج',
    'admin.catalog.productDesc': 'الوصف التفصيلي',
    'admin.catalog.comparePrice': 'السعر قبل الخصم',
    'admin.catalog.stockQty': 'الكمية في المخزون',
    'admin.catalog.lowStockThreshold': 'حد تنبيه انخفاض المخزون',
    'admin.catalog.imageUpload': 'صورة المنتج / رفع صورة',

    // Orders Tab
    'admin.orders.searchPlaceholder': 'ابحث برقم الطلب، اسم العميل، البريد...',
    'admin.orders.orderNumber': 'رقم الطلب',
    'admin.orders.customer': 'العميل',
    'admin.orders.date': 'التاريخ',
    'admin.orders.items': 'القطع',
    'admin.orders.total': 'المجموع',
    'admin.orders.paymentMethod': 'طريقة الدفع',
    'admin.orders.fulfillmentStatus': 'حالة الشحن والتجهيز',
    'admin.orders.updateStatus': 'تحديث الحالة',
    'admin.orders.processRefund': 'إجراء استرداد أموال',
    'admin.orders.refunded': 'مسترد',
    'admin.orders.orderDetails': 'تفاصيل ومعاينة الطلب',

    // Campaigns & Flash Sales
    'admin.campaigns.newBanner': 'إضافة لافتة حملة جديدة',
    'admin.campaigns.title': 'عنوان الحملة',
    'admin.campaigns.subtitle': 'العنوان الفرعي',
    'admin.campaigns.ctaLabel': 'نص زر الإجراء CTA',
    'admin.flash.newDrop': 'إضافة عرض خاطف جديد',
    'admin.flash.discountPct': 'نسبة الخصم (%)',
    'admin.flash.theme': 'النمط والتصميم',
    'admin.flash.countdown': 'العداد الزمني / موعد الانتهاء',

    // RBAC & Staff
    'admin.rbac.staffMembers': 'حسابات وموظفو المتجر',
    'admin.rbac.rolesMatrix': 'مصفوفة الأدوار والصلاحيات',
    'admin.rbac.addStaff': 'إضافة موظف جديد',
    'admin.rbac.createRole': 'إنشاء دور وصلاحيات جديدة',
    'admin.rbac.roleName': 'اسم الدور',
    'admin.rbac.employeeName': 'اسم الموظف',
    'admin.rbac.employeeEmail': 'البريد الإلكتروني',
    'admin.rbac.employeePhone': 'رقم الجوال',
    'admin.rbac.temporaryPassword': 'كلمة المرور',
    'admin.rbac.permissions': 'الصلاحيات الممنوحة',

    // Audit Log
    'admin.audit.title': 'سجل النشاط والتدقيق الأمني',
    'admin.audit.actor': 'الموظف المسؤول',
    'admin.audit.action': 'الإجراء المنفذ',
    'admin.audit.entity': 'الهدف والكيان',
    'admin.audit.timestamp': 'الوقت والتاريخ',
    'admin.audit.details': 'التفاصيل والبيانات',

    // Store Settings
    'admin.settings.storeName': 'اسم المتجر',
    'admin.settings.whatsapp': 'رقم خدمة عملاء واتساب',
    'admin.settings.logo': 'شعار وهيكل المتجر',
    'admin.settings.saveBtn': 'حفظ إعدادات المتجر',
    'admin.settings.savedSuccess': 'تم تحديث وحفظ إعدادات المتجر بنجاح',
    'admin.overview.grossRevenue': 'إجمالي الإيرادات',
    'admin.overview.pendingFulfillment': 'في انتظار التجهيز والشحن',
    'admin.overview.totalCatalogSkus': 'إجمالي المنتجات المسجلة',
    'admin.overview.unitsInStock': 'إجمالي الوحدات بالمخزن',
    'admin.overview.inventoryValue': 'القيمة السوقية للمخزون',
    'admin.overview.outLowStock': 'نفد / أوشك على النفاد',
    'admin.overview.restockWaitlist': 'قائمة تنبيهات التوفر',
    'admin.overview.revenueVelocity': 'حركة المبيعات (آخر 7 أيام)',
    'admin.overview.salesByDept': 'المبيعات حسب القسم',
    'admin.overview.pipeline': 'مسار معالجة وشحن الطلبات',
    'admin.overview.topPerforming': 'المنتجات الأكثر مبيعاً',
    'admin.overview.unitsSold': 'القطع المباعة',
    'admin.overview.noSales': 'لا توجد مبيعات مكتملة مسجلة بعد.',
    'admin.overview.roleRules': 'الصلاحيات وقواعد الأمان النشطة',
    'admin.overview.changeLogo': 'هوية وشعار المتجر',
    'admin.overview.changeLogoDesc': 'تخصيص اسم وشعار المتجر وحفظهما مباشرة دون تعديل الكود البرمجي.',
    'admin.settings.uploadLogo': 'رفع شعار جديد',
    'admin.settings.resetLogo': 'استعادة الشعار الافتراضي',
    'admin.settings.logoUrlPlaceholder': 'أو أدخل رابط الصورة مباشرة (https://...)',
    'admin.settings.saveBranding': 'حفظ الهوية والشعار',
    'admin.settings.saving': 'جارٍ الحفظ...',
  },
};

const CATEGORY_MAP: Record<string, { en: string; ar: string }> = {
  All: { en: 'All Gear', ar: 'جميع المنتجات' },
  Consoles: { en: 'Consoles', ar: 'منصات الألعاب' },
  Monitors: { en: 'Monitors', ar: 'شاشات العرض' },
  Audio: { en: 'Audio', ar: 'الصوتيات الاحترافية' },
  Peripherals: { en: 'Peripherals', ar: 'الملحقات والطرفيات' },
  Accessories: { en: 'Accessories', ar: 'الإكسسوارات' },
  Featured: { en: 'Flagship Picks', ar: 'مختارات مميزة' },
  Deals: { en: 'Special Offers', ar: 'عروض خاصة' },
  Favorites: { en: 'Saved Gear', ar: 'المفضلة' },
  Xbox: { en: 'Console Bundles', ar: 'حزم الأجهزة' },
};

const STATUS_MAP: Record<string, { en: string; ar: string }> = {
  confirmed: { en: 'Order Confirmed', ar: 'تم تأكيد الطلب' },
  packed: { en: 'Packed & Inspected', ar: 'تم الفحص والتجهيز' },
  shipped: { en: 'Shipped with Courier', ar: 'في الطريق مع مندوب الشحن' },
  delivered: { en: 'Delivered', ar: 'تم التسليم بنجاح' },
  cancelled: { en: 'Cancelled', ar: 'تم الإلغاء' },
};

const ROLE_MAP: Record<string, { en: string; ar: string }> = {
  owner: { en: 'Owner', ar: 'مالك المتجر' },
  manager: { en: 'Operations Manager', ar: 'مدير العمليات' },
  clerk: { en: 'Inventory Clerk', ar: 'مسؤول المخزون' },
  fulfillment: { en: 'Fulfillment Agent', ar: 'مندوب الشحن والتجهيز' },
  auditor: { en: 'Auditor', ar: 'مدقق الحسابات' },
};

const SCOPE_MAP: Record<string, { en: string; ar: string }> = {
  all: { en: 'All Departments', ar: 'كافة الأقسام' },
  'all departments': { en: 'All Departments', ar: 'كافة الأقسام' },
  consoles: { en: 'Consoles', ar: 'منصات الألعاب' },
  monitors: { en: 'Monitors', ar: 'شاشات العرض' },
  audio: { en: 'Audio', ar: 'الصوتيات الاحترافية' },
  peripherals: { en: 'Peripherals', ar: 'الملحقات والطرفيات' },
  accessories: { en: 'Accessories', ar: 'الإكسسوارات' },
};

export interface ProductTranslation {
  name: string;
  description: string;
  variants?: string[];
  specs?: Record<string, string>;
  whatsInBox?: string[];
}

export const PRODUCT_AR_MAP: Record<string, ProductTranslation> = {
  prod_ps5_pro: {
    name: 'جهاز بلايستيشن 5 برو سعة 2 تيرابايت',
    description: 'صُمم لتشغيل ألعاب بدقة 4K ومعدل إطارات فائق مع ترقية الذكاء الاصطناعي PSSR، وتتبع الأشعة عبر العتاد، واتصال Wi-Fi 7، وردود فعل لمسية متطورة عبر يد التحكم DualSense.',
    variants: ['إصدار قياسي 2 تيرابايت', 'إصدار 2 تيرابايت + يد تحكم إضافية'],
    specs: {
      'سعة التخزين': '2TB Custom NVMe SSD فائقة السرعة',
      'دقة العرض': '4K 120Hz / 8K VRR HDMI 2.1',
      'الاتصال اللاسلكي': 'Wi-Fi 7 وبلوتوث 5.3',
      'الضمان': 'ضمان رسمي معتمد لمدة عامين من سام ستور',
    },
    whatsInBox: ['جهاز PS5 Pro سعة 2 تيرابايت', 'يد تحكم لاسلكية DualSense', 'كابل HDMI 2.1 عالي السرعة', 'كابل الطاقة وقاعدة التثبيت'],
  },
  prod_oled_27: {
    name: 'شاشة أيبكس بليد 27 بوصة أوليد 240 هرتز',
    description: 'لوحة QD-OLED ذاتية الإضاءة توفر تبايناً لانهائياً، ومعدل تحديث بطولات 240 هرتز، وتبريداً متطوراً من الجرافين بدون أي ضوضاء للمروحة.',
    variants: ['أسود بركاني غير لامع', 'حامل ألمنيوم فضي فاخر'],
    specs: {
      'نوع اللوحة': '27 بوصة WQHD QD-OLED (2560x1440)',
      'معدل التحديث': '240Hz مع سرعة استجابة 0.03ms GtG',
      'المنافذ': 'منفذا HDMI 2.1، وDisplayPort 1.4a، وUSB-C 90W',
      'دقة الألوان': 'تغطية 99.3% DCI-P3 معايرة مصنعياً',
    },
    whatsInBox: ['شاشة ApexBlade 27" QD-OLED', 'كابل DisplayPort 1.4a', 'كابل USB-C 90W', 'محول الطاقة'],
  },
  prod_novapulse_audio: {
    name: 'سماعة نوفا بالس برو اللاسلكية الاحترافية',
    description: 'اسمع خطوات وتحركات الأعداء التوجيهية قبل أن يلتفوا حول الزاوية. مكبرات صوت نيوديميوم متطورة، وبطاريتان قابلتان للتبديل السريع، ومايكروفون احترافي قابل للسحب.',
    variants: ['رمادي جرافيت مطفأ', 'أبيض جليدي ناصع'],
    specs: {
      'مكبرات الصوت': '40mm Hi-Res عالية الدقة من النيوديميوم',
      'عمر البطارية': '44 ساعة تشغيل (بطاريتان قابلتان للتبديل)',
      'الاتصال': 'اتصال لاسلكي 2.4GHz بدون فقدان + بلوتوث 5.3',
      'الوزن': '312 غرام مع هيكل ألمنيوم مؤكسد متين',
    },
    whatsInBox: ['سماعة NovaPulse Pro اللاسلكية', 'محطة الشحن اللاسلكي Base Station', 'بطاريتان ليثيوم', 'كابل صوت 3.5mm'],
  },
  prod_tactile75: {
    name: 'لوحة مفاتيح تاكتايل 75 ألمنيوم CNC',
    description: 'مصنوعة بالكامل من ألمنيوم 6063 الفضائي مع استجابة مغناطيسية قابلة للتعديل من 0.1 إلى 4.0 ملم، وعزل صوتي من Poron، واستجابة 8000Hz عبر USB-C.',
    variants: ['مفاتيح مغناطيسية رمادية خطية', 'مفاتيح تاكتايل سوداء'],
    specs: {
      'الهيكل': 'ألمنيوم 6063 مصقول بالكامل بتقنية CNC',
      'المفاتيح': 'مفاتيح Hall-Effect مغناطيسية مع Rapid Trigger',
      'معدل الاستجابة': '8000Hz سلكي / 1000Hz لاسلكي 2.4GHz',
      'أغطية المفاتيح': 'أغطية PBT متينة بتقنية Double-Shot',
    },
    whatsInBox: ['لوحة مفاتيح Tactile75 CNC', 'كابل USB-C مجدول فاخر', 'أداة سحب المفاتيح والأغطية', 'مفاتيح إضافية لنظامي Mac وWindows'],
  },
  prod_aerolite_mouse: {
    name: 'ماوس إيرولايت اللاسلكي للرياضات الإلكترونية 49غ',
    description: 'دقة استجابة لاسلكية فائقة بدون أي تأخير صُممت لمحترفي ألعاب التصويب، مع مفاتيح ضوئية دقيقة، ومزالق PTFE نقية، ومستقبل لاسلكي 4KHz.',
    variants: ['أسود مطفأ غير لامع', 'أبيض طباشيري ناصع'],
    specs: {
      'الوزن': '49 غرام فقط خفيف للغاية للتحكم السريع',
      'المستشعر': 'مستشعر ضوئي بدقة 30,000 DPI وسرعة 750 IPS',
      'البطارية': '85 ساعة تشغيل متواصل بدون انقطاع',
      'معدل الاستجابة': 'مستقبل لاسلكي 4000Hz مرفق بالعلبة',
    },
    whatsInBox: ['ماوس AeroLite اللاسلكي', 'مستقبل لاسلكي Dongle 4KHz', 'كابل شحن Paracord خفيف', 'مزالق PTFE إضافية'],
  },
  prod_horizon_handheld: {
    name: 'جهاز هورايزون بوكيت أوليد المحمول',
    description: 'العب ألعابك المفضلة أينما كنت مع معالج 6 نانومتر مخصص، وشاشة HDR OLED نقية، ولوحتي لمس، وبطارية 50Whr تدوم للرحلات الطويلة.',
    variants: ['1 تيرابايت أوليد مطفأ ضد التوهج', '512 جيجابايت أوليد زجاجي براق'],
    specs: {
      'شاشة العرض': '7.4 بوصة HDR OLED بتردد 90Hz وسطوع 1000 شمعة',
      'سعة التخزين': '1TB NVMe SSD فائق السرعة + فتحة MicroSD UHS-II',
      'الذاكرة العشوائية': '16GB LPDDR5 بسرعة 6400MT/s',
      'الصوتيات': 'مكبرات صوت ستيريو أمامية مزدوجة مع منفذ 3.5mm Hi-Fi',
    },
    whatsInBox: ['جهاز Horizon Pocket OLED', 'شاحن سريع بقدرة 45W', 'حقيبة حمل صلبة فاخرة'],
  },
  prod_dualforce_ctrl: {
    name: 'يد تحكم دوال فورس إيدج برو',
    description: 'يد تحكم لاسلكية مخصصة للبطولات بأقفال أزرار قابلة للتعديل، وكابل مجدول بمنفذ USB-C قابل للقفل، وحقيبة مخصصة مع إمكانية الشحن.',
    variants: ['كوبالت ليلي عميق', 'أبيض جليدي كلاسيكي'],
    specs: {
      'عصي التحكم': 'وحدات عصي قابلة للاستبدال بدون أي انحراف Drift',
      'أزرار الزناد': 'أقفال أزرار سريعة بـ 3 مستويات Hair-Trigger',
      'الأزرار الخلفية': '4 أزرار معدنية مغناطيسية قابلة للتخصيص',
      'الشحن والكابل': 'شحن سريع عبر USB-C مع كابل مجدول بطول 3 أمتار',
    },
    whatsInBox: ['يد تحكم DualForce Edge Pro', '4 أزرار خلفية مغناطيسية', 'قبعات عصي تحكم بديلة بأطوال مختلفة', 'حقيبة حمل صلبة مزودة بمنفذ شحن'],
  },
  prod_ultrawide_34: {
    name: 'شاشة ستوديو ويف 34 بوصة أوليد العريضة',
    description: 'مصممة لسباقات المحاكاة وألعاب العالم المفتوح واستوديوهات المونتاج، مع مفتاح KVM وشحن عبر منفذ USB-C بقدرة 98 واط.',
    variants: ['34 بوصة بتردد 180Hz لون رمادي داكن'],
    specs: {
      'الدقة والشكل': '3440 x 1440 بنسبة 21:9 وانحناء غامر 1800R',
      'معدل التحديث': '180Hz مع دعم FreeSync Premium Pro',
      'مفتاح KVM': 'مفتاح KVM مدمج للتحكم بجهازين في نفس الوقت',
      'شحن الحواسيب': 'منفذ USB-C بقدرة 98 واط لتشغيل الحواسيب المحمولة',
    },
    whatsInBox: ['شاشة StudioWave 34" Ultrawide', 'حامل معدني قابل لضبط الارتفاع', 'كابل HDMI 2.1', 'كابل USB-C 100W'],
  },
  prod_hyperdock: {
    name: 'منصة هايبر دوك ثندربولت 4',
    description: 'تخلص من فوضى الكابلات بكابل واحد يوفر شحن بقدرة 98 واط، ومنفذ إيثرنت 2.5 غيغابت، وقارئ ذاكرة SD 4.0، ودعم شاشتين بدقة 4K.',
    variants: ['رمادي فلكي Space Gray'],
    specs: {
      'المنافذ الإجمالية': '18 منفذاً متكاملاً (3x TB4, 5x USB-A, 3x USB-C)',
      'منفذ الشبكة': 'إيثرنت 2.5GbE عالي السرعة بزمن استجابة فائق',
      'قدرة الشحن': 'شحن الجهاز المضيف بقدرة 98W كافية لكافة الحواسيب',
      'التبريد والهيكل': 'هيكل ألمنيوم مزعنف للتبريد الصامت بدون مراوح',
    },
    whatsInBox: ['منصة HyperDock Thunderbolt 4', 'كابل Thunderbolt 4 بطول 0.8 متر', 'محول طاقة جداري بقوة 150 واط'],
  },
  prod_echocast_mic: {
    name: 'مايكروفون إيكو كاست ستوديو الاحترافي',
    description: 'عزل صوتي فائق بمستوى الاستوديو عبر USB-C أو XLR، مع زر كتم لمسي، ومراقبة صوتية فورية، وحامل مقاوم للاهتزازات.',
    variants: ['فحمي مطفأ Charcoal'],
    specs: {
      'كبسولة الصوت': 'كبسولة ديناميكية كارديويد لعزل ضوضاء الغرفة تماماً',
      'معالجة الصوت': 'دقة 24-bit/96kHz عبر USB-C ومخرج XLR متوازن',
      'التحكم': 'قرص لضبط حساسية الصوت مع حلقة إضاءة لكتم الصوت لمسياً',
      'حامل التثبيت': 'متوافق مباشرة مع أذرع البث بحجم 5/8" و3/8"',
    },
    whatsInBox: ['مايكروفون EchoCast Studio Dynamic', 'كابل USB-C مجدول بطول 2 متر', 'مانع رياح فومي مدمج', 'محول لولبي للحوامل'],
  },
  prod_xbox_galaxy: {
    name: 'إكس بوكس سيريس إكس 2 تيرابايت إصدار جالاكسي',
    description: 'استئناف فوري وسريع للألعاب المتعددة، وتقنية Dolby Vision للألعاب، وصوت مكاني ثلاثي الأبعاد، مع يد تحكم لاسلكية بلون أسود جالاكسي.',
    variants: ['2 تيرابايت إصدار أسود جالاكسي Galaxy Black'],
    specs: {
      'سعة التخزين': '2TB مخصص فائق السرعة عبر PCIe Gen 4 SSD',
      'قوة المعالجة': '12 TFLOPS RDNA 2 بدقة 4K وحتى 120 إطاراً بالثانية',
      'قارئ الأقراص': 'قارئ أقراص 4K UHD Blu-ray مدمج',
      'الصوتيات': 'دعم أصوات Dolby Atmos وDTS:X المكانية',
    },
    whatsInBox: ['جهاز Xbox Series X سعة 2TB إصدار جالاكسي', 'يد تحكم لاسلكية بلون Galaxy Black', 'كابل HDMI 2.1 فائق السرعة', 'كابل الطاقة'],
  },
  prod_macro_deck: {
    name: 'وحدة ماكرو ستريم ديك 15 زراً',
    description: 'تحكم بمشاهد البث في OBS، وتوجيه الصوت في ديسكورد، وإضاءة الاستوديو واختصارات المونتاج المعقدة بلمسة زر على شاشات LCD الملونة.',
    variants: ['أسود كربوني Carbon Black'],
    specs: {
      'المفاتيح': '15 مفتاحاً تفاعلياً بشاشات LCD ملونة بالكامل',
      'الحامل': 'حامل مكتبي مائل مانع للانزلاق قابل للفصل',
      'التوصيل': 'كابل USB-C مجدول متين ومقاوم للاهتراء',
      'التوافق': 'توافق كامل مع macOS وWindows وبرامج البث والتحرير',
    },
    whatsInBox: ['وحدة StreamDeck 15 مفتاحاً', 'حامل مكتبي زاوية مائل', 'كابل USB-C مجدول'],
  },
  prod_ps5_cobalt_ltd: {
    name: 'بلايستيشن 5 برو إصدار البطولات كوبالت',
    description: 'إصدار خاص وجامعي من جهاز PS5 Pro مع يد تحكم DualSense Edge كوبالت كروية وكابل HDMI 2.1 مجدول. انضم لقائمة الإشعار للحصول على أولوية الشحن.',
    variants: ['2 تيرابايت إصدار كوبالت الأزرق الفاخر'],
    specs: {
      'سعة التخزين': '2TB Custom NVMe SSD فائقة السرعة',
      'دقة العرض': '4K 120Hz / 8K VRR HDMI 2.1',
      'الحزمة الخاصة': 'تتضمن يد التحكم الاحترافية DualSense Edge Cobalt',
      'الضمان': 'ضمان رسمي معتمد لمدة عامين من سام ستور',
    },
    whatsInBox: ['جهاز PS5 Pro 2TB إصدار Cobalt', 'يد تحكم DualSense Edge بلون Cobalt المخصص', 'كابل HDMI 2.1 مجدول أزرق', 'كابل طاقة تيار متردد'],
  },
  prod_rog_oled_32: {
    name: 'شاشة روج سويفت 32 بوصة 4K أوليد 240 هرتز',
    description: 'الشاشة الرائدة من أسوس بدقة 4K QD-OLED، ونظام تبريد مبتكر من الجرافين، وتقنية Dolby Vision HDR، وزمن استجابة فائق 0.03 مللي ثانية.',
    variants: ['32 بوصة 4K بلون أوبسيديان فاحم'],
    specs: {
      'نوع اللوحة': '32 بوصة 4K UHD QD-OLED (3840x2160)',
      'معدل التحديث': '240Hz مع سرعة استجابة فائقة 0.03ms GtG',
      'المنافذ': 'منفذا HDMI 2.1، وDP 1.4، ومنفذ USB-C 90W',
      'الألوان': 'تغطية 99% من نطاق DCI-P3 مع Delta E < 1.5',
    },
    whatsInBox: ['شاشة ROG Swift 32" 4K OLED', 'كابل DisplayPort 1.4 أصلي', 'كابل USB-C بقدرة 90W', 'محول تثبيت جداري VESA'],
  },
  prod_studio_dac_amp: {
    name: 'محول ومضخم صوت أوديو بالس المكتبي',
    description: 'شريحة معالجة الصوت المرجعية Sabre المصممة لسماع خطوات الأقدام في الألعاب بدقة وتوزيع الموسيقى، قادرة على تشغيل سماعات حتى 600 أوم بنقاء تام.',
    variants: ['أسود مؤكسد غير لامع'],
    specs: {
      'شريحة المحول': 'شريحة ESS Sabre DAC بدقة 32-bit / 384kHz',
      'المخارج': 'مخرج متوازن 4.4mm ومخرج استوديو قياسي 6.35mm',
      'مستوى الضوضاء': 'نسبة إشارة إلى ضوضاء 124 dB هادئة ونقية للغاية',
      'الهيكل': 'ألمنيوم مصقول بتقنية CNC عالية الدقة ومقاومة للتشويش',
    },
    whatsInBox: ['وحدة AudioPulse DAC & Amp', 'كابل USB-C مجدول عالي الجودة', 'كابل ألياف ضوئية Toslink'],
  },
  prod_carbon_desk_mat: {
    name: 'بساط مكتب أيبكس كوردورا الزجاجي',
    description: 'سطح متوازن يجمع بين السرعة والتحكم ومُعاير لحساسات الماوس الضوئية، مع قاعدة مقاومة للانزلاق من مادة Poron عالية الكثافة بسمك 4 ملم.',
    variants: ['فحمي داكن خفي', 'درزات كوبالت زرقاء أنيقة'],
    specs: {
      'المقاس والأبعاد': '900 × 400 × 4 ملم حجم XL فائق الاتساع',
      'نوع السطح': 'نسيج Cordura فائق النعومة للسرعة والتحكم',
      'القاعدة السفلية': 'قاعدة Poron عالية الكثافة مانعة للانزلاق تماماً',
      'الحواف': 'حواف مخيطة بمستوى منخفض لمنع الاحتكاك مع المعصم',
    },
    whatsInBox: ['بساط مكتب Apex XL Cordura', 'قطعة قماش مايكروفايبر للعناية والتنظيف'],
  },
};

const SPEC_KEYS_AR: Record<string, string> = {
  storage: 'سعة التخزين',
  resolution: 'دقة العرض',
  output: 'مخارج العرض',
  wireless: 'الاتصال اللاسلكي',
  warranty: 'الضمان المعتمد',
  panel: 'نوع اللوحة',
  refresh: 'معدل التحديث',
  ports: 'المنافذ',
  color: 'نطاق الألوان',
  drivers: 'مكبرات الصوت',
  battery: 'عمر البطارية',
  connectivity: 'الاتصال',
  weight: 'الوزن',
  chassis: 'الهيكل والمواد',
  switches: 'نوع المفاتيح',
  polling: 'معدل الاستجابة',
  keycaps: 'أغطية المفاتيح',
  sensor: 'المستشعر الضوئي',
  display: 'شاشة العرض',
  memory: 'الذاكرة العشوائية',
  audio: 'الصوتيات',
  sticks: 'عصي التحكم',
  triggers: 'أزرار الزناد',
  rearinputs: 'الأزرار الخلفية',
  kvm: 'مفتاح KVM',
  powerdelivery: 'شحن الأجهزة',
  network: 'منفذ الشبكة',
  power: 'القدرة الكهربائية',
  capsule: 'كبسولة المايكروفون',
  controls: 'التحكم والمؤشرات',
  mount: 'حامل التثبيت',
  gpu: 'معالج الرسومات',
  optical: 'قارئ الأقراص',
  keys: 'المفاتيح',
  stand: 'الحامل المكتبي',
  interface: 'التوصيل',
  compatibility: 'التوافق',
  converter: 'شريحة التحويل',
  snr: 'مستوى الإشارة والضوضاء',
  dimensions: 'الأبعاد والمقاس',
  surface: 'نوع السطح',
  base: 'القاعدة السفلية',
  edges: 'الحواف',
  bundle: 'الحزمة المرفقة',
};

function translateSpecs(specs?: Record<string, string>): Record<string, string> {
  if (!specs) return {};
  const res: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const arKey = SPEC_KEYS_AR[lower] || k;
    res[arKey] = v;
  }
  return res;
}

export function translateProduct(product: Product, lang: Language = 'en'): Product {
  if (lang !== 'ar' || !product) return product;
  const ar = PRODUCT_AR_MAP[product.id];
  if (ar) {
    return {
      ...product,
      name: ar.name || product.name,
      description: ar.description || product.description,
      variants: ar.variants || product.variants,
      specs: ar.specs || translateSpecs(product.specs),
      whatsInBox: ar.whatsInBox || product.whatsInBox,
    };
  }
  return {
    ...product,
    specs: translateSpecs(product.specs),
  };
}

export function translateProducts(products: Product[], lang: Language = 'en'): Product[] {
  if (lang !== 'ar' || !products) return products;
  return products.map((p) => translateProduct(p, lang));
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  dir: 'ltr',
  isRtl: false,
  setLang: () => {},
  toggleLang: () => {},
  t: (k) => k,
  translateCategory: (c) => c,
  translateStatus: (s) => s,
  translateRole: (r) => r,
  translateScope: (s) => s,
  translateProduct: (p) => p,
  translateProducts: (p) => p,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
      // Default detection
      return 'en';
    } catch {
      return 'en';
    }
  });

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';
  const isRtl = dir === 'rtl';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  const setLang = (nextLang: Language) => {
    setLangState(nextLang);
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const t = (key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (dict[key]) return dict[key];
    const enDict = TRANSLATIONS.en;
    if (enDict[key]) return enDict[key];
    return fallback || key;
  };

  const translateCategory = (cat: string): string => {
    const entry = CATEGORY_MAP[cat];
    if (entry) return entry[lang] || entry.en;
    return cat;
  };

  const translateStatus = (status: string): string => {
    const entry = STATUS_MAP[status.toLowerCase()];
    if (entry) return entry[lang] || entry.en;
    return status;
  };

  const translateRole = (role: string): string => {
    const lower = (role || '').toLowerCase();
    const entry = ROLE_MAP[lower];
    if (entry) return entry[lang] || entry.en;
    return role;
  };

  const translateScope = (scope: string): string => {
    const lower = (scope || '').toLowerCase();
    const entry = SCOPE_MAP[lower];
    if (entry) return entry[lang] || entry.en;
    return scope;
  };

  const translateProd = useCallback(
    (product: Product): Product => translateProduct(product, lang),
    [lang]
  );

  const translateProds = useCallback(
    (products: Product[]): Product[] => translateProducts(products, lang),
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      dir,
      isRtl,
      setLang,
      toggleLang,
      t,
      translateCategory,
      translateStatus,
      translateRole,
      translateScope,
      translateProduct: translateProd,
      translateProducts: translateProds,
    }),
    [lang, dir, isRtl, translateProd, translateProds]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}
