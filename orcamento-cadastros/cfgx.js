/* Baixar CONFIGURAÇÃO (Excel): obras, quem planeja (abas no mesmo layout da planilha antiga) e gerentes, montados do que está no app */
async function cadConfigXlsx(btn){if(typeof XLSX==="undefined"||!S.dl){toast("Excel indisponível nesta visualização");return}
  if(btn)btn.disabled=true;try{if(!S.cad||!S.cad.ger)await abrirCadastros();const C=S.cad;
  const cats=(S.cat.obras||[]).concat(C.novas||[]).slice().sort((a,b)=>String(a[0]).localeCompare(String(b[0]),"pt",{numeric:true}));
  const A1=[["Empresa","Nome da empresa","Obra","Descrição da obra","Empresa-obra","Base modelo","Regional","Situação no ERP","Planejamento"]];
  const A2=[["Empresa","Obra","Base modelo","Produto","Serviço","Insumo","Quem planeja","Descrição do insumo","Origem"]];const LV={};
  cats.forEach(c=>{const e=cadObraEstado(c);A1.push([c[6],c[7]||"",c[1],c[2]||"",c[0],c[3]||"",e.reg||"",e.inat?"Inativa":"Ativa",e.inat?"-":e.fora==="pausa"?"Pausada":e.fora?"Fora do app":"No app"]);
    if(e.inat||!c[3])return;const L=LV[c[3]]||(LV[c[3]]=cadLeaves(c[3]));L.forEach(l=>{const v=cadValObra(c[3],l,c[0]);A2.push([c[6],c[1],c[3],l.P,l.S,l.I,v||"",l.desc||"",v&&v!==cadValBase(c[3],l)?"Exceção da obra":"Regra da base"])})});
  const wb=XLSX.utils.book_new();const ws=(a,cols)=>{const w=XLSX.utils.aoa_to_sheet(a);w["!cols"]=cols.map(n=>({wch:n}));w["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:0,c:a[0].length-1}})};return w};
  XLSX.utils.book_append_sheet(wb,ws(A1,[8,30,8,36,12,10,22,12,12]),"Obras");
  XLSX.utils.book_append_sheet(wb,ws(A2,[8,8,10,8,8,10,26,40,16]),"2. Quem planeja");
  XLSX.utils.book_append_sheet(wb,ws(cadGerAoa(),[26,8,8,30,32,22,14,22,30,32]),"3. Gerentes");
  await S.dl.save({filename:`CONFIGURACAO_ORCAMENTO_2027_2029_${new Date().toISOString().slice(0,10)}.xlsx`,data:new Uint8Array(XLSX.write(wb,{type:"array",bookType:"xlsx"}))});
  toast(`CONFIGURAÇÃO baixada: ${A1.length-1} obras, ${A2.length-1} linhas de quem planeja, ${C.ger.length} gerentes${typeof cadSujo==="function"&&cadSujo()?" (inclui alterações ainda não salvas)":""}.`)}
  catch(e){if(!(e&&e.code==="cancelled"))toast("Não foi possível gerar o Excel: "+(e.message||e))}finally{if(btn)btn.disabled=false}}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-cfg-xlsx]");if(b)cadConfigXlsx(b)});
