import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, useTempoReal } from "./api";
import { C, SERVICOS, SERVICOS_IDS, SERVICOS_ACOMPANHANTE, STATUS, slaInfo } from "./tema";
import { MarcaNatus, SimboloNatus, SeloHosppital } from "./Marcas";

export default function Paciente() {
  const { token } = useParams();
  const [quarto, setQuarto] = useState(null);
  const [chamados, setChamados] = useState([]);
  const [dieta, setDieta] = useState(null);
  const [erro, setErro] = useState(null);
  const [tela, setTela] = useState("inicio");

  async function carregar() {
    try { const d = await api.paciente(token); setQuarto(d.quarto); setChamados(d.chamados); setDieta(d.dieta); }
    catch (e) { setErro(e.message); }
  }
  useEffect(() => { carregar(); }, [token]);

  useTempoReal((msg) => {
    if (!quarto) return;
    const p = msg.payload;
    if (msg.tipo === "alta" && p?.id === quarto.id) { carregar(); setTela("inicio"); return; }
    if ((msg.tipo === "chamado_novo" || msg.tipo === "chamado_atualizado") && p?.quarto_id === quarto.id) carregar();
  });

  if (erro) return <Centro><p style={{ color: C.vermelho, fontWeight: 700 }}>Quarto não encontrado.</p><p style={{ color: C.tinta60, fontSize: 14 }}>Verifique o QR Code do quarto.</p></Centro>;
  if (!quarto) return <Centro><SimboloNatus s={48} /><p style={{ color: C.tinta60, marginTop: 12 }}>Carregando…</p></Centro>;

  const acompanhante = false; // modo acompanhante removido: todo ocupante usa o app completo
  const ativos = chamados.filter((c) => c.status !== "concluido").length;
  const servicos = acompanhante ? SERVICOS_ACOMPANHANTE : SERVICOS_IDS;
  const abas = acompanhante
    ? [["inicio", "Início"], ["pedidos", "Pedidos"]]
    : [["inicio", "Início"], ["pedidos", "Pedidos"], ["dieta", "Dieta"], ["nps", "Avaliar"]];

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: `1px solid ${C.linha}`, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <MarcaNatus s={16} />
        <SeloHosppital compacto />
      </header>
      <main style={{ flex: 1, overflow: "auto", paddingBottom: 70 }}>
        {tela === "inicio" && <Inicio quarto={quarto} acompanhante={acompanhante} servicos={servicos} ativos={ativos} setTela={setTela} token={token} onNome={carregar} />}
        {tela === "pedidos" && <Pedidos chamados={chamados} setTela={setTela} />}
        {tela === "dieta" && !acompanhante && <Dieta dieta={dieta} setTela={setTela} />}
        {tela === "nps" && !acompanhante && <NPS token={token} setTela={setTela} />}
        {tela?.startsWith?.("serv:") && <Servico token={token} servId={tela.slice(5)} acompanhante={acompanhante} onFeito={() => { carregar(); setTela("pedidos"); }} onVoltar={() => setTela("inicio")} />}
      </main>
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", background: "#fff", borderTop: `1px solid ${C.linha}`, display: "flex", padding: "7px 4px" }}>
        {abas.map(([id, lb]) => {
          const on = tela === id || (tela.startsWith("serv:") && id === "inicio");
          return (
            <button key={id} onClick={() => setTela(id)} style={{ flex: 1, border: "none", background: "none", fontSize: 11, fontWeight: 700, color: on ? C.petroleo : C.tinta60, padding: "5px 0", cursor: "pointer", fontFamily: "inherit" }}>
              {lb}{id === "pedidos" && ativos > 0 ? <span style={{ marginLeft: 3, fontSize: 10, color: "#fff", background: C.vermelho, padding: "0 5px", borderRadius: 10 }}>{ativos}</span> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Inicio({ quarto, acompanhante, servicos, ativos, setTela, token, onNome }) {
  const hr = new Date().getHours();
  const saud = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState(quarto.paciente || "");
  async function salvar() { try { await api.salvarNome(token, nome); setEditandoNome(false); onNome(); } catch {} }

  const titulo = quarto.paciente
    ? `${saud}, ${quarto.paciente.split(" ")[0]}.`
    : acompanhante ? `${saud}.` : `${saud}!`;
  const sub = acompanhante
    ? "Espaço de apoio ao acompanhante. Precisa de algo? É só tocar."
    : "Precisa de algo? É só tocar — a equipe recebe na hora.";

  return (
    <div>
      <div style={{ background: `linear-gradient(160deg, ${C.petroleo}, ${C.petroleoEsc})`, padding: "18px 18px 22px", borderRadius: "0 0 24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -10, top: -10, opacity: 0.18 }}><SimboloNatus s={90} /></div>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#ffffff22", color: "#fff" }}>Quarto {quarto.id}{quarto.suite ? " · Suíte" : ""}</span>
            {acompanhante && <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#ffffff22", color: "#fff" }}>Acompanhante</span>}
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 22, marginTop: 10, letterSpacing: "-0.01em" }}>{titulo}</div>
          <div style={{ color: C.tealNevoa, fontSize: 13, marginTop: 2 }}>{sub}</div>
          {ativos > 0 && (
            <button onClick={() => setTela("pedidos")} style={btnHero}>
              <span className="spin" style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${C.tealNevoa}`, borderTopColor: C.petroleo }} />
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.tinta }}>{ativos} pedido(s) em andamento</div>
                <div style={{ fontSize: 11, color: C.tinta60 }}>Toque para acompanhar</div>
              </div>
              <span style={{ color: C.petroleo }}>→</span>
            </button>
          )}
        </div>
      </div>

      {!acompanhante && !quarto.paciente && !editandoNome && (
        <div style={{ margin: "14px 18px 0", padding: 12, borderRadius: 14, background: "#fff", border: `1px dashed ${C.teal}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13, color: C.tinta60 }}>Quer que a equipe te chame pelo nome? <b style={{ color: C.tinta }}>(opcional)</b></div>
          <button onClick={() => setEditandoNome(true)} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: C.petroleo, padding: "7px 12px", borderRadius: 10 }}>Informar</button>
        </div>
      )}
      {editandoNome && (
        <div style={{ margin: "14px 18px 0", padding: 12, borderRadius: 14, background: "#fff", border: `1px solid ${C.linha}` }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome (opcional)" autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.linha}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={salvar} style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#fff", background: C.petroleo, padding: "9px", borderRadius: 10 }}>Salvar</button>
            <button onClick={() => setEditandoNome(false)} style={{ fontSize: 13, fontWeight: 600, color: C.tinta60, padding: "9px 14px" }}>Agora não</button>
          </div>
          <div style={{ fontSize: 11, color: C.tinta60, marginTop: 8 }}>Seus dados são apagados quando você recebe alta.</div>
        </div>
      )}

      <div style={{ padding: "16px 18px" }}>
        <div style={rotulo}>Como podemos ajudar?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {servicos.map((id) => (
            <button key={id} onClick={() => setTela("serv:" + id)} style={cartao}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: C.tinta }}>{SERVICOS[id].titulo}</div>
              <div style={{ fontSize: 11, color: C.tinta60 }}>{SERVICOS[id].desc}</div>
            </button>
          ))}
        </div>
        {!acompanhante && (
          <button onClick={() => setTela("nps")} style={{ ...cartao, width: "100%", marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.tinta }}>Avaliar minha estadia</div>
              <div style={{ fontSize: 11, color: C.tinta60 }}>NPS e ouvidoria</div>
            </div>
            <span style={{ color: C.tinta60 }}>→</span>
          </button>
        )}
      </div>
      <div style={{ padding: "10px 0 16px", display: "flex", justifyContent: "center" }}><SeloHosppital /></div>
    </div>
  );
}

