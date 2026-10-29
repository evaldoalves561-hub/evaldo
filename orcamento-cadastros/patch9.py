import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def r(a,b,n=1):
    global s
    c=s.count(a);assert c==n,(a[:90],c);s=s.replace(a,b)
# menu: 7 abas, na ordem do trabalho
r('''    <button class="tab" id="tab-ger" aria-selected="false" hidden>Gerentes e acessos</button>
    <button class="tab" id="tab-imp" aria-selected="false" hidden>Importações</button>
    <button class="tab" id="tab-est" aria-selected="false" hidden>Estrutura</button>
    <button class="tab" id="tab-pend" aria-selected="false" hidden>Pendências</button>
    <button class="tab" id="tab-cad" aria-selected="false" hidden>Cadastros</button>
    <button class="tab" id="tab-adm" aria-selected="false" hidden>Gerenciar acesso</button>''','''    <button class="tab" id="tab-pend" aria-selected="false" hidden>Pendências</button>
    <button class="tab" id="tab-cad" aria-selected="false" hidden>Cadastros</button>
    <button class="tab" id="tab-adm" aria-selected="false" hidden>Acessos</button>
    <button class="tab" id="tab-imp" aria-selected="false" hidden>Avançado</button>
    <button class="tab" id="tab-ger" aria-selected="false" hidden aria-hidden="true" tabindex="-1">Telas antigas</button>
    <button class="tab" id="tab-est" aria-selected="false" hidden aria-hidden="true" tabindex="-1">Estrutura</button>''')
r('''["#tab-ind","#tab-ger","#tab-imp","#tab-est","#tab-adm","#tab-cad","#tab-pend"].forEach(q=>$(q).hidden=false)''','''["#tab-ind","#tab-imp","#tab-adm","#tab-cad","#tab-pend"].forEach(q=>$(q).hidden=false)''')
# telas antigas ficam dentro de Avançado
r('''ger:"tab-ger",imp:"tab-imp",est:"tab-est",''','''ger:"tab-imp",imp:"tab-imp",est:"tab-imp",''')
r('''<div class="card" data-grp="imp" id="card-imp-config">''','''<div class="card" data-grp="ger" id="card-imp-config">''')
r('''<div class="card" data-grp="imp" id="card-imp-sistema">''','''<div class="card" data-grp="ger" id="card-imp-sistema">''')
r('''<div class="card" id="assign-card">''','''<div class="card" data-grp="ger" id="assign-card">''')
r('''[/^Controle de acesso/i,"ger"]''','''[/^Controle de acesso/i,"acc"]''')
AV='''<div class="card ant-aviso"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><div><h2 style="margin:0">%s</h2><p class="desc" style="margin:4px 0 0">Tela antiga, guardada em Avançado. O dia a dia já é feito em <b>Cadastros</b> e <b>Pendências</b>.</p></div><button class="btn" data-ant-ir="imp">← Voltar para Avançado</button></div></div>'''
r('''  <section id="v-sg" hidden>
''','''  <section id="v-sg" hidden>
    '''+AV%"Telas antigas: gerentes, importação da CONFIGURAÇÃO e do sistema, fora do app"+'''
''')
r('''  <section id="v-est" hidden>
''','''  <section id="v-est" hidden>
    '''+AV%"Estrutura (tela antiga)"+'''
''')
# cartão "Telas antigas" no fim de Avançado
r('''      <div class="card" data-grp="ger" id="assign-card">''','''      <div class="card" data-grp="imp" id="card-antigas"><h2>Telas antigas</h2><p class="desc">Telas que repetem o que hoje se faz em <b>Cadastros</b> e <b>Pendências</b>. Ficam guardadas aqui caso precise de alguma.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-ant-ir="ger">Gerentes, sem gerente, importar CONFIGURAÇÃO e sistema, fora do app</button><button class="btn" data-ant-ir="est">Estrutura (Base - Geral)</button></div></div>
      <div class="card" data-grp="ger" id="assign-card">''')
r('''async function quemSou(){''','''document.addEventListener("click",async e=>{const b=e.target.closest&&e.target.closest("[data-ant-ir]");if(!b)return;await flush();showTab(b.dataset.antIr);scrollTo(0,0)});
async function quemSou(){''')
r('.sup-fab{','.ant-aviso{border-left:4px solid var(--warn)}#card-antigas{order:99}\n.sup-fab{')
# texto das novidades
r('''["Suporte","Botão verde''','''["Menu mais enxuto","Ficaram Orçamento, Indicadores, Pendências, Cadastros, Acessos, Avançado e Suporte. As telas repetidas estão em Avançado › Telas antigas."],
 ["Suporte","Botão verde''')
r('const NOV_VER="2026-10-28-pendencias";','const NOV_VER="2026-10-29-menu";')
open(dst,'w',encoding='utf-8').write(s);print("ok")
s=open(dst,encoding='utf-8').read()
a='t.textContent=n?`Gerenciar acesso (${n})`:"Gerenciar acesso";';assert s.count(a)==1
s=s.replace(a,'t.textContent=n?`Acessos (${n})`:"Acessos";')
open(dst,'w',encoding='utf-8').write(s);print("ok2")
s=open(dst,encoding='utf-8').read()
def r2(a,b):
    global s
    assert s.count(a)==1,a[:80];s=s.replace(a,b)
r2('async function quemSou(){',open('cfgx.js',encoding='utf-8').read()+'async function quemSou(){')
r2('''clicar em <b>Salvar</b>.</p></div>''','''clicar em <b>Salvar</b>.</p></div><button class="btn" data-cfg-xlsx="1" style="flex:none">Baixar CONFIGURAÇÃO (Excel)</button>''')
r2('''<div class="row"><label class="btn primary" for="pl-file" style="display:inline-block">Carregar CONFIGURAÇÃO</label></div></div>''','''<div class="row"><label class="btn primary" for="pl-file" style="display:inline-block">Carregar CONFIGURAÇÃO</label><button class="btn" data-cfg-xlsx="1">Baixar CONFIGURAÇÃO atual (Excel)</button></div></div>''')
r2('''<button class="btn" data-ant-ir="est">Estrutura (Base - Geral)</button></div></div>''','''<button class="btn" data-ant-ir="est">Estrutura (Base - Geral)</button><button class="btn" data-cfg-xlsx="1">Baixar CONFIGURAÇÃO (Excel)</button></div></div>''')
open(dst,'w',encoding='utf-8').write(s);print("ok3")
s=open(dst,encoding='utf-8').read()
a='Para marcar só uma área como fora do app, use “Planejamento fora do aplicativo” em Gerentes e acessos.'
assert s.count(a)==1;s=s.replace(a,'Para marcar só uma área como fora do app, selecione as obras e use “Área fora do app” na barra que aparece.')
open(dst,'w',encoding='utf-8').write(s);print("ok4")
