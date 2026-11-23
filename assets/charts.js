/* Gráficos em SVG puro, sem dependências.
   Regras: marcas finas, ponta de dado arredondada (4px) e base reta, 2px de folga entre barras,
   anel de 2px da cor da superfície nos pontos, grade em traço fino e sólido, texto sempre em
   tinta de texto (nunca na cor da série), tooltip em pointer e foco, tabela como gêmeo acessível. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const pf = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, attrs, parent, text) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") e.className = attrs[k];
      else if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    }
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, str, attrs) {
    const t = s("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = String(str);
    return t;
  }
  // largura aproximada do texto (sem medir o DOM, para não depender de layout)
  function largura(str, px) { return String(str).length * (px || 12) * 0.56; }
  function cortar(str, maxPx, px) {
    const max = Math.floor(maxPx / ((px || 12) * 0.56));
    return str.length <= max ? str : str.slice(0, Math.max(1, max - 1)).trimEnd() + "…";
  }

  /* barra horizontal: ponta arredondada à direita, base reta à esquerda */
  function barraH(parent, x, y, w, alt, cls) {
    const r = Math.min(4, w / 2, alt / 2);
    if (w <= 0) return s("rect", { x, y, width: 0, height: alt, class: cls }, parent);
    const d = `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${alt - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
    return s("path", { d, class: cls }, parent);
  }
  /* barra para a esquerda (gráfico divergente) */
  function barraHEsq(parent, x0, y, w, alt, cls) {
    const r = Math.min(4, w / 2, alt / 2);
    if (w <= 0) return s("rect", { x: x0, y, width: 0, height: alt, class: cls }, parent);
    const d = `M${x0},${y}h${-(w - r)}a${r},${r} 0 0 0 ${-r},${r}v${alt - 2 * r}a${r},${r} 0 0 0 ${r},${r}h${w - r}z`;
    return s("path", { d, class: cls }, parent);
  }

  /* ---------- tooltip ---------- */
  const tip = () => document.getElementById("tooltip");
  function mostrar(conteudo, px, py) {
    const t = tip();
    t.replaceChildren();
    if (conteudo.titulo) h("div", { class: "tt-titulo" }, t, conteudo.titulo);
    for (const l of conteudo.linhas || []) {
      const row = h("div", { class: "tt-linha" }, t);
      if (l.classe) { const k = h("span", { class: "tt-chave" }, row); k.style.background = `var(--${l.classe})`; }
      h("b", {}, row, l.valor);
      if (l.rotulo) h("span", {}, row, l.rotulo);
    }
    if (conteudo.extra) h("div", { class: "tt-extra" }, t, conteudo.extra);
    t.hidden = false;
    const r = t.getBoundingClientRect();
    let x = px + 14, y = py + 14;
    if (x + r.width > window.innerWidth - 8) x = px - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = py - r.height - 14;
    t.style.left = Math.max(8, x) + "px";
    t.style.top = Math.max(8, y) + "px";
  }
  function esconder() { tip().hidden = true; }
  function ligarTip(g, conteudo, rotuloAcessivel) {
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "img");
    g.setAttribute("aria-label", rotuloAcessivel);
    g.addEventListener("pointermove", (e) => mostrar(conteudo(), e.clientX, e.clientY));
    g.addEventListener("pointerleave", esconder);
    g.addEventListener("focus", () => { const r = g.getBoundingClientRect(); mostrar(conteudo(), r.right, r.top); });
    g.addEventListener("blur", esconder);
  }

  /* ---------- moldura de cartão, legenda e tabela ---------- */
  function cartao(fig, o) {
    fig.replaceChildren();
    const cap = h("figcaption", {}, fig);
    h("h3", {}, cap, o.titulo);
    if (o.sub) h("p", { class: "sub" }, cap, o.sub);
    if (o.series && o.series.length > 1) legenda(fig, o.series, o.marca || "barra");
    const corpo = h("div", { class: "grafico" }, fig);
    return corpo;
  }
  function legenda(parent, series, marca) {
    const l = h("div", { class: "legenda" }, parent);
    for (const se of series) {
      const it = h("span", {}, l);
      const sv = s("svg", { width: 14, height: 10, "aria-hidden": "true" }, it);
      if (marca === "linha") s("line", { x1: 0, x2: 14, y1: 5, y2: 5, class: `stroke-${se.classe}`, "stroke-width": 2, "stroke-linecap": "round" }, sv);
      else if (marca === "ponto") s("circle", { cx: 7, cy: 5, r: 4, class: `fill-${se.classe}` }, sv);
      else s("rect", { x: 1, y: 1, width: 12, height: 8, rx: 2, class: `fill-${se.classe}` }, sv);
      it.appendChild(document.createTextNode(se.rotulo));
    }
    return l;
  }
  function tabela(fig, cab, linhas, o) {
    const d = h("details", { class: "tabela" }, fig);
    h("summary", {}, d, (o && o.resumo) || "Ver tabela");
    const w = h("div", { class: "rolagem" }, d);
    const t = h("table", {}, w);
    if (o && o.legenda) h("caption", { class: "sub" }, t, o.legenda);
    const tr = h("tr", {}, h("thead", {}, t));
    cab.forEach((c, i) => h("th", { scope: "col", class: (o && o.num && o.num.includes(i)) ? "num" : "" }, tr, c));
    const tb = h("tbody", {}, t);
    for (const l of linhas) {
      const r = h("tr", {}, tb);
      l.forEach((c, i) => h("td", { class: (o && o.num && o.num.includes(i)) ? "num" : "" }, r, c === null || c === undefined ? "—" : c));
    }
    return d;
  }
  function nota(fig, texto) { if (texto) h("p", { class: "nota" }, fig, texto); }

  /* ---------- barras horizontais agrupadas ----------
     o.linhas: [{chave, rotulo, rotuloLongo}], o.series: [{chave, rotulo, classe}]
     o.valor(linha, serie) -> {v, texto, tip:{titulo, linhas, extra}} | null
     o.max, o.formato (para o eixo), o.ticks */
  function barrasH(corpo, o) {
    const W = Math.max(300, corpo.clientWidth || 600);
    const nS = o.series.length;
    const barra = nS > 1 ? 10 : 14, folga = 2, pad = 9;
    const linhaH = nS * barra + (nS - 1) * folga + pad * 2;
    const maxRot = Math.max(...o.linhas.map((l) => largura(l.rotulo)));
    const esq = Math.min(Math.max(60, maxRot + 12), W * (o.fracRotulo || 0.42));
    const dir = o.espacoValor || 74;
    const topo = 4, base = 22;
    const H = topo + o.linhas.length * linhaH + base;
    const pw = W - esq - dir;
    const max = o.max || Math.max(1e-9, ...o.linhas.flatMap((l) => o.series.map((se) => (o.valor(l, se) || { v: 0 }).v)));
    const x = (v) => esq + (v / max) * pw;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "group", "aria-label": o.aria || "" }, corpo);
    const ticks = o.ticks || [0, max / 2, max];
    const gGrade = s("g", { class: "eixo" }, svg);
    for (const t of ticks) {
      s("line", { x1: x(t), x2: x(t), y1: topo, y2: H - base + 4, class: "grade-linha" }, gGrade);
      txt(gGrade, x(t), H - 6, o.formato ? o.formato(t) : nf.format(t), { "text-anchor": "middle" });
    }
    s("line", { x1: esq, x2: esq, y1: topo, y2: H - base + 4, class: "base-linha" }, svg);
    o.linhas.forEach((l, i) => {
      const y0 = topo + i * linhaH;
      const r = txt(svg, esq - 8, y0 + linhaH / 2 + 4, cortar(l.rotulo, esq - 10), { "text-anchor": "end" });
      if (l.rotuloLongo) { const tt = s("title", {}, r); tt.textContent = l.rotuloLongo; }
      o.series.forEach((se, j) => {
        const val = o.valor(l, se);
        const y = y0 + pad + j * (barra + folga);
        const g = s("g", { class: "marca" }, svg);
        s("rect", { x: esq, y: y - folga / 2, width: pw + dir, height: barra + folga, class: "alvo" }, g);
        if (!val) {
          if (!o.omitirNulos) txt(g, esq + 4, y + barra - 1, "sem dados", { class: "rotulo" });
          return;
        }
        barraH(g, esq, y, Math.max(0, x(val.v) - esq), barra, `pintura fill-${se.classe}`);
        txt(g, x(val.v) + 6, y + barra - 1, val.texto, { class: "rotulo" });
        ligarTip(g, () => val.tip || { titulo: l.rotuloLongo || l.rotulo, linhas: [{ classe: se.classe, valor: val.texto, rotulo: se.rotulo }] },
          `${l.rotuloLongo || l.rotulo}, ${se.rotulo}: ${val.texto}`);
      });
    });
    return svg;
  }

  /* ---------- divergente: crítica à esquerda, positiva à direita ---------- */
  function divergente(corpo, o) {
    const W = Math.max(320, corpo.clientWidth || 600);
    const nS = o.series.length;
    const barra = nS > 1 ? 9 : 13, folga = 2, pad = 7;
    const linhaH = nS * barra + (nS - 1) * folga + pad * 2;
    const rotW = Math.min(Math.max(...o.linhas.map((l) => largura(l.rotulo))) + 12, W * 0.36);
    const topo = 22, base = 20;
    const H = topo + o.linhas.length * linhaH + base;
    const valW = 34;
    const meio = rotW + (W - rotW) / 2;
    const metade = (W - rotW) / 2 - valW;
    const max = o.max;
    const sx = (v) => (v / max) * metade;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "group", "aria-label": o.aria || "" }, corpo);
    txt(svg, meio - 8, 13, o.rotuloEsq, { "text-anchor": "end", class: "rotulo" });
    txt(svg, meio + 8, 13, o.rotuloDir, { class: "rotulo" });
    const gE = s("g", { class: "eixo" }, svg);
    for (const t of o.ticks) {
      for (const sg of t === 0 ? [1] : [-1, 1]) {
        const xx = meio + sg * sx(t);
        s("line", { x1: xx, x2: xx, y1: topo, y2: H - base + 4, class: "grade-linha" }, gE);
        txt(gE, xx, H - 5, o.formato(t), { "text-anchor": "middle" });
      }
    }
    s("line", { x1: meio, x2: meio, y1: topo - 4, y2: H - base + 4, class: "base-linha" }, svg);
    o.linhas.forEach((l, i) => {
      const y0 = topo + i * linhaH;
      txt(svg, rotW - 8, y0 + linhaH / 2 + 4, cortar(l.rotulo, rotW - 10), { "text-anchor": "end" });
      o.series.forEach((se, j) => {
        const y = y0 + pad + j * (barra + folga);
        for (const lado of ["esq", "dir"]) {
          const val = o.valor(l, se, lado);
          if (!val) continue;
          const g = s("g", { class: "marca" }, svg);
          const w = sx(val.v);
          if (lado === "esq") {
            s("rect", { x: rotW, y: y - 1, width: meio - rotW, height: barra + 2, class: "alvo" }, g);
            barraHEsq(g, meio - 1, y, w, barra, `pintura fill-${se.classe}`);
            txt(g, meio - 1 - w - 5, y + barra - 1, val.texto, { "text-anchor": "end", class: "rotulo" });
          } else {
            s("rect", { x: meio, y: y - 1, width: W - meio, height: barra + 2, class: "alvo" }, g);
            barraH(g, meio + 1, y, w, barra, `pintura fill-${se.classe}`);
            txt(g, meio + 1 + w + 5, y + barra - 1, val.texto, { class: "rotulo" });
          }
          ligarTip(g, () => val.tip, `${l.rotulo}, ${se.rotulo}, ${lado === "esq" ? o.rotuloEsq : o.rotuloDir}: ${val.texto}`);
        }
      });
    });
    return svg;
  }

  /* ---------- tira de pontos com mediana (tempos) ---------- */
  function tira(corpo, o) {
    const W = Math.max(320, corpo.clientWidth || 700);
    const esq = 44, dir = 8, topo = 10, base = 40;
    const H = o.altura || 300;
    const pw = W - esq - dir, ph = H - topo - base;
    const max = o.max;
    const y = (v) => topo + ph - (v / max) * ph;
    const grupoW = pw / o.grupos.length;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "group", "aria-label": o.aria || "" }, corpo);
    const gE = s("g", { class: "eixo" }, svg);
    for (const t of o.ticks) {
      s("line", { x1: esq, x2: W - dir, y1: y(t), y2: y(t), class: t === 0 ? "base-linha" : "grade-linha" }, gE);
      txt(gE, esq - 6, y(t) + 4, o.formato(t), { "text-anchor": "end" });
    }
    o.grupos.forEach((gr, i) => {
      const cx = esq + grupoW * (i + 0.5);
      txt(svg, cx, H - base + 16, grupoW < 100 ? (gr.chave || gr.rotulo) : gr.rotulo, { "text-anchor": "middle", class: "rotulo rotulo-forte" });
      const ns = o.series.map((se) => `${o.series.length > 1 ? se.curto + " " : ""}${(o.pontos(gr, se) || []).length}`).join(" · ");
      txt(svg, cx, H - base + 31, "n " + ns, { "text-anchor": "middle", class: "eixo" });
      const nS = o.series.length;
      o.series.forEach((se, j) => {
        const off = nS > 1 ? (j - (nS - 1) / 2) * Math.min(34, grupoW / 3) : 0;
        const pts = o.pontos(gr, se) || [];
        pts.forEach((p, k) => {
          const jit = ((k * 37) % 11 - 5) * Math.min(1.4, grupoW / 120);
          const g = s("g", { class: "marca" }, svg);
          s("circle", { cx: cx + off + jit, cy: y(p.v), r: 11, class: "alvo" }, g);
          s("circle", { cx: cx + off + jit, cy: y(p.v), r: 4, class: `pintura ring fill-${se.classe}` }, g);
          ligarTip(g, () => ({ titulo: `${gr.rotuloLongo || gr.rotulo} · ${se.rotulo}`, linhas: [{ classe: se.classe, valor: nf.format(p.v) + " s", rotulo: p.rotulo }], extra: p.extra }),
            `${gr.rotulo}, ${se.rotulo}, ${p.rotulo}: ${nf.format(p.v)} segundos`);
        });
        const med = o.mediana(gr, se);
        if (med !== null && med !== undefined) {
          s("line", { x1: cx + off - 11, x2: cx + off + 11, y1: y(med), y2: y(med), stroke: "var(--ink)", "stroke-width": 2, "stroke-linecap": "round" }, svg);
        }
      });
    });
    return svg;
  }

  /* ---------- mapa de calor (um painel) ---------- */
  function calor(corpo, o) {
    const W = Math.max(280, corpo.clientWidth || 500);
    const esq = Math.min(o.rotW || 150, W * 0.42), topo = 22, cel = o.celula || 30;
    const cw = (W - esq) / o.colunas.length;
    const H = topo + o.linhas.length * cel + 4;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "group", "aria-label": o.aria || "" }, corpo);
    o.colunas.forEach((c, j) => txt(svg, esq + cw * (j + 0.5), 14, c.rotulo, { "text-anchor": "middle", class: "rotulo rotulo-forte" }));
    o.linhas.forEach((l, i) => {
      txt(svg, esq - 8, topo + i * cel + cel / 2 + 4, cortar(l.rotulo, esq - 10), { "text-anchor": "end" });
      o.colunas.forEach((c, j) => {
        const val = o.valor(l, c);
        const g = s("g", { class: "marca" }, svg);
        const x = esq + cw * j + 1, yy = topo + i * cel + 1;
        if (!val) {
          s("rect", { x, y: yy, width: cw - 2, height: cel - 2, rx: 4, fill: "var(--wash)" }, g);
          txt(g, x + (cw - 2) / 2, yy + cel / 2 + 3, "—", { "text-anchor": "middle", class: "eixo" });
          return;
        }
        const op = 0.07 + 0.93 * val.v;
        s("rect", { x, y: yy, width: cw - 2, height: cel - 2, rx: 4, class: `pintura fill-${o.classe}`, "fill-opacity": op.toFixed(3) }, g);
        if (cw > 30) {
          const t = txt(g, x + (cw - 2) / 2, yy + cel / 2 + 4, val.texto, { "text-anchor": "middle", class: "dentro" });
          t.style.fill = op > (o.limiarTexto || 0.62) ? `var(--ink-on-${o.classe})` : "var(--ink)";
        }
        ligarTip(g, () => val.tip, `${l.rotulo}, ${c.rotulo}: ${val.texto}`);
      });
    });
    return svg;
  }

  /* ---------- mediana e intervalo interquartil (NASA) ---------- */
  function intervalo(corpo, o) {
    const W = Math.max(320, corpo.clientWidth || 700);
    const nS = o.series.length;
    const linhaH = 16 + nS * 14;
    const esq = Math.min(Math.max(...o.linhas.map((l) => largura(l.rotulo))) + 14, W * 0.34), dir = 40, topo = 6, base = 24;
    const H = topo + o.linhas.length * linhaH + base;
    const pw = W - esq - dir;
    const x = (v) => esq + ((v - o.min) / (o.max - o.min)) * pw;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "group", "aria-label": o.aria || "" }, corpo);
    const gE = s("g", { class: "eixo" }, svg);
    for (const t of o.ticks) {
      s("line", { x1: x(t), x2: x(t), y1: topo, y2: H - base + 4, class: "grade-linha" }, gE);
      txt(gE, x(t), H - 6, nf.format(t), { "text-anchor": "middle" });
    }
    o.linhas.forEach((l, i) => {
      const y0 = topo + i * linhaH;
      txt(svg, esq - 8, y0 + linhaH / 2 + 4, l.rotulo, { "text-anchor": "end", class: l.destaque ? "rotulo-forte" : "" });
      o.series.forEach((se, j) => {
        const val = o.valor(l, se);
        const yy = y0 + 8 + 7 + j * 14;
        if (!val) return;
        const g = s("g", { class: "marca" }, svg);
        s("rect", { x: esq, y: yy - 7, width: pw + dir, height: 14, class: "alvo" }, g);
        s("line", { x1: x(val.q1), x2: x(val.q3), y1: yy, y2: yy, class: `stroke-${se.classe}`, "stroke-width": 2, "stroke-linecap": "round" }, g);
        s("circle", { cx: x(val.med), cy: yy, r: 5, class: `pintura ring fill-${se.classe}` }, g);
        txt(g, x(val.q3) + 8, yy + 4, nf.format(val.med), { class: "rotulo" });
        ligarTip(g, () => ({ titulo: `${l.rotulo} · ${se.rotulo}`, linhas: [{ classe: se.classe, valor: nf.format(val.med), rotulo: "mediana" }], extra: `Q1–Q3 ${nf.format(val.q1)}–${nf.format(val.q3)} · n = ${val.n}` }),
          `${l.rotulo}, ${se.rotulo}: mediana ${nf.format(val.med)}, intervalo interquartil ${nf.format(val.q1)} a ${nf.format(val.q3)}, n ${val.n}`);
      });
    });
    return svg;
  }

  window.Graf = { s, h, txt, cartao, legenda, tabela, nota, barrasH, divergente, tira, calor, intervalo, mostrar, esconder, nf, pf };
})();
