"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteArticle = exports.updateArticle = exports.createArticle = exports.getArticleById = exports.getArticles = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const sanitizeArticleHtml_1 = require("../utils/sanitizeArticleHtml");
const prisma_1 = require("../config/prisma");
// ============================================================
// GET /api/articles — список всех статей
// ============================================================
const getArticles = async (req, res) => {
    try {
        const { published, page = '1', limit = '20', search, type } = req.query;
        const where = { isPublished: true };
        if (type)
            where.type = type;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [articles, total] = await Promise.all([
            prisma_1.prisma.article.findMany({
                where,
                include: {
                    author: { select: { firstName: true, lastName: true } },
                    tags: { include: { tag: true } },
                    images: { orderBy: { sortOrder: 'asc' } },
                    _count: { select: { comments: true, likes: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            prisma_1.prisma.article.count({ where }),
        ]);
        const formatted = articles.map((a) => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            description: a.description,
            content: a.content,
            imageUrl: a.imageUrl || a.images?.[0]?.url || '',
            images: a.images?.map((img) => img.url) || [],
            date: a.createdAt,
            readTime: a.readTime || 5,
            tags: a.tags?.map((t) => t.tag.name) || [],
            views: a.views,
            likesCount: a._count?.likes || 0,
            isPublished: a.isPublished,
            type: a.type || 'swap',
            author: a.author ? `${a.author.firstName || ''} ${a.author.lastName || ''}`.trim() : 'Admin',
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
        }));
        res.json({
            items: formatted,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('❌ Get articles error:', error);
        res.status(500).json({ error: 'Ошибка получения статей' });
    }
};
exports.getArticles = getArticles;
// ============================================================
// GET /api/articles/:slug — одна статья (ПО SLUG)
// ============================================================
const getArticleById = async (req, res) => {
    try {
        const { id } = req.params; // это slug
        const article = await prisma_1.prisma.article.findUnique({
            where: { slug: id, isPublished: true },
            include: {
                author: { select: { firstName: true, lastName: true } },
                tags: { include: { tag: true } },
                images: { orderBy: { sortOrder: 'asc' } },
                comments: {
                    where: { parentId: null, isHidden: false },
                    include: {
                        author: { select: { id: true, firstName: true, lastName: true } },
                        replies: {
                            where: { isHidden: false },
                            include: {
                                author: { select: { id: true, firstName: true, lastName: true } },
                                replies: {
                                    where: { isHidden: false },
                                    include: {
                                        author: { select: { id: true, firstName: true, lastName: true } },
                                        replies: {
                                            where: { isHidden: false },
                                            include: {
                                                author: { select: { id: true, firstName: true, lastName: true } },
                                            },
                                            orderBy: { createdAt: 'asc' },
                                        },
                                    },
                                    orderBy: { createdAt: 'asc' },
                                },
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                _count: { select: { likes: true } },
            },
        });
        if (!article) {
            res.status(404).json({ error: 'Статья не найдена' });
            return;
        }
        // Уникальные просмотры
        const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
        const viewerKey = `article:${article.id}:viewer:${ip}`;
        let viewsCount = article.views;
        try {
            const viewed = await redis_1.default.get(viewerKey);
            if (!viewed) {
                await redis_1.default.setex(viewerKey, 86400, '1');
                const updated = await prisma_1.prisma.article.update({
                    where: { id: article.id },
                    data: { views: { increment: 1 } },
                    select: { views: true },
                });
                viewsCount = updated.views;
            }
        }
        catch (error) {
            console.warn('⚠️ Redis error:', error);
        }
        // Рекурсивное форматирование комментариев
        const formatComments = (items, depth = 0) => {
            if (depth > 5)
                return [];
            return items.map((c) => ({
                id: c.id,
                content: c.content,
                author: `${c.author.firstName || ''} ${c.author.lastName || ''}`.trim() || 'Аноним',
                authorId: c.author.id,
                createdAt: c.createdAt,
                parentId: c.parentId,
                replies: c.replies ? formatComments(c.replies, depth + 1) : [],
            }));
        };
        const formatted = {
            id: article.id,
            slug: article.slug,
            title: article.title,
            description: article.description,
            content: (0, sanitizeArticleHtml_1.sanitizeArticleHtml)(article.content),
            imageUrl: article.imageUrl || article.images?.[0]?.url || '',
            images: article.images?.map((img) => img.url) || [],
            date: article.createdAt,
            readTime: article.readTime || 5,
            tags: article.tags?.map((t) => t.tag.name) || [],
            views: viewsCount,
            likesCount: article._count?.likes || 0,
            isPublished: article.isPublished,
            type: article.type || 'swap',
            author: article.author ? `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() : 'Admin',
            comments: formatComments(article.comments, 0),
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
        };
        res.json(formatted);
    }
    catch (error) {
        console.error('❌ Get article error:', error);
        res.status(500).json({ error: 'Ошибка получения статьи' });
    }
};
exports.getArticleById = getArticleById;
// ============================================================
// POST /api/articles — создать статью
// ============================================================
const createArticle = async (req, res) => {
    try {
        const { title, content, description, imageUrl, isPublished, tags = [], images = [], readTime, type = 'swap', } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Не авторизован' });
            return;
        }
        const sanitizedContent = typeof content === 'string' ? (0, sanitizeArticleHtml_1.sanitizeArticleHtml)(content).trim() : '';
        if (!title || !sanitizedContent) {
            res.status(400).json({ error: 'Заголовок и содержание обязательны' });
            return;
        }
        const slug = title
            .toLowerCase()
            .replace(/[^a-zа-яё0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const article = await prisma_1.prisma.article.create({
            data: {
                slug,
                title,
                content: sanitizedContent,
                description: description || title,
                imageUrl: imageUrl || images?.[0]?.url || '',
                isPublished: isPublished || false,
                readTime: readTime || 5,
                type: type || 'swap',
                authorId: userId,
                tags: {
                    create: tags.map((tagName) => {
                        const cleanTag = tagName.trim();
                        return {
                            tag: {
                                connectOrCreate: {
                                    where: { name: cleanTag },
                                    create: {
                                        name: cleanTag,
                                        slug: cleanTag.toLowerCase().replace(/\s+/g, '-'),
                                    },
                                },
                            },
                        };
                    }),
                },
                images: {
                    create: images.map((img, index) => ({
                        url: img.url,
                        filename: img.filename || `image_${index}`,
                        size: img.size || null,
                        sortOrder: img.sortOrder || index,
                        isMain: img.isMain || index === 0,
                    })),
                },
            },
            include: {
                tags: { include: { tag: true } },
                images: true,
                author: { select: { firstName: true, lastName: true } },
            },
        });
        res.status(201).json({
            success: true,
            article: {
                id: article.id,
                slug: article.slug,
                title: article.title,
                description: article.description,
                content: article.content,
                imageUrl: article.imageUrl,
                images: article.images?.map((img) => img.url) || [],
                tags: article.tags?.map((t) => t.tag.name) || [],
                isPublished: article.isPublished,
                readTime: article.readTime,
                type: article.type,
                author: article.author ? `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() : 'Admin',
                createdAt: article.createdAt,
            }
        });
    }
    catch (error) {
        console.error('❌ Create article error:', error);
        res.status(500).json({ error: 'Ошибка создания статьи' });
    }
};
exports.createArticle = createArticle;
// ============================================================
// PUT /api/articles/:id — обновить статью
// ============================================================
const updateArticle = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, description, imageUrl, isPublished, tags, images, readTime, type } = req.body;
        const existing = await prisma_1.prisma.article.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Статья не найдена' });
            return;
        }
        const sanitizedContent = typeof content === 'string'
            ? (0, sanitizeArticleHtml_1.sanitizeArticleHtml)(content).trim()
            : undefined;
        if (content !== undefined && !sanitizedContent) {
            res.status(400).json({ error: 'Article content cannot be empty after sanitization' });
            return;
        }
        const data = {
            content: sanitizedContent,
            description,
            imageUrl,
            isPublished,
            readTime: readTime || 5,
        };
        if (type)
            data.type = type;
        if (title) {
            data.title = title;
            data.slug = title
                .toLowerCase()
                .replace(/[^a-zа-яё0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }
        await prisma_1.prisma.article.update({
            where: { id },
            data,
        });
        // Обновляем теги
        if (tags !== undefined) {
            await prisma_1.prisma.articleTagRelation.deleteMany({ where: { articleId: id } });
            if (tags.length > 0) {
                const tagPromises = tags.map(async (tagName) => {
                    const cleanTag = tagName.trim();
                    const tag = await prisma_1.prisma.articleTag.upsert({
                        where: { name: cleanTag },
                        update: {},
                        create: {
                            name: cleanTag,
                            slug: cleanTag.toLowerCase().replace(/\s+/g, '-'),
                        },
                    });
                    return tag.id;
                });
                const tagIds = await Promise.all(tagPromises);
                await prisma_1.prisma.articleTagRelation.createMany({
                    data: tagIds.map((tagId) => ({ articleId: id, tagId })),
                });
            }
        }
        // Обновляем изображения
        if (images !== undefined) {
            await prisma_1.prisma.articleImage.deleteMany({ where: { articleId: id } });
            if (images.length > 0) {
                await prisma_1.prisma.articleImage.createMany({
                    data: images.map((img, index) => ({
                        articleId: id,
                        url: img.url,
                        filename: img.filename || `image_${index}`,
                        size: img.size || null,
                        sortOrder: img.sortOrder || index,
                        isMain: img.isMain || index === 0,
                    })),
                });
            }
        }
        const updated = await prisma_1.prisma.article.findUnique({
            where: { id },
            include: {
                tags: { include: { tag: true } },
                images: true,
                author: { select: { firstName: true, lastName: true } },
            },
        });
        res.json({
            success: true,
            article: {
                id: updated?.id,
                slug: updated?.slug,
                title: updated?.title,
                description: updated?.description,
                content: updated?.content,
                imageUrl: updated?.imageUrl,
                images: updated?.images?.map((img) => img.url) || [],
                tags: updated?.tags?.map((t) => t.tag.name) || [],
                isPublished: updated?.isPublished,
                readTime: updated?.readTime,
                type: updated?.type,
                author: updated?.author ? `${updated.author.firstName || ''} ${updated.author.lastName || ''}`.trim() : 'Admin',
                createdAt: updated?.createdAt,
                updatedAt: updated?.updatedAt,
            }
        });
    }
    catch (error) {
        console.error('❌ Update article error:', error);
        res.status(500).json({ error: 'Ошибка обновления статьи' });
    }
};
exports.updateArticle = updateArticle;
// ============================================================
// DELETE /api/articles/:id — удалить статью
// ============================================================
const deleteArticle = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.article.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Статья не найдена' });
            return;
        }
        await prisma_1.prisma.articleTagRelation.deleteMany({ where: { articleId: id } });
        await prisma_1.prisma.articleImage.deleteMany({ where: { articleId: id } });
        await prisma_1.prisma.comment.deleteMany({ where: { articleId: id } });
        await prisma_1.prisma.like.deleteMany({ where: { articleId: id } });
        await prisma_1.prisma.article.delete({ where: { id } });
        try {
            const keys = await redis_1.default.keys(`article:${id}:viewer:*`);
            if (keys.length > 0) {
                await Promise.all(keys.map((key) => redis_1.default.del(key)));
            }
        }
        catch (error) {
            console.warn('⚠️ Не удалось очистить кэш просмотров:', error);
        }
        res.json({ success: true, message: 'Статья удалена' });
    }
    catch (error) {
        console.error('❌ Delete article error:', error);
        res.status(500).json({ error: 'Ошибка удаления статьи' });
    }
};
exports.deleteArticle = deleteArticle;
//# sourceMappingURL=articles.controller.js.map