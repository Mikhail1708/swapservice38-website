// backend/src/services/email.service.ts
import Queue from 'bull';
import nodemailer from 'nodemailer';
import redis from '../config/redis';

// ============================================================
// ФОРМАТИРОВАНИЕ ТЕЛЕФОНА
// ============================================================
const formatPhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+7 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`;
  }
  if (cleaned.length === 10) {
    return `+7 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
  }
  return phone;
};

// ============================================================
// СОЗДАНИЕ ОЧЕРЕДИ С FALLBACK
// ============================================================
let emailQueue: Queue.Queue;

try {
  emailQueue = new Queue('email queue', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });
  console.log('✅ Email очередь инициализирована');
} catch (error) {
  console.warn('⚠️ Очередь не инициализирована, email будут отправляться синхронно');
  emailQueue = {
    add: async (data: any) => {
      try {
        await sendEmailSync(data.to, data.subject, data.html);
        return { id: 'fallback-' + Date.now() };
      } catch (err) {
        console.error('❌ Ошибка отправки письма (синхронно):', err);
        throw err;
      }
    },
    process: () => {},
    on: () => emailQueue,
  } as any;
}

// ============================================================
// НАСТРОЙКА ТРАНСПОРТА
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Ошибка подключения к почтовому серверу:', error);
  } else {
    console.log('✅ Почтовый сервер настроен успешно');
  }
});

// ============================================================
// СИНХРОННАЯ ОТПРАВКА (FALLBACK)
// ============================================================
const sendEmailSync = async (to: string, subject: string, html: string) => {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'swapservice38@yandex.ru',
    to,
    subject,
    html,
  });
  return info;
};

