"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/upload.routes.ts
const express_1 = require("express");
const role_middleware_1 = require("../middleware/role.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
// ============================================================
// НАСТРОЙКА MULTER
// ============================================================
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
// Создаём папку если её нет
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    logger_1.log.info('📁 Создана папка uploads: ' + uploadsDir);
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        cb(null, uniqueName);
    },
});
// Фильтр файлов — только изображения
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Неподдерживаемый формат изображения. Разрешены: JPEG, PNG, WebP, GIF, SVG'), false);
    }
};
// fetchWithCsrf adds one flat _csrf field. Nested/array fields are not part of this API.
const uploadLimits = {
    fields: 1,
    fieldNestingDepth: 0,
    fieldArrayIndexLimit: 0,
    fileSize: 10 * 1024 * 1024, // 10MB
};
const upload = (0, multer_1.default)({
    storage,
    limits: uploadLimits,
    fileFilter,
});
// ============================================================
// POST /api/upload — ЗАГРУЗКА ФАЙЛА
// ============================================================
router.post('/', auth_middleware_1.requireAuth, role_middleware_1.requireAdmin, // ✅ ТОЛЬКО ADMIN ИЛИ MANAGER
upload.single('file'), (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                error: 'Файл не загружен',
                code: 'NO_FILE',
            });
        }
        // Возвращаем same-origin URL: в production /uploads проксируется Nginx на backend.
        const url = `/uploads/${file.filename}`;
        logger_1.log.info('File uploaded', { filename: file.filename, size: file.size });
        res.json({
            success: true,
            url,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
            originalName: file.originalname,
        });
    }
    catch (error) {
        logger_1.log.error('❌ Ошибка загрузки файла:', error);
        res.status(500).json({
            error: 'Ошибка загрузки файла',
            code: 'UPLOAD_ERROR',
        });
    }
});
// ============================================================
// ОБРАБОТКА ОШИБОК MULTER
// ============================================================
router.use((error, req, res, next) => {
    if (error instanceof multer_1.default.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'Файл слишком большой. Максимальный размер 10MB',
                code: 'FILE_TOO_LARGE',
            });
        }
        return res.status(400).json({
            error: 'Файл не соответствует требованиям загрузки',
            code: error.code,
        });
    }
    next(error);
});
exports.default = router;
//# sourceMappingURL=upload.routes.js.map