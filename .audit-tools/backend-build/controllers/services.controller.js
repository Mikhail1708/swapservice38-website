"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicServiceById = exports.getPublicServices = void 0;
const prisma_1 = require("../config/prisma");
// GET /api/services — список услуг
const getPublicServices = async (req, res) => {
    try {
        const services = await prisma_1.prisma.service.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ services });
    }
    catch (error) {
        console.error('❌ Ошибка получения услуг:', error);
        res.status(500).json({ error: 'Ошибка получения услуг' });
    }
};
exports.getPublicServices = getPublicServices;
// GET /api/services/:id — одна услуга
const getPublicServiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await prisma_1.prisma.service.findUnique({
            where: { id },
        });
        if (!service) {
            return res.status(404).json({ error: 'Услуга не найдена' });
        }
        // Если услуга не активна — возвращаем 404 (для публичных пользователей)
        if (!service.isActive) {
            return res.status(404).json({ error: 'Услуга не найдена' });
        }
        res.json({ service });
    }
    catch (error) {
        console.error('❌ Ошибка получения услуги:', error);
        res.status(500).json({ error: 'Ошибка получения услуги' });
    }
};
exports.getPublicServiceById = getPublicServiceById;
//# sourceMappingURL=services.controller.js.map