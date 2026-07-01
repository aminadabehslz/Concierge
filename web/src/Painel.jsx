import { useEffect, useState, useMemo } from "react";
import { api, useTempoReal } from "./api";
import { C, SETORES, SERVICOS, STATUS, slaInfo, fmtHora, termometro } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";
import QRGerador from "./QRGerador.jsx";
import Relatorio from "./Relatorio.jsx";

export default function Painel({ sessao, onSair }) {
  return <Torre sessao={sessao} onSair={onSair} />;
}

function Torre({ sessao, onSair }) {
  const [vista, setVista] = useState("torre");
  const [estado, setEstado] = useState({ quartos: [], chamados: [], avaliacoes: [], intervencoes: [] });
  const [alertas, setAlertas] = useState([]); // intervenções pendentes (nota baixa)
  const [flash, setFlash] = useState(null);
  const [intervindo, setIntervindo] = useState(null);
  const [altaModal, setAltaModal] = useState(false);
  const [abordagemModal, setAbordagemModal] = useState(false);
  const [, tick] = useState(0);

  async function recarregar() {
    try { setEstado(await api.estado(sessao.token)); }
    catch (e) { if (String(e.message).includes("401")) onSair(); }
  }
  useEffect(() => { recarregar(); }, []);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 8000); return () => clearInterval(t); }, []);

  const { conectado } = useTempoReal((msg) => {
    const p = msg.payload;
    if (msg.tipo === "snapshot") { setEstado(p); return; }
    if (msg.tipo === "chamado_novo") { setFlash(p.id); setTimeout(() => setFlash(null), 1500); }
    if (msg.tipo === "avaliacao_nova" && p.intervir) {
      setAlertas((a) => [{ ...p, ts: Date.now() }, ...a.filter((x) => x.quarto.id !== p.quarto.id)]);
    }
    recarregar();
  });

  if (vista === "qr") return <QRGerador sessao={sessao} onVoltar={() => setVista("torre")} />;
  if (vista === "relatorio") return <Relatorio sessao={sessao} onVoltar={() => setVista("torre")} />;

  const ch = estado.chamados;
  const ativos = ch.filter((c) => c.status !== "concluido");
  const estourados = ativos.filter((c) => slaInfo(c).estourado);
  const concl = ch.filter((c) => c.status === "concluido");
  const tempoMedio = concl.length ? Math.round(concl.reduce((a, c) => a + slaInfo(c).dur, 0) / concl.length) : 0;

  // termômetro institucional (média das últimas avaliações por leito)
  const porLeito = {};
  for (const a of estado.avaliacoes) (porLeito[a.quarto_id] ||= []).push(a);
  const termos = Object.entries(porLeito).map(([q, avs]) => ({ quarto: q, ...termometro(avs) }));
  const expMedia = termos.length ? (termos.reduce((a, t) => a + (t.ultima || 0), 0) / termos.length) : null;
  const leitosRuins = termos.filter((t) => t.faixa === "ruim");

  const qNome = (id) => estado.quartos.find((x) => x.id === id)?.paciente || "";

  return (
    <div style={{ minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#fff", borderBottom: `1px solid ${C.linha}`, padding: "13px 26px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <MarcaNatus s={17} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setAbordagemModal(true)} style={{ ...btnGhost, color: C.petroleo, background: C.tealNevoa }}>Registrar abordagem</button>
          <button onClick={() => setVista("relatorio")} style={btnGhost}>Relatórios</button>
          <button onClick={() => setVista("qr")} style={btnGhost}>QR Codes</button>
          <button onClick={() => setAltaModal(true)} style={{ ...btnGhost, color: C.vermelho, background: "#FDECEC" }}>Alta / zerar leito</button>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: conectado ? C.verde : C.tinta60 }}>
            <span className={conectado ? "pulse" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: conectado ? C.verde : C.tinta60 }} />{conectado ? "ao vivo" : "..."}
          </span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{sessao.nome}</div>
            <div style={{ fontSize: 11, color: C.tinta60 }}>Concierge · gestão de experiência</div>
          </div>
          <button onClick={onSair} style={{ ...btnGhost, background: C.fundo }}>Sair</button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "22px 26px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>Gestão de experiência</h1>
        <p style={{ fontSize: 14, color: C.tinta60, marginBottom: 20 }}>Os pedidos vão direto aos setores. Aqui você monitora prazos, reforça quem atrasou e intervém quando a experiência cai.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 22 }}>
          <Kpi label="Pedidos ativos" v={ativos.length} cor={C.petroleo} />
          <Kpi label="SLA estourado" v={estourados.length} cor={estourados.length ? C.vermelho : C.tinta60} />
          <Kpi label="Tempo médio" v={tempoMedio + " min"} cor={C.teal} />
          <Kpi label="Experiência média" v={expMedia != null ? expMedia.toFixed(1) : "—"} cor={expMedia >= 8 ? C.verde : expMedia >= 7 ? C.ambar : C.vermelho} />
          <Kpi label="Leitos em atenção" v={leitosRuins.length} cor={leitosRuins.length ? C.vermelho : C.verde} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, alignItems: "start" }}>
          {/* Esquerda: chamados por setor + SLA */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <div style={cardHead}>Pedidos ativos por setor</div>
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {Object.entries(SETORES).map(([sid, meta]) => {
                  const doSetor = ativos.filter((c) => c.setor_id === sid);
                  const est = doSetor.filter((c) => slaInfo(c).estourado).length;
                  return (
                    <div key={sid} style={{ borderRadius: 12, border: `1px solid ${est ? C.vermelho : C.linha}`, padding: 12, background: est ? "#FDECEC" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: meta.cor }} />
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{meta.nome}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: C.tinta }}>{doSetor.length}</div>
                      {est > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: C.vermelho }}>{est} atrasado(s)</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}>Fila geral — reforce ou reencaminhe</div>
              <div style={{ maxHeight: "42vh", overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ textAlign: "left", color: C.tinta60, fontSize: 11, textTransform: "uppercase" }}>
                    {["Quarto", "Pedido", "Setor", "Prazo", "Ação"].map((x) => <th key={x} style={{ padding: "9px 12px", borderBottom: `1px solid ${C.linha}`, position: "sticky", top: 0, background: "#fff" }}>{x}</th>)}
                  </tr></thead>
                  <tbody>
                    {ativos.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: C.tinta60 }}>Nenhum pedido ativo.</td></tr>}
                    {[...ativos].sort((a, b) => (slaInfo(b).estourado - slaInfo(a).estourado) || a.criado_em - b.criado_em).map((c) => {
                      const s = SERVICOS[c.servico], st = slaInfo(c), meta = SETORES[c.setor_id];
                      return (
                        <tr key={c.id} className={flash === c.id ? "flash" : ""} style={{ borderBottom: "1px solid #EEF3F5" }}>
                          <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700 }}>{c.quarto_id}</td>
                          <td style={{ padding: "9px 12px" }}>{s.titulo}{c.detalhe ? <div style={{ fontSize: 11, color: C.tinta60 }}>“{c.detalhe}”</div> : null}</td>
                          <td style={{ padding: "9px 12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: meta.cor }} />{meta.nome}</span></td>
                          <td style={{ padding: "9px 12px" }}>{st.estourado ? <span style={{ fontWeight: 800, color: "#fff", background: C.vermelho, padding: "2px 7px", borderRadius: 7 }}>+{st.passados - c.sla_min}min</span> : <span style={{ fontWeight: 700, color: st.restante <= 5 ? C.ambar : C.tinta60 }}>{Math.max(st.restante, 0)}min</span>}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <button onClick={() => api.concluir(c.id, sessao.token).then(recarregar)} style={{ fontSize: 11, fontWeight: 700, color: C.verde, background: "#EAF7F0", padding: "5px 9px", borderRadius: 7, marginRight: 5, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Concluir</button>
                            <button onClick={() => api.reforcar(c.id, sessao.token)} style={{ fontSize: 11, fontWeight: 700, color: C.ambar, background: "#FFF4E2", padding: "5px 9px", borderRadius: 7, marginRight: 5, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Reforçar</button>
                            <select onChange={(e) => e.target.value && api.reencaminhar(c.id, e.target.value, sessao.token).then(recarregar)} style={{ fontSize: 11, padding: "4px 6px", borderRadius: 7, border: `1px solid ${C.linha}`, fontFamily: "inherit" }}>
                              <option value="">Reencaminhar…</option>
                              {Object.entries(SETORES).filter(([k]) => k !== c.setor_id).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Direita: intervenções de experiência */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...card, border: alertas.length ? `2px solid ${C.vermelho}` : `1px solid ${C.linha}` }}>
              <div style={{ ...cardHead, color: alertas.length ? C.vermelho : C.tinta }}>
                Intervenções de experiência {alertas.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#fff", background: C.vermelho, padding: "1px 8px", borderRadius: 20 }}>{alertas.length}</span>}
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {alertas.length === 0 && <div style={{ fontSize: 13, color: C.tinta60, padding: 6 }}>Nenhuma avaliação baixa agora. Continue acompanhando os leitos.</div>}
                {alertas.map((al) => (
                  <div key={al.aval.id} style={{ borderRadius: 12, background: "#FDECEC", border: "1px solid #F6D6D6", padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 15 }}>{al.quarto.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: C.vermelho, padding: "2px 9px", borderRadius: 20 }}>nota {al.aval.nota}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.tinta60, margin: "3px 0" }}>{al.quarto.paciente || al.quarto.setor}{al.aval.comentario ? ` · “${al.aval.comentario}”` : ""}</div>
                    <button onClick={() => setIntervindo(al)} style={{ width: "100%", marginTop: 6, padding: 9, borderRadius: 9, background: C.vermelho, color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Registrar intervenção →</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={cardHead}>Termômetro dos leitos</div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 7, maxHeight: "32vh", overflow: "auto" }}>
                {termos.length === 0 && <div style={{ fontSize: 13, color: C.tinta60, padding: 6 }}>Sem avaliações ainda.</div>}
                {termos.sort((a, b) => (a.ultima || 0) - (b.ultima || 0)).map((t) => {
                  const cor = t.faixa === "ruim" ? C.vermelho : t.faixa === "neutra" ? C.ambar : C.verde;
                  const seta = t.tendencia === "subindo" ? "↑" : t.tendencia === "caindo" ? "↓" : "→";
                  return (
                    <div key={t.quarto} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: C.fundo }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, width: 60 }}>{t.quarto}</span>
                      <span style={{ flex: 1, fontSize: 12, color: C.tinta60 }}>{qNome(t.quarto) || "—"}</span>
                      <span style={{ fontSize: 13, color: C.tinta60 }}>{seta}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: cor }}>{t.ultima}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 26px", borderTop: `1px solid ${C.linha}`, background: "#fff", display: "flex", justifyContent: "flex-end" }}><SeloHosppital /></div>

      {intervindo && <ModalIntervencao alerta={intervindo} sessao={sessao} onFeito={() => { setIntervindo(null); setAlertas((a) => a.filter((x) => x.aval.id !== intervindo.aval.id)); recarregar(); }} onFechar={() => setIntervindo(null)} />}
      {altaModal && <ModalAlta quartos={estado.quartos} chamados={ch} sessao={sessao} onFeito={recarregar} onFechar={() => setAltaModal(false)} />}
      {abordagemModal && <ModalAbordagem quartos={estado.quartos} sessao={sessao} onFeito={recarregar} onFechar={() => setAbordagemModal(false)} />}
    </div>
  );
}

function ModalIntervencao({ alerta, sessao, onFeito, onFechar }) {
  const [acao, setAcao] = useState("");
  const sugestoes = ["Fui ao leito e conversei com o paciente", "Acionei o setor responsável e acompanhei", "Resolvi pessoalmente a questão"];
  async function salvar() { await api.intervir(alerta.quarto.id, acao || "Intervenção registrada", alerta.aval.id, sessao.token); onFeito(); }
  return (
    <Overlay onFechar={onFechar}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Intervenção — leito {alerta.quarto.id}</h2>
      <p style={{ fontSize: 13, color: C.tinta60, margin: "4px 0 14px" }}>Avaliação {alerta.aval.nota}/10{alerta.aval.comentario ? ` · “${alerta.aval.comentario}”` : ""}. Registre rápido o que foi feito.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {sugestoes.map((s) => <button key={s} onClick={() => setAcao(s)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 20, border: `1px solid ${C.linha}`, background: acao === s ? C.tealNevoa : "#fff", color: C.tinta, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>)}
      </div>
      <textarea value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="O que você fez? (ex.: fui ao leito, ajustei o ar e levei cobertor)" style={{ width: "100%", height: 80, padding: 12, borderRadius: 12, border: `1px solid ${C.linha}`, fontSize: 14, resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={salvar} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.petroleo, color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Registrar e resolver</button>
        <button onClick={onFechar} style={{ padding: "12px 18px", borderRadius: 10, background: C.fundo, color: C.tinta60, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
      </div>
    </Overlay>
  );
}

function ModalAbordagem({ quartos, sessao, onFeito, onFechar }) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(null);
  const [acao, setAcao] = useState("");
  const sugestoes = ["Passei no leito para acompanhar", "Percebi algo e fui verificar", "Visita proativa de cortesia", "Acompanhamento de caso sensível"];
  const lista = (busca ? quartos.filter((q) => q.id.toLowerCase().includes(busca.toLowerCase()) || (q.paciente || "").toLowerCase().includes(busca.toLowerCase())) : quartos.filter((q) => q.paciente)).slice(0, 40);
  async function salvar() {
    if (!sel) return;
    await api.intervir(sel, acao || "Abordagem à beira-leito", null, sessao.token);
    onFeito(); onFechar();
  }
  return (
    <Overlay onFechar={onFechar}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Registrar abordagem à beira-leito</h2>
      <p style={{ fontSize: 13, color: C.tinta60, margin: "4px 0 14px" }}>Documente uma ida ao leito por iniciativa própria — sem depender de uma avaliação baixa. Fica registrado na trilha de experiência do leito.</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar leito ou nome…" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.linha}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "28vh", overflow: "auto", marginBottom: 14 }}>
        {lista.length === 0 && <div style={{ fontSize: 13, color: C.tinta60, padding: 8 }}>Nenhum leito encontrado. Digite o número para buscar.</div>}
        {lista.map((q) => (
          <button key={q.id} onClick={() => setSel(q.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 11, borderRadius: 10, border: `1px solid ${sel === q.id ? C.petroleo : C.linha}`, background: sel === q.id ? C.tealNevoa : "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{q.id}</span>
            <span style={{ flex: 1, fontSize: 13, color: C.tinta60 }}>{q.paciente || "— sem nome —"} · {q.setor}</span>
            {sel === q.id && <span style={{ color: C.petroleo, fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {sugestoes.map((s) => <button key={s} onClick={() => setAcao(s)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 20, border: `1px solid ${C.linha}`, background: acao === s ? C.tealNevoa : "#fff", color: C.tinta, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>)}
      </div>
      <textarea value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="O que motivou e o que você fez? (ex.: acompanhante comentou desconforto; ajustei com a hotelaria)" style={{ width: "100%", height: 80, padding: 12, borderRadius: 12, border: `1px solid ${C.linha}`, fontSize: 14, resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button disabled={!sel} onClick={salvar} style={{ flex: 1, padding: 12, borderRadius: 10, background: sel ? C.petroleo : C.linha, color: "#fff", fontWeight: 700, border: "none", cursor: sel ? "pointer" : "default", fontFamily: "inherit" }}>Registrar abordagem{sel ? ` — leito ${sel}` : ""}</button>
        <button onClick={onFechar} style={{ padding: "12px 18px", borderRadius: 10, background: C.fundo, color: C.tinta60, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
      </div>
    </Overlay>
  );
}

function ModalAlta({ quartos, chamados, sessao, onFeito, onFechar }) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(null);
  const ocupados = quartos.filter((q) => q.paciente || chamados.some((c) => c.quarto_id === q.id && c.status !== "concluido"));
  const lista = (busca ? quartos.filter((q) => q.id.toLowerCase().includes(busca.toLowerCase()) || (q.paciente || "").toLowerCase().includes(busca.toLowerCase())) : ocupados).slice(0, 40);
  async function confirmar() { await api.alta(sel, sessao.token); onFeito(); onFechar(); }
  return (
    <Overlay onFechar={onFechar}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Dar alta — zerar dados do leito</h2>
      <p style={{ fontSize: 13, color: C.tinta60, margin: "4px 0 14px" }}>Conclui pedidos abertos, apaga nome e oculta o histórico para o próximo paciente. Ação de LGPD.</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar leito ou nome…" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.linha}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "40vh", overflow: "auto" }}>
        {lista.length === 0 && <div style={{ fontSize: 13, color: C.tinta60, padding: 8 }}>Nenhum leito com dados ativos.</div>}
        {lista.map((q) => (
          <button key={q.id} onClick={() => setSel(q.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 11, borderRadius: 10, border: `1px solid ${sel === q.id ? C.vermelho : C.linha}`, background: sel === q.id ? "#FDECEC" : "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{q.id}</span>
            <span style={{ flex: 1, fontSize: 13, color: C.tinta60 }}>{q.paciente || "— sem nome —"} · {q.setor}</span>
            {sel === q.id && <span style={{ color: C.vermelho, fontWeight: 700 }}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button disabled={!sel} onClick={confirmar} style={{ flex: 1, padding: 12, borderRadius: 10, background: sel ? C.vermelho : C.linha, color: "#fff", fontWeight: 700, border: "none", cursor: sel ? "pointer" : "default", fontFamily: "inherit" }}>Confirmar alta {sel || ""}</button>
        <button onClick={onFechar} style={{ padding: "12px 18px", borderRadius: 10, background: C.fundo, color: C.tinta60, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
      </div>
    </Overlay>
  );
}

const Overlay = ({ children, onFechar }) => (
  <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(12,43,54,0.4)", display: "grid", placeItems: "center", zIndex: 50 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 22, width: "min(480px,92vw)", maxHeight: "86vh", overflow: "auto" }}>{children}</div>
  </div>
);
const Kpi = ({ label, v, cor }) => (
  <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 14, padding: "14px 16px" }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: C.tinta60, fontWeight: 600, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: cor, lineHeight: 1 }}>{v}</div>
  </div>
);
const card = { background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 16, overflow: "hidden" };
const cardHead = { padding: "12px 16px", borderBottom: `1px solid ${C.linha}`, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 };
const btnGhost = { fontSize: 13, fontWeight: 600, color: C.tinta60, background: C.tealNevoa, border: "none", borderRadius: 20, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" };
