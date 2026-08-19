// backend/tests/helpers/teardown.ts

module.exports = async () => {
  console.log('🧹 Завершение тестов...');
  // Global teardown runs in a separate module context. Importing application
  // Redis/Prisma clients here creates new real connections instead of closing
  // the mocked clients used by tests, so teardown must not initialize them.
  console.log('✅ Тесты завершены');
};
