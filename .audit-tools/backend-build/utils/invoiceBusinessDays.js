"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVOICE_TIME_ZONE = void 0;
exports.addInvoiceBusinessDays = addInvoiceBusinessDays;
exports.calculateInvoiceDueAt = calculateInvoiceDueAt;
exports.INVOICE_TIME_ZONE = 'Asia/Irkutsk';
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: exports.INVOICE_TIME_ZONE,
    weekday: 'short',
});
/**
 * Excludes the issue day; adds Mon-Fri days preserving the local issue time.
 * Irkutsk uses UTC+08 without DST for current invoice dates. National holidays
 * are intentionally not included in this first version of the calendar.
 */
function addInvoiceBusinessDays(issuedAt, days = 3) {
    if (!Number.isFinite(issuedAt.getTime()))
        throw new Error('Invalid invoice issue date');
    if (!Number.isSafeInteger(days) || days < 0 || days > 3660) {
        throw new Error('Invalid business day count');
    }
    const dueAt = new Date(issuedAt.getTime());
    let added = 0;
    while (added < days) {
        dueAt.setUTCDate(dueAt.getUTCDate() + 1);
        if (!Number.isFinite(dueAt.getTime()))
            throw new Error('Invoice due date is out of range');
        const weekday = weekdayFormatter.format(dueAt);
        if (weekday !== 'Sat' && weekday !== 'Sun')
            added += 1;
    }
    return dueAt;
}
function calculateInvoiceDueAt(issuedAt) {
    return addInvoiceBusinessDays(issuedAt, 3);
}
//# sourceMappingURL=invoiceBusinessDays.js.map