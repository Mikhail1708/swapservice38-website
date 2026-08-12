// backend/src/routes/upload.routes.ts
import { Router } from 'express';
import { requireAdmin } from '../middleware/role.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { log } from '../config/logger';

const router = Router();

// ============================================================
// НАСТРОЙКА MULTER
// ============================================================
const uploadsDir = path.join(__dirname, '../../uploads');

// Создаём папку если её нет
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  log.info('📁 Создана папка uploads: ' + uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, uniqueName);
  },
});

// Фильтр файлов — только изображения
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый формат изображения. Разрешены: JPEG, PNG, WebP, GIF, SVG'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

// ============================================================
// POST /api/upload — ЗАГРУЗКА ФАЙЛА
// ============================================================
router.post(
  '/',
  requireAdmin, // ✅ ТОЛЬКО ADMIN ИЛИ MANAGER
  upload.single('file'),
  (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ 
          error: 'Файл не загружен',
          code: 'NO_FILE',
        });
      }

      // Формируем URL для доступа к файлу
      const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5001}`;
      const url = `${baseUrl}/uploads/${file.filename}`;

      log.info(`📤 Файл загружен: ${file.filename} (${file.size} bytes) пользователем ${(req as any).user?.email}`);

      res.json({
        success: true,
        url,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        originalName: file.originalname,
      });
    } catch (error: any) {
      log.error('❌ Ошибка загрузки файла:', error);
      res.status(500).json({
        error: 'Ошибка загрузки файла',
        code: 'UPLOAD_ERROR',
        details: error.message,
      });
    }
  }
);

// ============================================================
// ОБРАБОТКА ОШИБОК MULTER
// ============================================================
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({
        error: 'Файл слишком большой. Максимальный размер 10MB',
        code: 'FILE_TOO_LARGE',
      });
    }
    return res.status(400).json({
      error: error.message,
      code: error.code,
    });
  }
  next(error);
});

export default router;