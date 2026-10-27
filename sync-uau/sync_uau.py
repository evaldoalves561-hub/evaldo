"""Sincronização UAU (SQL Server) -> planilha Excel -> Supabase.

Roda num computador da rede onde o servidor do UAU já é acessível.
Lê o banco com um usuário somente leitura, gera a planilha (uma aba por consulta)
e, se configurado, envia a planilha ou as linhas para o Supabase.

Uso:
    python sync_uau.py              gera a planilha e envia conforme o config.ini
    python sync_uau.py --teste      só testa a conexão com o UAU e com o Supabase
    python sync_uau.py --sem-envio  gera a planilha sem enviar nada
    python sync_uau.py --sql-tabelas  mostra o SQL para criar as tabelas no Supabase
"""

import argparse
import configparser
import datetime as dt
import decimal
import json
import logging
import re
import shutil
import sys
import uuid
from pathlib import Path

PASTA = Path(__file__).resolve().parent
LOTE = 500
PROIBIDOS = re.compile(
    r"\b(insert|update|delete|merge|drop|alter|create|truncate|exec|execute|grant|revoke|deny|into)\b",
    re.IGNORECASE,
)

log = logging.getLogger("sync_uau")


# ---------------------------------------------------------------- configuração

def carregar_config(caminho):
    if not caminho.exists():
        sys.exit(f"Não achei {caminho}. Copie config.exemplo.ini para config.ini e preencha.")
    cfg = configparser.ConfigParser(interpolation=None)
    cfg.optionxform = str
    cfg.read(caminho, encoding="utf-8")
    abas = []
    for secao in cfg.sections():
        if secao.startswith("aba:"):
            s = cfg[secao]
            abas.append({
                "nome": secao[4:].strip()[:31],
                "consulta": PASTA / "consultas" / s["consulta"],
                "tabela": s.get("tabela", "").strip(),
                "chave": s.get("chave", "").strip(),
            })
    if not abas:
        sys.exit("Nenhuma [aba:...] no config.ini.")
    return cfg, abas


