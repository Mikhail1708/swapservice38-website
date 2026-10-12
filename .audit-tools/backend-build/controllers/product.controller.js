"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductsByCategory = exports.getCategories = exports.getProductById = exports.getProducts = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../config/logger");
const productAvailability_1 = require("../utils/productAvailability");
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
// ============================================================
// НОРМАЛИЗАЦИЯ ТОВАРА
// ============================================================
const normalizeProduct = (item) => {
    let images = [];
    if (item.images && Array.isArray(item.images)) {
        images = item.images.filter(Boolean);
    }
    if (images.length === 0 && item.image_url) {
        images = [item.image_url];
    }
    if (images.length === 0) {
        images = ['/images/placeholder.jpg'];
    }
    return {
        id: item.id || item.productId,
        name: item.name || 'Товар',
        description: item.description || '',
        price: item.price || item.retail_price || 0,
        oldPrice: item.oldPrice || item.old_price || null,
        category: item.category || item.categories?.[0]?.name || '',
        categories: item.categories || [],
        ...(0, productAvailability_1.productAvailability)(item),
        sku: item.sku || item.article || '',
        images: images,
        image_url: images[0] || '',
        characteristics: item.characteristics || {},
        features: item.features || [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        views: item.views || 0,
        ordersCount: item.ordersCount || 0,
        popularity: item.popularity || 0,
    };
};
// ============================================================
// НОРМАЛИЗАЦИЯ СПИСКА
// ============================================================
const normalizeProducts = (data) => {
    if (data.items && Array.isArray(data.items)) {
        return {
            ...data,
            items: data.items.map(normalizeProduct),
        };
    }
    if (Array.isArray(data)) {
        return data.map(normalizeProduct);
    }
    return data;
};
// ============================================================
// GET /api/products — БЕЗ КЕША!
// ============================================================
const getProducts = async (req, res) => {
    try {
        const { category, search, page = '1', limit = '16', sort, availability } = req.query;
        if ((availability !== undefined && !['in_stock', 'on_order'].includes(availability))
            || (sort !== undefined && !['price_asc', 'price_desc'].includes(sort))) {
            res.status(400).json({ error: 'Некорректные параметры каталога' });
            return;
        }
        if (availability || sort) {
            const requestedPage = Number(page);
            const requestedLimit = Number(limit);
            if (!Number.isSafeInteger(requestedPage) || requestedPage < 1
                || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 999) {
                res.status(400).json({ error: 'Некорректная страница каталога' });
                return;
            }
            // CRM owns the catalogue but has no availability/price ordering contract.
            // Apply these operations to ALL upstream pages before slicing the SITE page.
            const products = new Map();
            let upstreamPage = 1;
            let totalPages = 1;
            do {
                const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
                    params: { category, search, page: upstreamPage, limit: 999 }, timeout: 10000,
                });
                const data = normalizeProducts(response.data);
                for (const product of data.items || data)
                    products.set(String(product.id), product);
                totalPages = Number.isSafeInteger(data.totalPages) ? Math.max(1, data.totalPages) : 1;
                upstreamPage += 1;
            } while (upstreamPage <= totalPages);
            const items = [...products.values()].filter(product => availability === 'in_stock'
                ? product.stock > 0 : availability === 'on_order' ? product.stock <= 0 : true);
            if (sort === 'price_asc')
                items.sort((a, b) => Number(a.price) - Number(b.price));
            else if (sort === 'price_desc')
                items.sort((a, b) => Number(b.price) - Number(a.price));
            else if (availability === 'in_stock')
                items.sort((a, b) => b.stock - a.stock);
            res.json({ items: items.slice((requestedPage - 1) * requestedLimit, requestedPage * requestedLimit),
                total: items.length, page: requestedPage, limit: requestedLimit,
                totalPages: Math.ceil(items.length / requestedLimit) });
            return;
        }
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
            params: { category, search, page, limit },
            timeout: 10000,
        });
        const normalizedData = normalizeProducts(response.data);
        res.json(normalizedData);
    }
    catch (error) {
        logger_1.log.error('CRM product list request failed', { status: error?.response?.status });
        res.status(500).json({
            error: 'Ошибка получения товаров'
        });
    }
};
exports.getProducts = getProducts;
// ============================================================
// GET /api/products/:id — БЕЗ КЕША!
// ============================================================
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products/${id}`, {
            timeout: 10000,
        });
        const normalizedProduct = normalizeProduct(response.data);
        res.json(normalizedProduct);
    }
    catch (error) {
        logger_1.log.error('CRM product request failed', { status: error?.response?.status });
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Товар не найден' });
            return;
        }
        res.status(500).json({
            error: 'Ошибка получения товара'
        });
    }
};
exports.getProductById = getProductById;
// ============================================================
// GET /api/products/categories — БЕЗ КЕША!
// ============================================================
const getCategories = async (req, res) => {
    try {
        let categories = [];
        let categoryCounts = [];
        try {
            const response = await axios_1.default.get(`${CRM_API_URL}/api/public/categories`, {
                timeout: 5000,
            });
            let data = response.data;
            const rows = Array.isArray(data) ? data : data?.categories || data?.data || data?.items;
            if (Array.isArray(rows)) {
                categoryCounts = rows.filter((c) => typeof c?.name === 'string' && c.name.trim() &&
                    Number.isSafeInteger(c?._count?.products) && c._count.products >= 0)
                    .map((c) => ({ name: c.name, productCount: c._count.products }));
            }
            if (Array.isArray(data)) {
                categories = data.map((c) => c.name || c).filter(Boolean);
            }
            else if (data.categories && Array.isArray(data.categories)) {
                categories = data.categories.map((c) => c.name || c).filter(Boolean);
            }
            else if (data.data && Array.isArray(data.data)) {
                categories = data.data.map((c) => c.name || c).filter(Boolean);
            }
            else if (data.items && Array.isArray(data.items)) {
                categories = data.items.map((c) => c.name || c).filter(Boolean);
            }
        }
        catch (error) {
            // Footer needs authoritative counts, never counts inferred from a product page.
            if (req.query.includeCounts === 'true') {
                res.json({ categories: [], categoryCounts: [] });
                return;
            }
            console.warn('⚠️ CRM недоступна, получаем категории из товаров');
            try {
                const productsResponse = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
                    params: { limit: 100 },
                    timeout: 3000,
                });
                const products = productsResponse.data?.items || productsResponse.data || [];
                const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))];
                categories = uniqueCategories;
            }
            catch (fallbackError) {
                console.warn('⚠️ Не удалось получить категории');
                categories = [];
            }
        }
        res.json({ categories, ...(req.query.includeCounts === 'true' ? { categoryCounts } : {}) });
    }
    catch (error) {
        logger_1.log.error('CRM category request failed', { status: error?.response?.status });
        res.json({ categories: [] });
    }
};
exports.getCategories = getCategories;
// ============================================================
// GET /api/products/category/:category
// ============================================================
const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
            params: { category },
            timeout: 10000,
        });
        const normalizedData = normalizeProducts(response.data);
        res.json(normalizedData);
    }
    catch (error) {
        logger_1.log.error('CRM category product request failed', { status: error?.response?.status });
        res.status(500).json({ error: 'Ошибка получения товаров' });
    }
};
exports.getProductsByCategory = getProductsByCategory;
//# sourceMappingURL=product.controller.js.map