// ============================================================
// ОБРАБОТЧИК ОЧЕРЕДИ
// ============================================================
emailQueue.process(async (job) => {
  try {
    const { to, subject, html } = job.data;
    console.log(`📧 Отправка письма на ${to}`);
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'swapservice38@yandex.ru',
      to,
      subject,
      html,
    });
    
    console.log(`✅ Письмо отправлено: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Ошибка отправки письма:', error);
    throw error;
  }
});

// ============================================================
// БАЗОВАЯ ФУНКЦИЯ ОТПРАВКИ
// ============================================================
export const sendEmail = (to: string, subject: string, html: string) => {
  emailQueue.add({ to, subject, html }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
};

// ============================================================
// ШАБЛОН ДЛЯ ПИСЕМ — СТИЛЬ SWAPSERVICE38
// ============================================================
const createEmailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SWAPSERVICE38</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #ffffff;
      color: #000000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      overflow: hidden;
    }
    /* ===== HEADER ===== */
    .header {
      padding: 32px 40px 24px;
      text-align: center;
      border-bottom: 1px solid #e0e0e0;
      background: #ffffff;
    }
    .header .logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #000000;
      text-decoration: none;
    }
    .header .logo span {
      color: #555555;
      font-weight: 300;
    }
    .header .subtitle {
      font-size: 13px;
      font-weight: 300;
      color: #555555;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .header .divider {
      width: 40px;
      height: 2px;
      background: #000000;
      margin: 12px auto 0;
    }
    /* ===== CONTENT ===== */
    .content {
      padding: 32px 40px;
    }
    .content h2 {
      font-size: 20px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 16px;
    }
    .content p {
      font-size: 15px;
      font-weight: 400;
      line-height: 1.7;
      color: #000000;
      margin-bottom: 12px;
    }
    .content .highlight {
      background: #f5f5f5;
      border-left: 3px solid #000000;
      padding: 16px 20px;
      border-radius: 6px;
      margin: 16px 0;
    }
    .content .highlight p {
      margin: 0;
      font-size: 14px;
      color: #000000;
    }
    .content .highlight strong {
      color: #000000;
      font-weight: 600;
    }
    .content .code {
      background: #f5f5f5;
      color: #000000;
      font-size: 32px;
      font-weight: 700;
      text-align: center;
      padding: 16px 24px;
      border-radius: 8px;
      letter-spacing: 8px;
      margin: 16px 0;
      font-family: 'Inter', monospace;
      border: 1px solid #e0e0e0;
    }
    .content .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      background: #f5f5f5;
      padding: 16px 20px;
      border-radius: 8px;
      margin: 12px 0;
    }
    .content .info-grid .label {
      font-size: 12px;
      font-weight: 400;
      color: #555555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .content .info-grid .value {
      font-size: 15px;
      font-weight: 600;
      color: #000000;
    }
    .content .info-grid .full {
      grid-column: 1 / -1;
    }
    .content .order-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }
    .content .order-table th {
      background: #f5f5f5;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #000000;
      border-bottom: 2px solid #000000;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .content .order-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      color: #000000;
    }
    .content .order-table .total-row td {
      font-weight: 700;
      font-size: 16px;
      border-top: 2px solid #000000;
      padding-top: 14px;
      color: #000000;
    }
    .content .order-table .discount-row td {
      color: #555555;
      font-weight: 500;
    }
    .content .status-box {
      background: #f5f5f5;
      padding: 14px 20px;
      border-radius: 8px;
      margin: 16px 0;
      border: 1px solid #e0e0e0;
    }
    .content .status-box p {
      margin: 0;
      font-size: 14px;
      color: #000000;
    }
    .content .status-box strong {
      color: #000000;
    }
    .content .btn {
      display: inline-block;
      background: #000000;
      color: #ffffff;
      padding: 10px 28px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      margin-top: 8px;
      transition: background 0.2s;
    }
    .content .btn:hover {
      background: #333333;
    }
    .content .text-muted {
      color: #555555;
      font-size: 13px;
    }
    .content .text-muted a {
      color: #000000;
      text-decoration: underline;
      font-weight: 500;
    }
    /* ===== FOOTER ===== */
    .footer {
      padding: 24px 40px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      background: #ffffff;
    }
    .footer .contacts {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .footer .contacts span {
      font-size: 13px;
      color: #000000;
      font-weight: 400;
    }
    .footer .contacts span strong {
      color: #000000;
      font-weight: 600;
    }
    .footer .social {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin: 12px 0;
    }
    .footer .social a {
      color: #555555;
      text-decoration: none;
      font-size: 13px;
      font-weight: 400;
      transition: color 0.2s;
    }
    .footer .social a:hover {
      color: #000000;
    }
    .footer .copy {
      font-size: 12px;
      color: #999999;
      margin-top: 8px;
      font-weight: 300;
    }
    /* ===== RESPONSIVE ===== */
    @media (max-width: 480px) {
      body {
        padding: 16px 12px;
      }
      .header {
        padding: 24px 20px;
      }
      .header .logo {
        font-size: 20px;
      }
      .content {
        padding: 24px 20px;
      }
      .content .info-grid {
        grid-template-columns: 1fr;
      }
      .content .order-table th,
      .content .order-table td {
        padding: 8px 10px;
        font-size: 13px;
      }
      .footer {
        padding: 20px;
      }
      .footer .contacts {
        gap: 10px;
        flex-direction: column;
      }
      .footer .contacts span {
        font-size: 13px;
      }
      .content .code {
        font-size: 24px;
        letter-spacing: 4px;
        padding: 12px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <div class="logo">SWAP<span>SERVICE38</span></div>
      <div class="subtitle">Производство и установка тюнинг-комплектов</div>
      <div class="divider"></div>
    </div>
    <!-- CONTENT -->
    <div class="content">
      ${content}
    </div>
    <!-- FOOTER -->
    <div class="footer">
      <div class="contacts">
        <span>📞 <strong>+7 983 446 08 88</strong></span>
        <span>✉️ swapservice38@yandex.ru</span>
        <span>📍 Иркутск, ул. Новаторов 36</span>
      </div>
      <div class="social">
        <a href="https://t.me/swapservice38">Telegram</a>
        <a href="https://instagram.com/swapservice38">Instagram</a>
        <a href="https://youtube.com/swapservice38">YouTube</a>
      </div>
      <div class="copy">© ${new Date().getFullYear()} SWAPSERVICE38. Все права защищены.</div>
    </div>
  </div>
</body>
</html>
`;

// ============================================================
// ОТПРАВКА КОДА ПОДТВЕРЖДЕНИЯ
// ============================================================
export const sendVerificationEmail = (email: string, code: string) => {
  const content = `
    <h2>Подтверждение регистрации</h2>
    <p>Здравствуйте!</p>
    <p>Вы зарегистрировались на сайте <strong>SWAPSERVICE38</strong>.</p>
    <p>Для завершения регистрации введите код подтверждения:</p>
    <div class="code">${code}</div>
    <p class="text-muted">Код действителен в течение <strong>10 минут</strong>.</p>
    <p class="text-muted" style="margin-top: 16px;">
      Если вы не регистрировались, просто проигнорируйте это письмо.
    </p>
  `;

  return sendEmail(email, 'Подтверждение регистрации на SWAPSERVICE38', createEmailTemplate(content));
};

// ============================================================
// ОТПРАВКА КОДА ВОССТАНОВЛЕНИЯ ПАРОЛЯ
// ============================================================
export const sendPasswordResetEmail = (email: string, code: string) => {
  const content = `
    <h2>Восстановление пароля</h2>
    <p>Здравствуйте!</p>
    <p>Вы запросили восстановление пароля на сайте <strong>SWAPSERVICE38</strong>.</p>
    <p>Для восстановления пароля введите код:</p>
    <div class="code">${code}</div>
    <p class="text-muted">Код действителен в течение <strong>15 минут</strong>.</p>
    <p class="text-muted" style="margin-top: 16px;">
      Если вы не запрашивали восстановление, просто проигнорируйте это письмо.
    </p>
  `;

  return sendEmail(email, 'Восстановление пароля на SWAPSERVICE38', createEmailTemplate(content));
};

// ============================================================
// ОТПРАВКА КОДА СМЕНЫ ПАРОЛЯ
// ============================================================
export const sendPasswordChangeEmail = (email: string, code: string) => {
  const content = `
    <h2>Смена пароля</h2>
    <p>Здравствуйте!</p>
    <p>Вы запросили смену пароля на сайте <strong>SWAPSERVICE38</strong>.</p>
    <p>Для подтверждения введите код:</p>
    <div class="code">${code}</div>
    <p class="text-muted">Код действителен в течение <strong>15 минут</strong>.</p>
    <p class="text-muted" style="margin-top: 16px;">
      Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.
    </p>
  `;

  return sendEmail(email, 'Смена пароля на SWAPSERVICE38', createEmailTemplate(content));
};

// ============================================================
// ПОДТВЕРЖДЕНИЕ ЗАКАЗА ДЛЯ КЛИЕНТА
// ============================================================
export const sendOrderConfirmationToCustomer = async (data: {
  orderId: string;
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number; total: number }>;
  deliveryAddress: string;
  comment: string;
  paymentId: string;
}) => {
  if (!data.customerEmail) {
    console.warn(`⚠️ Нет email клиента для заказа ${data.orderId}, пропускаем`);
    return;
  }

  // ✅ ПРОВЕРКА НА ДУБЛИРОВАНИЕ
  const notificationKey = `order:notified:customer:${data.orderId}`;
  try {
    const cached = await redis.get(notificationKey);
    if (cached) {
      console.log(`ℹ️ Уведомление клиенту для заказа ${data.orderId} уже отправлено, пропускаем`);
      return;
    }
  } catch (error) {
    console.warn('⚠️ Ошибка проверки Redis:', error);
  }

  const formattedPhone = formatPhone(data.customerPhone);

  const itemsHtml = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.name}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">${item.price.toLocaleString()} ₽</td>
      <td style="text-align: right;">${item.total.toLocaleString()} ₽</td>
    </tr>
  `).join('');

  const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);

  const content = `
    <h2>✅ Заказ подтверждён</h2>
    <p>Здравствуйте, <strong>${data.customerName}</strong>!</p>
    <p>Спасибо за заказ в <strong>SWAPSERVICE38</strong>. Мы уже начали его обрабатывать.</p>

    <div class="highlight">
      <p><strong>Номер заказа:</strong> #${data.documentNumber}</p>
      <p><strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
      <p><strong>Сумма:</strong> ${data.total.toLocaleString()} ₽</p>
    </div>

    <h3 style="margin-top: 20px; font-size: 16px; font-weight: 600;">Товары в заказе</h3>
    <table class="order-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Наименование</th>
          <th style="text-align: center;">Кол-во</th>
          <th style="text-align: right;">Цена</th>
          <th style="text-align: right;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="total-row">
          <td colspan="4" style="text-align: right;">Итого:</td>
          <td style="text-align: right;">${data.total.toLocaleString()} ₽</td>
        </tr>
      </tbody>
    </table>

    <div class="info-grid">
      <div>
        <div class="label">Клиент</div>
        <div class="value">${data.customerName}</div>
      </div>
      <div>
        <div class="label">Телефон</div>
        <div class="value">${formattedPhone || 'Не указан'}</div>
      </div>
      ${data.deliveryAddress ? `
        <div class="full">
          <div class="label">📍 Адрес доставки</div>
          <div class="value">${data.deliveryAddress}</div>
        </div>
      ` : ''}
      ${data.comment ? `
        <div class="full">
          <div class="label">📝 Комментарий к заказу</div>
          <div class="value" style="font-weight: 400;">${data.comment}</div>
        </div>
      ` : ''}
    </div>

    <div class="status-box">
      <p><strong>Статус заказа:</strong> Оплачен, ожидает подтверждения</p>
      <p style="font-size: 13px; color: #555555; margin-top: 4px;">
        Наш менеджер свяжется с вами в ближайшее время для уточнения деталей.
      </p>
    </div>

    <p style="margin-top: 20px; font-size: 14px;">
      Отслеживать статус заказа можно в 
      <a href="${process.env.CLIENT_URL || 'http://localhost:3001'}/profile/orders" style="color: #000000; text-decoration: underline; font-weight: 600;">личном кабинете</a>.
    </p>
    <p class="text-muted">
      По всем вопросам звоните: <strong>+7 983 446 08 88</strong>
    </p>
  `;

  await sendEmail(
    data.customerEmail,
    `Подтверждение заказа #${data.documentNumber}`,
    createEmailTemplate(content)
  );

  // ✅ СОХРАНЯЕМ В REDIS
  try {
    await redis.setex(notificationKey, 7 * 24 * 60 * 60, 'true');
  } catch (error) {
    console.warn('⚠️ Не удалось сохранить в Redis:', error);
  }
};