def configurar_log():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(message)s",
        datefmt="%d/%m/%Y %H:%M:%S",
        handlers=[
            logging.FileHandler(PASTA / "sync_uau.log", encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


# ---------------------------------------------------------------- UAU

def conectar_uau(cfg):
    import pyodbc

    u = cfg["uau"]
    partes = [
        f"DRIVER={{{u.get('driver', 'ODBC Driver 18 for SQL Server')}}}",
        f"SERVER={u['servidor']}",
        f"DATABASE={u['banco']}",
        f"UID={u['usuario']}",
        f"PWD={u['senha']}",
        "ApplicationIntent=ReadOnly",
    ]
    if u.get("confiar_certificado", "sim").lower() in ("sim", "s", "1", "true"):
        partes.append("TrustServerCertificate=yes")
    conn = pyodbc.connect(";".join(partes), autocommit=False, timeout=30)
    conn.timeout = u.getint("tempo_limite", 600)
    return conn


def sem_comentarios(sql):
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return re.sub(r"'(?:[^']|'')*'", "''", sql)  # ignora textos entre aspas


def validar_somente_leitura(sql, arquivo):
    limpo = sem_comentarios(sql).strip()
    if not re.match(r"^(select|with)\b", limpo, re.IGNORECASE):
        raise ValueError(f"{arquivo.name}: a consulta deve começar com SELECT ou WITH.")
    achado = PROIBIDOS.search(limpo)
    if achado:
        raise ValueError(f"{arquivo.name}: comando não permitido ({achado.group(0).upper()}). Só leitura.")


def executar_consulta(conn, arquivo):
    sql = arquivo.read_text(encoding="utf-8-sig")
    validar_somente_leitura(sql, arquivo)
    cur = conn.cursor()
    try:
        cur.execute(sql)
        colunas = [c[0] for c in cur.description]
        linhas = [tuple(l) for l in cur.fetchall()]
    finally:
        cur.close()
        conn.rollback()  # nunca grava nada no UAU
    return colunas, linhas


# ---------------------------------------------------------------- planilha

def gerar_planilha(resultados, destino):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)
    cabecalho = Font(bold=True, color="FFFFFF")
    fundo = PatternFill("solid", fgColor="1F4E78")
    for nome, (colunas, linhas) in resultados.items():
        ws = wb.create_sheet(nome)
        ws.append(colunas)
        for c in ws[1]:
            c.font, c.fill = cabecalho, fundo
        larguras = [len(str(c)) for c in colunas]
        for linha in linhas:
            valores = [valor_excel(v) for v in linha]
            ws.append(valores)
            for i, v in enumerate(valores):
                if v is not None and i < len(larguras):
                    larguras[i] = max(larguras[i], min(len(str(v)), 50))
        for i, largura in enumerate(larguras, start=1):
            letra = get_column_letter(i)
            ws.column_dimensions[letra].width = largura + 2
            amostra = next((l[i - 1] for l in linhas if l[i - 1] is not None), None)
            formato = formato_coluna(amostra)
            if formato:
                for (c,) in ws.iter_rows(min_row=2, min_col=i, max_col=i):
                    c.number_format = formato
        ws.freeze_panes = "A2"
        if colunas:
            ws.auto_filter.ref = ws.dimensions
    destino.parent.mkdir(parents=True, exist_ok=True)
    wb.save(destino)


def valor_excel(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return None
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, dt.datetime) and v.tzinfo:
        return v.replace(tzinfo=None)
    return v


def formato_coluna(v):
    if isinstance(v, dt.datetime):
        return "DD/MM/YYYY HH:MM" if (v.hour or v.minute) else "DD/MM/YYYY"
    if isinstance(v, dt.date):
        return "DD/MM/YYYY"
    if isinstance(v, (float, decimal.Decimal)):
        return "#,##0.00"
    return None


def limpar_antigas(pasta, padrao, manter):
    glob = padrao.replace("{data}", "*")
    arquivos = sorted(pasta.glob(glob), key=lambda p: p.stat().st_mtime, reverse=True)
    for velho in arquivos[manter:]:
        velho.unlink(missing_ok=True)


# ---------------------------------------------------------------- Supabase

class Supabase:
    def __init__(self, cfg):
        import requests

        s = cfg["supabase"]
        self.url = s["url"].rstrip("/")
        self.chave = s["chave"].strip()
        self.http = requests.Session()
        self.http.headers.update({"apikey": self.chave, "Authorization": f"Bearer {self.chave}"})

    def _ok(self, r, acao):
        if r.status_code >= 300:
            raise RuntimeError(f"Supabase recusou ({acao}): {r.status_code} {r.text[:400]}")
        return r

    def testar(self):
        r = self.http.get(f"{self.url}/rest/v1/", timeout=30)
        self._ok(r, "teste de conexão")

    def enviar_arquivo(self, arquivo, bucket, caminho):
        with open(arquivo, "rb") as f:
            r = self.http.post(
                f"{self.url}/storage/v1/object/{bucket}/{caminho}",
                data=f,
                headers={
                    "x-upsert": "true",
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
                timeout=300,
            )
        self._ok(r, f"envio do arquivo para {bucket}/{caminho}")

    def gravar_tabela(self, tabela, colunas, linhas, modo, chave, marca):
        registros = [
            {**{c: valor_json(v) for c, v in zip(colunas, l)}, "sincronizado_em": marca}
            for l in linhas
        ]
        base = f"{self.url}/rest/v1/{tabela}"
        headers = {"Content-Type": "application/json", "Prefer": "return=minimal"}
        params = {}
        if modo == "atualizar":
            if not chave:
                raise ValueError(f"Tabela {tabela}: modo 'atualizar' precisa de 'chave' no config.ini.")
            headers["Prefer"] += ",resolution=merge-duplicates"
            params["on_conflict"] = chave.replace(" ", "")
        for i in range(0, len(registros), LOTE):
            lote = registros[i:i + LOTE]
            r = self.http.post(base, params=params, data=json.dumps(lote), headers=headers, timeout=300)
            self._ok(r, f"gravação em {tabela} (linhas {i + 1}-{i + len(lote)})")
        if modo == "substituir":
            # Só apaga o que é antigo depois que tudo novo entrou: se algo falhar no meio,
            # o app continua com os dados anteriores.
            r = self.http.delete(base, params={"sincronizado_em": f"lt.{marca}"}, headers=headers, timeout=300)
            self._ok(r, f"limpeza das linhas antigas de {tabela}")


def valor_json(v):
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (dt.datetime, dt.date, dt.time)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return None
    return v


def tipo_postgres(v):
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "bigint"
    if isinstance(v, (float, decimal.Decimal)):
        return "numeric"
    if isinstance(v, dt.datetime):
        return "timestamp"
    if isinstance(v, dt.date):
        return "date"
    return "text"


def sql_tabela(tabela, colunas, linhas, chave):
    defs = []
    for i, c in enumerate(colunas):
        amostra = next((l[i] for l in linhas if l[i] is not None), None)
        defs.append(f'  "{c}" {tipo_postgres(amostra)}')
    defs.append('  "sincronizado_em" timestamptz not null default now()')
    if chave:
        cols = ", ".join(f'"{c.strip()}"' for c in chave.split(","))
        defs.append(f"  unique ({cols})")
    return (
        f'create table if not exists public."{tabela}" (\n' + ",\n".join(defs) + "\n);\n"
        f'alter table public."{tabela}" enable row level security;\n'
        f"-- Leitura no app: crie uma policy de SELECT para usuários logados, por exemplo:\n"
        f'-- create policy "ler {tabela}" on public."{tabela}" for select to authenticated using (true);\n'
    )


# ---------------------------------------------------------------- principal

def main():
    p = argparse.ArgumentParser(description="Sincroniza dados do UAU para planilha e Supabase.")
    p.add_argument("--config", default=str(PASTA / "config.ini"))
    p.add_argument("--teste", action="store_true", help="só testa as conexões")
    p.add_argument("--sem-envio", action="store_true", help="gera a planilha sem enviar ao Supabase")
    p.add_argument("--sql-tabelas", action="store_true", help="mostra o SQL das tabelas do Supabase")
    args = p.parse_args()

    configurar_log()
    cfg, abas = carregar_config(Path(args.config))
    envio = "nao" if args.sem_envio else cfg["supabase"].get("envio", "nao").strip().lower()
    inicio = dt.datetime.now()

    try:
        log.info("Conectando ao UAU (%s / %s)...", cfg["uau"]["servidor"], cfg["uau"]["banco"])
        conn = conectar_uau(cfg)
        if args.teste:
            conn.cursor().execute("SELECT 1").fetchone()
            log.info("UAU: conexão OK.")
            if cfg["supabase"].get("envio", "nao").strip().lower() != "nao":
                Supabase(cfg).testar()
                log.info("Supabase: conexão OK.")
            return 0

        resultados = {}
        for aba in abas:
            colunas, linhas = executar_consulta(conn, aba["consulta"])
            resultados[aba["nome"]] = (colunas, linhas)
            log.info("Aba '%s': %d linhas, %d colunas.", aba["nome"], len(linhas), len(colunas))
        conn.close()

        if args.sql_tabelas:
            for aba in abas:
                if aba["tabela"]:
                    print(sql_tabela(aba["tabela"], *resultados[aba["nome"]], aba["chave"]))
            return 0

        pl = cfg["planilha"]
        pasta = Path(pl.get("pasta_saida", str(PASTA / "planilhas")))
        padrao = pl.get("nome_arquivo", "Base UAU {data}.xlsx")
        arquivo = pasta / padrao.replace("{data}", inicio.strftime("%Y-%m-%d_%H%M"))
        gerar_planilha(resultados, arquivo)
        log.info("Planilha gerada: %s", arquivo)
        if pl.get("copia_fixa", "").strip():
            shutil.copyfile(arquivo, pasta / pl["copia_fixa"].strip())
        limpar_antigas(pasta, padrao, pl.getint("manter_ultimas", 30))

        if envio == "arquivo":
            sb = Supabase(cfg)
            s = cfg["supabase"]
            pasta_bucket = s.get("pasta_bucket", "").strip("/")
            for nome in (arquivo.name, "atual.xlsx"):
                destino = f"{pasta_bucket}/{nome}" if pasta_bucket else nome
                sb.enviar_arquivo(arquivo, s.get("bucket", "planilhas-uau"), destino)
                log.info("Enviado ao Supabase Storage: %s", destino)
        elif envio == "tabelas":
            sb = Supabase(cfg)
            modo = cfg["supabase"].get("modo_tabelas", "substituir").strip().lower()
            marca = dt.datetime.now(dt.timezone.utc).isoformat()
            for aba in abas:
                if not aba["tabela"]:
                    continue
                colunas, linhas = resultados[aba["nome"]]
                sb.gravar_tabela(aba["tabela"], colunas, linhas, modo, aba["chave"], marca)
                log.info("Tabela '%s' atualizada (%d linhas, modo %s).", aba["tabela"], len(linhas), modo)
        elif envio != "nao":
            raise ValueError(f"envio = {envio} não existe. Use nao, arquivo ou tabelas.")

        log.info("Concluído em %.0f s.", (dt.datetime.now() - inicio).total_seconds())
        return 0
    except Exception as erro:  # noqa: BLE001 - registrar qualquer falha no log
        log.exception("FALHOU: %s", erro)
        return 1


if __name__ == "__main__":
    sys.exit(main())
