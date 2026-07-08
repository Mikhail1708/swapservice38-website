import Queue from 'bull';
import nodemailer from 'nodemailer';
import redis from '../config/redis';

const emailQueue = new Queue('email queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Настройка транспорта для Яндекса
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true', // true для 465, false для других
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Для Яндекса важно указать эти настройки
  tls: {
    rejectUnauthorized: false,
  },
});

// Проверка подключения при старте
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Ошибка подключения к почтовому серверу:', error);
  } else {
    console.log('✅ Почтовый сервер настроен успешно');
  }
});

// Обработчик очереди
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

// Функция для добавления письма в очередь
export const sendEmail = (to: string, subject: string, html: string) => {
  emailQueue.add({ to, subject, html }, {
    attempts: 3, // Повторить 3 раза при ошибке
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 секунд
    },
  });
};

// Функция для отправки кода подтверждения
export const sendVerificationEmail = (email: string, code: string) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .code { font-size: 32px; font-weight: bold; color: #e94560; text-align: center; padding: 20px; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SWAPSERVICE38</h1>
          <p>Подтверждение регистрации</p>
        </div>
        <div style="padding: 20px;">
          <p>Здравствуйте!</p>
          <p>Вы зарегистрировались на сайте <strong>SWAPSERVICE38</strong>.</p>
          <p>Для завершения регистрации введите код подтверждения:</p>
          <div class="code">${code}</div>
          <p>Код действителен в течение <strong>10 минут</strong>.</p>
          <p>Если вы не регистрировались, просто проигнорируйте это письмо.</p>
        </div>
        <div class="footer">
          <p>© 2026 SWAPSERVICE38. Все права защищены.</p>
          <p>г. Иркутск, ул. ...</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, 'Подтверждение регистрации на SWAPSERVICE38', html);
};

// Функция для отправки кода восстановления пароля
export const sendPasswordResetEmail = (email: string, code: string) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .code { font-size: 32px; font-weight: bold; color: #e94560; text-align: center; padding: 20px; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SWAPSERVICE38</h1>
          <p>Восстановление пароля</p>
        </div>
        <div style="padding: 20px;">
          <p>Здравствуйте!</p>
          <p>Вы запросили восстановление пароля на сайте <strong>SWAPSERVICE38</strong>.</p>
          <p>Для восстановления пароля введите код:</p>
          <div class="code">${code}</div>
          <p>Код действителен в течение <strong>15 минут</strong>.</p>
          <p>Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>
        </div>
        <div class="footer">
          <p>© 2026 SWAPSERVICE38. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(email, 'Восстановление пароля на SWAPSERVICE38', html);
};
// Добавь в конец файла после sendPasswordResetEmail

// Функция для отправки кода смены пароля
export const sendPasswordChangeEmail = (email: string, code: string) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .code { font-size: 32px; font-weight: bold; color: #e94560; text-align: center; padding: 20px; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SWAPSERVICE38</h1>
          <p>Смена пароля</p>
        </div>
        <div style="padding: 20px;">
          <p>Здравствуйте!</p>
          <p>Вы запросили смену пароля на сайте <strong>SWAPSERVICE38</strong>.</p>
          <p>Для подтверждения введите код:</p>
          <div class="code">${code}</div>
          <p>Код действителен в течение <strong>15 минут</strong>.</p>
          <p>Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.</p>
        </div>
        <div class="footer">
          <p>© 2026 SWAPSERVICE38. Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, 'Смена пароля на SWAPSERVICE38', html);
};
// ============================================================
// УВЕДОМЛЕНИЯ О ЗАКАЗАХ
// ============================================================

interface OrderEmailData {
  orderId: number;
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  deliveryAddress?: string;
  comment?: string;
  paymentId?: string;
}

/**
 * Отправка письма покупателю об успешной оплате
 */
