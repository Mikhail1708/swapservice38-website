const BRAND = {
  name: 'SWAPSERVICE38',
  siteName: 'SWAP SERVICE 38',
  phone: '+7 983 446 08 88',
  email: 'swapservice38@yandex.ru',
  address: 'Иркутск, ул. Новаторов, 36',
};
// Legal contact is distinct from the product manager in the shared brand footer.
const SELLER = {
  name: 'ИП Батвенко Николай Сергеевич', inn: '381011379046', ogrnip: '315385000059546',
  phone: '+7 (924) 533-08-80', tel: 'tel:+79245330880', email: 'swap38@mail.ru',
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatMoney = (value: number): string => `${value.toLocaleString('ru-RU')} ₽`;
const formatDate = (): string => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date());

const publicAppUrl = (): URL => {
  const configuredUrl = process.env.PUBLIC_APP_URL
    || process.env.FRONTEND_URL
    || process.env.SITE_URL
    || process.env.CLIENT_URL;
  if (!configuredUrl) throw new Error('PUBLIC_APP_URL (or CLIENT_URL) is required to render email links');
  const url = new URL(configuredUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Email public URL must use HTTP(S)');
  return url;
};

const publicUrl = (pathname: string, search?: Record<string, string>): string => {
  const url = new URL(pathname, publicAppUrl());
  Object.entries(search || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return escapeHtml(url.toString());
};

type EmailShellOptions = {
  title: string;
  preheader: string;
  icon: string;
  content: string;
  date?: string;
};

const emailShell = ({ title, preheader, icon, content, date }: EmailShellOptions): string => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(title)} — SWAPSERVICE38</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    body { margin:0 !important; padding:0 !important; width:100% !important; min-width:100% !important; background:#0c0c0d; color:#f2f2f3; font-family:Arial,Helvetica,sans-serif; }
    table { border-spacing:0; border-collapse:collapse; }
    img { display:block; border:0; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    @media only screen and (max-width:640px) {
      .outer-padding { padding:0 !important; }
      .email-container { width:100% !important; max-width:100% !important; border-radius:0 !important; }
      .email-padding { padding-left:20px !important; padding-right:20px !important; }
      .mobile-block { display:block !important; width:100% !important; box-sizing:border-box !important; }
      .mobile-center { text-align:center !important; }
      .hide-mobile { display:none !important; }
      .title { font-size:24px !important; line-height:30px !important; }
      .summary-cell { border-right:0 !important; border-top:1px solid #303035 !important; }
      .summary-first { border-top:0 !important; }
      .card-gap { padding-left:0 !important; padding-top:12px !important; }
      .product-table { font-size:12px !important; }
      .product-table td { box-sizing:border-box !important; padding-left:4px !important; padding-right:4px !important; font-size:10px !important; }
      .product-index { width:7% !important; }
      .product-name { width:49% !important; word-break:break-word !important; }
      .product-quantity { width:16% !important; }
      .product-total { width:28% !important; }
      .brand-subtitle { max-width:300px !important; margin-left:auto !important; margin-right:auto !important; font-size:10px !important; line-height:16px !important; letter-spacing:1px !important; white-space:normal !important; }
      .progress-cell { box-sizing:border-box !important; padding-left:2px !important; padding-right:2px !important; }
      .code-value { font-size:30px !important; letter-spacing:7px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0c0c0d;color:#f2f2f3;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#0c0c0d;">
    <tr>
      <td class="outer-padding" align="center" style="padding:32px 16px;">
        <table role="presentation" width="720" cellpadding="0" cellspacing="0" border="0" class="email-container" style="width:720px;max-width:720px;background:#111113;border:1px solid #2a2a2e;border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:40px 30px 32px;background:#111113;border-bottom:1px solid #2a2a2e;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px;background:#f4f4f5;border-radius:8px;">
                <tr><td align="center" style="padding:10px;"><img src="cid:swapservice38-logo" width="82" alt="SWAPSERVICE38" style="width:82px;max-width:82px;height:auto;margin:0 auto;"></td></tr>
              </table>
              <div class="brand-subtitle" style="font-size:12px;line-height:18px;color:#9a9a9f;text-transform:uppercase;letter-spacing:1.6px;">Производство и установка тюнинг-комплектов</div>
              <div style="width:42px;height:2px;background:#f4f4f5;margin:20px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:42px 38px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="58" valign="top" style="width:58px;">
                    <div style="width:44px;height:44px;border:1px solid #5a5a60;border-radius:8px;text-align:center;line-height:44px;color:#ffffff;font-size:22px;">${escapeHtml(icon)}</div>
                  </td>
                  <td valign="middle">
                    <div class="title" style="margin:0;font-size:28px;line-height:34px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f2f2f3;">${escapeHtml(title)}</div>
                    ${date ? `<div style="margin-top:5px;font-size:12px;line-height:18px;color:#8d8d93;text-transform:uppercase;letter-spacing:.8px;">${escapeHtml(date)}</div>` : ''}
                  </td>
                </tr>
              </table>
              ${content}
            </td>
          </tr>
          <tr>
            <td class="email-padding" align="center" style="padding:30px 38px 32px;background:#0c0c0d;border-top:1px solid #2a2a2e;">
              <div style="font-size:14px;line-height:20px;color:#f2f2f3;font-weight:700;letter-spacing:1px;">${BRAND.name}</div>
              <div style="margin-top:12px;font-size:12px;line-height:20px;color:#9a9a9f;">${BRAND.phone}&nbsp;&nbsp;·&nbsp;&nbsp;${BRAND.email}</div>
              <div style="font-size:12px;line-height:20px;color:#9a9a9f;">${BRAND.address}</div>
              <div style="width:42px;height:1px;background:#303035;margin:20px auto;"></div>
              <div style="font-size:11px;line-height:18px;color:#6f6f74;">© ${new Date().getFullYear()} ${BRAND.name}. Все права защищены.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const greeting = (customerName?: string, message?: string): string => `
  <div style="margin-top:28px;font-size:16px;line-height:26px;color:#f2f2f3;">Здравствуйте${customerName ? `, <strong style="font-weight:700;color:#ffffff;">${escapeHtml(customerName)}</strong>` : ''}!</div>
  ${message ? `<div style="margin-top:12px;font-size:15px;line-height:24px;color:#b8b8bd;">${message}</div>` : ''}`;

const sectionTitle = (title: string): string => `<div style="margin-top:34px;margin-bottom:15px;font-size:14px;line-height:20px;color:#f2f2f3;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${escapeHtml(title)}</div>`;

const fullWidthCta = (label: string, href: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:30px;">
    <tr><td align="center" style="background:#f4f4f5;border-radius:6px;"><a href="${href}" style="display:block;width:100%;box-sizing:border-box;padding:18px 20px;color:#111113;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;text-align:center;">${escapeHtml(label)} &nbsp;→</a></td></tr>
  </table>`;

type SummaryItem = { label: string; value: string; description?: string };

const summaryTable = (items: [SummaryItem, SummaryItem, SummaryItem]): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:30px;background:#18181b;border:1px solid #303035;border-radius:8px;">
    <tr>${items.map((item, index) => `
      <td class="mobile-block summary-cell${index === 0 ? ' summary-first' : ''}" width="33.33%" valign="top" style="width:33.33%;padding:22px;${index < 2 ? 'border-right:1px solid #303035;' : ''}">
        <div style="font-size:11px;color:#8d8d93;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">${escapeHtml(item.label)}</div>
        <div style="font-size:${index === 2 ? '15px' : '18px'};line-height:24px;color:#ffffff;font-weight:700;">${escapeHtml(item.value)}</div>
        ${item.description ? `<div style="font-size:12px;line-height:18px;color:#8d8d93;margin-top:3px;">${escapeHtml(item.description)}</div>` : ''}
      </td>`).join('')}
    </tr>
  </table>`;

const codeCard = (code: string, lifetime: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:28px;background:#18181b;border:1px solid #303035;border-radius:8px;">
    <tr><td align="center" style="padding:28px 16px;">
      <div class="code-value" style="color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:36px;line-height:44px;font-weight:700;letter-spacing:10px;">${escapeHtml(code)}</div>
      <div style="margin-top:12px;font-size:12px;line-height:18px;color:#8d8d93;">Код действует ${escapeHtml(lifetime)}</div>
    </td></tr>
  </table>`;

type DetailRow = { label: string; value: string };

const detailRows = (rows: DetailRow[]): string => rows.map((row, index) => `
  <tr><td style="padding:${index === 0 ? '0 0 13px' : '13px 0'};${index > 0 ? 'border-top:1px solid #303035;' : ''}">
    <div style="font-size:10px;line-height:16px;color:#8d8d93;text-transform:uppercase;letter-spacing:.9px;">${escapeHtml(row.label)}</div>
    <div style="margin-top:4px;font-size:14px;line-height:21px;color:#f2f2f3;">${escapeHtml(row.value)}</div>
  </td></tr>`).join('');

const clientCard = (rows: DetailRow[]): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#161618;border:1px solid #303035;border-radius:8px;">
    <tr><td style="padding:22px;">
      <div style="margin-bottom:16px;font-size:12px;line-height:18px;color:#f2f2f3;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Данные клиента</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows(rows)}</table>
    </td></tr>
  </table>`;

type StatusPresentation = { label: string; description: string; step: number; cancelled?: boolean };

const statusPresentation = (status: string): StatusPresentation => {
  const normalized = status.toLowerCase();
  if (/cancel|отмен/.test(normalized)) return { label: 'Заказ отменён', description: 'Обработка заказа остановлена', step: 0, cancelled: true };
  if (/ship|отправ|готов/.test(normalized)) return { label: 'Готов / Отправлен', description: 'Заказ готов или передан в доставку', step: 3 };
  if (/assembl|собир|работ/.test(normalized)) return { label: 'В работе', description: 'Заказ находится в работе', step: 2 };
  if (/confirm|подтвержд/.test(normalized)) return { label: 'Подтверждение', description: 'Заказ подтверждён', step: 1 };
  if (/paid|оплачен/.test(normalized)) return { label: 'Оплачен', description: 'Ожидает подтверждения', step: 0 };
  return { label: status, description: 'Статус заказа обновлён', step: 0 };
};

const progressStep = (label: string, complete: boolean, last = false): string => `
  <td class="progress-cell" align="center" valign="top" style="width:33.33%;${last ? '' : 'border-right:1px solid #303035;'}padding:0 6px;">
    <div style="width:20px;height:20px;margin:0 auto 8px;border:${complete ? '1px solid #f4f4f5' : '1px solid #4a4a50'};border-radius:50%;background:${complete ? '#f4f4f5' : '#18181b'};color:${complete ? '#111113' : '#8d8d93'};font-size:11px;line-height:20px;text-align:center;">${complete ? '✓' : '·'}</div>
    <div style="font-size:9px;line-height:14px;color:${complete ? '#f2f2f3' : '#77777d'};text-transform:uppercase;letter-spacing:.5px;">${label}</div>
  </td>`;

const statusCard = (status: StatusPresentation): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#161618;border:1px solid #303035;border-radius:8px;">
    <tr><td style="padding:22px;">
      <div style="font-size:12px;line-height:18px;color:#f2f2f3;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Статус заказа</div>
      <div style="margin-top:14px;font-size:17px;line-height:23px;color:#ffffff;font-weight:700;">${escapeHtml(status.label)}</div>
      <div style="margin-top:4px;font-size:12px;line-height:18px;color:#8d8d93;">${escapeHtml(status.description)}</div>
      ${status.cancelled ? '' : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:20px;"><tr>
        ${progressStep('Подтверждение', status.step >= 1)}
        ${progressStep('В работе', status.step >= 2)}
        ${progressStep('Готов', status.step >= 3, true)}
      </tr></table>`}
    </td></tr>
  </table>`;

const cardsRow = (left: string, right: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:28px;">
    <tr>
      <td class="mobile-block" width="50%" valign="top" style="width:50%;padding-right:6px;">${left}</td>
      <td class="mobile-block card-gap" width="50%" valign="top" style="width:50%;padding-left:6px;">${right}</td>
    </tr>
  </table>`;

export type OrderEmailData = {
  orderId: string;
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number; total: number }>;
  deliveryAddress: string;
  comment: string;
};

const orderItemsTable = (data: Pick<OrderEmailData, 'items' | 'total'>, showUnitPrice = false): string => `
  ${sectionTitle('Товары в заказе')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="product-table" style="width:100%;table-layout:fixed;background:#161618;border:1px solid #303035;border-radius:8px;overflow:hidden;font-size:14px;">
    <tr style="background:#1c1c1f;">
      <td class="product-index" width="7%" style="width:7%;padding:14px 12px;color:#9a9a9f;font-size:11px;text-transform:uppercase;letter-spacing:.7px;">#</td>
      <td class="product-name" width="41%" style="width:41%;padding:14px 12px;color:#9a9a9f;font-size:11px;text-transform:uppercase;letter-spacing:.7px;">Наименование</td>
      <td class="product-quantity" width="14%" align="center" style="width:14%;padding:14px 12px;color:#9a9a9f;font-size:11px;text-transform:uppercase;letter-spacing:.7px;">Кол-во</td>
      <td class="hide-mobile" align="right" style="padding:14px 12px;color:#9a9a9f;font-size:11px;text-transform:uppercase;letter-spacing:.7px;">Цена</td>
      <td class="product-total" width="19%" align="right" style="width:19%;padding:14px 12px;color:#9a9a9f;font-size:11px;text-transform:uppercase;letter-spacing:.7px;">Сумма</td>
    </tr>
    ${data.items.map((item, index) => `<tr>
      <td class="product-index" valign="top" style="padding:18px 12px;color:#f2f2f3;border-top:1px solid #303035;">${index + 1}</td>
      <td class="product-name" valign="top" style="padding:18px 12px;color:#f2f2f3;border-top:1px solid #303035;line-height:21px;word-break:break-word;">${escapeHtml(item.name)}${showUnitPrice ? `<div style="font-size:11px;color:#9a9a9f;">Цена за шт.: ${escapeHtml(formatMoney(item.price))}</div>` : ''}</td>
      <td class="product-quantity" align="center" valign="top" style="padding:18px 12px;color:#f2f2f3;border-top:1px solid #303035;">${escapeHtml(item.quantity)}</td>
      <td class="hide-mobile" align="right" valign="top" style="padding:18px 12px;color:#f2f2f3;border-top:1px solid #303035;white-space:nowrap;">${escapeHtml(formatMoney(item.price))}</td>
      <td class="product-total" align="right" valign="top" style="padding:18px 12px;color:#ffffff;font-weight:700;border-top:1px solid #303035;white-space:nowrap;">${escapeHtml(formatMoney(item.total))}</td>
    </tr>`).join('')}
    <tr>
      <td colspan="3" align="right" style="padding:20px 12px;border-top:1px solid #303035;color:#9a9a9f;font-size:12px;text-transform:uppercase;letter-spacing:.8px;">Итого</td>
      <td class="hide-mobile" style="border-top:1px solid #303035;"></td>
      <td class="product-total" align="right" style="padding:20px 12px;border-top:1px solid #303035;color:#ffffff;font-size:17px;font-weight:700;white-space:nowrap;">${escapeHtml(formatMoney(data.total))}</td>
    </tr>
  </table>`;

const verificationLink = (token?: string) => publicUrl(`/verify-email${token ? `?token=${encodeURIComponent(token)}` : ''}`);

export const verificationEmailTemplate = (code: string, customerName?: string, token?: string) => ({
  subject: 'Подтвердите email — SWAPSERVICE38',
  text: `Подтверждение почты\n\nКод: ${code}\n\nВведите код на странице подтверждения. Код действует 10 минут.\n${verificationLink(token)}\n\nЕсли вы не создавали аккаунт SWAPSERVICE38, проигнорируйте письмо.`,
  html: emailShell({
    title: 'Подтверждение почты',
    preheader: `Код ${code} для подтверждения email в SWAPSERVICE38`,
    icon: '✉',
    content: `
      ${greeting(customerName, `Для завершения регистрации подтвердите электронную почту в ${BRAND.siteName}.`)}
      ${codeCard(code, '10 минут')}
      <div style="margin-top:18px;font-size:13px;line-height:21px;color:#9a9a9f;">Введите этот код на странице подтверждения. Никому не сообщайте его, включая сотрудников SWAPSERVICE38.</div>
      ${fullWidthCta('Подтвердить почту', verificationLink(token))}
      <div style="margin-top:22px;padding-top:20px;border-top:1px solid #2a2a2e;font-size:12px;line-height:20px;color:#8d8d93;">Если вы не создавали аккаунт SWAPSERVICE38, просто проигнорируйте это письмо.</div>`,
  }),
});

export const passwordResetEmailTemplate = (code: string) => ({
  subject: 'Код для восстановления пароля — SWAPSERVICE38',
  text: `Сброс пароля\n\nКод: ${code}\n\nВведите код на странице восстановления. Код действует 15 минут.`,
  html: emailShell({
    title: 'Сброс пароля',
    preheader: `Код ${code} для восстановления пароля`,
    icon: '↺',
    content: `
      ${greeting(undefined, 'Мы получили запрос на восстановление пароля вашего аккаунта.')}
      ${codeCard(code, '15 минут')}
      <div style="margin-top:18px;font-size:13px;line-height:21px;color:#9a9a9f;">Введите код на странице восстановления. Не передавайте его другим людям.</div>
      ${fullWidthCta('Изменить пароль', publicUrl('/reset-password'))}
      <div style="margin-top:22px;padding-top:20px;border-top:1px solid #2a2a2e;font-size:12px;line-height:20px;color:#8d8d93;">Если вы не отправляли запрос, не используйте код и проигнорируйте письмо.</div>`,
  }),
});

export const passwordChangeEmailTemplate = (code: string) => ({
  subject: 'Подтвердите смену пароля — SWAPSERVICE38',
  text: `Подтверждение смены пароля\n\nКод: ${code}\n\nКод действует 15 минут.`,
  html: emailShell({
    title: 'Подтвердите смену пароля',
    preheader: `Код ${code} для подтверждения смены пароля`,
    icon: '••',
    content: `
      ${greeting(undefined, 'Для смены пароля в вашем аккаунте введите код подтверждения.')}
      ${codeCard(code, '15 минут')}
      ${fullWidthCta('Подтвердить смену пароля', publicUrl('/profile/change-password'))}
      <div style="margin-top:22px;padding-top:20px;border-top:1px solid #2a2a2e;font-size:12px;line-height:20px;color:#8d8d93;">Не запрашивали смену пароля? Не используйте код и проверьте безопасность аккаунта.</div>`,
  }),
});

export const passwordChangedEmailTemplate = () => ({
  subject: 'Пароль изменён — SWAPSERVICE38',
  text: 'Пароль вашего аккаунта SWAPSERVICE38 был успешно изменён. Если это сделали не вы, обратитесь в поддержку.',
  html: emailShell({
    title: 'Пароль изменён',
    preheader: 'Пароль вашего аккаунта SWAPSERVICE38 был изменён',
    icon: '✓',
    content: `
      ${greeting(undefined, 'Пароль вашего аккаунта был успешно изменён.')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:28px;background:#18181b;border:1px solid #303035;border-radius:8px;">
        <tr><td style="padding:22px;"><div style="font-size:12px;line-height:18px;color:#8d8d93;text-transform:uppercase;letter-spacing:1px;">Уведомление безопасности</div><div style="margin-top:10px;font-size:15px;line-height:24px;color:#f2f2f3;">Если это сделали не вы, немедленно обратитесь в поддержку: <strong style="color:#ffffff;">${BRAND.email}</strong></div></td></tr>
      </table>
      <div style="margin-top:20px;font-size:12px;line-height:20px;color:#8d8d93;">Письмо не содержит ссылок для входа, токенов или данных сессии.</div>`,
  }),
});

const stockTransferNotice = 'Для товара в наличии: после подтверждения полной оплаты заказ будет передан в службу доставки либо подготовлен к самовывозу не позднее 3 рабочих дней, если иной конкретный срок не согласован до оплаты. Отсчёт начинается на следующий день после подтверждения оплаты; рабочие дни — по производственному календарю РФ для пятидневной рабочей недели. Это срок отправки или готовности к выдаче, не срок перевозки. Срок перевозки определяется условиями службы доставки и маршрутом. О готовности к самовывозу мы уведомим отдельно; получение — в согласованное время.';

export const orderConfirmationCustomerTemplate = (data: OrderEmailData, formattedPhone: string) => {
  const status = statusPresentation('paid');
  const clientRows: DetailRow[] = [
    ...(data.customerName ? [{ label: 'Клиент', value: data.customerName }] : []),
    ...(formattedPhone ? [{ label: 'Телефон', value: formattedPhone }] : []),
    ...(data.deliveryAddress ? [{ label: 'Адрес доставки', value: data.deliveryAddress }] : []),
    ...(data.comment ? [{ label: 'Комментарий', value: data.comment }] : []),
  ];
  return {
    subject: `Заказ #${data.documentNumber} подтверждён — SWAPSERVICE38`,
    text: `Заказ #${data.documentNumber} подтверждён. Сумма: ${formatMoney(data.total)}. Статус: оплачен, ожидает подтверждения.\n\n${stockTransferNotice}`,
    html: emailShell({
      title: 'Заказ подтверждён',
      preheader: `Заказ #${data.documentNumber} подтверждён`,
      icon: '✓',
      date: formatDate(),
      content: `
        ${greeting(data.customerName, `Спасибо за заказ в ${BRAND.name}.<br>Мы уже начали его обрабатывать.<br>${stockTransferNotice}`)}
        ${summaryTable([
          { label: 'Номер заказа', value: `#${data.documentNumber}` },
          { label: 'Сумма', value: formatMoney(data.total) },
          { label: 'Статус', value: status.label, description: status.description },
        ])}
        ${orderItemsTable(data)}
        ${cardsRow(clientCard(clientRows), statusCard(status))}
        ${fullWidthCta('Перейти к заказу', publicUrl('/profile/orders'))}`,
    }),
  };
};

export const orderNotificationManagerTemplate = (data: OrderEmailData, formattedPhone: string) => {
  const clientRows: DetailRow[] = [
    ...(data.customerName ? [{ label: 'Клиент', value: data.customerName }] : []),
    ...(formattedPhone ? [{ label: 'Телефон', value: formattedPhone }] : []),
    ...(data.customerEmail ? [{ label: 'Email', value: data.customerEmail }] : []),
    ...(data.deliveryAddress ? [{ label: 'Адрес доставки', value: data.deliveryAddress }] : []),
    ...(data.comment ? [{ label: 'Комментарий', value: data.comment }] : []),
  ];
  return {
    subject: `Новый заказ #${data.documentNumber} — SWAPSERVICE38`,
    text: `Новый заказ #${data.documentNumber}. Клиент: ${data.customerName || 'не указан'}. Сумма: ${formatMoney(data.total)}.`,
    html: emailShell({
      title: 'Новый заказ на сайте',
      preheader: `Новый заказ #${data.documentNumber} на сумму ${formatMoney(data.total)}`,
      icon: '+',
      date: formatDate(),
      content: `
        ${summaryTable([
          { label: 'Номер заказа', value: `#${data.documentNumber}` },
          { label: 'Сумма', value: formatMoney(data.total) },
          { label: 'Статус', value: 'Новый заказ', description: 'Требует обработки' },
        ])}
        ${orderItemsTable(data)}
        ${sectionTitle('Информация о клиенте')}
        ${clientCard(clientRows)}
        ${fullWidthCta('Открыть заказ', publicUrl('/admin/orders'))}`,
    }),
  };
};

export type OrderCreatedEmailData = {
  orderId: string; customerName: string; total: number;
  documentNumber?: string; createdAt?: Date | string; items?: OrderEmailData['items'];
  deliveryMethod?: string; deliveryAddress?: string; deliveryProvider?: string; offerVersion?: string;
};
export const orderCreatedCustomerTemplate = (data: OrderCreatedEmailData) => {
  const shortNumber = data.documentNumber || data.orderId;
  const date = data.createdAt && Number.isFinite(new Date(data.createdAt).getTime())
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Irkutsk' }).format(new Date(data.createdAt)) + ' (Иркутск, UTC+8)' : undefined;
  const delivery = ({ pickup: 'Самовывоз', courier: 'Доставка курьером', post: 'Транспортная компания / почта' } as Record<string, string>)[data.deliveryMethod || ''] || 'Уточните способ получения у продавца';
  const rows: DetailRow[] = [
    { label: 'Получатель', value: data.customerName }, { label: 'Получение', value: delivery },
    ...(data.deliveryAddress ? [{ label: 'Адрес получения', value: data.deliveryAddress }] : []),
    ...(data.deliveryProvider ? [{ label: 'Перевозчик', value: data.deliveryProvider }] : []),
  ];
  const offerLink = new URL('/offer', publicAppUrl()).toString();
  const orderLink = new URL('/profile/orders', publicAppUrl()).toString();
  const nextSteps = `Заказ получен: договор заключён на условиях принятой оферты. Оплата ещё не подтверждена. ${stockTransferNotice} При доставке до предоплаты необходимо согласовать её стоимость и конкретный срок передачи заказа получателю. Сумма ниже — стоимость товаров; отсутствие суммы доставки не означает бесплатную доставку. После согласования необходимых условий откройте заказ для оплаты. Это письмо не является кассовым чеком.`;
  const returnNote = 'Отказ от товара: до передачи — в любое время; после передачи качественного товара — в течение 7 дней, а при отсутствии письменной информации о возврате при доставке — 3 месяцев. Условия сохранности товара и исключение для исключительно индивидуального изделия указаны в оферте. Для отмены или возврата, в том числе дистанционного, свяжитесь с продавцом; он сообщит актуальный адрес возврата. Ограничение автоматической отмены в кабинете 12 часами не ограничивает ваши законные права.';
  return {
    subject: `Заказ #${shortNumber} сформирован — SWAPSERVICE38`,
    text: [`Заказ #${shortNumber} сформирован.`, date ? `Дата заказа: ${date}` : '', nextSteps,
      ...(data.items || []).map((item, index) => `${index + 1}. ${item.name} — ${item.quantity} шт. × ${formatMoney(item.price)} = ${formatMoney(item.total)}`),
      `Итого товары: ${formatMoney(data.total)}. Статус: ожидает оплаты.`, ...rows.map(row => `${row.label}: ${row.value}`),
      `Заказ: ${orderLink}`, `Публичная оферта${data.offerVersion ? `, редакция ${data.offerVersion}` : ''}: ${offerLink}`, returnNote,
      `${SELLER.name}; ИНН ${SELLER.inn}; ОГРНИП ${SELLER.ogrnip}; ${BRAND.address}.`,
      `Продавец/оператор: ${SELLER.phone}, ${SELLER.email}. Менеджер по товарам: ${BRAND.phone}.`,
    ].filter(Boolean).join('\n\n'),
    html: emailShell({
      title: 'Заказ сформирован',
      preheader: `Заказ #${shortNumber} принят и ожидает оплаты`,
      icon: '✓',
      date,
      content: `
        ${greeting(data.customerName, nextSteps)}
        ${summaryTable([
          { label: 'Номер заказа', value: `#${shortNumber}` },
          { label: 'Сумма', value: formatMoney(data.total) },
          { label: 'Статус', value: 'Сформирован', description: 'Ожидает оплаты' },
        ])}
        ${data.items?.length ? orderItemsTable({ items: data.items, total: data.total }, true) : ''}
        ${sectionTitle('Получение заказа')}${clientCard(rows)}
        ${fullWidthCta('Перейти к заказу', publicUrl('/profile/orders'))}
        <div style="margin-top:24px;font-size:13px;line-height:21px;color:#b8b8bd;">
          <p><a href="${publicUrl('/offer')}" style="color:#ffffff;text-decoration:underline;">Публичная оферта</a>${data.offerVersion ? ` — принятая редакция ${escapeHtml(data.offerVersion)}` : ''}.</p>
          <p>${returnNote}</p>
          <p>${SELLER.name}<br>ИНН ${SELLER.inn} · ОГРНИП ${SELLER.ogrnip}<br>${BRAND.address}</p>
          <p>Продавец/оператор: <a href="${SELLER.tel}" style="color:#ffffff;">${SELLER.phone}</a>, <a href="mailto:${SELLER.email}" style="color:#ffffff;">${SELLER.email}</a>.<br>Менеджер по товарам: ${BRAND.phone}.</p>
        </div>`,
    }),
  };
};

export const orderStatusCustomerTemplate = (data: { documentNumber: string; customerName: string }, statusLabel: string) => {
  const status = statusPresentation(statusLabel);
  return {
    subject: `Заказ #${data.documentNumber}: ${statusLabel} — SWAPSERVICE38`,
    text: `Статус заказа #${data.documentNumber} изменён: ${statusLabel}.`,
    html: emailShell({
      title: 'Статус заказа изменён',
      preheader: `Новый статус заказа #${data.documentNumber}: ${statusLabel}`,
      icon: status.cancelled ? '×' : '→',
      date: formatDate(),
      content: `
        ${greeting(data.customerName, 'У заказа появился новый статус.')}
        ${summaryTable([
          { label: 'Номер заказа', value: `#${data.documentNumber}` },
          { label: 'Дата обновления', value: formatDate() },
          { label: 'Статус', value: status.label, description: status.description },
        ])}
        ${sectionTitle('Текущий статус')}
        ${statusCard(status)}
        ${fullWidthCta('Перейти к заказу', publicUrl('/profile/orders'))}`,
    }),
  };
};
