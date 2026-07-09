// backend/src/controllers/articles.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// GET /api/articles — список всех статей
// ============================================================
export const getArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { published, page = '1', limit = '20', search } = req.query;
    
    const where: any = {};
    if (published === 'true') where.isPublished = true;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { content: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

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

    // Форматируем для фронтенда
    const formatted = articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description,
      content: a.content,
      imageUrl: a.imageUrl || a.images?.[0]?.url || '',
      images: a.images?.map((img: any) => img.url) || [],
      date: a.createdAt,
      readTime: a.readTime || 5,
      tags: a.tags?.map((t: any) => t.tag.name) || [],
      views: a.views,
      likesCount: a._count?.likes || 0,
      isPublished: a.isPublished,
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
    console.error('❌ Get articles error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения статей' });
  }
};

// ============================================================
// GET /api/articles/:id — одна статья
// ============================================================
export const getArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { firstName: true, lastName: true } },
        tags: { include: { tag: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        comments: {
          where: { parentId: null, isHidden: false },
          include: {
            author: { select: { firstName: true, lastName: true } },
            replies: {
              where: { isHidden: false },
              include: { author: { select: { firstName: true, lastName: true } } },
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

    // Увеличиваем просмотры
    await prisma.article.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    const formatted = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      description: article.description,
      content: article.content,
      imageUrl: article.imageUrl || article.images?.[0]?.url || '',
      images: article.images?.map((img: any) => img.url) || [],
      date: article.createdAt,
      readTime: article.readTime || 5,
      tags: article.tags?.map((t: any) => t.tag.name) || [],
      views: article.views + 1,
      likesCount: article._count?.likes || 0,
      isPublished: article.isPublished,
      author: article.author ? `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() : 'Admin',
      comments: article.comments?.map((c: any) => ({
        id: c.id,
        author: `${c.author.firstName || ''} ${c.author.lastName || ''}`.trim() || 'Аноним',
        date: c.createdAt,
        text: c.content,
        createdAt: c.createdAt,
      })) || [],
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };

    res.json(formatted);
  } catch (error: any) {
    console.error('❌ Get article error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения статьи' });
  }
};

// ============================================================
// POST /api/articles — создать статью
// ============================================================
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
      readTime 
    } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!title || !content) {
      res.status(400).json({ error: 'Заголовок и содержание обязательны' });
      return;
    }

    // Генерируем slug из заголовка
    const slug = title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const article = await prisma.article.create({
      data: {
        slug,
        title,
        content,
        description: description || title,
        imageUrl: imageUrl || images?.[0]?.url || '',
        isPublished: isPublished || false,
        readTime: readTime || 5,
        authorId: userId,
        tags: {
          create: tags.map((tagName: string) => {
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
          create: images.map((img: any, index: number) => ({
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
        images: article.images?.map((img: any) => img.url) || [],
        tags: article.tags?.map((t: any) => t.tag.name) || [],
        isPublished: article.isPublished,
        readTime: article.readTime,
        author: article.author ? `${article.author.firstName || ''} ${article.author.lastName || ''}`.trim() : 'Admin',
        createdAt: article.createdAt,
      }
    });
  } catch (error: any) {
    console.error('❌ Create article error:', error);
    res.status(500).json({ error: error.message || 'Ошибка создания статьи' });
  }
};

// ============================================================
// PUT /api/articles/:id — обновить статью
// ============================================================
export const updateArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, description, imageUrl, isPublished, tags, images, readTime } = req.body;
    const userId = (req as any).user?.id;

    // Проверяем существование статьи
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    const data: any = { 
      content, 
      description, 
      imageUrl, 
      isPublished, 
      readTime: readTime || 5,
    };
    
    if (title) {
      data.title = title;
      data.slug = title
        .toLowerCase()
        .replace(/[^a-zа-яё0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Обновляем основную статью
    const article = await prisma.article.update({
      where: { id },
      data,
    });

    // Обновляем теги
    if (tags !== undefined) {
      await prisma.articleTagRelation.deleteMany({ where: { articleId: id } });
      if (tags.length > 0) {
        const tagPromises = tags.map(async (tagName: string) => {
          const cleanTag = tagName.trim();
          const tag = await prisma.articleTag.upsert({
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
        await prisma.articleTagRelation.createMany({
          data: tagIds.map((tagId) => ({ articleId: id, tagId })),
        });
      }
    }

    // Обновляем изображения
    if (images !== undefined) {
      await prisma.articleImage.deleteMany({ where: { articleId: id } });
      if (images.length > 0) {
        await prisma.articleImage.createMany({
          data: images.map((img: any, index: number) => ({
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

    const updated = await prisma.article.findUnique({
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
        images: updated?.images?.map((img: any) => img.url) || [],
        tags: updated?.tags?.map((t: any) => t.tag.name) || [],
        isPublished: updated?.isPublished,
        readTime: updated?.readTime,
        author: updated?.author ? `${updated.author.firstName || ''} ${updated.author.lastName || ''}`.trim() : 'Admin',
        createdAt: updated?.createdAt,
        updatedAt: updated?.updatedAt,
      }
    });
  } catch (error: any) {
    console.error('❌ Update article error:', error);
    res.status(500).json({ error: error.message || 'Ошибка обновления статьи' });
  }
};

// ============================================================
// DELETE /api/articles/:id — удалить статью
// ============================================================
export const deleteArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    // Удаляем связанные данные
    await prisma.articleTagRelation.deleteMany({ where: { articleId: id } });
    await prisma.articleImage.deleteMany({ where: { articleId: id } });
    await prisma.comment.deleteMany({ where: { articleId: id } });
    await prisma.like.deleteMany({ where: { articleId: id } });
    
    // Удаляем статью
    await prisma.article.delete({ where: { id } });

    res.json({ success: true, message: 'Статья удалена' });
  } catch (error: any) {
    console.error('❌ Delete article error:', error);
    res.status(500).json({ error: error.message || 'Ошибка удаления статьи' });
  }
};