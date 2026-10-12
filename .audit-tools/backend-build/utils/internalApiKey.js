"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInternalApiKey = void 0;
const getInternalApiKey = () => {
    const apiKey = process.env.INTERNAL_API_KEY;
    if (!apiKey)
        throw new Error('INTERNAL_API_KEY is not configured');
    return apiKey;
};
exports.getInternalApiKey = getInternalApiKey;
//# sourceMappingURL=internalApiKey.js.map