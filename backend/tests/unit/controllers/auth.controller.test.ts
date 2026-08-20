// backend/tests/unit/controllers/auth.controller.test.ts
import { Request, Response } from 'express';
import {
  registerController,
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
} from '../../../src/controllers/auth.controller';
import * as authService from '../../../src/services/auth.service';

jest.mock('../../../src/services/auth.service');

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
  return res;
};

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerController', () => {
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

    it('should return 400 on error', async () => {
      const req = mockRequest({ email: 'test@example.com' });
      const res = mockResponse();

      (authService.register as jest.Mock).mockRejectedValue(
        new Error('Пользователь уже существует')
      );

      await registerController(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Пользователь уже существует',
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
