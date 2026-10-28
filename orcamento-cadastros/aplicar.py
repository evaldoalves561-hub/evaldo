"""Inclui a aba "Cadastros" no index.html do Orçamento 2027–2029.
Uso: python aplicar.py index.html  (gera index_cadastros.html ao lado; o original não é alterado)"""
import pathlib, sys

aqui = pathlib.Path(__file__).resolve().parent
orig = pathlib.Path(sys.argv[1])
s = orig.read_text(encoding="utf-8")
if 'id="v-cad"' in s:
    sys.exit("Este arquivo já tem a aba Cadastros.")
css = (aqui / "cadastros.css").read_text(encoding="utf-8")
html = (aqui / "cadastros.html").read_text(encoding="utf-8")
js = (aqui / "cadastros.js").read_text(encoding="utf-8")

def troca(velho, novo, n=1):
    global s
    if s.count(velho) != n:
        sys.exit(f"Trecho não encontrado (esperado {n}x): {velho[:70]}")
    s = s.replace(velho, novo)

troca("</style>\n\n<header", css + "</style>\n\n<header")
troca('Estrutura</button>\n', 'Estrutura</button>\n    <button class="tab" id="tab-pend" aria-selected="false" hidden>Pendências</button>\n    <button class="tab" id="tab-cad" aria-selected="false" hidden>Cadastros</button>\n')
troca("</main>", html + "</main>")
troca('["#tab-ind","#tab-ger","#tab-imp","#tab-est","#tab-adm"].forEach(q=>$(q).hidden=false)',
      '["#tab-ind","#tab-ger","#tab-imp","#tab-est","#tab-adm","#tab-cad","#tab-pend"].forEach(q=>$(q).hidden=false)')
troca('["#tab-ind","#tab-ger","#tab-imp","#tab-est","#tab-adm","#tab-sg"].forEach(q=>$(q).hidden=true)',
      '["#tab-ind","#tab-ger","#tab-imp","#tab-est","#tab-adm","#tab-sg","#tab-cad","#tab-pend"].forEach(q=>{const e=$(q);if(e)e.hidden=true})')
troca('const tabOf={fill:"tab-fill",', 'const tabOf={cad:"tab-cad",fill:"tab-fill",')
troca('$("#v-sg").hidden=t!=="ger";',
      '$("#v-sg").hidden=t!=="ger";{const vc=$("#v-cad");if(vc)vc.hidden=t!=="cad";const tp=$("#tab-pend");if(tp)tp.setAttribute("aria-selected",String(t==="cad"&&!!S.cad&&S.cad.aba==="pend"));if(t==="cad"&&S.cad&&S.cad.aba==="pend")$("#tab-cad").setAttribute("aria-selected","false")}if(t==="cad")abrirCadastros().catch(e=>{$("#cad-msg").textContent="Não foi possível carregar: "+(e.message||e)});')
troca("(window.OFFLINE?iniciarOffline()", js + "\n(window.OFFLINE?iniciarOffline()")

dest = orig.with_name(orig.stem + "_cadastros.html")
dest.write_text(s, encoding="utf-8")
print("Gerado:", dest)
