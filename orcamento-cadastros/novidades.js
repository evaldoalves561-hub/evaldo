/* Novidades: no primeiro acesso de cada master depois da atualização, mostra o que mudou. Só some ao clicar em "Entendi" (fica gravado em restrito/novidades). */
const NOV_VER="2026-10-28-pendencias";
const NOV_ITENS=[["Pendências em quadros","Acessos, Obras novas, Insumos sem modelo, Falta gerente e Padronizar nomes e Regionais. Cada quadro mostra quanto falta."],
 ["Modo passo a passo","O botão Começar mostra uma pendência por vez: confirme (ou Enter), pule ou volte até zerar."],
 ["Gerente esperando","Obras com gerente cadastrado e ainda sem acesso aparecem primeiro. Acertar acessos libera tudo de uma vez."],
 ["Acesso automático ao salvar","Ao salvar em Cadastros, o app recalcula quem vê cada obra. Não precisa mais liberar pela Pendências."],
 ["Obras fora da estrutura","Ao subir a estrutura, obras que saíram dela ou estão inativas no ERP ficam inativas e saem dos Indicadores."],
 ["Indicadores mais claros","Mostra quantas obras entram na conta e quantas ficam fora (inativas, pausadas, fora do app)."],
 ["Suporte","Botão verde no canto da tela para relatar erro ou sugestão, com print. As respostas aparecem em Meus chamados."]];
async function novMostrar(){if(!S.owner||S.offline)return;let D={};try{const d=await S.db.doc("restrito/novidades").get();D=d.exists?d.data():{}}catch(_){return}
  if(((D.vistos||{})[S.me]||"")===NOV_VER)return;
  const w=document.createElement("div");w.className="sup-modal";w.id="nov-modal";w.setAttribute("role","dialog");w.setAttribute("aria-modal","true");
  w.innerHTML=`<div class="sup-dlg card"><h2 style="margin:0">O que mudou no app</h2><p class="desc" style="margin:4px 0 10px">Leia antes de continuar. Esta tela aparece só uma vez.</p>
   <ol style="margin:0;padding-left:20px;display:grid;gap:8px">${NOV_ITENS.map(([t,d])=>`<li><b>${esc(t)}</b><br><span class="muted" style="font-size:13px">${esc(d)}</span></li>`).join("")}</ol>
   <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" id="nov-ok">Entendi</button><button class="btn" id="nov-pend">Entendi, abrir Pendências</button></div></div>`;
  document.body.appendChild(w);$("#nov-ok").focus()}
async function novVisto(){try{const d=await S.db.doc("restrito/novidades").get();const D=d.exists?d.data():{};D.vistos={...(D.vistos||{}),[S.me]:NOV_VER};D.em={...(D.em||{}),[S.me]:nowISO()};await S.db.doc("restrito/novidades").set(D)}catch(_){}const w=$("#nov-modal");if(w)w.remove()}
document.addEventListener("click",async e=>{const t=e.target;if(t.id==="nov-ok"){await novVisto();return}if(t.id==="nov-pend"){await novVisto();const b=$("#tab-pend");if(b)b.click();return}});
