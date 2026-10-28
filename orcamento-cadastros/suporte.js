/* ===================== SUPORTE (28/10) =====================
   Gerentes e masters abrem chamados (gerentes/<uid>/suporte/<id>). O responsável (restrito/config.suporte.dono) vê a caixa de chamados.
   Triagem automática: erro de código → texto pronto para o Claude; acesso/cadastro → precisa liberar; dúvida/sugestão. */
const SUP={erros:[],avisos:[]};
window.addEventListener("error",e=>{SUP.erros.push({em:nowISO(),m:String((e&&e.message)||e).slice(0,300),f:e&&e.filename?String(e.filename).split("/").pop()+":"+e.lineno:""});SUP.erros=SUP.erros.slice(-15)});
window.addEventListener("unhandledrejection",e=>{SUP.erros.push({em:nowISO(),m:"Promessa: "+String((e&&e.reason&&(e.reason.message||e.reason))||"").slice(0,300)});SUP.erros=SUP.erros.slice(-15)});
{const ce=console.error;console.error=function(...a){try{SUP.erros.push({em:nowISO(),m:a.map(x=>x&&x.message?x.message:String(x)).join(" ").slice(0,300)});SUP.erros=SUP.erros.slice(-15)}catch(_){}return ce.apply(this,a)}}
const SUP_TIPO={erro:"Deu erro / travou",acesso:"Não vejo obra, insumo ou área",valor:"Valor ou cálculo estranho",duvida:"Dúvida",sugestao:"Sugestão"};
const SUP_TRI={codigo:"Erro de código",acesso:"Acesso ou cadastro",duvida:"Dúvida ou sugestão"};
const SUP_ST={novo:"Novo",analise:"Em análise",claude:"Enviado ao Claude",liberar:"Falta liberar acesso",resolvido:"Resolvido"};
function supEuDono(){const d=S.cfg&&S.cfg.suporte&&S.cfg.suporte.dono;return S.owner&&(d?d===S.me:true)}
async function supIniciar(){try{if(!S.cfg){const c=await S.db.doc("restrito/config").get();S.cfg=c.exists?c.data():{}}}catch(e){S.cfg=S.cfg||{}}
  const dono=S.cfg&&S.cfg.suporte&&S.cfg.suporte.dono;const souDono=S.owner&&dono===S.me;
  $("#sup-fab").hidden=!!souDono;const ts=$("#tab-sup");if(ts){ts.hidden=!(S.owner&&(!dono||souDono));if(!ts.hidden)supContar().catch(()=>{})}}
function supContexto(){const c=S.cur;const info=c&&c.info||{};let edit=null;try{edit=c&&c.lines?c.lines.filter(l=>l.kind==="leaf"&&l.canEdit).length:null}catch(_){}
  return {tela:S.tab||"fill",sub:S.cad&&S.tab==="cad"?S.cad.aba:"",obra:c?c.o:"",obraNome:info.nome||"",tipoBase:info.tipo||"",areas:info.areas||[],status:c&&c.doc?c.doc.status:"",linhasEditaveis:edit,
    obrasNoPerfil:Object.keys((S.perfil&&S.perfil.obras)||{}).length,owner:!!S.owner,regional:!!S.regional,versao:typeof CLI_VER!=="undefined"?CLI_VER:"",nav:navigator.userAgent.slice(0,180),tela_px:innerWidth+"×"+innerHeight,erros:SUP.erros.slice(-10)}}
function supAbrir(){const m=$("#sup-modal");m.hidden=false;const c=S.cur;$("#sup-onde").value=c?`Obra ${c.o} ${(c.info&&c.info.nome)||""}`.trim():({fill:"Orçamento",ind:"Indicadores",cad:"Cadastros",reg:"Regional"}[S.tab]||S.tab||"");
  $("#sup-msg").textContent="";if(SUP.erros.length)$("#sup-tipo").value="erro";supAba("novo");$("#sup-txt").focus()}
