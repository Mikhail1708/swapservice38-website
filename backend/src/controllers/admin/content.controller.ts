// backend/src/controllers/admin/content.controller.ts
import { Request, Response } from 'express';
import { sanitizeArticleHtml } from '../../utils/sanitizeArticleHtml';
import { log } from '../../config/logger';

import { prisma } from '../../config/prisma';

const ARTICLE_TYPES = new Set(['swap', 'news']);
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAGS = 30;
const MAX_IMAGES = 30;

const normalizePositiveInt = (value: unknown, fallback: number, max = 10000): number | null => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
};

const normalizeTags = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;
  const tags = value.map((tag) => typeof tag === 'string' ? tag.trim() : '').filter(Boolean);
  if (tags.some((tag) => tag.length > 80)) return null;
  return [...new Set(tags)];
};

const normalizeImages = (value: unknown): Array<{ url: string; filename?: string; size?: number | null; sortOrder?: number; isMain?: boolean }> | null => {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) return null;
  const normalized = [] as Array<{ url: string; filename?: string; size?: number | null; sortOrder?: number; isMain?: boolean }>;
  for (const item of value) {
    if (typeof item === 'string') {
      const url = item.trim();
      if (!url) return null;
      normalized.push({ url });
      continue;
    }
    if (!item || typeof item !== 'object') return null;
    const img = item as Record<string, unknown>;
    if (typeof img.url !== 'string' || !img.url.trim()) return null;
    normalized.push({
      url: img.url.trim(),
      filename: typeof img.filename === 'string' ? img.filename.slice(0, 255) : undefined,
      size: typeof img.size === 'number' && Number.isFinite(img.size) && img.size >= 0 ? img.size : null,
      sortOrder: typeof img.sortOrder === 'number' && Number.isInteger(img.sortOrder) ? img.sortOrder : undefined,
      isMain: typeof img.isMain === 'boolean' ? img.isMain : undefined,
    });
  }
  return normalized;
};

const makeSlug = (title: string): string => title
  .toLowerCase()
  .replace(/[^a-zа-яё0-9\s]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');


// ============================================================
// ===== ARTICLES (СТАТЬИ/СВАПЫ) =====
// ============================================================

// GET /api/articles — список статей с фильтром по типу
export const getArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { published, type, search, page = '1', limit = '20' } = req.query;
    
    const where: any = {};
    if (published === 'true') where.isPublished = true;
    if (type) {
      if (typeof type !== 'string' || !ARTICLE_TYPES.has(type)) {
        res.status(400).json({ error: 'Некорректный тип материала' });
        return;
      }
      where.type = type;
    }
    if (typeof search === 'string' && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const pageNum = Number.parseInt(page as string, 10);
    const limitNum = Number.parseInt(limit as string, 10);
    if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({ error: 'Некорректные параметры пагинации' });
      return;
    }
    const skip = (pageNum - 1) * limitNum;

    log.debug('GET admin/articles', { published, type, page: pageNum, limit: limitNum });

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
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
      prisma.article.count({ where }),
    ]);

    log.debug('Articles loaded', { count: articles.length, total });

    const formatted = articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description || a.title,
      content: a.content,
      imageUrl: a.imageUrl || a.images?.[0]?.url || '',
      images: a.images?.map((img: any) => img.url) || [],
      date: a.createdAt,
      readTime: a.readTime || 5,
      tags: a.tags?.map((t: any) => t.tag.name) || [],
      views: a.views || 0,
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
  } catch (error: any) {
    log.error('Get articles error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения статей' });
  }
};

