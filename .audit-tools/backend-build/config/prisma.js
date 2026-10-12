"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// One client/pool per backend process. Node's module cache shares this instance
// across HTTP handlers and workers; callers must not disconnect it per request.
exports.prisma = new client_1.PrismaClient();
//# sourceMappingURL=prisma.js.map