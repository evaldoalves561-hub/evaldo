/* ===================== ESTRUTURA MODELO (29/10) =====================
   Planilha "Estrutura - Modelo": por base modelo, a coluna Observação diz quem planeja cada insumo, o que é feito por fora do app e o que sai.
   Insumo fora do app / inativado fica em regras/insumos_fora (por base). Some do Preencher e dos Indicadores; se já tem valor, continua travado na tela e entra no aviso.
   Nada já digitado é alterado ou apagado; subitens criados pelos gerentes ficam como estão. */
function foraIns(tipo,l){const m=S.insFora;return (m&&m[`${tipo||""}|${l.P}|${l.S}|${l.I}`])||null}
async function carregarInsFora(){try{const d=await S.db.doc("regras/insumos_fora").get();S.insFora=d.exists?(d.data().m||{}):{}}catch(e){S.insFora=S.insFora||{}}}
/* 29/10 (Evaldo): estas áreas planejam tudo por fora do app, em todas as bases */
const EM_FORA=new Set(["Gente & Gestão","TI","Engenharia","Obras Corporativas"]);
function emArea(obs){const t=semAc(obs||"").replace(/\s+/g," ").trim();if(!t)return null;
  if(/nao usar/.test(t))return {t:"inativo",area:"",motivo:"Não usar"};
  if(/^inativ/.test(t))return {t:"inativo",area:"",motivo:"Inativar"};
  const fora=/fora (do|da) app/.test(t);
  const A=[[/coorporativ|corporativ/,"Obras Corporativas"],[/engenharia/,"Engenharia"],[/\bsst\b|seguranca do trabalho/,"Segurança do Trabalho"],[/gent\w* e ge/,"Gente & Gestão"],[/marketing/,"Marketing"],[/estoque/,"Comercial - Estoque"],[/lancamento/,"Comercial - Lançamento"],[/administ|adinist|admist/,"Gerente Administrativo"],[/projetos/,"Projetos"],[/ambiental/,"Ambiental"],[/\bsac\b/,"SAC"],[/juridic/,"Jurídico"],[/\bti\b/,"TI"]];
  const a=(A.find(([re])=>re.test(t))||[])[1]||"";
  let subs=null;if(/criar/.test(t)&&/sub/.test(t)){const m=/sub\w*\s+(.*)$/i.exec(String(obs));subs=m?m[1].replace(/^(de|os)\s+/i,"").replace(/\s+sobre\s.*$/i,"").replace(/hospedagem\s+passagens/i,"Hospedagem, Passagens").replace(/\.\.\.|…/g,"").split(/,|\s{2,}/).map(x=>x.trim()).filter(Boolean):[]}
  return {t:fora?"fora":"app",area:a,motivo:String(obs).trim(),subs}}
async function emLer(f){const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  const h=(rows[0]||[]).map(c=>semAc(c));const ci=k=>h.findIndex(c=>c===k||c.startsWith(k));
  const iO=ci("obra"),iP=ci("produto"),iS=ci("servico"),iI=ci("insumo"),iD=ci("descricao"),iX=h.findIndex(c=>c.includes("observa"));
  if([iO,iP,iS,iI,iX].some(x=>x<0))throw new Error("Não achei as colunas Obra, Produto, Servico, Insumo e Observação na primeira aba.");
  const M=new Map();rows.slice(1).forEach(r=>{const t=String(r[iO]).trim();if(!t)return;let Sv=String(r[iS]).trim();if(Sv==="-1"||!Sv)return;
    const k=`${t}|${String(r[iP]).trim().split(" ")[0]}|${Sv}|${String(r[iI]).trim()}`;if(!M.has(k))M.set(k,{obs:String(r[iX]||"").trim(),d:String(r[iD]||"").trim()})});return M}
