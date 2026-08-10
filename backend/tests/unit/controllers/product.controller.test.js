"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductsByCategory = exports.getCategories = exports.getProductById = exports.getProducts = void 0;
const axios_1 = __importDefault(require("axios"));
const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:5000';
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
        id: item.id || item.productId || 0,
        name: item.name || 'Товар',
        description: item.description || '',
        price: item.price || item.retail_price || 0,
        oldPrice: item.oldPrice || item.old_price || null,
        category: item.category || item.categories?.[0]?.name || '',
        categories: item.categories || [],
        inStock: item.inStock !== undefined ? item.inStock : (item.stock || 0) > 0,
        stock: item.stock || 0,
        sku: item.sku || item.article || '',
        images: images,
        image_url: images[0] || '',
        characteristics: item.characteristics || {},
        features: item.features || [],
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        views: item.views || 0,
        ordersCount: item.ordersCount || 0,
        popularity: item.popularity || 0,
    };
};
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
const getProducts = async (req, res) => {
    try {
        const { category, search, page = '1', limit = '16', sort } = req.query;
        console.log('📦 Запрос товаров из CRM');
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
            params: { category, search, page, limit },
            timeout: 10000,
        });
        const normalizedData = normalizeProducts(response.data);
        res.json(normalizedData);
    }
    catch (error) {
        console.error('❌ Ошибка получения товаров:', error);
        res.status(500).json({
            error: 'Ошибка получения товаров',
            details: error.message
        });
    }
};
exports.getProducts = getProducts;
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📦 Запрос товара ${id} из CRM`);
        const response = await axios_1.default.get(`${CRM_API_URL}/api/public/products/${id}`, {
            timeout: 10000,
        });
        const normalizedProduct = normalizeProduct(response.data);
        res.json(normalizedProduct);
    }
    catch (error) {
        console.error(`❌ Ошибка получения товара ${req.params.id}:`, error);
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'Товар не найден' });
            return;
        }
        res.status(500).json({
            error: 'Ошибка получения товара',
            details: error.message
        });
    }
};
exports.getProductById = getProductById;
const getCategories = async (req, res) => {
    try {
        console.log('📦 Запрос категорий из CRM');
        let categories = [];
        try {
            const response = await axios_1.default.get(`${CRM_API_URL}/api/public/categories`, {
                timeout: 5000,
            });
            let data = response.data;
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
            console.log(`✅ Получено ${categories.length} категорий из CRM`);
        }
        catch (error) {
            console.warn('⚠️ CRM недоступна, получаем категории из товаров');
            try {
                const productsResponse = await axios_1.default.get(`${CRM_API_URL}/api/public/products`, {
                    params: { limit: 100 },
                    timeout: 3000,
                });
                const products = productsResponse.data?.items || productsResponse.data || [];
                // ✅ ИСПРАВЛЕНО: ЯВНОЕ ПРИВЕДЕНИЕ К STRING[]
                const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))];
                categories = uniqueCategories;
                console.log(`✅ Получено ${categories.length} категорий из товаров`);
            }
            catch (fallbackError) {
                console.warn('⚠️ Не удалось получить категории');
                categories = [];
            }
        }
        res.json({ categories });
    }
    catch (error) {
        console.error('❌ Ошибка получения категорий:', error);
        res.json({ categories: [] });
    }
};
exports.getCategories = getCategories;
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
        console.error(`❌ Ошибка получения товаров по категории ${req.params.category}:`, error);
        res.status(500).json({ error: 'Ошибка получения товаров' });
    }
};
exports.getProductsByCategory = getProductsByCategory;
//# sourceMappingURL=product.controller.test.js.map