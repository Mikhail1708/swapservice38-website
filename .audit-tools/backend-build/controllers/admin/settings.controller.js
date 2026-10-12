"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMaintenanceStatus = exports.updateSettings = exports.getSettings = void 0;
const logger_1 = require("../../config/logger");
const prisma_1 = require("../../config/prisma");
const defaults = {
    siteName: 'SWAPSERVICE38',
    siteDescription: 'Тюнинг и обслуживание внедорожников',
    contactPhone: '+7 (914) 895-58-88',
    contactEmail: 'swapservice38@yandex.ru',
    contactAddress: 'г. Иркутск, ул. Новаторов 36',
    workingHours: 'Ежедневно с 10:00 до 20:00',
    maintenanceMode: 'false',
    maintenanceMessage: 'Сайт на техническом обслуживании. Приносим извинения за неудобства.',
};
const allowedKeys = new Set(Object.keys(defaults));
const maxLengths = {
    siteName: 120,
    siteDescription: 500,
    contactPhone: 40,
    contactEmail: 254,
    contactAddress: 500,
    workingHours: 200,
    maintenanceMode: 5,
    maintenanceMessage: 2000,
};
const validateSettingsPayload = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: 'Некорректный формат настроек' };
    }
    const values = {};
    for (const [rawKey, rawValue] of Object.entries(body)) {
        if (!allowedKeys.has(rawKey)) {
            return { ok: false, error: `Неизвестная настройка: ${rawKey}` };
        }
        const key = rawKey;
        if (typeof rawValue !== 'string') {
            return { ok: false, error: `Настройка ${key} должна быть строкой` };
        }
        if (rawValue.length > maxLengths[key]) {
            return { ok: false, error: `Слишком длинное значение настройки ${key}` };
        }
        if (key === 'maintenanceMode' && rawValue !== 'true' && rawValue !== 'false') {
            return { ok: false, error: 'maintenanceMode может быть только true или false' };
        }
        if (key === 'contactEmail' && rawValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue)) {
            return { ok: false, error: 'Некорректный contactEmail' };
        }
        values[key] = rawValue.trim();
    }
    return { ok: true, values };
};
const getSettings = async (_req, res) => {
    try {
        const settings = await prisma_1.prisma.setting.findMany({
            where: { key: { in: [...allowedKeys] } },
        });
        const settingsObj = {};
        settings.forEach((setting) => {
            settingsObj[setting.key] = setting.value;
        });
        res.json({ ...defaults, ...settingsObj });
    }
    catch (error) {
        logger_1.log.error('Get settings error', { error: error.message });
        res.status(500).json({ error: 'Ошибка получения настроек' });
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    try {
        const validation = validateSettingsPayload(req.body);
        if (validation.ok === false) {
            res.status(400).json({ error: validation.error });
            return;
        }
        const entries = Object.entries(validation.values);
        await prisma_1.prisma.$transaction(entries.map(([key, value]) => prisma_1.prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        })));
        logger_1.log.info('Настройки обновлены', { keys: entries.map(([key]) => key) });
        res.json({ success: true, message: 'Настройки сохранены' });
    }
    catch (error) {
        logger_1.log.error('Update settings error', { error: error.message });
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
};
exports.updateSettings = updateSettings;
const getMaintenanceStatus = async (_req, res) => {
    try {
        const settings = await prisma_1.prisma.setting.findMany({
            where: { key: { in: ['maintenanceMode', 'maintenanceMessage'] } },
        });
        const values = new Map(settings.map((setting) => [setting.key, setting.value]));
        res.json({
            maintenanceMode: values.get('maintenanceMode') === 'true',
            message: values.get('maintenanceMessage') || defaults.maintenanceMessage,
        });
    }
    catch (error) {
        logger_1.log.error('Get maintenance status error', { error: error.message });
        res.json({ maintenanceMode: false, message: '' });
    }
};
exports.getMaintenanceStatus = getMaintenanceStatus;
//# sourceMappingURL=settings.controller.js.map