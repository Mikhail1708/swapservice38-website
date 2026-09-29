export const INVOICE_TIME_ZONE = 'Asia/Irkutsk';
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: INVOICE_TIME_ZONE,
  weekday: 'short',
});

/**
 * Excludes the issue day; adds Mon-Fri days preserving the local issue time.
 * Irkutsk uses UTC+08 without DST for current invoice dates. National holidays
 * are intentionally not included in this first version of the calendar.
 */
export function addInvoiceBusinessDays(issuedAt: Date, days = 3): Date {
  if (!Number.isFinite(issuedAt.getTime())) throw new Error('Invalid invoice issue date');
  if (!Number.isSafeInteger(days) || days < 0 || days > 3660) {
    throw new Error('Invalid business day count');
  }
  const dueAt = new Date(issuedAt.getTime());
  let added = 0;
  while (added < days) {
    dueAt.setUTCDate(dueAt.getUTCDate() + 1);
    if (!Number.isFinite(dueAt.getTime())) throw new Error('Invoice due date is out of range');
    const weekday = weekdayFormatter.format(dueAt);
    if (weekday !== 'Sat' && weekday !== 'Sun') added += 1;
  }
  return dueAt;
}

export function calculateInvoiceDueAt(issuedAt: Date): Date {
  return addInvoiceBusinessDays(issuedAt, 3);
}
