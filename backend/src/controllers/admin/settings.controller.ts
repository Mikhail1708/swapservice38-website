// backend/src/controllers/admin/settings.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { log } from '../../config/logger';

const prisma = new PrismaClient();

// ============================================================
// GET /api/admin/settings — получить все настройки
// ============================================================
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.setting.findMany();
    
    // Превращаем массив в объект { key: value }
    const settingsObj: Record<string, string> = {};
    settings.forEach((s) => {
      settingsObj[s.key] = s.value;
    });
    
    // Настройки по умолчанию
    const defaults = {
      siteName: 'SWAP SERVICE 38',
      siteDescription: 'Тюнинг и обслуживание внедорожников',
      contactPhone: '+7 (914) 895-58-88',
      contactEmail: 'swapservice38@yandex.ru',
      contactAddress: 'г. Иркутск, ул. Новаторов 36',
      workingHours: 'Ежедневно с 10:00 до 20:00',
      maintenanceMode: 'false',
      maintenanceMessage: 'Сайт на техническом обслуживании. Приносим извинения за неудобства.',
    };
    
    // Объединяем с дефолтами (если чего-то нет в БД)
    const result = { ...defaults, ...settingsObj };
    
    res.json(result);
  } catch (error: any) {
    log.error('❌ Get settings error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения настроек' });
  }
};

// ============================================================
// PUT /api/admin/settings — обновить настройки
// ============================================================
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = req.body;
    
    // Обновляем каждую настройку
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string') {
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }
    
    log.info('📝 Настройки обновлены');
    res.json({ success: true, message: 'Настройки сохранены' });
  } catch (error: any) {
    log.error('❌ Update settings error', { error: error.message });
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
};

// ============================================================
// GET /api/admin/settings/maintenance — проверить режим обслуживания
// ============================================================
export const getMaintenanceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'maintenanceMode' },
    });
    
    const isMaintenance = setting?.value === 'true';
    const message = await prisma.setting.findUnique({
      where: { key: 'maintenanceMessage' },
    });
    
    res.json({
      maintenanceMode: isMaintenance,
      message: message?.value || 'Сайт на техническом обслуживании. Приносим извинения за неудобства.',
    });
  } catch (error: any) {
    log.error('❌ Get maintenance status error', { error: error.message });
    res.json({ maintenanceMode: false, message: '' });
  }
};