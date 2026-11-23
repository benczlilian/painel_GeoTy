"""Gera data/dados.js para o painel a partir dos arquivos da pesquisa.

Uso (na raiz do repositório):
    python scripts/gerar_dados.py \
        --quant  caminho/dados_quantitativos \
        --friccoes caminho/Consolidado_friccoes.xlsx \
        --satisfacao caminho/Satisfacao_Story_Map.xlsx \
        --caracterizacao caminho/caracterizacao.xlsx \
        --posthog caminho/sessoes_posthog.xlsx --telemetria caminho/telemetria \
        --saida data/dados.js

Opções:
    --com-diretrizes     inclui as diretrizes de design (por padrão ficam fora)
    --sem-caracterizacao não grava o perfil dos participantes no arquivo de dados

O arquivo gerado não contém transcrições nem citações: só códigos de sessão
(pseudônimos), categorias e números. A caracterização entra só em categorias
agrupadas (faixa etária, escolaridade, área, uso de mapas, experiência com
story maps, tela e navegador); a área de formação literal, a data e a hora do
teste não são gravadas.
"""
import argparse
import json
import math
from datetime import date
from pathlib import Path

import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument("--quant", required=True)
ap.add_argument("--friccoes", required=True)
ap.add_argument("--satisfacao", required=True)
ap.add_argument("--caracterizacao")
ap.add_argument("--posthog", help="exportação do PostHog, uma aba por sessão")
ap.add_argument("--telemetria", help="pasta com acoes_normalizadas.csv e janelas_das_tarefas.csv")
ap.add_argument("--saida", default="data/dados.js")
ap.add_argument("--com-diretrizes", action="store_true")
ap.add_argument("--sem-caracterizacao", action="store_true")
a = ap.parse_args()
Q = Path(a.quant)


def val(x):
    if x is None:
        return None
    if isinstance(x, float) and math.isnan(x):
        return None
    if isinstance(x, float) and x.is_integer():
        return int(x)
    if isinstance(x, float):
        return round(x, 1)
    if hasattr(x, "item"):
        return val(x.item())
    return x


inv = pd.read_csv(Q / "inventario_sessoes.csv")
res = pd.read_csv(Q / "resultados_individuais.csv")
nasa = pd.read_csv(Q / "nasa_sessao.csv")
cob = pd.read_csv(Q / "cobertura.csv")
epi = pd.read_excel(a.friccoes, sheet_name="Episódios consolidados")
dirs = pd.read_excel(a.friccoes, sheet_name="Diretrizes")
ses_sat = pd.read_excel(a.satisfacao, sheet_name="Sessões e cobertura")
evid = pd.read_excel(a.satisfacao, sheet_name="Evidências")

TEMAS = {"NAR": "Narrativa", "ASS": "Assunto histórico", "EDU": "Valor educativo",
         "EST": "Estética", "TXM": "Articulação texto–mapa", "LEG": "Legibilidade cartográfica",
         "CLA": "Clareza", "NAV": "Navegação e controles", "DIS": "Conforto no dispositivo",
         "DES": "Desempenho técnico", "TXT": "Volume do texto", "MUL": "Multimídia",
         "TAR": "Tarefas do teste"}

# ---- caracterização (categorias agrupadas)
CART = ("cartogr", "agrimens", "geodés", "geodes", "geograf", "geógraf")


def g_idade(v):
    v = str(v).strip()
    if v.startswith("18"):
        return "18–24 anos"
    if v.startswith("24") or v.startswith("25"):
        return "25–34 anos"  # «24 - 34 anos» tratado como a faixa 25–34
    return "35 anos ou mais"


def g_form(v):
    v = str(v).strip().lower()
    return "Pós-graduação" if any(k in v for k in ("mestrado", "doutorado", "pós", "especializ")) else "Até a graduação"


def g_area(v):
    v = str(v).strip().lower()
    return "Cartografia, agrimensura e geografia" if any(k in v for k in CART) else "Outras áreas"


def g_freq(v):
    return "Muito frequentemente" if str(v).strip().lower() == "muito frequentemente" else "Frequentemente ou menos"


def g_sm(v):
    v = str(v).strip().lower()
    return {"nunca": "Nunca", "1 ou 2 vezes": "1 ou 2 vezes"}.get(v, "Algumas ou muitas vezes")