export const sendOrderConfirmationToCustomer = async (data: OrderEmailData): Promise<void> => {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString()} ₽</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.total.toLocaleString()} ₽</td>
    </tr>
  `).join('');

  const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #000; }
        .logo { font-size: 24px; font-weight: bold; color: #000; }
        .logo span { color: #666; }
        .content { padding: 20px 0; }
        .order-details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .total { font-size: 20px; font-weight: bold; text-align: right; padding-top: 10px; border-top: 2px solid #000; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px; }
        .status-badge { display: inline-block; padding: 4px 16px; background: #22c55e; color: #fff; border-radius: 20px; font-size: 13px; font-weight: bold; }
        .info-block { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 15px 0; border-radius: 4px; }
        .info-block-success { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 15px 0; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #000; color: #fff; padding: 10px; text-align: left; font-size: 13px; }
        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
        .contacts { text-align: center; margin-top: 20px; padding: 15px; background: #fafafa; border-radius: 8px; }
        .contacts a { color: #000; text-decoration: none; }
        .contacts a:hover { text-decoration: underline; }
        @media only screen and (max-width: 480px) {
          .container { padding: 10px; }
          table, tr, td { font-size: 12px; }
          th { font-size: 11px; padding: 6px; }
          td { padding: 6px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏎️ SWAP SERVICE 38 <span></span></div>
          <p style="color: #666; margin: 5px 0 0; font-size: 14px;">Профессиональные свапы двигателей</p>
        </div>

        <div class="content">
          <h2 style="margin-bottom: 5px;">Здравствуйте, ${data.customerName}!</h2>
          <p style="color: #666; margin-top: 0;">Благодарим вас за заказ в нашем магазине.</p>
          
          <div class="info-block-success">
            <p style="margin: 0; font-size: 15px;">
              ✅ Ваш заказ <strong>№${data.documentNumber}</strong> 
              <span class="status-badge">ОПЛАЧЕН</span>
            </p>
          </div>
          
          <div class="info-block">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>📌 Важно:</strong> Наш менеджер свяжется с вами в ближайшее время 
              для подтверждения заказа и уточнения деталей доставки.
            </p>
            <p style="margin: 5px 0 0; color: #1e40af; font-size: 13px;">
              Обычно мы связываемся с клиентами в течение 1-2 часов в рабочее время.
            </p>
          </div>

          <div class="order-details">
            <h3 style="margin-top: 0; font-size: 15px;">📋 Информация о заказе</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; border: none; font-size: 14px;"><strong>Номер заказа:</strong></td>
                <td style="padding: 4px 0; border: none; text-align: right; font-size: 14px;">${data.documentNumber}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; border: none; font-size: 14px;"><strong>Телефон:</strong></td>
                <td style="padding: 4px 0; border: none; text-align: right; font-size: 14px;">${data.customerPhone}</td>
              </tr>
              ${data.deliveryAddress ? `
              <tr>
                <td style="padding: 4px 0; border: none; font-size: 14px;"><strong>Адрес доставки:</strong></td>
                <td style="padding: 4px 0; border: none; text-align: right; font-size: 14px;">${data.deliveryAddress}</td>
              </tr>
              ` : ''}
              ${data.comment ? `
              <tr>
                <td style="padding: 4px 0; border: none; font-size: 14px;"><strong>Комментарий:</strong></td>
                <td style="padding: 4px 0; border: none; text-align: right; font-size: 14px;">${data.comment}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <h3 style="font-size: 15px;">🛒 Состав заказа</h3>
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th style="text-align: center;">Кол-во</th>
                <th style="text-align: right;">Цена</th>
                <th style="text-align: right;">Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="margin-top: 15px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border: none; font-size: 14px;"><strong>Всего товаров:</strong></td>
                <td style="padding: 8px 0; border: none; text-align: right; font-size: 14px;">${totalItems} шт.</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border: none; font-size: 14px;"><strong>К оплате:</strong></td>
                <td style="padding: 8px 0; border: none; text-align: right; font-size: 20px; font-weight: bold;">${data.total.toLocaleString()} ₽</td>
              </tr>
            </table>
          </div>

          <div class="contacts">
            <p style="margin: 0 0 8px; font-weight: bold; font-size: 14px;">📞 Свяжитесь с нами</p>
            <p style="margin: 4px 0; font-size: 14px;">
              <a href="tel:+79834460888">+7 (983) 446-08-88</a> &nbsp;|&nbsp;
              <a href="mailto:swapservice38@yandex.ru">swapservice38@yandex.ru</a>
            </p>
            <p style="margin: 4px 0; font-size: 13px; color: #666;">
              📍 г. Иркутск, ул. Новаторов 36
            </p>
            <p style="margin: 4px 0; font-size: 13px; color: #666;">
              🕐 Ежедневно с 10:00 до 20:00
            </p>
          </div>
        </div>

        <div class="footer">
          <p style="margin: 0;">© ${new Date().getFullYear()} SWAP SERVICE 38 — Все права защищены</p>
          <p style="margin: 5px 0 0;">
            <a href="https://swapservice38.ru" style="color: #999; text-decoration: none;">swapservice38.ru</a>
          </p>
          <p style="margin: 5px 0 0; font-size: 11px; color: #bbb;">
            Это письмо было отправлено автоматически. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Здравствуйте, ${data.customerName}!
    
    Ваш заказ №${data.documentNumber} успешно ОПЛАЧЕН.
    
    Наш менеджер свяжется с вами в ближайшее время для подтверждения заказа и уточнения деталей доставки.
    
    Информация о заказе:
    Номер: ${data.documentNumber}
    Телефон: ${data.customerPhone}
    ${data.deliveryAddress ? `Адрес доставки: ${data.deliveryAddress}` : ''}
    ${data.comment ? `Комментарий: ${data.comment}` : ''}
    
    Состав заказа:
    ${data.items.map(item => `  - ${item.name} × ${item.quantity} = ${item.total.toLocaleString()} ₽`).join('\n')}
    
    Итого: ${data.total.toLocaleString()} ₽
    
    Свяжитесь с нами:
    Телефон: +7 (914) 895-58-88
    Email: swapservice38@yandex.ru
    Адрес: г. Иркутск, ул. Новаторов 36
    
    С уважением,
    Команда SWAP SERVICE 38
  `;

  // Отправляем письмо через очередь
  sendEmail(data.customerEmail, `✅ Заказ №${data.documentNumber} оплачен — SWAP SERVICE 38`, html);
};

/**
 * Отправка письма менеджеру о новом заказе
 */
export const sendOrderNotificationToManager = async (data: OrderEmailData): Promise<void> => {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.total.toLocaleString()} ₽</td>
    </tr>
  `).join('');

  const managerEmail = process.env.MANAGER_EMAIL || 'gurin@crm.ru';
  const managerEmail2 = process.env.MANAGER_EMAIL_2 || 'batvenko@crm.ru';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000; color: #fff; padding: 15px 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
        .badge { display: inline-block; padding: 4px 12px; background: #22c55e; color: #fff; border-radius: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f5f5f5; padding: 8px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; text-align: right; padding-top: 10px; }
        .info { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🛒 Новый заказ с сайта!</h2>
        </div>
        <div class="content">
          <p><strong>Заказ №${data.documentNumber}</strong> <span class="badge">ОПЛАЧЕН</span></p>
          
          <div class="info">
            <p><strong>Клиент:</strong> ${data.customerName}</p>
            <p><strong>Телефон:</strong> <a href="tel:${data.customerPhone}">${data.customerPhone}</a></p>
            <p><strong>Email:</strong> <a href="mailto:${data.customerEmail}">${data.customerEmail}</a></p>
            ${data.deliveryAddress ? `<p><strong>Адрес:</strong> ${data.deliveryAddress}</p>` : ''}
            ${data.comment ? `<p><strong>Комментарий:</strong> ${data.comment}</p>` : ''}
          </div>

          <h4>Товары:</h4>
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th style="text-align: center;">Кол-во</th>
                <th style="text-align: right;">Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total">
            Итого: ${data.total.toLocaleString()} ₽
          </div>

          <div style="margin-top: 20px; padding: 10px; background: #f0fdf4; border-radius: 4px; border-left: 4px solid #22c55e;">
            <p style="margin: 0; color: #166534;">
              ⏳ Требуется обработка заказа. Свяжитесь с клиентом для подтверждения.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Отправляем менеджерам
  sendEmail(managerEmail, `🛒 Новый заказ №${data.documentNumber}`, html);
  if (managerEmail2) {
    sendEmail(managerEmail2, `🛒 Новый заказ №${data.documentNumber}`, html);
  }
};

/**
 * Отправка уведомления об изменении статуса заказа
 */
export const sendOrderStatusUpdate = async (
  email: string,
  name: string,
  orderNumber: string,
  status: string,
  statusText: string
): Promise<void> => {
  const statusColors: Record<string, string> = {
    'confirmed': '#3b82f6',
    'packing': '#f59e0b',
    'shipped': '#8b5cf6',
    'delivered': '#22c55e',
    'cancelled': '#ef4444',
  };

  const color = statusColors[status] || '#666';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 10px; }
        .status { display: inline-block; padding: 6px 16px; background: ${color}; color: #fff; border-radius: 20px; font-weight: bold; }
        .content { padding: 20px 0; }
        .footer { border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🏎️ SWAP SERVICE 38</h2>
        </div>
        <div class="content">
          <p>Здравствуйте, ${name}!</p>
          <p>Статус вашего заказа <strong>№${orderNumber}</strong> изменился:</p>
          <p style="text-align: center; font-size: 18px; padding: 10px;">
            <span class="status">${statusText}</span>
          </p>
          <p>Вы можете отслеживать статус заказа в личном кабинете.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} SWAP SERVICE 38</p>
        </div>
      </div>
    </body>
    </html>
  `;

  sendEmail(email, `Статус заказа №${orderNumber} изменён`, html);
};