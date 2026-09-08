// backend/tests/unit/controllers/auth.controller.test.ts
import { Request, Response } from 'express';
import express from 'express';
import supertest from 'supertest';
import { validate } from '../../../src/middleware/validate.middleware';
import { registerSchema } from '../../../src/schemas/auth.schema';
import { personalDataAcceptance } from '../../helpers/consent';
import { PrismaClient } from '@prisma/client';
import {
  registerController,
  consentStatusController,
  consentDocumentsController,
  loginController,
  logoutController,
  meController,
  updateProfileController,
  changePasswordController,
  requestPasswordChangeController,
  confirmPasswordChangeController,
  requestPasswordResetController,
  verifyResetCodeController,
  confirmResetPasswordController,
  resendVerificationController,
  mergeCart,
} from '../../../src/controllers/auth.controller';
import * as authService from '../../../src/services/auth.service';

jest.mock('../../../src/services/auth.service');
const prisma = new PrismaClient() as any;

const mockRequest = (body: any = {}, user: any = null, cookies: any = {}): Partial<Request> => {
  const req: Partial<Request> = {
    body,
    cookies,
    headers: {},
  };
  if (user) {
    (req as any).user = user;
  }
  return req;
};

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('consent status', () => {
    it.each([null, { id: 'consent-1', userId: 'user-1', acceptedAt: new Date() }])('returns minimal authenticated status for %p', async (stored) => {
      prisma.userConsent.findUnique.mockResolvedValue(stored);
      const res = mockResponse();
      await consentStatusController(mockRequest({}, { id: 'user-1' }) as Request, res as Response);
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.json).toHaveBeenCalledWith({ documents: expect.any(Object), requiresPersonalDataConsent: !stored });
    });
    it('denies anonymous status access and does not read any consent', async () => {
      const res = mockResponse();
      await consentStatusController(mockRequest() as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(prisma.userConsent.findUnique).not.toHaveBeenCalled();
    });
    it('fails closed with a safe response when consent storage is unavailable', async () => {
      prisma.userConsent.findUnique.mockRejectedValueOnce(new Error('internal connection details'));
      const res = mockResponse();
      await consentStatusController(mockRequest({}, { id: 'user-1' }) as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ code: 'CONSENT_UNAVAILABLE', error: expect.not.stringContaining('internal') });
    });
    it('provides public document versions without personal consent records', () => {
      const res = mockResponse();
      consentDocumentsController(mockRequest() as Request, res as Response);
      expect(res.json).toHaveBeenCalledWith({ documents: expect.objectContaining({ personalDataVersion: '2026-09-07', offerVersion: '2026-09-07' }) });
      expect(prisma.userConsent.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('registerController', () => {
    it('HTTP registration rejects missing consent before the service and forwards explicit evidence', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/auth/register', validate(registerSchema), registerController);
      const body = { email: 'test@example.com', password: 'Test1234!' };
      const denied = await supertest(app).post('/api/auth/register').send(body);
      expect(denied.status).toBe(400);
      expect(denied.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'personalDataConsent' })]));
      expect(authService.register).not.toHaveBeenCalled();
      (authService.register as jest.Mock).mockResolvedValue({ message: 'Код отправлен на почту' });
      const accepted = await supertest(app).post('/api/auth/register').send({ ...body, personalDataConsent: personalDataAcceptance });
      expect(accepted.status).toBe(201);
      expect(authService.register).toHaveBeenCalledWith(body.email, body.password, undefined, undefined, undefined, personalDataAcceptance);
    });
    it('should register user and return 201', async () => {
      const req = mockRequest({
        email: 'test@example.com',
        password: 'Test1234!',
        firstName: 'Test',
        lastName: 'User',
      });
      const res = mockResponse();

      (authService.register as jest.Mock).mockResolvedValue({
        message: 'Код отправлен на почту',
      });

      await registerController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Код отправлен на почту',
      });
    });

    it('does not expose an unexpected registration failure', async () => {
      const req = mockRequest({ email: 'test@example.com' });
      const res = mockResponse();

      (authService.register as jest.Mock).mockRejectedValue(
        new Error('Пользователь уже существует')
      );

      await registerController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        code: 'REGISTRATION_UNAVAILABLE',
        error: 'Регистрация временно недоступна. Попробуйте позже',
      });
    });

    it('returns a stable business code for an existing email', async () => {
      const req = mockRequest({ email: 'test@example.com' });
      const res = mockResponse();
      (authService.register as jest.Mock).mockRejectedValue(
        new Error('Пользователь с таким email уже зарегистрирован')
      );

      await registerController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        code: 'EMAIL_ALREADY_REGISTERED',
        error: 'Пользователь с таким email уже зарегистрирован',
      });
    });
  });

  describe('loginController', () => {
    it('should login user and set cookie', async () => {
      const req = mockRequest({
        email: 'test@example.com',
        password: 'Test1234!',
      });
      const res = mockResponse();

      (authService.login as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        user: { id: '1', email: 'test@example.com' },
      });

      await loginController(req as Request, res as Response);

      expect(res.cookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 401 on error', async () => {
      const req = mockRequest({ email: 'test@example.com', password: 'wrong' });
      const res = mockResponse();

      (authService.login as jest.Mock).mockRejectedValue(
        new Error('Неверный email или пароль')
      );

      await loginController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('preserves the guest cookie when cart merge fails', async () => {
      const req = mockRequest({ email: 'test@example.com', password: 'Test1234!' }, null, { guestId: 'guest-1' });
      const res = mockResponse();
      (authService.login as jest.Mock).mockResolvedValue({ token: 'mock-token', user: { id: 'user-1' } });
      prisma.cart.findUnique.mockRejectedValueOnce(new Error('temporary database failure'));

      await loginController(req as Request, res as Response);

      expect(res.clearCookie).not.toHaveBeenCalledWith('guestId', expect.anything());
      expect(res.cookie).toHaveBeenCalledWith('token', 'mock-token', expect.objectContaining({ path: '/' }));
    });
  });

  describe('mergeCart', () => {
    it('reports a failed merge without deleting the guest cart', async () => {
      prisma.cart.findUnique.mockRejectedValueOnce(new Error('temporary database failure'));
      await expect(mergeCart('user-1', 'guest-1')).resolves.toBe(false);
      expect(prisma.cart.delete).not.toHaveBeenCalled();
    });
  });

  describe('logoutController', () => {
    it('should clear cookie', () => {
      const req = mockRequest();
      const res = mockResponse();

      logoutController(req as Request, res as Response);

      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Выход выполнен',
      });
    });
  });

  describe('meController', () => {
    it('should return user data', async () => {
      const user = { id: '1', email: 'test@example.com' };
      const req = mockRequest({}, user);
      const res = mockResponse();

      (authService.getUserById as jest.Mock).mockResolvedValue(user);

      await meController(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return 401 if no user', async () => {
      const req = mockRequest({}, null);
      const res = mockResponse();

      await meController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('updateProfileController', () => {
    it('should update profile', async () => {
      const user = { id: '1' };
      const req = mockRequest({ firstName: 'Updated' }, user);
      const res = mockResponse();

      (authService.updateProfile as jest.Mock).mockResolvedValue({
        user: { id: '1', firstName: 'Updated' },
        message: 'Профиль обновлён',
      });

      await updateProfileController(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });

    it('should return 401 if no user', async () => {
      const req = mockRequest({}, null);
      const res = mockResponse();

      await updateProfileController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('changePasswordController', () => {
    it('should change password', async () => {
      const user = { id: '1' };
      const req = mockRequest(
        { currentPassword: 'Old1234!', newPassword: 'New1234!' },
        user
      );
      const res = mockResponse();

      (authService.changePassword as jest.Mock).mockResolvedValue({
        message: 'Пароль успешно изменён',
      });

      await changePasswordController(req as Request, res as Response);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('requestPasswordResetController', () => {
    const genericResponse = {
      message: 'Если аккаунт существует, код для восстановления отправлен на почту',
    };

    it('returns the generic response on success', async () => {
      const req = mockRequest({ email: 'user@example.com' });
      const res = mockResponse();
      (authService.requestPasswordReset as jest.Mock).mockResolvedValue(genericResponse);

      await requestPasswordResetController(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(genericResponse);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns the same generic response when the service fails', async () => {
      const req = mockRequest({ email: 'user@example.com' });
      const res = mockResponse();
      (authService.requestPasswordReset as jest.Mock).mockRejectedValue(new Error('SMTP unavailable'));

      await requestPasswordResetController(req as Request, res as Response);

      expect(res.json).toHaveBeenCalledWith(genericResponse);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
