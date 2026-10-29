import sys,json
sys.path.insert(0,'est_modelo')
from rebuild import carregar,ler,rebuild
src,dst,xlsx=sys.argv[1],sys.argv[2],sys.argv[3]
s=open(src,encoding='utf-8').read()
def r(a,b,n=1):
    global s
    c=s.count(a);assert c==n,(a[:90],c);s=s.replace(a,b)
# 1) modelos (T) pela Estrutura - Modelo: insumos novos entram; os que saíram ficam (para não esconder valor digitado)
i,j,e,T=carregar(s);log=[];rebuild(T,ler(xlsx),log)
s=s[:j]+json.dumps(T,ensure_ascii=False,separators=(",",":"))+s[e:]
open(dst+'.log','w').write('\n'.join(x for x in log if x))
# 2) carregar insumos_fora
r('''try{const sb=await db.doc("regras/subitens").get();S.subR=sb.exists?sb.data():null}catch(e){S.subR=null}''','''try{const sb=await db.doc("regras/subitens").get();S.subR=sb.exists?sb.data():null}catch(e){S.subR=null}
  await carregarInsFora();''')
r('''    if(rg.exists){S.regras=rg.data();indexRegras()}S.dpR=dp.exists?dp.data():null;S.subR=sb.exists?sb.data():null}catch(e){}}''','''    if(rg.exists){S.regras=rg.data();indexRegras()}S.dpR=dp.exists?dp.data():null;S.subR=sb.exists?sb.data():null}catch(e){}await carregarInsFora()}''')
# 3) Preencher: insumo fora/inativado por base fica travado e some se não tiver valor
r('''    {const fo=foraDe(cur.o,l.area);l.fora=!!fo;if(fo){l.canEdit=false;l.lockMsg="Planejado fora do aplicativo"+(fo.motivo?": "+fo.motivo:"")}}''','''    {const fo=foraDe(cur.o,l.area);l.fora=!!fo;if(fo){l.canEdit=false;l.lockMsg="Planejado fora do aplicativo"+(fo.motivo?": "+fo.motivo:"")}}
    {const fi=foraIns(cur.info.tipo,l);l.foraIns=fi;if(fi&&!l.orf){l.fora=true;l.canEdit=false;l.lockMsg=(fi.t==="inativo"?"Saiu do modelo":"Planejado fora do aplicativo")+(fi.area?" · "+fi.area:"")+". O valor já digitado foi mantido; a Controladoria decide onde ele fica."}}''')
r('''if(l.kind==="leaf"&&(oculto(l)||(l.absorvido&&!sum(l.h)))&&!temValor(S.cur.doc,l))return false;''','''if(l.kind==="leaf"&&(oculto(l)||l.foraIns||(l.absorvido&&!sum(l.h)))&&!temValor(S.cur.doc,l))return false;''')
r('''title="${esc(l.lockMsg)}">${l.fora?"fora do app"''','''title="${esc(l.lockMsg)}">${l.fora?(l.foraIns&&l.foraIns.t==="inativo"?"saiu do modelo":"fora do app")''')
# 4) Indicadores
r('''if(!temV&&foraDe(o,area))return;''','''if(!temV&&(foraDe(o,area)||foraIns(tipo,l)))return;''')
r('''if(foraDe(o,area))return;''','''if(foraDe(o,area)||foraIns(tipo,l))return;''')
# 5) áreas da obra (Pendências / Falta preencher): área só com insumo fora não conta
r('''const calc=new Set(cadLeaves(tipo).map(l=>{const r=ruleFor(tipo,l,id);return r&&r[1]}).filter(Boolean));''','''const calc=new Set(cadLeaves(tipo).filter(l=>!foraIns(tipo,l)).map(l=>{const r=ruleFor(tipo,l,id);return r&&r[1]}).filter(Boolean));''')
# 6) importador
r('async function quemSou(){',open('estmod.js',encoding='utf-8').read()+'const EM={};\nasync function quemSou(){')
r('''      <div class="card" data-grp="imp" id="card-antigas">''','''      <div class="card" data-grp="imp" id="card-est-modelo"><h2>Estrutura modelo (quem planeja e o que fica fora do app)</h2><p class="desc">Suba a planilha <b>Estrutura - Modelo</b> (Obra = base modelo, Produto, Item, Servico, Insumo, Descricao e <b>Observação</b>). Antes de gravar, o app mostra o que muda. Nada já digitado é alterado ou apagado, e os subitens criados pelos gerentes ficam como estão. Gente e Gestão, TI, Engenharia e Obras Corporativas ficam sempre fora do app.</p>
        <div class="row"><label class="btn primary" for="em-file" style="display:inline-block">Escolher Estrutura - Modelo</label><input type="file" id="em-file" accept=".xlsx,.xls" hidden></div><p class="muted" id="em-msg" style="margin:6px 0 0"></p><div id="em-prev"></div></div>
      <div class="card" data-grp="imp" id="card-antigas">''')
# 7) nome da aba
r('<button class="tab" id="tab-imp" aria-selected="false" hidden>Avançado</button>','<button class="tab" id="tab-imp" aria-selected="false" hidden>Bases e importações</button>')
s=s.replace("← Voltar para Avançado","← Voltar para Bases e importações").replace("guardada em Avançado","guardada em Bases e importações")
r('As telas repetidas estão em Avançado › Telas antigas.','As telas repetidas estão em Bases e importações › Telas antigas.')
r('''["Suporte","Botão verde''','''["Estrutura modelo","Insumos de Gente e Gestão, TI, Engenharia e Obras Corporativas são planejados fora do app e saem do Preencher e dos Indicadores. Valores já digitados foram mantidos."],
 ["Suporte","Botão verde''')
r('const NOV_VER="2026-10-29-menu";','const NOV_VER="2026-10-29-estrutura";')
open(dst,'w',encoding='utf-8').write(s);print("ok")
