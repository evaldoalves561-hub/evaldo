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
function cadNovo(){return {foraA:new Map(),aba:S.cad?S.cad.aba:"pend",pend:null,sit:null,nomes:new Map(),extraDec:new Map(),cat:new Map(),fora:new Map(),reg:new Map(),novas:[],t:{},o:{},ger:null,gerDirty:false,sel:new Set(),gerDoc:null,gerOrigem:"",gerMsg:"",aoNovas:{},estr:null}}
const cadAO=()=>({...(S.areasObra||{}),...((S.cad&&S.cad.aoNovas)||{})});
function cadSujo(){const C=S.cad;if(!C)return 0;return C.cat.size+C.nomes.size+C.fora.size+C.reg.size+C.novas.length+Object.values(C.t).reduce((a,m)=>a+Object.keys(m).length,0)+Object.values(C.o).reduce((a,m)=>a+Object.keys(m).length,0)+(C.gerDirty?1:0)+(C.estr?1:0)+(C.foraA?C.foraA.size:0)}

async function abrirCadastros(){
  const v=$("#v-cad");if(!v)return;S.cad=S.cad||cadNovo();$("#cad-msg").textContent="Carregando cadastros…";
  await loadCat();
  const ler=async p=>{const d=await S.db.doc(p).get();return d.exists?d.data():null};/* erro de leitura interrompe: nunca abrir com listas vazias por falha de rede */
  const [ao,fo,ro,pp,cg,rv]=await Promise.all([ler("restrito/areasobra"),ler("regras/fora_app"),ler("regras/regional_obra"),ler("restrito/pessoas"),ler("restrito/cad_gerentes"),ler("restrito/cad_resolvidas")]);S.cad.resolv=rv||{itens:[]};
  S.areasObra=(ao&&ao.m)||{};S.foraApp=(fo&&fo.m)||{};S.regObra=(ro&&ro.m)||null;S.pessoas=(pp&&pp.lista)||[];
  const C=S.cad;C.gerDoc=cg;
  if(!C.ger){if(cg&&Array.isArray(cg.linhas)){C.ger=cg.linhas.map(r=>({...r}));C.gerBase=cg.linhas.map(r=>({...r}));C.gerOrigem=`Cadastro salvo em ${fmtDate(cg.atualizadoEm)}${cg.por?" por "+cg.por:""}.`}
    else{C.ger=cadGerDosAcessos();C.gerBase=C.ger.map(r=>({...r}));C.gerOrigem=C.ger.length?"Lista montada a partir dos acessos já liberados. Para trazer também os Gerentes Regionais, importe a aba 3 da planilha uma vez.":"Nenhum gerente cadastrado ainda. Importe a aba 3 da planilha ou inclua linha por linha."}}
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
      const usaTodas=todas.length>1&&todas.every(id=>ids.has(id));if(usaTodas)out.push({...base,obra:"Todas"});/* obras fora do "Todas" (depto sem insumo na base) continuam como linha própria: nenhum acesso se perde */
      [...ids].filter(id=>!usaTodas||!todas.includes(id)).sort(cadNum).forEach(id=>{const c=S.catMap.get(id);out.push({...base,obra:c?String(c[1]):id.split("-").slice(1).join("-"),reg:(S.regObra&&S.regObra[id])||""})})})});
  return out}

