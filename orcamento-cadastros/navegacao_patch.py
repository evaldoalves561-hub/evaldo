import sys
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
def r(a,b,n=1):
    global s
    c=s.count(a);assert c==n,(a[:90],c);s=s.replace(a,b)
# 1) abas não estouram a tela no celular
r('.tabs{display:flex;gap:4px;margin-left:auto}','.tabs{display:flex;gap:4px;margin-left:auto;max-width:100%;overflow-x:auto;scrollbar-width:thin}.tabs .tab{flex:none}')
# 2) aba Cadastros não abre Pendências
r('''{const tc=$("#tab-cad");if(tc)tc.addEventListener("click",async()=>{await flush();showTab("cad")})}''','''{const tc=$("#tab-cad");if(tc)tc.addEventListener("click",async()=>{await flush();S.cad=S.cad||cadNovo();if(S.cad.aba==="pend")S.cad.aba="obras";if(S.tab==="cad")cadMostrar(S.cad.aba);else showTab("cad")})}''')
# 3) aviso ao sair de Cadastros sem salvar + 4) botão Voltar do navegador entre abas
r('''$("#tab-sg").addEventListener("click",async()=>{await flush();showTab("sg")});''','''$("#tab-sg").addEventListener("click",async()=>{await flush();showTab("sg")});
/* navegação (28/10): Voltar do navegador troca de aba; sair de Cadastros sem salvar avisa e marca a aba */
{const base=showTab;let pop=false;
  showTab=function(t){const de=S.tab;base(t);const suja=typeof cadSujo==="function"&&!!S.cad&&cadSujo();
    if(de==="cad"&&S.tab!=="cad"&&suja)toast("Alterações em Cadastros ainda não foram salvas. Volte em Cadastros e clique em Salvar.");
    const tc=$("#tab-cad");if(tc)tc.textContent=suja?"Cadastros •":"Cadastros";
    navPush()};
  const navPush=()=>{if(pop)return;const k=S.tab+(S.tab==="cad"&&S.cad?":"+S.cad.aba:"");try{if(!history.state||!history.state.k)history.replaceState({k},"");else if(history.state.k!==k)history.pushState({k},"")}catch(_){}};
  const baseCad=cadMostrar;cadMostrar=function(a){baseCad(a);if(S.tab==="cad")navPush()};
  window.addEventListener("popstate",async e=>{const k=e.state&&e.state.k;if(!k||!S.me)return;await flush();const [t,a]=k.split(":");if(a){S.cad=S.cad||cadNovo();S.cad.aba=a}
    pop=true;try{if(t==="cad"&&S.tab==="cad")cadMostrar(a);else showTab(t)}finally{pop=false}})}''')
open(dst,'w',encoding='utf-8').write(s);print("ok")
