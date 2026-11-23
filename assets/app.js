/* Painel de usabilidade — estado, agregações e renderização. */
(function () {
  "use strict";
  const D = window.DADOS;
  const G = window.Graf;
  const { h, nf, pf } = G;

  const DISP = [
    { chave: "desktop", rotulo: "Desktop", classe: "desktop", curto: "D" },
    { chave: "smartphone", rotulo: "Smartphone", classe: "smartphone", curto: "S" },
  ];
  const TAREFAS = [
    { chave: "T1", rotulo: "T1 · Paranaguá", rotuloLongo: "T1 · Localizar Paranaguá no mapa histórico", esperado: "zoom" },
    { chave: "T2", rotulo: "T2 · Imagem", rotuloLongo: "T2 · Ver mais detalhes da obra de Poty (ampliar a imagem)", esperado: "imagens" },
    { chave: "T3", rotulo: "T3 · Reservatório", rotuloLongo: "T3 · Localizar o primeiro reservatório de água", esperado: "modo" },
    { chave: "T4", rotulo: "T4 · Mapa de 1927", rotuloLongo: "T4 · Rua com outro nome em 1927 (camadas)", esperado: "camadas" },
    { chave: "T5", rotulo: "T5 · Parques e rios", rotuloLongo: "T5 · Parques atravessados pelos rios", esperado: "modo" },
    { chave: "T6", rotulo: "T6 · Áudio", rotuloLongo: "T6 · Ouvir o áudio sobre Poty e voltar ao início", esperado: "audio" },
  ];
  const INTERACOES = [
    { chave: "zoom", rotulo: "Botões de zoom" }, { chave: "modo", rotulo: "Ver mapa / Ver história" },
    { chave: "camadas", rotulo: "Camadas" }, { chave: "imagens", rotulo: "Imagens abertas" },
    { chave: "pins", rotulo: "Pins" }, { chave: "mapa", rotulo: "Toques/cliques no mapa" },
    { chave: "audio", rotulo: "Áudio" }, { chave: "fora", rotulo: "Fora do capítulo" },
  ];
  const NASA = [
    { chave: "mental", rotulo: "Mental" }, { chave: "fisica", rotulo: "Física" }, { chave: "temporal", rotulo: "Temporal" },
    { chave: "esforco", rotulo: "Esforço" }, { chave: "frustracao", rotulo: "Frustração" },
    { chave: "desempenho", rotulo: "Desempenho*", destaque: true },
  ];
  const PRECISAO_PONTUAL = new Set(["segundos", "aproximada"]);
  const minusc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const pct = (n, N) => (N ? pf.format(n / N) : "—");
  const frac = (n, N) => `${pct(n, N)} · ${n}/${N}`;

  function quantil(arr, q) {
    const a = arr.filter((v) => v !== null && v !== undefined && !Number.isNaN(v)).sort((x, y) => x - y);
    if (!a.length) return null;
    const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }
  const mediana = (a) => quantil(a, 0.5);
  const media = (a) => { const b = a.filter((v) => v !== null && v !== undefined); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; };

  /* ---------- estado (também na URL, para compartilhar) ---------- */
  const qs = new URLSearchParams(location.search);
  const estado = {
    disp: ["ambos", "desktop", "smartphone"].includes(qs.get("disp")) ? qs.get("disp") : "ambos",
    amostra: qs.get("amostra") === "todas" ? "todas" : "elegível",
  };
  document.querySelectorAll('input[name="disp"]').forEach((i) => { i.checked = i.value === estado.disp; });
  document.querySelectorAll('input[name="amostra"]').forEach((i) => { i.checked = i.value === estado.amostra; });
  document.querySelector(".filtros").addEventListener("change", (e) => {
    if (e.target.name === "disp" || e.target.name === "amostra") {
      estado[e.target.name] = e.target.value;
      const p = new URLSearchParams(location.search);
      p.delete("disp"); p.delete("amostra");
      if (estado.disp !== "ambos") p.set("disp", estado.disp);
      if (estado.amostra !== "elegível") p.set("amostra", estado.amostra);
      history.replaceState(null, "", p.toString() ? "?" + p : location.pathname);
      render();
    }
  });

  /* ---------- recorte ---------- */
  function recorte() {
    const sess = D.sessoes.filter((s) => (estado.amostra === "todas" || s.amostra === "elegível") && (estado.disp === "ambos" || s.disp === estado.disp));
    const ids = new Set(sess.map((s) => s.id));
    const porId = Object.fromEntries(D.sessoes.map((s) => [s.id, s]));
    const tarefas = D.tarefas.filter((t) => ids.has(t.s)).map((t) => Object.assign({ disp: porId[t.s].disp }, t));
    const epis = D.episodios.filter((e) => ids.has(e.s)).map((e) => Object.assign({ disp: porId[e.s].disp }, e));
    const series = DISP.filter((d) => estado.disp === "ambos" || d.chave === estado.disp);
    return { sess, tarefas, epis, series, porDisp: (lista, d) => lista.filter((x) => x.disp === d) };
  }

  const phCobre = (x) => x.ph && x.ph.cob;
  const phAlinhado = (x) => x.ph && x.ph.cob && x.ph.recargas !== null && x.ph.recargas !== undefined;

  /* ---------- KPIs ---------- */
  function kpis(R) {
    const box = document.getElementById("kpis");
    box.replaceChildren();
    const defs = [
      { rotulo: "Sessões", f: (d) => { const n = R.porDisp(R.sess, d).length; return { v: String(n), base: estado.amostra === "todas" ? "todas as sessões coletadas" : "sessões elegíveis" }; } },
      { rotulo: "Tarefas concluídas", f: (d) => { const t = R.porDisp(R.tarefas, d); const n = t.filter((x) => x.res === "completo").length; return { v: pct(n, t.length), base: `${n}/${t.length} tarefas` }; } },
      { rotulo: "Interação esperada observada", f: (d) => { const t = R.porDisp(R.tarefas, d).filter((x) => x.inter === "sim" || x.inter === "não"); const n = t.filter((x) => x.inter === "sim").length; return { v: pct(n, t.length), base: `${n}/${t.length} tarefas observáveis` }; } },
      { rotulo: "Mediana do tempo de conclusão", f: (d) => { const v = R.porDisp(R.tarefas, d).filter((x) => x.tc !== null && PRECISAO_PONTUAL.has(x.prec)).map((x) => x.tc); const m = mediana(v); return { v: m === null ? "—" : nf.format(Math.round(m)) + " s", base: `${v.length} tarefas com tempo pontual` }; } },
      { rotulo: "Sessões com fricção grave", f: (d) => { const s = R.porDisp(R.sess, d); const g = new Set(R.porDisp(R.epis, d).filter((e) => e.imp === "grave").map((e) => e.s)); return { v: pct(g.size, s.length), base: `${g.size}/${s.length} sessões com ≥1 episódio grave` }; } },
      { rotulo: "Avaliação global positiva", f: (d) => { const s = R.porDisp(R.sess, d); const n = s.filter((x) => x.sat.status === "avaliação global" && x.sat.pol === "positiva").length; return { v: pct(n, s.length), base: `${n}/${s.length} sessões` }; } },
      { rotulo: "Recarregamento da página (PostHog)", f: (d) => { const s = R.porDisp(R.sess, d).filter(phAlinhado); const n = s.filter((x) => x.ph.recargas > 0).length; return { v: s.length ? pct(n, s.length) : "—", base: `${n}/${s.length} sessões com PostHog alinhado` }; } },
      { rotulo: "Frustração (NASA-TLX, mediana)", f: (d) => { const v = R.porDisp(R.sess, d).map((x) => x.nasa.frustracao); const m = mediana(v); return { v: m === null ? "—" : nf.format(m), base: "escala 1–20; maior = mais frustração" }; } },
    ];
    for (const k of defs) {
      const c = h("div", { class: "kpi" }, box);
      h("p", { class: "rotulo-kpi" }, c, k.rotulo);
      const vs = h("div", { class: "valores" }, c);
      const bases = [];
      for (const d of R.series) {
        const r = k.f(d.chave);
        const w = h("div", {}, vs);
        h("div", { class: "valor" }, w, r.v);
        const dd = h("div", { class: "disp" }, w);
        h("i", { class: `chave chave-${d.classe}` }, dd);
        dd.appendChild(document.createTextNode(d.rotulo));
        bases.push(R.series.length > 1 ? `${d.curto}: ${r.base}` : r.base);
      }
      const unicas = [...new Set(bases.map((b) => b.replace(/^[DS]: /, "")))];
      h("p", { class: "base" }, c, unicas.length === 1 ? unicas[0] : bases.join(" · "));
    }
  }

  /* ---------- Eficácia ---------- */
  function eficacia(R) {
    const fig = document.getElementById("c-conclusao");
    const corpo = G.cartao(fig, { titulo: "Tarefas concluídas", sub: "Proporção de sessões que concluíram cada tarefa (resultado «completo»).", series: R.series });
    G.barrasH(corpo, {
      linhas: TAREFAS, series: R.series, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], formato: (v) => pf.format(v), espacoValor: 92,
      aria: "Barras de conclusão por tarefa e dispositivo",
      valor: (l, se) => {
        const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === l.chave);
        if (!t.length) return null;
        const n = t.filter((x) => x.res === "completo").length;
        return { v: n / t.length, texto: frac(n, t.length), tip: { titulo: l.rotuloLongo, linhas: [{ classe: se.classe, valor: pct(n, t.length), rotulo: `${se.rotulo} · ${n}/${t.length}` }], extra: `Não alcançadas: ${t.filter((x) => x.res === "não alcançado").length} · indeterminadas: ${t.filter((x) => x.res === "indeterminado").length}` } };
      },
    });
    const linhas = [];
    for (const tk of TAREFAS) for (const se of R.series) {
      const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === tk.chave);
      const c = (f) => t.filter(f).length;
      linhas.push([tk.rotulo, se.rotulo, c((x) => x.res === "completo"), c((x) => x.estrato === "não alcançado"), c((x) => x.estrato === "não alcançado (pulada)"),
        c((x) => x.res === "indeterminado"), c((x) => x.estrato === "impedida (falha técnica)"), c((x) => x.ajuda === "com ajuda"), t.length]);
    }
    G.tabela(fig, ["Tarefa", "Dispositivo", "Completas", "Não alcançadas", "Puladas", "Indeterminadas", "Impedidas", "Com ajuda", "Total"], linhas, { num: [2, 3, 4, 5, 6, 7, 8] });
    G.nota(fig, "Denominador: todas as tarefas do recorte. «Puladas» e «impedidas» estão contidas nas não alcançadas e indeterminadas, conforme o estrato de origem.");

    const fig2 = document.getElementById("c-interacao");
    const corpo2 = G.cartao(fig2, { titulo: "Interação esperada observada", sub: "Uso do controle previsto em cada tarefa (zoom, imagem, Ver mapa, camadas, áudio). Na pesquisa, é o que mais se espera da tarefa.", series: R.series });
    G.barrasH(corpo2, {
      linhas: TAREFAS, series: R.series, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], formato: (v) => pf.format(v), espacoValor: 92,
      aria: "Barras de interação esperada por tarefa e dispositivo",
      valor: (l, se) => {
        const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === l.chave);
        const ob = t.filter((x) => x.inter === "sim" || x.inter === "não");
        if (!ob.length) return null;
        const n = ob.filter((x) => x.inter === "sim").length;
        return { v: n / ob.length, texto: frac(n, ob.length), tip: { titulo: l.rotuloLongo, linhas: [{ classe: se.classe, valor: pct(n, ob.length), rotulo: `${se.rotulo} · ${n}/${ob.length}` }], extra: `Não observável: ${t.length - ob.length}` } };
      },
    });
    const l2 = [];
    for (const tk of TAREFAS) for (const se of R.series) {
      const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === tk.chave);
      l2.push([tk.rotulo, se.rotulo, t.filter((x) => x.inter === "sim").length, t.filter((x) => x.inter === "não").length, t.filter((x) => x.inter === "não observável").length]);
    }
    G.tabela(fig2, ["Tarefa", "Dispositivo", "Sim", "Não", "Não observável"], l2, { num: [2, 3, 4] });
    G.nota(fig2, "Denominador: tarefas em que a interação era observável (sim + não).");

    /*const fig3 = document.getElementById("c-condicional");
    fig3.replaceChildren();
    const cap = h("figcaption", {}, fig3);
    h("h3", {}, cap, "Conclusão conforme o uso da interação esperada");
    h("p", { class: "sub" }, cap, "Quem usou o controle previsto concluiu mais? Associação descritiva, sem teste estatístico.");
    const cab = ["Tarefa"];
    for (const se of R.series) cab.push(`${se.rotulo}: usou`, `${se.rotulo}: não usou`);
    const l3 = TAREFAS.map((tk) => {
      const row = [tk.rotulo];
      for (const se of R.series) {
        const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === tk.chave);
        for (const cond of ["sim", "não"]) {
          const c = t.filter((x) => x.inter === cond);
          const n = c.filter((x) => x.res === "completo").length;
          row.push(c.length ? `${n}/${c.length} (${pct(n, c.length)})` : "—");
        }
      }
      return row;
    });
    const w = h("div", { class: "rolagem" }, fig3);
    const tb = h("table", {}, w);
    const tr = h("tr", {}, h("thead", {}, tb));
    cab.forEach((c, i) => h("th", { scope: "col", class: i ? "num" : "" }, tr, c));
    const body = h("tbody", {}, tb);
    for (const r of l3) { const rr = h("tr", {}, body); r.forEach((c, i) => h("td", { class: i ? "num" : "" }, rr, c)); }
    G.nota(fig3, "Cada célula: concluídas / tarefas com aquela condição. Tarefas com interação não observável ficam fora. Interação esperada: T1 botões de zoom; T2 abrir a imagem; T3 e T5 Ver mapa; T4 camadas; T6 áudio e retorno ao início.");
  */
  }

  /* ---------- Eficiência ---------- */
  function eficiencia(R) {
    const fig = document.getElementById("c-tempos");
    const corpo = G.cartao(fig, { titulo: "Tempo de conclusão por tarefa", sub: "Cada ponto é uma tarefa concluída com tempo pontual (precisão em segundos ou aproximada). Traço = mediana.", series: R.series, marca: "ponto" });
    const pontos = (tk, se) => R.porDisp(R.tarefas, se.chave).filter((x) => x.t === tk.chave && x.tc !== null && PRECISAO_PONTUAL.has(x.prec))
      .map((x) => ({ v: x.tc, rotulo: x.s, extra: `precisão: ${x.prec}` }));
    const todos = R.tarefas.filter((x) => x.tc !== null && PRECISAO_PONTUAL.has(x.prec)).map((x) => x.tc);
    const max = Math.max(120, Math.ceil((Math.max(0, ...todos) + 10) / 60) * 60);
    const ticks = []; for (let t = 0; t <= max; t += max > 360 ? 120 : 60) ticks.push(t);
    G.tira(corpo, {
      grupos: TAREFAS, series: R.series, max, ticks, formato: (v) => `${v} s`, altura: 320, aria: "Tempos de conclusão por tarefa",
      pontos, mediana: (tk, se) => mediana(pontos(tk, se).map((p) => p.v)),
    });
    const linhas = [];
    for (const tk of TAREFAS) for (const se of R.series) {
      const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === tk.chave);
      const p = t.filter((x) => x.tc !== null && PRECISAO_PONTUAL.has(x.prec)).map((x) => x.tc);
      const baixa = t.filter((x) => x.tc !== null && x.prec === "baixa").length;
      const lim = t.filter((x) => x.prec === "somente limites");
      const te = t.filter((x) => x.te !== null).map((x) => x.te);
      const f = (v) => (v === null ? "—" : nf.format(Math.round(v)));
      linhas.push([tk.rotulo, se.rotulo, p.length, f(mediana(p)), p.length ? `${f(quantil(p, 0.25))}–${f(quantil(p, 0.75))}` : "—", baixa,
        lim.length, lim.length ? `${f(mediana(lim.map((x) => x.li)))}–${f(mediana(lim.map((x) => x.ls)))}` : "—", te.length, f(mediana(te))]);
    }
    G.tabela(fig, ["Tarefa", "Dispositivo", "n pontual", "Mediana (s)", "Q1–Q3 (s)", "Conclusão c/ precisão baixa", "Só limites (n)", "Limites medianos (s)", "Até encerramento (n)", "Mediana até encerramento (s)"], linhas, { num: [2, 3, 4, 5, 6, 7, 8, 9] });
    G.nota(fig, "Bases separadas: tempo de conclusão (tarefas concluídas), tempo até encerramento (desistência, pulo ou encerramento indeterminado — não é tempo de conclusão) e tarefas só com limites. Tempos de precisão baixa ou só com limites ficam fora das estatísticas pontuais e aparecem contados à parte.");
  }

  /* ---------- Interações (telemetria) ---------- */
  function interacoes(R) {
    const fig = document.getElementById("c-telemetria");
    const corpo = G.cartao(fig, { titulo: "Tarefas com ao menos um evento de cada tipo", sub: "Intensidade = proporção das tarefas com cobertura de telemetria em que o evento ocorreu. Contorno = interação esperada na tarefa." });
    const wrap = h("div", { class: "grade" }, corpo);
    const linhasTab = [];
    const ROTW = 170;
    const areas = R.series.map((se) => {
      const painel = h("div", {}, wrap);
      const tit = h("p", { class: "sub" }, painel);
      h("i", { class: `chave chave-${se.classe}` }, tit);
      tit.appendChild(document.createTextNode(" " + se.rotulo));
      return h("div", { class: "grafico" }, painel);
    });
    R.series.forEach((se, k) => {
      const area = areas[k];
      const svg = G.calor(area, {
        linhas: INTERACOES, colunas: TAREFAS.map((t) => ({ chave: t.chave, rotulo: t.chave })), classe: se.classe, rotW: ROTW,
        aria: `Mapa de calor de interações, ${se.rotulo}`,
        valor: (l, c) => {
          const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === c.chave && x.g[l.chave] !== null && x.g[l.chave] !== undefined);
          if (!t.length) return null;
          const usos = t.filter((x) => x.g[l.chave] > 0);
          const med = mediana(usos.map((x) => x.g[l.chave]));
          return { v: usos.length / t.length, texto: pct(usos.length, t.length),
            tip: { titulo: `${l.rotulo} · ${TAREFAS.find((x) => x.chave === c.chave).rotuloLongo}`, linhas: [{ classe: se.classe, valor: pct(usos.length, t.length), rotulo: `${usos.length}/${t.length} tarefas` }], extra: usos.length ? `Mediana entre quem usou: ${nf.format(med)} eventos` : "Nenhum evento" } };
        },
      });
      // contorno nas interações esperadas
      const W = svg.viewBox.baseVal.width, esq = Math.min(ROTW, W * 0.42), cw = (W - esq) / TAREFAS.length;
      TAREFAS.forEach((tk, j) => {
        const i = INTERACOES.findIndex((x) => x.chave === tk.esperado);
        G.s("rect", { x: esq + cw * j + 1, y: 22 + i * 30 + 1, width: cw - 2, height: 28, rx: 4, fill: "none", stroke: "var(--ink)", "stroke-width": 1.5, "pointer-events": "none" }, svg);
      });
      for (const l of INTERACOES) {
        const row = [se.rotulo, l.rotulo];
        for (const tk of TAREFAS) {
          const t = R.porDisp(R.tarefas, se.chave).filter((x) => x.t === tk.chave && x.g[l.chave] !== null && x.g[l.chave] !== undefined);
          row.push(t.length ? `${t.filter((x) => x.g[l.chave] > 0).length}/${t.length}` : "—");
        }
        linhasTab.push(row);
      }
    });
    G.tabela(fig, ["Dispositivo", "Evento", ...TAREFAS.map((t) => t.chave)], linhasTab, { num: [2, 3, 4, 5, 6, 7] });
    G.nota(fig, "Fonte: telemetria JavaScript/PostHog normalizada por tarefa. «—» = nenhuma tarefa com cobertura. O evento de áudio quase não é capturado pela telemetria: a ausência dele não indica que o áudio não foi ouvido (compare com a interação esperada da T6, observada no vídeo e no roteiro).");
  }

  /* ---------- PostHog: cobertura e recarregamentos ---------- */
  function posthog(R) {
    const fig = document.getElementById("c-posthog");
    if (!fig) return;
    if (!D.sessoes.some((x) => x.ph)) { fig.hidden = true; return; }
    const corpo = G.cartao(fig, { titulo: "PostHog: cobertura e recarregamentos da página", sub: "Exportação do PostHog por sessão, só com eventos do aparelho da pessoa participante. Recarregamento = nova carga da página entre o início da T1 e o fim da T6.", series: R.series });
    const LIN = [
      { chave: "cob", rotulo: "PostHog registrou o teste", f: (S) => ({ n: S.filter(phCobre).length, N: S.length }) },
      { chave: "ali", rotulo: "Relógio alinhado às tarefas", f: (S) => ({ n: S.filter(phAlinhado).length, N: S.length }) },
      { chave: "rec", rotulo: "Recarregou durante o teste", f: (S) => { const A = S.filter(phAlinhado); return { n: A.filter((x) => x.ph.recargas > 0).length, N: A.length }; } },
      { chave: "tar", rotulo: "Recarregou dentro de uma tarefa", f: (S) => { const A = S.filter(phAlinhado); return { n: A.filter((x) => Object.keys(x.ph.recargas_tarefa || {}).length).length, N: A.length }; } },
    ];
    G.barrasH(corpo, {
      linhas: LIN, series: R.series, max: 1, ticks: [0, 0.5, 1], formato: (v) => pf.format(v), espacoValor: 92,
      valor: (l, se) => { const r = l.f(R.porDisp(R.sess, se.chave)); return r.N ? { v: r.n / r.N, texto: frac(r.n, r.N) } : null; },
    });
    const cab = ["Tarefa", ...R.series.map((se) => `${se.rotulo}: sessões com recarga`)];
    const linhas = TAREFAS.map((tk) => [tk.rotulo, ...R.series.map((se) => { const A = R.porDisp(R.sess, se.chave).filter(phAlinhado); return `${A.filter((x) => (x.ph.recargas_tarefa || {})[tk.chave]).length}/${A.length}`; })]);
    linhas.push(["Entre tarefas", ...R.series.map((se) => { const A = R.porDisp(R.sess, se.chave).filter(phAlinhado); return `${A.filter((x) => x.ph.recargas > Object.values(x.ph.recargas_tarefa || {}).reduce((a, b) => a + b, 0)).length}/${A.length}`; })]);
    const conf = R.sess.filter((x) => x.perfil && typeof x.perfil.nav_confere === "boolean");
    linhas.push(["Navegador informado = registrado", ...R.series.map((se) => { const c = conf.filter((x) => x.disp === se.chave); return `${c.filter((x) => x.perfil.nav_confere).length}/${c.length}`; })]);
    G.tabela(fig, cab, linhas, { num: R.series.map((_, i) => i + 1) });
    const M = D.meta.posthog || {};
    G.nota(fig, `A exportação tem ${nf.format(M.eventos_exportados || 0)} eventos de ${M.sessoes_na_exportacao || 0} sessões; ${nf.format(M.eventos_ja_usados || 0)} já estavam na análise de telemetria e ${M.eventos_outro_aparelho || 0} vieram de outro aparelho e ficam fora. Os demais caem antes ou depois do teste, em sessões excluídas ou são recargas — nenhum altera as contagens por tarefa. Recarga pode ser manual ou do navegador ao voltar de outro aplicativo (como a chamada); o PostHog não distingue.`);
  }

  /* ---------- Fricções ---------- */
  function friccoes(R) {
    const sessN = (d) => R.porDisp(R.sess, d).length;
    const comPadrao = (d, p) => new Set(R.porDisp(R.epis, d).filter((e) => e.p === p).map((e) => e.s)).size;
    const pads = Object.keys(D.padroes).map((p) => ({ chave: p, rotulo: `${p} ${D.padroes[p]}`, rotuloLongo: `${p} · ${D.padroes[p]}` }));
    const total = (p) => R.series.reduce((a, se) => a + (sessN(se.chave) ? comPadrao(se.chave, p.chave) / sessN(se.chave) : 0), 0);
    pads.sort((a, b) => (a.chave === "P99") - (b.chave === "P99") || total(b) - total(a));
    const fig = document.getElementById("c-padroes");
    const corpo = G.cartao(fig, { titulo: "Padrões de fricção: sessões afetadas", sub: "Proporção de sessões com ao menos um episódio do padrão (evidência compatível, contado como ocorrência).", series: R.series });
    G.barrasH(corpo, {
      linhas: pads, series: R.series, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], formato: (v) => pf.format(v), espacoValor: 92, fracRotulo: 0.5,
      aria: "Barras de sessões afetadas por padrão de fricção",
      valor: (l, se) => { const N = sessN(se.chave); if (!N) return null; const n = comPadrao(se.chave, l.chave); return { v: n / N, texto: frac(n, N) }; },
    });
    G.tabela(fig, ["Padrão", ...R.series.flatMap((se) => [`${se.rotulo}: sessões`, `${se.rotulo}: episódios`, `${se.rotulo}: graves`])],
      pads.map((p) => [p.rotuloLongo, ...R.series.flatMap((se) => { const e = R.porDisp(R.epis, se.chave).filter((x) => x.p === p.chave); return [`${comPadrao(se.chave, p.chave)}/${sessN(se.chave)}`, e.length, e.filter((x) => x.imp === "grave").length]; })]),
      { num: R.series.flatMap((_, i) => [1 + i * 3, 2 + i * 3, 3 + i * 3]) });
    G.nota(fig, "Fonte: Episódios consolidados (Consolidado_friccoes.xlsx). Uma sessão conta uma vez por padrão.");

    const TAR = [...TAREFAS.map((t) => ({ chave: t.chave, rotulo: t.rotulo, rotuloLongo: t.rotuloLongo })),
      { chave: "fora_de_tarefa", rotulo: "Fora de tarefa", rotuloLongo: "Fora de tarefa (abertura, transições, exploração livre)" },
      { chave: "indeterminada", rotulo: "Tarefa indeterminada" }];
    const fig2 = document.getElementById("c-friccao-tarefa");
    const corpo2 = G.cartao(fig2, { titulo: "Fricção por tarefa", sub: "Proporção de sessões com ao menos um episódio na tarefa.", series: R.series });
    G.barrasH(corpo2, {
      linhas: TAR, series: R.series, max: 1, ticks: [0, 0.5, 1], formato: (v) => pf.format(v), espacoValor: 92,
      valor: (l, se) => { const N = sessN(se.chave); if (!N) return null; const n = new Set(R.porDisp(R.epis, se.chave).filter((e) => e.t === l.chave).map((e) => e.s)).size; return { v: n / N, texto: frac(n, N) }; },
    });
    G.tabela(fig2, ["Tarefa", ...R.series.map((se) => `${se.rotulo}: episódios`)], TAR.map((t) => [t.rotuloLongo || t.rotulo, ...R.series.map((se) => R.porDisp(R.epis, se.chave).filter((e) => e.t === t.chave).length)]), { num: R.series.map((_, i) => i + 1) });

    const IMP = [{ chave: "grave", rotulo: "Grave" }, { chave: "moderado", rotulo: "Moderado" }, { chave: "leve", rotulo: "Leve" }, { chave: "indeterminado", rotulo: "Indeterminado" }];
    const fig3 = document.getElementById("c-impacto");
    const corpo3 = G.cartao(fig3, { titulo: "Episódios por sessão, por impacto", sub: "Média de episódios contados por sessão do recorte.", series: R.series });
    const medias = IMP.flatMap((im) => R.series.map((se) => { const N = sessN(se.chave); return N ? R.porDisp(R.epis, se.chave).filter((e) => e.imp === im.chave).length / N : 0; }));
    const mx = Math.max(1, Math.ceil(Math.max(...medias)));
    G.barrasH(corpo3, {
      linhas: IMP, series: R.series, max: mx, ticks: [0, mx / 2, mx], formato: (v) => nf.format(v), espacoValor: 64,
      valor: (l, se) => { const N = sessN(se.chave); if (!N) return null; const e = R.porDisp(R.epis, se.chave).filter((x) => x.imp === l.chave); const ns = new Set(e.map((x) => x.s)).size;
        return { v: e.length / N, texto: nf.format(e.length / N), tip: { titulo: `Impacto ${l.rotulo.toLowerCase()}`, linhas: [{ classe: se.classe, valor: nf.format(e.length / N), rotulo: `${se.rotulo} · episódios por sessão` }], extra: `${e.length} episódios · ${ns}/${N} sessões com ≥1` } }; },
    });
    G.tabela(fig3, ["Impacto", ...R.series.flatMap((se) => [`${se.rotulo}: episódios`, `${se.rotulo}: sessões com ≥1`])],
      IMP.map((im) => [im.rotulo, ...R.series.flatMap((se) => { const e = R.porDisp(R.epis, se.chave).filter((x) => x.imp === im.chave); return [e.length, `${new Set(e.map((x) => x.s)).size}/${sessN(se.chave)}`]; })]),
      { num: R.series.flatMap((_, i) => [1 + i * 2, 2 + i * 2]) });
  }

  /* ---------- Satisfação ---------- */
  function satisfacao(R) {
    const CL = [
      { chave: "pos", rotulo: "Positiva", f: (s) => s.sat.status === "avaliação global" && s.sat.pol === "positiva" && !s.sat.ressalva },
      { chave: "posr", rotulo: "Positiva com ressalva", f: (s) => s.sat.status === "avaliação global" && s.sat.pol === "positiva" && s.sat.ressalva },
      { chave: "mis", rotulo: "Mista", f: (s) => s.sat.status === "avaliação global" && s.sat.pol === "mista" },
      { chave: "neg", rotulo: "Negativa", f: (s) => s.sat.status === "avaliação global" && s.sat.pol === "negativa" },
      { chave: "asp", rotulo: "Só por aspectos", f: (s) => s.sat.status === "avaliação por aspectos" },
    ];
    const fig = document.getElementById("c-polaridade");
    const corpo = G.cartao(fig, { titulo: "Avaliação global da experiência", sub: "Classificação de cada sessão pelo relato da entrevista, não pela contagem de falas.", series: R.series });
    G.barrasH(corpo, {
      linhas: CL, series: R.series, max: 1, ticks: [0, 0.5, 1], formato: (v) => pf.format(v), espacoValor: 92,
      valor: (l, se) => { const s = R.porDisp(R.sess, se.chave); if (!s.length) return null; const n = s.filter(l.f).length; return { v: n / s.length, texto: frac(n, s.length) }; },
    });
    G.tabela(fig, ["Classe", ...R.series.map((se) => se.rotulo)], CL.map((c) => [c.rotulo, ...R.series.map((se) => { const s = R.porDisp(R.sess, se.chave); return `${s.filter(c.f).length}/${s.length}`; })]), { num: R.series.map((_, i) => i + 1) });
    G.nota(fig, "«Só por aspectos»: a resposta à pergunta geral tratou apenas de aspectos. «Com ressalva»: juízo positivo dominante com reserva explícita na mesma resposta.");

    const fig2 = document.getElementById("c-temas");
    const corpo2 = G.cartao(fig2, { titulo: "Temas avaliados", sub: "Sessões com ao menos uma avaliação crítica (esquerda) ou positiva (direita) do tema.", series: R.series });
    const temas = Object.keys(D.temas).map((k) => ({ chave: k, rotulo: D.temas[k] }));
    G.divergente(corpo2, {
      linhas: temas, series: R.series, max: 1, ticks: [0, 0.5, 1], formato: (v) => pf.format(v), rotuloEsq: "← crítica", rotuloDir: "positiva →",
      valor: (l, se, lado) => {
        const s = R.porDisp(R.sess, se.chave); if (!s.length) return null;
        const k = lado === "esq" ? "crit" : "pos";
        const n = s.filter((x) => x.temas[k].includes(l.chave)).length;
        return { v: n / s.length, texto: String(n), tip: { titulo: l.rotulo, linhas: [{ classe: se.classe, valor: frac(n, s.length), rotulo: `${se.rotulo} · ${lado === "esq" ? "crítica" : "positiva"}` }] } };
      },
    });
    G.tabela(fig2, ["Tema", ...R.series.flatMap((se) => [`${se.rotulo}: positiva`, `${se.rotulo}: crítica`, `${se.rotulo}: sugestão`])],
      temas.map((t) => [t.rotulo, ...R.series.flatMap((se) => { const s = R.porDisp(R.sess, se.chave); return ["pos", "crit", "sug"].map((k) => `${s.filter((x) => x.temas[k].includes(t.chave)).length}/${s.length}`); })]),
      { num: R.series.flatMap((_, i) => [1 + i * 3, 2 + i * 3, 3 + i * 3]) });
    G.nota(fig2, "Números nas barras = sessões. Uma sessão pode aparecer dos dois lados do mesmo tema. «Assunto histórico» separa o elogio ao tema da avaliação da apresentação.");
  }

  /* ---------- Carga de trabalho ---------- */
  function carga(R) {
    const fig = document.getElementById("c-nasa");
    const corpo = G.cartao(fig, { titulo: "NASA-TLX por dimensão", sub: "Ponto = mediana; traço = intervalo interquartil (Q1–Q3). Escala 1–20 do arquivo de origem.", series: R.series, marca: "ponto" });
    const est = (d, k) => { const v = R.porDisp(R.sess, d).map((s) => s.nasa[k]).filter((x) => x !== null); return v.length ? { n: v.length, med: mediana(v), q1: quantil(v, 0.25), q3: quantil(v, 0.75), media: media(v) } : null; };
    G.intervalo(corpo, { linhas: NASA, series: R.series, min: 1, max: 20, ticks: [1, 5, 10, 15, 20], valor: (l, se) => est(se.chave, l.chave), aria: "Medianas e intervalos interquartis do NASA-TLX" });
    G.tabela(fig, ["Dimensão", "Dispositivo", "n", "Mediana", "Q1", "Q3", "Média"],
      NASA.flatMap((l) => R.series.map((se) => { const e = est(se.chave, l.chave); return [l.rotulo, se.rotulo, e ? e.n : 0, e && nf.format(e.med), e && nf.format(e.q1), e && nf.format(e.q3), e && nf.format(e.media)]; })),
      { num: [2, 3, 4, 5, 6] });
    G.nota(fig, "Maior = mais carga percebida nas cinco primeiras dimensões. *Desempenho: a direção da escala não está documentada no pacote de dados; por isso é lida à parte e não há escore composto.");
  }

  /* ---------- Sessões ---------- */
  let ordem = { col: 0, asc: true };
  function sessoes(R) {
    const box = document.getElementById("c-sessoes");
    box.replaceChildren();
    h("h3", {}, box, "Indicadores por sessão");
    h("p", { class: "sub" }, box, "Códigos pseudônimos. Clique no cabeçalho para ordenar.");
    const linhas = R.sess.map((s) => {
      const t = R.tarefas.filter((x) => x.s === s.id);
      const e = R.epis.filter((x) => x.s === s.id);
      const ob = t.filter((x) => x.inter === "sim" || x.inter === "não");
      const sat = s.sat.status === "avaliação global" ? s.sat.pol + (s.sat.ressalva ? " (ressalva)" : "") : `aspectos (${s.sat.pol})`;
      return [s.id, s.disp, s.amostra, t.filter((x) => x.res === "completo").length, `${ob.filter((x) => x.inter === "sim").length}/${ob.length}`,
        e.length, e.filter((x) => x.imp === "grave").length, sat, s.nasa.mental, s.nasa.frustracao, s.js ? "sim" : "não",
        !s.ph ? "sem PostHog" : !s.ph.cob ? "fora do teste" : (s.ph.recargas === null ? "relógio não alinhado" : s.ph.recargas)];
    });
    const cab = ["Sessão", "Dispositivo", "Amostra", "Concluídas (de 6)", "Interação esperada", "Episódios", "Graves", "Satisfação", "NASA mental", "NASA frustração", "Telemetria JS", "Recargas (PostHog)"];
    const num = [3, 5, 6, 8, 9, 11];
    const chave = (v) => (typeof v === "number" ? v : String(v));
    linhas.sort((a, b) => { const x = chave(a[ordem.col]), y = chave(b[ordem.col]); const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR"); return ordem.asc ? c : -c; });
    const w = h("div", { class: "rolagem" }, box);
    const tb = h("table", {}, w);
    const tr = h("tr", {}, h("thead", {}, tb));
    cab.forEach((c, i) => {
      const th = h("th", { scope: "col", class: num.includes(i) ? "num" : "" }, tr);
      if (ordem.col === i) th.setAttribute("aria-sort", ordem.asc ? "ascending" : "descending");
      const b = h("button", { type: "button" }, th, c);
      b.addEventListener("click", () => { ordem = { col: i, asc: ordem.col === i ? !ordem.asc : true }; sessoes(recorte()); });
    });
    const body = h("tbody", {}, tb);
    for (const l of linhas) { const r = h("tr", {}, body); l.forEach((c, i) => h("td", { class: num.includes(i) ? "num" : "" }, r, c === null ? "—" : c)); }
    const exc = D.sessoes.filter((s) => s.amostra !== "elegível");
    if (estado.amostra === "todas" && exc.length) {
      h("p", { class: "nota" }, box, "Motivos de exclusão: " + exc.filter((s) => estado.disp === "ambos" || s.disp === estado.disp).map((s) => `${s.id} — ${s.motivo}`).join("; "));
    }
  }

  /* ---------- rodapé e aviso (não dependem do filtro) ---------- */
  function cabecalhoRodape() {
    document.getElementById("rodape").textContent = `Dados gerados em ${D.meta.gerado_em} a partir de: ${D.meta.fontes.join("; ")}.`;
    document.getElementById("aviso-provisorio").hidden = !D.meta.provisorio;
  }

  /* ---------- Perfil dos participantes × métricas ---------- */
  const CARAC = [
    { chave: "idade", rotulo: "Faixa etária", cats: ["18–24 anos", "25–34 anos", "35 anos ou mais"] },
    { chave: "form", rotulo: "Escolaridade", cats: ["Até a graduação", "Pós-graduação"] },
    { chave: "area", rotulo: "Área de formação", cats: ["Cartografia, agrimensura e geografia", "Outras áreas"] },
    { chave: "freq", rotulo: "Uso de mapas digitais", cats: ["Muito frequentemente", "Frequentemente ou menos"] },
    { chave: "sm", rotulo: "Experiência com story maps", cats: ["Nunca", "1 ou 2 vezes", "Algumas ou muitas vezes"] },
    { chave: "tela", rotulo: "Tamanho da tela", cats: ['Até 14"', '15" a 16"', '17" ou mais', 'Até 6,5"', 'Acima de 6,5"'] },
    { chave: "nav", rotulo: "Navegador (informado)", cats: ["Chrome", "Safari", "Outros"] },
    { chave: "nav_ph", rotulo: "Navegador (PostHog)", cats: ["Chrome", "Safari", "Outros", "Sem PostHog"] },
    { chave: "so_ph", rotulo: "Sistema operacional (PostHog)", cats: ["Windows", "macOS", "Android", "iOS", "Linux", "Sem PostHog"] },
    { chave: "vw_ph", rotulo: "Largura da janela (PostHog)", cats: ["até 1366 px", "1367–1919 px", "1920 px ou mais", "até 384 px", "390–402 px", "acima de 402 px", "Sem PostHog"] },
  ];
  // cada métrica devolve {v, texto, n} para um conjunto de sessões e as tarefas/episódios delas
  const METRICAS = [
    { chave: "conclusao", rotulo: "Tarefas concluídas", tipo: "pct", f: (S, T) => { const n = T.filter((x) => x.res === "completo").length; return T.length ? { v: n / T.length, texto: frac(n, T.length), base: `${T.length} tarefas` } : null; } },
    { chave: "interacao", rotulo: "Interação esperada observada", tipo: "pct", f: (S, T) => { const o = T.filter((x) => x.inter === "sim" || x.inter === "não"); const n = o.filter((x) => x.inter === "sim").length; return o.length ? { v: n / o.length, texto: frac(n, o.length), base: `${o.length} tarefas observáveis` } : null; } },
    { chave: "grave", rotulo: "Sessões com fricção grave", tipo: "pct", f: (S, T, E) => { const g = new Set(E.filter((e) => e.imp === "grave").map((e) => e.s)); return S.length ? { v: g.size / S.length, texto: frac(g.size, S.length), base: `${S.length} sessões` } : null; } },
    { chave: "episodios", rotulo: "Episódios de fricção por sessão", tipo: "num", f: (S, T, E) => (S.length ? { v: E.length / S.length, texto: `${nf.format(E.length / S.length)} · n ${S.length}`, base: `${S.length} sessões` } : null) },
    { chave: "satisf", rotulo: "Avaliação global positiva", tipo: "pct", f: (S) => { const n = S.filter((x) => x.sat.status === "avaliação global" && x.sat.pol === "positiva").length; return S.length ? { v: n / S.length, texto: frac(n, S.length), base: `${S.length} sessões` } : null; } },
    { chave: "mental", rotulo: "NASA-TLX mental (mediana)", tipo: "nasa", f: (S) => nasaMed(S, "mental") },
    { chave: "esforco", rotulo: "NASA-TLX esforço (mediana)", tipo: "nasa", f: (S) => nasaMed(S, "esforco") },
    { chave: "frustracao", rotulo: "NASA-TLX frustração (mediana)", tipo: "nasa", f: (S) => nasaMed(S, "frustracao") },
    { chave: "recarga", rotulo: "Sessões com recarregamento (PostHog)", tipo: "pct", f: (S) => { const A = S.filter(phAlinhado); const n = A.filter((x) => x.ph.recargas > 0).length; return A.length ? { v: n / A.length, texto: frac(n, A.length), base: `${A.length} sessões com PostHog alinhado` } : null; } },
    { chave: "tempo", rotulo: "Mediana do tempo de conclusão", tipo: "seg", f: (S, T) => { const v = T.filter((x) => x.tc !== null && PRECISAO_PONTUAL.has(x.prec)).map((x) => x.tc); const m = mediana(v); return m === null ? null : { v: m, texto: `${nf.format(Math.round(m))} s · n ${v.length}`, base: `${v.length} tarefas com tempo pontual` }; } },
  ];
  function nasaMed(S, k) { const v = S.map((x) => x.nasa[k]).filter((x) => x !== null); const m = mediana(v); return m === null ? null : { v: m, texto: `${nf.format(m)} · n ${v.length}`, base: `${v.length} sessões` }; }

  const selC = document.getElementById("sel-carac"), selM = document.getElementById("sel-metrica");
  const temPerfil = D.sessoes.some((x) => x.perfil);
  if (selC) {
    for (const c of CARAC) h("option", { value: c.chave }, selC, c.rotulo);
    for (const m of METRICAS) h("option", { value: m.chave }, selM, m.rotulo);
    selC.value = CARAC.some((c) => c.chave === qs.get("carac")) ? qs.get("carac") : "freq";
    selM.value = METRICAS.some((m) => m.chave === qs.get("metrica")) ? qs.get("metrica") : "conclusao";
    const muda = () => {
      const p = new URLSearchParams(location.search);
      p.set("carac", selC.value); p.set("metrica", selM.value);
      history.replaceState(null, "", "?" + p);
      perfilMetricas(recorte());
    };
    selC.addEventListener("change", muda);
    selM.addEventListener("change", muda);
  }

  function perfilMetricas(R) {
    const sec = document.getElementById("perfil");
    if (!sec) return;
    if (!temPerfil) { sec.hidden = true; return; }
    const car = CARAC.find((c) => c.chave === selC.value);
    const met = METRICAS.find((m) => m.chave === selM.value);
    const grupo = (d, cat) => {
      const S = R.porDisp(R.sess, d).filter((x) => x.perfil && x.perfil[car.chave] === cat);
      const ids = new Set(S.map((x) => x.id));
      return { S, T: R.tarefas.filter((x) => ids.has(x.s)), E: R.epis.filter((x) => ids.has(x.s)) };
    };
    const cats = car.cats.filter((cat) => R.series.some((se) => grupo(se.chave, cat).S.length)).map((c) => ({ chave: c, rotulo: c }));

    const fig = document.getElementById("c-composicao");
    const corpo = G.cartao(fig, { titulo: `Composição da amostra: ${minusc(car.rotulo)}`, sub: "Proporção das sessões de cada dispositivo em cada categoria. Mostra se os grupos são comparáveis.", series: R.series });
    G.barrasH(corpo, {
      linhas: cats, series: R.series, max: 1, ticks: [0, 0.5, 1], formato: (v) => pf.format(v), espacoValor: 92, omitirNulos: true,
      valor: (l, se) => { const N = R.porDisp(R.sess, se.chave).filter((x) => x.perfil).length; const n = grupo(se.chave, l.chave).S.length; return n ? { v: n / N, texto: frac(n, N) } : null; },
    });

    const fig2 = document.getElementById("c-cruzamento");
    const corpo2 = G.cartao(fig2, { titulo: `${met.rotulo} por ${minusc(car.rotulo)}`, sub: "Cada barra é calculada só com as sessões daquela categoria e dispositivo; o n aparece no rótulo.", series: R.series });
    const vals = cats.flatMap((l) => R.series.map((se) => { const g = grupo(se.chave, l.chave); return met.f(g.S, g.T, g.E); })).filter(Boolean).map((x) => x.v);
    let max = 1, ticks = [0, 0.5, 1], formato = (v) => pf.format(v);
    if (met.tipo === "nasa") { max = 20; ticks = [0, 5, 10, 15, 20]; formato = (v) => nf.format(v); }
    if (met.tipo === "num") { max = Math.max(1, Math.ceil(Math.max(0, ...vals))); ticks = [0, max / 2, max]; formato = (v) => nf.format(v); }
    if (met.tipo === "seg") { max = Math.max(60, Math.ceil(Math.max(0, ...vals) / 60) * 60); ticks = [0, max / 2, max]; formato = (v) => `${nf.format(v)} s`; }
    G.barrasH(corpo2, {
      linhas: cats, series: R.series, max, ticks, formato, espacoValor: 104, omitirNulos: true,
      valor: (l, se) => {
        const g = grupo(se.chave, l.chave);
        if (!g.S.length) return null;
        const r = met.f(g.S, g.T, g.E);
        if (!r) return null;
        return { v: r.v, texto: r.texto, tip: { titulo: `${l.rotulo} · ${se.rotulo}`, linhas: [{ classe: se.classe, valor: r.texto, rotulo: met.rotulo }], extra: `${g.S.length} sessões · base: ${r.base}` } };
      },
    });
    G.nota(fig2, "Grupos pequenos: leitura descritiva, sem teste estatístico. As categorias de tela e de largura da janela são diferentes em cada dispositivo. Navegador, sistema e largura «PostHog» são os registrados pela telemetria, não os informados no questionário.");

    const fig3 = document.getElementById("c-perfil-tabela");
    fig3.replaceChildren();
    const cap = h("figcaption", {}, fig3);
    h("h3", {}, cap, `Todas as métricas por ${minusc(car.rotulo)}`);
    h("p", { class: "sub" }, cap, "Mesmo recorte dos filtros do topo. Percentuais com numerador e denominador; medianas com o n usado.");
    const cab = ["Categoria", "Dispositivo", "Sessões", ...METRICAS.map((m) => m.rotulo)];
    const w = h("div", { class: "rolagem" }, fig3);
    const tb = h("table", {}, w);
    const tr = h("tr", {}, h("thead", {}, tb));
    cab.forEach((c, i) => h("th", { scope: "col", class: i > 1 ? "num" : "" }, tr, c));
    const body = h("tbody", {}, tb);
    for (const l of cats) for (const se of R.series) {
      const g = grupo(se.chave, l.chave);
      if (!g.S.length) continue;
      const rr = h("tr", {}, body);
      [l.rotulo, se.rotulo, g.S.length, ...METRICAS.map((m) => { const r = m.f(g.S, g.T, g.E); return r ? r.texto : "—"; })]
        .forEach((c, i) => h("td", { class: i > 1 ? "num" : "" }, rr, c));
    }
    G.nota(fig3, "A caracterização entra no painel só em categorias agrupadas. Área: cartografia inclui engenharia cartográfica e de agrimensura, ciências geodésicas e geografia; as demais formações ficam em «outras áreas».");
  }

  /* ---------- render ---------- */
  function render() {
    const R = recorte();
    const nD = R.porDisp(R.sess, "desktop").length, nS = R.porDisp(R.sess, "smartphone").length;
    document.getElementById("resumo-filtro").textContent =
      `${R.sess.length} sessões (${R.series.map((d) => `${d.rotulo.toLowerCase()} ${d.chave === "desktop" ? nD : nS}`).join(", ")}) · ${R.tarefas.length} tarefas · ${R.epis.length} episódios`;
    G.esconder();
    kpis(R); eficacia(R); eficiencia(R); interacoes(R); posthog(R); friccoes(R); satisfacao(R); carga(R); perfilMetricas(R); sessoes(R);
  }
  cabecalhoRodape(); render();
  let larguraAnterior = document.querySelector("main").clientWidth, timer;
  new ResizeObserver(() => {
    const w = document.querySelector("main").clientWidth;
    if (Math.abs(w - larguraAnterior) < 8) return;
    larguraAnterior = w;
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  }).observe(document.querySelector("main"));
})();
