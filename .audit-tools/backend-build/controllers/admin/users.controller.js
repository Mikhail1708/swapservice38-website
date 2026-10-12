"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.massDeleteUsers = exports.changeUserPassword = exports.unblockUser = exports.blockUser = exports.updateUserRole = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const common_schema_1 = require("../../schemas/common.schema");
const prisma_1 = require("../../config/prisma");
// ============================================================
// ВАЛИДАЦИЯ ТЕЛЕФОНА
// ============================================================
const validatePhone = (phone) => {
    if (!phone)
        return true;
    const digits = phone.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('7');
};
// ============================================================
// GET /api/admin/users — список пользователей
// ============================================================
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const where = search ? {
            OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ],
        } : {};
        const [users, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    address: true,
                    role: true,
                    isVerified: true,
                    blockedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: { orders: true },
                    },
                },
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        res.json({
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        console.error('❌ Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Ошибка получения пользователей' });
    }
};
exports.getUsers = getUsers;
// ============================================================
// GET /api/admin/users/:id — получить пользователя
// ============================================================
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                role: true,
                isVerified: true,
                blockedAt: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: { orders: true },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json({ user });
    }
    catch (error) {
        console.error('❌ Ошибка получения пользователя:', error);
        res.status(500).json({ error: 'Ошибка получения пользователя' });
    }
};
exports.getUserById = getUserById;
// ============================================================
// POST /api/admin/users — СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const createUser = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, address, role, isVerified } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Email обязателен' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if (role && !['user', 'manager', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }
        const passwordResult = common_schema_1.passwordSchema.safeParse(password);
        if (!passwordResult.success) {
            return res.status(400).json({ error: passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям' });
        }
        if (phone && !validatePhone(phone)) {
            return res.status(400).json({ error: 'Некорректный номер телефона' });
        }
        const existing = await prisma_1.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existing) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash: hashedPassword,
                firstName: firstName?.trim() || null,
                lastName: lastName?.trim() || null,
                phone: phone?.trim() || null,
                address: address?.trim() || null,
                role: role || 'user',
                isVerified: isVerified ?? false,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                role: true,
                isVerified: true,
                blockedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({ user, message: 'Пользователь создан' });
    }
    catch (error) {
        console.error('❌ Ошибка создания пользователя:', error);
        res.status(500).json({ error: 'Ошибка создания пользователя' });
    }
};
exports.createUser = createUser;
// ============================================================
// PUT /api/admin/users/:id — ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, address, role, isVerified } = req.body;
        if (role && !['user', 'manager', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (phone && !validatePhone(phone)) {
            return res.status(400).json({ error: 'Некорректный номер телефона' });
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: {
                firstName: firstName?.trim() || null,
                lastName: lastName?.trim() || null,
                phone: phone?.trim() || null,
                address: address?.trim() || null,
                role: role || existing.role,
                isVerified: isVerified ?? existing.isVerified,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                role: true,
                isVerified: true,
                blockedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ user, message: 'Пользователь обновлён' });
    }
    catch (error) {
        console.error('❌ Ошибка обновления пользователя:', error);
        res.status(500).json({ error: 'Ошибка обновления пользователя' });
    }
};
exports.updateUser = updateUser;
// ============================================================
// ✅ DELETE /api/admin/users/:id — УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        // Проверяем существование
        const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        // Не даём удалить самого себя
        if (req.user?.id === id) {
            return res.status(400).json({ error: 'Нельзя удалить самого себя' });
        }
        // ✅ НАХОДИМ ВСЕ СТАТЬИ ПОЛЬЗОВАТЕЛЯ
        const userArticles = await prisma_1.prisma.article.findMany({
            where: { authorId: id },
            select: { id: true },
        });
        const articleIds = userArticles.map(a => a.id);
        const protectedOrder = await prisma_1.prisma.order.findFirst({
            where: {
                userId: id,
                OR: [
                    { paymentId: { not: null } },
                    { paymentAttempts: { some: {} } },
                ],
            },
            select: { id: true },
        });
        if (protectedOrder) {
            return res.status(409).json({
                error: 'Нельзя удалить пользователя с заказами, по которым начата оплата',
            });
        }
        // ✅ УДАЛЯЕМ ВСЕ СВЯЗАННЫЕ ДАННЫЕ В ПРАВИЛЬНОМ ПОРЯДКЕ
        await prisma_1.prisma.$transaction([
            // 1. Удаляем связи статей с тегами
            prisma_1.prisma.articleTagRelation.deleteMany({
                where: { articleId: { in: articleIds } },
            }),
            // 2. Удаляем изображения статей
            prisma_1.prisma.articleImage.deleteMany({
                where: { articleId: { in: articleIds } },
            }),
            // 3. Удаляем лайки статей
            prisma_1.prisma.like.deleteMany({
                where: { articleId: { in: articleIds } },
            }),
            // 4. Удаляем комментарии к статьям
            prisma_1.prisma.comment.deleteMany({
                where: { articleId: { in: articleIds } },
            }),
            // 5. Удаляем сами статьи
            prisma_1.prisma.article.deleteMany({
                where: { authorId: id },
            }),
            // 6. Удаляем сессии
            prisma_1.prisma.session.deleteMany({ where: { userId: id } }),
            // 7. Удаляем корзину
            prisma_1.prisma.cart.deleteMany({ where: { userId: id } }),
            // 8. Удаляем оставшиеся лайки (если есть)
            prisma_1.prisma.like.deleteMany({ where: { userId: id } }),
            // 9. Удаляем оставшиеся комментарии (если есть)
            prisma_1.prisma.comment.deleteMany({ where: { authorId: id } }),
            // 10. Удаляем заказы
            prisma_1.prisma.order.deleteMany({ where: { userId: id } }),
            // 11. Удаляем самого пользователя
            prisma_1.prisma.user.delete({ where: { id } }),
        ]);
        res.json({ message: 'Пользователь удалён' });
    }
    catch (error) {
        console.error('❌ Ошибка удаления пользователя:', error);
        res.status(500).json({ error: 'Ошибка удаления пользователя' });
    }
};
exports.deleteUser = deleteUser;
// ============================================================
// PATCH /api/admin/users/:id/role — СМЕНА РОЛИ
// ============================================================
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!role || !['user', 'manager', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (req.user?.id === id) {
            return res.status(400).json({ error: 'Нельзя изменить свою роль' });
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
            },
        });
        res.json({ user, message: `Роль изменена на ${role}` });
    }
    catch (error) {
        console.error('❌ Ошибка смены роли:', error);
        res.status(500).json({ error: 'Ошибка смены роли' });
    }
};
exports.updateUserRole = updateUserRole;
// ============================================================
// POST /api/admin/users/:id/block — БЛОКИРОВКА
// ============================================================
const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        if (req.user?.id === id) {
            return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: { blockedAt: new Date() },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                blockedAt: true,
            },
        });
        res.json({ user, message: 'Пользователь заблокирован' });
    }
    catch (error) {
        console.error('❌ Ошибка блокировки:', error);
        res.status(500).json({ error: 'Ошибка блокировки' });
    }
};
exports.blockUser = blockUser;
// ============================================================
// POST /api/admin/users/:id/unblock — РАЗБЛОКИРОВКА
// ============================================================
const unblockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const user = await prisma_1.prisma.user.update({
            where: { id },
            data: { blockedAt: null },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                blockedAt: true,
            },
        });
        res.json({ user, message: 'Пользователь разблокирован' });
    }
    catch (error) {
        console.error('❌ Ошибка разблокировки:', error);
        res.status(500).json({ error: 'Ошибка разблокировки' });
    }
};
exports.unblockUser = unblockUser;
// ============================================================
// PUT /api/admin/users/:id/password — СМЕНА ПАРОЛЯ (админом)
// ============================================================
const changeUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const passwordResult = common_schema_1.passwordSchema.safeParse(password);
        if (!passwordResult.success) {
            return res.status(400).json({ error: passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям' });
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        await prisma_1.prisma.user.update({
            where: { id },
            data: { passwordHash: hashedPassword },
        });
        res.json({ message: 'Пароль изменён' });
    }
    catch (error) {
        console.error('❌ Ошибка смены пароля:', error);
        res.status(500).json({ error: 'Ошибка смены пароля' });
    }
};
exports.changeUserPassword = changeUserPassword;
// ============================================================
// POST /api/admin/users/mass-delete — МАССОВОЕ УДАЛЕНИЕ
// ============================================================
const massDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Не указаны ID пользователей' });
        }
        const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))];
        const currentUserId = req.user?.id;
        const skipped = [];
        const users = await prisma_1.prisma.user.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true },
        });
        const existingIds = new Set(users.map((user) => user.id));
        const eligibleIds = [];
        for (const id of uniqueIds) {
            if (!existingIds.has(id)) {
                skipped.push({ id, code: 'NOT_FOUND', reason: 'Пользователь не найден' });
            }
            else if (id === currentUserId) {
                skipped.push({ id, code: 'SELF_DELETE', reason: 'Нельзя удалить самого себя' });
            }
            else {
                eligibleIds.push(id);
            }
        }
        if (eligibleIds.length > 0) {
            const protectedUsers = await prisma_1.prisma.order.findMany({
                where: {
                    userId: { in: eligibleIds },
                    OR: [
                        { paymentId: { not: null } },
                        { paymentAttempts: { some: {} } },
                    ],
                },
                select: { userId: true },
                distinct: ['userId'],
            });
            const protectedIds = new Set(protectedUsers.map((order) => order.userId).filter((id) => Boolean(id)));
            for (const id of [...eligibleIds]) {
                if (protectedIds.has(id)) {
                    skipped.push({
                        id,
                        code: 'PAYMENT_STARTED',
                        reason: 'Нельзя удалить пользователя с заказами, по которым начата оплата',
                    });
                }
            }
            for (let i = eligibleIds.length - 1; i >= 0; i -= 1) {
                if (protectedIds.has(eligibleIds[i]))
                    eligibleIds.splice(i, 1);
            }
        }
        let deleted = 0;
        if (eligibleIds.length > 0) {
            const articles = await prisma_1.prisma.article.findMany({
                where: { authorId: { in: eligibleIds } },
                select: { id: true },
            });
            const articleIds = articles.map((article) => article.id);
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.articleTagRelation.deleteMany({ where: { articleId: { in: articleIds } } }),
                prisma_1.prisma.articleImage.deleteMany({ where: { articleId: { in: articleIds } } }),
                prisma_1.prisma.like.deleteMany({ where: { articleId: { in: articleIds } } }),
                prisma_1.prisma.comment.deleteMany({ where: { articleId: { in: articleIds } } }),
                prisma_1.prisma.article.deleteMany({ where: { authorId: { in: eligibleIds } } }),
                prisma_1.prisma.session.deleteMany({ where: { userId: { in: eligibleIds } } }),
                prisma_1.prisma.cart.deleteMany({ where: { userId: { in: eligibleIds } } }),
                prisma_1.prisma.like.deleteMany({ where: { userId: { in: eligibleIds } } }),
                prisma_1.prisma.comment.deleteMany({ where: { authorId: { in: eligibleIds } } }),
                prisma_1.prisma.order.deleteMany({ where: { userId: { in: eligibleIds } } }),
            ]);
            const result = await prisma_1.prisma.user.deleteMany({ where: { id: { in: eligibleIds } } });
            deleted = result.count;
        }
        console.log(`🗑️ Массовое удаление пользователей: удалено ${deleted}, пропущено ${skipped.length}`);
        res.json({
            success: skipped.length === 0,
            deleted,
            skipped,
            message: `Удалено ${deleted} пользователей${skipped.length ? `, пропущено ${skipped.length}` : ''}`,
        });
    }
    catch (error) {
        console.error('❌ Mass delete users error:', error);
        res.status(500).json({ error: 'Ошибка массового удаления' });
    }
};
exports.massDeleteUsers = massDeleteUsers;
//# sourceMappingURL=users.controller.js.map