"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const auth_controller_1 = require("../../../src/controllers/auth.controller");
const authService = __importStar(require("../../../src/services/auth.service"));
jest.mock('../../../src/services/auth.service');
const mockRequest = (body = {}, user = null, cookies = {}) => {
    const req = {
        body,
        cookies,
        headers: {},
    };
    if (user) {
        req.user = user;
    }
    return req;
};
const mockResponse = () => {
    const res = {};
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
            authService.register.mockResolvedValue({
                message: 'Код отправлен на почту',
            });
            await (0, auth_controller_1.registerController)(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Код отправлен на почту',
            });
        });
        it('should return 400 on error', async () => {
            const req = mockRequest({ email: 'test@example.com' });
            const res = mockResponse();
            authService.register.mockRejectedValue(new Error('Пользователь уже существует'));
            await (0, auth_controller_1.registerController)(req, res);
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
            authService.login.mockResolvedValue({
                token: 'mock-token',
                user: { id: '1', email: 'test@example.com' },
            });
            await (0, auth_controller_1.loginController)(req, res);
            expect(res.cookie).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalled();
        });
        it('should return 401 on error', async () => {
            const req = mockRequest({ email: 'test@example.com', password: 'wrong' });
            const res = mockResponse();
            authService.login.mockRejectedValue(new Error('Неверный email или пароль'));
            await (0, auth_controller_1.loginController)(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
    describe('logoutController', () => {
        it('should clear cookie', () => {
            const req = mockRequest();
            const res = mockResponse();
            (0, auth_controller_1.logoutController)(req, res);
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
            authService.getUserById.mockResolvedValue(user);
            await (0, auth_controller_1.meController)(req, res);
            expect(res.json).toHaveBeenCalled();
        });
        it('should return 401 if no user', async () => {
            const req = mockRequest({}, null);
            const res = mockResponse();
            await (0, auth_controller_1.meController)(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
    describe('updateProfileController', () => {
        it('should update profile', async () => {
            const user = { id: '1' };
            const req = mockRequest({ firstName: 'Updated' }, user);
            const res = mockResponse();
            authService.updateProfile.mockResolvedValue({
                user: { id: '1', firstName: 'Updated' },
                message: 'Профиль обновлён',
            });
            await (0, auth_controller_1.updateProfileController)(req, res);
            expect(res.json).toHaveBeenCalled();
        });
        it('should return 401 if no user', async () => {
            const req = mockRequest({}, null);
            const res = mockResponse();
            await (0, auth_controller_1.updateProfileController)(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
    describe('changePasswordController', () => {
        it('should change password', async () => {
            const user = { id: '1' };
            const req = mockRequest({ currentPassword: 'Old1234!', newPassword: 'New1234!' }, user);
            const res = mockResponse();
            authService.changePassword.mockResolvedValue({
                message: 'Пароль успешно изменён',
            });
            await (0, auth_controller_1.changePasswordController)(req, res);
            expect(res.json).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=auth.controller.test.js.map