function supAba(a){document.querySelectorAll("#sup-modal [data-sup]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.sup===a)));$("#sup-novo").hidden=a!=="novo";$("#sup-meus").hidden=a!=="meus";if(a==="meus")supMeus()}
async function supImg(f){return new Promise((ok,er)=>{const im=new Image();const u=URL.createObjectURL(f);im.onload=()=>{const k=Math.min(1,1280/Math.max(im.width,im.height));const cv=document.createElement("canvas");cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);let q=.7,d=cv.toDataURL("image/jpeg",q);while(d.length>350000&&q>.3){q-=.15;d=cv.toDataURL("image/jpeg",q)}ok(d)};im.onerror=er;im.src=u})}
async function supEnviar(){const txt=$("#sup-txt").value.trim();const msg=$("#sup-msg");if(txt.length<5){msg.textContent="Escreva o que está acontecendo.";return}
  const b=$("#sup-enviar");b.disabled=true;msg.textContent="Enviando…";
  try{const nome=await quemSou();const id=new Date().toISOString().replace(/\D/g,"").slice(0,14)+"-"+Math.random().toString(36).slice(2,6);
    const doc={id,uid:S.me,nome,tipo:$("#sup-tipo").value,onde:$("#sup-onde").value.trim(),texto:txt,img:SUP.img||"",ctx:supContexto(),st:"novo",criadoEm:nowISO(),hist:[{em:nowISO(),por:nome,ev:"Chamado aberto"}]};
    await S.db.doc(`gerentes/${S.me}/suporte/${id}`).set(doc);
    /* garante que a caixa de chamados encontre quem abriu: masters ficam num índice; quem não tem perfil ganha um perfil vazio (igual ao padrão) */
    try{if(S.owner){const ix=await S.db.doc("restrito/suporte_idx").get();const u=new Set((ix.exists&&ix.data().uids)||[]);if(!u.has(S.me)){u.add(S.me);await S.db.doc("restrito/suporte_idx").set({uids:[...u]})}}
      else{const pf=S.db.doc("gerentes/"+S.me);if(!(await pf.get()).exists)await pf.set({obras:{}})}}catch(_){}
    $("#sup-txt").value="";$("#sup-img").value="";SUP.img="";$("#sup-prev").hidden=true;msg.textContent="";toast("Chamado enviado. Acompanhe em Meus chamados.");supAba("meus")}
  catch(e){msg.textContent="Não foi possível enviar: "+(e.message||e)}b.disabled=false}
async function supLer(uid){const q=await S.db.collection(`gerentes/${uid}/suporte`).get();return q.docs.map(d=>d.data()).filter(Boolean)}
async function supMeus(){const box=$("#sup-lista");box.innerHTML='<p class="muted">Carregando…</p>';
  try{const L=(await supLer(S.me)).sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
    box.innerHTML=L.length?L.map(c=>`<article class="sup-ch st-${esc(c.st)}"><header><b>${esc(SUP_TIPO[c.tipo]||c.tipo)}</b><span class="pill ${c.st==="resolvido"?"enviado":c.st==="novo"?"rascunho":"reaberto"}">${esc(SUP_ST[c.st]||c.st)}</span></header><div class="muted" style="font-size:12px">${esc(fmtDate(c.criadoEm))} · ${esc(c.onde||"")}</div><div class="txt">${esc(c.texto)}</div>${c.resposta?`<div class="cp-ajuste" style="background:var(--accent-soft);color:var(--ink)"><b>Resposta da Controladoria:</b> ${esc(c.resposta)}</div>`:""}</article>`).join(""):'<p class="muted">Você ainda não abriu chamados.</p>'}
  catch(e){box.textContent="Não foi possível carregar: "+(e.message||e)}}
/* triagem: o que dá para saber sem perguntar */
function supTriar(c){const x=c.ctx||{};const t=semAc((c.texto||"")+" "+(c.onde||""));
  if(c.tipo==="duvida"||c.tipo==="sugestao")return ["duvida","Dúvida ou sugestão"];
  if((x.erros||[]).length)return ["codigo",`${x.erros.length} erro(s) registrados na tela: “${x.erros[x.erros.length-1].m}”`];
  if(c.tipo==="acesso"||/nao (vejo|aparece|consigo ver|tenho acesso)|sumiu a obra|sem acesso|liberar/.test(t)){
    if(!x.owner&&x.obrasNoPerfil===0)return ["acesso","A pessoa não tem nenhuma obra liberada"];
    if(x.obra&&x.linhasEditaveis===0)return ["acesso",`Obra ${x.obra} aberta sem nenhum insumo editável para as áreas dela (${(x.areas||[]).join(", ")||"nenhuma área"})`];
    return ["acesso","Relato de obra, insumo ou área que não aparece"]}
  if(c.tipo==="erro"||/erro|travou|nao salva|nao salvou|tela branca|nao carrega|bug/.test(t))return ["codigo","Relato de erro, sem erro técnico registrado na tela"];
  return ["codigo","Valor ou cálculo: conferir regra/código"]}
function supAcessoDe(c){const P=(S.pessoas||[]).find(p=>semAc(p.nome||"")===semAc(c.nome||""));if(!P)return "Não achei esta pessoa no cadastro de gerentes (pelo nome).";
  const ids=Object.keys(P.acc||{});const m=/\b(\d{1,4})-?(\d{4,6})\b/.exec((c.onde||"")+" "+(c.texto||""));let o="";if(m){const id=m[1]+"-"+m[2];o=P.acc[id]?` Na obra ${id}: ${P.acc[id].join(", ")}.`:` Sem acesso à obra ${id}.`}
  return `${P.nome} (${P.email}) tem ${ids.length} obra(s) liberada(s).${o}`}
function supTextoClaude(c){const x=c.ctx||{};return ["CHAMADO DE SUPORTE · Orçamento 2027–2029",`Quem: ${c.nome} · ${x.owner?"master":"gerente"} · aberto em ${fmtDate(c.criadoEm)}`,`Tipo: ${SUP_TIPO[c.tipo]||c.tipo} · Onde: ${c.onde||"-"}`,"Relato:",c.texto,"",
  `Tela: ${x.tela}${x.sub?" › "+x.sub:""} · Obra aberta: ${x.obra||"-"} ${x.obraNome||""} · Base: ${x.tipoBase||"-"} · Situação: ${x.status||"-"}`,`Áreas da pessoa na obra: ${(x.areas||[]).join(", ")||"-"} · Linhas editáveis: ${x.linhasEditaveis==null?"-":x.linhasEditaveis} · Obras no perfil: ${x.obrasNoPerfil}`,
  `Versão do app: ${x.versao||"-"} · Navegador: ${x.nav} · Tela: ${x.tela_px}`,"Erros registrados:",...((x.erros||[]).length?x.erros.map(e=>`- ${e.em} ${e.m}${e.f?" ("+e.f+")":""}`):["- nenhum"]),c.img?"(há um print anexado no chamado)":""].join("\n")}
async function supInbox(){const box=$("#sup-inbox");box.innerHTML='<p class="muted">Carregando chamados…</p>';
  try{if(!S.cfg){const cf=await S.db.doc("restrito/config").get();S.cfg=cf.exists?cf.data():{}}if(!S.pessoas){const pp=await S.db.doc("restrito/pessoas").get();S.pessoas=pp.exists?pp.data().lista||[]:[]}}catch(_){}
  const dono=S.cfg&&S.cfg.suporte&&S.cfg.suporte.dono;$("#sup-dono").innerHTML=dono===S.me?'Você é quem recebe os chamados; o botão Suporte não aparece para você.':'<button class="btn sm" id="sup-sou">Sou eu quem recebe os chamados</button> <span>Marque uma vez: a caixa de chamados fica só com você e os outros masters passam a ver o botão Suporte.</span>';
  const g=await S.db.collection("gerentes").get();let ix=[];try{const d=await S.db.doc("restrito/suporte_idx").get();ix=(d.exists&&d.data().uids)||[]}catch(_){}const uids=[...new Set(g.docs.map(d=>d.id).concat(ix,S.me))];const L=[];
  for(let i=0;i<uids.length;i+=15){const R=await Promise.all(uids.slice(i,i+15).map(u=>supLer(u).catch(()=>[])));R.forEach(a=>L.push(...a))}
  L.forEach(c=>{const [k,m]=supTriar(c);c._tri=k;c._por=m});L.sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));S.supL=L;supDesenhar();supBadge()}