function emCalcular(M){const tipos=new Set([...M.keys()].map(k=>k.split("|")[0]));const out={muda:[],fora:[],inativo:[],volta:[],subs:[],duvida:[],m:{},t:{}};
  tipos.forEach(tipo=>{if(!(T.tipos||{})[tipo])return;buildLines(tipo,null,{}).filter(l=>l.kind==="leaf").forEach(l=>{const k=`${tipo}|${l.P}|${l.S}|${l.I}`;const f=M.get(k);
    const r=ruleFor(tipo,l);const atual=(r&&r[1])||"";const base={tipo,k,key:l.key,d:l.desc,atual};
    if(!f){out.m[k]={t:"inativo",area:atual,motivo:"Saiu da Estrutura - Modelo"};out.inativo.push({...base,motivo:"Saiu da Estrutura - Modelo"});return}
    const a=emArea(f.obs);if(!a){out.duvida.push({...base,obs:"(sem observação)"});return}
    if(a.t==="inativo"){out.m[k]={t:"inativo",area:atual,motivo:a.motivo};out.inativo.push({...base,motivo:a.motivo});return}
    const area=a.area||atual;if(!a.area&&a.t==="app"){out.duvida.push({...base,obs:a.motivo});return}
    if(EM_FORA.has(area))a.t="fora";
    if(a.area&&a.area!==atual){(out.t[tipo]=out.t[tipo]||{})[l.key]=a.area;if(a.t==="app")out.muda.push({...base,novo:a.area})}
    if(a.t==="fora"){out.m[k]={t:"fora",area,motivo:a.motivo};out.fora.push({...base,novo:area})}
    if(a.subs)out.subs.push({...base,nomes:a.subs})})});
  Object.keys(S.insFora||{}).forEach(k=>{if(tipos.has(k.split("|")[0])&&!out.m[k]){const [t,P,Sv,I]=k.split("|");out.volta.push({tipo:t,k,key:`${P}|${Sv}|${I}`,d:"",atual:(S.insFora[k]||{}).area||""})}});
  return out}
