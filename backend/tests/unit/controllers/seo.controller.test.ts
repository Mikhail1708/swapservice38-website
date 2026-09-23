import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

jest.mock('../../../src/config/prisma', () => ({ prisma: {
  service: { count: jest.fn(), findMany: jest.fn() },
  article: { count: jest.fn(), findMany: jest.fn() },
} }));
jest.mock('../../../src/config/logger', () => ({ log: { warn: jest.fn() } }));
import { prisma } from '../../../src/config/prisma';
import seoRoutes from '../../../src/routes/seo.routes';
import { escapeXml, SITEMAP_PAGE_SIZE } from '../../../src/controllers/seo.controller';

const app = express();
app.use(seoRoutes);
const db = prisma as any;
const originalOrigin = process.env.CLIENT_URL;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CLIENT_URL = 'https://example.test';
  db.service.count.mockResolvedValue(0);
  db.article.count.mockResolvedValue(0);
});
afterAll(() => { if (originalOrigin === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = originalOrigin; });

test('robots is text, permits public pages, excludes private paths and ignores Host injection', async () => {
  const response = await request(app).get('/robots.txt').set('Host', 'attacker.test');
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('text/plain');
  expect(response.text).toContain('Allow: /');
  expect(response.text).toContain('Disallow: /admin');
  expect(response.text).toContain('Sitemap: https://example.test/sitemap.xml');
  expect(response.text).not.toContain('attacker');
});

test('index lists all bounded shards for public entities, including empty-database static pages', async () => {
  db.service.count.mockResolvedValue(1001);
  db.article.count.mockResolvedValue(1);
  const response = await request(app).get('/sitemap.xml');
  expect(response.headers['content-type']).toContain('application/xml');
  expect(response.text).toContain('<sitemapindex');
  expect(response.text).toContain('/sitemaps/services/2.xml');
  expect(response.text).toContain('/sitemaps/articles/1.xml');
  expect(response.text).toContain('/sitemaps/pages/1.xml');
  expect(db.service.count).toHaveBeenCalledWith({ where: { isActive: true } });
  expect(db.article.count).toHaveBeenCalledWith({ where: { isPublished: true } });
});

test('empty database returns usable index, not HTML', async () => {
  const response = await request(app).get('/sitemap.xml');
  expect(response.status).toBe(200);
  expect(response.text.match(/<sitemap>/g)).toHaveLength(1);
  expect(response.text).not.toContain('<html');
});

test('services query selects only public identifiers/dates with a bounded stable page', async () => {
  db.service.findMany.mockResolvedValue([{ id: 'svc', updatedAt: new Date('2026-09-23T00:00:00Z') }]);
  const response = await request(app).get('/sitemaps/services/2.xml');
  expect(response.status).toBe(200);
  expect(db.service.findMany).toHaveBeenCalledWith({ where: { isActive: true }, skip: 1000, take: SITEMAP_PAGE_SIZE,
    orderBy: { id: 'asc' }, select: { id: true, updatedAt: true } });
  expect(response.text).toContain('/services/svc</loc>');
  expect(response.text).toContain('<lastmod>2026-09-23T00:00:00.000Z</lastmod>');
});

test('article route uses public slug, not internal ID, and encodes unsafe URL characters', async () => {
  db.article.findMany.mockResolvedValue([{ slug: 'a&<b', updatedAt: new Date('2026-09-23T00:00:00Z') }]);
  const response = await request(app).get('/sitemaps/articles/1.xml');
  expect(response.text).toContain('/swaps/a%26%3Cb</loc>');
  expect(db.article.findMany.mock.calls[0][0].where).toEqual({ isPublished: true });
  expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
});

test('static sitemap includes only real public routes, never account/cart/admin', async () => {
  const response = await request(app).get('/sitemaps/pages/1.xml');
  expect(response.text).toContain('/catalog</loc>');
  for (const privatePath of ['/admin', '/cart', '/payment', '/profile', '/login']) expect(response.text).not.toContain(privatePath);
});

test.each(['/sitemaps/services/0.xml', '/sitemaps/services/-1.xml', '/sitemaps/services/50001.xml',
  '/sitemaps/services/NaN.xml', '/sitemaps/private/1.xml', '/sitemaps/pages/2.xml'])('rejects invalid sitemap %s without DB query', async (url) => {
  expect((await request(app).get(url)).status).toBe(404);
  expect(db.service.findMany).not.toHaveBeenCalled();
});

test('missing page and DB failure never return SPA HTML or database details', async () => {
  db.service.findMany.mockResolvedValue([]);
  expect((await request(app).get('/sitemaps/services/1.xml')).status).toBe(404);
  db.service.count.mockRejectedValue(new Error('database secret'));
  const response = await request(app).get('/sitemap.xml');
  expect(response.status).toBe(503);
  expect(response.text).not.toMatch(/secret|html/i);
});

test('missing canonical origin fails safely instead of publishing localhost/request host', async () => {
  delete process.env.CLIENT_URL;
  const response = await request(app).get('/robots.txt');
  expect(response.status).toBe(503);
  expect(response.text).not.toContain('localhost');
});

test('production build wiring routes SEO before SPA and supplies security headers', () => {
  const frontend = path.resolve(__dirname, '../../../../frontend');
  const config = fs.readFileSync(path.join(frontend, 'nginx.conf'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(frontend, 'Dockerfile'), 'utf8');
  for (const route of ['location = /robots.txt', 'location = /sitemap.xml', 'location ^~ /sitemaps/']) expect(config).toContain(route);
  for (const header of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) expect(config).toContain(`add_header ${header}`);
  expect(config).toContain("script-src 'self'");
  expect(config).not.toMatch(/unsafe-eval|includeSubDomains|preload|fonts\.google/);
  expect(config).toContain('listen 3001;');
  expect(dockerfile).toContain('RUN npm ci');
  expect(dockerfile).toContain('RUN npm run build');
  expect(dockerfile).toContain('COPY nginx.conf /etc/nginx/conf.d/default.conf');
});