def g_tela(v, disp):
    v = str(v).replace(",", ".").lower()
    if disp == "smartphone":
        return "Até 6,5\"" if ("até 6.0" in v or "6.1" in v) else "Acima de 6,5\""
    if "11" in v or "13" in v:
        return "Até 14\""
    if "15" in v:
        return "15\" a 16\""
    return "17\" ou mais"


def g_nav(v):
    v = str(v).strip().lower()
    return "Chrome" if "chrome" in v else ("Safari" if "safari" in v else "Outros")


perfis, sem_perfil = {}, []
if a.caracterizacao and not a.sem_caracterizacao:
    xl = pd.ExcelFile(a.caracterizacao)
    disp_inv = dict(zip(inv.sessao_id, inv.dispositivo))
    for aba in xl.sheet_names:
        c = pd.read_excel(xl, sheet_name=aba)
        c.columns = ["sid", "data", "hora", "tela", "nav", "idade", "form", "freq", "sm", "area"][:len(c.columns)]
        for r in c.itertuples():
            sid = str(r.sid).strip()
            if sid not in disp_inv:
                sem_perfil.append(sid)
                continue
            d = disp_inv[sid]
            perfis[sid] = {"idade": g_idade(r.idade), "form": g_form(r.form), "area": g_area(r.area),
                           "freq": g_freq(r.freq), "sm": g_sm(r.sm), "tela": g_tela(r.tela, d), "nav": g_nav(r.nav)}

cb = cob.set_index("sessao_id")

# ---- PostHog (exportação bruta, uma aba por sessão)
ph_info = {}
ph_resumo = {}
if a.posthog and a.telemetria:
    import re
    T = Path(a.telemetria)
    xl = pd.ExcelFile(a.posthog)
    ph = pd.concat([pd.read_excel(xl, sheet_name=sh).assign(sid=sh.strip()) for sh in xl.sheet_names], ignore_index=True)
    ph["ts"] = pd.to_datetime(ph.timestamp)
    ph["linha_excel"] = ph.groupby("sid").cumcount() + 2  # referência usada em acoes_normalizadas.ref_ph
    acoes = pd.read_csv(T / "acoes_normalizadas.csv")
    usados = set(acoes.ref_ph.dropna())
    ph["usado"] = (ph.sid + ":" + ph.linha_excel.astype(str)).isin(usados)
    disp_inv = dict(zip(inv.sessao_id, inv.dispositivo))
    ph["disp"] = ph.sid.map(disp_inv)
    # só eventos do aparelho da pessoa participante (a exportação traz também eventos de outros aparelhos)
    ph["do_participante"] = ((ph.disp == "smartphone") & (ph.device_type == "Mobile")) | \
                            ((ph.disp == "desktop") & (ph.device_type == "Desktop")) | (ph.sid == "wqb-asmg-iyh")
    # janelas das tarefas: início = primeiro horário da apresentação − tolerância; fim = último horário do encerramento + tolerância
    jan = pd.read_csv(T / "janelas_das_tarefas.csv")
    dia = ph.groupby("sid").ts.min().dt.normalize()

    def faixa(txt, primeiro):
        if not isinstance(txt, str):
            return None
        hs = re.findall(r"(\d{1,2}:\d{2}:\d{2})", txt)
        tol = re.findall(r"±\s*(\d+)\s*s", txt)
        if not hs:
            return None
        return pd.to_timedelta(hs[0 if primeiro else -1]) + pd.to_timedelta((-1 if primeiro else 1) * (int(tol[0]) if tol else 0), unit="s")

    W = []
    for r in jan.itertuples():
        if r.sessao_id in dia:
            i, f = faixa(r.apresentacao, True), faixa(r.encerramento, False)
            if i is not None and f is not None:
                W.append((r.sessao_id, r.tarefa, dia[r.sessao_id] + i, dia[r.sessao_id] + f))
    W = pd.DataFrame(W, columns=["sid", "tarefa", "ini", "fim"])

    def grupo_nav(b):
        b = str(b).lower()
        return "Chrome" if "chrome" in b else ("Safari" if "safari" in b else "Outros")

    def grupo_vw(v, d):
        if d == "smartphone":
            return "até 384 px" if v <= 384 else ("390–402 px" if v <= 402 else "acima de 402 px")
        return "até 1366 px" if v <= 1366 else ("1367–1919 px" if v < 1920 else "1920 px ou mais")

    for sid, g in ph[ph.do_participante].groupby("sid"):
        w = W[W.sid == sid]
        rec = {}
        n_teste = 0
        no_teste = 0
        if len(w):
            ini, fim = w.ini.min(), w.fim.max()
            no_teste = int(((g.ts >= ini) & (g.ts <= fim)).sum())
            for t in g[(g.event == "$pageview") & (g.ts >= ini) & (g.ts <= fim)].ts:
                n_teste += 1
                cand = w[(w.ini <= t) & (w.fim >= t)]
                if len(cand):
                    c = cand.ini + (cand.fim - cand.ini) / 2
                    tk = cand.loc[(c - t).abs().idxmin(), "tarefa"]
                    rec[tk] = rec.get(tk, 0) + 1
        so = g.operating_system.mode().iat[0]
        nav = g.browser.mode().iat[0]
        vw = float(g.viewport_width.median())
        alinhado = bool(cb.loc[sid, "posthog_relogio_alinhado"]) if sid in cb.index else False
        cobre = (bool(cb.loc[sid, "posthog_na_janela"]) if sid in cb.index else False) or no_teste > 0
        ph_info[sid] = {"eventos": int(len(g)), "eventos_no_teste": no_teste, "cob": cobre, "relogio_alinhado": alinhado,
                        "usados": int(g.usado.sum()),
                        "recargas": (n_teste if (cobre and alinhado) else None),
                        "recargas_tarefa": (rec if (cobre and alinhado) else None), "so": so, "nav": nav, "vw": int(vw),
                        "so_g": {"Mac OS X": "macOS"}.get(so, so), "nav_g": grupo_nav(nav), "vw_g": grupo_vw(vw, disp_inv[sid])}
    ph_resumo = {"eventos_exportados": int(len(ph)), "eventos_ja_usados": int(ph.usado.sum()),
                 "sessoes_na_exportacao": int(ph.sid.nunique()),
                 "eventos_outro_aparelho": int((~ph.do_participante).sum())}