export const getArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findFirst({
      where: {
        OR: [
          { id: id },
          { slug: id },
        ],
      },
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

    const isAdminRequest = req.baseUrl.startsWith('/api/admin');
    if (!isAdminRequest) {
      await prisma.article.update({
        where: { id: article.id },
        data: { views: { increment: 1 } },
      });
    }

    const formatted = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      description: article.description || article.title,
      content: article.content,
      imageUrl: article.imageUrl || article.images?.[0]?.url || '',
      images: article.images?.map((img: any) => img.url) || [],
      date: article.createdAt,
      readTime: article.readTime || 5,
      tags: article.tags?.map((t: any) => t.tag.name) || [],
      views: article.views + (isAdminRequest ? 0 : 1),
      likesCount: article._count?.likes || 0,
      isPublished: article.isPublished,
      type: article.type || 'swap',
      author: article.author ? `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() : 'Admin',
      comments: article.comments?.map((c: any) => ({
        id: c.id,
        author: `${c.author.firstName || ''} ${c.author.lastName || ''}`.trim() || 'Аноним',
        authorId: c.author.id,
        createdAt: c.createdAt,
        content: c.content,
        replies: c.replies?.map((r: any) => ({
          id: r.id,
          author: `${r.author.firstName || ''} ${r.author.lastName || ''}`.trim() || 'Аноним',
          authorId: r.author.id,
          createdAt: r.createdAt,
          content: r.content,
          parentId: r.parentId,
        })) || [],
        parentId: c.parentId,
      })) || [],
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };

    res.json(formatted);
  } catch (error: any) {
    log.error('Get article error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения статьи' });
  }
};

// POST /api/articles — создать статью
export const createArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      content,
      description,
      imageUrl,
      isPublished,
      tags = [],
      images = [],
      readTime,
      type = 'swap',
    } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    if (typeof title !== 'string' || !title.trim() || title.trim().length > MAX_TITLE_LENGTH) {
      res.status(400).json({ error: 'Некорректный заголовок' });
      return;
    }
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Содержание обязательно' });
      return;
    }
    if (typeof type !== 'string' || !ARTICLE_TYPES.has(type)) {
      res.status(400).json({ error: 'Некорректный тип материала' });
      return;
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      res.status(400).json({ error: 'Некорректное описание' });
      return;
    }
    if (isPublished !== undefined && typeof isPublished !== 'boolean') {
      res.status(400).json({ error: 'Некорректное значение isPublished' });
      return;
    }

    const normalizedTags = normalizeTags(tags);
    const normalizedImages = normalizeImages(images);
    const normalizedReadTime = normalizePositiveInt(readTime, 5, 1440);
    if (!normalizedTags || !normalizedImages || normalizedReadTime === null) {
      res.status(400).json({ error: 'Некорректные tags, images или readTime' });
      return;
    }

    const sanitizedContent = sanitizeArticleHtml(content).trim();
    if (!sanitizedContent) {
      res.status(400).json({ error: 'Содержание не может быть пустым после очистки' });
      return;
    }

    const cleanTitle = title.trim();
    let slug = makeSlug(cleanTitle) || `article-${Date.now()}`;
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const article = await prisma.article.create({
      data: {
        slug,
        title: cleanTitle,
        content: sanitizedContent,
        description: typeof description === 'string' && description.trim() ? description.trim() : cleanTitle,
        imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : normalizedImages[0]?.url || '',
        isPublished: isPublished === true,
        readTime: normalizedReadTime,
        type,
        authorId: userId,
        tags: {
          create: normalizedTags.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName, slug: makeSlug(tagName) || `tag-${Date.now()}` },
              },
            },
          })),
        },
        images: {
          create: normalizedImages.map((img, index) => ({
            url: img.url,
            filename: img.filename || `image_${index}`,
            size: img.size ?? null,
            sortOrder: img.sortOrder ?? index,
            isMain: img.isMain ?? index === 0,
          })),
        },
      },
      include: {
        tags: { include: { tag: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        author: { select: { firstName: true, lastName: true } },
      },
    });

    log.info('Article created', { id: article.id, type: article.type });
    res.status(201).json({
      success: true,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        description: article.description,
        content: article.content,
        imageUrl: article.imageUrl,
        images: article.images.map((img: any) => img.url),
        tags: article.tags.map((t: any) => t.tag.name),
        isPublished: article.isPublished,
        type: article.type,
        readTime: article.readTime,
        author: article.author ? `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() : 'Admin',
        createdAt: article.createdAt,
      },
    });
  } catch (error: any) {
    log.error('Create article error', { error: error.message });
    res.status(500).json({ error: 'Ошибка создания статьи' });
  }
};

