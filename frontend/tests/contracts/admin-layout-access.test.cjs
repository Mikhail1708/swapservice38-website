const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function render(role,pathname) {
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../src/components/admin/layout/AdminLayout.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={}; const jsx=(type,props)=>({type,props});
  new Function('require','exports',code)(name=>{
    if(name==='react') return {useState:v=>[v,()=>{}],useEffect:()=>{}};
    if(name==='react/jsx-runtime') return {jsx,jsxs:jsx};
    if(name==='@/lib/next-shims') return {Link:'a',usePathname:()=>pathname,useRouter:()=>({replace(){}})};
    if(name==='@/lib/hooks/useAuth') return {useAuth:()=>({user:role?{role,email:'fixture@example.test'}:null,isLoading:false})};
    return {};
  },exports);
  return exports.AdminLayout({children:'private-content'});
}
test('unauthorized children never mount before a redirect; manager user-management routes fail closed',()=>{
  assert.equal(render(null,'/admin'),null);
  assert.equal(render('customer','/admin'),null);
  assert.equal(render('manager','/admin/users'),null);
  assert.equal(render('manager','/admin/users/123'),null);
  assert.notEqual(render('manager','/admin/orders'),null);
  assert.notEqual(render('admin','/admin/users'),null);
});