# ---- sessões
sat = ses_sat.set_index("sessao_id")
nas = nasa.set_index("sessao_id")
cb = cob.set_index("sessao_id")
temas = {}
for r in evid.itertuples():
    cls, pol = r.classificacao, r.polaridade
    if cls in ("Avaliação global", "Avaliação de um aspecto", "Reação local") and pol == "positiva":
        k = "pos"
    elif cls in ("Avaliação global", "Avaliação de um aspecto", "Reação local") and pol in ("negativa", "mista"):
        k = "crit"
    elif cls == "Sugestão ou observação":
        k = "sug"
    else:
        continue
    for t in str(r.temas).split(";"):
        if t in TEMAS:
            temas.setdefault(r.sessao_id, {"pos": set(), "crit": set(), "sug": set()})[k].add(t)

def perfil_com_ph(sid):
    p = dict(perfis.get(sid) or {})
    if not p and not ph_info:
        return None
    i = ph_info.get(sid)
    p["so_ph"] = i["so_g"] if i else "Sem PostHog"
    p["nav_ph"] = i["nav_g"] if i else "Sem PostHog"
    p["vw_ph"] = i["vw_g"] if i else "Sem PostHog"
    if i and "nav" in p:
        p["nav_confere"] = p["nav"] == i["nav_g"]
    return p


sessoes = []
for r in inv.sort_values("sessao_id").itertuples():
    s = sat.loc[r.sessao_id]
    pol = s.polaridade_global if isinstance(s.polaridade_global, str) else s.polaridade_aspectos
    t = temas.get(r.sessao_id, {"pos": set(), "crit": set(), "sug": set()})
    n = nas.loc[r.sessao_id]
    sessoes.append({
        "id": r.sessao_id, "disp": r.dispositivo, "amostra": r.status_amostra,
        "motivo": r.motivo_triagem if isinstance(r.motivo_triagem, str) else "",
        "js": bool(cb.loc[r.sessao_id, "js"]), "ph": bool(cb.loc[r.sessao_id, "posthog_na_janela"]),
        "sat": {"status": s.status_sessao, "pol": pol, "ressalva": s.tem_ressalva == "sim"},
        "nasa": {k: val(n[f"nasa_{k}"]) for k in ["mental", "fisica", "temporal", "desempenho", "esforco", "frustracao"]},
        "temas": {k: sorted(v) for k, v in t.items()},
        "perfil": perfil_com_ph(r.sessao_id),
        "ph": ph_info.get(r.sessao_id),
    })

