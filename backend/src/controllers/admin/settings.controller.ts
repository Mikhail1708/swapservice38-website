// backend/src/controllers/admin/settings.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { log } from '../../config/logger';

const prisma = new PrismaClient();

const defaults = {
  siteName: 'SWAP SERVICE 38',
  siteDescription: 'Тюнинг и обслуживание внедорожников',
  contactPhone: '+7 (914) 895-58-88',
  contactEmail: 'swapservice38@yandex.ru',
  contactAddress: 'г. Иркутск, ул. Новаторов 36',
  workingHours: 'Ежедневно с 10:00 до 20:00',
  maintenanceMode: 'false',
  maintenanceMessage: 'Сайт на техническом обслуживании. Приносим извинения за неудобства.',
} as const;

type SettingKey = keyof typeof defaults;
const allowedKeys = new Set<SettingKey>(Object.keys(defaults) as SettingKey[]);
const maxLengths: Record<SettingKey, number> = {
  siteName: 120,
  siteDescription: 500,
  contactPhone: 40,
  contactEmail: 254,
  contactAddress: 500,
  workingHours: 200,
  maintenanceMode: 5,
  maintenanceMessage: 2000,
};

const validateSettingsPayload = (body: unknown): { ok: true; values: Record<SettingKey, string> | Partial<Record<SettingKey, string>> } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Некорректный формат настроек' };
  }

  const values: Partial<Record<SettingKey, string>> = {};
  for (const [rawKey, rawValue] of Object.entries(body as Record<string, unknown>)) {
    if (!allowedKeys.has(rawKey as SettingKey)) {
      return { ok: false, error: `Неизвестная настройка: ${rawKey}` };
    }
    const key = rawKey as SettingKey;
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

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: [...allowedKeys] } },
    });
    const settingsObj: Record<string, string> = {};
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value;
    });
    res.json({ ...defaults, ...settingsObj });
  } catch (error: any) {
    log.error('Get settings error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения настроек' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = validateSettingsPayload(req.body);
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const entries = Object.entries(validation.values) as Array<[SettingKey, string]>;
    await prisma.$transaction(entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    ));

    log.info('Настройки обновлены', { keys: entries.map(([key]) => key) });
    res.json({ success: true, message: 'Настройки сохранены' });
  } catch (error: any) {
    log.error('Update settings error', { error: error.message });
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
};

export const getMaintenanceStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['maintenanceMode', 'maintenanceMessage'] } },
    });
    const values = new Map(settings.map((setting) => [setting.key, setting.value]));
    res.json({
      maintenanceMode: values.get('maintenanceMode') === 'true',
      message: values.get('maintenanceMessage') || defaults.maintenanceMessage,
    });
  } catch (error: any) {
    log.error('Get maintenance status error', { error: error.message });
    res.json({ maintenanceMode: false, message: '' });
  }
};
