import { useEffect, useState } from "react";
import { api } from "./api";
import { C, SETORES } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const PERIODOS = [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"]];
const CORES_SETOR = Object.fromEntries(Object.entries(SETORES).map(([k, v]) => [k, v.cor]));

export default function Relatorio({ sessao, onVoltar }) {
  const soSetor = sessao.perfil === "setor";
  const [dias, setDias] = useState(30);
  const [setor, setSetor] = useState(soSetor ? sessao.setor_id : "");
  const [rel, setRel] = useState(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const fim = Date.now(), inicio = fim - dias * 86400000;
    try { setRel(await api.relatorio(inicio, fim, soSetor ? undefined : setor, sessao.token)); }
    catch (e) { console.error(e); }
    setCarregando(false);
  }
  useEffect(() => { carregar(); }, [dias, setor]);

  return (
    <div style={{ minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <header className="noprint" style={{ background: "#fff", borderBottom: `1px solid ${C.linha}`, padding: "13px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <MarcaNatus s={17} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {rel && <>
            <button onClick={() => exportarPDF(rel, dias, setor)} style={btn(C.vermelho, "#FDECEC")}>Exportar PDF</button>
            <button onClick={() => exportarExcel(rel, dias)} style={btn(C.verde, "#E8F6EF")}>Exportar Excel</button>
          </>}
          {onVoltar && <button onClick={onVoltar} style={{ fontSize: 13, fontWeight: 600, color: C.tinta60, background: C.fundo, border: "none", borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}>Voltar</button>}
        </div>
      </header>

      <div style={{ padding: "22px 26px", maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 3 }}>Relatório de experiência e serviços</h1>
        <p style={{ fontSize: 14, color: C.tinta60, marginBottom: 18 }}>
          {soSetor ? `Setor ${SETORES[sessao.setor_id]?.nome}` : "Visão geral"} · últimos {dias} dias
        </p>

        {/* filtros */}
        <div className="noprint" style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {PERIODOS.map(([v, lb]) => (
              <button key={v} onClick={() => setDias(Number(v))} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 20, border: `1px solid ${dias == v ? C.petroleo : C.linha}`, background: dias == v ? C.petroleo : "#fff", color: dias == v ? "#fff" : C.tinta60, cursor: "pointer", fontFamily: "inherit" }}>{lb}</button>
            ))}
          </div>
          {!soSetor && (
            <select value={setor} onChange={(e) => setSetor(e.target.value)} style={{ fontSize: 13, padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.linha}`, fontFamily: "inherit" }}>
              <option value="">Todos os setores</option>
              {Object.entries(SETORES).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
            </select>
          )}
        </div>

        {carregando && <div style={{ padding: 40, textAlign: "center", color: C.tinta60 }}>Gerando relatório…</div>}
        {rel && !carregando && <Conteudo rel={rel} />}
      </div>
      <div style={{ padding: "14px 26px", display: "flex", justifyContent: "center" }}><SeloHosppital /></div>
    </div>
  );
}

function Conteudo({ rel }) {
  const r = rel.resumo;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* resumo executivo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <Kpi label="Total de chamados" v={r.totalChamados} cor={C.petroleo} />
        <Kpi label="Tempo médio" v={r.tempoMedio + " min"} cor={C.teal} />
        <Kpi label="Dentro do SLA" v={r.slaPct + "%"} cor={r.slaPct >= 80 ? C.verde : r.slaPct >= 60 ? C.ambar : C.vermelho} />
        <Kpi label="Nota de experiência" v={r.notaMedia ?? "—"} cor={r.notaMedia >= 8 ? C.verde : r.notaMedia >= 7 ? C.ambar : C.vermelho} />
        <Kpi label="Intervenções" v={r.totalIntervencoes} cor={C.petroleo} />
        <Kpi label="Leitos críticos" v={r.leitosCriticos} cor={r.leitosCriticos ? C.vermelho : C.verde} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* 1. volume por setor */}
        <Bloco titulo="Volume por setor">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rel.volumeSetor} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {rel.volumeSetor.map((s) => <Cell key={s.id} fill={CORES_SETOR[s.id] || C.petroleo} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Bloco>

        {/* 1b. volume por tipo */}
        <Bloco titulo="Natureza dos chamados (tipo)">
          <div style={{ maxHeight: 220, overflow: "auto" }}>
            {rel.volumeServico.map((s) => {
              const max = rel.volumeServico[0].total;
              return (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span>{s.titulo}</span><span style={{ fontWeight: 700 }}>{s.total}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 5, background: "#EEF3F5", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(s.total / max) * 100}%`, background: C.teal, borderRadius: 5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Bloco>
      </div>

      {/* 2. tempo de resposta e SLA por setor */}
      <Bloco titulo="Tempo de resposta e cumprimento de SLA por setor">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", color: C.tinta60, fontSize: 11, textTransform: "uppercase" }}>
            {["Setor", "Concluídos", "Tempo médio", "Dentro do SLA"].map((x) => <th key={x} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.linha}` }}>{x}</th>)}
          </tr></thead>
          <tbody>
            {rel.desempenho.desempenhoSetor.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #EEF3F5" }}>
                <td style={{ padding: "8px 10px", fontWeight: 600 }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CORES_SETOR[s.id], marginRight: 7 }} />{s.nome}</td>
                <td style={{ padding: "8px 10px" }}>{s.concluidos}</td>
                <td style={{ padding: "8px 10px" }}>{s.tempoMedio} min</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontWeight: 700, color: s.slaPct >= 80 ? C.verde : s.slaPct >= 60 ? C.ambar : C.vermelho }}>{s.slaPct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        {/* 3. tendência de experiência */}
        <Bloco titulo="Experiência ao longo do período">
          {rel.experiencia.serie.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rel.experiencia.serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF3F5" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="media" stroke={C.petroleo} strokeWidth={2.5} dot={{ r: 3 }} name="Nota média" />
              </LineChart>
            </ResponsiveContainer>
          ) : <Vazio />}
        </Bloco>

        {/* 3b. distribuição */}
        <Bloco titulo="Distribuição das notas">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={[
                { name: "Boa (9-10)", value: rel.experiencia.distribuicao.boa, fill: C.verde },
                { name: "Neutra (7-8)", value: rel.experiencia.distribuicao.neutra, fill: C.ambar },
                { name: "Ruim (0-6)", value: rel.experiencia.distribuicao.ruim, fill: C.vermelho },
              ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(d) => d.value || ""}>
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11, color: C.tinta60 }}>
            <Leg cor={C.verde} txt="Boa" /><Leg cor={C.ambar} txt="Neutra" /><Leg cor={C.vermelho} txt="Ruim" />
          </div>
        </Bloco>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* 4. intervenções — resumo */}
        <Bloco titulo="Intervenções do concierge">
          <div style={{ fontSize: 32, fontWeight: 800, color: C.petroleo }}>{rel.intervencoes.total}</div>
          <div style={{ fontSize: 13, color: C.tinta60, marginBottom: 12 }}>registradas no período</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: C.tealNevoa }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.petroleo }}>{rel.intervencoes.espontaneas}</div>
              <div style={{ fontSize: 11, color: C.tinta60 }}>abordagens por iniciativa</div>
            </div>
            <div style={{ flex: 1, padding: "8px 10px", borderRadius: 10, background: "#FDECEC" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.vermelho }}>{rel.intervencoes.respostaNota}</div>
              <div style={{ fontSize: 11, color: C.tinta60 }}>resposta a nota baixa</div>
            </div>
          </div>
          {rel.intervencoes.porAutor.map((a) => (
            <div key={a.autor} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #EEF3F5" }}>
              <span>{a.autor}</span><span style={{ fontWeight: 700 }}>{a.total}</span>
            </div>
          ))}
        </Bloco>

        {/* 5. ranking de leitos críticos */}
        <Bloco titulo="Leitos que exigiram mais atenção">
          {rel.leitosCriticos.length === 0 ? <Vazio texto="Nenhum leito crítico no período." /> : (
            <div style={{ maxHeight: 240, overflow: "auto" }}>
              {rel.leitosCriticos.map((l, i) => (
                <div key={l.quarto} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8, background: i < 3 ? "#FDECEC" : C.fundo, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.tinta60, width: 20 }}>{i + 1}º</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, flex: 1 }}>{l.quarto}</span>
                  <span style={{ fontSize: 11, color: C.tinta60 }}>{l.chamados} chamados · {l.estourados} atrasos · {l.notasRuins} notas baixas</span>
                </div>
              ))}
            </div>
          )}
        </Bloco>
      </div>

      {/* 6. Detalhe das abordagens — largura total, o conteúdo de cada registro */}
      <Bloco titulo="Abordagens e intervenções registradas — detalhe">
        {rel.intervencoes.lista.length === 0 ? <Vazio texto="Nenhuma abordagem registrada no período." /> : (
          <div style={{ maxHeight: 380, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ textAlign: "left", color: C.tinta60, fontSize: 11, textTransform: "uppercase" }}>
                {["Quando", "Leito", "Paciente", "Tipo", "O que foi feito", "Registrado por"].map((x) => <th key={x} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.linha}`, position: "sticky", top: 0, background: "#fff" }}>{x}</th>)}
              </tr></thead>
              <tbody>
                {rel.intervencoes.lista.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid #EEF3F5" }}>
                    <td style={{ padding: "8px 10px", color: C.tinta60, whiteSpace: "nowrap" }}>{new Date(it.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700 }}>{it.quarto_id}</td>
                    <td style={{ padding: "8px 10px", color: C.tinta60 }}>{it.paciente || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: it.tipo === "espontanea" ? C.tealNevoa : "#FDECEC", color: it.tipo === "espontanea" ? C.petroleo : C.vermelho }}>
                        {it.tipo === "espontanea" ? "Iniciativa" : "Nota baixa"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>{it.acao}</td>
                    <td style={{ padding: "8px 10px", color: C.tinta60 }}>{it.autor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </div>
  );
}

// ---- exportadores ----
function exportarPDF(rel, dias, setor) {
  const doc = new jsPDF();
  const r = rel.resumo;
  const nomeSetor = setor ? SETORES[setor]?.nome : "Visão geral";
  doc.setFontSize(16); doc.setTextColor(15, 106, 136);
  doc.text("Relatório de Experiência e Serviços", 14, 18);
  doc.setFontSize(10); doc.setTextColor(90);
  doc.text(`Natus Lumine · ${nomeSetor} · últimos ${dias} dias · gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);

  autoTable(doc, {
    startY: 32, head: [["Indicador", "Valor"]],
    body: [
      ["Total de chamados", String(r.totalChamados)],
      ["Concluídos", String(r.concluidos)],
      ["Tempo médio de atendimento", r.tempoMedio + " min"],
      ["Dentro do SLA", r.slaPct + "%"],
      ["Nota média de experiência", String(r.notaMedia ?? "—")],
      ["Total de avaliações", String(r.totalAvaliacoes)],
      ["Intervenções do concierge", String(r.totalIntervencoes)],
      ["Leitos críticos", String(r.leitosCriticos)],
    ],
    theme: "striped", headStyles: { fillColor: [15, 106, 136] },
  });

  autoTable(doc, { head: [["Setor", "Chamados"]], body: rel.volumeSetor.map((s) => [s.nome, String(s.total)]), theme: "grid", headStyles: { fillColor: [51, 151, 175] }, styles: { fontSize: 9 }, margin: { top: 6 } });
  autoTable(doc, { head: [["Setor", "Concluídos", "Tempo médio", "SLA %"]], body: rel.desempenho.desempenhoSetor.map((s) => [s.nome, String(s.concluidos), s.tempoMedio + " min", s.slaPct + "%"]), theme: "grid", headStyles: { fillColor: [51, 151, 175] }, styles: { fontSize: 9 } });
  if (rel.leitosCriticos.length) autoTable(doc, { head: [["Leito", "Chamados", "Atrasos", "Notas baixas"]], body: rel.leitosCriticos.map((l) => [l.quarto, String(l.chamados), String(l.estourados), String(l.notasRuins)]), theme: "grid", headStyles: { fillColor: [214, 69, 69] }, styles: { fontSize: 9 } });

  if (rel.intervencoes.lista.length) autoTable(doc, {
    head: [["Data", "Leito", "Tipo", "O que foi feito", "Por"]],
    body: rel.intervencoes.lista.map((it) => [
      new Date(it.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      it.quarto_id, it.tipo === "espontanea" ? "Iniciativa" : "Nota baixa", it.acao, it.autor,
    ]),
    theme: "grid", headStyles: { fillColor: [15, 106, 136] }, styles: { fontSize: 8 },
  });

  doc.save(`relatorio-natus-${dias}dias.pdf`);
}

function exportarExcel(rel, dias) {
  const wb = XLSX.utils.book_new();
  const resumo = [
    ["Total de chamados", rel.resumo.totalChamados],
    ["Concluídos", rel.resumo.concluidos],
    ["Tempo médio (min)", rel.resumo.tempoMedio],
    ["SLA %", rel.resumo.slaPct],
    ["Nota média", rel.resumo.notaMedia ?? ""],
    ["Avaliações", rel.resumo.totalAvaliacoes],
    ["Intervenções", rel.resumo.totalIntervencoes],
    ["Leitos críticos", rel.resumo.leitosCriticos],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Indicador", "Valor"], ...resumo]), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rel.volumeSetor.map((s) => ({ Setor: s.nome, Chamados: s.total }))), "Volume por setor");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rel.volumeServico.map((s) => ({ Tipo: s.titulo, Chamados: s.total }))), "Volume por tipo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rel.desempenho.desempenhoSetor.map((s) => ({ Setor: s.nome, Concluidos: s.concluidos, "Tempo medio (min)": s.tempoMedio, "SLA %": s.slaPct }))), "Desempenho SLA");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rel.experiencia.serie.map((s) => ({ Dia: s.dia, "Nota media": s.media, Avaliacoes: s.n }))), "Experiencia");
  if (rel.leitosCriticos.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rel.leitosCriticos.map((l) => ({ Leito: l.quarto, Chamados: l.chamados, Atrasos: l.estourados, "Notas baixas": l.notasRuins }))), "Leitos criticos");
  if (rel.intervencoes.lista.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rel.intervencoes.lista.map((it) => ({
    Data: new Date(it.em).toLocaleString("pt-BR"),
    Leito: it.quarto_id, Paciente: it.paciente || "", Tipo: it.tipo === "espontanea" ? "Iniciativa" : "Nota baixa",
    "O que foi feito": it.acao, "Registrado por": it.autor,
  }))), "Abordagens");
  XLSX.writeFile(wb, `relatorio-natus-${dias}dias.xlsx`);
}

const Kpi = ({ label, v, cor }) => (
  <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 14, padding: "14px 16px" }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: C.tinta60, fontWeight: 600, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: cor, lineHeight: 1 }}>{v}</div>
  </div>
);
const Bloco = ({ titulo, children }) => (
  <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 16, padding: 16 }}>
    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: C.tinta }}>{titulo}</div>
    {children}
  </div>
);
const Vazio = ({ texto = "Sem dados no período." }) => <div style={{ padding: 30, textAlign: "center", color: C.tinta60, fontSize: 13 }}>{texto}</div>;
const Leg = ({ cor, txt }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: cor }} />{txt}</span>;
const btn = (cor, bg) => ({ fontSize: 13, fontWeight: 700, color: cor, background: bg, border: "none", borderRadius: 20, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" });
