import { useEffect, useState } from "react";
import { api, useTempoReal } from "./api";
import { C, SETORES, SERVICOS, slaInfo, fmtHora } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";
import Relatorio from "./Relatorio.jsx";

// Monitor do setor: login de setor OU URL /setor/:sid. Tela clara, padrão institucional.
export default function MonitorSetor({ sessao, setorId, onSair }) {
  const sid = setorId || sessao?.setor_id;
  const meta = SETORES[sid] || { nome: sid, cor: C.petroleo };
  const [chamados, setChamados] = useState([]);
  const [reforco, setReforco] = useState(null);
  const [verRelatorio, setVerRelatorio] = useState(false);
  const [, tick] = useState(0);

  if (verRelatorio) return <Relatorio sessao={sessao} onVoltar={() => setVerRelatorio(false)} />;

  async function carregar() {
    try { const d = await api.setor(sid, sessao.token); setChamados(d.chamados); }
    catch (e) { if (String(e.message).includes("401")) onSair?.(); }
  }
  useEffect(() => { carregar(); }, [sid]);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(t); }, []);

  const { conectado } = useTempoReal((msg) => {
    const p = msg.payload;
    if (msg.tipo === "snapshot") { carregar(); return; }
    if ((msg.tipo === "chamado_novo" || msg.tipo === "chamado_atualizado") && p?.setor_id === sid) carregar();
    if (msg.tipo === "reforco" && p?.setor_id === sid) { setReforco(p); setTimeout(() => setReforco(null), 8000); carregar(); }
  });

  const abertos = chamados.filter((c) => c.status === "aberto");
  const andamento = chamados.filter((c) => c.status === "em_atendimento");
  const estourados = [...abertos, ...andamento].filter((c) => slaInfo(c).estourado);

  async function assumir(id) { await api.assumir(id, sessao.nome, sessao.token); carregar(); }
  async function concluir(id) { await api.concluir(id, sessao.token); carregar(); }

  return (
    <div style={{ minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: C.tinta, display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#fff", padding: "16px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.linha}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MarcaNatus s={16} />
          <div style={{ borderLeft: `1px solid ${C.linha}`, paddingLeft: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 12, height: 40, borderRadius: 6, background: meta.cor }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{meta.nome}</div>
              <div style={{ fontSize: 12, color: C.tinta60 }}>Monitor do setor · chamados em tempo real</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Contador label="Aguardando" valor={abertos.length} cor={C.ambar} />
          <Contador label="Em atendimento" valor={andamento.length} cor={C.teal} />
          <Contador label="Atrasados" valor={estourados.length} cor={estourados.length ? C.vermelho : C.tinta60} />
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: conectado ? C.verde : C.tinta60 }}>
            <span className={conectado ? "pulse" : ""} style={{ width: 9, height: 9, borderRadius: "50%", background: conectado ? C.verde : C.tinta60 }} />{conectado ? "ao vivo" : "..."}
          </span>
          <button onClick={() => setVerRelatorio(true)} style={btnGhost}>Relatório</button>
          {onSair && <button onClick={onSair} style={btnGhost}>Sair</button>}
        </div>
      </header>

      {reforco && (
        <div style={{ background: C.vermelho, color: "#fff", padding: "12px 30px", display: "flex", alignItems: "center", gap: 12, fontWeight: 700, fontSize: 15 }} className="pulse">
          ⚠ O concierge reforçou um chamado deste setor — priorize o atendimento.
        </div>
      )}

      <main style={{ flex: 1, overflow: "auto", padding: 26, maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        {chamados.filter((c) => c.status !== "concluido").length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 80, color: C.tinta60 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EAF7F0", margin: "0 auto 14px", display: "grid", placeItems: "center", fontSize: 30, color: C.verde }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.tinta }}>Nenhum chamado pendente</div>
            <div style={{ fontSize: 15, marginTop: 4 }}>Tudo em dia por aqui.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
            {[...abertos, ...andamento]
              .sort((a, b) => (slaInfo(b).estourado - slaInfo(a).estourado) || a.criado_em - b.criado_em)
              .map((c) => <Card key={c.id} c={c} corSetor={meta.cor} onAssumir={assumir} onConcluir={concluir} />)}
          </div>
        )}
      </main>
      <div style={{ padding: "12px 30px", borderTop: `1px solid ${C.linha}`, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.tinta60 }}>{sessao?.nome}</span>
        <SeloHosppital />
      </div>
    </div>
  );
}

function Card({ c, corSetor, onAssumir, onConcluir }) {
  const s = SERVICOS[c.servico], st = slaInfo(c);
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: `1px solid ${st.estourado ? C.vermelho : C.linha}`, boxShadow: st.estourado ? "0 0 0 3px rgba(214,69,69,0.08)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", lineHeight: 1, color: C.tinta }}>{c.quarto_id}</div>
          <div style={{ fontSize: 12, color: C.tinta60, marginTop: 3 }}>{c.origem === "acompanhante" ? "Acompanhante" : "Paciente"} · {fmtHora(c.criado_em)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {c.status === "concluido" ? <span style={{ color: C.verde, fontWeight: 700 }}>✓ {st.dur}min</span>
            : st.estourado ? <span style={{ fontSize: 19, fontWeight: 800, color: C.vermelho }}>+{st.passados - c.sla_min}min</span>
            : <span style={{ fontSize: 19, fontWeight: 800, color: st.restante <= 5 ? C.ambar : C.tinta }}>{Math.max(st.restante, 0)}min</span>}
          <div style={{ fontSize: 11, color: C.tinta60 }}>SLA {c.sla_min}min</div>
        </div>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: C.tinta }}>{s.titulo}</div>
      {c.detalhe && <div style={{ fontSize: 14, color: C.tinta60, marginBottom: 12 }}>“{c.detalhe}”</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {c.status === "aberto" && <button onClick={() => onAssumir(c.id)} style={{ flex: 1, padding: 12, borderRadius: 10, background: corSetor, color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Assumir</button>}
        {c.status === "em_atendimento" && <>
          <span style={{ flex: 1, padding: "12px 0", textAlign: "center", fontSize: 13, color: C.tinta60 }}>{c.atendente}</span>
          <button onClick={() => onConcluir(c.id)} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.verde, color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Encerrar</button>
        </>}
      </div>
    </div>
  );
}

const Contador = ({ label, valor, cor }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: cor, lineHeight: 1 }}>{valor}</div>
    <div style={{ fontSize: 11, color: C.tinta60, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
  </div>
);
const btnGhost = { fontSize: 13, fontWeight: 600, color: C.tinta60, background: C.fundo, border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" };
