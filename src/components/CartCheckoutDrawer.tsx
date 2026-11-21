import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Minus,
  Plus,
  Trash2,
  Banknote,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  Tag,
  MessageCircle,
  Download,
  Printer,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  downloadOrderInvoiceImage,
} from '../lib/invoice';
import type { AuthUser, CartItem, Order } from '../types';
import { useTranslation } from '../lib/i18n';
import { ProductVisual } from './ProductVisual';

interface CartCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (productId: string, variant: string, delta: number) => void;
  onRemoveItem: (productId: string, variant: string) => void;
  onClearCart: () => void;
  onOrderCompleted: (order: Order) => void;
  user: AuthUser | null;
  initialPromoCode?: string | null;
}

export function CartCheckoutDrawer({
  open,
  onClose,
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderCompleted,
  user,
  initialPromoCode,
}: CartCheckoutDrawerProps) {
  const { t, isRtl } = useTranslation();
  const [step, setStep] = useState<'bag' | 'checkout' | 'preparing' | 'receipt'>('bag');
  const [prepStage, setPrepStage] = useState<0 | 1 | 2>(0);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    freeShipping: boolean;
    label: string;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Checkout form fields
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const paymentMethod = 'cod';
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('96171972495');
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    api
      .getPublicSettings()
      .then((s) => {
        if (s.whatsappNumber) setWhatsappNumber(s.whatsappNumber);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.name);
      setCustomerEmail((prev) => prev || user.email);
      if (user.phone) {
        setCustomerPhone((prev) => prev || user.phone || '');
      }
    }
  }, [user]);

  useEffect(() => {
    if (initialPromoCode) {
      setPromoInput(initialPromoCode);
    }
  }, [initialPromoCode]);

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const freeShippingThreshold = 250;
  const discountAmount = appliedPromo ? appliedPromo.discountAmount : 0;
  const shippingCost =
    items.length === 0 ? 0 : subtotal >= freeShippingThreshold || appliedPromo?.freeShipping ? 0 : 18;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = Number((taxable * 0.08).toFixed(2));
  const total = Number((taxable + shippingCost + taxAmount).toFixed(2));

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoError(null);
    try {
      const res = await api.validatePromo(promoInput, subtotal);
      setAppliedPromo(res);
    } catch (err) {
      setAppliedPromo(null);
      setPromoError(err instanceof Error ? err.message : 'Invalid promo code.');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCheckoutError(null);

    try {
      const { order } = await api.createOrder({
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        city,
        paymentMethod,
        promoCode: appliedPromo?.code,
        notes: deliveryNotes.trim() || undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          variant: i.variant,
          quantity: i.quantity,
        })),
      });
      setConfirmedOrder(order);
      onOrderCompleted(order);
      onClearCart();
      setAppliedPromo(null);
      setPrepStage(0);
      setStep('preparing');

      setTimeout(() => setPrepStage(1), 480);
      setTimeout(() => setPrepStage(2), 980);
      setTimeout(() => {
        setStep('receipt');
        // Redirect customer to WhatsApp with the structured line-by-line order invoice
        const waUrl = buildWhatsAppUrl(whatsappNumber, order);
        const anchor = document.createElement('a');
        anchor.href = waUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.click();
      }, 1550);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Payment processing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'preparing') return;
    if (step === 'receipt') {
      setStep('bag');
      setConfirmedOrder(null);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-[#0F1B2D]/50 backdrop-blur-xs"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[#E6ECF4] bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6ECF4] px-6 py-4">
              <div className="flex items-center gap-3">
                {step === 'checkout' && (
                  <button
                    type="button"
                    onClick={() => setStep('bag')}
                    aria-label="Back to bag"
                    className="rounded-lg border border-[#E6ECF4] p-1.5 text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0F1B2D]">
                    {step === 'bag'
                      ? `${t('cart.title')} (${items.reduce((s, i) => s + i.quantity, 0)})`
                      : step === 'checkout'
                      ? t('cart.checkoutInfo')
                      : step === 'preparing'
                      ? t('cart.preparingOrder')
                      : t('cart.orderConfirmed')}
                  </h2>
                  {step === 'checkout' && (
                    <p className="text-xs text-[#6B7A8D]">
                      Server-verified stock lock &amp; WhatsApp invoice
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Close bag"
                className="rounded-lg p-2 text-[#475569] hover:bg-[#F7FAFD] hover:text-[#0F1B2D] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 'bag' && (
                <>
                  {items.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                      <p className="font-display text-lg font-semibold text-[#0F1B2D]">
                        {t('cart.empty')}
                      </p>
                      <p className="mt-1 max-w-xs text-sm text-[#6B7A8D]">
                        {t('cart.emptySubtitle')}
                      </p>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="mt-5 rounded-lg bg-[#0F1B2D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                      >
                        {t('cart.browseGear')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Free Shipping Bar */}
                      <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5 text-xs">
                        <div className="flex items-center justify-between font-medium text-[#0F1B2D]">
                          <span>
                            {subtotal >= freeShippingThreshold
                              ? 'Unlocked Free Express Delivery'
                              : `Add $${(freeShippingThreshold - subtotal).toFixed(2)} for Free Express Delivery`}
                          </span>
                          <span className="font-mono tabular-nums text-[#1180E1]">
                            {Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))}%
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E6ECF4]">
                          <div
                            className="h-full bg-[#1180E1] transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Cart Items */}
                      <div className="divide-y divide-[#E6ECF4]">
                        {items.map((item) => (
                          <div
                            key={`${item.product.id}-${item.variant}`}
                            className="flex gap-4 py-4"
                          >
                            <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-[#E6ECF4] bg-[#F7FAFD]">
                              <ProductVisual
                                visualKey={item.product.visualKey}
                                imageUrl={item.product.imageUrl}
                                alt={item.product.name}
                                className="h-full w-full"
                              />
                            </div>

                            <div className="flex flex-1 flex-col justify-between">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-display text-sm font-semibold text-[#0F1B2D]">
                                    {item.product.name}
                                  </h3>
                                  <p className="text-xs text-[#6B7A8D]">{item.variant}</p>
                                </div>
                                <span className="font-mono text-sm font-semibold text-[#0F1B2D] tabular-nums">
                                  ${(item.product.price * item.quantity).toFixed(2)}
                                </span>
                              </div>

                              <div className="mt-2 flex items-center justify-between">
                                <div className="inline-flex items-center rounded-lg border border-[#D4DFEE] bg-[#F7FAFD]">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQty(item.product.id, item.variant, -1)}
                                    aria-label="Decrease quantity"
                                    className="p-1.5 text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-8 text-center font-mono text-xs font-semibold tabular-nums">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQty(item.product.id, item.variant, 1)}
                                    disabled={item.quantity >= item.product.stock}
                                    aria-label="Increase quantity"
                                    className="p-1.5 text-[#475569] hover:text-[#0F1B2D] disabled:opacity-40 cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onRemoveItem(item.product.id, item.variant)}
                                  aria-label="Remove item"
                                  className="text-xs text-[#6B7A8D] hover:text-[#DC2626] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>{t('cart.remove')}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Promo Code */}
                      <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-[#1180E1]" />
                          <input
                            type="text"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value)}
                            placeholder={t('cart.promoPlaceholder')}
                            className="flex-1 bg-transparent text-xs font-medium text-[#0F1B2D] placeholder:text-[#6B7A8D] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleApplyPromo}
                            className="rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1180E1] cursor-pointer"
                          >
                            {t('cart.applyBtn')}
                          </button>
                        </div>
                        {promoError && (
                          <p className="mt-1.5 text-xs text-[#DC2626]">{promoError}</p>
                        )}
                        {appliedPromo && (
                          <p className="mt-1.5 text-xs font-medium text-[#16A34A]">
                            Applied {appliedPromo.code}: {appliedPromo.label} (-$
                            {appliedPromo.discountAmount.toFixed(2)})
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 'checkout' && (
                <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-5">
                  {checkoutError && (
                    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs font-medium text-[#991B1B]">
                      {checkoutError}
                    </div>
                  )}

                  {/* Shipping & Contact */}
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {t('cart.step1Title')}
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[#475569]">
                          {t('cart.fullNameLabel')}
                        </label>
                        <input
                          required
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Jordan Reyes"
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#475569]">
                          {t('cart.emailLabel')} <span className="font-normal text-[#94A3B8]">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="jordan@example.com"
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        {t('cart.phoneLabel')}
                      </label>
                      <input
                        required
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+1 (415) 555-0192"
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        {t('cart.addressLabel')}
                      </label>
                      <input
                        required
                        type="text"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="742 Market Street, Apt 4B"
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#475569]">{t('cart.cityLabel')}</label>
                      <input
                        required
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="San Francisco"
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        {t('cart.notesLabel')}
                      </label>
                      <input
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Floor 3, call upon arrival"
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-3 border-t border-[#E6ECF4] pt-4">
                    <h3 className="font-display text-sm font-bold text-[#0F1B2D]">
                      {t('cart.step2Title')}
                    </h3>

                    <div className="flex items-start gap-3 rounded-xl border border-[#1180E1]/30 bg-[#1180E1]/5 p-4 text-xs text-[#475569]">
                      <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-[#1180E1]" />
                      <div>
                        <p className="font-semibold text-[#0F1B2D]">{t('cart.codTitle')}</p>
                        <p className="mt-1">{t('cart.codDesc')}</p>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {step === 'preparing' && confirmedOrder && (
                <div className="flex h-full min-h-[380px] flex-col items-center justify-center py-10 text-center">
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    <motion.span
                      animate={{ scale: [1, 1.28, 1], opacity: [0.35, 0.08, 0.35] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      className={`absolute inset-0 rounded-full ${
                        prepStage >= 2 ? 'bg-[#16A34A]' : 'bg-[#1180E1]'
                      }`}
                    />
                    <motion.div
                      animate={prepStage >= 2 ? { scale: [0.92, 1.06, 1] } : { scale: 1 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-colors duration-300 ${
                        prepStage >= 2 ? 'bg-[#16A34A]' : 'bg-[#0F1B2D]'
                      }`}
                    >
                      {prepStage < 2 ? (
                        <motion.svg
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="h-7 w-7 text-[#3C9BF0]"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeOpacity="0.22"
                            strokeWidth="2.5"
                          />
                          <path
                            d="M12 3a9 9 0 0 1 9 9"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </motion.svg>
                      ) : (
                        <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none">
                          <motion.path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                          />
                        </svg>
                      )}
                    </motion.div>
                  </div>

                  <motion.h3
                    key={prepStage}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 font-display text-xl font-bold text-[#0F1B2D]"
                  >
                    {prepStage === 0
                      ? t('cart.preparingOrder')
                      : prepStage === 1
                      ? t('cart.formattingInvoice')
                      : t('cart.orderConfirmed')}
                  </motion.h3>

                  <p className="mt-1.5 max-w-xs text-xs text-[#6B7A8D]">
                    {prepStage < 2
                      ? t('cart.reservingItems')
                      : t('cart.redirectingWhatsapp')}
                  </p>

                  {/* Micro-interaction Progress Steps */}
                  <div className="mt-6 w-full max-w-xs space-y-2 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5 text-left text-xs">
                    {[
                      { label: t('cart.stepInventory'), done: prepStage >= 1 },
                      { label: t('cart.stepInvoice'), done: prepStage >= 2 },
                      { label: t('cart.stepWhatsapp'), done: prepStage >= 2 },
                    ].map((st) => (
                      <div key={st.label} className="flex items-center gap-2.5">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                            st.done
                              ? 'bg-[#16A34A] text-white'
                              : 'border border-[#CBD8EA] bg-white text-[#94A3B8]'
                          }`}
                        >
                          {st.done ? '✓' : '·'}
                        </span>
                        <span className={st.done ? 'font-semibold text-[#0F1B2D]' : 'text-[#6B7A8D]'}>
                          {st.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 'receipt' && confirmedOrder && (
                <div className="space-y-4 py-1">
                  <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#16A34A]" />
                      <div>
                        <p className="font-display text-sm font-bold text-[#0F1B2D]">
                          {t('cart.receiptTitle')} ({confirmedOrder.orderNumber})
                        </p>
                        <p className="mt-1 text-xs text-[#166534]">
                          {t('cart.receiptDesc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Primary WhatsApp Redirect + Invoice Export Actions */}
                  <div className="space-y-2">
                    <a
                      href={buildWhatsAppUrl(whatsappNumber, confirmedOrder)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#15803D]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{t('cart.sendWhatsapp')}</span>
                    </a>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => downloadOrderInvoiceImage(confirmedOrder)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-[#1180E1]" />
                        <span>{t('cart.invoicePng')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5 text-[#1180E1]" />
                        <span>{t('cart.savePdf')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(buildWhatsAppOrderMessage(confirmedOrder));
                          setCopiedMsg(true);
                          setTimeout(() => setCopiedMsg(false), 1600);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
                      >
                        {copiedMsg ? (
                          <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-[#1180E1]" />
                        )}
                        <span>{copiedMsg ? t('cart.copied') : t('cart.copyText')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Clean Invoice Sheet Preview (PDF / Image layout) */}
                  <div className="print-invoice-area overflow-hidden rounded-xl border border-[#CBD8EA] bg-white">
                    <div className="flex items-center justify-between bg-[#0F1B2D] px-4 py-3 text-white">
                      <div>
                        <p className="font-display text-sm font-bold tracking-tight">
                          SAM BRAND STORE
                        </p>
                        <p className="text-[10px] text-[#3C9BF0]">{t('cart.invoiceHeader')}</p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="text-xs font-bold">{confirmedOrder.orderNumber}</p>
                        <p className="text-[10px] text-[#CBD5E1]">
                          {confirmedOrder.transactionRef}
                        </p>
                      </div>
                    </div>

                    <div className="border-b border-[#E6ECF4] bg-[#F7FAFD] px-4 py-3 text-xs space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1180E1]">
                        {t('cart.customerLocation')}
                      </p>
                      <p className="font-semibold text-[#0F1B2D]">
                        {t('cart.nameLabel')} {confirmedOrder.customerName}
                      </p>
                      <p className="text-[#475569]">{t('cart.phoneLabelInv')} {confirmedOrder.customerPhone}</p>
                      <p className="text-[#475569]">{t('cart.emailLabelInv')} {confirmedOrder.customerEmail}</p>
                      <p className="text-[#475569]">
                        {t('cart.locationLabel')} {confirmedOrder.shippingAddress}, {confirmedOrder.city}{' '}
                      </p>
                      {confirmedOrder.notes && (
                        <p className="text-[#475569]">{t('cart.notesLabelInv')} {confirmedOrder.notes}</p>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      <div className="flex justify-between border-b border-[#E6ECF4] pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">
                        <span>{t('cart.itemHeader')}</span>
                        <span>{t('cart.qtyPrice')}</span>
                      </div>
                      <div className="divide-y divide-[#F1F5F9]">
                        {confirmedOrder.items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 py-2.5 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-[#0F1B2D]">
                                {idx + 1}. {item.productName}
                              </p>
                              <p className="text-[11px] text-[#6B7A8D]">
                                {item.variantLabel} · {item.sku}
                              </p>
                            </div>
                            <div className="text-right font-mono shrink-0 tabular-nums">
                              <p className="text-[11px] text-[#6B7A8D]">
                                {item.quantity} × ${item.unitPrice.toFixed(2)}
                              </p>
                              <p className="font-semibold text-[#0F1B2D]">
                                ${item.lineTotal.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 space-y-1 border-t border-[#E6ECF4] pt-2.5 text-xs text-[#475569]">
                        <div className="flex justify-between">
                          <span>{t('cart.subtotalLine')}</span>
                          <span className="font-mono tabular-nums">
                            ${confirmedOrder.subtotal.toFixed(2)}
                          </span>
                        </div>
                        {confirmedOrder.discountAmount > 0 && (
                          <div className="flex justify-between text-[#16A34A]">
                            <span>{t('cart.discountLine')}</span>
                            <span className="font-mono tabular-nums">
                              -${confirmedOrder.discountAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>{t('cart.shippingLine')}</span>
                          <span className="font-mono tabular-nums">
                            {confirmedOrder.shippingCost === 0
                              ? t('cart.free')
                              : `$${confirmedOrder.shippingCost.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('cart.taxLine')}</span>
                          <span className="font-mono tabular-nums">
                            ${confirmedOrder.taxAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-[#E6ECF4] pt-2 text-sm font-bold text-[#0F1B2D]">
                          <span>{t('cart.totalLine')} ({confirmedOrder.paymentMethod.toUpperCase()})</span>
                          <span className="font-mono tabular-nums">
                            ${confirmedOrder.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Totals & CTA */}
            {items.length > 0 && step !== 'receipt' && step !== 'preparing' && (
              <div className="border-t border-[#E6ECF4] bg-[#F7FAFD] px-6 py-4 space-y-3">
                <div className="space-y-1 text-xs text-[#475569]">
                  <div className="flex justify-between">
                    <span>{t('cart.subtotalLine')}</span>
                    <span className="font-mono tabular-nums">${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#16A34A]">
                      <span>{t('cart.promoAppliedLine')} ({appliedPromo?.code})</span>
                      <span className="font-mono tabular-nums">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t('cart.expressShipping')}</span>
                    <span className="font-mono tabular-nums">
                      {shippingCost === 0 ? t('cart.free') : `$${shippingCost.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('cart.estimatedTax')}</span>
                    <span className="font-mono tabular-nums">${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#E6ECF4] pt-2 text-sm font-bold text-[#0F1B2D]">
                    <span>{t('cart.totalLine')}</span>
                    <span className="font-mono tabular-nums">${total.toFixed(2)}</span>
                  </div>
                </div>

                {step === 'bag' ? (
                  <button
                    type="button"
                    onClick={() => setStep('checkout')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1180E1] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0D6BC0] cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{t('cart.proceedCheckout')}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-50 cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>
                      {submitting
                        ? t('cart.submitting')
                        : `${t('cart.completeOrder')} · $${total.toFixed(2)}`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
