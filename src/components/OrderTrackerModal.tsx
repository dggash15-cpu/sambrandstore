import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, PackageSearch, CheckCircle2, Truck, Box, ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { getLocalOrderHistory, type LocalOrderSnapshot } from '../lib/visitorHistory';
import type { Order } from '../types';
import { useTranslation } from '../lib/i18n';

interface OrderTrackerModalProps {
  open: boolean;
  onClose: () => void;
  initialOrder?: { orderNumber: string; email: string } | null;
}

const STEPS = [
  { key: 'confirmed', label: 'Confirmed', icon: ClipboardCheck },
  { key: 'packed', label: 'Packed', icon: Box },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
] as const;

export function OrderTrackerModal({ open, onClose, initialOrder }: OrderTrackerModalProps) {
  const { t, translateStatus } = useTranslation();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [savedOrders, setSavedOrders] = useState<LocalOrderSnapshot[]>([]);

  useEffect(() => {
    if (!open) return;
    const history = getLocalOrderHistory();
    setSavedOrders(history);
    if (initialOrder) {
      setOrderNumber(initialOrder.orderNumber);
      setEmail(initialOrder.email);
    } else if (history.length > 0) {
      setOrderNumber(history[0].orderNumber);
      setEmail(history[0].email);
    }
  }, [open, initialOrder]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.trackOrder(orderNumber, email);
      setOrder(res.order);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : 'Order not found.');
    } finally {
      setLoading(false);
    }
  };

  const activeIdx = order
    ? STEPS.findIndex((s) => s.key === order.orderStatus)
    : -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F1B2D]/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-[#E6ECF4] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E6ECF4] pb-4">
              <div className="flex items-center gap-2.5">
                <PackageSearch className="h-5 w-5 text-[#1180E1]" />
                <h2 className="font-display text-lg font-bold text-[#0F1B2D]">
                  {t('track.title')}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#475569] hover:bg-[#F7FAFD] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {savedOrders.length > 0 && (
              <div className="mt-3 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7A8D]">
                  {t('track.recent')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {savedOrders.map((snap) => (
                    <button
                      key={snap.orderNumber}
                      type="button"
                      onClick={() => {
                        setOrderNumber(snap.orderNumber);
                        setEmail(snap.email);
                      }}
                      className="rounded-lg border border-[#D4DFEE] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-[#0F1B2D] hover:border-[#1180E1] hover:text-[#1180E1] transition-colors cursor-pointer"
                    >
                      {snap.orderNumber} · ${snap.total.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleTrack} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-[#475569]">{t('track.orderNumLabel')}</label>
                <input
                  required
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="SBS-1041"
                  className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono text-sm focus:border-[#1180E1] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-7">
                <label className="block text-xs font-medium text-[#475569]">{t('track.emailLabel')}</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jordan@example.com"
                  className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-12">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#0F1B2D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1180E1] transition-colors cursor-pointer"
                >
                  {loading ? t('common.loading') : t('track.button')}
                </button>
              </div>
            </form>

            {error && (
              <p className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
                {error}
              </p>
            )}

            {order && (
              <div className="mt-5 space-y-4 border-t border-[#E6ECF4] pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#0F1B2D]">
                    {order.orderNumber} · {order.transactionRef}
                  </span>
                  <span className="font-semibold capitalize text-[#1180E1]">
                    {translateStatus(order.orderStatus)}
                  </span>
                </div>

                {order.orderStatus !== 'cancelled' && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {STEPS.map((st, idx) => {
                      const Icon = st.icon;
                      const done = idx <= activeIdx;
                      return (
                        <div
                          key={st.key}
                          className={`flex flex-col items-center rounded-xl border p-2.5 text-center ${
                            done
                              ? 'border-[#1180E1]/40 bg-[#F7FAFD] text-[#0F1B2D]'
                              : 'border-[#E6ECF4] text-[#94A3B8]'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${done ? 'text-[#1180E1]' : 'text-[#CBD5E1]'}`} />
                          <span className="mt-1 text-[11px] font-semibold">{translateStatus(st.key)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3.5 text-xs space-y-1.5">
                  {order.items.map((it) => (
                    <div key={it.id} className="flex justify-between">
                      <span>
                        {it.quantity}× {it.productName}
                      </span>
                      <span className="font-mono tabular-nums">${it.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-[#E6ECF4] pt-2 font-bold text-[#0F1B2D]">
                    <span>{t('track.totalLabel')} ({order.paymentStatus === 'refunded' ? t('track.refunded') : order.paymentMethod.toUpperCase()})</span>
                    <span className="font-mono tabular-nums">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
