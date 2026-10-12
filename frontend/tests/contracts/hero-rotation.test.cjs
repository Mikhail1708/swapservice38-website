const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root=path.resolve(__dirname,'../..');
const assets=require('../../src/lib/hero-image-assets.json');
const api={};
new Function('require','exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/hero-rotation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(()=>({default:assets}),api);
test('UTC Monday boundaries, year rollover and equivalent timezone timestamps',()=>{
  const before=Date.parse('2026-12-27T23:59:59.999Z'),after=before+1;
  assert.equal(api.utcWeekIndex(after),api.utcWeekIndex(before)+1);
  assert.equal(api.utcWeekIndex(Date.parse('2026-12-31T23:59:59Z')),api.utcWeekIndex(Date.parse('2027-01-01T00:00:00Z')));
  assert.equal(api.utcWeekIndex(after),api.utcWeekIndex(Date.parse('2026-12-28T08:00:00+08:00')));
  assert.equal(api.nextUtcWeek(before),after);
  assert.equal(api.nextUtcWeek(Date.parse('2020-01-05T12:00:00Z')),Date.parse('2020-01-06T00:00:00Z'));
});
test('20 slots, all old photos included, independent repeatable cycles without repeats at cycle boundaries',()=>{
  assert.deepEqual(api.HERO_PHOTOS.map(x=>x.length),[5,5,2,4,4]);
  assert.deepEqual(api.HERO_PHOTOS.map(x=>x[0].src),[4,2,3,1,5].map(n=>`/images/hero-suv${n}.png`));
  api.HERO_PHOTOS.forEach((photos,theme)=>{
    for(let cycle=0;cycle<4;cycle++) {
      const indices=photos.map((_,i)=>api.weeklyPhotoIndex(cycle*photos.length+i,photos.length,theme));
      assert.equal(new Set(indices).size,photos.length);
      if(cycle) assert.notEqual(indices[0],api.weeklyPhotoIndex(cycle*photos.length-1,photos.length,theme));
    }
  });
});
test('missing selected photo falls back in the same theme without shifting the rotation',()=>{
  const full=Object.fromEntries(api.HERO_PHOTOS[1].map(p=>[p.src,{}]));
  const week=Array.from({length:5},(_,i)=>i).find(w=>api.selectHeroPhoto(1,w,full).src.endsWith('tunning1.png'));
  assert.notEqual(week,undefined);
  assert.equal(api.selectHeroPhoto(1,week,{}).src,'/images/hero-suv2.png');
  assert.equal(api.selectHeroPhoto(1,week,assets).src,'/images/hero-suv2.png');
});
test('all manifest originals and responsive variants exist; no upscaling; only one source is absent',()=>{
  assert.equal(Object.keys(assets).length,19);
  for(const [src,asset] of Object.entries(assets)) {
    assert.ok(fs.existsSync(path.join(root,'public',decodeURIComponent(src))));
    for(const entry of asset.srcSet.split(', ')) {
      const [url,width]=entry.split(' ');
      assert.ok(parseInt(width)<=asset.width);
      const buffer=fs.readFileSync(path.join(root,'public',url));
      assert.equal(buffer.toString('ascii',8,12),'WEBP');
      assert.ok(buffer.length>100);
    }
  }
  const absent=api.HERO_PHOTOS.flat().filter(p=>!assets[p.src]).map(p=>p.src);
  assert.deepEqual(absent,['/images/hero/tunning1.png']);
});
