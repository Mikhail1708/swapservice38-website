import { PassThrough } from 'stream';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sanitizeArticleHtml } from '../../../src/utils/sanitizeArticleHtml';

// Exercise real dependency implementations; the suite normally mocks SMTP.
const nodemailer = jest.requireActual('nodemailer');
const addressParser = require('nodemailer/lib/addressparser');
const sanitize = require('sanitize-html');
let uploadDirectory: string;
let productionUpload: any;
function getProductionUpload() {
  if (productionUpload) return productionUpload;
  uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'site-f32-upload-'));
  const realDiskStorage = multer.diskStorage;
  const storage = jest.spyOn(multer, 'diskStorage').mockImplementation((options) =>
    realDiskStorage({ ...options, destination: uploadDirectory }));
  try {
    const router = require('../../../src/routes/upload.routes').default;
    productionUpload = router.stack.find((layer: any) => layer.route?.path === '/').route.stack
      .find((layer: any) => layer.handle.name === 'multerMiddleware').handle;
    return productionUpload;
  } finally { storage.mockRestore(); }
}
afterAll(() => {
  if (uploadDirectory && path.dirname(uploadDirectory) === os.tmpdir() && path.basename(uploadDirectory).startsWith('site-f32-upload-')) {
    fs.rmSync(uploadDirectory, { recursive: true, force: true });
  }
});

function multipart(body: string, options: multer.Options = {}, productionMiddleware?: any) {
  const req: any = new PassThrough();
  req.headers = { 'content-type': 'multipart/form-data; boundary=test-boundary', 'content-length': Buffer.byteLength(body) };
  return new Promise<{ error: any; req: any }>((resolve) => {
    const middleware = productionMiddleware || multer({ storage: multer.memoryStorage(), ...options }).single('file');
    middleware(req, {} as any, (error: any) => resolve({ error, req }));
    req.end(body);
  });
}
const field = (name: string) => `--test-boundary\r\nContent-Disposition: form-data; name="${name}"\r\n\r\nx\r\n--test-boundary--\r\n`;
const file = (value: string) => `--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n${value}\r\n--test-boundary--\r\n`;
const fileWithField = (name: string) => file('fixture').replace('--test-boundary--\r\n', field(name));

describe('F32 multipart dependency regression', () => {
  it('accepts a normal upload without changing bytes', async () => {
    const result = await multipart(file('image fixture'));
    expect(result.error).toBeUndefined();
    expect(result.req.file.buffer.toString()).toBe('image fixture');
  });
  it('rejects oversized files and does not expose an accepted file', async () => {
    const result = await multipart(file('oversized'), { limits: { fileSize: 3 } });
    expect(result.error.code).toBe('LIMIT_FILE_SIZE');
    expect(result.req.file).toBeUndefined();
  });
  it('reports malformed multipart through the callback instead of crashing', async () => {
    const result = await multipart('--test-boundary\r\ninvalid header\r\n\r\nx');
    expect(result.error).toBeInstanceOf(Error);
  });
  it('rejects oversized bracket indices before creating a huge sparse array', async () => {
    // Exercise the real production route options, not a test copy of its limits.
    const result = await multipart(field('items[4294967294]'), {}, getProductionUpload());
    expect(result.error.code).toBe('LIMIT_FIELD_NESTING');
    expect(result.req.body.items).toBeUndefined();
  });
  it('accepts the real frontend file plus flat _csrf field', async () => {
    const result = await multipart(fileWithField('_csrf'), {}, getProductionUpload());
    expect(result.error).toBeUndefined();
    expect(result.req.body._csrf).toBe('x');
    expect(fs.readFileSync(result.req.file.path, 'utf8')).toBe('fixture');
    fs.unlinkSync(result.req.file.path);
  });
  it('rejects nested fields accompanying a file and removes its partial upload', async () => {
    for (const name of ['items[4294967294]', 'items[0]', '_csrf[token]']) {
      const result = await multipart(fileWithField(name), {}, getProductionUpload());
      expect(result.error.code).toBe('LIMIT_FIELD_NESTING');
      expect(fs.readdirSync(uploadDirectory)).toEqual([]);
    }
  });
  it('preserves production disk filename/filter and removes oversized partial files', async () => {
    const middleware = getProductionUpload();
    const valid = await multipart(file('image fixture'), {}, middleware);
    expect(valid.error).toBeUndefined();
    expect(path.dirname(valid.req.file.path)).toBe(uploadDirectory);
    expect(valid.req.file.filename).toMatch(/\.png$/);
    expect(fs.readFileSync(valid.req.file.path, 'utf8')).toBe('image fixture');
    fs.unlinkSync(valid.req.file.path);
    const invalid = await multipart(file('fixture').replace('image/png', 'text/html'), {}, middleware);
    expect(invalid.error).toBeInstanceOf(Error);
    const oversized = await multipart(file('x'.repeat(10 * 1024 * 1024 + 1)), {}, middleware);
    expect(oversized.error.code).toBe('LIMIT_FILE_SIZE');
    expect(fs.readdirSync(uploadDirectory)).toEqual([]);
  });
});

describe('F33 runtime dependency regression', () => {
  it('handles deeply nested recipient groups without recursive stack overflow', () => {
    expect(() => addressParser('group:'.repeat(12000) + 'a@example.test' + ';'.repeat(12000))).not.toThrow();
  });
  it('builds the real email MIME and envelope entirely in memory', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const result = await transport.sendMail({ from: 'CRM <sender@example.test>', to: 'recipient@example.test', subject: 'Fixture', html: '<p>Fixture</p>' });
    expect(result.envelope).toEqual({ from: 'sender@example.test', to: ['recipient@example.test'] });
    expect(result.message.toString()).toContain('<p>Fixture</p>');
  });
  it('blocks unsafe URI schemes in explicitly allowed form attributes', () => {
    const result = sanitize('<form action="javascript:alert(1)">Text</form>', { allowedTags: ['form'], allowedAttributes: { form: ['action'] } });
    expect(result).toBe('<form>Text</form>');
  });
  it('keeps SITE article allowlist protection against the same malformed content', () => {
    const result = sanitizeArticleHtml('<p>Safe</p><textarea></textarea/><img src=x onerror="alert(1)">');
    expect(result).toContain('<p>Safe</p>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<textarea');
  });
  it('does not enable SVG SMIL URI-list attributes affected by the remaining advisory', () => {
    const result = sanitizeArticleHtml('<p>Safe</p><svg><a><animate attributeName="href" values="https://example.test;javascript:alert(1)" /></a></svg>');
    expect(result).toContain('<p>Safe</p>');
    expect(result).not.toMatch(/svg|animate|attributeName|javascript:/);
  });
  it('keeps the two dependency fixes compatible in an upload-to-email path', async () => {
    const result = await multipart(file('fixture'));
    expect(result.error).toBeUndefined();
    const mail = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({
      from: 'sender@example.test', to: 'recipient@example.test', subject: 'Upload',
      html: sanitizeArticleHtml('<p>Uploaded</p><script>bad()</script>'),
      attachments: [{ filename: result.req.file.originalname, content: result.req.file.buffer }],
    });
    expect(mail.message.toString()).toContain('filename=image.png');
    expect(mail.message.toString()).not.toContain('<script>');
  });
});
