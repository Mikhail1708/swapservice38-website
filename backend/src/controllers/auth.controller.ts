import { Request, Response } from 'express';
import { register, verifyEmail, login, getUserById } from '../services/auth.service';

export const registerController = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const result = await register(email, password, firstName, lastName);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const verifyController = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const result = await verifyEmail(email, code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await login(email, password);

    // Устанавливаем HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    res.json({ user });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const logoutController = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Выход выполнен' });
};

export const meController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    const user = await getUserById(userId);
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};