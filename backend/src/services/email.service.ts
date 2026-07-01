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