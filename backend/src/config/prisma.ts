import { PrismaClient } from '@prisma/client';

// One client/pool per backend process. Node's module cache shares this instance
// across HTTP handlers and workers; callers must not disconnect it per request.
export const prisma = new PrismaClient();
