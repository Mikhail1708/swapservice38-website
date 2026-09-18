import { Request, Response } from 'express';

import { prisma } from '../config/prisma';

// GET /api/services — список услуг
export const getPublicServices = async (req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ services });
  } catch (error) {
    console.error('❌ Ошибка получения услуг:', error);
    res.status(500).json({ error: 'Ошибка получения услуг' });
  }
};

// GET /api/services/:id — одна услуга
export const getPublicServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const service = await prisma.service.findUnique({
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
  } catch (error) {
    console.error('❌ Ошибка получения услуги:', error);
    res.status(500).json({ error: 'Ошибка получения услуги' });
  }
};