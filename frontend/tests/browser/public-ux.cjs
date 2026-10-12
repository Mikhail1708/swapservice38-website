/* Run with Playwright installed locally or PLAYWRIGHT_MODULE pointing at its module.
   All API and external requests are intercepted; never creates real orders/payments. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UX_BASE_URL || 'http://127.0.0.1:4173';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('Local server required');
const out = path.resolve(process.env.UX_ARTIFACTS || '.audit-tools/browser');
fs.mkdirSync(out, { recursive: true });
const user = { id: 'fixture', firstName: 'Тестовый', lastName: 'Покупатель', email: 'fixture@example.test', phone: '+79991234567', role: 'customer', emailVerified: true, emailVerifiedAt: '2026-01-01', createdAt: '2026-01-01' };
const product = { id: '134', name: 'Комплект компонентов для свапа двигателя в автомобиль', sku: 'NPY61-60-03-004-01', price: 15000, stock: 5, availableStock: 5, category: 'Компоненты для свапа', categories: [{ id: 1, name: 'Компоненты для свапа' }], image_url: '/images/hero-suv4.png', images: ['/images/hero-suv4.png'], description: 'Описание товара', characteristics: {} };
const service = { id: '1', slug: 'fixture', name: 'Сервис и тюнинг внедорожников', title: 'Сервис и тюнинг внедорожников', description: 'Описание услуги', content: 'Описание услуги', imageUrl: '/images/hero-suv1.png', isActive: true, order: 1 };
const article = { id: '1', slug: 'fixture', title: 'Проект свапа двигателя внедорожника', description: 'Описание проекта', content: '<p>Работы по установке двигателя</p>', imageUrl: '/images/hero-suv4.png', images: ['/fixture/portrait.svg','/fixture/wide.svg','/fixture/square.svg','/fixture/small.svg'], date: '2026-01-01', tags: [], comments: [], likesCount: 0 };
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext();
  let role = 'guest', fullCart = false, failOptimized = false;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (failOptimized && url.pathname.includes('/images/hero/optimized/')) return route.abort();
    if (url.pathname.startsWith('/fixture/')) {
      const [w,h] = url.pathname.includes('portrait') ? [400,1200] : url.pathname.includes('wide') ? [1600,300] : url.pathname.includes('small') ? [80,60] : [500,500];
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#456"/></svg>` });
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const p=url.pathname;
    let body={};
    if (p === '/api/auth/me') body={ user: role === 'guest' ? null : { ...user, role } };
    else if (p === '/api/admin/dashboard/stats') body={stats:{orders:{total:0,today:0,week:0,month:0,paid:0,pending:0},revenue:{total:0,month:0},users:{total:0,newWeek:0,newMonth:0}},charts:{ordersByDay:[],statusDistribution:[]},recent:{orders:[]}};
    else if (p.includes('csrf')) body={ csrfToken: 'fixture-token' };
    else if (p === '/api/products/categories') body={ categories: ['Компоненты для свапа'], categoryCounts: [{ name:'Компоненты для свапа',productCount:1 }] };
    else if (p === '/api/products') body={ items:[product],products:[product],pagination:{page:1,totalPages:1,total:1},total:1,totalPages:1 };
    else if (p.startsWith('/api/products/')) body=product;
    else if (p === '/api/services') body={services:[service]};
    else if (p.startsWith('/api/services/')) body={service};
    else if (p === '/api/articles') body={articles:[article],total:1,totalPages:1};
    else if (p.startsWith('/api/articles/')) body=article;
    else if (p.includes('orders')) body={orders:[],total:0};
    else if (p.includes('cart')) body={id:'fixture-cart',items:fullCart?[{productId:product.id,name:product.name,price:product.price,quantity:1,maxStock:5,image:product.image_url}]:[],total:fullCart?product.price:0};
    else if (p.includes('consent')) body={documents:{personalDataVersion:'2026-09-07',privacyVersion:'2026-09-07',offerVersion:'2026-09-07'},requiresPersonalDataConsent:false};
    return route.fulfill({ contentType:'application/json', body:JSON.stringify(body) });
  });
  const page=await context.newPage(); const errors=[], failures=[], results=[];
  page.on('pageerror', error=>errors.push({url:page.url(),message:error.message,stack:error.stack}));
  const widths=process.env.UX_INTERACTIONS_ONLY ? [] : [320,360,375,390,412,430,440,768,1024,1440];
  const routes=['/','/catalog','/catalog/134','/services','/services/1','/swaps','/swaps/fixture','/contacts','/cart','/login','/register','/privacy','/offer','/profile','/profile/orders'];
  for (const width of widths) {
    await page.setViewportSize({width,height:900});
    for (const url of routes) {
      role=url.startsWith('/profile')?'customer':'guest';
      await page.goto(base+url); await page.waitForLoadState('networkidle');
      const measure=await page.evaluate(()=>({ width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth, offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.right>innerWidth+1 && getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,60)})) }));
      results.push({width,url,...measure});
      if(measure.document>width+1) failures.push({width,url,...measure});
    }
  }
  role='guest'; await page.setViewportSize({width:390,height:844}); await page.goto(base+'/'); await page.waitForLoadState('networkidle');
  const cookie=page.getByRole('button',{name:'Хорошо',exact:true}); if(await cookie.isVisible()) await cookie.click();
  await page.evaluate(()=>window.scrollTo({top:650,behavior:'instant'}));
  await page.locator('header[data-site-header]').click({position:{x:170,y:40}});
  await page.waitForFunction(()=>document.scrollingElement.scrollTop===0);
  assert.equal(new URL(page.url()).pathname,'/');
  await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
  assert.equal(await page.getByRole('dialog',{name:'Мобильное меню'}).count(),1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Следующий слайд',exact:true}).filter({visible:true}).click();
  await page.getByRole('heading',{level:1,name:'Тюнинг внедорожников',exact:true}).waitFor();
  await page.getByRole('button',{name:'Предыдущий слайд',exact:true}).filter({visible:true}).click();
  await page.getByRole('heading',{level:1,name:'Свап двигателей',exact:true}).waitFor();
  assert.ok(await page.locator('#top img').count()<=3,'Only current, previous and next photos mount');
  await page.goto(base+'/swaps/fixture'); await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Открыть фото 1'}).click();
  const dialog=page.getByRole('dialog',{name:'Фотографии проекта'});
  for(let i=0;i<4;i++) {
    await dialog.locator('img').waitFor();
    await page.waitForFunction(()=>{const img=document.querySelector('[role="dialog"] img');return img?.complete && img.naturalWidth>0 && !img.classList.contains('invisible');});
    const fit=await dialog.locator('img').evaluate(img=>{const r=img.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,nw:img.naturalWidth,nh:img.naturalHeight,fit:getComputedStyle(img).objectFit,viewport:[innerWidth,innerHeight]};});
    assert.equal(fit.fit,'contain'); assert.ok(fit.left>=0&&fit.top>=0&&fit.right<=fit.viewport[0]&&fit.bottom<=fit.viewport[1]);
    assert.ok(Math.abs(fit.width/fit.height-fit.nw/fit.nh)<0.02); assert.ok(fit.width<=fit.nw+1&&fit.height<=fit.nh+1);
    if(i<3) await page.keyboard.press('ArrowRight');
  }
  await dialog.locator('[class*="touch-pan-y"]').evaluate(stage=>{
    const start=new Touch({identifier:1,target:stage,clientX:240,clientY:150});
    const end=new Touch({identifier:1,target:stage,clientX:80,clientY:155});
    stage.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start]}));
    stage.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[end]}));
  });
  await page.waitForFunction(()=>document.querySelector('[role="dialog"] img')?.getAttribute('src')==='/fixture/portrait.svg');
  await page.setViewportSize({width:844,height:390});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Landscape gallery fits viewport');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'gallery-390.png')});
  await page.keyboard.press('Escape'); assert.equal(await dialog.count(),0);
  assert.equal(await page.getByRole('button',{name:'Открыть фото 1'}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('link',{name:'Все проекты',exact:true}).click(); await page.waitForURL('**/swaps');
  await page.getByRole('link',{name:'Все услуги',exact:true}).click(); await page.waitForURL('**/services');
  role='customer'; fullCart=true;
  await page.setViewportSize({width:320,height:812});
  await page.goto(base+'/cart'); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('form').count()>0,true,'Populated checkout is rendered');
  await page.screenshot({path:path.join(out,'cart-320.png'),fullPage:true});
  const cartMetrics=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1;}).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,50),width:e.getBoundingClientRect().width}))}));
  fs.writeFileSync(path.join(out,'cart-metrics.json'),JSON.stringify(cartMetrics,null,2));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Populated cart fits 320px');
  for(const width of [360,375,390,412,430,440,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Populated cart fits ${width}px`);
  }
  fullCart=false; role='manager';
  await page.goto(base+'/admin/users'); await page.waitForURL('**/admin');
  await page.waitForLoadState('networkidle');
  for(const width of [320,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) console.log('ADMIN OVERFLOW',await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,40)}))})));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Admin layout fits ${width}px`);
    if(width<1024) {
      assert.equal(await page.locator('#admin-sidebar').isVisible(),false);
      await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
      assert.equal(await page.locator('#admin-sidebar').isVisible(),true);
      await page.keyboard.press('Escape');
    }
  }
  role='guest'; failOptimized=true;
  await page.goto(base+'/'); await page.waitForLoadState('networkidle');
  await page.waitForFunction(()=>[...document.querySelectorAll('#top img')].some(img=>img.complete&&img.naturalWidth>0&&img.getAttribute('src').includes('hero-suv')));
  failOptimized=false;
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/'); await page.waitForLoadState('networkidle');
  await page.screenshot({path:path.join(out,'home-390.png'),fullPage:false});
  for (const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]) {await page.setViewportSize({width,height});await page.screenshot({path:path.join(out,`home-${width}.png`)});}
  const interactions=['header scroll without navigation','mobile menu and Escape','Hero previous/next and bounded image loading','gallery portrait/panorama/square/small image containment','gallery keyboard, synthetic touch swipe and orientation','gallery focus restoration','swap/services navigation','populated cart at 10 widths','manager users redirect','admin layout and menu at 4 widths','failed WebP falls back to original'];
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:browser.version(),results,interactions,failures,errors},null,2));
  console.log(JSON.stringify({checks:results.length,interactions:interactions.length,failures,errors},null,2));
  await browser.close();
  assert.equal(errors.length,0,'Browser runtime errors'); assert.equal(failures.length,0,'Document overflow');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
