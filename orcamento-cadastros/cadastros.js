/* ===================== CADASTROS (Controladoria) =====================
   Edita direto no app o que antes vinha da planilha CONFIGURACAO_ORCAMENTO_2027_2029:
   - Empresas e obras: ativa/inativa (restrito/catalogo c[8]), fora do aplicativo (regras/fora_app "*"), Regional (regras/regional_obra), obra nova no catálogo
   - Quem planeja: regra por base modelo (regras/depara .t) e exceção por obra (regras/depara .o); recalcula restrito/areasobra
   - Gerentes: linhas no formato da aba "3. Gerentes" (restrito/cad_gerentes) aplicadas pelo mesmo carregarAcessos da planilha */
const CAD_H=["Departamento (quem planeja)","Empresa","Obra","Nome do gerente","E-mail","Cargo da pessoa","Observação","Regional","Nome do gerente - Regional","E-mail"];
const CAD_EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const cadTodas=v=>/^todas$/i.test(String(v||"").trim());
const cadClone=o=>JSON.parse(JSON.stringify(o==null?null:o));
const cadNum=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true});
function cadNovo(){return {aba:S.cad?S.cad.aba:"pend",pend:null,sit:null,cat:new Map(),fora:new Map(),reg:new Map(),novas:[],t:{},o:{},ger:null,gerDirty:false,sel:new Set(),gerDoc:null,gerOrigem:"",gerMsg:"",aoNovas:{},estr:null}}
const cadAO=()=>({...(S.areasObra||{}),...((S.cad&&S.cad.aoNovas)||{})});
function cadSujo(){const C=S.cad;if(!C)return 0;return C.cat.size+C.fora.size+C.reg.size+C.novas.length+Object.values(C.t).reduce((a,m)=>a+Object.keys(m).length,0)+Object.values(C.o).reduce((a,m)=>a+Object.keys(m).length,0)+(C.gerDirty?1:0)+(C.estr?1:0)}

async function abrirCadastros(){
  const v=$("#v-cad");if(!v)return;S.cad=S.cad||cadNovo();$("#cad-msg").textContent="Carregando cadastros…";
  await loadCat();
  const ler=async p=>{try{const d=await S.db.doc(p).get();return d.exists?d.data():null}catch(e){return null}};
  const [ao,fo,ro,pp,cg]=await Promise.all([ler("restrito/areasobra"),ler("regras/fora_app"),ler("regras/regional_obra"),ler("restrito/pessoas"),ler("restrito/cad_gerentes")]);
  S.areasObra=(ao&&ao.m)||{};S.foraApp=(fo&&fo.m)||{};S.regObra=(ro&&ro.m)||null;S.pessoas=(pp&&pp.lista)||[];
  const C=S.cad;C.gerDoc=cg;
  if(!C.ger){if(cg&&Array.isArray(cg.linhas)){C.ger=cg.linhas.map(r=>({...r}));C.gerOrigem=`Cadastro salvo em ${fmtDate(cg.atualizadoEm)}${cg.por?" por "+cg.por:""}.`}
    else{C.ger=cadGerDosAcessos();C.gerOrigem=C.ger.length?"Lista montada a partir dos acessos já liberados. Para trazer também os Gerentes Regionais, importe a aba 3 da planilha uma vez.":"Nenhum gerente cadastrado ainda. Importe a aba 3 da planilha ou inclua linha por linha."}}
  $("#cad-msg").textContent="";cadMostrar(C.aba);
}
/* primeira vez: monta as linhas a partir de restrito/pessoas, juntando em "Todas" quando a pessoa tem todas as obras da empresa daquela área */
function cadGerDosAcessos(){
  const AO=S.areasObra||{};const cats=S.cat.obras||[];const out=[];
  (S.pessoas||[]).forEach(p=>{const g=new Map();
    Object.entries(p.acc||{}).forEach(([id,deps])=>{const c=S.catMap.get(id);const e=c?String(c[6]):String(id).split("-")[0];deps.forEach(d=>{const k=d+"|"+e;if(!g.has(k))g.set(k,new Set());g.get(k).add(id)})});
    [...g.entries()].sort((a,b)=>cadNum(a[0],b[0])).forEach(([k,ids])=>{const [dep,e]=[k.slice(0,k.lastIndexOf("|")),k.slice(k.lastIndexOf("|")+1)];
      const todas=cats.filter(c=>String(c[6])===e&&(AO[c[0]]||[]).includes(dep)).map(c=>c[0]);
      const base={dep,emp:e,nome:p.nome||"",email:p.email,cargo:p.cargo||"",obs:p.semClaude?"":"com Claude",reg:"",regNome:"",regEmail:""};
      if(todas.length>1&&todas.every(id=>ids.has(id)))out.push({...base,obra:"Todas"});
      else [...ids].sort(cadNum).forEach(id=>{const c=S.catMap.get(id);out.push({...base,obra:c?String(c[1]):id.split("-").slice(1).join("-"),reg:(S.regObra&&S.regObra[id])||""})})})});
  return out}