function cadMostrar(aba){const C=S.cad;C.aba=aba;
  document.querySelectorAll("#cad-sub button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.cad===aba)));
  ["pend","obras","quem","ger"].forEach(k=>{$("#cad-"+k).hidden=k!==aba});$("#cad-kpi").hidden=aba==="pend";
  {const tp=$("#tab-pend"),tc=$("#tab-cad");if(tp&&S.tab==="cad"){tp.setAttribute("aria-selected",String(aba==="pend"));tc.setAttribute("aria-selected",String(aba!=="pend"))}}
  if(aba==="pend"){$("#cp-list").innerHTML='<p class="muted">Procurando obras novas na estrutura…</p>';cadPendPrep().then(cadRenderPend).catch(e=>{$("#cp-list").textContent="Não foi possível montar as pendências: "+(e.message||e)})}
  if(aba==="obras")cadRenderObras();if(aba==="quem")cadQuemPrep();if(aba==="ger"){const g=$("#cadg-grupos");if(g&&!S.cad._ger0){S.cad._ger0=1;g.innerHTML='<p class="muted">Montando a lista de gerentes por empresa (alguns segundos só na primeira vez)…</p>';setTimeout(cadRenderGer,40)}else cadRenderGer()}cadBarra()}
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
function cadRenderObras(){const C=S.cad;const cats=(S.cat.obras||[]).concat(C.novas);const CG=cadCobGer();const AO=CG.AO;const COB=cadCobertura();
  const linhas=cats.map(c=>{const e=cadObraEstado(c);const areas=AO[c[0]]||[];const m=COB.get(c[0])||new Map();const fm=(S.foraApp||{})[c[0]]||{};
    const semGer=e.inat||e.fora?[]:areas.filter(a=>!CG.cov.has(c[0]+"|"+a)&&!cadAreaFora(c[0],a));const pes=new Set([...m.values()].flatMap(s=>[...s]));return {c,...e,areas,semGer,pes:pes.size,nova:C.novas.includes(c)}});
  const tot=linhas.length,at=linhas.filter(x=>!x.inat),fo=at.filter(x=>x.fora),pa=at.filter(x=>x.fora==="pausa"),sg=at.filter(x=>x.semGer.length),sr=at.filter(x=>!x.reg);
  $("#cad-kpi").innerHTML=cadKpi("Empresas/obras",cadN(tot),`${cadEmpresas().length} empresas`)+cadKpi("Ativas",cadN(at.length),`${cadN(tot-at.length)} inativas`)+cadKpi("Planejam no app",cadN(at.length-fo.length),`${cadN(fo.length-pa.length)} fora do app · ${cadN(pa.length)} pausada(s)`)+cadKpi("Sem gerente em alguma área",`<span style="color:${sg.length?"var(--bad)":"var(--good)"}">${cadN(sg.length)}</span>`,"obras ativas no app")+cadKpi("Sem Regional",cadN(sr.length),"obras ativas");
  C.coF=C.coF||{emp:new Set(),reg:new Set()};const fR=C.coF.reg,fE=C.coF.emp;const regDeX=x=>x.reg||"Sem Regional";
  const q=semAc($("#co-q").value||"").trim(),st=$("#co-st").value;
  cadCmsSync(linhas,regDeX);
  const F=linhas.filter(x=>(!fE.size||fE.has(String(x.c[6])))&&(!fR.size||fR.has(regDeX(x)))&&(!q||semAc(`${x.c[0]} ${x.c[2]} ${x.c[7]} ${x.reg}`).includes(q))&&
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
    <td>${x.areas.length?x.areas.map(a=>{const fo=cadAreaFora(id,a);return `<button type="button" class="cad-chip cf-chip${x.semGer.includes(a)?" bad":""}" data-co-area="${esc(id)}|${esc(a)}" style="${fo?"text-decoration:line-through;opacity:.6":""}" title="${fo?"Fora do app — clique para voltar a planejar no app":(x.semGer.includes(a)?"Sem gerente. ":"")+"Clique para marcar esta área como fora do app"}">${esc(AREA_CURTA&&AREA_CURTA[a]||a)}${fo?" · fora":""}</button>`}).join(""):'<span class="muted">sem regra</span>'}</td>
    <td class="num">${x.pes||'<span style="color:var(--bad)">0</span>'}</td></tr>`}).join("")}</tbody>`;
  {const sa=$("#co-lote-area");if(sa&&!sa.options.length)sa.innerHTML=cadOpts(cadAreas().map(a=>[a,a]),"","— área —")}
  $("#co-selbar").hidden=!C.sel.size;$("#co-seln").textContent=`${C.sel.size} marcada(s)`;cadBarra()}
/* 28/10: filtros de várias escolhas (Regional e Empresa) em Empresas e obras, no mesmo estilo dos filtros do Orçamento */
function cadCmsSync(linhas,regDeX){const C=S.cad;const F=C.coF;const nome=new Map(cadEmpresas());
  const conta=(f)=>{const m=new Map();linhas.forEach(x=>{const k=f(x);m.set(k,(m.get(k)||0)+1)});return m};
  const regs=conta(regDeX);const emps=conta(x=>F.reg.size&&!F.reg.has(regDeX(x))?null:String(x.c[6]));emps.delete(null);
  C.cmsOpts={reg:[...regs.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR")).map(([k,n])=>[k,k,n]),emp:[...emps.entries()].sort((a,b)=>cadNum(a[0],b[0])).map(([k,n])=>[k,`${k} – ${nome.get(k)||""}`,n])};
  document.querySelectorAll("#cad-obras .cms").forEach(b=>cadCmsDesenha(b))}
function cadCmsDesenha(b){const C=S.cad;const k=b.dataset.cms;const sel=C.coF[k];const opts=(C.cmsOpts||{})[k]||[];const q=semAc((b.querySelector(".sl-q")||{}).value||"").trim();
  const vis=opts.filter(([v,lb])=>!q||semAc(lb).includes(q));
  b.querySelector(".sl-list").innerHTML=vis.slice(0,1500).map(([v,lb,n])=>`<label class="sl-it${sel.has(v)?" on":""}"><input type="checkbox" data-cmsv="${esc(v)}"${sel.has(v)?" checked":""}><span>${esc(lb)}</span><span class="muted">${n}</span></label>`).join("")||'<p class="muted" style="font-size:12px;margin:6px">Nada encontrado.</p>';
  b.querySelector(".sl-n").textContent=`${vis.length} de ${opts.length}`;
  const ss=[...sel];b.querySelector(".sl-txt").textContent=!ss.length?"Todas":ss.length===1?((opts.find(o=>o[0]===ss[0])||[,ss[0]])[1]):`${ss.length} selecionadas`;b.classList.toggle("ativo",!!ss.length)}
document.addEventListener("click",e=>{const t=e.target;const b=t.closest&&t.closest(".cms");if(!b||!S.cad)return;const C=S.cad;C.coF=C.coF||{emp:new Set(),reg:new Set()};const k=b.dataset.cms;
  if(t.closest(".sl-btn")){const pop=b.querySelector(".sl-pop");const ab=pop.hidden;document.querySelectorAll(".sl-pop").forEach(x=>x.hidden=true);pop.hidden=!ab;if(ab){cadCmsDesenha(b);const q=b.querySelector(".sl-q");if(q)q.focus()}return}
  const a=t.dataset&&t.dataset.cmsa;if(a){const q=semAc(b.querySelector(".sl-q").value||"").trim();if(a==="limpar")C.coF[k].clear();else((C.cmsOpts||{})[k]||[]).filter(([v,lb])=>!q||semAc(lb).includes(q)).forEach(([v])=>C.coF[k].add(v));
    if(k==="reg")C.coF.emp.clear();cadRenderObras();return}});
document.addEventListener("change",e=>{const t=e.target;if(!t.dataset||t.dataset.cmsv==null||!S.cad)return;const b=t.closest(".cms");const k=b.dataset.cms;const C=S.cad;
  t.checked?C.coF[k].add(t.dataset.cmsv):C.coF[k].delete(t.dataset.cmsv);if(k==="reg")C.coF.emp.forEach(v=>{});cadRenderObras()});
document.addEventListener("input",e=>{const t=e.target;if(!t.classList||!t.classList.contains("sl-q"))return;const b=t.closest(".cms");if(b&&S.cad)cadCmsDesenha(b)});
function cadObraDe(id){return S.catMap.get(id)||S.cad.novas.find(c=>c[0]===id)}
function cadSetInat(id,v){const c=cadObraDe(id);if(!c)return;if((c[8]===1)===v)S.cad.cat.delete(id);else S.cad.cat.set(id,v)}
/* 28/10: fora do app por ÁREA (quem planeja), valendo em todas as telas: Empresas e obras, Falta preencher, Gerentes, Indicadores */
function cadAreaFora(id,a){const C=S.cad;const k=id+"|"+a;if(C&&C.foraA&&C.foraA.has(k))return C.foraA.get(k);const fm=(S.foraApp||{})[id]||{};return !!fm[a]}
function cadSetAreaFora(id,a,v){const C=S.cad;const k=id+"|"+a;const fm=(S.foraApp||{})[id]||{};if(!!fm[a]===!!v)C.foraA.delete(k);else C.foraA.set(k,!!v)}
/* quem cobre cada obra × área pelo cadastro de gerentes (mesma regra em todas as telas) */
function cadCobGer(){const C=S.cad;const GX=cadGOctx();const cov=new Set();C.ger.forEach(r=>{if(!r.dep||!cadValido(r.email))return;cadGerObras(r,GX).forEach(id=>cov.add(id+"|"+r.dep))});return {cov,AO:GX.AO}}
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
/* contexto calculado uma vez por varredura (desempenho): mesmo resultado, sem recopiar catálogo e áreas a cada linha */
function cadGOctx(){const cats=(S.cat.obras||[]).concat(S.cad.novas);const byEmp=new Map();cats.forEach(c=>{const k=String(c[6]);if(!byEmp.has(k))byEmp.set(k,[]);byEmp.get(k).push(c[0])});return {cats,AO:cadAO(),byEmp}}
function cadGerObras(r,X){const cats=X?X.cats:(S.cat.obras||[]).concat(S.cad.novas);const AO=X?X.AO:cadAO();const e=String(r.emp||"").trim(),o=String(r.obra||"").trim();
  if(!e||!o)return [];let ids=cadTodas(e)?cats.map(c=>c[0]):cadTodas(o)?(X?(X.byEmp.get(e)||[]).slice():cats.filter(c=>String(c[6])===e).map(c=>c[0])):(cadObraDe(e+"-"+o)?[e+"-"+o]:[]);
  if((cadTodas(e)||cadTodas(o))&&r.dep)ids=ids.filter(id=>(AO[id]||[]).includes(r.dep));return ids}
let _cgsCtx=null;/* desempenho: contexto calculado uma vez por tela */
function cadGerStatus(r){const X=_cgsCtx||{GX:cadGOctx(),EM:new Set(cadEmpresas().map(x=>x[0]))};const em=String(r.email||"").trim();const e=String(r.emp||"").trim(),o=String(r.obra||"").trim();
  if(!r.dep)return["reaberto","Falta o departamento",0];if(!e||!o)return["reaberto","Falta empresa/obra",0];
  if(!cadTodas(e)&&!X.EM.has(e))return["reaberto","Empresa não encontrada",0];
  if(!cadTodas(e)&&!cadTodas(o)&&!cadObraDe(e+"-"+o))return["reaberto","Obra não encontrada",0];
  const n=cadGerObras(r,X.GX).length;if(!em)return["vazio","Sem e-mail (não libera)",n];if(!CAD_EMAIL.test(em.toLowerCase()))return["reaberto","E-mail inválido",n];
  if(!n)return["rascunho","Nenhuma obra com itens desta área",0];
  if(!cadTodas(e)&&!cadTodas(o)&&!(cadAO()[e+"-"+o]||[]).includes(r.dep))return["rascunho","Obra sem itens desta área",n];
  return["enviado","ok",n]}
const cadLink=r=>/com\s*claude/i.test(String(r.obs||""));
function cadGerFiltradas(){const q=semAc($("#cadg-q").value||"").trim(),dep=$("#cadg-dep").value,emp=$("#cadg-emp").value,pend=$("#cadg-pend").checked;
  return S.cad.ger.map((r,i)=>[r,i]).filter(([r])=>(!q||semAc(`${r.nome} ${r.email} ${r.cargo} ${r.regNome}`).includes(q))&&(!dep||r.dep===dep)&&(!emp||String(r.emp)===emp)&&(!pend||((S.cad._stc&&S.cad._stc.get(r))?S.cad._stc.get(r).v:cadGerStatus(r))[1]!=="ok"))}
function cadRenderGer(){const emps0=cadEmpresas();_cgsCtx={GX:cadGOctx(),EM:new Set(emps0.map(x=>x[0]))};try{cadRenderGer0(emps0)}finally{_cgsCtx=null}}
function cadRenderGer0(emps){const C=S.cad;const R=C.ger;const ar=cadAreas();
  /* desempenho: status e cobertura só são recalculados quando a linha (ou o cadastro) muda */
  const sgk=r=>[r.dep,r.emp,r.obra,r.email,r.regEmail].map(v=>String(v==null?"":v)).join("\u0001");C._stc=C._stc||new WeakMap();
  const sigs=R.map(sgk);const allSig=sigs.join("\n")+"|"+(S.cat.obras||[]).length+"|"+C.novas.length+"|"+C.fora.size+"|"+C.cat.size;{const g=(S.cat.obras||[]).length+"|"+C.novas.length+"|"+Object.keys(C.aoNovas||{}).length;if(C._stcG!==g){C._stcG=g;C._stc=new WeakMap()}}
  const st=R.map((r,i)=>{const c=C._stc.get(r);if(c&&c.sig===sigs[i])return c.v;const v=cadGerStatus(r);C._stc.set(r,{sig:sigs[i],v});return v});const pes=new Set(R.filter(r=>CAD_EMAIL.test(String(r.email||"").trim().toLowerCase())).map(r=>r.email.trim().toLowerCase()));
  const link=new Set(R.filter(r=>cadLink(r)&&r.email).map(r=>r.email.trim().toLowerCase()));const prob=st.filter(s=>s[1]!=="ok").length;
  let falta=0;if(C._faltaSig===allSig)falta=C._falta;else{const cob=new Set();const GX=_cgsCtx.GX;R.forEach((r,i)=>{if(st[i][0]==="reaberto"||!r.email)return;cadGerObras(r,GX).forEach(id=>cob.add(id+"|"+r.dep))});
  (S.cat.obras||[]).concat(C.novas).forEach(c=>{const e=cadObraEstado(c);if(e.inat||e.fora)return;(GX.AO[c[0]]||[]).forEach(a=>{if(!cadAreaFora(c[0],a)&&!cob.has(c[0]+"|"+a))falta++})});C._faltaSig=allSig;C._falta=falta}
  $("#cad-kpi").innerHTML=cadKpi("Pessoas com e-mail",cadN(pes.size),`${R.length} linha(s) no cadastro`)+cadKpi("Acessam pelo link",cadN(link.size),`${cadN(pes.size-link.size)} recebem formulário offline`)+cadKpi("Departamentos",cadN(new Set(R.map(r=>r.dep).filter(Boolean)).size),"quem planeja")+cadKpi("Linhas com pendência",`<span style="color:${prob?"var(--warn)":"var(--good)"}">${cadN(prob)}</span>`,"veja a coluna Situação")+cadKpi("Áreas de obra sem gerente",`<span style="color:${falta?"var(--bad)":"var(--good)"}">${cadN(falta)}</span>`,"obras ativas no app");
  const sd=$("#cadg-dep"),se=$("#cadg-emp");const dv=sd.value,ev=se.value;sd.innerHTML=cadOpts(ar.map(a=>[a,a]),dv,"Todos os departamentos");se.innerHTML=cadOpts(emps.map(([e,n])=>[e,`${e} – ${n}`]),ev,"Todas as empresas");
  $("#cadg-origem").textContent=C.gerOrigem||"";{const ns=R.filter(r=>r.sug&&!r.email).length;const bs=$("#cadg-sugs");bs.hidden=!ns;bs.textContent=`Usar as ${ns} sugestões`}
  const F=cadGerFiltradas();
  const empOpts=sel=>`<option value="Todas"${cadTodas(sel)?" selected":""}>Todas</option>`+(sel&&!cadTodas(sel)&&!emps.some(x=>x[0]===String(sel))?`<option selected>${esc(sel)}</option>`:"")+cadOpts(emps.map(([e,n])=>[e,`${e} – ${n}`]),sel);
  const obraOpts=(e,sel)=>{const L=cadTodas(e)?[]:(S.cat.obras||[]).concat(C.novas).filter(c=>String(c[6])===String(e)).sort((a,b)=>cadNum(a[1],b[1]));
    return `<option value="Todas"${cadTodas(sel)?" selected":""}>Todas</option>`+(sel&&!cadTodas(sel)&&!L.some(c=>String(c[1])===String(sel))?`<option selected>${esc(sel)}</option>`:"")+cadOpts(L.map(c=>[c[1],`${c[1]} – ${c[2]||""}`]),sel)};
  const inp=(i,k,v,ph,w)=>`<input class="cad-in" data-cg="${i}" data-k="${k}" value="${esc(v||"")}" placeholder="${ph||""}" style="width:${w||140}px" aria-label="${ph||k}">`;
  const TH=`<thead><tr><th>Departamento (quem planeja)</th><th>Empresa</th><th>Obra</th><th>Nome do gerente</th><th>E-mail</th><th>Cargo</th><th title="Marcado = acessa pelo link do aplicativo (“com Claude”). Desmarcado = recebe o formulário offline">Usa o app</th><th>Regional</th><th>Gerente Regional</th><th>E-mail do Regional</th><th>Situação</th><th></th></tr></thead>`;
  const row=([r,i])=>{const s=st[i];
    return `<tr data-row="${i}"><td><select class="cad-in" data-cg="${i}" data-k="dep" aria-label="Departamento">${r.dep&&!ar.includes(r.dep)?`<option>${esc(r.dep)}</option>`:""}${cadOpts(ar.map(a=>[a,a]),r.dep,"— escolha —")}</select></td>
    <td><input class="cad-in" data-cg="${i}" data-k="emp" value="${esc(r.emp||"")}" list="cadg-dl-emp" style="width:90px" aria-label="Empresa" title="${esc((emps.find(x=>x[0]===String(r.emp))||[,""])[1])}"></td><td><input class="cad-in" data-cg="${i}" data-k="obra" value="${esc(r.obra||"")}" list="cadg-dl-o-${esc(String(r.emp||""))}" style="width:90px" aria-label="Obra" title="${esc(cadTodas(r.obra)?"todas as obras da empresa":((cadObraDe(String(r.emp)+"-"+String(r.obra))||[])[2]||""))}"></td>
    <td>${inp(i,"nome",r.nome,"Nome",150)}</td><td>${inp(i,"email",r.email,r.sug&&!r.email?"sugestão: "+r.sug.email:"nome@empresa.com.br",200)}</td><td>${inp(i,"cargo",r.cargo,"Cargo",120)}</td>
    <td style="text-align:center"><input type="checkbox" data-cg="${i}" data-k="link"${cadLink(r)?" checked":""} aria-label="Usa o app pelo link"></td>
    <td>${inp(i,"reg",r.reg,"Regional",110)}</td><td>${inp(i,"regNome",r.regNome,"Nome",130)}</td><td>${inp(i,"regEmail",r.regEmail,"e-mail",170)}</td>
    <td class="cad-st"><span class="pill ${s[0]}">${esc(s[1])}</span>${s[2]?` <span class="muted" style="font-size:11px">${s[2]} obra(s)</span>`:""}${r.sug&&!r.email?`<div class="cad-sug">Sugestão: ${esc(r.sug.nome||r.sug.email)} <button class="btn sm" data-cg-sug="${i}">Usar</button></div>`:""}</td>
    <td style="white-space:nowrap"><button class="btn sm" data-cg-dup="${i}" title="Duplicar linha" aria-label="Duplicar linha">⧉</button> <button class="btn sm danger" data-cg-del="${i}" title="Excluir linha" aria-label="Excluir linha">✕</button></td></tr>`};
  /* 28/10: agrupado por empresa, como em Pendências */
  const GR=new Map();F.forEach(x=>{const e=String(x[0].emp||"");if(!GR.has(e))GR.set(e,[]);GR.get(e).push(x)});
  C.cgEmpAb=C.cgEmpAb||new Set();const auto=GR.size<=3;const enome=new Map(emps);
  const ord=[...GR.keys()].sort((a,b)=>(a?1:0)-(b?1:0)||(cadTodas(b)?1:0)-(cadTodas(a)?1:0)||cadNum(a,b));const SHOWN=[];
  $("#cadg-n").textContent=`${cadN(F.length)} de ${cadN(R.length)} linha(s) em ${cadN(GR.size)} empresa(s)`;
  $("#cadg-grupos").innerHTML=F.length?ord.map(e=>{const L=GR.get(e);const ab=auto||!e||C.cgEmpAb.has(e);if(ab)SHOWN.push(...L);
    const pend=L.filter(([r,i])=>st[i][1]!=="ok").length;const porDep=new Map();L.forEach(([r])=>{if(!r.dep)return;const n=r.nome||r.email;if(!n)return;const S0=porDep.get(r.dep)||new Set();S0.add(n);porDep.set(r.dep,S0)});
    const resumo=[...porDep.entries()].sort((a,b)=>a[0].localeCompare(b[0],"pt-BR")).map(([d,S0])=>`<span class="cad-chip" title="${esc([...S0].join(", "))}">${esc(d)}: ${esc([...S0].slice(0,2).join(", "))}${S0.size>2?` +${S0.size-2}`:""}</span>`).join("");
    const tit=!e?"Sem empresa (linhas novas)":cadTodas(e)?"Todas as empresas":`<span class="cad-cod">${esc(e)}</span> <b>${esc(enome.get(e)||"")}</b>`;
    return `<section class="cp-emp"><button type="button" class="cp-emp-h" data-cg-emp="${esc(e)}" aria-expanded="${ab}"><b>${ab?"▾":"▸"}</b>${tit}<span class="muted">· ${L.length} linha(s)${pend?` · <span style="color:var(--warn)">${pend} com pendência</span>`:""}</span></button>
      <div style="padding:0 12px 6px;display:flex;flex-wrap:wrap;gap:2px">${resumo}</div>${ab?`<div class="tbl-box"><table class="list">${TH}<tbody>${L.map(row).join("")}</tbody></table></div>`:""}</section>`}).join(""):`<p class="muted">Nenhuma linha com esses filtros.</p>`;
  {const vis=[...new Set(SHOWN.map(([r])=>String(r.emp||"")).filter(e=>e&&!cadTodas(e)))];const byE=new Map();(S.cat.obras||[]).concat(C.novas).forEach(c=>{const k=String(c[6]);if(!vis.includes(k))return;(byE.get(k)||byE.set(k,[]).get(k)).push(c)});
    let dl=$("#cadg-dls");if(!dl){dl=document.createElement("div");dl.id="cadg-dls";dl.hidden=true;$("#cadg-grupos").after(dl)}
    dl.innerHTML=`<datalist id="cadg-dl-emp"><option value="Todas">${emps.map(([e,n])=>`<option value="${esc(e)}">${esc(n)}</option>`).join("")}</datalist>`+vis.map(e=>`<datalist id="cadg-dl-o-${esc(e)}"><option value="Todas">${(byE.get(e)||[]).sort((a,b)=>cadNum(a[1],b[1])).map(c=>`<option value="${esc(c[1])}">${esc(c[2]||"")}</option>`).join("")}</datalist>`).join("")}
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
const CAD_NING="-";
const cadLimpo=v=>String(v==null?"":v).replace(/\s+/g," ").trim();
const cadChave=v=>semAc(cadLimpo(v)).toUpperCase().replace(/[^A-Z0-9]/g,"");
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
  /* 28/10 (2): a estrutura também atualiza a situação das obras que já estão no app: fora da estrutura ou com todas as linhas inativas no ERP → inativa (só inativa; Pausada é sua e não muda) */
  let inEst=0,inSai=0;if(C.estr&&!C.sit){const E=C.estr.E;(S.cat.obras||[]).forEach(c=>{const id=c[0];const i=id.indexOf("-");const L=((E[id.slice(0,i)]||{})[id.slice(i+1)]);const ina=!L?"sai":L.every(x=>x[5]===1)?"inat":"";
      if(ina&&!(C.cat.has(id)?C.cat.get(id):c[8]===1)){cadSetInat(id,true);if(ina==="sai")inSai++;else inEst++}})}mud+=inEst+inSai;
  C.pend=null;await cadPendPrep();const P=[...C.pend.values()];
  out.innerHTML=`<b>Lido:</b> ${nomes.map(esc).join(" · ")}<br><b>${cadN(P.length)}</b> obra(s) nova(s) para confirmar${mud?` · <b>${cadN(mud)}</b> obra(s) do app ficam inativas${inSai||inEst?` (${cadN(inSai)} não estão mais na estrutura, ${cadN(inEst)} com tudo inativo no ERP)`:""}, para saírem dos Indicadores`:""}. <span class="muted">Nada foi gravado ainda: confirme abaixo e clique em <b>Salvar</b>.</span>`;
  cadMostrar("pend")}
const cadEstIdx=()=>(S.cad.estr&&S.cad.estr.idx)||S.estIdx||null;
async function cadEstObra(e,o){const C=S.cad;if(C.estr)return (C.estr.E[e]||{})[o]||[];const d=await estEmpresa(e);return (d&&d.o&&d.o[o])||[]}
/* lista de obras novas (calculada da estrutura, então não some se você fechar a página antes de confirmar) */
async function cadPendPrep(){const C=S.cad;if(C.pend)return;try{C.eu=String(await quemSou()).toLowerCase()}catch(e){C.eu=""}try{await cadRegTab()}catch(e){}if(!C.estr)await carregarEstIdx();const IX=cadEstIdx();C.pend=new Map();if(!IX||!IX.eo)return;
  const ids=Object.keys(IX.eo).filter(id=>!S.catMap.has(id)&&!(C.sit&&C.sit.get(id)===1));if(!ids.length)return;
  /* desempenho: busca a estrutura das empresas em paralelo (8 por vez) em vez de uma por uma */
  if(!C.estr){const emps=[...new Set(ids.map(id=>id.split("-")[0]))];for(let i=0;i<emps.length;i+=8)await Promise.all(emps.slice(i,i+8).map(e=>estEmpresa(e)))}
  const tipos=Object.keys(T.tipos||{});const TL={},TS={};tipos.forEach(tp=>{TL[tp]=cadLeaves(tp);TS[tp]=new Set(TL[tp].map(l=>l.S+"|"+l.I))});
  const cnt=new Map();tipos.forEach(tp=>TL[tp].forEach(l=>{const a=cadBaseDe(S.dpR||{},tp,l.P,l.S,l.I);if(!a)return;const k=l.S+"|"+l.I;const m=cnt.get(k)||{};m[a]=(m[a]||0)+1;cnt.set(k,m)}));
  /* referência extra: exceções por obra já gravadas (insumos fora do modelo em outras obras) e o mesmo serviço nos modelos */
  const add=(M,k,a)=>{const m=M.get(k)||{};m[a]=(m[a]||0)+1;M.set(k,m)};Object.values((S.dpR||{}).o||{}).forEach(m=>Object.entries(m||{}).forEach(([k,a])=>{if(!a||typeof a!=="string")return;const q=k.split("|");if(q.length>=3)add(cnt,q[1]+"|"+q[2],a)}));
  const cntS=new Map();cnt.forEach((m,k)=>{const sv=k.split("|")[0];Object.entries(m).forEach(([a,n])=>{const x=cntS.get(sv)||{};x[a]=(x[a]||0)+n;cntS.set(sv,x)})});
  const top=m=>{const e=Object.entries(m||{}).sort((a,b)=>b[1]-a[1])[0];return e?e[0]:""};
  const porObra={},porGrupo={};(S.cat.obras||[]).forEach(c=>{const bk=c[3]||"__erp";(porObra[c[1]]=porObra[c[1]]||{})[bk]=((porObra[c[1]]||{})[bk]||0)+1;if(!c[3])return;const g=IX.eo[c[0]]&&IX.eo[c[0]][3];if(g)(porGrupo[g]=porGrupo[g]||{})[c[3]]=((porGrupo[g]||{})[c[3]]||0)+1});
  C.pendCtx={TL,TS,cnt,cntS,top,tipos};
  for(const id of ids){let [en,reg,on,grupo,linhas]=IX.eo[id];en=cadLimpo(en);reg=cadLimpo(reg);on=cadLimpo(on);grupo=cadLimpo(grupo);const e=id.split("-")[0],o=id.slice(e.length+1);
    const L=await cadEstObra(e,o);const at=L.filter(x=>x[5]!==1);const si=new Set(at.map(x=>x[3]+"|"+x[4]));if(L.length&&!si.size)continue;/* todas as linhas inativas no ERP */
    let base="",motivo="",semBase=false;const so=cadSemProibidas(o,porObra[o]);if(so&&Object.keys(so).length){base=top(so);const n=Object.values(so).reduce((a,b)=>a+b,0);if(base==="__erp"){base="";semBase=true;motivo=`a mesma obra está sem base modelo em ${so.__erp} de ${n} empresa(s)`}else motivo=`mesma obra em ${so[base]} de ${n} empresa(s)`}
    else if(porGrupo[grupo]){base=top(porGrupo[grupo]);motivo=`${porGrupo[grupo][base]} obra(s) do grupo ${grupo} usam esta base`}
    else{let b="",best=0;tipos.forEach(tp=>{let n=0;si.forEach(k=>{if(TS[tp].has(k))n++});const sc=n/Math.max(1,TS[tp].size+si.size-n);if(sc>best){best=sc;b=tp}});if(best>=.3){base=b;motivo=`estrutura parecida com a base`}}
    const lin=new Map();at.forEach(x=>{const k=`${x[0]}|${x[3]}|${x[4]}`;if(!lin.has(k))lin.set(k,{key:k,P:x[0],S:x[3],I:x[4]})});
    const p={id,e,o,en,on,reg,grupo,linhas,si,lin:[...lin.values()],base,semBase,motivo,st:"",resp:{},extra:{},escolha:{}};{const LL=((C.resolv&&C.resolv.itens)||[]).filter(x=>x.id===id);const lg=LL.filter(x=>String(x.por||"").toLowerCase()===C.eu).pop()||LL.pop();if(lg){p.jaFeita=lg;if(lg.base==="ERP"){p.base="";p.semBase=true}else if(lg.base&&(T.tipos||{})[lg.base]){p.base=lg.base;p.semBase=false}if(lg.reg)p.reg=lg.reg;p.motivo=`já tinha sido confirmada por ${lg.por} em ${fmtDate(lg.em)}, mas não ficou gravada (salvamento ao mesmo tempo). Confira e confirme de novo`}};cadPendCalc(p);if(p.jaFeita)cadReaplicar(p);C.pend.set(id,p)}}
function cadParecido(p){const {TS}=S.cad.pendCtx;if(!p.base||!TS[p.base]||!p.si.size)return null;let n=0;p.si.forEach(k=>{if(TS[p.base].has(k))n++});return Math.round(100*n/p.si.size)}
/* áreas e responsáveis sugeridos para a base escolhida */
function cadPendCalc(p){const {TL,TS,cnt,cntS,top}=S.cad.pendCtx;const A={};let fora=0;
  if(p.base&&TL[p.base])TL[p.base].forEach(l=>{if(p.si.size&&!p.si.has(l.S+"|"+l.I))return;const r=ruleFor(p.base,l,p.id);const a=r&&r[1];if(a)A[a]=(A[a]||0)+1});
  const IX=cadEstIdx()||{};p.extras=[];p.lin.forEach(x=>{if(p.base&&TS[p.base]&&TS[p.base].has(x.S+"|"+x.I))return;const sI=top(cnt.get(x.S+"|"+x.I)),sS=sI?"":top(cntS.get(x.S));const sug=sI||sS;const dec=S.cad.extraDec.get(x.S+"|"+x.I);const a=p.escolha[x.key]!=null?p.escolha[x.key]:dec!=null?dec:sug;
    p.extras.push({...x,porSv:!!sS,d:cadLimpo((IX.dI||{})[x.I]||(IX.dS||{})[x.S]||""),sd:cadLimpo((IX.dS||{})[x.S]||""),sug,area:a});if(a&&a!==CAD_NING){A[a]=(A[a]||0)+1;fora++}});
  p.semArea=p.extras.filter(x=>!x.area).length;
  p.areas=A;p.fora=fora;p.parecido=cadParecido(p);
  const deps=[...new Set([CAD_GA,CAD_CTRL,...Object.keys(A)])];p.extra=p.extra||{};deps.forEach(d=>{if(!p.resp[d]||!p.resp[d].mexeu){const L=cadSugPessoas(d,p);p.resp[d]=L[0]||{nome:"",email:"",fonte:""};if(!(p.extra[d]||[]).some(x=>x.mexeu))p.extra[d]=L.slice(1)}});
  if(!p.resp._reg||!p.resp._reg.mexeu)p.resp._reg=cadSugRegional2(p)}
const cadValido=v=>CAD_EMAIL.test(String(v||"").trim().toLowerCase());
function cadRegDaEmp(e){const C=S.cad;const IX=cadEstIdx();if(C._regEmpIx!==IX){C._regEmpIx=IX;C._regEmp=new Map();if(IX)Object.entries(IX.eo).forEach(([id,v])=>{const k=id.split("-")[0];if(!C._regEmp.has(k))C._regEmp.set(k,v[1])})}return C._regEmp.get(String(e))||""}
function cadSugPessoa(dep,e,reg){const f={},g={};(S.cad.ger||[]).forEach(r=>{if(r.orig||r.dep!==dep||!cadValido(r.email))return;/* r.orig: linha ainda não salva de outra obra nova → não vira sugestão escondida */const k=r.email.trim().toLowerCase();
    if(String(r.emp)===String(e)){f[k]=f[k]||{n:0,r};f[k].n++}else if(reg&&cadRegDaEmp(r.emp)===reg){g[k]=g[k]||{n:0,r};g[k].n++}});
  const a=Object.values(f).sort((x,y)=>y.n-x.n)[0],b=Object.values(g).sort((x,y)=>y.n-x.n)[0];const w=a||b;
  return w?{nome:w.r.nome||"",email:w.r.email.trim(),fonte:a?"já faz isso nesta empresa":"já faz isso na "+reg}:{nome:"",email:"",fonte:""}}
function cadSugRegional(e,reg){const f={};(S.cad.ger||[]).forEach(r=>{if(r.orig||!cadValido(r.regEmail))return;const ok=String(r.emp)===String(e)?2:(reg&&cadRegDaEmp(r.emp)===reg?1:0);if(!ok)return;const k=r.regEmail.trim().toLowerCase();f[k]=f[k]||{n:0,s:ok,r};f[k].n+=ok})
  const w=Object.values(f).sort((x,y)=>y.s-x.s||y.n-x.n)[0];return w?{nome:w.r.regNome||"",email:w.r.regEmail.trim(),fonte:w.s===2?"já é o Regional desta empresa":"Regional da "+reg}:{nome:"",email:"",fonte:""}}
/* 28/10: não sugerir estas bases para as obras gerenciais 81xxx (AFAC, quotas, distribuição de lucros…) */
const CAD_BASE_NAO={"81":["71500","71600"]};
function cadSemProibidas(o,so){if(!so)return so;const ban=CAD_BASE_NAO[String(o).slice(0,2)];if(!ban)return so;const r={...so};ban.forEach(b=>delete r[b]);return r}
/* quem já planeja de verdade (acessos salvos), por departamento e obra */
function cadCov(){const C=S.cad;if(C._covRef===S.pessoas&&C._cov)return C._cov;const M=new Map();(S.pessoas||[]).forEach(p=>Object.entries(p.acc||{}).forEach(([id,ds])=>ds.forEach(d=>{let m=M.get(d);if(!m){m=new Map();M.set(d,m)}const L=m.get(id)||[];L.push(String(p.email).toLowerCase());m.set(id,L)})));
  C._cov=M;C._covRef=S.pessoas;C._nome=new Map((S.pessoas||[]).map(p=>[String(p.email).toLowerCase(),p.nome||""]));return M}
/* sugestão: 1) quem planeja o departamento nas outras obras DA MESMA EMPRESA (todas as pessoas com 50%+ das obras);
   2) quem planeja A MESMA OBRA (código) em outras empresas da mesma Regional; 3) a mesma obra em qualquer empresa. Sem chute pela Regional inteira. */
function cadSugPessoas(d,p){const M=cadCov().get(d);if(!M)return [];const nome=em=>S.cad._nome.get(em)||"";const cats=S.cat.obras||[];
  const conta=(ids,fonte)=>{const cnt=new Map();let n=0;ids.forEach(id=>{const L=M.get(id);if(!L||!L.length)return;n++;new Set(L).forEach(em=>cnt.set(em,(cnt.get(em)||0)+1))});if(!n)return null;
    const ok=[...cnt.entries()].filter(([,c])=>c>=Math.max(1,n*0.5)).sort((a,b)=>b[1]-a[1]);return ok.length?ok.map(([em,c])=>({nome:nome(em),email:em,fonte:fonte(c,n)})):null};
  return conta(cats.filter(c=>String(c[6])===p.e&&c[0]!==p.id).map(c=>c[0]),(c,n)=>`planeja ${d} em ${c} de ${n} obra(s) desta empresa`)
    ||(p.reg?conta(cats.filter(c=>c[1]===p.o&&String(c[6])!==p.e&&cadRegDaEmp(c[6])===p.reg).map(c=>c[0]),(c,n)=>`planeja a obra ${p.o} em ${c} de ${n} empresa(s) da ${p.reg}`):null)
    ||conta(cats.filter(c=>c[1]===p.o&&String(c[6])!==p.e).map(c=>c[0]),(c,n)=>`planeja a obra ${p.o} em ${c} de ${n} empresa(s)`)||[]}
/* Gerente Regional: pela tabela de Regionais (mesma empresa → mesma obra na Regional → Regional) */
function cadSugRegional2(p){const R=S.cad.regTab;if(!R)return {nome:"",email:"",fonte:""};const cats=S.cat.obras||[];
  const conta=(ids,fonte)=>{const cnt=new Map();let n=0;ids.forEach(id=>{const L=R.get(id);if(!L)return;n++;L.forEach(x=>{const c=cnt.get(x.email)||{n:0,nome:x.nome||""};c.n++;cnt.set(x.email,c)})});if(!n)return null;const w=[...cnt.entries()].sort((a,b)=>b[1].n-a[1].n)[0];return w&&w[1].n>=n*0.5?{nome:w[1].nome,email:w[0],fonte:fonte(w[1].n,n)}:null};
  return conta(cats.filter(c=>String(c[6])===p.e&&c[0]!==p.id).map(c=>c[0]),(c,n)=>`Regional de ${c} de ${n} obra(s) desta empresa`)
    ||(p.reg?conta(cats.filter(c=>c[1]===p.o&&cadRegDaEmp(c[6])===p.reg).map(c=>c[0]),(c,n)=>`Regional desta obra em ${c} de ${n} empresa(s) da ${p.reg}`):null)||{nome:"",email:"",fonte:""}}
async function cadRegTab(){const C=S.cad;if(C.regTab)return;const sb=window.ORC_SB;if(!sb||!sb.from)return;const M=new Map();
  for(let f=0;;f+=1000){const {data,error}=await sb.from("regionais").select("email,obra_id,nome").order("obra_id").order("email").range(f,f+999);if(error)return;data.forEach(r=>{const L=M.get(r.obra_id)||[];L.push({email:String(r.email).toLowerCase(),nome:r.nome||""});M.set(r.obra_id,L)});if(data.length<1000)break}C.regTab=M}
/* obra que já tinha sido decidida e se perdeu: volta com a mesma decisão (responsáveis pelo nome registrado) e já marcada; é só Salvar */
function cadReaplicar(p){const lg=p.jaFeita;const C=S.cad;const porNome=new Map();(S.pessoas||[]).forEach(x=>{if(x.nome)porNome.set(semAc(x.nome).trim(),String(x.email).toLowerCase())});
  if(C.regTab)C.regTab.forEach(L=>L.forEach(x=>{if(x.nome&&!porNome.has(semAc(x.nome).trim()))porNome.set(semAc(x.nome).trim(),x.email)}));
  const acha=v=>{v=String(v||"").trim();if(!v)return null;if(cadValido(v))return v.toLowerCase();return porNome.get(semAc(v))||null};
  [[CAD_GA,lg.ga],[CAD_CTRL,lg.ctrl],["_reg",lg.rg]].forEach(([d,v])=>{const em=acha(v);if(em)p.resp[d]={nome:cadValido(v)?(p.resp[d]&&p.resp[d].nome)||"":v,email:em,fonte:"decisão registrada em "+fmtDate(lg.em),mexeu:true}});
  if(lg.st==="ok"||lg.st==="pausa"){if(!cadPendAplicar(p,lg.st,true))p.motivo+=" · precisa de ajuste antes de confirmar"}}
function cadPendBloqueio(p){const L=[];if(!p.base&&!p.semBase)L.push("escolher a base modelo");if(!p.reg)L.push("informar a Regional");if(p.semArea)L.push(`dizer quem planeja ${p.semArea} insumo(s) fora do modelo`);return L}
function cadPendAplicar(p,modo,quieto){const C=S.cad;cadPendDesfazer(p);const bl=cadPendBloqueio(p);if(modo==="ok"&&bl.length){if(!quieto)toast("Antes de confirmar: "+bl.join(", ")+".");return false}
  const c=[p.id,p.o,p.on,p.base,0,0,p.e,p.en,0];C.novas.push(c);C.aoNovas[p.id]=Object.keys(p.areas).sort();if(p.reg)C.reg.set(p.id,p.reg);
  if(modo==="ok"){const ex={};p.extras.forEach(x=>{if(x.area&&x.area!==CAD_NING)ex[x.key]=x.area});if(Object.keys(ex).length){C.o[p.id]=ex;C.oTipo=C.oTipo||{};C.oTipo[p.id]=p.base}}
  if(modo==="pausa"){C.fora.set(p.id,"pausa")}
  else{const deps=[...new Set([CAD_GA,CAD_CTRL,...Object.keys(p.areas)])];const rg=p.resp._reg||{};
    deps.forEach((d,i)=>{const r=p.resp[d]||{};const cob=C.ger.some(x=>x.dep===d&&!x.orig&&cadValido(x.email)&&(cadTodas(x.emp)||(String(x.emp)===p.e&&(String(x.obra)===p.o||cadTodas(x.obra))))&&(!(cadTodas(x.emp)||cadTodas(x.obra))||(C.aoNovas[p.id]||[]).includes(d)));
      if(cob&&!(r.mexeu&&r.email)&&!(d===CAD_GA&&rg.email))return;
      C.ger.push({dep:d,emp:p.e,obra:p.o,nome:r.nome||"",email:r.email||"",cargo:"",obs:"com Claude",reg:p.reg||"",regNome:d===CAD_GA?rg.nome||"":"",regEmail:d===CAD_GA?rg.email||"":"",orig:p.id})});
    /* outras pessoas no mesmo departamento desta obra */
    Object.entries(p.extra||{}).forEach(([d,L])=>(L||[]).forEach(x=>{if(cadValido(x.email))C.ger.push({dep:d,emp:p.e,obra:p.o,nome:x.nome||"",email:x.email.trim().toLowerCase(),cargo:"",obs:"com Claude",reg:p.reg||"",regNome:"",regEmail:"",orig:p.id})}));
    C.gerDirty=true}
  p.st=modo;return true}
function cadPendDesfazer(p){const C=S.cad;delete C.o[p.id];C.novas=C.novas.filter(c=>c[0]!==p.id);delete C.aoNovas[p.id];C.reg.delete(p.id);C.fora.delete(p.id);const n=C.ger.length;C.ger=C.ger.filter(r=>r.orig!==p.id);if(C.ger.length!==n)C.gerDirty=true;p.st=""}
function cadPendFiltradas(){const C=S.cad;const q=semAc($("#cp-q").value||"").trim(),rg=$("#cp-reg").value,gr=$("#cp-grupo").value,st=$("#cp-st").value;
  return [...C.pend.values()].filter(p=>(!rg||p.reg===rg)&&(!gr||p.grupo===gr)&&(st==="todas"||(st==="aguardando"&&!p.st)||(st==="feitas"&&p.st)||(st==="prontas"&&!p.st&&!cadPendBloqueio(p).length)||(st==="ajuste"&&!p.st&&cadPendBloqueio(p).length)||(st==="gerente"&&!p.st&&cadGerEspera(p).length))&&(!q||semAc(`${p.id} ${p.en} ${p.on}`).includes(q))).sort((a,b)=>((cadGerEspera(b).length?1:0)-(cadGerEspera(a).length?1:0))||cadNum(a.id,b.id))}
function cadPessoaIn(p,d,rot){const r=p.resp[d]||{};const k=esc(p.id)+"|"+esc(d);const X=(p.extra&&p.extra[d])||[];return `<div class="cp-pes${r.email&&cadValido(r.email)?"":" falta"}"><span class="lbl">${esc(rot||d)}${X.length?` <span class="muted">(${X.length+1} pessoas)</span>`:""}</span>
  <input class="cad-in" data-cp-pes="${k}" data-f="nome" value="${esc(r.nome||"")}" placeholder="Nome" aria-label="Nome ${esc(rot||d)}"><input class="cad-in" data-cp-pes="${k}" data-f="email" value="${esc(r.email||"")}" placeholder="e-mail" aria-label="E-mail ${esc(rot||d)}">
  ${r.fonte?`<small class="cp-src">${r.mexeu?"editado":"sugestão: "+esc(r.fonte)}</small>`:`<small class="cp-src falta">sem sugestão, preencher</small>`}
  ${d!=="_reg"?X.map((x,j)=>`<div style="display:flex;gap:4px;margin-top:4px"><input class="cad-in" data-cp-pes2="${k}|${j}" data-f="nome" value="${esc(x.nome||"")}" placeholder="Nome" aria-label="Nome (outra pessoa)"><input class="cad-in" data-cp-pes2="${k}|${j}" data-f="email" value="${esc(x.email||"")}" placeholder="e-mail" aria-label="E-mail (outra pessoa)"><button class="btn sm" data-cp-menos="${k}|${j}" title="Tirar esta pessoa">×</button></div>${x.fonte&&!x.mexeu?`<small class="cp-src">sugestão: ${esc(x.fonte)}</small>`:""}`).join("")+`<button class="btn sm" style="margin-top:4px;justify-self:start" data-cp-mais="${k}">+ outra pessoa</button>`:""}</div>`}
/* ---------- alcance: ao mudar um responsável/Regional numa obra, perguntar se vale para as outras obras novas da empresa ---------- */
const cadEscRot=d=>d===CAD_GA?"Gerente Administrativo":d===CAD_CTRL?"Responsável Controladoria":d==="_reg"?"Gerente Regional":d==="_regional"?"Regional":d;
function cadEscIrmas(p){return [...(S.cad.pend||new Map()).values()].filter(x=>x.e===p.e&&x.id!==p.id).sort((a,b)=>cadNum(a.id,b.id))}
function cadEscopoBox(p){const E=S.cad.cpEscopo;if(!E||E.id!==p.id)return "";const L=cadEscIrmas(p);if(!L.length)return "";
  const r=E.d==="_regional"?null:(p.resp[E.d]||{});const val=E.d==="_regional"?esc(p.reg||"(vazio)"):esc([r.nome,r.email].filter(Boolean).join(" · ")||"(vazio)");
  return `<div class="cp-esc"><div><b>${esc(cadEscRot(E.d))}: ${val}</b> foi definido só nesta obra (${esc(p.o)}). Aplicar também nas outras obras novas da empresa ${esc(p.e)}?</div>
    <div class="cp-esc-l">${L.map(x=>`<label><input type="checkbox" data-cp-esc-o="${esc(x.id)}" ${x.st?"":"checked"}> <span class="cad-cod">${esc(x.o)}</span> ${esc(x.on)}${x.st?" <span class=\"muted\">(já decidida)</span>":""}</label>`).join("")}</div>
    <div class="row" style="gap:6px"><button class="btn primary sm" data-cp-esc-ok="${esc(p.id)}">Aplicar nas marcadas</button><button class="btn sm" data-cp-esc-nao="1">Só nesta obra</button></div></div>`}
function cadEscopoAplicar(p){const C=S.cad;const E=C.cpEscopo;if(!E)return;const ids=[...document.querySelectorAll("[data-cp-esc-o]")].filter(i=>i.checked).map(i=>i.dataset.cpEscO);let n=0;
  ids.forEach(id=>{const x=C.pend.get(id);if(!x)return;if(E.d==="_regional")x.reg=p.reg;else{const r=p.resp[E.d]||{};x.resp[E.d]={...r,fonte:"aplicado da obra "+p.o,mexeu:true}}if(x.st)cadPendAplicar(x,x.st,true);n++});
  C.cpEscopo=null;toast(n?`${cadEscRot(E.d)} aplicado em ${n} obra(s): ${ids.map(id=>id.split("-").slice(1).join("-")).join(", ")}`:"Nada aplicado: nenhuma obra marcada");cadRenderPend()}
/* ---------- resolvidas: o que já foi salvo sai da lista e fica registrado aqui ---------- */
function cadRenderResolvidas(){const C=S.cad;const tb=$("#cp-res");if(!tb)return;const hoje=new Date().toLocaleDateString("pt-BR");
  const L=((C.resolv&&C.resolv.itens)||[]).filter(x=>new Date(x.em).toLocaleDateString("pt-BR")===hoje).slice().reverse();$("#cp-res-n").textContent=L.length;
  tb.innerHTML=L.length?`<thead><tr><th>Hora</th><th>Empresa / obra</th><th>Resultado</th><th>Base</th><th>Gerente Adm.</th><th>Controladoria</th><th>Gerente Regional</th><th>Regional</th><th>Por</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(new Date(x.em).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}))}</td><td><span class="cad-cod">${esc(x.id)}</span> ${esc(x.on||"")}<br><span class="muted" style="font-size:12px">${esc(x.en||"")}</span></td><td>${x.st==="pausa"?'<span class="pill vazio">Pausada</span>':'<span class="pill enviado">Confirmada</span>'}</td><td class="cad-cod">${esc(x.base||"—")}</td><td>${esc(x.ga||"—")}</td><td>${esc(x.ctrl||"—")}</td><td>${esc(x.rg||"—")}</td><td>${esc(x.reg||"—")}</td><td>${esc(x.por||"")}</td><td><button class="btn sm" data-cp-ver="${esc(x.id)}">Ver em Empresas e obras</button></td></tr>`).join("")}</tbody>`:`<tbody><tr><td class="muted">Nada salvo hoje ainda.</td></tr></tbody>`}
function cadRenderPend(){const C=S.cad;const sr=$("#cp-reg"),sg=$("#cp-grupo");const P=[...(C.pend||new Map()).values()];
  const rv=sr.value,gv=sg.value;sr.innerHTML=cadOpts([...new Set(P.map(p=>p.reg).filter(Boolean))].sort().map(x=>[x,x]),rv,"Todas as Regionais");sg.innerHTML=cadOpts([...new Set(P.map(p=>p.grupo).filter(Boolean))].sort().map(x=>[x,x]),gv,"Todos os grupos");
  const ag=P.filter(p=>!p.st),ok=P.filter(p=>p.st==="ok"),pa=P.filter(p=>p.st==="pausa"),sb=ag.filter(p=>!p.base);
  const F=cadPendFiltradas();C.cpVis=F.map(p=>p.id);
  const GR=new Map();F.forEach(p=>{if(!GR.has(p.e))GR.set(p.e,[]);GR.get(p.e).push(p)});
  $("#cp-n").textContent=`${cadN(F.length)} obra(s) em ${cadN(GR.size)} empresa(s)`;
  const bases=Object.keys(T.tipos||{}).sort(cadNum);const AR=cadAreas();
  const card=p=>{const A=Object.entries(p.areas).sort((a,b)=>b[1]-a[1]);const outras=A.map(([d])=>d).filter(d=>d!==CAD_GA&&d!==CAD_CTRL);
    const k=esc(p.id);return `<article class="cp-card ${p.st?"cp-"+p.st:""}">
    <header><div><span class="cad-cod">${esc(p.e)}</span> ${esc(p.en)}<br><b><span class="cad-cod">${esc(p.o)}</span> ${esc(p.on)}</b></div>
      <div class="cp-tags"><span class="cad-chip">${esc(p.reg||"sem Regional")}</span><span class="cad-chip">${esc(p.grupo||"sem grupo")}</span><span class="cad-chip">${cadN(p.linhas)} linhas</span>${p.st==="ok"?'<span class="pill enviado">Confirmada</span>':p.st==="pausa"?'<span class="pill vazio">Não planejar agora</span>':'<span class="pill rascunho">Aguardando confirmação</span>'}</div></header>
    <div class="cp-grid">
      <div><span class="lbl">Base modelo</span><select class="cad-in" data-cp-base="${k}" aria-label="Base modelo">${cadOpts([["__erp","Sem base modelo (só a estrutura do ERP desta obra)"]].concat(bases.map(b=>[b,`${b}${T.tipos[b]&&T.tipos[b].prods?" · "+Object.values(T.tipos[b].prods)[0]:""}`])),p.semBase?"__erp":p.base,"— escolher —")}</select>
        <small class="cp-src${p.base?"":" falta"}">${p.base?`sugestão: ${esc(p.motivo)}${p.parecido!=null?` · ${p.parecido}% dos insumos da obra estão no modelo`:""}`:"não encontrei base parecida, escolha"}</small></div>
      <div><span class="lbl">Quem planeja (replicado do modelo)</span><div>${A.map(([d,n])=>`<span class="cad-chip">${esc(d)} <b>${n}</b></span>`).join("")||'<span class="muted">escolha a base</span>'}</div>
        ${p.extras.length?`<small class="cp-src${p.semArea?" falta":""}">${p.extras.length} insumo(s) da obra não estão no modelo: ${p.fora} com sugestão pela área mais comum${p.semArea?`, <b>${p.semArea} sem nenhuma referência</b>`:""}</small>`:""}</div>
      <div><span class="lbl">Regional</span><input class="cad-in" list="cad-regs" data-cp-reg="${k}" value="${esc(p.reg)}" placeholder="Regional" aria-label="Regional"><small class="cp-src${p.reg?"":" falta"}">${p.reg?"pela Base da Estrutura (Grupo_Empresa)":"a estrutura não informa, preencher"}</small></div>
    </div>
    ${(()=>{const bl=cadPendBloqueio(p);return bl.length&&!p.st?`<div class="cp-ajuste"><b>Ajuste antes de confirmar:</b> ${bl.map(esc).join(" · ")}</div>`:""})()}
    ${p.extras.length?`<details class="cp-mais"${p.semArea?" open":""}><summary>Insumos fora do modelo (${p.extras.length}): confira quem planeja</summary><div class="tbl-box"><table class="list"><thead><tr><th>Serviço</th><th>Insumo</th><th>Descrição</th><th>Quem planeja</th></tr></thead><tbody>${p.extras.slice(0,200).map(x=>`<tr><td><span class="cad-cod">${esc(x.S)}</span> ${esc(x.sd)}</td><td class="cad-cod">${esc(x.I||"—")}</td><td>${esc(x.d)}</td><td><select class="cad-in${x.area?"":" cp-req"}" data-cp-ext="${k}|${esc(x.key)}" aria-label="Quem planeja">${cadOptsExt(x.area,AR)}</select>${x.sug&&x.area===x.sug?` <small class="cp-src">${x.porSv?"sugestão pelo serviço":"sugestão pelo insumo"}</small>`:""}</td></tr>`).join("")}</tbody></table></div></details>`:""}
    <div class="cp-pessoas">${cadPessoaIn(p,CAD_GA)}${cadPessoaIn(p,CAD_CTRL,"Responsável Controladoria")}${cadPessoaIn(p,"_reg","Gerente Regional")}</div>
    ${outras.length?`<details class="cp-mais"><summary>Outros departamentos (${outras.length}): ${outras.filter(d=>!(p.resp[d]&&cadValido(p.resp[d].email))).length} sem sugestão</summary><div class="cp-pessoas">${outras.map(d=>cadPessoaIn(p,d)).join("")}</div></details>`:""}
    <footer>${p.st?`<button class="btn sm" data-cp-desf="${k}">Desfazer</button>`:`<button class="btn primary sm" data-cp-ok="${k}">Confirmar</button><button class="btn sm" data-cp-pausa="${k}" title="Entra no cadastro como Pausada e para de aparecer aqui">Não planejar agora</button>`}</footer>${cadEscopoBox(p)}</article>`};
  C.cpEmpAb=C.cpEmpAb||new Set();const auto=GR.size<=3;if(F.length===1)C.cpAberta=F[0].id;
  const sit=p=>p.st==="ok"?'<span class="pill enviado">Confirmada</span>':p.st==="pausa"?'<span class="pill vazio">Não planejar</span>':'<span class="pill rascunho">Aguardando</span>';
  const nm=(p,d)=>{const r=p.resp[d]||{};const n=((p.extra||{})[d]||[]).filter(x=>x.email).length;return (r.nome||r.email?esc(r.nome||r.email):'<span class="muted">—</span>')+(n?` <span class="muted">+${n}</span>`:"")};
  const row=p=>{const k=esc(p.id);const ab=C.cpAberta===p.id;const ge=cadGerEspera(p);const gn=[...new Set(ge.map(r=>r.nome||r.email))];return `<tr class="${ab?"cp-row-ab":""}"><td class="cad-cod">${esc(p.o)}</td><td>${esc(p.on)}${gn.length?`<br><span class="cad-chip cp-gerchip" title="Já existe gerente cadastrado para esta obra. Ele só passa a ver a obra depois que ela for confirmada e salva.">Gerente esperando: ${esc(gn.slice(0,2).join(", "))}${gn.length>2?` +${gn.length-2}`:""}</span>`:""}</td><td class="cad-cod">${esc(p.base||(p.semBase?"ERP":"—"))}</td><td>${nm(p,CAD_GA)}</td><td>${nm(p,CAD_CTRL)}</td><td>${nm(p,"_reg")}</td><td>${esc(p.reg||"—")}</td><td>${sit(p)}</td>
    <td class="cp-acts"><button class="btn sm" data-cp-abrir="${k}">${ab?"Fechar":"Abrir"}</button> ${p.st?`<button class="btn sm" data-cp-desf="${k}">Desfazer</button>`:`<button class="btn primary sm" data-cp-ok="${k}">Confirmar</button> <button class="btn sm" data-cp-pausa="${k}">Não planejar</button>`}</td></tr>${ab?`<tr class="cp-det"><td colspan="9">${card(p)}</td></tr>`:""}`};
  $("#cp-list").innerHTML=F.length?[...GR.entries()].map(([e,L])=>{const ab=auto||C.cpEmpAb.has(e);const nOk=L.filter(p=>p.st==="ok").length,nPa=L.filter(p=>p.st==="pausa").length;
    return `<section class="cp-emp"><button type="button" class="cp-emp-h" data-cp-emp="${esc(e)}" aria-expanded="${ab}"><b>${ab?"▾":"▸"}</b><span class="cad-cod">${esc(e)}</span><b>${esc(L[0].en)}</b><span class="muted">· ${L.length} obra(s) nova(s)${nOk?` · ${nOk} confirmada(s)`:""}${nPa?` · ${nPa} sem planejar`:""}${nOk||nPa?" · falta Salvar":""}</span></button>
    ${ab?`<div class="tbl-box"><table class="list cp-tab"><thead><tr><th>Obra</th><th>Descrição</th><th>Base</th><th>Gerente Adm.</th><th>Controladoria</th><th>Gerente Regional</th><th>Regional</th><th>Situação</th><th></th></tr></thead><tbody>${L.map(row).join("")}</tbody></table></div>`:""}</section>`}).join(""):`<p class="muted">${P.length?"Nenhuma obra com esses filtros.":"Nenhuma obra nova. Suba a Base da Estrutura quando ela mudar."}</p>`;
  cadRenderResolvidas();
  {const regs=[...new Set(Object.values(S.regObra||{}).concat([...C.reg.values()],P.map(p=>p.reg)).filter(Boolean))].sort();$("#cad-regs").innerHTML=regs.map(x=>`<option value="${esc(x)}">`).join("")}
  cadRenderFalta(ag.length,sb.length,ok.length,pa.length);cadRenderExtras();cadRenderPadrao();cadAcessosCalc();cadRenderAcessos();cadRenderPq();cadBarra();cadTabPend()}
/* ---------- insumos fora de qualquer modelo: decide uma vez por insumo para todas as obras novas ---------- */
const cadOptsExt=(v,AR)=>cadOpts([[CAD_NING,"Ninguém planeja (fica fora do app)"]].concat((AR||cadAreas()).map(a=>[a,a])),v,"— escolher —");/* AR: lista de áreas já calculada (desempenho) */
function cadExtrasGlobais(){const M=new Map();(S.cad.pend?[...S.cad.pend.values()]:[]).forEach(p=>{if(p.st==="pausa")return;p.extras.forEach(x=>{if(x.sug)return;const k=x.S+"|"+x.I;const g=M.get(k)||{k,S:x.S,I:x.I,sd:x.sd,d:x.d,n:0,falta:0};g.n++;if(!x.area)g.falta++;M.set(k,g)})});return [...M.values()].sort((a,b)=>b.n-a.n)}
function cadRenderExtras(){const C=S.cad;const AR=cadAreas();const L=cadExtrasGlobais();const q=semAc($("#cx-q").value||"").trim(),so=$("#cx-falta").checked;
  const F=L.filter(g=>(!so||g.falta)&&(!q||semAc(`${g.S} ${g.I} ${g.sd} ${g.d}`).includes(q)));C.cxVis=F;const MAX=200;const falta=L.filter(g=>g.falta).length;
  $("#cx-n").textContent=`${cadN(L.length)} insumo(s) sem referência · ${cadN(falta)} ainda sem decisão${F.length>MAX?` · mostrando ${MAX} de ${cadN(F.length)}`:""}`;
  $("#cx-card").hidden=!L.length;
  $("#cx-tbl").innerHTML=F.length?`<thead><tr><th>Serviço</th><th>Insumo</th><th>Descrição</th><th>Obras novas</th><th>Quem planeja</th></tr></thead><tbody>${F.slice(0,MAX).map(g=>`<tr><td><span class="cad-cod">${esc(g.S)}</span> ${esc(g.sd)}</td><td class="cad-cod">${esc(g.I||"—")}</td><td>${esc(g.d)}</td><td>${cadN(g.n)}</td><td><select class="cad-in${C.extraDec.has(g.k)?"":" cp-req"}" data-cx="${esc(g.k)}" aria-label="Quem planeja">${cadOptsExt(C.extraDec.get(g.k)||"",AR)}</select></td></tr>`).join("")}</tbody>`:`<tbody><tr><td class="muted">Nada para decidir com esse filtro.</td></tr></tbody>`}
function cadDecidir(keys,v){const C=S.cad;keys.forEach(k=>{if(v)C.extraDec.set(k,v);else C.extraDec.delete(k)});const K=new Set(keys);
  C.pend.forEach(p=>{if(!p.extras.some(x=>K.has(x.S+"|"+x.I)))return;cadPendCalc(p);if(p.st){const st=p.st;if(cadPendAplicar(p,st,true)===false)p.st=""}})}
/* ---------- padronizar gerentes e e-mails (nome+e-mail das linhas de gerente) ---------- */
const cadMail=v=>{const m=String(v||"").replace(/\s+/g,"").toLowerCase();return m.includes("@")?m:""};
function cadPesRefs(){const out=[];(S.cad.ger||[]).forEach(r=>{out.push({r,kn:"nome",ke:"email"});out.push({r,kn:"regNome",ke:"regEmail"})});return out.filter(x=>String(x.r[x.kn]||"").trim()||String(x.r[x.ke]||"").trim())}
function cadDifsPes(){const R=cadPesRefs();const out=[];const porMail=new Map(),porNome=new Map();
  R.forEach(x=>{const m=cadMail(x.r[x.ke]),n=cadLimpo(x.r[x.kn]);if(m){const a=porMail.get(m)||new Map();if(n)a.set(n,(a.get(n)||0)+1);porMail.set(m,a)}
    if(n&&m){const k=cadChave(n);const a=porNome.get(k)||new Map();a.set(m,(a.get(m)||0)+1);porNome.set(k,a)}});
  const top=a=>[...a.entries()].sort((x,y)=>y[1]-x[1]||(/[a-z]/.test(y[0])-/[a-z]/.test(x[0])))[0][0];
  const ag=new Map();const push=(tipo,de,para,refs,campo)=>{const k=tipo+"|"+de+"|"+para;const g=ag.get(k)||{tipo,de,para,refs:[],campo};g.refs.push(...refs);ag.set(k,g)};
  R.forEach(x=>{const ev=String(x.r[x.ke]||""),m=cadMail(ev),nv=String(x.r[x.kn]||"");
    if(m&&m!==ev)push("E-mail com espaço ou maiúscula",ev,m,[x],"e");
    else if(m&&!cadValido(m))push("E-mail inválido (corrigir na aba Gerentes)",ev,"",[x],"");
    const nm=m&&porMail.get(m)&&porMail.get(m).size?top(porMail.get(m)):cadLimpo(nv);
    if(nv&&nm&&nv!==nm)push(cadChave(nv)===cadChave(nm)?"Nome com espaço ou maiúscula diferente":"Mesmo e-mail com outro nome",nv,nm,[x],"n")});
  porNome.forEach(a=>{if(a.size<2)return;const L=[...a.entries()].sort((x,y)=>y[1]-x[1]);const refs=R.filter(x=>a.has(cadMail(x.r[x.ke]))&&porNome.get(cadChave(cadLimpo(x.r[x.kn])))===a);
    out.push({tipo:"Mesma pessoa com mais de um e-mail",de:L.map(([v,n])=>`${v} (${n})`).join(" · "),para:"",refs,campo:"m",ops:L.map(e=>e[0]),nome:cadLimpo(refs[0]&&refs[0].r[refs[0].kn])})});
  return [...ag.values()].concat(out)}
function cadUsarPes(d,v){d.refs.forEach(x=>{if(d.campo==="e")x.r[x.ke]=d.para;else if(d.campo==="n")x.r[x.kn]=d.para;else if(d.campo==="m")x.r[x.ke]=v});S.cad.gerDirty=true}
function cadRenderPadraoPes(){const C=S.cad;const L=cadDifsPes();C.pzPes=L;const MAX=300;
  $("#pz-pn").textContent=`${cadN(L.length)} ajuste(s) em gerentes e e-mails`;
  const vis=t=>esc(t).replace(/ {2,}/g,m=>'<mark title="espaço repetido">'+"·".repeat(m.length)+"</mark>").replace(/^ | $/g,'<mark title="espaço no começo ou no fim">·</mark>');
  $("#pz-ptbl").innerHTML=L.length?`<thead><tr><th>O que está diferente</th><th>Linhas</th><th>Hoje</th><th>Correção</th><th></th></tr></thead><tbody>${L.slice(0,MAX).map((d,i)=>`<tr><td>${esc(d.tipo)}</td><td>${cadN(d.refs.length)}</td><td>${d.campo==="m"?`<b>${esc(d.nome)}</b><br>${esc(d.de)}`:vis(d.de)}</td><td>${d.campo==="m"?`<select class="cad-in" data-pzm="${i}">${d.ops.map(o=>`<option>${esc(o)}</option>`).join("")}</select>`:d.para?`<b>${esc(d.para)}</b>`:'<span class="muted">—</span>'}</td><td>${d.campo?`<button class="btn sm" data-pzp="${i}">${d.campo==="m"?"Usar este e-mail":"Corrigir"}</button>`:""}</td></tr>`).join("")}</tbody>`:`<tbody><tr><td class="muted">Nomes e e-mails dos gerentes sem diferenças.</td></tr></tbody>`}
/* obras do app que não existem mais na Base da Estrutura */
function cadSumidas(){const IX=cadEstIdx();if(!IX||!IX.eo)return [];const porObra=new Map();Object.keys(IX.eo).forEach(id=>{const o=id.slice(id.indexOf("-")+1);const a=porObra.get(o)||[];a.push(id);porObra.set(o,a)});
  return (S.cat.obras||[]).filter(c=>!IX.eo[c[0]]).map(c=>({c,inat:S.cad.cat.has(c[0])?S.cad.cat.get(c[0]):c[8]===1,outras:(porObra.get(String(c[1]))||[]).map(id=>[id,cadLimpo(IX.eo[id][0]),cadLimpo(IX.eo[id][2])])}))}
function cadRenderSumidas(){const C=S.cad;const L=cadSumidas();C.sumidas=L;const at=L.filter(x=>!x.inat);
  $("#pz-sn").textContent=L.length?`${cadN(L.length)} obra(s) do app não estão na Base da Estrutura · ${cadN(at.length)} ainda ativa(s)`:"";
  $("#pz-sbox").hidden=!L.length;
  $("#pz-stbl").innerHTML=L.length?`<thead><tr><th>Empresa-obra no app</th><th>Nome no app</th><th>Situação no app</th><th>Essa obra aparece na estrutura em</th><th></th></tr></thead><tbody>${L.map((x,i)=>`<tr class="${x.inat?"cad-inat":""}"><td class="cad-cod">${esc(x.c[0])}</td><td>${x.c[2]||x.c[7]?esc([x.c[7],x.c[2]].filter(Boolean).join(" · ")):'<span class="muted">sem nome</span>'}</td><td>${x.inat?"Inativa":'<span class="cad-chip bad">Ativa</span>'}</td><td>${x.outras.length?x.outras.slice(0,4).map(([id,en,on])=>`<span class="cad-cod">${esc(id)}</span> ${esc(en)}${on?" · "+esc(on):""}${S.catMap.has(id)?' <small class="cp-src">já no app</small>':' <small class="cp-src falta">ainda não está no app</small>'}`).join("<br>")+(x.outras.length>4?`<br><small class="muted">+${x.outras.length-4}</small>`:""):'<span class="muted">não aparece em nenhuma empresa</span>'}</td><td><button class="btn sm" data-pzs="${i}">${x.inat?"Reativar":"Inativar"}</button></td></tr>`).join("")}</tbody>`:""}
/* ---------- padronizar nomes e Regionais pela Base da Estrutura ---------- */
function cadDifs(){const C=S.cad;const IX=cadEstIdx();if(!IX||!IX.eo)return [];const out=[];
  (S.cat.obras||[]).forEach(c=>{const v=IX.eo[c[0]];if(!v)return;const nm=C.nomes.get(c[0])||{};
    const en=nm.en!=null?nm.en:c[7],on=nm.on!=null?nm.on:c[2],reg=C.reg.has(c[0])?C.reg.get(c[0]):((S.regObra||{})[c[0]]||"");
    const E=cadLimpo(v[0]),O=cadLimpo(v[2]),R=cadLimpo(v[1]);
    if(E&&en!==E)out.push({c,campo:"emp",rot:"Nome da empresa",app:en,est:E});
    if(O&&on!==O)out.push({c,campo:"obra",rot:"Nome da obra",app:on,est:O});
    if(R&&reg!==R)out.push({c,campo:"reg",rot:reg&&cadChave(reg)===cadChave(R)?"Regional (escrita diferente)":"Regional",app:reg,est:R})});return out}
function cadUsarEst(d){const C=S.cad;const id=d.c[0];if(d.campo==="reg"){cadSetReg(id,d.est);return}const nm=C.nomes.get(id)||{};nm[d.campo==="emp"?"en":"on"]=d.est;
  if((nm.en==null||nm.en===d.c[7])&&(nm.on==null||nm.on===d.c[2]))C.nomes.delete(id);else C.nomes.set(id,nm)}
function cadRenderPadrao(){const C=S.cad;const L=cadDifs();C.difs=L;const fv=$("#pz-campo").value;const cnt=k=>L.filter(d=>d.campo===k).length;
  $("#pz-campo").innerHTML=cadOpts([["emp",`Nome da empresa (${cnt("emp")})`],["obra",`Nome da obra (${cnt("obra")})`],["reg",`Regional (${cnt("reg")})`]],fv,`Tudo (${L.length})`);
  const F=L.filter(d=>!fv||d.campo===fv);C.pzVis=F;const MAX=300;$("#pz-n").textContent=`${cadN(F.length)} diferença(s)${F.length>MAX?` · mostrando ${MAX}`:""}`;
  const vis=t=>esc(t).replace(/ {2,}/g,m=>'<mark title="espaço repetido">'+"·".repeat(m.length)+"</mark>");
  $("#pz-tbl").innerHTML=F.length?`<thead><tr><th>Empresa / obra</th><th>Campo</th><th>No app hoje</th><th>Na Base da Estrutura</th><th></th></tr></thead><tbody>${F.slice(0,MAX).map((d,i)=>`<tr><td class="cad-cod">${esc(d.c[0])}</td><td>${esc(d.rot)}</td><td>${d.app?vis(d.app):'<span class="muted">vazio</span>'}</td><td><b>${esc(d.est)}</b></td><td><button class="btn sm" data-pz="${i}">Usar a da estrutura</button></td></tr>`).join("")}</tbody>`:`<tbody><tr><td class="muted">${cadEstIdx()?"Nomes e Regionais do app iguais à Base da Estrutura.":"Suba a Base da Estrutura para comparar."}</td></tr></tbody>`;
  /* Regionais com a mesma grafia base escritas de jeitos diferentes */
  const g=new Map();const add=(v,n)=>{v=String(v||"");if(!v.trim())return;const k=cadChave(v);const m=g.get(k)||new Map();m.set(v,(m.get(v)||0)+n);g.set(k,m)};
  Object.values(S.regObra||{}).forEach(v=>add(v,1));C.reg.forEach(v=>add(v,1));
  const V=[...g.values()].filter(m=>m.size>1);cadRenderSumidas();cadRenderPadraoPes();$("#pz-var").innerHTML=V.length?`<b>Regionais escritas de formas diferentes:</b> ${V.map((m,i)=>{const L=[...m.entries()].sort((a,b)=>b[1]-a[1]);return `<span class="cp-var">${L.map(([v,n])=>`“${esc(v)}” (${n})`).join(" · ")} <button class="btn sm" data-pzv="${esc(L[0][0])}">Unificar como “${esc(cadLimpo(L[0][0]))}”</button></span>`}).join("")}`:"";}
/* ---------- o que falta preencher nas obras que já estão no app ---------- */
function cadFaltas(){const C=S.cad;const GX=cadGOctx();const AO=GX.AO;const cov=new Set(),covR=new Set();
  C.ger.forEach(r=>{const ok=cadValido(r.email),okR=cadValido(r.regEmail);if(!ok&&!okR)return;const ids=r.dep?cadGerObras(r,GX):[];ids.forEach(id=>{if(ok)cov.add(id+"|"+r.dep);if(okR)covR.add(id)})});
  const IX=cadEstIdx();const out=[];(S.cat.obras||[]).concat(C.novas).forEach(c=>{const e=cadObraEstado(c);if(e.inat||e.fora)return;const id=c[0];const fm=(S.foraApp||{})[id]||{};
    const deps=(AO[id]||[]).filter(a=>!cadAreaFora(id,a));const falta=deps.filter(a=>!cov.has(id+"|"+a));
    if(!e.reg)falta.push("_regnome");if(!covR.has(id)&&!(C.regTab&&C.regTab.has(id)))falta.push("_reg");
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
/* ---------- 28/10 (2): Pendências em filas de trabalho (um quadro por lista, mostra só a escolhida) ---------- */
const CAD_PQ=[["acessos","Acessos de gerentes"],["novas","Obras novas"],["insumos","Insumos sem modelo"],["falta","Falta preencher"],["padrao","Padronizar"]];
function cadPqContas(){const C=S.cad;const P=[...(C.pend||new Map()).values()];const ag=P.filter(p=>!p.st);const pr=ag.filter(p=>!cadPendBloqueio(p).length);const dec=P.filter(p=>p.st).length;const gr=ag.filter(p=>cadGerEspera(p).length).length;
  const ex=cadExtrasGlobais();const exF=ex.filter(g=>g.falta).length;const fa=(C.faltas||[]).length;
  const pz=(C.difs||[]).length+(C.sumidas||[]).filter(x=>!x.inat).length+(C.pzPes||[]).filter(d=>d.campo).length;const A=C.acessos||{faltam:[],legado:[]};
  const nSI=(A.semItens||[]).length;const nA=A.faltam.length+A.legado.length+nSI;
  return {acessos:[nA,nA?`${cadN(A.faltam.length)} faltando · ${cadN(nSI)} sem nada para preencher · ${cadN(A.legado.length)} fora do cadastro`:"todos os gerentes com acesso certo",nA?"bad":"ok"],
    novas:[ag.length,P.length?`${cadN(pr.length)} prontas · ${cadN(ag.length-pr.length)} precisam de ajuste${gr?` · ${cadN(gr)} com gerente esperando`:""}${dec?` · ${cadN(dec)} decididas (falta Salvar)`:""}`:(cadEstIdx()?"nenhuma obra nova na estrutura":"suba a Base da Estrutura"),ag.length?(gr?"bad":"warn"):"ok"],
    insumos:[exF,ex.length?`${cadN(ex.length)} insumo(s) sem referência · ${cadN(exF)} sem decisão`:"nenhum insumo sem modelo",exF?"warn":"ok"],
    falta:[fa,fa?"obras ativas sem gerente em alguma área":"todas as obras com responsáveis",fa?"warn":"ok"],
    padrao:[pz,pz?"nomes, Regionais, obras fora da estrutura e e-mails":"tudo igual à estrutura",pz?"warn":"ok"]}}
function cadRenderPq(){const C=S.cad;const box=$("#pq-tiles");if(!box)return;const K=cadPqContas();
  if(!C.pq||!K[C.pq]){const prim=CAD_PQ.find(([k])=>K[k][0]>0&&k!=="padrao");C.pq=prim?prim[0]:"novas"}
  box.innerHTML=CAD_PQ.map(([k,l])=>{const [n,sub,cls]=K[k];return `<button type="button" role="tab" class="pq-tile ${cls}" data-pq-tile="${k}" aria-selected="${C.pq===k}"><span class="k-l">${l}</span><span class="k-v">${n?cadN(n):"✓"}</span><span class="k-s">${esc(sub)}</span></button>`}).join("");
  document.querySelectorAll("#cad-pend [data-pq]").forEach(el=>{el.hidden=el.dataset.pq!==C.pq})}
/* gerentes do cadastro que já apontam para a obra nova (ela só entra no app depois de confirmada) */
function cadGerEspera(p){const C=S.cad;if(!C.ger)return [];if(!C._gerIdx||C._gerIdxRef!==C.ger||C._gerIdxN!==C.ger.length){const M=new Map();C.ger.forEach(r=>{if(!cadValido(r.email)||!r.dep)return;const k=String(r.emp).trim()+"|"+(cadTodas(r.obra)?"*":String(r.obra).trim());if(!M.has(k))M.set(k,[]);M.get(k).push(r)});C._gerIdx=M;C._gerIdxRef=C.ger;C._gerIdxN=C.ger.length}
  return (C._gerIdx.get(p.e+"|"+p.o)||[]).concat((C._gerIdx.get(p.e+"|*")||[]).filter(r=>(p.areas||{})[r.dep]))}
/* ---------- acessos: o que o cadastro de gerentes libera × o que está liberado hoje ---------- */
const cadAoa=L=>[CAD_H,...L.map(r=>[r.dep||"",r.emp||"",r.obra||"",r.nome||"",r.email||"",r.cargo||"",r.obs||"",r.reg||"",r.regNome||"",r.regEmail||""])];
function cadParesDe(lista){const M=new Map();(lista||[]).forEach(p=>Object.entries(p.acc||{}).forEach(([id,deps])=>(deps||[]).forEach(d=>M.set(String(p.email).toLowerCase()+"|"+id+"|"+d,p))));return M}
function cadAcessosCalc(){const C=S.cad;const out={faltam:[],legado:[]};if(!C||!C.ger||!S.areasObra)return out;
  let esp;try{esp=cadParesDe(montarAcessos(cadAoa(C.gerBase||C.ger)).lista)}catch(e){return out}const hoje=cadParesDe(S.pessoas);
  esp.forEach((p,k)=>{if(!hoje.has(k)){const [em,id,d]=k.split("|");out.faltam.push({email:em,nome:p.nome||"",id,d})}});
  hoje.forEach((p,k)=>{if(!esp.has(k)){const [em,id,d]=k.split("|");if(!indObraConta(id))return;out.legado.push({email:em,nome:p.nome||"",cargo:p.cargo||"",semClaude:!!p.semClaude,id,d})}});
  /* cadastrado numa obra específica, mas a obra não tem insumo daquela área: a obra não aparece para a pessoa */
  out.semItens=[];const AO=S.areasObra||{};C.ger.forEach(r=>{if(!r.dep||!cadValido(r.email)||cadTodas(r.emp)||cadTodas(r.obra))return;const id=String(r.emp).trim()+"-"+String(r.obra).trim();
    if(!indObraConta(id)||cadAreaFora(id,r.dep)||/master/i.test(r.dep))return;if(!(AO[id]||[]).includes(r.dep))out.semItens.push({email:String(r.email).toLowerCase(),nome:r.nome||"",id,d:r.dep})});
  C.acessos=out;return out}
function cadLegadoLinhas(L){return L.map(x=>{const i=x.id.indexOf("-");return {dep:x.d,emp:x.id.slice(0,i),obra:x.id.slice(i+1),nome:x.nome,email:x.email,cargo:x.cargo||"",obs:x.semClaude?"":"com Claude",reg:"",regNome:"",regEmail:""}})}
function cadRenderAcessos(){const C=S.cad;const A=C.acessos||cadAcessosCalc();const nm=id=>{const c=S.catMap.get(id);return c?`${c[7]||""} · ${c[2]||""}`:""};
  const por=new Map();A.faltam.forEach(x=>{const k=x.email;if(!por.has(k))por.set(k,{nome:x.nome,email:x.email,f:[],l:[]});por.get(k).f.push(x)});A.legado.forEach(x=>{const k=x.email;if(!por.has(k))por.set(k,{nome:x.nome,email:x.email,f:[],l:[]});por.get(k).l.push(x)});
  const L=[...por.values()].sort((a,b)=>(b.f.length-a.f.length)||String(a.nome).localeCompare(String(b.nome),"pt-BR"));
  $("#pa-n").textContent=L.length?`${cadN(L.length)} pessoa(s) · ${cadN(A.faltam.length)} acesso(s) faltando · ${cadN(A.legado.length)} liberado(s) fora do cadastro`:"";
  $("#pa-acertar").hidden=!L.length;
  $("#pa-res").innerHTML=L.length?`<b>Acertar acessos</b> libera o que falta e traz para o cadastro de gerentes os acessos que foram dados por fora (formulário antigo), para que não se percam no próximo Salvar. Depois clique em <b>Salvar</b>.${C.gerDirty?' <span class="cad-chip bad">Há mudanças de gerentes não salvas: elas entram junto.</span>':""}`:'<span class="cad-chip">Tudo certo</span> Todos os gerentes cadastrados enxergam as obras deles.';
  const li=(a,cls)=>a.slice(0,6).map(x=>`<span class="cad-chip ${cls}" title="${esc(nm(x.id))}">${esc(x.id)} · ${esc(x.d)}</span>`).join("")+(a.length>6?` <span class="muted">+${a.length-6}</span>`:"");
  const SI=A.semItens||[];$("#pa-si").hidden=!SI.length;$("#pa-sin").textContent=SI.length?`${cadN(SI.length)} cadastro(s)`:"";
  $("#pa-sitbl").innerHTML=SI.length?`<thead><tr><th>Gerente</th><th>Área</th><th>Empresa / obra</th><th>Áreas que a obra tem hoje</th><th></th></tr></thead><tbody>${SI.slice(0,400).map(x=>`<tr><td><b>${esc(x.nome||"—")}</b><br><span class="muted" style="font-size:12px">${esc(x.email)}</span></td><td>${esc(x.d)}</td><td><span class="cad-cod">${esc(x.id)}</span> ${esc(nm(x.id))}</td><td>${((S.areasObra||{})[x.id]||[]).map(a=>`<span class="cad-chip">${esc(a)}</span>`).join("")||'<span class="muted">nenhuma</span>'}</td><td><button class="btn sm" data-pa-quem="${esc(x.id)}">Abrir quem planeja da obra</button></td></tr>`).join("")}</tbody>`:"";
  $("#pa-tbl").innerHTML=L.length?`<thead><tr><th>Gerente</th><th>Sem acesso hoje (vai liberar)</th><th>Liberado fora do cadastro (vai para o cadastro)</th></tr></thead><tbody>${L.slice(0,300).map(p=>`<tr><td><b>${esc(p.nome||"—")}</b><br><span class="muted" style="font-size:12px">${esc(p.email)}</span></td><td>${p.f.length?li(p.f,"bad"):'<span class="muted">—</span>'}</td><td>${p.l.length?li(p.l,""):'<span class="muted">—</span>'}</td></tr>`).join("")}</tbody>`:""}
function cadAcertarAcessos(){const C=S.cad;const A=C.acessos||cadAcessosCalc();const novas=cadLegadoLinhas(A.legado);C.ger=C.ger.concat(novas);C.gerDirty=true;C.paAcertar=true;
  toast(`${novas.length} acesso(s) antigo(s) trazidos para o cadastro${A.faltam.length?` e ${A.faltam.length} acesso(s) para liberar`:""}. Clique em Salvar.`);cadRenderPend()}
/* formulários antigos (Gerentes e acessos / Sem gerente) também gravam no cadastro de gerentes, para as duas listas não divergirem */
async function cadGerSyncForm(modo,x){try{const d=await S.db.doc("restrito/cad_gerentes").get();if(!d.exists)return;const dd=d.data();let L=(dd.linhas||[]).map(r=>({...r}));const em=String(x.email||"").toLowerCase();
    const mesmo=r=>String(r.email||"").trim().toLowerCase()===em;const sp=id=>{const i=id.indexOf("-");return [id.slice(0,i),id.slice(i+1)]};
    const linha=id=>{const [e,o]=sp(id);return {dep:x.dep,emp:e,obra:o,nome:x.nome||"",email:em,cargo:x.cargo||"",obs:"com Claude",reg:"",regNome:"",regEmail:""}};
    if(modo==="set"){L=L.filter(r=>!(mesmo(r)&&r.dep===x.dep));(x.ids||[]).forEach(id=>L.push(linha(id)))}
    else if(modo==="add"){const [e,o]=sp(x.id);if(!L.some(r=>mesmo(r)&&r.dep===x.dep&&String(r.emp)===e&&(String(r.obra)===o||cadTodas(r.obra))))L.push(linha(x.id))}
    else if(modo==="del"){const [e,o]=sp(x.id);L=L.filter(r=>!(mesmo(r)&&String(r.emp)===e&&String(r.obra)===o))}
    await S.db.doc("restrito/cad_gerentes").set({...dd,linhas:L,atualizadoEm:nowISO(),por:"formulário"});
    if(S.cad&&!S.cad.gerDirty){S.cad.ger=null;S.cad.gerBase=null;S.cad._ger0=0}}catch(e){console.warn("cad_gerentes:",e)}}
function cadTabPend(){const t=$("#tab-pend");if(!t||!S.cad||!S.cad.pend)return;const n=[...S.cad.pend.values()].filter(p=>!p.st).length+((S.cad.faltas||[]).length?1:0);
  t.textContent=n?`Pendências (${[...S.cad.pend.values()].filter(p=>!p.st).length} novas)`:"Pendências"}
document.addEventListener("click",e=>{const t=e.target;if(!t.closest||!t.closest("#cad-pend")||!S.cad)return;const C=S.cad;const P=id=>C.pend&&C.pend.get(id);
  {const tl=t.closest("[data-pq-tile]");if(tl){C.pq=tl.dataset.pqTile;cadRenderPq();return}}
  if(t.id==="pa-acertar"){cadAcertarAcessos();return}
  {const qb=t.closest("[data-pa-quem]");if(qb){const id=qb.dataset.paQuem;const c=cadObraDe(id);cadMostrar("quem");if(c){const sb=$("#cq-base");sb.value=c[3];cadQuemPrep();const so=$("#cq-obra");so.value=id;cadRenderQuem()}return}}
  let b=t.closest("[data-cp-emp]");if(b){const e2=b.dataset.cpEmp;C.cpEmpAb=C.cpEmpAb||new Set();C.cpEmpAb.has(e2)?C.cpEmpAb.delete(e2):C.cpEmpAb.add(e2);cadRenderPend();return}
  b=t.closest("[data-cp-abrir]");if(b){const id=b.dataset.cpAbrir;C.cpAberta=C.cpAberta===id?null:id;if(C.cpEscopo&&C.cpEscopo.id!==C.cpAberta)C.cpEscopo=null;cadRenderPend();return}
  b=t.closest("[data-cp-esc-ok]");if(b){const p=P(b.dataset.cpEscOk);if(p)cadEscopoAplicar(p);return}
  if(t.dataset&&t.dataset.cpEscNao){C.cpEscopo=null;cadRenderPend();return}
  b=t.closest("[data-cp-ver]");if(b){const id=b.dataset.cpVer;cadMostrar("obras");const q=$("#co-q");if(q){q.value=id;const st=$("#co-st");if(st)st.value="todas";cadRenderObras()}return}
  b=t.closest("[data-cp-mais]");if(b){const [id,d]=b.dataset.cpMais.split("|");const p=P(id);if(p){p.extra=p.extra||{};(p.extra[d]=p.extra[d]||[]).push({nome:"",email:"",mexeu:true});cadRenderPend()}return}
  b=t.closest("[data-cp-menos]");if(b){const [id,d,j]=b.dataset.cpMenos.split("|");const p=P(id);if(p&&p.extra&&p.extra[d]){p.extra[d].splice(+j,1);p.extra[d].forEach(x=>x.mexeu=true);if(!p.extra[d].length)p.extra[d]=[{nome:"",email:"",mexeu:true}].slice(1);if(p.st)cadPendAplicar(p,p.st,true);cadRenderPend()}return}
  b=t.closest("[data-cp-ok]");if(b){const p=P(b.dataset.cpOk);if(p&&cadPendAplicar(p,"ok"))cadRenderPend();return}
  b=t.closest("[data-cp-pausa]");if(b){const p=P(b.dataset.cpPausa);if(p&&cadPendAplicar(p,"pausa"))cadRenderPend();return}
  b=t.closest("[data-cp-desf]");if(b){const p=P(b.dataset.cpDesf);if(p){cadPendDesfazer(p);cadRenderPend()}return}
  if(t.dataset&&t.dataset.cpLote){const L=(C.cpVis||[]).map(P).filter(p=>p&&!p.st);let n=0;L.forEach(p=>{if(cadPendAplicar(p,t.dataset.cpLote,true))n++});toast(`${n} obra(s) ${t.dataset.cpLote==="ok"?"confirmadas":"marcadas para não planejar"}${t.dataset.cpLote==="ok"&&n<L.length?` · ${L.length-n} precisam de ajuste (base, Regional ou quem planeja) e ficaram aguardando`:""}`);cadRenderPend();return}
  b=t.closest("[data-pz]");if(b){const d=(C.pzVis||[])[+b.dataset.pz];if(d){cadUsarEst(d);cadRenderPend()}return}
  if(t.id==="cx-ning"){const K=(C.cxVis||[]).filter(g=>g.falta).map(g=>g.k);if(!K.length)return;if(!t.dataset.arm){t.dataset.arm=1;t.textContent=`Confirmar: ${K.length} insumo(s) ficam fora do app`;setTimeout(()=>{if(t.isConnected){delete t.dataset.arm;t.textContent="Os listados sem decisão: ninguém planeja"}},5000);return}
    delete t.dataset.arm;cadDecidir(K,CAD_NING);toast(`${K.length} insumo(s) marcados como fora do app`);cadRenderPend();return}
  b=t.closest("[data-pzs]");if(b){const x=(C.sumidas||[])[+b.dataset.pzs];if(x){cadSetInat(x.c[0],!x.inat);cadRenderPend()}return}
  if(t.id==="pz-sinat"){const L=(C.sumidas||[]).filter(x=>!x.inat);L.forEach(x=>cadSetInat(x.c[0],true));toast(`${L.length} obra(s) marcadas como inativas. Clique em Salvar para gravar.`);cadRenderPend();return}
  b=t.closest("[data-pzp]");if(b){const d=(C.pzPes||[])[+b.dataset.pzp];if(d){const sel=document.querySelector(`[data-pzm="${b.dataset.pzp}"]`);cadUsarPes(d,sel&&sel.value);cadRenderPend()}return}
  if(t.id==="pz-ptodos"){const L=(C.pzPes||[]).filter(d=>d.campo==="e"||d.campo==="n");L.forEach(d=>cadUsarPes(d));toast(`${L.length} correção(ões) de nome/e-mail preparadas. Os casos de pessoa com mais de um e-mail você escolhe um a um. Clique em Salvar para gravar.`);cadRenderPend();return}
  if(t.id==="pz-todos"){(C.pzVis||[]).forEach(cadUsarEst);toast(`${(C.pzVis||[]).length} correção(ões) preparadas. Clique em Salvar para gravar.`);cadRenderPend();return}
  b=t.closest("[data-pzv]");if(b){const alvo=cadLimpo(b.dataset.pzv),k=cadChave(alvo);let n=0;Object.entries(S.regObra||{}).forEach(([id,v])=>{if(v!==alvo&&cadChave(v)===k){cadSetReg(id,alvo);n++}});C.reg.forEach((v,id)=>{if(v!==alvo&&cadChave(v)===k){C.reg.set(id,alvo);n++}});toast(`${n} obra(s) com a Regional unificada`);cadRenderPend();return}
  b=t.closest("[data-cf]");if(b){const [id,...d]=b.dataset.cf.split("|");C.cfAberto={id,d:d.join("|")};cadRenderPend();const f=$("#cf-v-email")||$("#cf-v-nome");if(f)f.focus();return}
  if(t.id==="cf-x"){C.cfAberto=null;cadRenderPend();return}if(t.id==="cf-ok"){cadFaltaAplicar();return}});
document.addEventListener("change",e=>{const t=e.target;if(!t.closest||!t.closest("#cad-pend")||!S.cad)return;const C=S.cad;
  if(t.dataset.cpBase){const p=C.pend.get(t.dataset.cpBase);if(p){const st=p.st;p.semBase=t.value==="__erp";p.base=p.semBase?"":t.value;p.motivo="escolhida por você";cadPendCalc(p);if(st)cadPendAplicar(p,st);cadRenderPend()}return}
  if(t.dataset.cx){cadDecidir([t.dataset.cx],t.value);cadRenderPend();return}
  if(t.id==="cx-falta"){cadRenderExtras();return}
  if(t.dataset.cpReg){const p=C.pend.get(t.dataset.cpReg);if(p){p.reg=cadLimpo(t.value);if(p.st)cadPendAplicar(p,p.st);C.cpEscopo=cadEscIrmas(p).length?{id:p.id,d:"_regional"}:null;cadRenderPend()}return}
  if(t.dataset.cpExt){const [id,...kk]=t.dataset.cpExt.split("|");const p=C.pend.get(id);if(p){p.escolha[kk.join("|")]=t.value;cadPendCalc(p);if(p.st)cadPendAplicar(p,p.st);cadRenderPend()}return}
  if(t.dataset.cpPes2){const [id,d,j]=t.dataset.cpPes2.split("|");const p=C.pend.get(id);if(!p||!p.extra||!p.extra[d]||!p.extra[d][+j])return;const x=p.extra[d][+j];x[t.dataset.f]=t.dataset.f==="email"?t.value.trim().toLowerCase():t.value.trim();p.extra[d].forEach(y=>y.mexeu=true);if(p.st)cadPendAplicar(p,p.st,true);cadRenderPend();return}
  if(t.dataset.cpPes){const [id,d]=t.dataset.cpPes.split("|");const p=C.pend.get(id);if(!p)return;const r=p.resp[d]=p.resp[d]||{};r[t.dataset.f]=t.value.trim();r.mexeu=true;if(p.st)cadPendAplicar(p,p.st);C.cpEscopo=cadEscIrmas(p).length?{id:p.id,d}:null;cadRenderPend();return}
  if(["cp-reg","cp-grupo","cp-st","cf-o","cf-emp","pz-campo"].includes(t.id)){cadRenderPend();return}});
document.addEventListener("click",e=>{const h=e.target.closest&&e.target.closest("#cad-pend h2.cad-col-h");if(h)h.parentElement.classList.toggle("fechado")});
document.addEventListener("input",e=>{const t=e.target;if((t.id==="cp-q"||t.id==="cf-q")&&S.cad)cadRenderPend();if(t.id==="cx-q"&&S.cad)cadRenderExtras()});
{const tp=$("#tab-pend");if(tp)tp.addEventListener("click",async()=>{await flush();S.cad=S.cad||cadNovo();S.cad.aba="pend";if(S.tab==="cad")cadMostrar("pend");else showTab("cad")})}

/* ---------- gravar tudo ---------- */
async function cadSalvar(){const C=S.cad;const btn=$("#cad-salvar");const msg=$("#cad-save-msg");btn.disabled=true;const feito=[];
  try{const por=await quemSou();const em=nowISO();
    /* trava de segurança: relê do banco o que será regravado; se a leitura falhar, nada é gravado */
    msg.textContent="Conferindo dados atuais…";{const ld=async p=>{const d=await S.db.doc(p).get();return d.exists?d.data():null};const [aoF,foF,dpF,catF,cgF,rdF]=await Promise.all([ld("restrito/areasobra"),ld("regras/fora_app"),ld("regras/depara"),ld("restrito/catalogo"),ld("restrito/cad_gerentes"),ld("restrito/depara")]);
      S.areasObra=(aoF&&aoF.m)||{};S.foraApp=(foF&&foF.m)||{};if(dpF)S.dpR=dpF;
      /* 28/10: várias pessoas salvando ao mesmo tempo. Parte do que está gravado AGORA e aplica só o que ESTA tela mudou (nada de regravar a lista antiga inteira) */
      if(catF&&Array.isArray(catF.obras)){S.cat=catF;S.catMap=new Map(catF.obras.map(c=>[c[0],c]))}
      if(rdF&&Array.isArray(rdF.linhas))S.dp=rdF.linhas;
      if(C.gerDirty&&!C.gerTroca&&C.gerBase&&cgF&&Array.isArray(cgF.linhas)){C.ger=cadGerMesclar(C.gerBase,C.ger,cgF.linhas)}
      /* 28/10 (2): obra nova, situação, área ou quem planeja mudou → os acessos dos gerentes são recalculados no fim (antes só recalculava quando a lista de gerentes mudava) */
      C._recalc=!!(C.novas.length||C.cat.size||C.fora.size||(C.foraA&&C.foraA.size)||Object.keys(C.t).length||Object.keys(C.o).length);
      if(C._recalc&&!C.gerDirty&&cgF&&Array.isArray(cgF.linhas)){C.ger=cgF.linhas.map(r=>({...r}));C.gerBase=cgF.linhas.map(r=>({...r}))}

      if((S.cat&&S.cat.obras||[]).length&&!Object.keys(S.areasObra).length)throw new Error("as áreas das obras não foram carregadas do banco");
      if(C.gerDirty&&!(C.ger||[]).some(r=>r.email))throw new Error("a lista de gerentes está vazia; isso removeria todos os acessos");}
    if(C.estr){const E=C.estr.E;const emps=Object.keys(E);let i=0;for(const emp of emps){i++;msg.textContent=`Gravando estrutura: empresa ${i}/${emps.length}…`;await S.db.doc("restrito/estr/"+emp).set({o:E[emp],atualizadoEm:em})}
      const idx={...C.estr.idx,arquivo:C.estr.arquivo,atualizadoEm:em};await S.db.doc("restrito/estr_idx").set(idx);S.estIdx=idx;S.estE={};S.estAp=null;feito.push("estrutura do ERP");C.estr=null}
    /* 1) catálogo: obras novas e ativa/inativa */
    const novasAgora=new Set(C.novas.map(c=>c[0]));
    const pp2=(p,d)=>{const r=p.resp[d]||{};return r.nome||r.email||""};const resolvidas=[...(C.pend||new Map()).values()].filter(p=>p.st&&novasAgora.has(p.id)).map(p=>({id:p.id,e:p.e,en:p.en,o:p.o,on:p.on,st:p.st,base:p.base||(p.semBase?"ERP":""),reg:p.reg||"",ga:p.st==="ok"?pp2(p,CAD_GA):"",ctrl:p.st==="ok"?pp2(p,CAD_CTRL):"",rg:p.st==="ok"?pp2(p,"_reg"):"",por,em}));
    if(C.cat.size||C.novas.length||C.nomes.size){msg.textContent="Gravando empresas e obras…";const cat=cadClone(S.cat);const novasIds=new Set(C.novas.map(c=>c[0]));
      cat.obras=cat.obras.concat(C.novas.filter(c=>!cat.obras.some(x=>x[0]===c[0])).map(c=>c.slice()));cat.obras.forEach(c=>{if(C.cat.has(c[0]))c[8]=C.cat.get(c[0])?1:0;const nm=C.nomes.get(c[0]);if(nm){if(nm.en!=null)c[7]=nm.en;if(nm.on!=null)c[2]=nm.on}});cat.atualizadoEm=em;
      await S.db.doc("restrito/catalogo").set(cat);S.cat=cat;S.catMap=new Map(cat.obras.map(c=>[c[0],c]));
      if(novasIds.size){const ao=cadClone(S.areasObra)||{};novasIds.forEach(id=>{const c=S.catMap.get(id);if(c&&!ao[id])ao[id]=C.aoNovas[id]||cadAreasObra(id,c[3],[],[])});C.aoNovas={};
        await S.db.doc("restrito/areasobra").set({m:ao,aba:"Cadastros",arquivo:"Cadastros no app",atualizadoEm:em});S.areasObra=ao}
      feito.push(`${C.cat.size} situação(ões)${C.novas.length?` e ${C.novas.length} obra(s) nova(s)`:""}${C.nomes.size?` · ${C.nomes.size} nome(s) corrigido(s)`:""}`);C.cat.clear();C.novas=[];C.nomes.clear()}
    if(C.fora.size){msg.textContent="Gravando planejamento fora do app…";const m=cadClone(S.foraApp)||{};C.fora.forEach((v,id)=>{if(v){m[id]=m[id]||{};m[id]["*"]=v==="pausa"?{motivo:"Pausada: não planejar agora",pausada:true,por,em}:{motivo:"Marcado em Cadastros",por,em}}else if(m[id]){delete m[id]["*"];if(!Object.keys(m[id]).length)delete m[id]}});
      await S.db.doc("regras/fora_app").set({m,atualizadoEm:em});S.foraApp=m;S.ind=null;feito.push(`${C.fora.size} obra(s) no/fora do app`);C.fora.clear()}
    if(C.foraA&&C.foraA.size){msg.textContent="Gravando áreas fora do app…";const fd=await S.db.doc("regras/fora_app").get();const m={...((fd.exists&&fd.data().m)||{})};
      C.foraA.forEach((v,k)=>{const i=k.indexOf("|");const id=k.slice(0,i),a=k.slice(i+1);if(v){m[id]=m[id]||{};m[id][a]={motivo:"Marcado em Empresas e obras",por,em}}else if(m[id]){delete m[id][a];if(!Object.keys(m[id]).length)delete m[id]}});
      await S.db.doc("regras/fora_app").set({m,atualizadoEm:em});S.foraApp=m;S.ind=null;feito.push(`${C.foraA.size} área(s) dentro/fora do app`);C.foraA.clear()}
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
      const ao=cadClone(S.areasObra)||{};afet.forEach((novas,id)=>{const c=S.catMap.get(id);if(novasAgora.has(id))return;if(c)ao[id]=cadAreasObra(id,c[3],ao[id]||[],[...novas])});
      await S.db.doc("restrito/areasobra").set({m:ao,aba:"Cadastros",arquivo:"Cadastros no app",atualizadoEm:em});S.areasObra=ao;
      if(S.cur){applyRules(S.cur);renderGrid()}feito.push(`${nT+nO} regra(s) de quem planeja`);C.t={};C.o={}}
    /* 3) gerentes: mesmo caminho da planilha (aba 3) */
    if(!C.gerDirty&&C._recalc&&C.ger&&C.ger.length){/* acessos dados por fora do cadastro entram nele antes de recalcular, para nada se perder */
      const leg=cadAcessosCalc().legado;if(leg.length)C.ger=C.ger.concat(cadLegadoLinhas(leg));C.gerDirty=true}
    if(C.gerDirty){msg.textContent="Gravando gerentes e liberando acessos…";const linhas=C.ger.map(({sug,orig,...r})=>({...r}));
      await S.db.doc("restrito/cad_gerentes").set({linhas,atualizadoEm:em,por});C.gerDoc={linhas,atualizadoEm:em,por};C.gerBase=linhas.map(r=>({...r}));C.gerTroca=false;
      const regAntes=cadClone(S.regObra)||{};await carregarAcessos(cadGerAoa(),"Cadastros no app");
      /* a Regional da obra é cuidada aqui no app: a coluna Regional das linhas de gerente só completa obras que ainda não têm */
      {const m={...(S.regObra||{}),...regAntes};if(JSON.stringify(m)!==JSON.stringify(S.regObra||{})){await S.db.doc("regras/regional_obra").set({m,arquivo:"Cadastros no app",atualizadoEm:nowISO()});S.regObra=m}}C.gerMsg=($("#pl-msg")&&$("#pl-msg").textContent)||"";C.gerOrigem=`Cadastro salvo em ${fmtDate(em)} por ${por}.`;C.gerDirty=false;C.acessos=null;feito.push(C._recalc&&!C.paAcertar?"acessos dos gerentes recalculados":"gerentes e acessos");C.paAcertar=false}
    /* registro das obras resolvidas (só depois de tudo gravado) */
    if(resolvidas.length){try{const at=await S.db.doc("restrito/cad_resolvidas").get();const it=((at.exists&&at.data().itens)||[]).concat(resolvidas).slice(-2000);await S.db.doc("restrito/cad_resolvidas").set({itens:it,atualizadoEm:em});C.resolv={itens:it}}catch(e){toast("Salvo, mas o registro de Resolvidas não foi gravado: "+(e.message||e))}}
    msg.textContent="";$("#cad-imp-res").hidden=true;C.pend=null;C.cpAberta=null;C.cpEscopo=null;C.cfAberto=null;toast("Salvo: "+feito.join(" · "));$("#cad-msg").textContent=`Salvo em ${fmtDate(em)}: ${feito.join(" · ")}.${C.gerMsg?" "+C.gerMsg:""}`;C.gerMsg="";
  }catch(e){msg.textContent="Não foi possível salvar: "+(e&&e.message||e)+". O que já foi gravado está indicado acima."; if(feito.length)$("#cad-msg").textContent="Gravado antes do erro: "+feito.join(" · ")}
  btn.disabled=false;cadMostrar(C.aba)}
/* junção de 3 vias das linhas de gerentes: (gravado agora) − (o que esta tela tirou) + (o que esta tela incluiu/alterou) */
function cadGerMesclar(base,cur,fresh){const key=r=>JSON.stringify(["dep","emp","obra","nome","email","cargo","obs","reg","regNome","regEmail"].map(k=>String(r[k]==null?"":r[k]).trim().toLowerCase()));
  const cnt=L=>{const m=new Map();L.forEach(r=>{const k=key(r);m.set(k,(m.get(k)||0)+1)});return m};const mb=cnt(base),mc=cnt(cur);
  const tirar=new Map();mb.forEach((n,k)=>{const d=n-(mc.get(k)||0);if(d>0)tirar.set(k,d)});const ja=new Map();
  const out=[];fresh.forEach(r=>{const k=key(r);const t=tirar.get(k)||0;if(t>0){tirar.set(k,t-1);return}out.push({...r})});
  const fc=cnt(out);cur.forEach(r=>{const k=key(r);const nb=mb.get(k)||0;const usados=ja.get(k)||0;if(usados<nb){ja.set(k,usados+1);return}if((fc.get(k)||0)>0){fc.set(k,fc.get(k)-1);return}out.push({...r})});
  return out}
function cadDescartar(){const b=$("#cad-desc");if(!b.dataset.arm){b.dataset.arm=1;b.textContent="Confirmar descartar";setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent="Descartar"}},5000);return}
  delete b.dataset.arm;b.textContent="Descartar";const aba=S.cad.aba;S.cad=cadNovo();S.cad.aba=aba;abrirCadastros()}

/* ---------- eventos ---------- */
{const tc=$("#tab-cad");if(tc)tc.addEventListener("click",async()=>{await flush();showTab("cad")})}
document.addEventListener("click",async e=>{const t=e.target;if(!t.closest||!t.closest("#v-cad"))return;const C=S.cad;
  const sub=t.closest("#cad-sub button");if(sub){cadMostrar(sub.dataset.cad);return}
  if(t.id==="cad-salvar"){cadSalvar();return}if(t.id==="cad-desc"){cadDescartar();return}
  let b=t.closest("[data-co-inat]");if(b){const id=b.dataset.coInat;cadSetInat(id,!cadObraEstado(cadObraDe(id)).inat);cadRenderObras();return}
  if(t.id==="co-all"){(C.coVis||[]).slice(0,800).forEach(id=>t.checked?C.sel.add(id):C.sel.delete(id));cadRenderObras();return}
  {const ba=t.closest&&t.closest("[data-co-area]");if(ba){const [id,...aa]=ba.dataset.coArea.split("|");const a=aa.join("|");cadSetAreaFora(id,a,!cadAreaFora(id,a));cadRenderObras();cadBarra();return}}
  const lote=t.dataset&&t.dataset.coLote;if(lote){const ids=[...C.sel];const rv=$("#co-lote-reg").value;
    ids.forEach(id=>{if(lote==="ativar")cadSetInat(id,false);if(lote==="inativar")cadSetInat(id,true);if(lote==="fora")cadSetFora(id,"fora");if(lote==="pausa")cadSetFora(id,"pausa");if(lote==="app")cadSetFora(id,"");if(lote==="reg")cadSetReg(id,rv);if((lote==="areafora"||lote==="areaapp")&&$("#co-lote-area").value)cadSetAreaFora(id,$("#co-lote-area").value,lote==="areafora")});
    if(lote==="limpar")C.sel.clear();cadRenderObras();return}
  if(t.id==="cn-add"){cadNovaObra();return}
  if(t.id==="cq-trocar"){cadTrocar();return}
  {const bh=t.closest&&t.closest("[data-cg-emp]");if(bh){const e2=bh.dataset.cgEmp;C.cgEmpAb=C.cgEmpAb||new Set();C.cgEmpAb.has(e2)?C.cgEmpAb.delete(e2):C.cgEmpAb.add(e2);cadRenderGer();return}}
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
      const L=cadGerDaPlanilha(XLSX.utils.sheet_to_json(wb.Sheets[nm],{header:1,defval:""}));C.ger=L;C.gerDirty=true;C.gerTroca=true;/* importar a aba 3 substitui a lista inteira, como antes */C.gerOrigem=`Importado de ${f.name} (aba ${nm}): ${L.length} linha(s). Confira e clique em Salvar para aplicar.`;cadRenderGer()}
    catch(err){$("#cadg-origem").textContent=err&&err.message==="aba"?"Não encontrei a aba 3. Gerentes nessa planilha.":err&&err.message==="cols"?"A aba 3 não tem as colunas Departamento (quem planeja), Empresa, Obra e E-mail.":"Não consegui ler a planilha."}}
});
document.addEventListener("input",e=>{const t=e.target;if(t.id==="co-q")cadRenderObras();if(t.id==="cq-q")cadRenderQuem();if(t.id==="cadg-q")cadRenderGer();
  if(t.dataset&&t.dataset.cg!=null&&t.tagName==="INPUT"&&t.type!=="checkbox"&&S.cad){S.cad.ger[+t.dataset.cg][t.dataset.k]=t.value.trim();S.cad.gerDirty=true;cadBarra()}});
window.addEventListener("beforeunload",e=>{if(cadSujo()){e.preventDefault();e.returnValue=""}});
