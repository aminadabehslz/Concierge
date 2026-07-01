import { db } from "./db.js";
import { SERVICOS, SETORES } from "./config.js";

// Gera o relatório completo para um intervalo [inicio, fim] (epoch ms).
// Se setorFiltro for informado, restringe tudo àquele setor.
export function gerarRelatorio(inicio, fim, setorFiltro = null) {
  const condSetor = setorFiltro ? "AND c.setor_id = @setor" : "";
  const argsChamados = setorFiltro ? { ini: inicio, fim, setor: setorFiltro } : { ini: inicio, fim };
  const argsPeriodo = { ini: inicio, fim };

  // ---- base: chamados no período ----
  const chamados = db.prepare(`
    SELECT c.* FROM chamados c
    WHERE c.criado_em >= @ini AND c.criado_em < @fim ${condSetor}
  `).all(argsChamados);

  const dur = (c) => (c.concluido_em ? (c.concluido_em - c.criado_em) / 60000 : null);
  const estourado = (c) => {
    const base = c.concluido_em || Date.now();
    return (base - c.criado_em) / 60000 > c.sla_min;
  };

  // ---- 1. Volume por natureza (setor e tipo de serviço) ----
  const porSetor = {};
  const porServico = {};
  for (const c of chamados) {
    porSetor[c.setor_id] = (porSetor[c.setor_id] || 0) + 1;
    porServico[c.servico] = (porServico[c.servico] || 0) + 1;
  }
  const volumeSetor = Object.entries(porSetor).map(([id, n]) => ({ id, nome: SETORES[id]?.nome || id, total: n })).sort((a, b) => b.total - a.total);
  const volumeServico = Object.entries(porServico).map(([id, n]) => ({ id, titulo: SERVICOS[id]?.titulo || id, total: n })).sort((a, b) => b.total - a.total);

  // ---- 2. Tempo de resposta e SLA ----
  const concluidos = chamados.filter((c) => c.status === "concluido" && c.concluido_em);
  const tempos = concluidos.map(dur).filter((x) => x != null).sort((a, b) => a - b);
  const media = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
  const mediana = tempos.length ? tempos[Math.floor(tempos.length / 2)] : 0;
  const dentroSla = concluidos.filter((c) => !estourado(c)).length;
  const slaPct = concluidos.length ? (dentroSla / concluidos.length) * 100 : 0;

  // tempo médio e SLA por setor
  const slaPorSetor = {};
  for (const c of concluidos) {
    const s = (slaPorSetor[c.setor_id] ||= { total: 0, dentro: 0, somaTempo: 0 });
    s.total++; s.somaTempo += dur(c) || 0; if (!estourado(c)) s.dentro++;
  }
  const desempenhoSetor = Object.entries(slaPorSetor).map(([id, s]) => ({
    id, nome: SETORES[id]?.nome || id,
    concluidos: s.total,
    tempoMedio: s.total ? +(s.somaTempo / s.total).toFixed(1) : 0,
    slaPct: s.total ? +((s.dentro / s.total) * 100).toFixed(0) : 0,
  })).sort((a, b) => a.slaPct - b.slaPct);

  // ---- 3. Notas de experiência e tendência ----
  const avaliacoes = db.prepare(`SELECT a.* FROM avaliacoes a WHERE a.em >= @ini AND a.em < @fim`).all(argsPeriodo);
  const notas = avaliacoes.map((a) => a.nota);
  const notaMedia = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const distribuicao = { boa: 0, neutra: 0, ruim: 0 };
  for (const n of notas) distribuicao[n >= 9 ? "boa" : n >= 7 ? "neutra" : "ruim"]++;
  // tendência: média por dia
  const porDia = {};
  for (const a of avaliacoes) {
    const dia = new Date(a.em).toISOString().slice(0, 10);
    (porDia[dia] ||= []).push(a.nota);
  }
  const serieExperiencia = Object.entries(porDia).map(([dia, ns]) => ({ dia, media: +(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1), n: ns.length })).sort((a, b) => a.dia.localeCompare(b.dia));

  // ---- 4. Intervenções do concierge ----
  const intervencoes = db.prepare(`SELECT * FROM intervencoes WHERE em >= @ini AND em < @fim`).all(argsPeriodo);
  const intervPorAutor = {};
  for (const i of intervencoes) intervPorAutor[i.autor] = (intervPorAutor[i.autor] || 0) + 1;

  // ---- 5. Ranking de leitos/setores críticos ----
  const critLeito = {};
  for (const c of chamados) {
    const k = c.quarto_id;
    const r = (critLeito[k] ||= { quarto: k, chamados: 0, estourados: 0 });
    r.chamados++; if (estourado(c)) r.estourados++;
  }
  // soma avaliações ruins por leito
  for (const a of avaliacoes) if (a.nota <= 6) { const r = (critLeito[a.quarto_id] ||= { quarto: a.quarto_id, chamados: 0, estourados: 0 }); r.notasRuins = (r.notasRuins || 0) + 1; }
  const leitosCriticos = Object.values(critLeito)
    .map((r) => ({ ...r, notasRuins: r.notasRuins || 0, escore: r.estourados * 2 + (r.notasRuins || 0) * 3 }))
    .filter((r) => r.escore > 0)
    .sort((a, b) => b.escore - a.escore).slice(0, 15);

  // ---- resumo executivo ----
  const resumo = {
    totalChamados: chamados.length,
    concluidos: concluidos.length,
    tempoMedio: +media.toFixed(1),
    tempoMediano: +mediana.toFixed(1),
    slaPct: +slaPct.toFixed(0),
    notaMedia: notaMedia != null ? +notaMedia.toFixed(1) : null,
    totalAvaliacoes: avaliacoes.length,
    totalIntervencoes: intervencoes.length,
    leitosCriticos: leitosCriticos.length,
  };

  return {
    periodo: { inicio, fim, setor: setorFiltro },
    resumo,
    volumeSetor, volumeServico,
    desempenho: { media: +media.toFixed(1), mediana: +mediana.toFixed(1), slaPct: +slaPct.toFixed(0), concluidos: concluidos.length, desempenhoSetor },
    experiencia: { notaMedia: notaMedia != null ? +notaMedia.toFixed(1) : null, distribuicao: distribuicao, serie: serieExperiencia, total: avaliacoes.length },
    intervencoes: { total: intervencoes.length, porAutor: Object.entries(intervPorAutor).map(([autor, n]) => ({ autor, total: n })), lista: intervencoes.slice(0, 50) },
    leitosCriticos,
  };
}