function cadMostrar(aba){const C=S.cad;C.aba=aba;
  document.querySelectorAll("#cad-sub button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.cad===aba)));
  ["pend","obras","quem","ger"].forEach(k=>{$("#cad-"+k).hidden=k!==aba});
  {const tp=$("#tab-pend"),tc=$("#tab-cad");if(tp&&S.tab==="cad"){tp.setAttribute("aria-selected",String(aba==="pend"));tc.setAttribute("aria-selected",String(aba!=="pend"))}}
  if(aba==="pend"){$("#cp-list").innerHTML='<p class="muted">Procurando obras novas na estrutura…</p>';cadPendPrep().then(cadRenderPend).catch(e=>{$("#cp-list").textContent="Não foi possível montar as pendências: "+(e.message||e)})}
  if(aba==="obras")cadRenderObras();if(aba==="quem")cadQuemPrep();if(aba==="ger")cadRenderGer();cadBarra()}
function cadBarra(){const n=cadSujo();$("#cad-save").hidden=!n;$("#cad-save-n").textContent=n===1?"1 alteração não salva":`${n} alterações não salvas`;
  const t=$("#tab-cad");if(t)t.textContent=n?"Cadastros •":"Cadastros"}
function cadOpts(L,sel,vazio){return (vazio!=null?`<option value="">${esc(vazio)}</option>`:"")+L.map(([v,t])=>`<option value="${esc(v)}"${String(v)===String(sel)?" selected":""}>${esc(t)}</option>`).join("")}
function cadEmpresas(){const m=new Map();(S.cat.obras||[]).concat(S.cad.novas).forEach(c=>{if(!m.has(String(c[6])))m.set(String(c[6]),c[7]||"")});return [...m.entries()].sort((a,b)=>cadNum(a[0],b[0]))}
function cadAreas(){const s=new Set();const add=v=>{v=String(v||"").trim();if(v)s.add(v)};
  Object.values((S.regras&&S.regras.r)||{}).forEach(v=>add(v&&v[1]));const D=S.dpR||{};
  Object.values(D.r||{}).forEach(m=>Object.values(m).forEach(add));Object.values(D.t||{}).forEach(m=>Object.values(m).forEach(add));Object.values(D.o||{}).forEach(m=>Object.values(m).forEach(add));
  Object.values(cadAO()).forEach(a=>a.forEach(add));(S.cad&&S.cad.ger||[]).forEach(r=>add(r.dep));Object.values(S.cad?S.cad.t:{}).forEach(m=>Object.values(m).forEach(add));
  return [...s].sort((a,b)=>a.localeCompare(b,"pt-BR"))}
const cadN=n=>nf0.format(n||0);
const cadKpi=(l,v,s)=>`<div><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${s||"&nbsp;"}</div></div>`;

/* ---------- Empresas e obras ---------- */
function cadObraEstado(c){const C=S.cad,id=c[0];
  const inat=C.cat.has(id)?C.cat.get(id):c[8]===1;const fm=(S.foraApp||{})[id]||{};
  const fora=C.fora.has(id)?C.fora.get(id):cadPlanDe(fm);const parcial=!fora&&Object.keys(fm).filter(a=>a!=="*").length;
  const reg=C.reg.has(id)?C.reg.get(id):((S.regObra&&S.regObra[id])||"");return {inat,fora,parcial,reg}}
function cadCobertura(){const P=new Map();(S.pessoas||[]).forEach(p=>Object.entries(p.acc||{}).forEach(([id,deps])=>{const m=P.get(id)||new Map();deps.forEach(d=>{if(!m.has(d))m.set(d,new Set());m.get(d).add(p.email)});P.set(id,m)}));return P}
function cadRenderObras(){const C=S.cad;const cats=(S.cat.obras||[]).concat(C.novas);const AO=cadAO();const COB=cadCobertura();
  const linhas=cats.map(c=>{const e=cadObraEstado(c);const areas=AO[c[0]]||[];const m=COB.get(c[0])||new Map();const fm=(S.foraApp||{})[c[0]]||{};
    const semGer=e.inat||e.fora?[]:areas.filter(a=>!m.has(a)&&!fm[a]);const pes=new Set([...m.values()].flatMap(s=>[...s]));return {c,...e,areas,semGer,pes:pes.size,nova:C.novas.includes(c)}});
  const tot=linhas.length,at=linhas.filter(x=>!x.inat),fo=at.filter(x=>x.fora),pa=at.filter(x=>x.fora==="pausa"),sg=at.filter(x=>x.semGer.length),sr=at.filter(x=>!x.reg);
  $("#cad-kpi").innerHTML=cadKpi("Empresas/obras",cadN(tot),`${cadEmpresas().length} empresas`)+cadKpi("Ativas",cadN(at.length),`${cadN(tot-at.length)} inativas`)+cadKpi("Planejam no app",cadN(at.length-fo.length),`${cadN(fo.length-pa.length)} fora do app · ${cadN(pa.length)} pausada(s)`)+cadKpi("Sem gerente em alguma área",`<span style="color:${sg.length?"var(--bad)":"var(--good)"}">${cadN(sg.length)}</span>`,"obras ativas no app")+cadKpi("Sem Regional",cadN(sr.length),"obras ativas");
  const fe=$("#co-emp");if(fe.options.length<=1)fe.innerHTML=cadOpts(cadEmpresas().map(([e,n])=>[e,`${e} – ${n}`]),"","Todas as empresas");
  const q=semAc($("#co-q").value||"").trim(),emp=fe.value,st=$("#co-st").value;
  const F=linhas.filter(x=>(!emp||String(x.c[6])===emp)&&(!q||semAc(`${x.c[0]} ${x.c[2]} ${x.c[7]} ${x.reg}`).includes(q))&&
    (st==="todas"||(st==="ativas"&&!x.inat)||(st==="inativas"&&x.inat)||(st==="fora"&&!x.inat&&x.fora==="fora")||(st==="pausa"&&!x.inat&&x.fora==="pausa")||(st==="app"&&!x.inat&&!x.fora)||(st==="semger"&&x.semGer.length)||(st==="semreg"&&!x.inat&&!x.reg)))
    .sort((a,b)=>cadNum(a.c[0],b.c[0]));
  C.coVis=F.map(x=>x.c[0]);const MAX=800;
  $("#co-n").textContent=`${F.length} de ${tot} empresa/obra${F.length>MAX?` · mostrando as ${MAX} primeiras, use os filtros`:""}`;
  const regs=[...new Set(Object.values(S.regObra||{}).concat([...C.reg.values()]).filter(Boolean))].sort();$("#cad-regs").innerHTML=regs.map(r=>`<option value="${esc(r)}">`).join("");
  $("#co-tbl").innerHTML=`<thead><tr><th style="width:28px"><input type="checkbox" id="co-all" aria-label="Marcar todas as listadas"></th><th>Empresa</th><th>Obra</th><th>Base</th><th>Regional</th><th>Situação</th><th>Planejamento</th><th>Quem planeja (áreas)</th><th class="num">Gerentes</th></tr></thead><tbody>${F.slice(0,MAX).map(x=>{const id=x.c[0];const mud=S.cad.cat.has(id)||S.cad.fora.has(id)||S.cad.reg.has(id)||x.nova;
    return `<tr class="${x.inat?"cad-inat":""}${mud?" cad-mud":""}"><td><input type="checkbox" data-co-sel="${esc(id)}"${C.sel.has(id)?" checked":""} aria-label="Marcar ${esc(id)}"></td>
    <td><span class="cad-cod">${esc(x.c[6])}</span> ${esc(x.c[7]||"")}</td><td><span class="cad-cod">${esc(x.c[1])}</span> ${esc(x.c[2]||"")}${x.nova?' <span class="pill validado">nova</span>':""}</td><td class="cad-cod">${esc(x.c[3]||"—")}</td>
    <td><input class="cad-in" list="cad-regs" data-co-reg="${esc(id)}" value="${esc(x.reg)}" placeholder="—" aria-label="Regional de ${esc(id)}"></td>
    <td><button class="pill ${x.inat?"vazio":"enviado"} cad-pb" data-co-inat="${esc(id)}" title="Clique para ${x.inat?"ativar":"inativar"}">${x.inat?"Inativa":"Ativa"}</button></td>
    <td><select class="cad-in cad-plan p-${x.fora||"app"}" data-co-plan="${esc(id)}" aria-label="Planejamento de ${esc(id)}">${cadOpts([["","No app"],["pausa","Pausada (não planejar agora)"],["fora","Fora do app"]],x.fora)}</select>${x.parcial?` <span class="muted" title="${esc(foraTxtObra(id))}">${x.parcial} área(s) fora</span>`:""}</td>
    <td>${x.areas.length?x.areas.map(a=>`<span class="cad-chip${x.semGer.includes(a)?" bad":""}" title="${x.semGer.includes(a)?"Sem gerente para esta área":""}">${esc(AREA_CURTA&&AREA_CURTA[a]||a)}</span>`).join(""):'<span class="muted">sem regra</span>'}</td>
    <td class="num">${x.pes||'<span style="color:var(--bad)">0</span>'}</td></tr>`}).join("")}</tbody>`;
  $("#co-selbar").hidden=!C.sel.size;$("#co-seln").textContent=`${C.sel.size} marcada(s)`;cadBarra()}
function cadObraDe(id){return S.catMap.get(id)||S.cad.novas.find(c=>c[0]===id)}
function cadSetInat(id,v){const c=cadObraDe(id);if(!c)return;if((c[8]===1)===v)S.cad.cat.delete(id);else S.cad.cat.set(id,v)}
const cadPlanDe=fm=>fm&&fm["*"]?(fm["*"].pausada?"pausa":"fora"):"";
function cadSetFora(id,v){const atual=cadPlanDe((S.foraApp||{})[id]);if(atual===v)S.cad.fora.delete(id);else S.cad.fora.set(id,v)}
function cadSetReg(id,v){v=String(v||"").trim();const atual=(S.regObra&&S.regObra[id])||"";if(atual===v)S.cad.reg.delete(id);else S.cad.reg.set(id,v)}
function cadNovaObra(){const g=k=>$("#cn-"+k).value.trim();const e=g("emp"),o=g("obra");const msg=$("#cn-msg");
  if(!e||!o){msg.textContent="Informe o código da empresa e o da obra.";return}const id=`${e}-${o}`;
  if(cadObraDe(id)){msg.textContent=`A obra ${id} já está no catálogo.`;return}
  const en=g("empn")||(cadEmpresas().find(x=>x[0]===e)||[])[1]||"";
  S.cad.novas.push([id,o,g("obran"),g("base"),0,0,e,en,0]);const r=g("reg");if(r)S.cad.reg.set(id,r);
  ["obra","obran","reg"].forEach(k=>$("#cn-"+k).value="");msg.textContent=`Obra ${id} incluída. Clique em Salvar para gravar.`;$("#co-q").value=id;cadRenderObras()}

/* ---------- Quem planeja ---------- */
function cadLeaves(tipo){const oc=S.regras&&S.regras.ocSet;return buildLines(tipo,null,{}).filter(l=>l.kind==="leaf"&&!(oc&&oc.has(`${tipo}|${l.P}|${l.S}|${l.I}`)))}
function cadBaseDe(D,tipo,P,Sv,I){const k=`${P}|${Sv}|${I}`;const tx=D.t&&D.t[tipo]&&D.t[tipo][k];if(tx)return tx;
  const b=((S.regras&&S.regras.r)||{})[`${tipo}|${k}`]||(S.regrasSI&&S.regrasSI.get(`${tipo}|${Sv}|${I}`));if(b&&b[1])return b[1];
  const d=D.r&&D.r[tipo]&&D.r[tipo][k];return d||""}
function cadOrigemBase(tipo,l){const k=l.key;if(S.cad.t[tipo]&&k in S.cad.t[tipo])return["rascunho","alterado"];const D=S.dpR||{};
  if(D.t&&D.t[tipo]&&D.t[tipo][k])return["validado","ajustado no app"];const b=((S.regras&&S.regras.r)||{})[`${tipo}|${k}`]||(S.regrasSI&&S.regrasSI.get(`${tipo}|${l.S}|${l.I}`));
  if(b&&b[1])return["vazio","regra (aba 1)"];if(D.r&&D.r[tipo]&&D.r[tipo][k])return["vazio","padrão da base"];return["reaberto","sem regra"]}
function cadValBase(tipo,l){const p=S.cad.t[tipo];if(p&&l.key in p)return p[l.key];return cadBaseDe(S.dpR||{},tipo,l.P,l.S,l.I)}
function cadExc(o,l){const ex=S.dpR&&S.dpR.o&&S.dpR.o[o];return ex&&(ex[l.key]||ex[`*|${l.S}|${l.I}`])||""}
function cadValObra(tipo,l,o){const p=S.cad.o[o];if(p&&l.key in p)return p[l.key];return cadExc(o,l)||cadValBase(tipo,l)}
function cadQuemPrep(){const sb=$("#cq-base");const cats=(S.cat.obras||[]).concat(S.cad.novas);
  if(!sb.options.length){const n={};cats.forEach(c=>{n[c[3]]=(n[c[3]]||0)+1});const tipos=Object.keys(T.tipos||{}).sort(cadNum);
    sb.innerHTML=cadOpts(tipos.map(t=>[t,`Base ${t} · ${n[t]||0} obra(s)`]),tipos.sort((a,b)=>(n[b]||0)-(n[a]||0))[0])}
  const tipo=sb.value;const so=$("#cq-obra");const cur=so.dataset.tipo===tipo?so.value:"";
  so.innerHTML=cadOpts(cats.filter(c=>c[3]===tipo).sort((a,b)=>cadNum(a[0],b[0])).map(c=>[c[0],`${c[0]} ${c[2]||""}`]),cur,"Todas as obras desta base (regra da base)");so.dataset.tipo=tipo;
  const ar=cadAreas();const fa=$("#cq-area");const fv=fa.value;fa.innerHTML=cadOpts(ar.map(a=>[a,a]),fv,"Todas as áreas");
  $("#cq-de").innerHTML=cadOpts(ar.map(a=>[a,a]),$("#cq-de").value,"de…");$("#cq-para").innerHTML=cadOpts(ar.map(a=>[a,a]),$("#cq-para").value,"para…");
  cadRenderQuem()}
function cadRenderQuem(){const tipo=$("#cq-base").value,o=$("#cq-obra").value;if(!tipo){$("#cq-tbl").innerHTML="";return}
  const L=cadLeaves(tipo);const tp=T.tipos[tipo]||{prods:{}};const ar=cadAreas();const val=l=>o?cadValObra(tipo,l,o):cadValBase(tipo,l);
  const q=semAc($("#cq-q").value||"").trim(),fa=$("#cq-area").value;
  const cnt={};L.forEach(l=>{const v=val(l)||"(sem regra)";cnt[v]=(cnt[v]||0)+1});
  const nObras=(S.cat.obras||[]).concat(S.cad.novas).filter(c=>c[3]===tipo).length;
  const exc=o?L.filter(l=>cadExc(o,l)||(S.cad.o[o]&&l.key in S.cad.o[o])).length:0;
  {const D=S.dpR||{};const nt=Object.values(D.t||{}).reduce((a,m)=>a+Object.keys(m).length,0),no=Object.values(D.o||{}).reduce((a,m)=>a+Object.keys(m).length,0);const sr=cnt["(sem regra)"]||0;
  $("#cad-kpi").innerHTML=cadKpi("Bases modelo",cadN(Object.keys(T.tipos||{}).length),"modelos de orçamento")+cadKpi(`Insumos ${o?"da obra":"da base"}`,cadN(L.length),o?esc(o):`base ${esc(tipo)} · ${nObras} obra(s)`)+cadKpi("Sem quem planeja",`<span style="color:${sr?"var(--bad)":"var(--good)"}">${cadN(sr)}</span>`,"nesta seleção")+cadKpi("Ajustes por base",cadN(nt),"feitos aqui no app")+cadKpi("Exceções por obra",cadN(no),`em ${cadN(Object.keys(D.o||{}).length)} obra(s)`)}
  $("#cq-res").innerHTML=`<b>${L.length}</b> insumos ${o?`na obra <b>${esc(o)}</b> · ${exc} exceção(ões) desta obra`:`na base <b>${esc(tipo)}</b> · vale para ${nObras} obra(s)`} · ${Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([a,n])=>`<span class="cad-chip${a==="(sem regra)"?" bad":""}">${esc(a)} <b>${n}</b></span>`).join(" ")}`;
  const F=L.filter(l=>(!fa||val(l)===fa)&&(!q||semAc(`${l.P} ${l.S} ${l.I} ${l.desc} ${SDESC[l.S]||""}`).includes(q)));const MAX=1500;
  $("#cq-n").textContent=`${F.length} insumo(s)${F.length>MAX?` · mostrando ${MAX}`:""}`;
  $("#cq-tbl").innerHTML=`<thead><tr><th>Produto</th><th>Serviço</th><th>Insumo</th><th>Descrição</th><th>Quem planeja</th><th>Origem</th></tr></thead><tbody>${F.slice(0,MAX).map(l=>{const v=val(l);
    let org;if(o){const pend=S.cad.o[o]&&l.key in S.cad.o[o];const vb=cadValBase(tipo,l);org=pend?["rascunho","alterado"]:cadExc(o,l)&&cadExc(o,l)!==vb?["validado","exceção da obra"]:["vazio","igual à base"]}else org=cadOrigemBase(tipo,l);
    return `<tr${org[1]==="alterado"?' class="cad-mud"':""}><td title="${esc(tp.prods[l.P]||"")}" class="cad-cod">${esc(l.P)}</td><td><span class="cad-cod">${esc(l.S)}</span> <span class="muted">${esc(SDESC[l.S]||"")}</span></td><td class="cad-cod">${esc(l.I||"—")}</td><td>${esc(l.desc)}</td>
    <td><select class="cad-in" data-cq="${esc(l.key)}" aria-label="Quem planeja ${esc(l.desc)}">${v&&!ar.includes(v)?`<option>${esc(v)}</option>`:""}${cadOpts(ar.map(a=>[a,a]),v,v?null:"— escolha —")}</select></td><td><span class="pill ${org[0]}">${org[1]}</span></td></tr>`}).join("")}</tbody>`;cadBarra()}
function cadSetQuem(key,v){const tipo=$("#cq-base").value,o=$("#cq-obra").value;const [P,Sv,I]=key.split("|");const l={key,P,S:Sv,I};
  if(o){const orig=cadExc(o,l)||cadValBase(tipo,l);const m=S.cad.o[o]=S.cad.o[o]||{};if(v===orig)delete m[key];else m[key]=v;if(!Object.keys(m).length)delete S.cad.o[o];S.cad.oTipo=S.cad.oTipo||{};S.cad.oTipo[o]=tipo}
  else{const orig=cadBaseDe(S.dpR||{},tipo,P,Sv,I);const m=S.cad.t[tipo]=S.cad.t[tipo]||{};if(v===orig)delete m[key];else m[key]=v;if(!Object.keys(m).length)delete S.cad.t[tipo]}}
function cadTrocar(){const de=$("#cq-de").value,para=$("#cq-para").value;const tipo=$("#cq-base").value,o=$("#cq-obra").value;
  if(!de||!para||de===para){$("#cq-msg").textContent="Escolha a área de origem e a de destino.";return}
  const L=cadLeaves(tipo).filter(l=>(o?cadValObra(tipo,l,o):cadValBase(tipo,l))===de);L.forEach(l=>cadSetQuem(l.key,para));
  $("#cq-msg").textContent=`${L.length} insumo(s) passados de ${de} para ${para}${o?` na obra ${o}`:` na base ${tipo}`}. Clique em Salvar para gravar.`;cadRenderQuem()}
/* áreas de cada obra depois da mudança: o que o modelo da base dá, sem incluir área que a obra não tinha (a não ser a que foi atribuída agora) */
function cadAreasObra(id,tipo,antes,novas){if(!(T.tipos||{})[tipo])return [...new Set([...antes,...novas])].sort();
  const calc=new Set(cadLeaves(tipo).map(l=>{const r=ruleFor(tipo,l,id);return r&&r[1]}).filter(Boolean));const ok=new Set([...antes,...novas]);
  return [...calc].filter(a=>ok.has(a)||!antes.length).sort()}

/* ---------- Gerentes (aba 3) ---------- */
function cadGerObras(r){const cats=(S.cat.obras||[]).concat(S.cad.novas);const AO=cadAO();const e=String(r.emp||"").trim(),o=String(r.obra||"").trim();
  if(!e||!o)return [];let ids=cadTodas(e)?cats.map(c=>c[0]):cadTodas(o)?cats.filter(c=>String(c[6])===e).map(c=>c[0]):(cadObraDe(e+"-"+o)?[e+"-"+o]:[]);
  if((cadTodas(e)||cadTodas(o))&&r.dep)ids=ids.filter(id=>(AO[id]||[]).includes(r.dep));return ids}
function cadGerStatus(r){const em=String(r.email||"").trim();const e=String(r.emp||"").trim(),o=String(r.obra||"").trim();
  if(!r.dep)return["reaberto","Falta o departamento",0];if(!e||!o)return["reaberto","Falta empresa/obra",0];
  if(!cadTodas(e)&&!cadEmpresas().some(x=>x[0]===e))return["reaberto","Empresa não encontrada",0];
  if(!cadTodas(e)&&!cadTodas(o)&&!cadObraDe(e+"-"+o))return["reaberto","Obra não encontrada",0];
  const n=cadGerObras(r).length;if(!em)return["vazio","Sem e-mail (não libera)",n];if(!CAD_EMAIL.test(em.toLowerCase()))return["reaberto","E-mail inválido",n];
  if(!n)return["rascunho","Nenhuma obra com itens desta área",0];
  if(!cadTodas(e)&&!cadTodas(o)&&!(cadAO()[e+"-"+o]||[]).includes(r.dep))return["rascunho","Obra sem itens desta área",n];
  return["enviado","ok",n]}
const cadLink=r=>/com\s*claude/i.test(String(r.obs||""));
function cadGerFiltradas(){const q=semAc($("#cadg-q").value||"").trim(),dep=$("#cadg-dep").value,emp=$("#cadg-emp").value,pend=$("#cadg-pend").checked;
  return S.cad.ger.map((r,i)=>[r,i]).filter(([r])=>(!q||semAc(`${r.nome} ${r.email} ${r.cargo} ${r.regNome}`).includes(q))&&(!dep||r.dep===dep)&&(!emp||String(r.emp)===emp)&&(!pend||cadGerStatus(r)[1]!=="ok"))}
function cadRenderGer(){const C=S.cad;const R=C.ger;const ar=cadAreas();const emps=cadEmpresas();
  const st=R.map(cadGerStatus);const pes=new Set(R.filter(r=>CAD_EMAIL.test(String(r.email||"").trim().toLowerCase())).map(r=>r.email.trim().toLowerCase()));
  const link=new Set(R.filter(r=>cadLink(r)&&r.email).map(r=>r.email.trim().toLowerCase()));const prob=st.filter(s=>s[1]!=="ok").length;
  const cob=new Set();R.forEach((r,i)=>{if(st[i][0]==="reaberto"||!r.email)return;cadGerObras(r).forEach(id=>cob.add(id+"|"+r.dep))});
  let falta=0;(S.cat.obras||[]).concat(C.novas).forEach(c=>{const e=cadObraEstado(c);if(e.inat||e.fora)return;const fm=(S.foraApp||{})[c[0]]||{};(cadAO()[c[0]]||[]).forEach(a=>{if(!fm[a]&&!cob.has(c[0]+"|"+a))falta++})});
  $("#cad-kpi").innerHTML=cadKpi("Pessoas com e-mail",cadN(pes.size),`${R.length} linha(s) no cadastro`)+cadKpi("Acessam pelo link",cadN(link.size),`${cadN(pes.size-link.size)} recebem formulário offline`)+cadKpi("Departamentos",cadN(new Set(R.map(r=>r.dep).filter(Boolean)).size),"quem planeja")+cadKpi("Linhas com pendência",`<span style="color:${prob?"var(--warn)":"var(--good)"}">${cadN(prob)}</span>`,"veja a coluna Situação")+cadKpi("Áreas de obra sem gerente",`<span style="color:${falta?"var(--bad)":"var(--good)"}">${cadN(falta)}</span>`,"obras ativas no app");
  const sd=$("#cadg-dep"),se=$("#cadg-emp");const dv=sd.value,ev=se.value;sd.innerHTML=cadOpts(ar.map(a=>[a,a]),dv,"Todos os departamentos");se.innerHTML=cadOpts(emps.map(([e,n])=>[e,`${e} – ${n}`]),ev,"Todas as empresas");
  $("#cadg-origem").textContent=C.gerOrigem||"";{const ns=R.filter(r=>r.sug&&!r.email).length;const bs=$("#cadg-sugs");bs.hidden=!ns;bs.textContent=`Usar as ${ns} sugestões`}
  const F=cadGerFiltradas();const MAX=400;$("#cadg-n").textContent=`${F.length} de ${R.length} linha(s)${F.length>MAX?` · mostrando ${MAX}, use os filtros`:""}`;
  const empOpts=sel=>`<option value="Todas"${cadTodas(sel)?" selected":""}>Todas</option>`+(sel&&!cadTodas(sel)&&!emps.some(x=>x[0]===String(sel))?`<option selected>${esc(sel)}</option>`:"")+cadOpts(emps.map(([e,n])=>[e,`${e} – ${n}`]),sel);
  const obraOpts=(e,sel)=>{const L=cadTodas(e)?[]:(S.cat.obras||[]).concat(C.novas).filter(c=>String(c[6])===String(e)).sort((a,b)=>cadNum(a[1],b[1]));
    return `<option value="Todas"${cadTodas(sel)?" selected":""}>Todas</option>`+(sel&&!cadTodas(sel)&&!L.some(c=>String(c[1])===String(sel))?`<option selected>${esc(sel)}</option>`:"")+cadOpts(L.map(c=>[c[1],`${c[1]} – ${c[2]||""}`]),sel)};
  const inp=(i,k,v,ph,w)=>`<input class="cad-in" data-cg="${i}" data-k="${k}" value="${esc(v||"")}" placeholder="${ph||""}" style="width:${w||140}px" aria-label="${ph||k}">`;
  $("#cadg-tbl").innerHTML=`<thead><tr><th>Departamento (quem planeja)</th><th>Empresa</th><th>Obra</th><th>Nome do gerente</th><th>E-mail</th><th>Cargo</th><th title="Marcado = acessa pelo link do aplicativo (“com Claude”). Desmarcado = recebe o formulário offline">Usa o app</th><th>Regional</th><th>Gerente Regional</th><th>E-mail do Regional</th><th>Situação</th><th></th></tr></thead><tbody>${F.slice(0,MAX).map(([r,i])=>{const s=st[i];
    return `<tr data-row="${i}"><td><select class="cad-in" data-cg="${i}" data-k="dep" aria-label="Departamento">${r.dep&&!ar.includes(r.dep)?`<option>${esc(r.dep)}</option>`:""}${cadOpts(ar.map(a=>[a,a]),r.dep,"— escolha —")}</select></td>
    <td><select class="cad-in" data-cg="${i}" data-k="emp" style="max-width:190px" aria-label="Empresa">${empOpts(r.emp)}</select></td><td><select class="cad-in" data-cg="${i}" data-k="obra" style="max-width:190px" aria-label="Obra">${obraOpts(r.emp,r.obra)}</select></td>
    <td>${inp(i,"nome",r.nome,"Nome",150)}</td><td>${inp(i,"email",r.email,r.sug&&!r.email?"sugestão: "+r.sug.email:"nome@empresa.com.br",200)}</td><td>${inp(i,"cargo",r.cargo,"Cargo",120)}</td>
    <td style="text-align:center"><input type="checkbox" data-cg="${i}" data-k="link"${cadLink(r)?" checked":""} aria-label="Usa o app pelo link"></td>
    <td>${inp(i,"reg",r.reg,"Regional",110)}</td><td>${inp(i,"regNome",r.regNome,"Nome",130)}</td><td>${inp(i,"regEmail",r.regEmail,"e-mail",170)}</td>
    <td class="cad-st"><span class="pill ${s[0]}">${esc(s[1])}</span>${s[2]?` <span class="muted" style="font-size:11px">${s[2]} obra(s)</span>`:""}${r.sug&&!r.email?`<div class="cad-sug">Sugestão: ${esc(r.sug.nome||r.sug.email)} <button class="btn sm" data-cg-sug="${i}">Usar</button></div>`:""}</td>
    <td style="white-space:nowrap"><button class="btn sm" data-cg-dup="${i}" title="Duplicar linha" aria-label="Duplicar linha">⧉</button> <button class="btn sm danger" data-cg-del="${i}" title="Excluir linha" aria-label="Excluir linha">✕</button></td></tr>`}).join("")}</tbody>`;
  cadBarra()}
function cadGerAoa(){return [CAD_H,...S.cad.ger.map(r=>[r.dep||"",r.emp||"",r.obra||"",r.nome||"",r.email||"",r.cargo||"",r.obs||"",r.reg||"",r.regNome||"",r.regEmail||""])]}
function cadGerDaPlanilha(rows){const h=rows[0].map(c=>String(c).trim());const ix=n=>h.indexOf(n);
  const iD=ix("Departamento (quem planeja)"),iE=ix("Empresa"),iO=ix("Obra"),iN=ix("Nome do gerente"),iM=ix("E-mail"),iC=ix("Cargo da pessoa"),iX=ix("Observação"),iR=ix("Regional"),iRN=ix("Nome do gerente - Regional");
  const iRM=iRN<0?-1:h.findIndex((c,i)=>i>iRN&&c==="E-mail");if([iD,iE,iO,iM].some(x=>x<0))throw new Error("cols");const g=(r,i)=>i<0?"":String(r[i]==null?"":r[i]).trim();
  return rows.slice(1).filter(r=>g(r,iD)||g(r,iM)).map(r=>({dep:g(r,iD),emp:g(r,iE),obra:g(r,iO),nome:g(r,iN),email:g(r,iM),cargo:g(r,iC),obs:g(r,iX),reg:g(r,iR),regNome:g(r,iRN),regEmail:g(r,iRM)}))}

/* ---------- Pendências: Base da Estrutura → obras novas para confirmar + o que falta preencher ----------
   Arquivo principal: estrutura do ERP (aba "Base - Geral"). Opcional: planilha de obras com situação (0 = ativa, 1 = inativa).
   Obra nova = está na estrutura e ainda não está no catálogo do app. Para cada uma o app sugere, para você confirmar:
   base modelo (1º mesma obra em outras empresas, 2º base mais usada no mesmo grupo da obra, 3º estrutura mais parecida),
   quem planeja (regra da base para os serviço/insumo da obra; o que não está no modelo vai para a área mais comum),
   Regional (Grupo_Empresa da estrutura), Gerente Administrativo, responsável pela Controladoria e Gerente Regional (quem já faz isso na empresa ou na Regional).
   Nada do que já existe é alterado. */
const CAD_GA="Gerente Administrativo",CAD_CTRL="Controladoria";
const cadNorm=v=>semAc(String(v==null?"":v)).replace(/[^a-z0-9]/g,"");
function cadLerEstrutura(rows){const h=(rows[0]||[]).map(x=>String(x).trim());
  if(!(h[0]==="Empresa"&&h[3]==="Obra"&&h[6]==="Prod_plt"&&h[10]==="Serv_plt"&&h[12]==="Ins_cins"))return null;
  const t=v=>String(v==null?"":v).trim();const eo={},dP={},dS={},dI={},E={};let n=0,inat=0;
  for(let i=1;i<rows.length;i++){const r=rows[i];const emp=t(r[0]),ob=t(r[3]);if(!emp||!ob)continue;const k=emp+"-"+ob;
    if(!eo[k])eo[k]=[t(r[1]),t(r[2]),t(r[4]),t(r[5]),0];eo[k][4]++;const P=t(r[6]),S_=t(r[10]),I=t(r[12]);
    if(P&&!dP[P]&&t(r[7]))dP[P]=t(r[7]);if(S_&&!dS[S_]&&t(r[11]))dS[S_]=t(r[11]);if(I&&!dI[I]&&t(r[13]))dI[I]=t(r[13]);
    const ina=[14,15,16].some(j=>String(r[j]).trim()==="1");if(ina)inat++;const L=[P,t(r[8]),t(r[9]),S_,I];if(ina)L.push(1);
    ((E[emp]=E[emp]||{})[ob]=(E[emp][ob]||[])).push(L);n++}
  return {E,idx:{eo,dP,dS,dI,linhas:n,inativas:inat,empresas:Object.keys(E).length}}}
function cadLerSituacao(rows){const h=(rows[0]||[]).map(cadNorm);const ach=(...ns)=>{for(const n of ns){const i=h.indexOf(n);if(i>=0)return i}return -1};
  const iCE=ach("codempresa","codigoempresa","empresacod"),iCO=ach("codobra","codigoobra","obracod");
  const iE=iCE>=0?iCE:ach("empresa"),iO=iCO>=0?iCO:ach("obra");if(iE<0||iO<0)return null;
  let iS=ach("status","situacao","inativo","inativa","ativo","ativa");if(iS<0&&h.length>7)iS=7;const pos=iS>=0&&/^ativ[oa]$/.test(h[iS]);
  const M=new Map();rows.slice(1).forEach(r=>{const e=String(r[iE]==null?"":r[iE]).trim(),o=String(r[iO]==null?"":r[iO]).trim();if(!e||!o||iS<0)return;
    const v=semAc(String(r[iS]==null?"":r[iS]).trim());let inat=null;
    if(v!==""){inat=/inativ|encerr|cancel/.test(v)?1:/^ativ/.test(v)?0:(v==="1"||v==="sim"||v==="s"||v==="true")?(pos?0:1):(v==="0"||v==="nao"||v==="n"||v==="false")?(pos?1:0):null}
    if(inat!=null)M.set(e+"-"+o,inat)});return M}
async function cadImportar(files){const C=S.cad;const out=$("#cad-imp-res");out.hidden=false;out.innerHTML="Lendo… (a Base da Estrutura pode levar alguns segundos)";await new Promise(r=>setTimeout(r,30));
  const nomes=[];let mud=0;
  for(const f of files){const wb=XLSX.read(await f.arrayBuffer(),{type:"array",dense:true});let ok=false;
    if(wb.Sheets["Base - Geral"]){const e=cadLerEstrutura(XLSX.utils.sheet_to_json(wb.Sheets["Base - Geral"],{header:1,defval:""}));if(e){C.estr={...e,arquivo:f.name};nomes.push(`${f.name}: ${cadN(e.idx.linhas)} linhas, ${cadN(Object.keys(e.idx.eo).length)} empresas/obras`);ok=true}}
    if(!ok){const nm=wb.SheetNames.find(n=>/^obras?$/i.test(n.trim()))||wb.SheetNames[0];const M=cadLerSituacao(XLSX.utils.sheet_to_json(wb.Sheets[nm],{header:1,defval:""}));
      if(M){C.sit=M;M.forEach((v,id)=>{const c=cadObraDe(id);if(c&&((C.cat.has(id)?C.cat.get(id):c[8]===1)!==(v===1))){cadSetInat(id,v===1);mud++}});nomes.push(`${f.name}: situação de ${cadN(M.size)} obras`);ok=true}}
    if(!ok){out.innerHTML=`Não reconheci <b>${esc(f.name)}</b>. Use a Base da Estrutura (aba “Base - Geral”) ou uma planilha de obras com empresa, obra e situação.`;return}}
  C.pend=null;await cadPendPrep();const P=[...C.pend.values()];
  out.innerHTML=`<b>Lido:</b> ${nomes.map(esc).join(" · ")}<br><b>${cadN(P.length)}</b> obra(s) nova(s) para confirmar${mud?` · <b>${cadN(mud)}</b> obra(s) mudaram de situação no ERP`:""}. <span class="muted">Nada foi gravado ainda: confirme abaixo e clique em <b>Salvar</b>.</span>`;
  cadMostrar("pend")}
const cadEstIdx=()=>(S.cad.estr&&S.cad.estr.idx)||S.estIdx||null;
async function cadEstObra(e,o){const C=S.cad;if(C.estr)return (C.estr.E[e]||{})[o]||[];const d=await estEmpresa(e);return (d&&d.o&&d.o[o])||[]}
/* lista de obras novas (calculada da estrutura, então não some se você fechar a página antes de confirmar) */
async function cadPendPrep(){const C=S.cad;if(C.pend)return;if(!C.estr)await carregarEstIdx();const IX=cadEstIdx();C.pend=new Map();if(!IX||!IX.eo)return;
  const ids=Object.keys(IX.eo).filter(id=>!S.catMap.has(id)&&!(C.sit&&C.sit.get(id)===1));if(!ids.length)return;
  const tipos=Object.keys(T.tipos||{});const TL={},TS={};tipos.forEach(tp=>{TL[tp]=cadLeaves(tp);TS[tp]=new Set(TL[tp].map(l=>l.S+"|"+l.I))});
  const cnt=new Map();tipos.forEach(tp=>TL[tp].forEach(l=>{const a=cadBaseDe(S.dpR||{},tp,l.P,l.S,l.I);if(!a)return;const k=l.S+"|"+l.I;const m=cnt.get(k)||{};m[a]=(m[a]||0)+1;cnt.set(k,m)}));
  const top=m=>{const e=Object.entries(m||{}).sort((a,b)=>b[1]-a[1])[0];return e?e[0]:""};
  const porObra={},porGrupo={};(S.cat.obras||[]).forEach(c=>{if(!c[3])return;(porObra[c[1]]=porObra[c[1]]||{})[c[3]]=((porObra[c[1]]||{})[c[3]]||0)+1;const g=IX.eo[c[0]]&&IX.eo[c[0]][3];if(g)(porGrupo[g]=porGrupo[g]||{})[c[3]]=((porGrupo[g]||{})[c[3]]||0)+1});
  C.pendCtx={TL,TS,cnt,top,tipos};
  for(const id of ids){const [en,reg,on,grupo,linhas]=IX.eo[id];const e=id.split("-")[0],o=id.slice(e.length+1);
    const L=await cadEstObra(e,o);const si=new Set(L.filter(x=>x[5]!==1).map(x=>x[3]+"|"+x[4]));if(L.length&&!si.size)continue;/* todas as linhas inativas no ERP */
    let base="",motivo="";const so=porObra[o];if(so){base=top(so);motivo=`mesma obra em ${Object.values(so).reduce((a,b)=>a+b,0)} outra(s) empresa(s)`}
    else if(porGrupo[grupo]){base=top(porGrupo[grupo]);motivo=`${porGrupo[grupo][base]} obra(s) do grupo ${grupo} usam esta base`}
    else{let b="",best=0;tipos.forEach(tp=>{let n=0;si.forEach(k=>{if(TS[tp].has(k))n++});const sc=n/Math.max(1,TS[tp].size+si.size-n);if(sc>best){best=sc;b=tp}});if(best>=.3){base=b;motivo=`estrutura parecida com a base`}}
    const p={id,e,o,en,on,reg,grupo,linhas,si,base,motivo,st:"",resp:{}};cadPendCalc(p);C.pend.set(id,p)}}
function cadParecido(p){const {TS}=S.cad.pendCtx;if(!p.base||!TS[p.base]||!p.si.size)return null;let n=0;p.si.forEach(k=>{if(TS[p.base].has(k))n++});return Math.round(100*n/p.si.size)}
/* áreas e responsáveis sugeridos para a base escolhida */
function cadPendCalc(p){const {TL,TS,cnt,top}=S.cad.pendCtx;const A={};let fora=0;
  if(p.base&&TL[p.base])TL[p.base].forEach(l=>{if(p.si.size&&!p.si.has(l.S+"|"+l.I))return;const r=ruleFor(p.base,l,p.id);const a=r&&r[1];if(a)A[a]=(A[a]||0)+1});
  p.si.forEach(k=>{if(p.base&&TS[p.base]&&TS[p.base].has(k))return;const a=top(cnt.get(k));if(a){A[a]=(A[a]||0)+1;fora++}});
  p.areas=A;p.fora=fora;p.parecido=cadParecido(p);
  const deps=[...new Set([CAD_GA,CAD_CTRL,...Object.keys(A)])];deps.forEach(d=>{if(!p.resp[d]||!p.resp[d].mexeu)p.resp[d]=cadSugPessoa(d,p.e,p.reg)});
  if(!p.resp._reg||!p.resp._reg.mexeu)p.resp._reg=cadSugRegional(p.e,p.reg)}
const cadValido=v=>CAD_EMAIL.test(String(v||"").trim().toLowerCase());
function cadRegDaEmp(e){const C=S.cad;const IX=cadEstIdx();if(C._regEmpIx!==IX){C._regEmpIx=IX;C._regEmp=new Map();if(IX)Object.entries(IX.eo).forEach(([id,v])=>{const k=id.split("-")[0];if(!C._regEmp.has(k))C._regEmp.set(k,v[1])})}return C._regEmp.get(String(e))||""}
function cadSugPessoa(dep,e,reg){const f={},g={};(S.cad.ger||[]).forEach(r=>{if(r.dep!==dep||!cadValido(r.email))return;const k=r.email.trim().toLowerCase();
    if(String(r.emp)===String(e)){f[k]=f[k]||{n:0,r};f[k].n++}else if(reg&&cadRegDaEmp(r.emp)===reg){g[k]=g[k]||{n:0,r};g[k].n++}});
  const a=Object.values(f).sort((x,y)=>y.n-x.n)[0],b=Object.values(g).sort((x,y)=>y.n-x.n)[0];const w=a||b;
  return w?{nome:w.r.nome||"",email:w.r.email.trim(),fonte:a?"já faz isso nesta empresa":"já faz isso na "+reg}:{nome:"",email:"",fonte:""}}
function cadSugRegional(e,reg){const f={};(S.cad.ger||[]).forEach(r=>{if(!cadValido(r.regEmail))return;const ok=String(r.emp)===String(e)?2:(reg&&cadRegDaEmp(r.emp)===reg?1:0);if(!ok)return;const k=r.regEmail.trim().toLowerCase();f[k]=f[k]||{n:0,s:ok,r};f[k].n+=ok})
  const w=Object.values(f).sort((x,y)=>y.s-x.s||y.n-x.n)[0];return w?{nome:w.r.regNome||"",email:w.r.regEmail.trim(),fonte:w.s===2?"já é o Regional desta empresa":"Regional da "+reg}:{nome:"",email:"",fonte:""}}
function cadPendAplicar(p,modo){const C=S.cad;cadPendDesfazer(p);if(!p.base&&modo==="ok"){toast("Escolha a base modelo antes de confirmar.");return false}
  const c=[p.id,p.o,p.on,p.base,0,0,p.e,p.en,0];C.novas.push(c);C.aoNovas[p.id]=Object.keys(p.areas).sort();if(p.reg)C.reg.set(p.id,p.reg);
  if(modo==="pausa"){C.fora.set(p.id,"pausa")}
  else{const deps=[...new Set([CAD_GA,CAD_CTRL,...Object.keys(p.areas)])];const rg=p.resp._reg||{};
    deps.forEach((d,i)=>{const r=p.resp[d]||{};const cob=C.ger.some(x=>x.dep===d&&!x.orig&&cadValido(x.email)&&(cadTodas(x.emp)||(String(x.emp)===p.e&&(String(x.obra)===p.o||cadTodas(x.obra))))&&(!(cadTodas(x.emp)||cadTodas(x.obra))||(C.aoNovas[p.id]||[]).includes(d)));
      if(cob&&!(r.mexeu&&r.email)&&!(d===CAD_GA&&rg.email))return;
      C.ger.push({dep:d,emp:p.e,obra:p.o,nome:r.nome||"",email:r.email||"",cargo:"",obs:"com Claude",reg:p.reg||"",regNome:d===CAD_GA?rg.nome||"":"",regEmail:d===CAD_GA?rg.email||"":"",orig:p.id})});
    C.gerDirty=true}
  p.st=modo;return true}
function cadPendDesfazer(p){const C=S.cad;C.novas=C.novas.filter(c=>c[0]!==p.id);delete C.aoNovas[p.id];C.reg.delete(p.id);C.fora.delete(p.id);const n=C.ger.length;C.ger=C.ger.filter(r=>r.orig!==p.id);if(C.ger.length!==n)C.gerDirty=true;p.st=""}
function cadPendFiltradas(){const C=S.cad;const q=semAc($("#cp-q").value||"").trim(),rg=$("#cp-reg").value,gr=$("#cp-grupo").value,st=$("#cp-st").value;
  return [...C.pend.values()].filter(p=>(!rg||p.reg===rg)&&(!gr||p.grupo===gr)&&(st==="todas"||(st==="aguardando"&&!p.st)||(st==="feitas"&&p.st))&&(!q||semAc(`${p.id} ${p.en} ${p.on}`).includes(q))).sort((a,b)=>cadNum(a.id,b.id))}
function cadPessoaIn(p,d,rot){const r=p.resp[d]||{};const k=esc(p.id)+"|"+esc(d);return `<div class="cp-pes${r.email&&cadValido(r.email)?"":" falta"}"><span class="lbl">${esc(rot||d)}</span>
  <input class="cad-in" data-cp-pes="${k}" data-f="nome" value="${esc(r.nome||"")}" placeholder="Nome" aria-label="Nome ${esc(rot||d)}"><input class="cad-in" data-cp-pes="${k}" data-f="email" value="${esc(r.email||"")}" placeholder="e-mail" aria-label="E-mail ${esc(rot||d)}">
  ${r.fonte?`<small class="cp-src">${r.mexeu?"editado":"sugestão: "+esc(r.fonte)}</small>`:`<small class="cp-src falta">sem sugestão, preencher</small>`}</div>`}
function cadRenderPend(){const C=S.cad;const sr=$("#cp-reg"),sg=$("#cp-grupo");const P=[...(C.pend||new Map()).values()];
  const rv=sr.value,gv=sg.value;sr.innerHTML=cadOpts([...new Set(P.map(p=>p.reg).filter(Boolean))].sort().map(x=>[x,x]),rv,"Todas as Regionais");sg.innerHTML=cadOpts([...new Set(P.map(p=>p.grupo).filter(Boolean))].sort().map(x=>[x,x]),gv,"Todos os grupos");
  const ag=P.filter(p=>!p.st),ok=P.filter(p=>p.st==="ok"),pa=P.filter(p=>p.st==="pausa"),sb=ag.filter(p=>!p.base);
  const F=cadPendFiltradas();C.cpVis=F.map(p=>p.id);const MAX=60;
  $("#cp-n").textContent=`${F.length} obra(s)${F.length>MAX?` · mostrando ${MAX}, use os filtros`:""}`;
  const bases=Object.keys(T.tipos||{}).sort(cadNum);
  $("#cp-list").innerHTML=F.length?F.slice(0,MAX).map(p=>{const A=Object.entries(p.areas).sort((a,b)=>b[1]-a[1]);const outras=A.map(([d])=>d).filter(d=>d!==CAD_GA&&d!==CAD_CTRL);
    const k=esc(p.id);return `<article class="cp-card ${p.st?"cp-"+p.st:""}">
    <header><div><span class="cad-cod">${esc(p.e)}</span> ${esc(p.en)}<br><b><span class="cad-cod">${esc(p.o)}</span> ${esc(p.on)}</b></div>
      <div class="cp-tags"><span class="cad-chip">${esc(p.reg||"sem Regional")}</span><span class="cad-chip">${esc(p.grupo||"sem grupo")}</span><span class="cad-chip">${cadN(p.linhas)} linhas</span>${p.st==="ok"?'<span class="pill enviado">Confirmada</span>':p.st==="pausa"?'<span class="pill vazio">Não planejar agora</span>':'<span class="pill rascunho">Aguardando confirmação</span>'}</div></header>
    <div class="cp-grid">
      <div><span class="lbl">Base modelo</span><select class="cad-in" data-cp-base="${k}" aria-label="Base modelo">${cadOpts(bases.map(b=>[b,`${b}${T.tipos[b]&&T.tipos[b].prods?" · "+Object.values(T.tipos[b].prods)[0]:""}`]),p.base,"— escolher —")}</select>
        <small class="cp-src${p.base?"":" falta"}">${p.base?`sugestão: ${esc(p.motivo)}${p.parecido!=null?` · ${p.parecido}% dos insumos da obra estão no modelo`:""}`:"não encontrei base parecida, escolha"}</small></div>
      <div><span class="lbl">Quem planeja (replicado do modelo)</span><div>${A.map(([d,n])=>`<span class="cad-chip">${esc(d)} <b>${n}</b></span>`).join("")||'<span class="muted">escolha a base</span>'}</div>
        ${p.fora?`<small class="cp-src">${p.fora} insumo(s) fora do modelo foram para a área mais comum desses insumos</small>`:""}</div>
    </div>
    <div class="cp-pessoas">${cadPessoaIn(p,CAD_GA)}${cadPessoaIn(p,CAD_CTRL,"Responsável Controladoria")}${cadPessoaIn(p,"_reg","Gerente Regional")}</div>
    ${outras.length?`<details class="cp-mais"><summary>Outros departamentos (${outras.length}): ${outras.filter(d=>!(p.resp[d]&&cadValido(p.resp[d].email))).length} sem sugestão</summary><div class="cp-pessoas">${outras.map(d=>cadPessoaIn(p,d)).join("")}</div></details>`:""}
    <footer>${p.st?`<button class="btn sm" data-cp-desf="${k}">Desfazer</button>`:`<button class="btn primary sm" data-cp-ok="${k}">Confirmar</button><button class="btn sm" data-cp-pausa="${k}" title="Entra no cadastro como Pausada e para de aparecer aqui">Não planejar agora</button>`}</footer></article>`}).join(""):`<p class="muted">${P.length?"Nenhuma obra com esses filtros.":"Nenhuma obra nova. Suba a Base da Estrutura quando ela mudar."}</p>`;
  cadRenderFalta(ag.length,sb.length,ok.length,pa.length);cadBarra();cadTabPend()}
/* ---------- o que falta preencher nas obras que já estão no app ---------- */
function cadFaltas(){const C=S.cad;const AO=cadAO();const cov=new Set(),covR=new Set();
  C.ger.forEach(r=>{const ok=cadValido(r.email),okR=cadValido(r.regEmail);if(!ok&&!okR)return;const ids=r.dep?cadGerObras(r):[];ids.forEach(id=>{if(ok)cov.add(id+"|"+r.dep);if(okR)covR.add(id)})});
  const IX=cadEstIdx();const out=[];(S.cat.obras||[]).concat(C.novas).forEach(c=>{const e=cadObraEstado(c);if(e.inat||e.fora)return;const id=c[0];const fm=(S.foraApp||{})[id]||{};
    const deps=(AO[id]||[]).filter(a=>!fm[a]);const falta=deps.filter(a=>!cov.has(id+"|"+a));
    if(!e.reg)falta.push("_regnome");if(!covR.has(id))falta.push("_reg");
    if(falta.length)out.push({c,id,falta,regSug:IX&&IX.eo[id]?IX.eo[id][1]:"",reg:e.reg})});return out}
const cadFaltaRot=d=>d==="_reg"?"Gerente Regional":d==="_regnome"?"Regional":d;
function cadRenderFalta(nAg,nSb,nOk,nPa){const C=S.cad;const L=cadFaltas();C.faltas=L;const cnt=d=>L.filter(x=>x.falta.includes(d)).length;
  $("#cad-kpi").innerHTML=cadKpi("Obras novas aguardando",`<span style="color:${nAg?"var(--warn)":"var(--good)"}">${cadN(nAg)}</span>`,`${cadN(nSb)} sem base sugerida`)+cadKpi("Confirmadas agora",cadN(nOk),`${cadN(nPa)} para não planejar · falta Salvar`)
    +cadKpi("Sem Gerente Administrativo",`<span style="color:${cnt(CAD_GA)?"var(--bad)":"var(--good)"}">${cadN(cnt(CAD_GA))}</span>`,"obras ativas no app")+cadKpi("Sem resp. Controladoria",`<span style="color:${cnt(CAD_CTRL)?"var(--bad)":"var(--good)"}">${cadN(cnt(CAD_CTRL))}</span>`,"obras ativas no app")+cadKpi("Sem Gerente Regional",cadN(cnt("_reg")),`${cadN(cnt("_regnome"))} sem nome da Regional`);
  const sf=$("#cf-o");const fv=sf.value;const tipos=[...new Set(L.flatMap(x=>x.falta))].sort((a,b)=>cadFaltaRot(a).localeCompare(cadFaltaRot(b),"pt-BR"));
  sf.innerHTML=cadOpts(tipos.map(d=>[d,`${cadFaltaRot(d)} (${cnt(d)})`]),fv,"Tudo o que falta");
  const se=$("#cf-emp");const ev=se.value;se.innerHTML=cadOpts(cadEmpresas().map(([e,n])=>[e,`${e} – ${n}`]),ev,"Todas as empresas");
  const q=semAc($("#cf-q").value||"").trim();const F=L.filter(x=>(!fv||x.falta.includes(fv))&&(!ev||String(x.c[6])===ev)&&(!q||semAc(`${x.id} ${x.c[2]} ${x.c[7]}`).includes(q)));const MAX=300;
  $("#cf-n").textContent=`${cadN(F.length)} obra(s) com algo faltando${F.length>MAX?` · mostrando ${MAX}`:""}`;
  $("#cf-tbl").innerHTML=F.length?`<thead><tr><th>Empresa</th><th>Obra</th><th>Regional</th><th>Falta preencher (clique para preencher)</th></tr></thead><tbody>${F.slice(0,MAX).map(x=>`<tr><td><span class="cad-cod">${esc(x.c[6])}</span> ${esc(x.c[7]||"")}</td><td><span class="cad-cod">${esc(x.c[1])}</span> ${esc(x.c[2]||"")}</td><td>${esc(x.reg||"—")}</td>
    <td>${x.falta.map(d=>`<button class="cad-chip bad cf-chip" data-cf="${esc(x.id)}|${esc(d)}">${esc(cadFaltaRot(d))}</button>`).join("")}</td></tr>${C.cfAberto&&C.cfAberto.id===x.id?`<tr class="cf-form"><td colspan="4">${cadFaltaForm(x,C.cfAberto.d)}</td></tr>`:""}`).join("")}</tbody>`:`<tbody><tr><td class="muted">Nada faltando com esses filtros.</td></tr></tbody>`}
function cadFaltaForm(x,d){const e=String(x.c[6]);const nEmp=(S.cad.faltas||[]).filter(y=>String(y.c[6])===e&&y.falta.includes(d)).length;
  if(d==="_regnome")return `<div class="row"><b>Regional de ${esc(x.id)}</b><input class="cad-in" id="cf-v-nome" list="cad-regs" value="${esc(x.regSug||"")}" placeholder="Regional">${x.regSug?`<small class="cp-src">sugestão pela estrutura do ERP</small>`:""}
    <label><input type="radio" name="cf-alc" value="obra" checked> só esta obra</label><label><input type="radio" name="cf-alc" value="emp"> as ${nEmp} obra(s) da empresa ${esc(e)} sem Regional</label><button class="btn primary sm" id="cf-ok">Aplicar</button><button class="btn sm" id="cf-x">Fechar</button></div>`;
  const s=d==="_reg"?cadSugRegional(e,x.reg||x.regSug):cadSugPessoa(d,e,x.reg||x.regSug);
  return `<div class="row"><b>${esc(cadFaltaRot(d))} · ${esc(x.id)}</b><input class="cad-in" id="cf-v-nome" value="${esc(s.nome)}" placeholder="Nome"><input class="cad-in" id="cf-v-email" value="${esc(s.email)}" placeholder="e-mail" style="width:220px">${s.fonte?`<small class="cp-src">sugestão: ${esc(s.fonte)}</small>`:""}
    <label><input type="radio" name="cf-alc" value="obra" checked> só esta obra</label><label><input type="radio" name="cf-alc" value="emp"> todas as obras da empresa ${esc(e)} (“Todas”)</label><button class="btn primary sm" id="cf-ok">Incluir</button><button class="btn sm" id="cf-x">Fechar</button></div>`}
function cadFaltaAplicar(){const C=S.cad;const {id,d}=C.cfAberto;const x=(C.faltas||[]).find(y=>y.id===id);if(!x)return;const e=String(x.c[6]);const alc=(document.querySelector('input[name="cf-alc"]:checked')||{}).value;
  const nome=($("#cf-v-nome").value||"").trim(),email=(($("#cf-v-email")||{}).value||"").trim();
  if(d==="_regnome"){if(!nome)return;(alc==="emp"?C.faltas.filter(y=>String(y.c[6])===e&&y.falta.includes(d)).map(y=>y.id):[id]).forEach(i=>cadSetReg(i,nome))}
  else{if(!cadValido(email)){toast("Informe um e-mail válido.");return}const obra=alc==="emp"?"Todas":String(x.c[1]);
    if(d==="_reg"){const r=C.ger.find(r=>r.dep===CAD_GA&&String(r.emp)===e&&(cadTodas(r.obra)||String(r.obra)===String(x.c[1])));
      if(r&&!cadValido(r.regEmail)&&(alc==="emp"?cadTodas(r.obra):true)){r.regNome=nome;r.regEmail=email}else C.ger.push({dep:CAD_GA,emp:e,obra,nome:"",email:"",cargo:"",obs:"com Claude",reg:x.reg||"",regNome:nome,regEmail:email})}
    else C.ger.push({dep:d,emp:e,obra,nome,email,cargo:"",obs:"com Claude",reg:x.reg||"",regNome:"",regEmail:""});C.gerDirty=true}
  C.cfAberto=null;cadRenderPend()}
function cadTabPend(){const t=$("#tab-pend");if(!t||!S.cad||!S.cad.pend)return;const n=[...S.cad.pend.values()].filter(p=>!p.st).length+((S.cad.faltas||[]).length?1:0);
  t.textContent=n?`Pendências (${[...S.cad.pend.values()].filter(p=>!p.st).length} novas)`:"Pendências"}
document.addEventListener("click",e=>{const t=e.target;if(!t.closest||!t.closest("#cad-pend")||!S.cad)return;const C=S.cad;const P=id=>C.pend&&C.pend.get(id);
  let b=t.closest("[data-cp-ok]");if(b){const p=P(b.dataset.cpOk);if(p&&cadPendAplicar(p,"ok"))cadRenderPend();return}
  b=t.closest("[data-cp-pausa]");if(b){const p=P(b.dataset.cpPausa);if(p&&cadPendAplicar(p,"pausa"))cadRenderPend();return}
  b=t.closest("[data-cp-desf]");if(b){const p=P(b.dataset.cpDesf);if(p){cadPendDesfazer(p);cadRenderPend()}return}
  if(t.dataset&&t.dataset.cpLote){const L=(C.cpVis||[]).map(P).filter(p=>p&&!p.st);let n=0;L.forEach(p=>{if(cadPendAplicar(p,t.dataset.cpLote))n++});toast(`${n} obra(s) ${t.dataset.cpLote==="ok"?"confirmadas":"marcadas para não planejar"}${t.dataset.cpLote==="ok"&&n<L.length?` · ${L.length-n} sem base ficaram aguardando`:""}`);cadRenderPend();return}
  b=t.closest("[data-cf]");if(b){const [id,...d]=b.dataset.cf.split("|");C.cfAberto={id,d:d.join("|")};cadRenderPend();const f=$("#cf-v-email")||$("#cf-v-nome");if(f)f.focus();return}
  if(t.id==="cf-x"){C.cfAberto=null;cadRenderPend();return}if(t.id==="cf-ok"){cadFaltaAplicar();return}});
document.addEventListener("change",e=>{const t=e.target;if(!t.closest||!t.closest("#cad-pend")||!S.cad)return;const C=S.cad;
  if(t.dataset.cpBase){const p=C.pend.get(t.dataset.cpBase);if(p){const st=p.st;p.base=t.value;p.motivo="escolhida por você";cadPendCalc(p);if(st)cadPendAplicar(p,st);cadRenderPend()}return}
  if(t.dataset.cpPes){const [id,d]=t.dataset.cpPes.split("|");const p=C.pend.get(id);if(!p)return;const r=p.resp[d]=p.resp[d]||{};r[t.dataset.f]=t.value.trim();r.mexeu=true;if(p.st)cadPendAplicar(p,p.st);cadRenderPend();return}
  if(["cp-reg","cp-grupo","cp-st","cf-o","cf-emp"].includes(t.id)){cadRenderPend();return}});
document.addEventListener("input",e=>{const t=e.target;if((t.id==="cp-q"||t.id==="cf-q")&&S.cad)cadRenderPend()});
{const tp=$("#tab-pend");if(tp)tp.addEventListener("click",async()=>{await flush();S.cad=S.cad||cadNovo();S.cad.aba="pend";if(S.tab==="cad")cadMostrar("pend");else showTab("cad")})}

/* ---------- gravar tudo ---------- */
async function cadSalvar(){const C=S.cad;const btn=$("#cad-salvar");const msg=$("#cad-save-msg");btn.disabled=true;const feito=[];
  try{const por=await quemSou();const em=nowISO();
    if(C.estr){const E=C.estr.E;const emps=Object.keys(E);let i=0;for(const emp of emps){i++;msg.textContent=`Gravando estrutura: empresa ${i}/${emps.length}…`;await S.db.doc("restrito/estr/"+emp).set({o:E[emp],atualizadoEm:em})}
      const idx={...C.estr.idx,arquivo:C.estr.arquivo,atualizadoEm:em};await S.db.doc("restrito/estr_idx").set(idx);S.estIdx=idx;S.estE={};S.estAp=null;feito.push("estrutura do ERP");C.estr=null}
    /* 1) catálogo: obras novas e ativa/inativa */
    if(C.cat.size||C.novas.length){msg.textContent="Gravando empresas e obras…";const cat=cadClone(S.cat);const novasIds=new Set(C.novas.map(c=>c[0]));
      cat.obras=cat.obras.concat(C.novas.filter(c=>!cat.obras.some(x=>x[0]===c[0])).map(c=>c.slice()));cat.obras.forEach(c=>{if(C.cat.has(c[0]))c[8]=C.cat.get(c[0])?1:0});cat.atualizadoEm=em;
      await S.db.doc("restrito/catalogo").set(cat);S.cat=cat;S.catMap=new Map(cat.obras.map(c=>[c[0],c]));
      if(novasIds.size){const ao=cadClone(S.areasObra)||{};novasIds.forEach(id=>{const c=S.catMap.get(id);if(c&&!ao[id])ao[id]=C.aoNovas[id]||cadAreasObra(id,c[3],[],[])});C.aoNovas={};
        await S.db.doc("restrito/areasobra").set({m:ao,aba:"Cadastros",arquivo:"Cadastros no app",atualizadoEm:em});S.areasObra=ao}
      feito.push(`${C.cat.size} situação(ões)${C.novas.length?` e ${C.novas.length} obra(s) nova(s)`:""}`);C.cat.clear();C.novas=[]}
    if(C.fora.size){msg.textContent="Gravando planejamento fora do app…";const m=cadClone(S.foraApp)||{};C.fora.forEach((v,id)=>{if(v){m[id]=m[id]||{};m[id]["*"]=v==="pausa"?{motivo:"Pausada: não planejar agora",pausada:true,por,em}:{motivo:"Marcado em Cadastros",por,em}}else if(m[id]){delete m[id]["*"];if(!Object.keys(m[id]).length)delete m[id]}});
      await S.db.doc("regras/fora_app").set({m,atualizadoEm:em});S.foraApp=m;S.ind=null;feito.push(`${C.fora.size} obra(s) no/fora do app`);C.fora.clear()}
    if(C.reg.size){msg.textContent="Gravando Regionais…";const rd=await S.db.doc("regras/regional_obra").get();const m={...((rd.exists&&rd.data().m)||{})};C.reg.forEach((v,id)=>{if(v)m[id]=v;else delete m[id]});
      await S.db.doc("regras/regional_obra").set({m,arquivo:"Cadastros no app",atualizadoEm:em});S.regObra=m;feito.push(`${C.reg.size} Regional(is)`);C.reg.clear()}
    /* 2) quem planeja */
    const nT=Object.values(C.t).reduce((a,m)=>a+Object.keys(m).length,0),nO=Object.values(C.o).reduce((a,m)=>a+Object.keys(m).length,0);
    if(nT||nO){msg.textContent="Gravando quem planeja…";const D=cadClone(S.dpR)||{r:{},o:{},t:{}};D.r=D.r||{};D.o=D.o||{};D.t=D.t||{};const afet=new Map();
      Object.entries(C.t).forEach(([tipo,m])=>{const t=D.t[tipo]=D.t[tipo]||{};Object.entries(m).forEach(([k,v])=>{const [P,Sv,I]=k.split("|");delete t[k];if(cadBaseDe(D,tipo,P,Sv,I)!==v)t[k]=v});if(!Object.keys(t).length)delete D.t[tipo];
        (S.cat.obras||[]).filter(c=>c[3]===tipo).forEach(c=>{const s=afet.get(c[0])||new Set();Object.values(m).forEach(v=>s.add(v));afet.set(c[0],s)})});
      Object.entries(C.o).forEach(([o,m])=>{const c=S.catMap.get(o);const tipo=(c&&c[3])||(C.oTipo||{})[o]||"";const ex=D.o[o]=D.o[o]||{};
        Object.entries(m).forEach(([k,v])=>{const [P,Sv,I]=k.split("|");delete ex[k];const cur=ex[`*|${Sv}|${I}`]||cadBaseDe(D,tipo,P,Sv,I);if(cur!==v)ex[k]=v});if(!Object.keys(ex).length)delete D.o[o];
        const s=afet.get(o)||new Set();Object.values(m).forEach(v=>s.add(v));afet.set(o,s)});
      D.atualizadoEm=em;D.editadoEm=em;D.editadoPor=por;await S.db.doc("regras/depara").set(D);S.dpR=D;
      const ao=cadClone(S.areasObra)||{};afet.forEach((novas,id)=>{const c=S.catMap.get(id);if(c)ao[id]=cadAreasObra(id,c[3],ao[id]||[],[...novas])});
      await S.db.doc("restrito/areasobra").set({m:ao,aba:"Cadastros",arquivo:"Cadastros no app",atualizadoEm:em});S.areasObra=ao;
      if(S.cur){applyRules(S.cur);renderGrid()}feito.push(`${nT+nO} regra(s) de quem planeja`);C.t={};C.o={}}
    /* 3) gerentes: mesmo caminho da planilha (aba 3) */
    if(C.gerDirty){msg.textContent="Gravando gerentes e liberando acessos…";const linhas=C.ger.map(({sug,orig,...r})=>({...r}));
      await S.db.doc("restrito/cad_gerentes").set({linhas,atualizadoEm:em,por});C.gerDoc={linhas,atualizadoEm:em,por};
      await carregarAcessos(cadGerAoa(),"Cadastros no app");C.gerMsg=($("#pl-msg")&&$("#pl-msg").textContent)||"";C.gerOrigem=`Cadastro salvo em ${fmtDate(em)} por ${por}.`;C.gerDirty=false;feito.push("gerentes")}
    msg.textContent="";$("#cad-imp-res").hidden=true;C.pend=null;C.cfAberto=null;toast("Salvo: "+feito.join(" · "));$("#cad-msg").textContent=`Salvo em ${fmtDate(em)}: ${feito.join(" · ")}.${C.gerMsg?" "+C.gerMsg:""}`;C.gerMsg="";
  }catch(e){msg.textContent="Não foi possível salvar: "+(e&&e.message||e)+". O que já foi gravado está indicado acima."; if(feito.length)$("#cad-msg").textContent="Gravado antes do erro: "+feito.join(" · ")}
  btn.disabled=false;cadMostrar(C.aba)}
function cadDescartar(){const b=$("#cad-desc");if(!b.dataset.arm){b.dataset.arm=1;b.textContent="Confirmar descartar";setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent="Descartar"}},5000);return}
  delete b.dataset.arm;b.textContent="Descartar";const aba=S.cad.aba;S.cad=cadNovo();S.cad.aba=aba;abrirCadastros()}