function emTabela(L,cols){if(!L.length)return '<p class="muted" style="margin:4px 0">Nada.</p>';return `<div class="tbl-box" style="max-height:320px"><table class="list"><thead><tr><th>Base</th><th>Insumo</th>${cols.map(c=>`<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${L.slice(0,800).map(x=>`<tr><td>${esc(x.tipo)}</td><td><span class="muted" style="font-size:12px">${esc(x.key)}</span> ${esc(x.d)}</td>${cols.map(c=>`<td>${c[1](x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
function emExcN(){let n=0;Object.entries((S.dpR&&S.dpR.o)||{}).forEach(([o,ex])=>{const c=S.catMap&&S.catMap.get(o);const tipo=c&&c[3];if(!tipo||!EM.tipos||!EM.tipos.has(tipo))return;Object.keys(ex).forEach(k=>{const [P,Sv,I]=k.split("|");if(P==="*"?[...EM.M.keys()].some(x=>x.startsWith(tipo+"|")&&x.endsWith(`|${Sv}|${I}`)):EM.M.has(`${tipo}|${k}`))n++})});return n}
function emRender(){const X=EM.calc;const box=$("#em-prev");if(!X){box.innerHTML="";return}
  const sec=(t,n,html,open)=>`<details class="sub-card" ${open?"open":""} style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">${t} <span class="cad-chip">${n}</span></summary>${html}</details>`;
  box.innerHTML=`<div class="ind-kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px">
    <div><div class="k-l">Quem planeja muda</div><div class="k-v">${X.muda.length}</div><div class="k-s">regra da base</div></div>
    <div><div class="k-l">Fora do app</div><div class="k-v">${X.fora.length}</div><div class="k-s">some do Preencher e Indicadores</div></div>
    <div><div class="k-l">Saem do modelo</div><div class="k-v">${X.inativo.length}</div><div class="k-s">Inativar, Não usar ou fora da planilha</div></div>
    <div><div class="k-l">Exceções por obra</div><div class="k-v">${emExcN()}</div><div class="k-s">passam a seguir o modelo</div></div>
    <div><div class="k-l">Voltam para o app</div><div class="k-v">${X.volta.length}</div><div class="k-s">estavam fora</div></div>
    <div><div class="k-l">Não entendi</div><div class="k-v" style="color:${X.duvida.length?"var(--warn)":"inherit"}">${X.duvida.length}</div><div class="k-s">ficam como estão</div></div></div>
   ${sec("Quem planeja muda",X.muda.length,emTabela(X.muda,[["Hoje",x=>esc(x.atual||"—")],["Passa a ser",x=>`<b>${esc(x.novo)}</b>`]]))}
   ${sec("Feito por fora do app",X.fora.length,emTabela(X.fora,[["Área",x=>esc(x.novo)]]))}
   ${sec("Saem do modelo",X.inativo.length,emTabela(X.inativo,[["Hoje",x=>esc(x.atual||"—")],["Motivo",x=>esc(x.motivo)]]))}
   ${sec("Voltam para o app",X.volta.length,emTabela(X.volta,[["Área",x=>esc(x.atual)]]))}
   ${sec("Não entendi a observação (fica como está)",X.duvida.length,emTabela(X.duvida,[["Hoje",x=>esc(x.atual||"—")],["Observação",x=>esc(x.obs)]]),X.duvida.length>0)}
   ${sec("Subitens sugeridos (só para quem ainda não criou subitens)",X.subs.length,X.subs.length?X.subs.map((x,i)=>`<div class="row" style="gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap"><span style="min-width:0;flex:1 1 260px"><b>${esc(x.tipo)}</b> · ${esc(x.d)}</span><input class="cad-in" data-em-sub="${i}" value="${esc(x.nomes.join(", "))}" style="flex:2 1 300px" aria-label="Subitens de ${esc(x.d)}"></div>`).join("")+'<p class="muted" style="font-size:12px;margin:4px 0">Separe por vírgula. Deixe vazio para não sugerir.</p>':'<p class="muted">Nada.</p>',X.subs.length>0)}
   <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center"><button class="btn primary" id="em-aplicar">Aplicar no app</button><button class="btn" id="em-cancelar">Cancelar</button><span class="muted" style="font-size:12px">Depois de aplicar, o app procura valores já digitados nesses insumos e mostra a lista para você decidir.</span></div>`}
async function emAplicar(){const X=EM.calc;if(!X)return;const b=$("#em-aplicar");b.disabled=true;const msg=$("#em-msg");const em=nowISO();
  try{msg.textContent="Gravando quem planeja…";const dp=await S.db.doc("regras/depara").get();const D=dp.exists?dp.data():{};D.t=D.t||{};
    Object.entries(X.t).forEach(([tipo,m])=>{D.t[tipo]={...(D.t[tipo]||{}),...m}});
    /* 29/10 (Evaldo): o modelo vale para todas as obras. Exceções por obra nos insumos do modelo saem, com cópia em oAnt (dá para recuperar). */
    {await loadCat();let n=0;const oAnt=D.oAnt||{};Object.entries(D.o||{}).forEach(([o,ex])=>{const c=S.catMap.get(o);const tipo=c&&c[3];if(!tipo||!EM.tipos.has(tipo))return;
      Object.keys(ex).forEach(k=>{const [P,Sv,I]=k.split("|");const ok=P==="*"?[...EM.M.keys()].some(x=>x.startsWith(tipo+"|")&&x.endsWith(`|${Sv}|${I}`)):EM.M.has(`${tipo}|${k}`);
        if(ok){(oAnt[o]=oAnt[o]||{})[k]={v:ex[k],em};delete ex[k];n++}});if(!Object.keys(ex).length)delete D.o[o]});D.oAnt=oAnt;EM.excRemovidas=n}
    D.atualizadoEm=em;await S.db.doc("regras/depara").set(D);S.dpR=D;
    msg.textContent="Gravando o que fica fora do app…";const ant=S.insFora||{};const tipos=new Set(Object.keys(X.m).map(k=>k.split("|")[0]).concat(X.volta.map(x=>x.tipo)));
    const m={};Object.entries(ant).forEach(([k,v])=>{if(!tipos.has(k.split("|")[0]))m[k]=v});Object.assign(m,X.m);
    await S.db.doc("regras/insumos_fora").set({m,arquivo:EM.arquivo,atualizadoEm:em,por:await quemSou()});S.insFora=m;
    const sugs=X.subs.map((x,i)=>{const v=(document.querySelector(`[data-em-sub="${i}"]`)||{}).value||"";return [x,v.split(",").map(s=>s.trim()).filter(Boolean)]}).filter(([,n])=>n.length);
    if(sugs.length){const sd=await S.db.doc("regras/subitens").get();const SB=sd.exists?sd.data():{};SB.r=SB.r||{};sugs.forEach(([x,n])=>{if(!(SB.r[x.k]&&SB.r[x.k].length))SB.r[x.k]=n});await S.db.doc("regras/subitens").set(SB);S.subR=SB}
    msg.textContent="Atualizando as áreas de cada obra…";try{await loadCat();const ad=await S.db.doc("restrito/areasobra").get();const ao=ad.exists?(ad.data().m||{}):{};let n=0;
      (S.cat.obras||[]).forEach(c=>{if(!c[3]||!ao[c[0]])return;const novo=cadAreasObra(c[0],c[3],ao[c[0]],[]);if(novo.join("|")!==ao[c[0]].join("|")){ao[c[0]]=novo;n++}});
      if(n){await S.db.doc("restrito/areasobra").set({m:ao,aba:"Estrutura modelo",arquivo:EM.arquivo,atualizadoEm:em});S.areasObra=ao}}catch(e){console.warn("areasobra",e)}
    if(S.cur){applyRules(S.cur);renderGrid()}
    msg.textContent="Procurando valores já digitados nesses insumos…";await emValores(X);toast("Estrutura modelo aplicada")}
  catch(e){msg.textContent="Não foi possível aplicar: "+(e.message||e)+". Nada foi apagado; tente de novo."}b.disabled=false}
async function emValores(X){const K=new Map();X.muda.forEach(x=>K.set(x.k,["Quem planeja mudou",x.atual+" → "+x.novo]));X.fora.forEach(x=>K.set(x.k,["Fora do app",x.novo]));X.inativo.forEach(x=>K.set(x.k,["Saiu do modelo",x.motivo]));
  await loadCat();const g=await S.db.collection("gerentes").get();const L=[];const uids=g.docs.map(d=>d.id);
  for(let i=0;i<uids.length;i+=10){await Promise.all(uids.slice(i,i+10).map(async uid=>{let q;try{q=await S.db.collection(`gerentes/${uid}/orc`).get()}catch(e){return}
    q.docs.forEach(d=>{const o=d.id,doc=d.data()||{};const c=S.catMap.get(o);const tipo=c&&c[3];if(!tipo)return;const tot=new Map();
      Object.entries(doc.v||{}).forEach(([key,ys])=>{const kb=key.split("#")[0];const kk=`${tipo}|${kb}`;if(!K.has(kk))return;let s=0;Object.values(ys||{}).forEach(a=>(a||[]).forEach(v=>s+=+v||0));if(s)tot.set(kk,(tot.get(kk)||0)+s)});
      tot.forEach((s,kk)=>{const [tp,P,Sv,I]=kk.split("|");const l=(buildLines(tp,null,{}).find(x=>x.key===`${P}|${Sv}|${I}`)||{});L.push({o,obra:c[2]||"",uid,st:doc.status||"rascunho",tipo:tp,key:`${P}|${Sv}|${I}`,d:l.desc||I,mud:K.get(kk)[0],det:K.get(kk)[1],total:s})})})}))}
  let nomes={};try{nomes=await S.user.profiles([...new Set(L.map(x=>x.uid))])}catch(e){}L.forEach(x=>x.ger=(nomes[x.uid]&&nomes[x.uid].name)||"Gerente");
  L.sort((a,b)=>String(a.o).localeCompare(String(b.o),"pt",{numeric:true}));EM.avisos=L;
  try{await S.db.doc("restrito/est_avisos").set({linhas:L.map(({o,obra,uid,ger,st,tipo,key,d,mud,det,total})=>({o,obra,uid,ger,st,tipo,key,d,mud,det,total})),arquivo:EM.arquivo,atualizadoEm:nowISO()})}catch(e){}
  $("#em-prev").innerHTML=`<h3 style="margin:12px 0 4px">Valores já digitados nesses insumos: ${L.length}</h3><p class="muted" style="font-size:13px;margin:0 0 6px">${L.length?"Nenhum valor foi alterado. Eles continuam na tela da obra, travados, até você decidir onde colocar.":"Nenhum insumo afetado tem valor digitado. Tudo certo."}</p>
   ${L.length?`<div class="tbl-box" style="max-height:420px"><table class="list"><thead><tr><th>Obra</th><th>Gerente</th><th>Insumo</th><th>O que mudou</th><th class="num">Total digitado</th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(x.o)} ${esc(x.obra)}</td><td>${esc(x.ger)} <span class="muted">(${esc(x.st)})</span></td><td><span class="muted" style="font-size:12px">${esc(x.key)}</span> ${esc(x.d)}</td><td>${esc(x.mud)}: ${esc(x.det)}</td><td class="num">${f0(x.total)}</td></tr>`).join("")}</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn" id="em-xlsx">Baixar a lista em Excel</button></div>`:""}`;
  $("#em-msg").textContent=`Aplicado em ${fmtDate(nowISO())}.${EM.excRemovidas?` ${EM.excRemovidas} exceção(ões) por obra passaram a seguir o modelo (cópia guardada).`:""}`}
document.addEventListener("change",async e=>{if(e.target.id!=="em-file")return;const f=e.target.files[0];e.target.value="";if(!f)return;
  if(typeof XLSX==="undefined"){toast("O leitor de Excel não carregou. Recarregue a página.");return}
  const msg=$("#em-msg");msg.textContent="Lendo "+f.name+"…";try{S.rgEm=0;await refreshRegras();await carregarInsFora();await loadCat();const M=await emLer(f);EM.arquivo=f.name;EM.M=M;EM.tipos=new Set([...M.keys()].map(k=>k.split("|")[0]));EM.calc=emCalcular(M);emRender();msg.textContent=`${f.name}: ${M.size} linhas lidas. Confira e clique em Aplicar no app.`}
  catch(err){msg.textContent="Não consegui ler: "+(err.message||err)}});
document.addEventListener("click",async e=>{const t=e.target;if(t.id==="em-aplicar"){emAplicar();return}if(t.id==="em-cancelar"){EM.calc=null;emRender();$("#em-msg").textContent="Nada foi gravado.";return}
  if(t.id==="em-xlsx"){if(typeof XLSX==="undefined"||!S.dl)return;const L=EM.avisos||[];const a=[["Obra","Descrição","Gerente","Situação","Base","Insumo","Descrição do insumo","O que mudou","Detalhe","Total digitado"],...L.map(x=>[x.o,x.obra,x.ger,x.st,x.tipo,x.key,x.d,x.mud,x.det,x.total])];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(a),"Valores para realocar");try{await S.dl.save({filename:`VALORES_PARA_REALOCAR_${new Date().toISOString().slice(0,10)}.xlsx`,data:new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx"}))})}catch(_){}}});