// ============================================================
//  Painel estratégico (Direção) — consolidado do dia + tendências + metas
// ============================================================
export const METAS = {
  slaPct: 85,          // % de chamados dentro do prazo
  notaExperiencia: 8.5, // nota média alvo
  tempoMedio: 30,      // minutos alvo de atendimento
};

export function painelEstrategico() {
  const agora = Date.now();
  const hojeIni = new Date(); hojeIni.setHours(0, 0, 0, 0);
  const ini30 = agora - 30 * 86400000;

  const dur = (c) => (c.concluido_em ? (c.concluido_em - c.criado_em) / 60000 : null);
  const est = (c) => ((c.concluido_em || agora) - c.criado_em) / 60000 > c.sla_min;

  // ---- INDICADORES DO DIA (tempo real) ----
  const chDia = db.prepare("SELECT * FROM chamados WHERE criado_em >= ?").all(hojeIni.getTime());
  const ativos = chDia.filter((c) => c.status !== "concluido");
  const conclDia = chDia.filter((c) => c.status === "concluido" && c.concluido_em);
  const estourados = ativos.filter(est);
  const dentroDia = conclDia.filter((c) => !est(c)).length;
  const slaDia = conclDia.length ? Math.round((dentroDia / conclDia.length) * 100) : 100;
  const temposDia = conclDia.map(dur).filter((x) => x != null);
  const tempoMedioDia = temposDia.length ? +(temposDia.reduce((a, b) => a + b, 0) / temposDia.length).toFixed(1) : 0;
  const avDia = db.prepare("SELECT * FROM avaliacoes WHERE em >= ?").all(hojeIni.getTime());
  const notaDia = avDia.length ? +(avDia.reduce((a, x) => a + x.nota, 0) / avDia.length).toFixed(1) : null;
  const intervDia = db.prepare("SELECT COUNT(*) n FROM intervencoes WHERE em >= ?").get(hojeIni.getTime()).n;

  // leitos com avaliação ruim agora (últimas avaliações por leito)
  const ultAval = db.prepare(`SELECT a.* FROM avaliacoes a JOIN quartos q ON q.id=a.quarto_id WHERE a.em > COALESCE(q.zerado_em,0)`).all();
  const porLeito = {};
  for (const a of ultAval) { const p = porLeito[a.quarto_id]; if (!p || a.em > p.em) porLeito[a.quarto_id] = a; }
  const leitosRuins = Object.values(porLeito).filter((a) => a.nota <= 6).length;

  // ---- TENDÊNCIA 30 DIAS (experiência e SLA por dia) ----
  const ch30 = db.prepare("SELECT * FROM chamados WHERE criado_em >= ?").all(ini30);
  const av30 = db.prepare("SELECT * FROM avaliacoes WHERE em >= ?").all(ini30);
  const dias = {};
  for (let d = 29; d >= 0; d--) {
    const key = new Date(agora - d * 86400000).toISOString().slice(0, 10);
    dias[key] = { dia: key, notas: [], concl: 0, dentro: 0 };
  }
  for (const a of av30) { const k = new Date(a.em).toISOString().slice(0, 10); if (dias[k]) dias[k].notas.push(a.nota); }
  for (const c of ch30) {
    if (c.status === "concluido" && c.concluido_em) {
      const k = new Date(c.criado_em).toISOString().slice(0, 10);
      if (dias[k]) { dias[k].concl++; if (!est(c)) dias[k].dentro++; }
    }
  }
  const tendencia = Object.values(dias).map((d) => ({
    dia: d.dia,
    experiencia: d.notas.length ? +(d.notas.reduce((a, b) => a + b, 0) / d.notas.length).toFixed(1) : null,
    sla: d.concl ? Math.round((d.dentro / d.concl) * 100) : null,
  }));

  // ---- RANKINGS ----
  const porSetor = {};
  for (const c of ch30.filter((c) => c.status === "concluido" && c.concluido_em)) {
    const s = (porSetor[c.setor_id] ||= { total: 0, dentro: 0, soma: 0 });
    s.total++; s.soma += dur(c) || 0; if (!est(c)) s.dentro++;
  }
  const rankSetores = Object.entries(porSetor).map(([id, s]) => ({
    id, nome: SETORES[id]?.nome || id,
    slaPct: s.total ? Math.round((s.dentro / s.total) * 100) : 0,
    tempoMedio: s.total ? +(s.soma / s.total).toFixed(1) : 0,
    volume: s.total,
  })).sort((a, b) => a.slaPct - b.slaPct);

  // ---- METAS / ALERTAS ----
  const mediaGeralNota = av30.length ? +(av30.reduce((a, x) => a + x.nota, 0) / av30.length).toFixed(1) : null;
  const conclGeral = ch30.filter((c) => c.status === "concluido" && c.concluido_em);
  const slaGeral = conclGeral.length ? Math.round((conclGeral.filter((c) => !est(c)).length / conclGeral.length) * 100) : 100;
  const temposGeral = conclGeral.map(dur).filter((x) => x != null);
  const tempoGeral = temposGeral.length ? +(temposGeral.reduce((a, b) => a + b, 0) / temposGeral.length).toFixed(1) : 0;

  const metas = [
    { nome: "Cumprimento de SLA", valor: slaGeral, meta: METAS.slaPct, unidade: "%", ok: slaGeral >= METAS.slaPct, maiorMelhor: true },
    { nome: "Nota de experiência", valor: mediaGeralNota, meta: METAS.notaExperiencia, unidade: "", ok: mediaGeralNota != null && mediaGeralNota >= METAS.notaExperiencia, maiorMelhor: true },
    { nome: "Tempo médio de atendimento", valor: tempoGeral, meta: METAS.tempoMedio, unidade: "min", ok: tempoGeral <= METAS.tempoMedio, maiorMelhor: false },
  ];

  return {
    atualizadoEm: agora,
    dia: {
      chamadosHoje: chDia.length,
      ativos: ativos.length,
      estourados: estourados.length,
      slaDia,
      tempoMedioDia,
      notaDia,
      intervDia,
      leitosRuins,
    },
    tendencia,
    rankSetores,
    metas,
    resumo30: { slaGeral, notaGeral: mediaGeralNota, tempoGeral, totalChamados: ch30.length, totalAvaliacoes: av30.length },
  };
}