// PUT /api/articles/:id — обновить статью
export const updateArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, description, imageUrl, isPublished, tags, images, readTime, type } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > MAX_TITLE_LENGTH)) {
      res.status(400).json({ error: 'Некорректный заголовок' });
      return;
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      res.status(400).json({ error: 'Некорректное описание' });
      return;
    }
    if (isPublished !== undefined && typeof isPublished !== 'boolean') {
      res.status(400).json({ error: 'Некорректное значение isPublished' });
      return;
    }
    if (type !== undefined && (typeof type !== 'string' || !ARTICLE_TYPES.has(type))) {
      res.status(400).json({ error: 'Некорректный тип материала' });
      return;
    }

    const sanitizedContent = content === undefined
      ? undefined
      : typeof content === 'string'
        ? sanitizeArticleHtml(content).trim()
        : null;
    if (sanitizedContent === null || (content !== undefined && !sanitizedContent)) {
      res.status(400).json({ error: 'Содержание не может быть пустым после очистки' });
      return;
    }

    const normalizedTags = tags === undefined ? undefined : normalizeTags(tags);
    const normalizedImages = images === undefined ? undefined : normalizeImages(images);
    const normalizedReadTime = readTime === undefined ? undefined : normalizePositiveInt(readTime, existing.readTime || 5, 1440);
    if (normalizedTags === null || normalizedImages === null || normalizedReadTime === null) {
      res.status(400).json({ error: 'Некорректные tags, images или readTime' });
      return;
    }

    let nextSlug: string | undefined;
    if (typeof title === 'string') {
      nextSlug = makeSlug(title.trim()) || existing.slug;
      const slugOwner = await prisma.article.findFirst({ where: { slug: nextSlug, id: { not: id } }, select: { id: true } });
      if (slugOwner) nextSlug = `${nextSlug}-${Date.now()}`;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const data: any = {};
      if (typeof title === 'string') data.title = title.trim();
      if (nextSlug) data.slug = nextSlug;
      if (sanitizedContent !== undefined) data.content = sanitizedContent;
      if (description !== undefined) data.description = typeof description === 'string' && description.trim() ? description.trim() : null;
      if (imageUrl !== undefined) data.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
      if (isPublished !== undefined) data.isPublished = isPublished;
      if (normalizedReadTime !== undefined) data.readTime = normalizedReadTime;
      if (type !== undefined) data.type = type;
      if (normalizedImages !== undefined && imageUrl === undefined) data.imageUrl = normalizedImages[0]?.url || '';

      await tx.article.update({ where: { id }, data });

      if (normalizedTags !== undefined) {
        await tx.articleTagRelation.deleteMany({ where: { articleId: id } });
        for (const tagName of normalizedTags) {
          const tag = await tx.articleTag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName, slug: makeSlug(tagName) || `tag-${Date.now()}` },
          });
          await tx.articleTagRelation.create({ data: { articleId: id, tagId: tag.id } });
        }
      }

      if (normalizedImages !== undefined) {
        await tx.articleImage.deleteMany({ where: { articleId: id } });
        if (normalizedImages.length) {
          await tx.articleImage.createMany({
            data: normalizedImages.map((img, index) => ({
              articleId: id,
              url: img.url,
              filename: img.filename || `image_${index}`,
              size: img.size ?? null,
              sortOrder: img.sortOrder ?? index,
              isMain: img.isMain ?? index === 0,
            })),
          });
        }
      }

      return tx.article.findUnique({
        where: { id },
        include: {
          tags: { include: { tag: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          author: { select: { firstName: true, lastName: true } },
        },
      });
    });

    log.info('Article updated', { id });
    res.json({
      success: true,
      article: {
        id: updated?.id,
        slug: updated?.slug,
        title: updated?.title,
        description: updated?.description,
        content: updated?.content,
        imageUrl: updated?.imageUrl,
        images: updated?.images?.map((img: any) => img.url) || [],
        tags: updated?.tags?.map((t: any) => t.tag.name) || [],
        isPublished: updated?.isPublished,
        type: updated?.type,
        readTime: updated?.readTime,
        author: updated?.author ? `${updated.author.firstName || ''} ${updated.author.lastName || ''}`.trim() : 'Admin',
        createdAt: updated?.createdAt,
        updatedAt: updated?.updatedAt,
      },
    });
  } catch (error: any) {
    log.error('Update article error', { error: error.message });
    res.status(500).json({ error: 'Ошибка обновления статьи' });
  }
};

