import fs from 'fs';
import path from 'path';
import {
  BRAND_LOGO_ATTACHMENT,
  BRAND_LOGO_CID,
  createEmailJobData,
} from '../../../src/services/emailAttachments';

describe('Email CID attachments', () => {
  it('resolves the real frontend logo to a safe absolute path', () => {
    expect(BRAND_LOGO_CID).toBe('swapservice38-logo');
    expect(BRAND_LOGO_ATTACHMENT.cid).toBe(BRAND_LOGO_CID);
    expect(BRAND_LOGO_ATTACHMENT.filename).toBe('swapservice38-logo.png');
    expect(path.isAbsolute(BRAND_LOGO_ATTACHMENT.path)).toBe(true);
    expect(BRAND_LOGO_ATTACHMENT.path.replace(/\\/g, '/')).toMatch(/frontend\/public\/images\/logo\/logo\.png$/);
    expect(fs.existsSync(BRAND_LOGO_ATTACHMENT.path)).toBe(true);
  });

  it('places one shared CID attachment in the serializable Bull payload', () => {
    const data = createEmailJobData(
      'customer@example.test',
      'Subject',
      '<img src="cid:swapservice38-logo">',
      'Plain text',
    );

    expect(data).toEqual(expect.objectContaining({
      to: 'customer@example.test',
      html: '<img src="cid:swapservice38-logo">',
      text: 'Plain text',
      attachments: [BRAND_LOGO_ATTACHMENT],
    }));
    expect(JSON.parse(JSON.stringify(data)).attachments[0]).toEqual(expect.objectContaining({
      cid: 'swapservice38-logo',
      path: BRAND_LOGO_ATTACHMENT.path,
    }));
  });
});
