"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserLikes = exports.toggleLike = void 0;
const prisma_1 = require("../config/prisma");
const toggleLike = async (req, res) => {
    try {
        const { articleId } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        if (!articleId) {
            res.status(400).json({ error: 'articleId обязателен' });
            return;
        }
        const article = await prisma_1.prisma.article.findUnique({
            where: { id: articleId },
        });
        if (!article) {
            res.status(404).json({ error: 'Статья не найдена' });
            return;
        }
        const existingLike = await prisma_1.prisma.like.findUnique({
            where: {
                userId_articleId: {
                    userId,
                    articleId,
                },
            },
        });
        if (existingLike) {
            await prisma_1.prisma.like.delete({
                where: {
                    userId_articleId: {
                        userId,
                        articleId,
                    },
                },
            });
            await prisma_1.prisma.article.update({
                where: { id: articleId },
                data: { likesCount: { decrement: 1 } },
            });
            res.json({ success: true, liked: false });
        }
        else {
            await prisma_1.prisma.like.create({
                data: {
                    userId,
                    articleId,
                },
            });
            await prisma_1.prisma.article.update({
                where: { id: articleId },
                data: { likesCount: { increment: 1 } },
            });
            res.json({ success: true, liked: true });
        }
    }
    catch (error) {
        console.error('❌ Toggle like error:', error);
        res.status(500).json({ error: 'Ошибка изменения лайка' });
    }
};
exports.toggleLike = toggleLike;
// ✅ ДОБАВЛЯЕМ ЭТУ ФУНКЦИЮ
const getUserLikes = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        const likes = await prisma_1.prisma.like.findMany({
            where: { userId },
            select: { articleId: true },
        });
        res.json({
            articleIds: likes.map(l => l.articleId),
        });
    }
    catch (error) {
        console.error('❌ Get user likes error:', error);
        res.status(500).json({ error: 'Ошибка получения лайков' });
    }
};
exports.getUserLikes = getUserLikes;
//# sourceMappingURL=likes.controller.js.map