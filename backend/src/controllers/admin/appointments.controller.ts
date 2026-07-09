// backend/src/controllers/admin/appointments.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    console.log('📋 GET /api/admin/appointments', { page: pageNum, limit: limitNum });

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        include: { user: true, service: true },
        orderBy: { dateTime: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.appointment.count(),
    ]);

    console.log(`✅ Найдено ${appointments.length} записей, всего ${total}`);

    res.json({
      appointments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('❌ Get appointments error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения записей' });
  }
};

export const getAppointmentsCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { user: true, service: true },
      orderBy: { dateTime: 'asc' },
    });
    res.json({ appointments });
  } catch (error: any) {
    console.error('❌ Get calendar error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAppointmentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { user: true, service: true },
    });
    if (!appointment) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    res.json({ appointment });
  } catch (error: any) {
    console.error('❌ Get appointment error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, dateTime, assignedTo, comment } = req.body;
    const data: any = {};
    if (status) data.status = status;
    if (dateTime) data.dateTime = new Date(dateTime);
    if (assignedTo !== undefined) data.assignedTo = assignedTo;
    if (comment !== undefined) data.comment = comment;
    const appointment = await prisma.appointment.update({
      where: { id },
      data,
      include: { user: true, service: true },
    });
    res.json({ success: true, appointment });
  } catch (error: any) {
    console.error('❌ Update appointment error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, serviceId, dateTime, carInfo, comment } = req.body;
    const appointment = await prisma.appointment.create({
      data: {
        userId,
        serviceId,
        dateTime: new Date(dateTime),
        carInfo: carInfo || null,
        comment: comment || null,
        status: 'pending',
      },
      include: { user: true, service: true },
    });
    res.status(201).json({ success: true, appointment });
  } catch (error: any) {
    console.error('❌ Create appointment error:', error);
    res.status(500).json({ error: error.message });
  }
};