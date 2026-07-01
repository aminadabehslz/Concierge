import { useEffect, useState } from "react";
import { api, useTempoReal } from "./api";
import { C, SETORES } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";
import Relatorio from "./Relatorio.jsx";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

export default function Estrategico({ sessao, onSair }) {
  const [dados, setDados] = useState(null);
  const [verRelatorio, setVerRelatorio] = useState(false);
  const [zerarModal, setZerarModal] = useState(false);
  const [zerando, setZerando] = useState(false);
  const [, tick] = useState(0);

  async function carregar() {
    try { setDados(await api.estrategico(sessao.token)); }
    catch (e) { if (String(e.message).includes("401")) onSair?.(); }
  }
  useEffect(() => { carregar(); }, []);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  useTempoReal((msg) => { if (["chamado_novo", "chamado_atualizado", "avaliacao_nova", "intervencao_nova", "alta"].includes(msg.tipo)) carregar(); });

  if (verRelatorio) return <Relatorio sessao={sessao} onVoltar={() => setVerRelatorio(false)} />;
  if (!dados) return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "'Plus Jakarta Sans',sans-serif", color: C.tinta60, background: C.fundo }}>Carregando painel…</div>;

  async function zerar() {
    setZerando(true);
    try { await api.zerarMovimento(sessao.token); await carregar(); setZerarModal(false); }
    catch (e) { alert("Não foi possível zerar: " + e.message); }
    setZerando(false);
  }

  const d = dados.dia, r = dados.resumo30;
  const metasOk = dados.metas.filter((m) => m.ok).length;
  const todasOk = metasOk === dados.metas.length;
  const veredito = todasOk ? "Todos os indicadores dentro da meta" : `${dados.metas.length - metasOk} indicador(es) fora da meta`;

  return (
    <div style={{ minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: C.tinta }}>
      {/* header */}
      <header style={{ background: "#fff", borderBottom: `1px solid ${C.linha}`, padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <MarcaNatus s={16} />
          <div style={{ borderLeft: `1px solid ${C.linha}`, paddingLeft: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>Painel da Direção</div>
            <div style={{ fontSize: 12, color: C.tinta60 }}>Visão estratégica da experiência do paciente</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 12, color: C.tinta60 }}>Atualizado às {new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          <button onClick={() => setVerRelatorio(true)} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: C.petroleo, border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontFamily: "inherit" }}>Relatório detalhado</button>
          <button onClick={() => setZerarModal(true)} style={{ fontSize: 13, fontWeight: 700, color: C.vermelho, background: "#FDECEC", border: "none", borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}>Zerar dados</button>
          {onSair && <button onClick={onSair} style={{ fontSize: 13, color: C.tinta60, background: C.fundo, border: "none", borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}>Sair</button>}
        </div>
      </header>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
        {/* faixa-veredito: a coisa que a direção quer saber primeiro */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderRadius: 16, marginBottom: 28, background: todasOk ? "#F0FAF5" : "#FFF7ED", border: `1px solid ${todasOk ? "#CDEBDD" : "#FCE3C4"}` }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", background: todasOk ? C.verde : C.ambar, color: "#fff", fontSize: 22, fontWeight: 800 }}>{todasOk ? "✓" : "!"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: todasOk ? "#0B6E48" : "#9A5B00" }}>{veredito}</div>
            <div style={{ fontSize: 13, color: C.tinta60 }}>Referência: últimos 30 dias · {r.totalChamados} chamados · {r.totalAvaliacoes} avaliações coletadas</div>
          </div>
          <div style={{ display: "flex", gap: 22, paddingRight: 4 }}>
            <MiniVeredito rotulo="SLA" valor={r.slaGeral + "%"} ok={r.slaGeral >= 85} />
            <MiniVeredito rotulo="Experiência" valor={r.notaGeral ?? "—"} ok={r.notaGeral >= 8.5} />
            <MiniVeredito rotulo="Tempo médio" valor={r.tempoGeral + "min"} ok={r.tempoGeral <= 30} />
          </div>
        </div>

        {/* metas */}
        <SecaoTitulo>Metas institucionais · 30 dias</SecaoTitulo>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 30 }}>
          {dados.metas.map((m) => <CardMeta key={m.nome} m={m} />)}
        </div>

        {/* hoje */}
        <SecaoTitulo>Hoje, em tempo real</SecaoTitulo>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 30 }}>
          <Kpi label="Chamados hoje" v={d.chamadosHoje} />
          <Kpi label="Ativos agora" v={d.ativos} cor={d.ativos > 15 ? C.ambar : C.tinta} />
          <Kpi label="SLA estourado" v={d.estourados} cor={d.estourados ? C.vermelho : C.verde} />
          <Kpi label="SLA do dia" v={d.slaDia + "%"} cor={corSla(d.slaDia)} />
          <Kpi label="Experiência hoje" v={d.notaDia ?? "—"} cor={corNota(d.notaDia)} />
          <Kpi label="Intervenções" v={d.intervDia} />
          <Kpi label="Leitos em atenção" v={d.leitosRuins} cor={d.leitosRuins ? C.vermelho : C.verde} />
        </div>

        {/* gráficos */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20, marginBottom: 20 }}>
          <Card titulo="Evolução da experiência e do SLA · 30 dias">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dados.tendencia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F5" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: C.tinta60 }} tickFormatter={(x) => x.slice(5)} interval={4} />
                <YAxis yAxisId="l" domain={[0, 10]} tick={{ fontSize: 10, fill: C.tinta60 }} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: C.tinta60 }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.linha}`, fontSize: 12 }} />
                <Line yAxisId="l" type="monotone" dataKey="experiencia" stroke={C.petroleo} strokeWidth={2.5} dot={false} name="Experiência (0-10)" connectNulls />
                <Line yAxisId="r" type="monotone" dataKey="sla" stroke={C.teal} strokeWidth={2} strokeDasharray="5 3" dot={false} name="SLA (%)" connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 18, fontSize: 12, color: C.tinta60, marginTop: 8 }}>
              <Leg cor={C.petroleo} txt="Experiência (0-10)" /><Leg cor={C.teal} txt="Cumprimento de SLA (%)" tracejado />
            </div>
          </Card>

          <Card titulo="SLA por setor">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dados.rankSetores} layout="vertical" margin={{ left: 6 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: C.tinta60 }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: C.tinta60 }} width={92} />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.linha}`, fontSize: 12 }} />
                <ReferenceLine x={85} stroke={C.ambar} strokeDasharray="4 4" />
                <Bar dataKey="slaPct" radius={[0, 6, 6, 0]} name="SLA %">
                  {dados.rankSetores.map((s) => <Cell key={s.id} fill={corSla(s.slaPct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12, color: C.tinta60, marginTop: 8 }}>Linha tracejada marca a meta de 85%. Setores abaixo puxam a média.</div>
          </Card>
        </div>
      </div>
      <div style={{ padding: "14px 32px", display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${C.linha}`, background: "#fff" }}><SeloHosppital /></div>

      {zerarModal && (
        <div onClick={() => !zerando && setZerarModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(12,43,54,0.45)", display: "grid", placeItems: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 26, width: "min(460px,92vw)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FDECEC", display: "grid", placeItems: "center", fontSize: 24, marginBottom: 14 }}>⚠</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: C.tinta }}>Zerar os dados de movimento?</h2>
            <p style={{ fontSize: 14, color: C.tinta60, margin: "8px 0 4px", lineHeight: 1.5 }}>
              Isto apaga <b>todos os chamados, avaliações e intervenções</b>, e limpa os nomes dos pacientes. A estrutura permanece: os 114 leitos, os setores, os usuários e o cardápio continuam intactos.
            </p>
            <p style={{ fontSize: 13, color: C.vermelho, fontWeight: 600, margin: "10px 0 18px" }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button disabled={zerando} onClick={zerar} style={{ flex: 1, padding: 13, borderRadius: 10, background: C.vermelho, color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: zerando ? "default" : "pointer", fontFamily: "inherit", opacity: zerando ? 0.6 : 1 }}>{zerando ? "Zerando…" : "Sim, zerar tudo"}</button>
              <button disabled={zerando} onClick={() => setZerarModal(false)} style={{ padding: "13px 20px", borderRadius: 10, background: C.fundo, color: C.tinta60, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const corSla = (v) => (v >= 85 ? C.verde : v >= 70 ? C.ambar : C.vermelho);
const corNota = (v) => (v >= 8.5 ? C.verde : v >= 7 ? C.ambar : C.vermelho);

function CardMeta({ m }) {
  const cor = m.ok ? C.verde : C.vermelho;
  const valor = m.valor == null ? "—" : m.valor + m.unidade;
  const pct = m.valor == null ? 0 : m.maiorMelhor ? Math.min(100, (m.valor / m.meta) * 100) : Math.min(100, (m.meta / m.valor) * 100);
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.tinta60, fontWeight: 600 }}>{m.nome}</span>
        <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: m.ok ? "#EAF7F0" : "#FDECEC", color: cor }}>{m.ok ? "NA META" : "FORA"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 40, fontWeight: 800, color: cor, lineHeight: 1, letterSpacing: "-0.02em" }}>{valor}</span>
        <span style={{ fontSize: 13, color: C.tinta60 }}>meta {m.maiorMelhor ? "≥" : "≤"} {m.meta}{m.unidade}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: C.fundo, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: cor, borderRadius: 4 }} />
      </div>
    </div>
  );
}

const MiniVeredito = ({ rotulo, valor, ok }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 20, fontWeight: 800, color: ok ? C.verde : C.ambar, lineHeight: 1 }}>{valor}</div>
    <div style={{ fontSize: 11, color: C.tinta60, marginTop: 3 }}>{rotulo}</div>
  </div>
);
const Kpi = ({ label, v, cor = C.tinta }) => (
  <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 14, padding: "15px 16px" }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: C.tinta60, fontWeight: 600, marginBottom: 7 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: cor, lineHeight: 1 }}>{v}</div>
  </div>
);
const Card = ({ titulo, children }) => (
  <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 16, padding: 18 }}>
    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{titulo}</div>
    {children}
  </div>
);
const SecaoTitulo = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: C.tinta60, marginBottom: 14 }}>{children}</div>
);
const Leg = ({ cor, txt, tracejado }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span style={{ width: 14, height: 3, borderRadius: 2, background: tracejado ? `repeating-linear-gradient(90deg, ${cor} 0 4px, transparent 4px 7px)` : cor }} />{txt}
  </span>
);
