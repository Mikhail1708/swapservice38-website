# Production frontend resources

The existing `docker-compose.yml` builds `./frontend`. Its tracked Dockerfile
now builds the current source with `npm ci` and serves the build using the
tracked `nginx.conf` on the existing container port 3001. No changes to
`/etc/swap38/docker-compose.vps.yml` are required or included here.

The repository had no production frontend Dockerfile/nginx configuration.
The external TLS proxy and VPS override have NOT been inspected or changed.
Before deployment, confirm that the effective frontend service actually builds
this Dockerfile (no override image/build command or mounted nginx config) and
that the outer proxy passes its security headers without duplicating CSP.
Do not print the full compose configuration because it contains secrets.

`CLIENT_URL` must already contain the public HTTPS origin
`https://swap38.ru`; backend SEO responses derive URLs from this existing
setting rather than request headers. `/robots.txt`, `/sitemap.xml` and
`/sitemaps/` are proxied to backend and cannot fall through to `index.html`.
The sitemap index references bounded 1000-row pages for active services and
published articles (article links use slug), plus public static pages.
Catalog landing is included. Individual products live in CRM, not SITE's
database, so this sitemap does not introduce a new cross-service catalog scan.

HSTS lasts 180 days, without includeSubDomains/preload. CSP allows local
scripts/fonts/API, HTTPS content images, data/blob previews, the existing
Yandex map iframe, and inline styles required by existing React components.
There is no inline script or eval permission. YooKassa and Yandex OAuth use
top-level navigation, not third-party scripts/frames. Permissions-Policy disables
the Payment Request browser API, not ordinary YooKassa redirects.

Deployment verification (read-only, no secrets):

```sh
curl -sSI https://swap38.ru/
curl -sS -D - https://swap38.ru/robots.txt
curl -sS -D - https://swap38.ru/sitemap.xml
curl -sS -D - https://swap38.ru/sitemaps/pages/1.xml
docker compose exec -T frontend nginx -t
```

Verify browser CSP console after loading public/admin pages, map, upload previews,
OAuth and payment redirects. These checks have not been executed against VPS.