function Servico({ token, servId, acompanhante, onFeito, onVoltar }) {
  const s = SERVICOS[servId];
  const [detalhe, setDetalhe] = useState("");
  const [estado, setEstado] = useState("form");
  async function enviar() {
    setEstado("enviando");
    try { await api.abrirChamado(token, servId, detalhe, acompanhante ? "acompanhante" : "paciente"); setEstado("ok"); setTimeout(onFeito, 1100); }
    catch { setEstado("form"); alert("Não foi possível enviar. Tente de novo."); }
  }
  if (estado === "ok") return (
    <div style={{ padding: "60px 22px", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E8F6EF", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: C.verde }}>✓</div>
      <div style={{ fontWeight: 800, fontSize: 18, color: C.tinta }}>Pedido enviado!</div>
      <div style={{ fontSize: 13, color: C.tinta60, marginTop: 4 }}>A equipe já foi avisada.</div>
    </div>
  );
  return (
    <div style={{ padding: "14px 18px" }}>
      <Voltar onClick={onVoltar} />
      <div style={{ fontWeight: 800, fontSize: 18, margin: "14px 0 3px", color: C.tinta }}>{s.titulo}</div>
      <div style={{ fontSize: 12, color: C.tinta60, marginBottom: 14 }}>Atendido em até {s.sla} min</div>
      <textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Detalhe (opcional)"
        style={{ width: "100%", height: 88, padding: 12, borderRadius: 14, border: `1px solid ${C.linha}`, fontSize: 14, resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      <button disabled={estado === "enviando"} onClick={enviar} style={{ ...btnPrim, marginTop: 14, opacity: estado === "enviando" ? 0.6 : 1 }}>
        {estado === "enviando" ? "Enviando…" : "Enviar pedido"}
      </button>
      <p style={{ textAlign: "center", fontSize: 12, color: C.tinta60, marginTop: 10 }}>Para emergência médica, use a campainha ao lado da cama.</p>
    </div>
  );
}

function Pedidos({ chamados, setTela }) {
  const ordem = ["aberto", "em_atendimento", "concluido"];
  return (
    <div style={{ padding: "14px 18px" }}>
      <Voltar onClick={() => setTela("inicio")} label="Início" />
      <div style={{ fontWeight: 800, fontSize: 19, margin: "12px 0" }}>Meus pedidos</div>
      {chamados.length === 0 && <div style={{ textAlign: "center", color: C.tinta60, padding: 30, fontSize: 14 }}>Nenhum pedido ainda.</div>}
      {chamados.map((c) => {
        const s = SERVICOS[c.servico], st = slaInfo(c), meta = STATUS[c.status], idx = ordem.indexOf(c.status);
        return (
          <div key={c.id} style={{ border: `1px solid ${C.linha}`, borderRadius: 14, padding: 13, marginBottom: 10, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.tinta }}>{s.titulo}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: meta.cor, background: meta.cor + "22" }}>{meta.label}</span>
            </div>
            {c.detalhe && <div style={{ fontSize: 12, color: C.tinta60, marginTop: 3 }}>“{c.detalhe}”</div>}
            <div style={{ display: "flex", gap: 4, margin: "9px 0 7px" }}>
              {ordem.map((e, i) => <div key={e} style={{ flex: 1, height: 5, borderRadius: 4, background: i <= idx ? STATUS[e].cor : C.linha }} />)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.tinta60 }}>
              <span>{c.atendente || "Aguardando equipe"}</span>
              {c.status === "concluido" ? <span style={{ color: C.verde, fontWeight: 700 }}>Pronto ✓</span>
                : st.estourado ? <span style={{ color: C.vermelho, fontWeight: 700 }}>Atrasado</span>
                : <span>~{Math.max(st.restante, 1)} min</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dieta({ dieta, setTela }) {
  if (!dieta) return null;
  return (
    <div style={{ padding: "14px 18px" }}>
      <Voltar onClick={() => setTela("inicio")} label="Início" />
      <div style={{ fontWeight: 800, fontSize: 19, margin: "12px 0" }}>Minha dieta de hoje</div>
      <div style={{ borderRadius: 14, padding: 14, background: C.tealNevoa, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.tinta }}>{dieta.tipo}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {dieta.restricoes.map((r) => <span key={r} style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#fff", color: C.petroleo }}>{r}</span>)}
        </div>
      </div>
      {dieta.refeicoes.map((r, i) => (
        <div key={i} style={{ border: `1px solid ${C.linha}`, borderRadius: 14, padding: 13, marginBottom: 10, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: C.fundo, color: C.tinta60 }}>{r.hora}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.tinta }}>{r.nome}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, ...(r.status === "entregue" ? { background: C.verde + "1a", color: C.verde } : { background: C.fundo, color: C.tinta60 }) }}>{r.status === "entregue" ? "Entregue" : "Previsto"}</span>
          </div>
          <div style={{ fontSize: 14, color: C.tinta60 }}>{r.itens}</div>
        </div>
      ))}
    </div>
  );
}

function NPS({ token, setTela }) {
  const [nota, setNota] = useState(null);
  const [coment, setComent] = useState("");
  const [ok, setOk] = useState(false);
  async function enviar() { try { await api.avaliar(token, nota, "geral", coment); setOk(true); } catch { alert("Erro ao enviar."); } }
  if (ok) {
    const baixo = (nota ?? 10) <= 6;
    return (
      <div style={{ padding: "50px 22px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: baixo ? "#FDECEC" : "#E8F6EF", color: baixo ? C.vermelho : C.verde }}>{baixo ? "♡" : "✓"}</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: C.tinta }}>{baixo ? "Sentimos muito." : "Obrigado!"}</div>
        <div style={{ fontSize: 13, color: C.tinta60, marginTop: 5 }}>{baixo ? "A ouvidoria foi avisada e vai procurar você." : "Sua avaliação ajuda a equipe."}</div>
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 18px" }}>
      <Voltar onClick={() => setTela("inicio")} label="Início" />
      <div style={{ fontWeight: 800, fontSize: 18, margin: "12px 0 4px" }}>Como está sua estadia?</div>
      <div style={{ fontSize: 13, color: C.tinta60, marginBottom: 14 }}>De 0 a 10, recomendaria nosso cuidado?</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 7, marginBottom: 16 }}>
        {Array.from({ length: 11 }, (_, n) => {
          const sel = nota === n, cor = n <= 6 ? C.vermelho : n <= 8 ? C.ambar : C.verde;
          return <button key={n} onClick={() => setNota(n)} style={{ aspectRatio: "1", borderRadius: 10, fontWeight: 700, fontSize: 15, border: `2px solid ${sel ? cor : C.linha}`, background: sel ? cor : "#fff", color: sel ? "#fff" : C.tinta, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>;
        })}
      </div>
      {nota !== null && <>
        <textarea value={coment} onChange={(e) => setComent(e.target.value)} placeholder={nota <= 6 ? "O que podemos melhorar?" : "O que mais gostou?"}
          style={{ width: "100%", height: 80, padding: 12, borderRadius: 14, border: `1px solid ${C.linha}`, fontSize: 14, resize: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }} />
        <button onClick={enviar} style={btnPrim}>Enviar avaliação</button>
      </>}
    </div>
  );
}

const Voltar = ({ onClick, label = "Voltar" }) => <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 700, color: C.petroleo, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>‹ {label}</button>;
const Centro = ({ children }) => <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>{children}</div>;

const rotulo = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.tinta60, marginBottom: 10 };
const cartao = { padding: 13, borderRadius: 14, border: `1px solid ${C.linha}`, background: "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" };
const btnHero = { marginTop: 13, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 11, borderRadius: 14, background: "#fff", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" };
const btnPrim = { width: "100%", padding: 14, borderRadius: 14, background: C.petroleo, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" };