function supBadge(){const n=(S.supL||[]).filter(c=>c.st!=="resolvido").length;const t=$("#tab-sup");if(t)t.textContent=n?`Suporte (${n})`:"Suporte"}
async function supContar(){const g=await S.db.collection("gerentes").get();let n=0;let ix=[];try{const d=await S.db.doc("restrito/suporte_idx").get();ix=(d.exists&&d.data().uids)||[]}catch(_){}const uids=[...new Set(g.docs.map(d=>d.id).concat(ix,S.me))];for(let i=0;i<uids.length;i+=15){const R=await Promise.all(uids.slice(i,i+15).map(u=>supLer(u).catch(()=>[])));R.forEach(a=>a.forEach(c=>{if(c.st!=="resolvido")n++}))}const t=$("#tab-sup");if(t)t.textContent=n?`Suporte (${n})`:"Suporte"}
function supDesenhar(){const L=S.supL||[];const fs=$("#sup-f-st").value,ft=$("#sup-f-tri").value;const ab=L.filter(c=>c.st!=="resolvido");const k=t=>ab.filter(c=>c._tri===t).length;
  $("#sup-kpi").innerHTML=`<div><div class="k-l">Abertos</div><div class="k-v">${ab.length}</div><div class="k-s">${L.length} no total</div></div><div><div class="k-l">Erro de código</div><div class="k-v" style="color:var(--bad)">${k("codigo")}</div><div class="k-s">mande para o Claude corrigir</div></div><div><div class="k-l">Acesso ou cadastro</div><div class="k-v" style="color:var(--warn)">${k("acesso")}</div><div class="k-s">precisa de você liberar</div></div><div><div class="k-l">Dúvida ou sugestão</div><div class="k-v">${k("duvida")}</div><div class="k-s">responder</div></div>`;
  const F=L.filter(c=>(fs==="todos"||(fs==="abertos"?c.st!=="resolvido":c.st===fs))&&(!ft||c._tri===ft));$("#sup-n").textContent=`${F.length} chamado(s)`;
  $("#sup-inbox").innerHTML=F.length?F.map((c,i)=>{const x=c.ctx||{};const key=esc(c.uid+"|"+c.id);return `<article class="sup-ch t-${c._tri} st-${esc(c.st)}"><header><div><b>${esc(c.nome)}</b> <span class="muted">· ${x.owner?"master":"gerente"} · ${esc(fmtDate(c.criadoEm))}</span><br><span class="cad-chip ${c._tri==="codigo"?"bad":""}">${esc(SUP_TRI[c._tri])}</span> <span class="cad-chip">${esc(SUP_TIPO[c.tipo]||c.tipo)}</span> <span class="muted" style="font-size:12px">${esc(c.onde||"")}</span></div>
    <select class="cad-in" data-sup-st="${key}" aria-label="Situação">${Object.entries(SUP_ST).map(([v,t])=>`<option value="${v}"${v===c.st?" selected":""}>${t}</option>`).join("")}</select></header>
    <div class="txt">${esc(c.texto)}</div>${c.img?`<img src="${esc(c.img)}" alt="Print enviado por ${esc(c.nome)}" data-sup-img="1">`:""}
    <div class="sup-diag"><span><b>Triagem:</b> ${esc(c._por)}</span><span>Tela: ${esc(x.tela||"-")}${x.obra?" · obra "+esc(x.obra):""}</span><span>Obras liberadas: ${x.obrasNoPerfil??"-"}</span>${x.linhasEditaveis!=null?`<span>Linhas editáveis: ${x.linhasEditaveis}</span>`:""}<span>Versão ${esc(x.versao||"-")}</span></div>
    ${c._tri==="acesso"?`<div class="cp-ajuste" style="background:var(--warn-soft);color:var(--warn)">${esc(supAcessoDe(c))} <button class="btn sm" data-sup-ir="${key}">Abrir Pendências › Acessos</button></div>`:""}
    <div class="sup-acts"><textarea class="sup-resp cad-in" rows="2" data-sup-resp="${key}" placeholder="Resposta para ${esc(c.nome)} (aparece em Meus chamados)">${esc(c.resposta||"")}</textarea>
      <button class="btn sm" data-sup-salvar="${key}">Salvar resposta</button>${c._tri==="codigo"?`<button class="btn primary sm" data-sup-claude="${key}">Copiar para o Claude</button>`:""}<button class="btn sm" data-sup-ok="${key}">Marcar resolvido</button></div></article>`}).join(""):'<p class="muted">Nenhum chamado com esses filtros.</p>'}
