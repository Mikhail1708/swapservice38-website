"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentHttpTimeoutMs = void 0;
const DEFAULT_PAYMENT_HTTP_TIMEOUT_MS = 15000;
const paymentHttpTimeoutMs = () => {
    const value = process.env.PAYMENT_HTTP_TIMEOUT_MS?.trim();
    if (!value || !/^\d+$/.test(value))
        return DEFAULT_PAYMENT_HTTP_TIMEOUT_MS;
    const milliseconds = Number(value);
    return Number.isSafeInteger(milliseconds) && milliseconds > 0 && milliseconds <= 120000
        ? milliseconds
        : DEFAULT_PAYMENT_HTTP_TIMEOUT_MS;
};
exports.paymentHttpTimeoutMs = paymentHttpTimeoutMs;
//# sourceMappingURL=paymentHttp.js.map