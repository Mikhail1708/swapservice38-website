"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAddressSuggestions = void 0;
const axios_1 = __importDefault(require("axios"));
const getAddressSuggestions = async (query) => {
    const apiKey = process.env.DADATA_API_KEY;
    if (!apiKey)
        throw new Error('DADATA_NOT_CONFIGURED');
    const response = await axios_1.default.post('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        query,
        count: 6,
        from_bound: { value: 'street' },
        to_bound: { value: 'house' },
    }, {
        timeout: 5000,
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    });
    const items = Array.isArray(response.data?.suggestions) ? response.data.suggestions : [];
    return items.slice(0, 6).flatMap((item) => {
        if (!item || typeof item.value !== 'string')
            return [];
        const data = item.data && typeof item.data === 'object' ? item.data : {};
        return [{
                value: item.value,
                unrestricted_value: typeof item.unrestricted_value === 'string' ? item.unrestricted_value : item.value,
                data: {
                    postal_code: data.postal_code,
                    country: data.country,
                    region: data.region,
                    city: data.city,
                    street: data.street,
                    house: data.house,
                    flat: data.flat,
                    geo_lat: data.geo_lat,
                    geo_lon: data.geo_lon,
                },
            }];
    });
};
exports.getAddressSuggestions = getAddressSuggestions;
//# sourceMappingURL=addressSuggestions.service.js.map