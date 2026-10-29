import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def r(a,b,n=1):
    global s
    c=s.count(a);assert c==n,(a[:90],c);s=s.replace(a,b)
r('''async function loadCat(){if(!S.cat){const c=await S.db.doc("restrito/catalogo").get();S.cat=c.exists?c.data():{obras:[]};S.catMap=new Map(S.cat.obras.map(c=>[c[0],c]))}}''',
'''/* 29/10 (Evaldo): obras 71100 e as obras da Matriz (empresa 3) seguem o modelo 71200, só com o produto Despesas Administrativas (3000) */
const BASE_FIXA={tipo:"71200",prods:["3000"]};
function baseFixa(o){const m=/^(\\d+)-(.+)$/.exec(String(o||""));if(!m)return null;return (m[1]==="3"||m[2]==="71100")?BASE_FIXA:null}
function baseFixaPerfil(p){Object.entries((p&&p.obras)||{}).forEach(([o,i])=>{const bf=baseFixa(o);if(bf&&i)i.tipo=bf.tipo});return p}
async function loadCat(){if(!S.cat){const c=await S.db.doc("restrito/catalogo").get();S.cat=c.exists?c.data():{obras:[]};S.cat.obras.forEach(c=>{const bf=baseFixa(c[0]);if(bf)c[3]=bf.tipo});S.catMap=new Map(S.cat.obras.map(c=>[c[0],c]))}}''')
r('''S.perfil=snap.exists?snap.data():{obras:{}};S.perfil.obras=S.perfil.obras||{};''','''S.perfil=snap.exists?snap.data():{obras:{}};S.perfil.obras=S.perfil.obras||{};baseFixaPerfil(S.perfil);''')
r('''{obras:{}});perfil.obras=perfil.obras||{};
  let info=perfil.obras[o]''','''{obras:{}});perfil.obras=perfil.obras||{};baseFixaPerfil(perfil);
  let info=perfil.obras[o]''')
r('''const p=d.p;const q=await S.db.collection(`gerentes/${d.id}/orc`).get();''','''const p=baseFixaPerfil(d.p);const q=await S.db.collection(`gerentes/${d.id}/orc`).get();''')
r('''function produtosDaObra(hist,lines,o,tipo){''','''function produtosDaObra(hist,lines,o,tipo){{const bf=baseFixa(o);if(bf)return new Set(bf.prods)}''')
open(dst,'w',encoding='utf-8').write(s);print('ok')