# ---- tarefas
G = {"zoom": "g_zoom_botoes", "modo": "g_alternancias_modo", "camadas": "g_camadas", "imagens": "g_imagens_abertas",
     "pins": "g_pins", "mapa": "g_toques_cliques_mapa", "audio": "g_audio", "fora": "eventos_fora_do_capitulo"}
tarefas = []
for r in res.itertuples():
    tarefas.append({
        "s": r.sessao_id, "t": r.tarefa, "res": r.eficacia_resultado, "ajuda": r.eficacia_assistencia,
        "estrato": r.estrato, "inter": r.interacao_esperada_observada, "enc": r.tipo_encerramento,
        "prec": r.precisao_tempo, "tc": val(r.tempo_conclusao_s), "te": val(r.tempo_ate_encerramento_s),
        "li": val(r.tempo_ajustado_lim_inf_s), "ls": val(r.tempo_ajustado_lim_sup_s),
        "g": {k: val(getattr(r, c)) for k, c in G.items()},
    })

# ---- episódios (compatíveis e contados)
e = epi[(epi.evidencia == "localizada e compatível") & (epi.conta_ocorrencia == True)]
episodios = [{"s": r.sessao_id, "t": r.tarefa, "p": r.padrao, "imp": r.impacto, "fase": r.fase} for r in e.itertuples()]
padroes = dict(sorted({(r.padrao, r.padrao_nome) for r in e.itertuples()}))

diretrizes = [] if not a.com_diretrizes else [{"id": r.id, "prioridade": str(r.prioridade), "padroes": [p.strip() for p in str(r.padroes).split(";")],
               "alteracao": str(r.alteracao), "teste": str(r.teste)} for r in dirs.itertuples()]

dados = {
    "meta": {"gerado_em": date.today().isoformat(), "provisorio": bool(res.provisorio.all()),
             "fontes": ["dados_quantitativos/inventario_sessoes.csv", "dados_quantitativos/resultados_individuais.csv",
                        "dados_quantitativos/nasa_sessao.csv", "dados_quantitativos/cobertura.csv",
                        "Consolidado_friccoes.xlsx (Episódios consolidados, Diretrizes)",
                        "Satisfacao_Story_Map.xlsx (Sessões e cobertura, Evidências)"]
             + (["caracterizacao.xlsx (categorias agrupadas)"] if perfis else [])
             + (["sessoes_posthog.xlsx (exportação do PostHog)"] if ph_info else []),
             "posthog": ph_resumo},
    "temas": TEMAS, "padroes": padroes, "sessoes": sessoes, "tarefas": tarefas,
    "episodios": episodios, "diretrizes": diretrizes,
}
out = Path(a.saida)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("// Gerado por scripts/gerar_dados.py — não edite à mão.\nwindow.DADOS = "
               + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
if a.caracterizacao and not a.sem_caracterizacao:
    print(f"perfil: {len(perfis)} sessões; sem correspondência no inventário: {sem_perfil}; sem perfil: {[x['id'] for x in sessoes if not x['perfil']]}")
if ph_info:
    print("PostHog:", ph_resumo, "| sessões com eventos do participante:", len(ph_info),
          "| com eventos durante o teste:", sum(1 for v in ph_info.values() if v["cob"]),
          "| sem:", [k for k, v in ph_info.items() if not v["cob"]],
          "| relógio alinhado:", sum(1 for v in ph_info.values() if v["cob"] and v["relogio_alinhado"]),
          "| com recarga no teste:", sum(1 for v in ph_info.values() if v["recargas"]))
print(f"{out}: {len(sessoes)} sessões, {len(tarefas)} tarefas, {len(episodios)} episódios, {out.stat().st_size/1024:.0f} KB")
