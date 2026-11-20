import type { Order } from '../types';

export function buildWhatsAppOrderMessage(order: Order): string {
  const dateLabel = new Date(order.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemLines = order.items.map(
    (item, idx) =>
      `${idx + 1}. ${item.productName} (${item.variantLabel})\n   ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.lineTotal.toFixed(2)}`
  );

  const lines = [
    '*SAM BRAND STORE — ORDER INVOICE*',
    `Order No: *${order.orderNumber}*`,
    `Reference: ${order.transactionRef}`,
    `Date: ${dateLabel}`,
    '--------------------------------',
    '*CUSTOMER DETAILS*',
    `Name: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Email: ${order.customerEmail}`,
    `Location: ${order.shippingAddress}, ${order.city}, ${order.postalCode}`,
  ];

  if (order.notes) {
    lines.push(`Delivery Note: ${order.notes}`);
  }

  lines.push(
    '--------------------------------',
    '*ITEMS ORDERED*',
    ...itemLines,
    '--------------------------------',
    `Subtotal: $${order.subtotal.toFixed(2)}`
  );

  if (order.discountAmount > 0) {
    lines.push(`Discount${order.promoCode ? ` (${order.promoCode})` : ''}: -$${order.discountAmount.toFixed(2)}`);
  }

  lines.push(
    `Shipping: ${order.shippingCost === 0 ? 'FREE' : `$${order.shippingCost.toFixed(2)}`}`,
    `Tax (8%): $${order.taxAmount.toFixed(2)}`,
    `*TOTAL: $${order.total.toFixed(2)}*`,
    `Payment: ${order.paymentMethod.toUpperCase()}${order.paymentLast4 ? ` (**** ${order.paymentLast4})` : ''} - ${
      order.paymentStatus === 'paid' ? 'PAID' : 'PAY ON DELIVERY'
    }`
  );

  return lines.join('\n');
}

export function buildWhatsAppUrl(whatsappNumber: string, order: Order): string {
  const digitsOnly = whatsappNumber.replace(/\D/g, '');
  const message = buildWhatsAppOrderMessage(order);
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

export function downloadOrderInvoiceImage(order: Order): void {
  const width = 1080;
  const rowHeight = 64;
  const baseHeight = 620;
  const height = baseHeight + order.items.length * rowHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Top Header Band
  ctx.fillStyle = '#0F1B2D';
  ctx.fillRect(0, 0, width, 150);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px "Outfit", sans-serif';
  ctx.fillText('SAM BRAND STORE', 56, 68);

  ctx.fillStyle = '#3C9BF0';
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('OFFICIAL CUSTOMER ORDER INVOICE', 56, 102);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px "JetBrains Mono", monospace';
  ctx.fillText(order.orderNumber, width - 56, 68);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '16px "JetBrains Mono", monospace';
  ctx.fillText(order.transactionRef, width - 56, 98);
  ctx.textAlign = 'left';

  // Customer Card
  const custY = 182;
  ctx.fillStyle = '#F7FAFD';
  ctx.strokeStyle = '#E6ECF4';
  ctx.lineWidth = 2;
  ctx.fillRect(56, custY, width - 112, 168);
  ctx.strokeRect(56, custY, width - 112, 168);

  ctx.fillStyle = '#1180E1';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CUSTOMER & DELIVERY DETAILS', 80, custY + 34);

  ctx.fillStyle = '#0F1B2D';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Name: ${order.customerName}`, 80, custY + 68);

  ctx.font = '18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Phone: ${order.customerPhone}`, 80, custY + 98);
  ctx.fillText(`Email: ${order.customerEmail}`, 540, custY + 98);
  ctx.fillText(
    `Location: ${order.shippingAddress}, ${order.city} ${order.postalCode}`,
    80,
    custY + 132
  );

  // Table Header
  let y = 388;
  ctx.fillStyle = '#0F1B2D';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ITEM DESCRIPTION', 56, y);
  ctx.textAlign = 'right';
  ctx.fillText('QTY', 690, y);
  ctx.fillText('UNIT PRICE', 850, y);
  ctx.fillText('TOTAL', width - 56, y);
  ctx.textAlign = 'left';

  y += 16;
  ctx.strokeStyle = '#CBD8EA';
  ctx.beginPath();
  ctx.moveTo(56, y);
  ctx.lineTo(width - 56, y);
  ctx.stroke();

  // Line Items
  order.items.forEach((item, index) => {
    const rowY = y + 34 + index * rowHeight;
    ctx.fillStyle = '#0F1B2D';
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${index + 1}. ${item.productName}`, 56, rowY);

    ctx.fillStyle = '#6B7A8D';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${item.variantLabel} · SKU ${item.sku}`, 76, rowY + 22);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F1B2D';
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillText(String(item.quantity), 690, rowY + 6);
    ctx.fillText(`$${item.unitPrice.toFixed(2)}`, 850, rowY + 6);
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(`$${item.lineTotal.toFixed(2)}`, width - 56, rowY + 6);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.moveTo(56, rowY + 34);
    ctx.lineTo(width - 56, rowY + 34);
    ctx.stroke();
  });

  // Totals Footer
  let totY = y + 54 + order.items.length * rowHeight;
  ctx.textAlign = 'right';
  ctx.font = '18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Subtotal:   $${order.subtotal.toFixed(2)}`, width - 56, totY);

  if (order.discountAmount > 0) {
    totY += 28;
    ctx.fillStyle = '#16A34A';
    ctx.fillText(`Discount:   -$${order.discountAmount.toFixed(2)}`, width - 56, totY);
  }

  totY += 28;
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `Shipping:   ${order.shippingCost === 0 ? 'FREE' : `$${order.shippingCost.toFixed(2)}`}`,
    width - 56,
    totY
  );

  totY += 28;
  ctx.fillText(`Tax (8%):   $${order.taxAmount.toFixed(2)}`, width - 56, totY);

  totY += 42;
  ctx.fillStyle = '#0F1B2D';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText(`TOTAL: $${order.total.toFixed(2)}`, width - 56, totY);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#16A34A';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `PAYMENT: ${order.paymentMethod.toUpperCase()} · ${
      order.paymentStatus === 'paid' ? 'VERIFIED PAID' : 'CASH ON DELIVERY'
    }`,
    56,
    totY
  );

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${order.orderNumber}-Sam-Brand-Store-Invoice.png`;
  link.click();
}
