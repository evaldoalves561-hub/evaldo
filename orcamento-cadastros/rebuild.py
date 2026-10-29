import json,re,sys,openpyxl
def carregar(html):
    i=html.index('const T = ');j=i+len('const T = ')
    obj,end=json.JSONDecoder().raw_decode(html[j:]);return i,j,j+end,obj
def ler(xlsx):
    wb=openpyxl.load_workbook(xlsx,read_only=True,data_only=True);R=list(wb.worksheets[0].iter_rows(values_only=True))
    return R[1:]
def rebuild(T,R,log):
    F={}
    for r in R:
        t=str(r[1]).strip();P=str(r[2]).split()[0];pd=' '.join(str(r[2]).split()[1:])
        S=str(r[5] or '').strip();S='' if S=='-1' else S;I=str(r[6] or '').strip()
        F.setdefault(t,{'prods':{},'rows':[]});F[t]['prods'].setdefault(P,pd)
        F[t]['rows'].append([P,str(r[4] or ''),S,I,str(r[7] or ''),str(r[8] or ''),1 if I else 0,0.0,str(r[3] or ''),str(r[9] if r[9] is not None else '0'),str(r[10] if r[10] is not None else '0')])
    for t,f in F.items():
        old=T['tipos'].get(t)
        if not old: log.append(f'base {t} nova no arquivo (não incluída)');continue
        k=lambda r:(r[0],r[2],r[3]) if r[3] or r[6] else (r[0],r[1],r[2],r[3],r[4].strip().upper())
        oldby={};[oldby.setdefault(k(r),r) for r in old['rows']]
        # leaf de serviço sem insumo no T antigo: casa por (P,S,'')
        new=[];seen=set()
        for r in f['rows']:
            kk=k(r)
            if kk in seen: continue
            o=oldby.get(kk)
            if o is None and not r[3] and r[2]: o=oldby.get((r[0],r[2],''))
            if o is not None:
                o[1]=r[1];new.append(o);seen.add(k(o));seen.add(kk)
            else: new.append(r);seen.add(kk);log.append(f'{t} novo: {r[0]}|{r[2]}|{r[3]} {r[4]}' if r[3] else None)
        # linhas antigas que não estão no arquivo: mantém no lugar (ficam inativas no app se não tiverem valor)
        ids={id(x) for x in new}
        for idx,r in enumerate(old['rows']):
            if id(r) in ids: continue
            if not r[6]: log.append(f'{t} cabeçalho antigo trocado: {r[1]} {r[4]}');continue
            prev=None
            for q in range(idx-1,-1,-1):
                if id(old['rows'][q]) in ids: prev=old['rows'][q];break
            pos=0 if prev is None else next(i for i,x in enumerate(new) if x is prev)+1
            new.insert(pos,r);ids.add(id(r))
            log.append(f'{t} mantida (saiu do modelo): {r[0]}|{r[2]}|{r[3]} {r[4]}')
        old['rows']=new
        for P,d in f['prods'].items(): old['prods'].setdefault(P,d)
    return T
if __name__=='__main__':
    html=open(sys.argv[1],encoding='utf-8').read();i,j,e,T=carregar(html);log=[]
    rebuild(T,ler(sys.argv[2]),log);print('\n'.join(x for x in log if x))
