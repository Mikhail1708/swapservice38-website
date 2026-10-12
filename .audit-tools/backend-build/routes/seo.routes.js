"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const seo_controller_1 = require("../controllers/seo.controller");
const router = (0, express_1.Router)();
router.get('/robots.txt', seo_controller_1.robots);
router.get('/sitemap.xml', seo_controller_1.sitemapIndex);
router.get('/sitemaps/:kind/:page.xml', seo_controller_1.sitemapPage);
exports.default = router;
//# sourceMappingURL=seo.routes.js.map