// ============================================================
// УВЕДОМЛЕНИЕ МЕНЕДЖЕРА О НОВОМ ЗАКАЗЕ
// ============================================================
export const sendOrderNotificationToManager = async (data: {
  orderId: string;
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number; total: number }>;
  deliveryAddress: string;
  comment: string;
  paymentId: string;
}) => {
  const managerEmail = process.env.MANAGER_EMAIL || 'swapservice38@yandex.ru';
  
  // ✅ ПРОВЕРКА НА ДУБЛИРОВАНИЕ
  const notificationKey = `order:notified:manager:${data.orderId}`;
  try {
    const cached = await redis.get(notificationKey);
    if (cached) {
      console.log(`ℹ️ Уведомление менеджеру для заказа ${data.orderId} уже отправлено, пропускаем`);
      return;
    }
  } catch (error) {
    console.warn('⚠️ Ошибка проверки Redis:', error);
  }

  const formattedPhone = formatPhone(data.customerPhone);

  const itemsHtml = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.name}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">${item.price.toLocaleString()} ₽</td>
      <td style="text-align: right;">${item.total.toLocaleString()} ₽</td>
    </tr>
  `).join('');

  const content = `
    <h2>Новый заказ на сайте</h2>
    
    <div class="highlight">
      <p style="font-size: 18px; font-weight: 700;">Заказ #${data.documentNumber}</p>
      <p style="font-size: 16px;">Сумма: <strong>${data.total.toLocaleString()} ₽</strong></p>
    </div>

    <div class="info-grid">
      <div>
        <div class="label">Клиент</div>
        <div class="value">${data.customerName}</div>
      </div>
      <div>
        <div class="label">Телефон</div>
        <div class="value">${formattedPhone || 'Не указан'}</div>
      </div>
      <div>
        <div class="label">Email</div>
        <div class="value">${data.customerEmail || 'Не указан'}</div>
      </div>
      <div>
        <div class="label">Дата заказа</div>
        <div class="value">${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU')}</div>
      </div>
      ${data.deliveryAddress ? `
        <div class="full">
          <div class="label">📍 Адрес доставки</div>
          <div class="value">${data.deliveryAddress}</div>
        </div>
      ` : ''}
      ${data.comment ? `
        <div class="full">
          <div class="label">📝 Комментарий</div>
          <div class="value" style="font-weight: 400;">${data.comment}</div>
        </div>
      ` : ''}
    </div>

    <h3 style="margin-top: 20px; font-size: 16px; font-weight: 600;">Товары в заказе</h3>
    <table class="order-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Наименование</th>
          <th style="text-align: center;">Кол-во</th>
          <th style="text-align: right;">Цена</th>
          <th style="text-align: right;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="total-row">
          <td colspan="4" style="text-align: right;">Итого:</td>
          <td style="text-align: right;">${data.total.toLocaleString()} ₽</td>
        </tr>
      </tbody>
    </table>

    <div class="status-box">
      <p><strong>Действие:</strong> Перейдите в админ-панель для подтверждения заказа.</p>
    </div>

    <p style="margin-top: 16px;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3001'}/admin/orders" class="btn">
        📋 Перейти к заказу
      </a>
    </p>
  `;

  await sendEmail(
    managerEmail,
    `Новый заказ #${data.documentNumber}`,
    createEmailTemplate(content)
  );

  // ✅ СОХРАНЯЕМ В REDIS
  try {
    await redis.setex(notificationKey, 7 * 24 * 60 * 60, 'true');
  } catch (error) {
    console.warn('⚠️ Не удалось сохранить в Redis:', error);
  }
};