/* ---------- eventos ---------- */
{const tc=$("#tab-cad");if(tc)tc.addEventListener("click",async()=>{await flush();showTab("cad")})}
document.addEventListener("click",async e=>{const t=e.target;if(!t.closest||!t.closest("#v-cad"))return;const C=S.cad;
  const sub=t.closest("#cad-sub button");if(sub){cadMostrar(sub.dataset.cad);return}
  if(t.id==="cad-salvar"){cadSalvar();return}if(t.id==="cad-desc"){cadDescartar();return}
  let b=t.closest("[data-co-inat]");if(b){const id=b.dataset.coInat;cadSetInat(id,!cadObraEstado(cadObraDe(id)).inat);cadRenderObras();return}
  if(t.id==="co-all"){(C.coVis||[]).slice(0,800).forEach(id=>t.checked?C.sel.add(id):C.sel.delete(id));cadRenderObras();return}
  const lote=t.dataset&&t.dataset.coLote;if(lote){const ids=[...C.sel];const rv=$("#co-lote-reg").value;
    ids.forEach(id=>{if(lote==="ativar")cadSetInat(id,false);if(lote==="inativar")cadSetInat(id,true);if(lote==="fora")cadSetFora(id,"fora");if(lote==="pausa")cadSetFora(id,"pausa");if(lote==="app")cadSetFora(id,"");if(lote==="reg")cadSetReg(id,rv)});
    if(lote==="limpar")C.sel.clear();cadRenderObras();return}
  if(t.id==="cn-add"){cadNovaObra();return}
  if(t.id==="cq-trocar"){cadTrocar();return}
  if(t.id==="cadg-add"){C.ger.unshift({dep:$("#cadg-dep").value||"",emp:$("#cadg-emp").value||"",obra:"Todas",nome:"",email:"",cargo:"",obs:"com Claude",reg:"",regNome:"",regEmail:""});C.gerDirty=true;$("#cadg-q").value="";$("#cadg-pend").checked=false;cadRenderGer();const f=document.querySelector('#cadg-tbl [data-k="nome"]');if(f)f.focus();return}
  b=t.closest("[data-cg-sug]");if(b){const r=C.ger[+b.dataset.cgSug];if(r&&r.sug){Object.assign(r,r.sug);delete r.sug;C.gerDirty=true;cadRenderGer()}return}
  if(t.id==="cadg-sugs"){C.ger.forEach(r=>{if(r.sug&&!r.email){Object.assign(r,r.sug);delete r.sug}});C.gerDirty=true;cadRenderGer();return}
  b=t.closest("[data-cg-dup]");if(b){const i=+b.dataset.cgDup;C.ger.splice(i+1,0,{...C.ger[i]});C.gerDirty=true;cadRenderGer();return}
  b=t.closest("[data-cg-del]");if(b){if(!b.dataset.arm){b.dataset.arm=1;b.textContent="Excluir?";setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent="✕"}},4000);return}C.ger.splice(+b.dataset.cgDel,1);C.gerDirty=true;cadRenderGer();return}
  if(t.id==="cadg-xlsx"){if(typeof XLSX==="undefined"||!S.dl){toast("Excel indisponível nesta visualização");return}const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(cadGerAoa()),"3. Gerentes");
    await S.dl.save({filename:`CADASTRO_GERENTES_${new Date().toISOString().slice(0,10)}.xlsx`,data:new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx"}))});return}
});
document.addEventListener("change",async e=>{const t=e.target;if(!t.closest||!t.closest("#v-cad"))return;const C=S.cad;
  if(t.dataset.coSel){t.checked?C.sel.add(t.dataset.coSel):C.sel.delete(t.dataset.coSel);$("#co-selbar").hidden=!C.sel.size;$("#co-seln").textContent=`${C.sel.size} marcada(s)`;return}
  if(t.dataset.coPlan!=null){cadSetFora(t.dataset.coPlan,t.value);cadRenderObras();return}
  if(t.dataset.coReg!=null){cadSetReg(t.dataset.coReg,t.value);t.closest("tr").classList.add("cad-mud");cadBarra();return}
  if(["co-emp","co-st"].includes(t.id)){cadRenderObras();return}
  if(t.id==="cq-base"){$("#cq-obra").value="";cadQuemPrep();return}if(["cq-obra","cq-area"].includes(t.id)){cadRenderQuem();return}
  if(t.dataset.cq){cadSetQuem(t.dataset.cq,t.value);cadRenderQuem();return}
  if(["cadg-dep","cadg-emp","cadg-pend"].includes(t.id)){cadRenderGer();return}
  if(t.dataset.cg!=null){const r=C.ger[+t.dataset.cg];const k=t.dataset.k;
    if(k==="link"){const o=String(r.obs||"").replace(/\s*com\s*claude\s*/ig," ").replace(/\s*sem\s*claude\s*/ig," ").trim();r.obs=t.checked?(o?o+" · com Claude":"com Claude"):o}
    else{r[k]=t.value.trim();if(k==="emp")r.obra="Todas"}C.gerDirty=true;
    if(k==="emp"||k==="dep"||k==="obra"||k==="email")cadRenderGer();else cadBarra();return}
  if(t.id==="cad-imp-file"){const fs=[...t.files];t.value="";if(!fs.length)return;if(typeof XLSX==="undefined"){toast("O leitor de Excel não carregou. Recarregue a página.");return}
    try{await cadImportar(fs)}catch(err){$("#cad-imp-res").hidden=false;$("#cad-imp-res").textContent="Não consegui ler: "+(err&&err.message||err)}return}
  if(t.id==="cadg-file"){const f=t.files[0];t.value="";if(!f)return;if(typeof XLSX==="undefined"){toast("O leitor de Excel não carregou. Recarregue a página.");return}
    try{const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});const nm=wb.SheetNames.find(n=>/^\s*3\.?\s*gerentes/i.test(n))||wb.SheetNames.find(n=>/gerentes/i.test(n));if(!nm)throw new Error("aba");
      const L=cadGerDaPlanilha(XLSX.utils.sheet_to_json(wb.Sheets[nm],{header:1,defval:""}));C.ger=L;C.gerDirty=true;C.gerOrigem=`Importado de ${f.name} (aba ${nm}): ${L.length} linha(s). Confira e clique em Salvar para aplicar.`;cadRenderGer()}
    catch(err){$("#cadg-origem").textContent=err&&err.message==="aba"?"Não encontrei a aba 3. Gerentes nessa planilha.":err&&err.message==="cols"?"A aba 3 não tem as colunas Departamento (quem planeja), Empresa, Obra e E-mail.":"Não consegui ler a planilha."}}
});
document.addEventListener("input",e=>{const t=e.target;if(t.id==="co-q")cadRenderObras();if(t.id==="cq-q")cadRenderQuem();if(t.id==="cadg-q")cadRenderGer();
  if(t.dataset&&t.dataset.cg!=null&&t.tagName==="INPUT"&&t.type!=="checkbox"&&S.cad){S.cad.ger[+t.dataset.cg][t.dataset.k]=t.value.trim();S.cad.gerDirty=true;cadBarra()}});
window.addEventListener("beforeunload",e=>{if(cadSujo()){e.preventDefault();e.returnValue=""}});
