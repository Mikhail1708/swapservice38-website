// backend/create-admin.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 СОЗДАНИЕ АДМИНИСТРАТОРА');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
    
    if (existing.role !== 'admin') {
      console.log('🔄 Обновляем роль до admin...');
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'admin' },
      });
      console.log(`✅ Пользователь ${email} теперь администратор!`);
    }
    process.exit(0);
  }

  // Создаём admin-пользователя
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: '',
      role: 'admin',
      isVerified: true,
    },
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ АДМИНИСТРАТОР СОЗДАН!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Email:    ${user.email}`);
  console.log(`   Пароль:   ${password}`);
  console.log(`   Роль:     ${user.role}`);
  console.log(`   ID:       ${user.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Используй эти данные для входа в админку\n');
}

main()
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());