import { commentReplyEmailTemplate, commentModerationEmailTemplate, passwordResetEmailTemplate } from '../../../src/services/emailTemplates';
import { BRAND_LOGO_CID, createEmailJobData } from '../../../src/services/emailAttachments';

const base = { articleSlug: 'swap-project', articleTitle: 'Проект свапа', comment: 'Мой комментарий\nВторая строка' };
const oldOrigin = process.env.PUBLIC_APP_URL;
beforeAll(() => { process.env.PUBLIC_APP_URL = 'https://example.test'; });
afterAll(() => {
  if (oldOrigin === undefined) delete process.env.PUBLIC_APP_URL;
  else process.env.PUBLIC_APP_URL = oldOrigin;
});

describe('comment emails share existing branding and delivery payload', () => {
  const reply = () => commentReplyEmailTemplate({ ...base, reply: 'Спасибо за вопрос' });
  const moderation = () => commentModerationEmailTemplate({ ...base, reason: 'Реклама не по теме' });

  it.each([['reply', reply], ['moderation', moderation]] as const)('%s uses the same header/footer/logo and CTA style as other site mail', (_name, make) => {
    const result = make();
    const other = passwordResetEmailTemplate('123456').html;
    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain(`src="cid:${BRAND_LOGO_CID}"`);
    expect(result.html).toContain('class="email-container"');
    expect(result.html).toContain('background:#111113');
    const footer = (html: string) => html.slice(html.lastIndexOf('<td class="email-padding" align="center"'));
    expect(footer(result.html)).toBe(footer(other));
    expect(result.html).toContain('background:#f4f4f5;border-radius:6px;');
    expect(result.html).not.toMatch(/<script|fonts\.(googleapis|gstatic)|<link/i);
    const job = createEmailJobData('fixture@example.test', result.subject, result.html, result.text);
    expect(job.attachments).toHaveLength(1);
    expect(job.attachments[0].cid).toBe(BRAND_LOGO_CID);
    expect(job.text).toBe(result.text);
  });

  it('reply contains both excerpts, material and a slug-based discussion link in html/text', () => {
    const result = reply();
    expect(result.html).toContain('Вам ответили');
    expect(result.html).toContain('Мой комментарий<br>Вторая строка');
    expect(result.html).toContain('Спасибо за вопрос');
    expect(result.html).toContain('Открыть обсуждение');
    expect(result.text).toContain(base.comment);
    expect(result.text).toContain('Спасибо за вопрос');
    for (const output of [result.text, result.html]) expect(output).toContain('https://example.test/swaps/swap-project#comments');
  });

  it('moderation contains comment/reason and a restrained highlighted reason block', () => {
    const result = moderation();
    expect(result.html).toContain('Комментарий удалён');
    expect(result.html).toContain('Причина удаления');
    expect(result.html).toContain('Реклама не по теме');
    expect(result.html).toContain('background:#252321');
    expect(result.html).toContain('Открыть материал');
    expect(result.text).toContain(base.comment);
    expect(result.text).toContain('Реклама не по теме');
    for (const output of [result.text, result.html]) expect(output).toContain('https://example.test/swaps/swap-project#comments');
  });

  it('escapes every user-controlled field and encodes the slug before adding it to href', () => {
    const attack = '<script>alert("x")</script>&\'test';
    for (const make of [() => commentReplyEmailTemplate({ articleSlug: 'a"<&', articleTitle: attack, comment: attack, reply: attack }),
      () => commentModerationEmailTemplate({ articleSlug: 'a"<&', articleTitle: attack, comment: attack, reason: attack })]) {
      const result = make();
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#039;test');
      expect(result.html).toContain('/swaps/a%22%3C%26#comments');
    }
  });

  it('bounds long previews without splitting Unicode and preserves line breaks safely', () => {
    const result = commentReplyEmailTemplate({ ...base, comment: '🚗'.repeat(501), reply: 'x'.repeat(501) });
    expect(result.text).toContain('🚗'.repeat(500) + '…');
    expect(result.text).not.toContain('🚗'.repeat(501));
    expect(result.html).not.toContain('x'.repeat(501));
    expect(result.html).not.toContain('\uFFFD');
    const removed = commentModerationEmailTemplate({ ...base, comment: 'x'.repeat(501), reason: 'r'.repeat(2001) });
    expect(removed.text).toContain('r'.repeat(2000) + '…');
    expect(removed.html).not.toContain('r'.repeat(2001));
  });

  it('escapes the reply author in HTML and includes the readable name in plain text', () => {
    const name = 'Михаил <b>&"\'';
    const result = commentReplyEmailTemplate({ ...base, reply: 'Ответ', replyAuthorName: name });
    expect(result.html).toContain('Ответил: Михаил &lt;b&gt;&amp;&quot;&#039;');
    expect(result.html).not.toContain('<b>');
    expect(result.text).toContain(`Ответил: ${name}`);
  });

  it.each([undefined, '', '   '])('uses the team fallback when a display name is absent (%s)', (replyAuthorName) => {
    const result = commentReplyEmailTemplate({ ...base, reply: 'Ответ', replyAuthorName });
    expect(result.html).toContain('Ответил: Команда SWAPSERVICE38');
    expect(result.text).toContain('Ответил: Команда SWAPSERVICE38');
  });
});
