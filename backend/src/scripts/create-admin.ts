// backend/src/scripts/create-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@site.com';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  // Проверяем, есть ли уже такой пользователь
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`✅ Пользователь ${email} уже существует`);
    console.log(`   Роль: ${existing.role}`);
    console.log(`   ID: ${existing.id}`);
    return;
  }

  // Создаём admin-пользователя
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'SWAPSERVICE',
      role: 'admin',
      isVerified: true,
    },
  });

  console.log('✅ ADMIN-ПОЛЬЗОВАТЕЛЬ СОЗДАН!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Email:    ${user.email}`);
  console.log(`   Пароль:   ${password}`);
  console.log(`   Роль:     ${user.role}`);
  console.log(`   ID:       ${user.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Используй эти данные для входа в админку');
}

main()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());