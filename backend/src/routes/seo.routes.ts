import { Router } from 'express';
import { robots, sitemapIndex, sitemapPage } from '../controllers/seo.controller';

const router = Router();
router.get('/robots.txt', robots);
router.get('/sitemap.xml', sitemapIndex);
router.get('/sitemaps/:kind/:page.xml', sitemapPage);
export default router;