// DELETE /api/articles/:id — удалить статью
export const deleteArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    log.info('Deleting article', { id });

    await prisma.articleTagRelation.deleteMany({ where: { articleId: id } });
    await prisma.articleImage.deleteMany({ where: { articleId: id } });
    await prisma.comment.deleteMany({ where: { articleId: id } });
    await prisma.like.deleteMany({ where: { articleId: id } });
    await prisma.article.delete({ where: { id } });

    log.info('Article deleted', { id });

    res.json({ success: true, message: 'Статья удалена' });
  } catch (error: any) {
    log.error('Delete article error', { error: error.message });
    res.status(500).json({ error: 'Ошибка удаления статьи' });
  }
};

// ============================================================
// ===== SERVICES (УСЛУГИ) — НОВЫЙ БЛОК! =====
// ============================================================

// GET /api/admin/services — список услуг
export const getServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    log.debug('Services loaded', { count: services.length });
    res.json({ services });
  } catch (error: any) {
    log.error('Get services error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения услуг' });
  }
};

// GET /api/admin/services/:id — одна услуга
export const getServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const service = await prisma.service.findUnique({
      where: { id },
    });
    
    if (!service) {
      res.status(404).json({ error: 'Услуга не найдена' });
      return;
    }
    
    res.json({ service });
  } catch (error: any) {
    log.error('Get service error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения услуги' });
  }
};

// POST /api/admin/services — создать услугу
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, price, imageUrl, isActive } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Название обязательно' });
      return;
    }
    
    const service = await prisma.service.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: price ? parseFloat(price) : null,
        imageUrl: imageUrl || null,
        isActive: isActive ?? true,
      },
    });
    
    log.info('Service created', { id: service.id, name: service.name });
    res.status(201).json({ service });
  } catch (error: any) {
    log.error('Create service error', { error: error.message });
    res.status(500).json({ error: 'Ошибка создания услуги' });
  }
};

// PUT /api/admin/services/:id — обновить услугу
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, isActive } = req.body;
    
    const existing = await prisma.service.findUnique({
      where: { id },
    });
    
    if (!existing) {
      res.status(404).json({ error: 'Услуга не найдена' });
      return;
    }
    
    const service = await prisma.service.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        description: description !== undefined ? description?.trim() || null : existing.description,
        price: price !== undefined ? (price ? parseFloat(price) : null) : existing.price,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });
    
    log.info('Service updated', { id: service.id, name: service.name });
    res.json({ service });
  } catch (error: any) {
    log.error('Update service error', { error: error.message });
    res.status(500).json({ error: 'Ошибка обновления услуги' });
  }
};

// DELETE /api/admin/services/:id — удалить услугу
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const existing = await prisma.service.findUnique({
      where: { id },
    });
    
    if (!existing) {
      res.status(404).json({ error: 'Услуга не найдена' });
      return;
    }
    
    await prisma.service.delete({
      where: { id },
    });
    
    log.info('Service deleted', { id, name: existing.name });
    res.json({ success: true, message: 'Услуга удалена' });
  } catch (error: any) {
    log.error('Delete service error', { error: error.message });
    res.status(500).json({ error: 'Ошибка удаления услуги' });
  }
};
