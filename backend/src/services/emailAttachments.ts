import path from 'path';

export const BRAND_LOGO_CID = 'swapservice38-logo';

export const BRAND_LOGO_ATTACHMENT = Object.freeze({
  filename: 'swapservice38-logo.png',
  path: path.resolve(__dirname, '../../../frontend/public/images/logo/logo.png'),
  cid: BRAND_LOGO_CID,
});

export type EmailJobData = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments: Array<typeof BRAND_LOGO_ATTACHMENT>;
};

export const createEmailJobData = (
  to: string,
  subject: string,
  html: string,
  text?: string,
): EmailJobData => ({
  to,
  subject,
  html,
  ...(text ? { text } : {}),
  attachments: [BRAND_LOGO_ATTACHMENT],
});
