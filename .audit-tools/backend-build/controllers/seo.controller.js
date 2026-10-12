"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeXml = exports.SITEMAP_PAGE_SIZE = void 0;
exports.robots = robots;
exports.sitemapIndex = sitemapIndex;
exports.sitemapPage = sitemapPage;
const prisma_1 = require("../config/prisma");
const logger_1 = require("../config/logger");
exports.SITEMAP_PAGE_SIZE = 1000;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const XML_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const PUBLIC_PAGES = ['/', '/catalog', '/services', '/swaps', '/contacts', '/offer', '/privacy', '/personal-data-consent'];
const escapeXml = (value) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]));
exports.escapeXml = escapeXml;
function siteOrigin() {
    // Use the same public origin as email/OAuth, never the untrusted Host header.
    const url = new URL(process.env.CLIENT_URL || '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Invalid public origin');
    }
    return url.origin;
}
function xml(res, body) {
    res.set('Cache-Control', 'public, max-age=300').type('application/xml').send(XML_HEADER + body);
}
function unavailable(res) {
    logger_1.log.warn('SEO resource unavailable');
    res.status(503).set('Cache-Control', 'no-store').type('text/plain').send('Resource temporarily unavailable');
}
async function robots(_req, res) {
    try {
        const excluded = ['/admin', '/api/', '/api-docs', '/cart', '/checkout', '/profile', '/payment/',
            '/login', '/register', '/verify', '/reset-password', '/oauth-'];
        res.type('text/plain').set('Cache-Control', 'public, max-age=300').send([
            'User-agent: *', 'Allow: /', ...excluded.map((path) => `Disallow: ${path}`),
            `Sitemap: ${siteOrigin()}/sitemap.xml`, '',
        ].join('\n'));
    }
    catch {
        unavailable(res);
    }
}
async function sitemapIndex(_req, res) {
    try {
        const origin = siteOrigin();
        const [services, articles] = await Promise.all([
            prisma_1.prisma.service.count({ where: { isActive: true } }),
            prisma_1.prisma.article.count({ where: { isPublished: true } }),
        ]);
        const servicePages = Math.ceil(services / exports.SITEMAP_PAGE_SIZE);
        const articlePages = Math.ceil(articles / exports.SITEMAP_PAGE_SIZE);
        // The sitemap protocol permits at most 50,000 entries in an index.
        if (servicePages + articlePages + 1 > 50000)
            throw new Error('Sitemap index capacity exceeded');
        const paths = ['/sitemaps/pages/1.xml'];
        for (let page = 1; page <= servicePages; page++)
            paths.push(`/sitemaps/services/${page}.xml`);
        for (let page = 1; page <= articlePages; page++)
            paths.push(`/sitemaps/articles/${page}.xml`);
        xml(res, `<sitemapindex xmlns="${XML_NS}">${paths.map((path) => `<sitemap><loc>${(0, exports.escapeXml)(origin + path)}</loc></sitemap>`).join('')}</sitemapindex>`);
    }
    catch {
        unavailable(res);
    }
}
async function sitemapPage(req, res) {
    const { kind, page: rawPage } = req.params;
    const page = Number(rawPage);
    if (!['pages', 'services', 'articles'].includes(kind) || !/^\d+$/.test(rawPage) ||
        !Number.isSafeInteger(page) || page < 1 || page > 50000 || (kind === 'pages' && page !== 1)) {
        res.status(404).type('text/plain').send('Not found');
        return;
    }
    try {
        const origin = siteOrigin();
        let entries;
        const pagination = { skip: (page - 1) * exports.SITEMAP_PAGE_SIZE, take: exports.SITEMAP_PAGE_SIZE, orderBy: { id: 'asc' } };
        if (kind === 'pages') {
            entries = PUBLIC_PAGES.map((path) => ({ path }));
        }
        else if (kind === 'services') {
            const rows = await prisma_1.prisma.service.findMany({ ...pagination, where: { isActive: true }, select: { id: true, updatedAt: true } });
            entries = rows.map((row) => ({ path: `/services/${encodeURIComponent(row.id)}`, updatedAt: row.updatedAt }));
        }
        else {
            const rows = await prisma_1.prisma.article.findMany({ ...pagination, where: { isPublished: true }, select: { slug: true, updatedAt: true } });
            entries = rows.map((row) => ({ path: `/swaps/${encodeURIComponent(row.slug)}`, updatedAt: row.updatedAt }));
        }
        if (!entries.length) {
            res.status(404).type('text/plain').send('Not found');
            return;
        }
        xml(res, `<urlset xmlns="${XML_NS}">${entries.map((entry) => `<url><loc>${(0, exports.escapeXml)(origin + entry.path)}</loc>${entry.updatedAt ? `<lastmod>${entry.updatedAt.toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`);
    }
    catch {
        unavailable(res);
    }
}
//# sourceMappingURL=seo.controller.js.map