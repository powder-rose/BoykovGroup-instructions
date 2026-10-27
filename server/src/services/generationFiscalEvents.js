import { createFiscalEvent, fiscalEventId } from './fiscalReceiptPayload.js';

export function generationFiscalEvents(order, patch) {
  const events = [...(order.fiscalEvents || [])];
  const context = order.fiscalContext;
  if (!context) return events;
  const add = event => {
    if (!events.some(row => row.id === event.id)) events.push(event);
  };
  const advanceId = fiscalEventId('generation-advance', order.id);
  const settlementId = fiscalEventId('generation-settlement', order.id);
  const base = {
    context,
    sourceId: order.id,
    invoiceId: order.id,
    amountMinor: Math.round(order.amount * 100),
    title: `Формирование инструкции: ${order.profession}`,
    transactionId: order.transactionId,
  };
  if (patch.status === 'paid' && patch.fiscalPaymentLive === true && order.transactionId) {
    add(createFiscalEvent({ ...base, kind: 'generation-advance', createdAt: order.paidAt }));
  }
  if (!events.some(row => row.id === advanceId)) return events;
  if (order.generatedAt && order.generatedInstruction && !order.refundedAt) {
    add(
      createFiscalEvent({
        ...base,
        kind: 'generation-settlement',
        createdAt: order.generatedAt,
        dependsOn: [advanceId],
      }),
    );
  }
  if (patch.status === 'refunded' && order.refundedAt) {
    // A delivered service needs a different return composition and manual review.
    const event = createFiscalEvent({
      ...base,
      kind: 'generation-refund',
      createdAt: order.refundedAt,
      transactionId: order.refundTransactionId,
      dependsOn: [advanceId],
    });
    if (events.some(row => row.id === settlementId))
      event.reviewReason = 'DELIVERED_SERVICE_REFUND';
    add(event);
  }
  return events;
}
