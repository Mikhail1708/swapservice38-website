"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminOnly = exports.requireAdmin = void 0;
const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    // ✅ ТОЛЬКО ADMIN ИЛИ MANAGER
    if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin или manager' });
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireAdminOnly = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    // ✅ ТОЛЬКО ADMIN
    if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin' });
    }
    next();
};
exports.requireAdminOnly = requireAdminOnly;
//# sourceMappingURL=role.middleware.js.map