async function supGravar(key,mud,ev){const [uid,id]=key.split("|");const c=(S.supL||[]).find(x=>x.uid===uid&&x.id===id);if(!c)return;const por=await quemSou();Object.assign(c,mud);c.hist=(c.hist||[]).concat({em:nowISO(),por,ev});
  const {_tri,_por,...doc}=c;await S.db.doc(`gerentes/${uid}/suporte/${id}`).set(doc);supDesenhar();supBadge()}
document.addEventListener("click",async e=>{const t=e.target;if(!t.closest)return;
  if(t.id==="sup-fab"){supAbrir();return}if(t.id==="sup-x"||t.id==="sup-modal"){$("#sup-modal").hidden=true;return}
  {const b=t.closest("#sup-modal [data-sup]");if(b){supAba(b.dataset.sup);return}}
  if(t.id==="sup-enviar"){supEnviar();return}if(t.id==="sup-atualizar"){supInbox();return}
  if(t.id==="sup-sou"){try{const c=await S.db.doc("restrito/config").get();const cfg=c.exists?c.data():{};cfg.suporte={...(cfg.suporte||{}),dono:S.me,em:nowISO()};await S.db.doc("restrito/config").set(cfg);S.cfg=cfg;toast("Pronto: os chamados chegam só para você.");supIniciar();supInbox()}catch(err){toast("Não foi possível gravar: "+(err.message||err))}return}
  let b=t.closest("[data-sup-claude]");if(b){const [uid,id]=b.dataset.supClaude.split("|");const c=(S.supL||[]).find(x=>x.uid===uid&&x.id===id);if(!c)return;const tx=supTextoClaude(c);
    try{await navigator.clipboard.writeText(tx);toast("Copiado. Cole na conversa com o Claude para ele corrigir.")}catch(_){const ta=document.createElement("textarea");ta.value=tx;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast("Copiado. Cole na conversa com o Claude.")}catch(__){toast("Selecione o texto e copie.")}ta.remove()}
    if(c.st==="novo"||c.st==="analise")supGravar(b.dataset.supClaude,{st:"claude"},"Enviado ao Claude");return}
  b=t.closest("[data-sup-salvar]");if(b){const k=b.dataset.supSalvar;const v=document.querySelector(`[data-sup-resp="${CSS.escape(k)}"]`).value.trim();await supGravar(k,{resposta:v,st:(S.supL.find(x=>x.uid+"|"+x.id===k)||{}).st==="novo"?"analise":undefined},"Resposta: "+v.slice(0,80));toast("Resposta salva");return}
  b=t.closest("[data-sup-ok]");if(b){await supGravar(b.dataset.supOk,{st:"resolvido"},"Resolvido");toast("Chamado resolvido");return}
  b=t.closest("[data-sup-ir]");if(b){S.cad=S.cad||cadNovo();S.cad.aba="pend";S.cad.pq="acessos";showTab("cad");return}
  b=t.closest("[data-sup-img]");if(b){const w=document.createElement("div");w.className="sup-modal";w.innerHTML=`<img src="${b.src}" alt="" style="max-width:96vw;max-height:90vh;border-radius:8px">`;w.addEventListener("click",()=>w.remove());document.body.appendChild(w)}});
document.addEventListener("change",async e=>{const t=e.target;
  if(t.id==="sup-img"){const f=t.files&&t.files[0];if(!f){SUP.img="";$("#sup-prev").hidden=true;return}try{SUP.img=await supImg(f);const p=$("#sup-prev");p.src=SUP.img;p.hidden=false}catch(_){SUP.img="";toast("Não consegui ler a imagem.")}return}
  if(t.id==="sup-f-st"||t.id==="sup-f-tri"){supDesenhar();return}
  if(t.dataset&&t.dataset.supSt){const mud={st:t.value};await supGravar(t.dataset.supSt,mud,"Situação: "+SUP_ST[t.value])}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#sup-modal").hidden)$("#sup-modal").hidden=true});
{const ts=$("#tab-sup");if(ts)ts.addEventListener("click",async()=>{await flush();showTab("sup")})}
/* Verificação diária: a partir das 12:30 (hora do computador), o responsável pelo suporte vê o resumo do dia uma vez. */
const SUP_HORA="12:30";
function supHoje(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function supPassouHora(){const d=new Date(),[h,m]=SUP_HORA.split(":").map(Number);return d.getHours()*60+d.getMinutes()>=h*60+m}
async function supDiaria(forcar){if(!supEuDono())return;const dia=supHoje();const feito=S.cfg&&S.cfg.suporte&&S.cfg.suporte.verificadoEm;
  if(!forcar&&(!supPassouHora()||feito===dia||S.supDiaMostrado===dia))return;S.supDiaMostrado=dia;
  try{await supInbox()}catch(_){}const L=(S.supL||[]).filter(c=>c.st!=="resolvido");const g=t=>L.filter(c=>c._tri===t);
  const ontem=Date.now()-864e5;const novos=L.filter(c=>Date.parse(c.criadoEm)>ontem).length;const dd=dia.split("-").reverse().join("/");
  const w=document.createElement("div");w.className="sup-modal";w.id="sup-dia";
  w.innerHTML=`<div class="sup-dlg card"><h2 style="margin:0">Verificação do suporte · ${dd}</h2>
   <p class="desc" style="margin:4px 0 10px">Resumo das ${SUP_HORA}. ${L.length?`${L.length} chamado(s) aberto(s), ${novos} nas últimas 24h.`:"Nenhum chamado aberto. Tudo certo hoje."}</p>
   <div class="ind-kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><div class="k-l">Erro de código</div><div class="k-v" style="color:var(--bad)">${g("codigo").length}</div><div class="k-s">copie e mande ao Claude</div></div><div><div class="k-l">Acesso ou cadastro</div><div class="k-v" style="color:var(--warn)">${g("acesso").length}</div><div class="k-s">precisa de você liberar</div></div><div><div class="k-l">Dúvida ou sugestão</div><div class="k-v">${g("duvida").length}</div><div class="k-s">responder</div></div></div>
   ${g("acesso").length?`<ul style="margin:10px 0 0;padding-left:18px;font-size:13px">${g("acesso").map(c=>`<li><b>${esc(c.nome)}</b>: ${esc(c._por)}</li>`).join("")}</ul>`:""}
   <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">${g("codigo").length?`<button class="btn primary" id="sup-dia-claude">Copiar os ${g("codigo").length} erro(s) para o Claude</button>`:""}<button class="btn" id="sup-dia-abrir">Abrir a caixa de chamados</button><button class="btn" id="sup-dia-ok">Verificação feita</button></div></div>`;
  document.body.appendChild(w)}
async function supDiaFeita(){try{const c=await S.db.doc("restrito/config").get();const cfg=c.exists?c.data():{};cfg.suporte={...(cfg.suporte||{}),verificadoEm:supHoje()};await S.db.doc("restrito/config").set(cfg);S.cfg=cfg}catch(_){}const w=$("#sup-dia");if(w)w.remove()}
document.addEventListener("click",async e=>{const t=e.target;if(!t||!t.id||!t.id.startsWith("sup-dia"))return;
  if(t.id==="sup-dia"){t.remove();return}
  if(t.id==="sup-dia-abrir"){await supDiaFeita();showTab("sup");return}
  if(t.id==="sup-dia-ok"){await supDiaFeita();toast("Verificação de hoje registrada.");return}
  if(t.id==="sup-dia-claude"){const C=(S.supL||[]).filter(c=>c.st!=="resolvido"&&c._tri==="codigo");const tx=`VERIFICAÇÃO DIÁRIA DO SUPORTE (${supHoje()} ${SUP_HORA}) · ${C.length} erro(s) de código\n\n`+C.map((c,i)=>`#${i+1}\n`+supTextoClaude(c)).join("\n\n----------\n\n");
    try{await navigator.clipboard.writeText(tx)}catch(_){const ta=document.createElement("textarea");ta.value=tx;document.body.appendChild(ta);ta.select();try{document.execCommand("copy")}catch(__){}ta.remove()}
    for(const c of C)if(c.st==="novo"||c.st==="analise")await supGravar(c.uid+"|"+c.id,{st:"claude"},"Enviado ao Claude (verificação diária)");
    toast("Copiado. Cole na conversa com o Claude.");await supDiaFeita()}});
setInterval(()=>{if(S.me&&!S.offline)supDiaria().catch(()=>{})},60000);
